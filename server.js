'use strict';
// Storm Isle server: static files + dependency-free WebSocket + authoritative match logic.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,'public'),DT=0.05,MAXP=16,FIXED=!!process.env.FIXED_SPAWN;
const PH=[{r:90,wait:20,shrink:25,dmg:1},{r:45,wait:15,shrink:20,dmg:2},{r:15,wait:10,shrink:15,dmg:4},{r:3,wait:8,shrink:12,dmg:8}];
const GUN={dmg:18,gap:110,mag:30,rel:1800,spread:.015,range:150};
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const rooms=new Map();let nid=1;

const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
  const f=path.join(PUB,path.normalize(p));
  if(!f.startsWith(PUB)){res.writeHead(403);return res.end();}
  fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d);});
});
server.on('upgrade',(req,sock)=>{
  const k=req.headers['sec-websocket-key'];if(!k)return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+
    crypto.createHash('sha1').update(k+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');
  const c={sock,buf:Buffer.alloc(0),win:0,cnt:0,p:null,send:o=>frame(sock,Buffer.from(JSON.stringify(o)),1)};
  sock.on('data',d=>{
    c.buf=Buffer.concat([c.buf,d]);if(c.buf.length>65536)return sock.destroy();
    let f;while((f=parse(c))){
      if(f.op===8){sock.end();return;}
      if(f.op===9)frame(sock,f.data,10);
      if(f.op===1)onMsg(c,f.data.toString());
    }});
  sock.on('close',()=>leave(c));sock.on('error',()=>{});
});
function frame(s,d,op){if(s.destroyed)return;const n=d.length;let h;
  if(n<126)h=Buffer.from([128|op,n]);else if(n<65536){h=Buffer.alloc(4);h[0]=128|op;h[1]=126;h.writeUInt16BE(n,2);}
  else{h=Buffer.alloc(10);h[0]=128|op;h[1]=127;h.writeBigUInt64BE(BigInt(n),2);}
  s.write(Buffer.concat([h,d]));}
function parse(c){const b=c.buf;if(b.length<2)return null;let len=b[1]&127,o=2;
  if(len===126){if(b.length<4)return null;len=b.readUInt16BE(2);o=4;}
  else if(len===127){if(b.length<10)return null;len=Number(b.readBigUInt64BE(2));o=10;}
  if(!(b[1]&128)||len>16384){c.sock.destroy();return null;}
  if(b.length<o+4+len)return null;
  const mk=b.subarray(o,o+4),d=Buffer.from(b.subarray(o+4,o+4+len));for(let i=0;i<len;i++)d[i]^=mk[i&3];
  c.buf=b.subarray(o+4+len);return{op:b[0]&15,data:d};}

const bc=(r,o)=>{for(const p of r.players.values())p.c.send(o);};
const aliveList=r=>[...r.players.values()].filter(p=>p.alive);
const num=(v,lo,hi)=>typeof v==='number'&&isFinite(v)&&v>=lo&&v<=hi;
const roster=r=>bc(r,{t:'roster',host:r.host,state:r.state,code:r.code,list:[...r.players.values()].map(p=>[p.id,p.name])});

function onMsg(c,txt){
  let m;try{m=JSON.parse(txt);}catch{return;}
  if(!m||typeof m.t!=='string')return;
  const now=Date.now();if(now-c.win>1000){c.win=now;c.cnt=0;}if(++c.cnt>80)return; // rate limit
  if(m.t==='join'){if(!c.p)join(c,m);return;}
  const p=c.p;if(!p)return;const r=p.room;
  if(m.t==='move'&&p.alive){
    const dt=Math.min(Math.max((now-p.lastMove)/1000,.02),.5);p.lastMove=now;
    if(![m.x,m.z,m.ry].every(v=>num(v,-1e4,1e4))||!num(m.y,0,60))return;
    const hd=Math.hypot(m.x-p.x,m.z-p.z),vd=Math.abs(m.y-p.y);
    if(r.state==='live'&&(hd>9*dt+.8||vd>25*dt+1)||Math.abs(m.x)>150||Math.abs(m.z)>150){p.c.send({t:'corr',x:p.x,y:p.y,z:p.z});return;} // anti-speed/teleport
    p.x=m.x;p.y=m.y;p.z=m.z;p.ry=m.ry;
  }else if(m.t==='shoot'&&p.alive&&r.state==='live')shoot(r,p,m,now);
  else if(m.t==='reload'&&p.alive&&!p.relAt&&p.ammo<GUN.mag)p.relAt=now+GUN.rel;
  else if(m.t==='start'&&r.host===p.id&&r.state==='lobby')start(r);
  else if(m.t==='lobby'&&r.state==='over')reset(r);
  else if(m.t==='chat'&&now-p.lastChat>700){p.lastChat=now;
    const s=String(m.text||'').replace(/[<>\u0000-\u001f]/g,'').slice(0,120);if(s)bc(r,{t:'chat',from:p.name,text:s});}
}
function join(c,m){
  const name=String(m.name||'').replace(/[^\w \-]/g,'').trim().slice(0,16)||'Player';
  let code=String(m.room||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6),r;
  if(!code){r=[...rooms.values()].find(x=>!x.priv&&x.state==='lobby'&&x.players.size<MAXP); // matchmaking
    if(!r)r=mk(Math.random().toString(36).slice(2,8).toUpperCase(),false);}
  else r=rooms.get(code)||mk(code,true);
  if(r.state!=='lobby')return c.send({t:'err',msg:'Match already in progress'});
  if(r.players.size>=MAXP)return c.send({t:'err',msg:'Room full'});
  const p={id:nid++,c,name,room:r,x:0,y:0,z:0,ry:0,hp:100,sh:0,alive:true,ammo:GUN.mag,relAt:0,lastShot:0,lastChat:0,lastMove:Date.now(),k:0,place:0};
  p.x=(Math.random()-.5)*6;p.z=(Math.random()-.5)*6;
  c.p=p;r.players.set(p.id,p);if(!r.host)r.host=p.id;
  c.send({t:'joined',id:p.id});roster(r);
}
function mk(code,priv){const r={code,priv,players:new Map(),state:'lobby',host:0,storm:null,n0:0};rooms.set(code,r);return r;}
function start(r){
  r.state='live';r.n0=r.players.size;r.storm={i:0,t:0,r0:PH[0].r+50,r:PH[0].r+50};let i=0;
  for(const p of r.players.values()){
    const a=Math.random()*6.283,d=50+Math.random()*25;
    p.x=FIXED?0:Math.cos(a)*d;p.z=FIXED?-10*i:Math.sin(a)*d;p.y=0;p.hp=100;p.sh=0;p.alive=true;p.ammo=GUN.mag;p.relAt=0;p.k=0;p.place=0;p.lastMove=Date.now();i++;
    p.c.send({t:'start',x:p.x,y:p.y,z:p.z});}
  roster(r);
}
function reset(r){r.state='lobby';r.storm=null;for(const p of r.players.values()){p.alive=true;p.hp=100;p.x=(Math.random()-.5)*6;p.z=(Math.random()-.5)*6;p.y=0;}roster(r);}
function shoot(r,p,m,now){
  if(p.relAt||now-p.lastShot<GUN.gap)return;
  if(p.ammo<=0){p.relAt=now+GUN.rel;return;}
  if(![m.dx,m.dy,m.dz].every(v=>num(v,-1,1)))return;
  let l=Math.hypot(m.dx,m.dy,m.dz);if(l<.5)return;
  let d=[m.dx/l+(Math.random()-.5)*GUN.spread*2,m.dy/l+(Math.random()-.5)*GUN.spread*2,m.dz/l+(Math.random()-.5)*GUN.spread*2];
  l=Math.hypot(...d);d=d.map(v=>v/l);
  p.lastShot=now;p.ammo--;const o=[p.x,p.y+1.6,p.z];let best=null,bt=GUN.range,head=false;
  for(const v of r.players.values()){ if(v===p||!v.alive)continue;
    for(const [cy,rad,hd] of [[1.6,.3,true],[.8,.55,false]]){
      const vx=v.x-o[0],vy=v.y+cy-o[1],vz=v.z-o[2],t=vx*d[0]+vy*d[1]+vz*d[2];
      if(t<0||t>bt)continue;if(vx*vx+vy*vy+vz*vz-t*t<rad*rad){best=v;bt=t;head=hd;break;}}}
  bc(r,{t:'shot',o,d,len:best?bt:80});
  if(best)hurt(r,best,head?GUN.dmg*2:GUN.dmg,p);
}
function hurt(r,v,amt,by){
  if(!v.alive)return;const s=Math.min(v.sh,amt);v.sh-=s;v.hp-=amt-s;
  if(by)by.c.send({t:'hit'});v.c.send({t:'hurt'});
  if(v.hp<=0){v.hp=0;v.alive=false;v.place=aliveList(r).length+1;if(by&&by!==v)by.k++;
    bc(r,{t:'kill',by:by?by.name:'The Storm',vic:v.name});check(r);}
}
function check(r){
  if(r.state!=='live')return;const a=aliveList(r);
  if(a.length===0||(r.n0>1&&a.length===1)){
    if(a.length===1)a[0].place=1;r.state='over';
    for(const p of r.players.values())p.c.send({t:'over',place:p.place||1,k:p.k,win:p.place===1,winner:a[0]?a[0].name:'Nobody'});
  }}
function leave(c){const p=c.p;if(!p)return;c.p=null;const r=p.room;r.players.delete(p.id);
  if(!r.players.size){rooms.delete(r.code);return;}
  if(r.host===p.id)r.host=r.players.keys().next().value;
  if(r.state==='live'){if(p.alive){p.alive=false;}check(r);}roster(r);}

setInterval(()=>{
  for(const r of rooms.values()){
    const now=Date.now();let st={r:0,n:0,in:0,dmg:0};
    if(r.state==='live'&&r.storm){
      const s=r.storm,ph=PH[s.i];s.t+=DT;
      if(s.t<ph.wait){s.r=s.r0;st.in=ph.wait-s.t;}
      else if(s.t<ph.wait+ph.shrink){s.r=s.r0+(ph.r-s.r0)*(s.t-ph.wait)/ph.shrink;st.in=0;}
      else if(s.i<PH.length-1){s.i++;s.t=0;s.r0=ph.r;s.r=ph.r;}
      st={r:s.r,n:PH[s.i].r,in:Math.max(0,Math.ceil(st.in)),dmg:PH[s.i].dmg,ph:s.i+1};
      for(const p of aliveList(r))if(Math.hypot(p.x,p.z)>s.r)hurt(r,p,PH[s.i].dmg*DT*(s.t<PH[s.i].wait?1:1.5),null);
    }
    const a=[];for(const p of r.players.values()){
      if(p.relAt&&now>=p.relAt){p.relAt=0;p.ammo=GUN.mag;}
      a.push([p.id,+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2),+p.ry.toFixed(2),p.alive?1:0]);}
    const n=aliveList(r).length;
    for(const p of r.players.values())p.c.send({t:'s',p:a,n,st,me:{hp:Math.ceil(p.hp),sh:Math.ceil(p.sh),ammo:p.ammo,rel:p.relAt?1:0,k:p.k}});
  }},DT*1000);
if(require.main===module)server.listen(PORT,()=>console.log('Storm Isle on http://localhost:'+PORT));
module.exports=server;
