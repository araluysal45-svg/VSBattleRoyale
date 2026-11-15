'use strict';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let ws,myId=0,mode='menu',host=0,names={},snap=null,me={hp:100,sh:0,ammo:30,rel:0,k:0},sens=+localStorage.sens||.0025;
$('name').value=localStorage.name||'';
// ---- scene ----
const R=new THREE.WebGLRenderer({antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);R.shadowMap.enabled=true;document.body.prepend(R.domElement);
const S=new THREE.Scene();S.background=new THREE.Color(0x87ceeb);S.fog=new THREE.Fog(0x87ceeb,90,420);
const cam=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,700);
S.add(new THREE.HemisphereLight(0xffffff,0x557744,.75));
const sun=new THREE.DirectionalLight(0xffffff,.9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,far:300});S.add(sun,sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshLambertMaterial({color:0x62b850}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;S.add(ground);
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const M=c=>new THREE.MeshLambertMaterial({color:c});
for(let i=0;i<140;i++){const x=(rnd()-.5)*300,z=(rnd()-.5)*300;if(Math.hypot(x,z)<8)continue;
  const t=new THREE.Group(),h=3+rnd()*3;const tr=new THREE.Mesh(new THREE.CylinderGeometry(.25,.35,h*.5),M(0x6b4a2b));tr.position.y=h*.25;
  const l=new THREE.Mesh(new THREE.ConeGeometry(1.6,h,8),M(0x2f7d3a));l.position.y=h*.5+h*.4;tr.castShadow=l.castShadow=true;t.add(tr,l);t.position.set(x,0,z);S.add(t);}
for(let i=0;i<14;i++){const x=(rnd()-.5)*240,z=(rnd()-.5)*240;if(Math.hypot(x,z)<15)continue;
  const b=new THREE.Mesh(new THREE.BoxGeometry(6+rnd()*5,4,6+rnd()*5),M([0xd9c9a3,0xc77,0x9ab,0xdc9][i%4]));b.position.set(x,2,z);b.castShadow=b.receiveShadow=true;S.add(b);}
const wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,90,64,1,true),new THREE.MeshBasicMaterial({color:0x8a2be2,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));wall.position.y=45;wall.visible=false;S.add(wall);
// ---- avatars ----
const av={};function mkAv(id){const g=new THREE.Group(),c=new THREE.Color().setHSL((id*.17)%1,.7,.5);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,1.1,12),M(c)),head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),M(0xf2c9a0)),gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.14,.8),M(0x222));
  body.position.y=.7;head.position.y=1.5;gun.position.set(.3,1.0,-.45);[body,head,gun].forEach(m=>m.castShadow=true);g.add(body,head,gun);g.userData.t=new THREE.Vector3();S.add(g);return av[id]=g;}
const L={x:0,y:0,z:0,vx:0,vz:0,vy:0,yaw:0,pitch:.1,ground:true,alive:true};
// ---- network ----
function connect(){ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
  ws.onopen=()=>send({t:'join',name:$('name').value,room:$('room').value});
  ws.onclose=()=>{if(mode!=='menu'){mode='menu';show('menu');$('err').textContent='Disconnected';}};ws.onmessage=e=>onMsg(JSON.parse(e.data));}
const send=o=>ws&&ws.readyState===1&&ws.send(JSON.stringify(o));
function show(w){for(const i of['menu','lobby','end'])$(i).classList.toggle('hide',i!==w);$('hud').classList.toggle('hide',w!==null);if(w)document.exitPointerLock&&document.exitPointerLock();}
function log(el,txt,ms){const d=document.createElement('div');d.textContent=txt;$(el).appendChild(d);setTimeout(()=>d.remove(),ms);}
function onMsg(m){switch(m.t){
 case'err':$('err').textContent=m.msg;break;
 case'joined':myId=m.id;mode='lobby';localStorage.name=$('name').value;show('lobby');break;
 case'roster':host=m.host;names={};m.list.forEach(([i,n])=>names[i]=n);$('code').textContent=m.code;
  $('list').innerHTML=m.list.map(([i,n])=>'<div>'+(i===host?'👑 ':'')+n.replace(/</g,'&lt;')+'</div>').join('');
  $('start').classList.toggle('hide',host!==myId);$('wait').textContent=host===myId?'Share the code with friends, then start.':'Waiting for host…';
  if(m.state==='lobby'&&mode!=='lobby'){mode='lobby';show('lobby');}break;
 case'start':L.x=m.x;L.y=m.y;L.z=m.z;L.vx=L.vz=L.vy=0;L.alive=true;mode='live';show(null);$('feed').innerHTML='';R.domElement.requestPointerLock();break;
 case'corr':L.x=m.x;L.y=m.y;L.z=m.z;L.vy=0;break;
 case's':snap=m;me=m.me;L.alive=m.p.some(p=>p[0]===myId&&p[5]);break;
 case'shot':{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...m.o),new THREE.Vector3(m.o[0]+m.d[0]*m.len,m.o[1]+m.d[1]*m.len,m.o[2]+m.d[2]*m.len)]);
  const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffee88}));S.add(l);setTimeout(()=>{S.remove(l);g.dispose();},70);break;}
 case'hit':$('cross').style.borderColor='#f33';setTimeout(()=>$('cross').style.borderColor='#fff',120);break;
 case'hurt':$('hurt').style.opacity=1;setTimeout(()=>$('hurt').style.opacity=0,150);break;
 case'kill':log('feed',m.by+' ➜ '+m.vic,6000);break;
 case'chat':log('chat',m.from+': '+m.text,10000);break;
 case'over':mode='over';$('et').textContent=m.win?'VICTORY ROYALE':'ELIMINATED';
  $('es').innerHTML='Placement: #'+m.place+'<br>Eliminations: '+m.k+(m.win?'':'<br>Winner: '+m.winner);show('end');break;}}
$('join').onclick=()=>{if(!ws||ws.readyState>1)connect();else send({t:'join',name:$('name').value,room:$('room').value});};
$('start').onclick=()=>send({t:'start'});$('back').onclick=()=>send({t:'lobby'});
// ---- input ----
const K={};let fire=false,chatting=false;
addEventListener('keydown',e=>{
 if(e.code==='Enter'&&mode!=='menu'&&mode!=='over'){chatting=!chatting;$('ci').classList.toggle('hide',!chatting);
  if(chatting){document.exitPointerLock();$('ci').focus();}else{if($('ci').value)send({t:'chat',text:$('ci').value});$('ci').value='';R.domElement.requestPointerLock();}return;}
 if(chatting||e.target.tagName==='INPUT')return;K[e.code]=1;if(e.code==='KeyR')send({t:'reload'});});
addEventListener('keyup',e=>K[e.code]=0);
addEventListener('mousemove',e=>{if(document.pointerLockElement){L.yaw-=e.movementX*sens;L.pitch=clamp(L.pitch-e.movementY*sens,-1.2,1.2);}});
addEventListener('mousedown',e=>{if(mode==='live'||mode==='lobby'){if(!document.pointerLockElement&&!chatting)R.domElement.requestPointerLock();else if(e.button===0)fire=true;}});
addEventListener('mouseup',()=>fire=false);
addEventListener('resize',()=>{R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();});
// ---- loop ----
let last=performance.now(),tm=0,tf=0;const fwd=new THREE.Vector3();
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.1);last=now;
 if(mode==='live'||mode==='lobby'){
  if(L.alive&&!chatting){const f=(K.KeyW?1:0)-(K.KeyS?1:0),r=(K.KeyD?1:0)-(K.KeyA?1:0),sp=K.ShiftLeft?8:5,l=Math.hypot(f,r)||1;
   const tx=(-Math.sin(L.yaw)*f+Math.cos(L.yaw)*r)/l*sp,tz=(-Math.cos(L.yaw)*f-Math.sin(L.yaw)*r)/l*sp,a=Math.min(1,12*dt);
   L.vx+=(tx-L.vx)*a;L.vz+=(tz-L.vz)*a;if(K.Space&&L.ground){L.vy=8;L.ground=false;}}
  else{L.vx*=.8;L.vz*=.8;}
  L.vy-=22*dt;L.x=clamp(L.x+L.vx*dt,-149,149);L.z=clamp(L.z+L.vz*dt,-149,149);L.y+=L.vy*dt;if(L.y<=0){L.y=0;L.vy=0;L.ground=true;}
  tm+=dt;if(tm>.05){tm=0;if(L.alive)send({t:'move',x:L.x,y:L.y,z:L.z,ry:L.yaw});}
  tf-=dt;if(fire&&L.alive&&tf<=0&&document.pointerLockElement){tf=.11;cam.getWorldDirection(fwd);
   const ex=L.x,ey=L.y+1.6,ez=L.z,ax=cam.position.x+fwd.x*80,ay=cam.position.y+fwd.y*80,az=cam.position.z+fwd.z*80,dx=ax-ex,dy=ay-ey,dz=az-ez,l=Math.hypot(dx,dy,dz);
   send({t:'shoot',dx:dx/l,dy:dy/l,dz:dz/l});}}
 if(snap){const seen=new Set();for(const[id,x,y,z,ry,al]of snap.p){seen.add(id);const g=av[id]||mkAv(id);
   if(id===myId){g.position.set(L.x,L.y,L.z);g.rotation.y=L.yaw;}else{g.userData.t.set(x,y,z);g.position.lerp(g.userData.t,1-Math.exp(-15*dt));g.rotation.y=ry;}
   g.visible=!!al;if(id===myId)g.visible=!!al;}
  for(const id in av)if(!seen.has(+id)){S.remove(av[id]);delete av[id];}
  const s=snap.st;wall.visible=s.r>0;if(s.r>0){wall.scale.set(s.r,1,s.r);}}
 // camera: follow self, or spectate first living player
 let tgt={x:L.x,y:L.y,z:L.z};
 if(!L.alive&&snap){const o=snap.p.find(p=>p[5]&&p[0]!==myId);if(o)tgt={x:o[1],y:o[2],z:o[3]};}
 const cp=Math.cos(L.pitch),fx=-Math.sin(L.yaw)*cp,fy=Math.sin(L.pitch),fz=-Math.cos(L.yaw)*cp,rx=Math.cos(L.yaw),rz=-Math.sin(L.yaw);
 cam.position.set(tgt.x-fx*4.5+rx*.8,Math.max(.4,tgt.y+1.7-fy*4.5),tgt.z-fz*4.5+rz*.8);cam.lookAt(tgt.x+fx*30,tgt.y+1.7+fy*30,tgt.z+fz*30);
 sun.position.set(tgt.x+60,100,tgt.z+40);sun.target.position.set(tgt.x,0,tgt.z);
 if(mode==='live'&&snap){const s=snap.st;$('hp').style.width=me.hp+'%';$('sh').style.width=me.sh+'%';
  $('ammo').textContent=me.rel?'RELOADING':me.ammo+' / 30';$('top').innerHTML='Alive: '+snap.n+'<br>Elims: '+me.k;
  const out=Math.hypot(L.x,L.z)>s.r;$('storm').textContent=(s.in>0?'Storm shrinks in '+s.in+'s':'Storm closing')+' — Phase '+s.ph+(out?'  ⚠ IN STORM':'');
  $('storm').style.color=out?'#f6f':'#fff';}
 R.render(S,cam);}
requestAnimationFrame(loop);
