'use strict';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MAG={rifle:30,smg:35,shotgun:6},NM={rifle:'Assault Rifle',smg:'Compact SMG',shotgun:'Pump Shotgun',b:'Bandage',m:'Medkit',s:'Shield Potion'};
const RECOIL={rifle:.012,smg:.008,shotgun:.055},LCOL={rifle:0xffaa33,smg:0x33ccff,shotgun:0xff5533,b:0xffffff,m:0xff4466,s:0x3399ff};
let ws,myId=0,mode='menu',host=0,names={},snap=null,me={hp:100,sh:0,ammo:30,rel:0,k:0,gun:'rifle',inv:{b:0,m:0,s:0},use:'',useP:0},sens=+localStorage.sens||.0025;
$('name').value=localStorage.name||'';
// ================= AUDIO (all synthesized, no files) =================
let AC,VOL=1,NB,storm;
const ac=()=>{if(!AC){AC=new(window.AudioContext||window.webkitAudioContext)();}if(AC.state==='suspended')AC.resume();return AC;};
function tone(f,d,v,type='sine',slide=0,delay=0){const a=ac(),o=a.createOscillator(),g=a.createGain(),t=a.currentTime+delay;o.type=type;o.frequency.setValueAtTime(f,t);
 if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),t+d);g.gain.setValueAtTime(v*VOL*.5,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(a.destination);o.start(t);o.stop(t+d);}
function nz(d,v,fc,delay=0){const a=ac();if(!NB){NB=a.createBuffer(1,a.sampleRate,a.sampleRate);const c=NB.getChannelData(0);for(let i=0;i<c.length;i++)c[i]=Math.random()*2-1;}
 const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain(),t=a.currentTime+delay;s.buffer=NB;f.type='lowpass';f.frequency.value=fc;g.gain.setValueAtTime(v*VOL*.6,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f).connect(g).connect(a.destination);s.start(t);s.stop(t+d);}
const SFX={rifle:v=>{nz(.15,v,3200);tone(150,.12,v*.8,'square',-100);},smg:v=>{nz(.08,v*.8,4500);tone(210,.06,v*.5,'square',-130);},shotgun:v=>{nz(.4,v*1.3,1700);tone(90,.28,v,'sawtooth',-60);},
 reload:()=>{tone(900,.04,.3,'square');tone(500,.05,.3,'square',0,.55);tone(700,.04,.3,'square',0,1.1);},pickup:()=>{tone(600,.08,.4,'triangle');tone(900,.1,.4,'triangle',0,.08);},
 heal:()=>[500,650,800,1000].forEach((f,i)=>tone(f,.3,.35,'sine',0,i*.1)),hurt:()=>{tone(130,.18,.7,'sawtooth',-70);nz(.12,.5,900);},hit:()=>tone(1500,.05,.4,'square'),
 step:()=>nz(.07,.25,450),jump:()=>tone(250,.15,.3,'sine',250),land:()=>nz(.14,.4,300),kill:()=>tone(300,.2,.3,'square',-150),
 win:()=>[523,659,784,1047,1319].forEach((f,i)=>tone(f,.45,.5,'triangle',0,i*.15)),lose:()=>[400,320,250].forEach((f,i)=>tone(f,.45,.5,'triangle',0,i*.22))};
const play=(n,v=1)=>{if(!VOL)return;try{SFX[n](v);}catch(e){}};
function stormHum(on){if(!AC)return;if(!storm){const o=AC.createOscillator(),g=AC.createGain();o.type='sawtooth';o.frequency.value=48;g.gain.value=0;o.connect(g).connect(AC.destination);o.start();storm=g;}
 storm.gain.setTargetAtTime(on?.12*VOL:0,AC.currentTime,.3);}
// ================= SCENE =================
const R=new THREE.WebGLRenderer({antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(R.domElement);
const S=new THREE.Scene();S.fog=new THREE.Fog(0xbfe3ff,120,560);
const cam=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,1000);
S.add(new THREE.HemisphereLight(0xcfe8ff,0x4f7a3a,.85));
const sun=new THREE.DirectionalLight(0xfff1d6,1.05);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;
Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,far:300});S.add(sun,sun.target);
const MAT=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8,metalness:.05},o));
// sky dome (vertex gradient) + drifting clouds
const sky=(()=>{const g=new THREE.SphereGeometry(700,24,16),p=g.attributes.position,col=[],top=new THREE.Color(0x2f74c8),hor=new THREE.Color(0xbfe3ff);
 for(let i=0;i<p.count;i++){const t=clamp(p.getY(i)/700,0,1),c=hor.clone().lerp(top,Math.pow(t,.6));col.push(c.r,c.g,c.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));m.renderOrder=-1;S.add(m);return m;})();
const clouds=[];{const cm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,fog:false});
 for(let i=0;i<14;i++){const g=new THREE.Group();for(let k=0;k<4;k++){const s=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),cm);s.scale.set(18+k*4,7,12);s.position.set(k*16-24,Math.random()*4,Math.random()*8);g.add(s);}
  g.position.set((Math.random()-.5)*800,110+Math.random()*50,(Math.random()-.5)*800);S.add(g);clouds.push(g);}}
// terrain: vertex-coloured ground
{const g=new THREE.PlaneGeometry(1000,1000,100,100);g.rotateX(-Math.PI/2);const p=g.attributes.position,col=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n=Math.sin(x*.05)*Math.cos(z*.04)*.08+Math.sin(x*.21+z*.13)*.03+(Math.random()-.5)*.04,sand=Math.hypot(x,z)>170?.25:0;
  col.push(.28+n+sand,.55+n*1.2-sand*.2,.22+n*.5+sand*.2);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true}));m.receiveShadow=true;S.add(m);}
// ponds
for(const[x,z,r]of[[-100,-90,16],[100,-105,18],[115,95,13]]){const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),MAT(0x3a8fd0,{transparent:true,opacity:.85,roughness:.15,metalness:.3}));m.rotation.x=-Math.PI/2;m.position.set(x,.06,z);S.add(m);}
// seeded scenery shared by everyone
let sd=99;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
{const free=(x,z,m)=>Math.hypot(x,z)>8&&!World.inHouse(x,z,m);
 const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.34,2.4,6),MAT(0x6b4a2b),240),c1=new THREE.InstancedMesh(new THREE.ConeGeometry(1.9,3.2,8),MAT(0x2f7d3a),240),c2=new THREE.InstancedMesh(new THREE.ConeGeometry(1.4,2.6,8),MAT(0x3a9248),240),rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),MAT(0x8a8a86,{flatShading:true}),80);
 const o=new THREE.Object3D();let n=0;
 while(n<240){const x=(rnd()-.5)*330,z=(rnd()-.5)*330;if(!free(x,z,3))continue;const s=.8+rnd()*.8;
  o.rotation.set(0,0,0);o.scale.setScalar(s);o.position.set(x,1.2*s,z);o.updateMatrix();trunk.setMatrixAt(n,o.matrix);
  o.position.y=(2.4+1.2)*s;o.updateMatrix();c1.setMatrixAt(n,o.matrix);o.position.y=(2.4+3)*s;o.updateMatrix();c2.setMatrixAt(n,o.matrix);n++;}
 n=0;while(n<80){const x=(rnd()-.5)*340,z=(rnd()-.5)*340;if(!free(x,z,2))continue;const s=.5+rnd()*1.4;o.scale.set(s*1.3,s*.8,s);o.rotation.set(rnd(),rnd()*6,0);o.position.set(x,s*.3,z);o.updateMatrix();rocks.setMatrixAt(n++,o.matrix);}
 for(const m of[trunk,c1,c2,rocks]){m.castShadow=true;m.receiveShadow=true;S.add(m);}}
// houses: body, pitched roof, door, windows, chimney, trim
{const win=MAT(0x9fd6ff,{emissive:0x335566,roughness:.2}),door=MAT(0x5a3a22),roofM=[0x9c3b32,0x4b5a6b,0x6b4a2b].map(c=>MAT(c)),trim=MAT(0xf2efe6),brick=MAT(0x8a4b3a),roofG=new THREE.ConeGeometry(1,1,4).rotateY(Math.PI/4);
 World.houses.forEach((h,i)=>{const g=new THREE.Group(),add=(w,hh,d,m,x,y,z,sh)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,hh,d),m);b.position.set(x,y,z);b.castShadow=b.receiveShadow=!!sh;g.add(b);return b;};
  add(h.w,h.h,h.d,MAT(h.c),0,h.h/2,0,1);add(h.w+.3,.35,h.d+.3,trim,0,.17,0);if(h.h>5)add(h.w+.2,.2,h.d+.2,trim,0,3.9,0);
  const r=new THREE.Mesh(roofG,roofM[i%3]);r.scale.set(h.w*.78,2.4,h.d*.78);r.position.y=h.h+1.2;r.castShadow=true;g.add(r);
  add(1.4,2.5,.12,door,0,1.25,-h.d/2-.02);add(.1,.1,.1,trim,.45,1.2,-h.d/2-.1);
  for(const sx of[-1,1]){add(1.2,1.2,.1,win,sx*h.w*.3,2.2,-h.d/2-.02);add(.1,1.2,1.2,win,sx*(h.w/2+.02),2.2,0);if(h.h>5)add(1.2,1.2,.1,win,sx*h.w*.3,5,-h.d/2-.02);}
  add(.8,2.2,.8,brick,h.w*.3,h.h+1.8,h.d*.2,1);g.position.set(h.x,0,h.z);g.rotation.y=(i%4)*Math.PI/2*0;S.add(g);});}
// mountains ring (outside playable area)
for(const m of World.mountains){const g=new THREE.Group(),b=new THREE.Mesh(new THREE.ConeGeometry(m.r,m.h,7),MAT(0x6f6a63,{flatShading:true,roughness:1}));b.position.y=m.h/2;b.rotation.y=m.rot;g.add(b);
 if(m.h>65){const c=new THREE.Mesh(new THREE.ConeGeometry(m.r*.38,m.h*.36,7),MAT(0xf4f7fb,{flatShading:true}));c.position.y=m.h*.83;c.rotation.y=m.rot;g.add(c);}
 g.position.set(m.x,0,m.z);S.add(g);}
const wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,90,64,1,true),new THREE.MeshBasicMaterial({color:0x8a2be2,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false,fog:false}));wall.position.y=45;wall.visible=false;S.add(wall);
// ================= MODELS: guns, loot, characters =================
function gunMesh(t){const g=new THREE.Group(),M=(c,mt)=>MAT(c,{metalness:mt??.7,roughness:.4});
 const B=(w,h,d,x,y,z,c,mt)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c,mt));o.position.set(x,y,z);o.castShadow=true;g.add(o);};
 const C=(r,l,x,y,z,c)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,10),M(c));o.rotation.x=Math.PI/2;o.position.set(x,y,z);g.add(o);};
 if(t==='rifle'){B(.07,.13,.6,0,0,-.15,0x2b2e33);B(.06,.14,.22,0,-.02,.28,0x5a4630,.1);B(.05,.2,.07,0,-.16,.0,0x2b2e33);B(.06,.2,.1,0,-.17,-.28,0x1a1a1a);C(.022,.5,0,.02,-.7,0x15171a);B(.04,.05,.2,0,.09,-.2,0x111);B(.05,.04,.06,0,.14,-.1,0x333);}
 else if(t==='smg'){B(.07,.12,.4,0,0,-.1,0x33363b);B(.05,.2,.07,0,-.16,.02,0x222);B(.05,.26,.08,0,-.2,-.18,0x1a1a1a);C(.02,.25,0,.02,-.42,0x15171a);B(.05,.05,.14,0,.08,-.05,0x111);B(.04,.05,.12,0,0,.2,0x444);}
 else{B(.08,.12,.5,0,0,-.1,0x4a3b2a,.1);C(.03,.7,0,.02,-.65,0x1c1d20);C(.035,.45,0,-.06,-.55,0x2b2e33);B(.07,.15,.3,0,-.03,.32,0x5a4630,.1);B(.05,.17,.07,0,-.15,.0,0x2b2e33);B(.09,.09,.16,0,-.06,-.45,0x6b4a2b,.1);}
 g.userData.mz={rifle:-.98,smg:-.56,shotgun:-1.0}[t];return g;}
function itemMesh(t){if(MAG[t])return gunMesh(t);const g=new THREE.Group();
 if(t==='s'){const b=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.34,12),MAT(0x3399ff,{transparent:true,opacity:.85,emissive:0x114477,roughness:.1}));b.position.y=.17;const n=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.14,8),MAT(0xdddddd));n.position.y=.4;g.add(b,n);}
 else{const body=MAT(t==='m'?0xcc2233:0xf5f5f5),cross=MAT(t==='m'?0xffffff:0xdd2233),b=new THREE.Mesh(new THREE.BoxGeometry(.5,.32,.2),body);b.position.y=.16;g.add(b);
  for(const[w,h]of[[.26,.07],[.07,.26]]){const c=new THREE.Mesh(new THREE.BoxGeometry(w,h,.22),cross);c.position.y=.16;g.add(c);}}
 return g;}
const av={};
function mkAv(id){const g=new THREE.Group();g.rotation.order='YXZ';const c=new THREE.Color().setHSL((id*.17)%1,.6,.45),c2=new THREE.Color().setHSL((id*.17+.5)%1,.45,.28);
 const skin=MAT(0xe8b88f,{roughness:.6}),shirt=MAT(c),pants=MAT(c2),dark=MAT(0x202226);
 const bx=(w,h,d,m,x,y,z,p)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;(p||g).add(o);return o;};
 const torso=bx(.56,.66,.3,shirt,0,1.1,0);bx(.5,.2,.28,pants,0,.72,0);bx(.58,.08,.32,dark,0,.8,0);bx(.14,.1,.14,skin,0,1.48,0);bx(.4,.45,.18,MAT(0x445566),0,1.15,.24);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),skin);head.position.y=1.65;head.castShadow=true;g.add(head);
 const helm=new THREE.Mesh(new THREE.SphereGeometry(.225,16,10,0,6.283,0,1.5),MAT(c2,{metalness:.3}));helm.position.y=1.69;g.add(helm);bx(.4,.04,.1,MAT(c2),0,1.63,-.2,g);
 bx(.06,.05,.02,dark,-.08,1.66,-.2);bx(.06,.05,.02,dark,.08,1.66,-.2);
 const limb=(w,h,x,y,m,tip)=>{const p=new THREE.Group();p.position.set(x,y,0);bx(w,h,w,m,0,-h/2,0,p);if(tip)bx(w*1.1,.14,w*1.5,tip,0,-h+.06,-.03,p);g.add(p);return p;};
 const lL=limb(.2,.74,-.14,.74,pants,dark),rL=limb(.2,.74,.14,.74,pants,dark),lA=limb(.15,.6,-.37,1.4,shirt,skin),rA=limb(.15,.6,.37,1.4,shirt,skin);
 const gh=new THREE.Group();gh.position.set(.3,1.25,-.4);g.add(gh);
 const fl=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xffdd77}));fl.visible=false;gh.add(fl);
 g.userData={t:new THREE.Vector3(),lL,rL,lA,rA,torso,head,gh,fl,gm:null,gun:'',ph:0,spd:0,kick:0,dead:0,reload:0,lx:0,lz:0};S.add(g);return av[id]=g;}
function setGun(g,t){const u=g.userData;if(u.gm)u.gh.remove(u.gm);u.gm=gunMesh(t);u.gh.add(u.gm);u.gun=t;u.fl.position.z=u.gm.userData.mz;}
function animAv(g,dt,air,alive,time,id){const u=g.userData;u.dead+=((alive?0:1)-u.dead)*Math.min(1,6*dt);u.kick=Math.max(0,u.kick-dt*7);
 const sw=Math.sin(u.ph+=u.spd*dt*1.7)*Math.min(1,u.spd/6)*.95;
 if(air){u.lL.rotation.x=-.7;u.rL.rotation.x=.5;}else{u.lL.rotation.x=sw;u.rL.rotation.x=-sw;}
 u.rA.rotation.x=1.35-u.kick*.25+u.reload*.35;u.lA.rotation.x=1.15-u.kick*.2+u.reload*.5;u.lA.rotation.z=.3;
 u.gh.position.z=-.4+u.kick*.12;u.gh.rotation.x=u.kick*.18+u.reload*.6;u.fl.visible=u.kick>.6;u.fl.scale.setScalar(.7+Math.random()*.6);
 u.torso.rotation.x=-Math.min(1,u.spd/8)*.12;u.torso.scale.y=1+Math.sin(time*2.2+id)*.012;u.head.position.y=1.65+Math.sin(u.ph*2)*.015*Math.min(1,u.spd/5);
 g.rotation.x=-u.dead*1.45;g.position.y+=u.dead*.15;}
// loot on the floor
const loot=new Map();
function addLoot(l){if(loot.has(l.id))return;const g=new THREE.Group(),it=itemMesh(l.type),col=LCOL[l.type];it.scale.setScalar(MAG[l.type]?1.5:1.6);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,6,10,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=3;
 const ring=new THREE.Mesh(new THREE.RingGeometry(.6,.8,24),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.6,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.05;
 g.add(it,beam,ring);g.position.set(l.x,0,l.z);g.userData={it,l};S.add(g);loot.set(l.id,g);}
function clearLoot(){for(const g of loot.values())S.remove(g);loot.clear();}
// ================= NETWORK =================
const L={x:0,y:0,z:0,vx:0,vz:0,vy:0,yaw:0,pitch:.1,ground:true,alive:true,step:0};
function connect(){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
 ws.onopen=()=>send({t:'join',name:$('name').value,room:$('room').value});
 ws.onclose=()=>{if(mode!=='menu'){mode='menu';show('menu');$('err').textContent='Disconnected';}};ws.onmessage=e=>onMsg(JSON.parse(e.data));}
const send=o=>ws&&ws.readyState===1&&ws.send(JSON.stringify(o));
function show(w){for(const i of['menu','lobby','end'])$(i).classList.toggle('hide',i!==w);$('hud').classList.toggle('hide',w!==null);if(w&&document.exitPointerLock)document.exitPointerLock();}
function log(el,txt,ms){const d=document.createElement('div');d.textContent=txt;$(el).appendChild(d);setTimeout(()=>d.remove(),ms);}
let pend=0;const spark=new THREE.SphereGeometry(.12,6,4),sparkM=new THREE.MeshBasicMaterial({color:0xffcc66}),lineM=new THREE.LineBasicMaterial({color:0xffee88});
function onMsg(m){switch(m.t){
 case'err':$('err').textContent=m.msg;break;
 case'joined':myId=m.id;mode='lobby';localStorage.name=$('name').value;show('lobby');break;
 case'roster':host=m.host;names={};m.list.forEach(([i,n])=>names[i]=n);$('code').textContent=m.code;
  $('list').innerHTML=m.list.map(([i,n])=>'<div>'+(i===host?'👑 ':'')+n.replace(/</g,'&lt;')+'</div>').join('');
  $('start').classList.toggle('hide',host!==myId);$('wait').textContent=host===myId?'Share the code with friends, then start.':'Waiting for host…';
  if(m.state==='lobby'){clearLoot();if(mode!=='lobby'){mode='lobby';show('lobby');}}break;
 case'start':ac();L.x=m.x;L.y=m.y;L.z=m.z;L.vx=L.vz=L.vy=0;L.alive=true;mode='live';show(null);$('feed').innerHTML='';R.domElement.requestPointerLock();break;
 case'loot':clearLoot();m.list.forEach(addLoot);break;
 case'lootadd':addLoot(m.l);break;
 case'lootrm':{const g=loot.get(m.id);if(g){S.remove(g);loot.delete(m.id);if(performance.now()-pend<700)play('pickup');}break;}
 case'healed':play('heal');break;
 case'corr':L.x=m.x;L.y=m.y;L.z=m.z;L.vy=0;break;
 case's':snap=m;me=m.me;L.alive=m.p.some(p=>p[0]===myId&&p[5]);break;
 case'shot':{const u=av[m.id];if(u)u.userData.kick=1;const gun=u&&u.userData.gun||'rifle',d0=Math.hypot(m.o[0]-cam.position.x,m.o[1]-cam.position.y,m.o[2]-cam.position.z);
  play(gun,clamp(1-d0/140,0,1));if(m.id===myId)L.pitch+=RECOIL[gun];
  for(const[d,len]of m.e){const e=new THREE.Vector3(m.o[0]+d[0]*len,m.o[1]+d[1]*len,m.o[2]+d[2]*len),ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...m.o),e]),lineM);S.add(ln);
   let sp=null;if(len<79){sp=new THREE.Mesh(spark,sparkM);sp.position.copy(e);S.add(sp);}
   setTimeout(()=>{S.remove(ln);ln.geometry.dispose();if(sp)S.remove(sp);},80);}break;}
 case'hit':play('hit');$('cross').style.borderColor='#f33';setTimeout(()=>$('cross').style.borderColor='#fff',120);break;
 case'hurt':play('hurt');$('hurt').style.opacity=1;setTimeout(()=>$('hurt').style.opacity=0,150);break;
 case'kill':play('kill',.6);log('feed',m.by+' ➜ '+m.vic,6000);break;
 case'chat':log('chat',m.from+': '+m.text,10000);break;
 case'over':mode='over';play(m.win?'win':'lose');stormHum(false);$('et').textContent=m.win?'VICTORY ROYALE':'ELIMINATED';
  $('es').innerHTML='Placement: #'+m.place+'<br>Eliminations: '+m.k+(m.win?'':'<br>Winner: '+m.winner);show('end');break;}}
$('join').onclick=()=>{ac();if(!ws||ws.readyState>1)connect();else send({t:'join',name:$('name').value,room:$('room').value});};
$('start').onclick=()=>send({t:'start'});$('back').onclick=()=>send({t:'lobby'});
// ================= INPUT =================
const K={};let fire=false,chatting=false;
addEventListener('keydown',e=>{
 if(e.code==='Enter'&&mode!=='menu'&&mode!=='over'){chatting=!chatting;$('ci').classList.toggle('hide',!chatting);
  if(chatting){document.exitPointerLock();$('ci').focus();}else{if($('ci').value)send({t:'chat',text:$('ci').value});$('ci').value='';R.domElement.requestPointerLock();}return;}
 if(chatting||e.target.tagName==='INPUT')return;K[e.code]=1;if(e.repeat)return;
 if(e.code==='KeyR'&&me.ammo<MAG[me.gun]){send({t:'reload'});play('reload',.8);}
 if(e.code==='KeyM'){VOL=VOL?0:1;if(!VOL)stormHum(false);}
 if(e.code==='KeyE'&&near){pend=performance.now();send({t:'pickup',id:near});}
 const k={Digit1:'b',Digit2:'m',Digit3:'s'}[e.code];if(k)send({t:'use',k});});
addEventListener('keyup',e=>K[e.code]=0);
addEventListener('mousemove',e=>{if(document.pointerLockElement){L.yaw-=e.movementX*sens;L.pitch=clamp(L.pitch-e.movementY*sens,-1.2,1.2);}});
addEventListener('mousedown',e=>{ac();if(mode==='live'||mode==='lobby'){if(!document.pointerLockElement&&!chatting)R.domElement.requestPointerLock();else if(e.button===0)fire=true;}});
addEventListener('mouseup',()=>fire=false);
addEventListener('resize',()=>{R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();});
// ================= LOOP =================
let last=performance.now(),tm=0,tf=0,near=0,invHtml='',time=0,fov=70;const fwd=new THREE.Vector3();
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.1);last=now;time+=dt;
 if(mode==='live'||mode==='lobby'){
  const wasGround=L.ground,preVy=L.vy;
  if(L.alive&&!chatting){const f=(K.KeyW?1:0)-(K.KeyS?1:0),r=(K.KeyD?1:0)-(K.KeyA?1:0),sp=K.ShiftLeft?8:5,l=Math.hypot(f,r)||1;
   const tx=(-Math.sin(L.yaw)*f+Math.cos(L.yaw)*r)/l*sp,tz=(-Math.cos(L.yaw)*f-Math.sin(L.yaw)*r)/l*sp,a=Math.min(1,12*dt);
   L.vx+=(tx-L.vx)*a;L.vz+=(tz-L.vz)*a;if(K.Space&&L.ground){L.vy=8;L.ground=false;play('jump');}}
  else{L.vx*=.8;L.vz*=.8;}
  L.vy-=22*dt;L.x=clamp(L.x+L.vx*dt,-149,149);L.z=clamp(L.z+L.vz*dt,-149,149);L.y+=L.vy*dt;
  if(L.y<=0){L.y=0;L.vy=0;L.ground=true;if(!wasGround&&preVy<-6)play('land');}
  if(L.alive)for(const h of World.houses){const px=h.w/2+.45-Math.abs(L.x-h.x),pz=h.d/2+.45-Math.abs(L.z-h.z); // solid houses
   if(px>0&&pz>0&&L.y<h.h-.2){if(px<pz)L.x+=Math.sign(L.x-h.x||1)*px;else L.z+=Math.sign(L.z-h.z||1)*pz;}}
  const spd=Math.hypot(L.vx,L.vz);if(L.ground&&spd>1.5&&L.alive){L.step-=dt*spd;if(L.step<=0){L.step=2.4;play('step',.5);}}
  tm+=dt;if(tm>.05){tm=0;if(L.alive)send({t:'move',x:L.x,y:L.y,z:L.z,ry:L.yaw});}
  tf-=dt;if(fire&&L.alive&&tf<=0&&document.pointerLockElement&&me.ammo>0){tf=.07;cam.getWorldDirection(fwd);
   const ex=L.x,ey=L.y+1.6,ez=L.z,dx=cam.position.x+fwd.x*80-ex,dy=cam.position.y+fwd.y*80-ey,dz=cam.position.z+fwd.z*80-ez,l=Math.hypot(dx,dy,dz);
   send({t:'shoot',dx:dx/l,dy:dy/l,dz:dz/l});}
  if(fire&&me.ammo<=0&&L.alive&&tf<=0){tf=.5;play('reload',.5);}}
 if(snap){const seen=new Set();
  for(const[id,x,y,z,ry,al,gun]of snap.p){seen.add(id);const g=av[id]||mkAv(id),u=g.userData;if(u.gun!==gun)setGun(g,gun);
   if(id===myId){g.position.set(L.x,L.y,L.z);g.rotation.y=L.yaw;u.spd=Math.hypot(L.vx,L.vz);u.reload=me.rel?1:0;}
   else{u.t.set(x,y,z);g.position.lerp(u.t,1-Math.exp(-15*dt));g.rotation.y=ry;const raw=Math.hypot(g.position.x-u.lx,g.position.z-u.lz)/Math.max(dt,.001);u.spd+=(Math.min(raw,10)-u.spd)*Math.min(1,10*dt);}
   u.lx=g.position.x;u.lz=g.position.z;animAv(g,dt,g.position.y>.15,!!al,time,id);}
  for(const id in av)if(!seen.has(+id)){S.remove(av[id]);delete av[id];}
  const s=snap.st;wall.visible=s.r>0;if(s.r>0){wall.scale.set(s.r,1,s.r);wall.material.opacity=.3+Math.sin(time*3)*.06;}}
 // loot animation + pickup prompt
 near=0;let nd=3,nt='';for(const g of loot.values()){g.userData.it.rotation.y+=dt*1.6;g.userData.it.position.y=.9+Math.sin(time*2+g.userData.l.id)*.12;
  const d=Math.hypot(g.userData.l.x-L.x,g.userData.l.z-L.z);if(d<nd&&L.alive){nd=d;near=g.userData.l.id;nt=g.userData.l.type;}}
 $('prompt').textContent=near?'[E] Pick up '+NM[nt]:'';
 // camera: follow self, or spectate first living player
 let tgt={x:L.x,y:L.y,z:L.z};
 if(!L.alive&&snap){const o=snap.p.find(p=>p[5]&&p[0]!==myId);if(o)tgt={x:o[1],y:o[2],z:o[3]};}
 const cp=Math.cos(L.pitch),fx=-Math.sin(L.yaw)*cp,fy=Math.sin(L.pitch),fz=-Math.cos(L.yaw)*cp,rx=Math.cos(L.yaw),rz=-Math.sin(L.yaw);
 cam.position.set(tgt.x-fx*4.5+rx*.8,Math.max(.4,tgt.y+1.7-fy*4.5),tgt.z-fz*4.5+rz*.8);cam.lookAt(tgt.x+fx*30,tgt.y+1.7+fy*30,tgt.z+fz*30);
 const tf2=K.ShiftLeft&&Math.hypot(L.vx,L.vz)>5?78:70;fov+=(tf2-fov)*Math.min(1,6*dt);if(Math.abs(cam.fov-fov)>.05){cam.fov=fov;cam.updateProjectionMatrix();}
 sun.position.set(tgt.x+60,100,tgt.z+40);sun.target.position.set(tgt.x,0,tgt.z);sky.position.copy(cam.position);
 for(const c of clouds){c.position.x+=dt*2;if(c.position.x>450)c.position.x=-450;}
 if(mode==='live'&&snap){const s=snap.st,out=Math.hypot(L.x,L.z)>s.r;
  $('hp').style.width=me.hp+'%';$('sh').style.width=me.sh+'%';$('ammo').textContent=me.rel?'RELOADING':me.ammo+' / '+MAG[me.gun];
  $('top').innerHTML='Alive: '+snap.n+'<br>Elims: '+me.k;
  $('storm').textContent=(s.in>0?'Storm shrinks in '+s.in+'s':'Storm closing')+' — Phase '+s.ph+(out?'  ⚠ IN STORM':'');$('storm').style.color=out?'#f6f':'#fff';stormHum(out&&L.alive);
  const h='<b>'+NM[me.gun]+'</b>'+['b','m','s'].map((k,i)=>'<b style="'+(me.use===k?'border-color:#6f6':'')+'">['+(i+1)+'] '+NM[k]+'<br>x'+me.inv[k]+'</b>').join('');
  if(h!==invHtml){$('inv').innerHTML=h;invHtml=h;}
  $('use').style.display=me.use?'block':'none';if(me.use)$('use').firstChild.style.width=(1-me.useP)*100+'%';}
 R.render(S,cam);}
requestAnimationFrame(loop);
