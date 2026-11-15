// Shared deterministic world layout: used by the server (loot, spawns, bullet blocking) and the client (rendering, collision).
(function(g){
let s=11;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
const colors=[0xd9c9a3,0xc97b7b,0x8fb1c9,0xe0b36a,0xa9c98f,0xb9a0d0];
const towns=[[-45,-35],[55,25],[5,70],[-75,55],[35,-70],[-20,35]],houses=[];
function add(x,z){if(Math.hypot(x,z)<22||Math.abs(x)>135||Math.abs(z)>135)return;const w=6+rnd()*5,d=6+rnd()*5;
 for(const h of houses)if(Math.abs(h.x-x)<(h.w+w)/2+3&&Math.abs(h.z-z)<(h.d+d)/2+3)return;
 houses.push({x,z,w,d,h:rnd()<.3?6.5:4,c:colors[houses.length%6]});}
for(const[tx,tz]of towns)for(let i=0;i<8;i++)add(tx+(i%3-1)*16+(rnd()-.5)*5,tz+((i/3|0)-1)*16+(rnd()-.5)*5);
for(let i=0;i<16;i++)add((rnd()-.5)*260,(rnd()-.5)*260);
const mountains=[];for(let i=0;i<24;i++){const a=i/24*6.283+rnd()*.2,d=190+rnd()*25;mountains.push({x:Math.cos(a)*d,z:Math.sin(a)*d,r:32+rnd()*25,h:45+rnd()*50,rot:rnd()*6});}
const inHouse=(x,z,m)=>houses.some(h=>Math.abs(x-h.x)<h.w/2+m&&Math.abs(z-h.z)<h.d/2+m);
function rayWall(o,d,max){let best=max;for(const h of houses){const mn=[h.x-h.w/2,0,h.z-h.d/2],mx=[h.x+h.w/2,h.h,h.z+h.d/2];let a=0,b=best;
 for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(o[i]<mn[i]||o[i]>mx[i]){a=1;b=0;break;}continue;}
  let t1=(mn[i]-o[i])/d[i],t2=(mx[i]-o[i])/d[i];if(t1>t2)[t1,t2]=[t2,t1];a=Math.max(a,t1);b=Math.min(b,t2);if(a>b)break;}
 if(a<=b&&a<best&&a>=0)best=a;}return best;}
const W={houses,mountains,inHouse,rayWall};
if(typeof module!=='undefined'&&module.exports)module.exports=W;else g.World=W;
})(this);
