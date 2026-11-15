// Integration test: spawns the server and plays a 2-client match over real WebSockets.
const {spawn}=require('child_process');const PORT=3111;
const srv=spawn('node',['server.js'],{env:{...process.env,PORT,FIXED_SPAWN:'1'},stdio:'inherit'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
function client(name){return new Promise(res=>{const w=new WebSocket('ws://localhost:'+PORT);const c={w,ev:[],me:null,send:o=>w.send(JSON.stringify(o))};
  w.onmessage=e=>{const m=JSON.parse(e.data);c.ev.push(m);if(m.t==='s')c.me=m.me;};w.onopen=()=>{c.send({t:'join',name:name,room:'TEST'});res(c);};});}
const has=(c,t)=>c.ev.some(m=>m.t===t);
(async()=>{
  await sleep(600);
  const page=await fetch('http://localhost:'+PORT+'/');ok(page.status===404||page.status===200,'HTTP static responds ('+page.status+')');
  const a=await client('Alice'),b=await client('Bob');await sleep(300);
  ok(has(a,'joined')&&has(b,'roster'),'both clients joined room');
  b.send({t:'start'});await sleep(100);ok(!has(a,'start'),'non-host cannot start');
  a.send({t:'start'});await sleep(300);ok(has(a,'start')&&has(b,'start'),'host starts match');
  a.send({t:'move',x:100,y:0,z:0,ry:0});await sleep(150);ok(has(a,'corr'),'teleport rejected (anti-cheat)');
  for(let i=0;i<9&&!has(b,'over');i++){a.send({t:'shoot',dx:0,dy:-.07,dz:-1});await sleep(130);}
  await sleep(300);
  ok(has(a,'hit'),'server registered hits');
  ok(a.me.ammo<30,'ammo decremented server-side ('+a.me.ammo+')');
  ok(has(b,'kill'),'kill broadcast');
  const ov=b.ev.find(m=>m.t==='over'),ova=a.ev.find(m=>m.t==='over');
  ok(ov&&ov.place===2&&!ov.win,'victim gets placement 2');ok(ova&&ova.win&&ova.k===1,'winner declared with 1 elimination');
  a.send({t:'lobby'});await sleep(200);ok(a.ev.filter(m=>m.t==='roster').pop().state==='lobby','room returns to lobby');
  console.log(fails?'FAILED':'ALL PASSED');srv.kill();process.exit(fails?1:0);
})();
setTimeout(()=>{console.log('TIMEOUT');srv.kill();process.exit(1);},20000);
