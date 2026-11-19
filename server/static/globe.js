import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';

const $=id=>document.getElementById(id), stage=$('globeStage');
let renderer,scene,camera,controls,earth,connections,observer,visible=false,frame=0,last=0;
let data=null,groups=[],markers=[],particles=[],selected=null,initialized=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const coord=l=>l&&Number.isFinite(l.latitude)&&Number.isFinite(l.longitude)&&Math.abs(l.latitude)<=90&&Math.abs(l.longitude)<=180;
const vector=(lat,lon,r=1)=>{const a=lat*Math.PI/180,b=lon*Math.PI/180;return new THREE.Vector3(Math.cos(a)*Math.cos(b)*r,Math.sin(a)*r,-Math.cos(a)*Math.sin(b)*r)};
const place=l=>[...new Set([l.city,l.region,l.country].filter(Boolean))].join(', ')||'Неизвестная локация';
const size=n=>{const units=['Б','КБ','МБ','ГБ','ТБ'];let i=0;while(n>=1024&&i<4){n/=1024;i++}return n.toFixed(i?1:0)+' '+units[i]};
const recent=p=>p.last_seen&&data&&data.server_time-p.last_seen>=0&&data.server_time-p.last_seen<=180;
function clearObjects(){if(!connections)return;for(const child of [...connections.children]){child.geometry?.dispose();child.material?.dispose();connections.remove(child)}markers=[];particles=[];groups=[];selected=null;$('globeLocation').replaceChildren(new Option('Выберите точку на глобусе',''));$('globeDetails').textContent='Точки объединяют клиентов с одинаковыми координатами.';}
function describe(group){
 selected=group;$('globeLocation').value=group.key;
 const lines=[group.server?'Сервер · '+place(group.location):data.vpn_locations_hidden?'Название локации скрыто':place(group.location)];
 for(const p of group.peers){lines.push('Клиент '+p.id.slice(0,8)+' · '+(recent(p)?'Недавно активен':'Нет недавней активности')+'\nПоследний обмен: '+(p.last_seen?new Date(p.last_seen*1000).toLocaleString('ru-RU'):'ещё не подключался')+' · На VPS '+size(p.received)+' · С VPS '+size(p.sent))}
 $('globeDetails').textContent=lines.join('\n\n');
}
function focus(group){if(!group)return;camera.position.copy(vector(group.location.latitude,group.location.longitude,3.5));controls.target.set(0,0,0);controls.update();describe(group);}
function addMarker(group){const active=group.peers.some(recent),color=group.server?0xffc978:active?0x7be3b1:0x8a9cb5;
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(group.server ? .027 : .019,12,12),new THREE.MeshBasicMaterial({color}));mesh.position.copy(vector(group.location.latitude,group.location.longitude,1.016));mesh.userData.group=group;connections.add(mesh);markers.push(mesh);
}
function arc(from,to,active){
 const start=vector(from.latitude,from.longitude),end=vector(to.latitude,to.longitude),angle=start.angleTo(end);
 if(angle<.002)return;
 const axis=new THREE.Vector3().crossVectors(start,end);if(axis.lengthSq()<1e-8)axis.crossVectors(start,new THREE.Vector3(0,1,.01));axis.normalize();
 const points=Array.from({length:65},(_,i)=>{const t=i/64;return start.clone().applyAxisAngle(axis,angle*t).multiplyScalar(1.018+Math.sin(t*Math.PI)*Math.min(.38,.08+angle*.15))});
 const curve=new THREE.CatmullRomCurve3(points);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:active?0x7be3b1:0x687d98,transparent:true,opacity:active?.8:.3}));connections.add(line);
 if(active){const dot=new THREE.Mesh(new THREE.SphereGeometry(.009,8,8),new THREE.MeshBasicMaterial({color:0xd8ffed}));connections.add(dot);particles.push({dot,curve});}
}
function update(){
 if(!initialized||!data)return;clearObjects();const map=new Map();
 for(const peer of data.vpn.peers){const l=peer.location;if(!coord(l))continue;const key=l.latitude.toFixed(3)+','+l.longitude.toFixed(3);if(!map.has(key))map.set(key,{key,location:l,peers:[]});map.get(key).peers.push(peer)}
 groups=[...map.values()];const server=coord(data.server_location)?{key:'server',location:data.server_location,peers:[],server:true}:null;
 for(const g of groups){if(server)arc(g.location,server.location,g.peers.some(recent));addMarker(g);$('globeLocation').add(new Option((data.vpn_locations_hidden?'Группа '+(groups.indexOf(g)+1):place(g.location))+' · '+g.peers.length+' кл.',g.key))}
 if(server){groups.unshift(server);addMarker(server);$('globeLocation').add(new Option('Сервер · '+place(server.location),'server'),1)}
 const mapped=data.vpn.peers.filter(p=>coord(p.location)).length;
 $('globeState').textContent=mapped+' из '+data.vpn.peers.length+' клиентов на карте'+(data.vpn_locations_hidden?' · названия локаций скрыты':'')+(!server?' · координаты сервера ещё не получены':'');
 if(!stage.dataset.positioned&&(server||groups.length)){focus(server||groups[0]);stage.dataset.positioned='1'}
}
function animate(now){frame=0;if(!visible||document.hidden||!data)return;frame=requestAnimationFrame(animate);if(now-last<32)return;last=now;controls.update();if(!reduced.matches)for(const {dot,curve} of particles)dot.position.copy(curve.getPointAt((now/6500)%1));renderer.render(scene,camera)}
function resume(){if(!frame&&visible&&!document.hidden&&data)frame=requestAnimationFrame(animate)}
async function init(){
 try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));stage.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','3D-карта VPN-подключений. Выберите локацию в списке для доступа с клавиатуры.');
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,.1,30);camera.position.set(0,1.4,3.6);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=1.5;controls.maxDistance=5;controls.rotateSpeed=.55;
 earth=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshPhongMaterial({color:0x265477,shininess:12}));scene.add(earth);scene.add(new THREE.AmbientLight(0xffffff,1.7));const light=new THREE.DirectionalLight(0xd7f4ff,2.5);light.position.set(3,4,5);scene.add(light);
 const grid=new THREE.Group();for(let lat=-60;lat<=60;lat+=30){const points=Array.from({length:129},(_,i)=>vector(lat,i/128*360-180,1.002));grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x47738a,transparent:true,opacity:.2})))}for(let lon=0;lon<180;lon+=30){const points=Array.from({length:129},(_,i)=>{const a=i/128*Math.PI*2;return new THREE.Vector3(Math.cos(a)*Math.cos(lon*Math.PI/180),Math.sin(a),-Math.cos(a)*Math.sin(lon*Math.PI/180)).multiplyScalar(1.002)});grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x47738a,transparent:true,opacity:.2})))}scene.add(grid);
 connections=new THREE.Group();scene.add(connections);initialized=true;
 const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();resume()};new ResizeObserver(resize).observe(stage);resize();
 observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume()});observer.observe(stage);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
 function pick(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([earth,...markers],false)[0];if(hit?.object.userData.group){describe(hit.object.userData.group);renderer.domElement.style.cursor='pointer'}else renderer.domElement.style.cursor='grab'}
 renderer.domElement.addEventListener('pointermove',e=>{if(!e.buttons)pick(e)});renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<6)pick(e);down=null});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();visible=false;cancelAnimationFrame(frame);frame=0;$('globeState').textContent='3D-контекст потерян. Перезагрузите страницу; таблица доступна.'});
 update();resume();
 try{const response=await fetch('/monitor-assets/vendor/land.geojson');if(!response.ok)throw Error();const geo=await response.json();const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#0d263b';ctx.fillRect(0,0,2048,1024);ctx.fillStyle='#34675f';ctx.strokeStyle='#6b9c8d';ctx.lineWidth=1;
 for(const f of geo.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const poly of polys){ctx.beginPath();for(const ring of poly){ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*2048,y=(90-lat)/180*1024;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}ctx.fill('evenodd');ctx.stroke()}}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;earth.material.map=texture;earth.material.color.set(0xffffff);earth.material.needsUpdate=true;
 }catch{$('globeState').textContent+=' · контуры суши не загрузились'}
 }catch{initialized=false;$('globeState').textContent='WebGL недоступен. Все подключения можно посмотреть в таблице.'}
}
window.addEventListener('monitor-snapshot',e=>{data=e.detail;if(!renderer)init();else{update();resume()}});
window.addEventListener('monitor-clear',()=>{data=null;clearObjects();cancelAnimationFrame(frame);frame=0;delete stage.dataset.positioned;$('globeState').textContent='Войдите для просмотра подключений.'});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);controls?.dispose();renderer?.dispose()},{once:true});
document.addEventListener('visibilitychange',resume);
$('globeReset').onclick=()=>focus(groups.find(g=>g.server)||groups[0]);$('globeLocation').onchange=e=>focus(groups.find(g=>g.key===e.target.value));
// The first API response may precede module loading.
if(typeof snapshot!=='undefined'&&snapshot){data=typeof globeSnapshot==='function'?globeSnapshot():snapshot;init()}
