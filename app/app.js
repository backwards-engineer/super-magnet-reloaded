import {makeScene,particle,step,validateScene,connectGroup} from './engine.js';
const $=id=>document.getElementById(id), canvas=$('world'),ctx=canvas.getContext('2d');
const experiments=[['bloom','✳','Molecular bloom','A balance of opposing forces','A living constellation, held together by attraction and kept apart by repulsion.'],['orbit','◎','Orbital dance','A miniature solar system','A pinned sun and a sky full of satellites. Give an orbit a gentle nudge.'],['bridge','⌁','Elastic bridge','A little give goes a long way','Two anchored ends. A springy span. A few weights to put it to the test.'],['bubbles','◌','Bubble bath','Soft collisions, happy accidents','A tumbling collection of rings finds its place at the bottom of the world.'],['comet','☄','Comet collision','Beautiful, inevitable chaos','A fast-moving cluster meets a quiet planet. Watch the energy travel.'],['triangles','△','Molecular machines','Small structures, big ideas','Spring-connected molecules keep their shape as they tumble and collide.']];
let scene=makeScene(),baseline=structuredClone(scene),selection=new Set(),tool='select',running=true,speed=1;
let camera={x:500,y:350,zoom:1},width=800,height=600,dpr=1,drag=null,linkStart=null,history=[],lastRecord=0,last=0,frames=0,fpsStart=0,autosave=0,toastTimer;
const trailCanvas=document.createElement('canvas'),trail=trailCanvas.getContext('2d');
const historyInput=document.createElement('input');historyInput.type='range';historyInput.min=0;historyInput.max=0;historyInput.value=0;historyInput.title='Scrub recorded history';historyInput.setAttribute('aria-label','Recorded simulation history');historyInput.style.cssText='position:absolute;bottom:0;left:0;margin:0;height:3px;z-index:2';$('viewport').append(historyInput);
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
function clearTrails(){trail.clearRect(0,0,trailCanvas.width,trailCanvas.height);}
function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;trailCanvas.width=canvas.width;trailCanvas.height=canvas.height;clearTrails();}
new ResizeObserver(resize).observe($('viewport'));
function scale(){return Math.min(width/1000,height/700)*camera.zoom*.88;}
function toWorld(x,y){const s=scale();return{x:(x-width/2)/s+camera.x,y:(y-height/2)/s+camera.y};}
function toScreen(p){const s=scale();return{x:(p.x-camera.x)*s+width/2,y:(p.y-camera.y)*s+height/2};}
function coords(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function hit(pos){let result=null;let best=Infinity;const s=scale();for(const p of scene.particles){if(p.appear>scene.time)continue;const d=Math.hypot(p.x-pos.x,p.y-pos.y);if(d<Math.max(p.radius+5,12/s)&&d<best){result=p;best=d;}}return result;}
function snapshot(){return structuredClone(scene);}
function record(){history.push(snapshot());if(history.length>600)history.shift();historyInput.max=Math.max(0,history.length-1);historyInput.value=historyInput.max;}
function invalidateHistory(){history=[];lastRecord=0;record();}
function updateScene(){
  $('scene-title').textContent=scene.name;
  $('scene-caption').textContent=experiments.find(p=>p[0]===scene.kind)?.[4]||'An empty canvas for your next experiment. Choose Add magnet to begin.';
  for(const b of $('presets').children)b.classList.toggle('active',b.dataset.kind===scene.kind);
  for(const id of ['gravity','friction','attraction','repulsion','exponent','opacity']){$(id).value=scene.settings[id];updateOutput(id);}
  for(const id of ['trails','glow','connections','bounds'])$(id).checked=scene.settings[id];
  $('count').textContent=scene.particles.length;$('links-count').textContent=scene.links.length;updateInspector();
}
function load(s){scene=validateScene(s);baseline=snapshot();selection.clear();camera={x:500,y:350,zoom:1};$('zoom-label').textContent='100%';invalidateHistory();clearTrails();updateScene();}
function updateOutput(id){const v=scene.settings[id];$(id+'-value').textContent=id==='gravity'?v.toFixed(0):id==='friction'?v.toFixed(2):id==='repulsion'?v.toLocaleString():id==='opacity'?Math.round(v*100)+'%':v.toFixed(2);}
for(const [kind,icon,name,desc]of experiments){const b=document.createElement('button');b.className='preset';b.dataset.kind=kind;b.innerHTML=`<span class="preset-icon">${icon}</span><span><strong>${name}</strong><small>${desc}</small></span>`;b.onclick=()=>load(makeScene(kind));$('presets').append(b);}
for(const id of ['gravity','friction','attraction','repulsion','exponent','opacity']){$(id).setAttribute('aria-label',id);$(id).oninput=()=>{scene.settings[id]=Number($(id).value);updateOutput(id);};}
for(const id of ['trails','glow','connections','bounds'])$(id).onchange=()=>{scene.settings[id]=$(id).checked;clearTrails();};
function setTool(v){tool=v;linkStart=null;for(const b of $('tools').children)b.classList.toggle('active',b.dataset.tool===v);$('hint').textContent={select:'Drag a magnet to disturb the equilibrium · Shift-drag to select a group',add:'Click anywhere to add a magnet · Edit its properties in the inspector',link:'Click two magnets to connect them with a spring',pan:'Drag to move your view · Scroll to zoom',erase:'Click a magnet to remove it'}[v];canvas.style.cursor=v==='pan'?'grab':v==='select'?'default':'crosshair';}
for(const b of $('tools').children)b.onclick=()=>setTool(b.dataset.tool);
function tab(name){for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);$('world-panel').hidden=name!=='world';$('magnet-panel').hidden=name!=='magnet';}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>tab(b.dataset.tab);
const fields=['x','y','vx','vy','defense','power','radius','appear','tag','color','shape','fixed'];
const physicsLimits={gravity:[-100,200],friction:[0,5],attraction:[0,8],repulsion:[0,10000],exponent:[.5,3]};
function selected(){return scene.particles.filter(p=>selection.has(p.id));}
function updateInspector(){
  const ps=selected();$('selected-count').textContent=ps.length;$('selection-title').textContent=ps.length?`${ps.length===1?'Magnet #'+ps[0].id:ps.length+' magnets selected'}`:'Meet your magnets';
  for(const k of fields){$(k).disabled=!ps.length;if(!ps.length)continue;if(k==='fixed')$(k).checked=ps.every(p=>p.fixed);else{const same=ps.every(p=>p[k]===ps[0][k]);$(k).value=same?ps[0][k]:k==='color'?'#ffffff':'';if('placeholder'in $(k))$(k).placeholder='Mixed';}}
  for(const k of ['delete','duplicate','select-tag'])$(k).disabled=!ps.length;
  for(const k of ['connect-selection','disconnect-selection'])$(k).disabled=ps.length<2;
  $('inherit-physics').disabled=!ps.length;
  for(const k of Object.keys(physicsLimits)){const input=$('override-'+k);input.disabled=!ps.length;const v=ps[0]?.physics?.[k],same=ps.every(p=>p.physics?.[k]===v);input.value=same&&v!==undefined?v:'';input.placeholder=same?'World: '+scene.settings[k]:'Mixed';}
}
const limits={x:[-1e7,1e7],y:[-1e7,1e7],vx:[-1e7,1e7],vy:[-1e7,1e7],defense:[0,10],power:[-10,10],radius:[2,40],appear:[0,1e7]};
for(const k of fields)$(k).onchange=()=>{let v=k==='fixed'?$(k).checked:$(k).value;if(k in limits){v=Number(v);if(!Number.isFinite(v)){updateInspector();return;}v=Math.max(limits[k][0],Math.min(limits[k][1],v));}for(const p of selected())p[k]=v;invalidateHistory();clearTrails();updateInspector();};
for(const [k,[lo,hi]]of Object.entries(physicsLimits))$('override-'+k).onchange=()=>{const text=$('override-'+k).value.trim(),v=Number(text);if(text!==''&&(!Number.isFinite(v)||v<lo||v>hi)){toast(`Use a value from ${lo} to ${hi}, or leave blank.`);updateInspector();return;}for(const p of selected()){p.physics={...p.physics};if(text==='')delete p.physics[k];else p.physics[k]=v;}invalidateHistory();updateInspector();};
$('inherit-physics').onclick=()=>{for(const p of selected())delete p.physics;invalidateHistory();updateInspector();toast('Selection now inherits World physics.');};
function remove(ids){scene.particles=scene.particles.filter(p=>!ids.has(p.id));scene.links=scene.links.filter(l=>!ids.has(l.a)&&!ids.has(l.b));selection.clear();linkStart=null;invalidateHistory();updateScene();clearTrails();}
$('delete').onclick=()=>remove(selection);
function nextId(){return Math.max(0,...scene.particles.map(p=>p.id))+1;}
$('duplicate').onclick=()=>{const ps=selected();if(scene.particles.length+ps.length>600)return toast('This world supports up to 600 magnets.');const mapping=new Map();let id=nextId();for(const p of ps){mapping.set(p.id,id);scene.particles.push({...structuredClone(p),id:id++,x:p.x+25,y:p.y+25});}scene.links.push(...scene.links.filter(l=>mapping.has(l.a)&&mapping.has(l.b)).map(l=>({...l,a:mapping.get(l.a),b:mapping.get(l.b)})));selection=new Set(mapping.values());invalidateHistory();updateScene();};
$('select-tag').onclick=()=>{const tags=new Set(selected().map(p=>p.tag));selection=new Set(scene.particles.filter(p=>tags.has(p.tag)).map(p=>p.id));updateInspector();};
$('connect-selection').onclick=()=>{try{const count=connectGroup(scene,selected());invalidateHistory();updateScene();toast(count?`Added ${count} springs. Selection now holds its shape.`:'These magnets are already connected.');}catch(e){toast(e.message);}};
$('disconnect-selection').onclick=()=>{scene.links=scene.links.filter(l=>!(selection.has(l.a)&&selection.has(l.b)));invalidateHistory();updateScene();toast('Removed springs within the selection.');};
canvas.onpointerdown=e=>{canvas.focus();const screen=coords(e),pos=toWorld(screen.x,screen.y),p=hit(pos);canvas.setPointerCapture(e.pointerId);
  if(tool==='add'){if(scene.particles.length>=600)return toast('This world supports up to 600 magnets.');const q=particle(nextId(),pos.x,pos.y);scene.particles.push(q);selection=new Set([q.id]);invalidateHistory();updateScene();return;}
  if(tool==='erase'){if(p)remove(new Set([p.id]));return;}
  if(tool==='link'){if(!p)return;if(linkStart===null){linkStart=p.id;selection=new Set([p.id]);toast('Now click a second magnet.');}else if(linkStart!==p.id){if(!scene.links.some(l=>(l.a===p.id&&l.b===linkStart)||(l.b===p.id&&l.a===linkStart))){const a=scene.particles.find(q=>q.id===linkStart);scene.links.push({a:linkStart,b:p.id,length:Math.hypot(p.x-a.x,p.y-a.y),stiffness:60});}linkStart=null;invalidateHistory();updateScene();}updateInspector();return;}
  if(tool==='pan'||e.button===1){drag={type:'pan',screen,camera:{...camera}};return;}
  if(p){if(e.shiftKey){if(selection.has(p.id))selection.delete(p.id);else selection.add(p.id);}else if(!selection.has(p.id))selection=new Set([p.id]);drag={type:'particles',pos,items:selected().map(q=>({p:q,x:q.x,y:q.y,fixed:q.fixed}))};for(const item of drag.items)item.p.fixed=true;}
  else{if(!e.shiftKey)selection.clear();drag={type:'box',start:screen,end:screen,initial:new Set(selection)};}updateInspector();
};
canvas.onpointermove=e=>{if(!drag)return;const screen=coords(e),pos=toWorld(screen.x,screen.y);if(drag.type==='pan'){camera.x=drag.camera.x-(screen.x-drag.screen.x)/scale();camera.y=drag.camera.y-(screen.y-drag.screen.y)/scale();clearTrails();}else if(drag.type==='particles'){for(const item of drag.items){item.p.x=item.x+pos.x-drag.pos.x;item.p.y=item.y+pos.y-drag.pos.y;item.p.vx=0;item.p.vy=0;}}else{drag.end=screen;selection=new Set(drag.initial);for(const p of scene.particles){const q=toScreen(p);if(q.x>=Math.min(drag.start.x,screen.x)&&q.x<=Math.max(drag.start.x,screen.x)&&q.y>=Math.min(drag.start.y,screen.y)&&q.y<=Math.max(drag.start.y,screen.y))selection.add(p.id);}}updateInspector();};
function release(){if(drag?.type==='particles'){for(const item of drag.items)item.p.fixed=item.fixed;invalidateHistory();}drag=null;}
canvas.onpointerup=release;canvas.onpointercancel=release;canvas.onlostpointercapture=release;
canvas.ondblclick=e=>{const q=coords(e),p=hit(toWorld(q.x,q.y));if(p){selection=new Set([p.id]);updateInspector();tab('magnet');}};
function zoom(factor,anchor={x:width/2,y:height/2}){const before=toWorld(anchor.x,anchor.y);camera.zoom=Math.min(5,Math.max(.2,camera.zoom*factor));const after=toWorld(anchor.x,anchor.y);camera.x+=before.x-after.x;camera.y+=before.y-after.y;$('zoom-label').textContent=Math.round(camera.zoom*100)+'%';clearTrails();}
canvas.onwheel=e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001),coords(e));};
$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);
$('fit').onclick=()=>{const ps=scene.particles.filter(p=>p.appear<=scene.time);if(ps.length){const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);camera.x=(Math.min(...xs)+Math.max(...xs))/2;camera.y=(Math.min(...ys)+Math.max(...ys))/2;const base=Math.min(width/1000,height/700)*.88;camera.zoom=Math.min(3,Math.max(.2,Math.min(width/(Math.max(...xs)-Math.min(...xs)+130),height/(Math.max(...ys)-Math.min(...ys)+130))/base));}else camera={x:500,y:350,zoom:1};$('zoom-label').textContent=Math.round(camera.zoom*100)+'%';clearTrails();};
function play(value){running=value;$('play').textContent=running?'Ⅱ':'▶';$('running-label').textContent=running?'SIMULATION LIVE':'SIMULATION PAUSED';}
$('play').onclick=()=>play(!running);$('step').onclick=()=>{play(false);for(let i=0;i<4;i++)step(scene,1/240);record();};
$('speed').oninput=()=>{speed=Number($('speed').value);$('speed-value').textContent=speed.toFixed(1)+'×';};
$('reset').onclick=()=>{load(structuredClone(baseline));toast('Experiment reset.');};
$('clear').onclick=()=>{load(makeScene('empty'));setTool('add');toast('Your new world is ready.');};
function restoreHistory(index){if(!history.length)return;scene=structuredClone(history[index]);play(false);selection=new Set([...selection].filter(id=>scene.particles.some(p=>p.id===id)));clearTrails();updateScene();historyInput.value=index;}
historyInput.oninput=()=>restoreHistory(Number(historyInput.value));
historyInput.onchange=()=>{history=history.slice(0,Number(historyInput.value)+1);historyInput.max=Math.max(0,history.length-1);lastRecord=0;};
$('rewind').onclick=()=>{const i=Math.max(0,history.length-61);restoreHistory(i);history=history.slice(0,i+1);historyInput.max=i;toast('Rewound recorded history by up to 2 seconds.');};
$('save').onclick=()=>{release();const blob=new Blob([JSON.stringify(scene,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=scene.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Scene saved.');};
$('open').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const f=$('file').files[0];if(!f)return;if(f.size>2e6)throw Error('Scene file is too large.');const s=validateScene(JSON.parse(await f.text()));load(s);toast('Scene loaded.');}catch(e){toast(e.message);}finally{$('file').value='';}};
$('help').onclick=()=>$('guide').showModal();$('close-guide').onclick=()=>$('guide').close();
document.onkeydown=e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||$('guide').open)return;if(e.code==='Space'){e.preventDefault();play(!running);}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove(selection);}const map={v:'select',a:'add',l:'link',h:'pan',e:'erase'};if(map[e.key.toLowerCase()])setTool(map[e.key.toLowerCase()]);};
$('run-recipe').onclick=()=>{try{const copy=snapshot();let ids=new Set(selection.size?selection:copy.particles.map(p=>p.id));for(const line of $('recipe').value.split('\n')){const parts=line.trim().split(/\s+/);if(!parts[0])continue;const [cmd,k,v]=parts;const targets=copy.particles.filter(p=>ids.has(p.id));if(cmd==='select'&&parts.length===2){ids=new Set(copy.particles.filter(p=>p.tag===k).map(p=>p.id));}else if(cmd==='set'&&Object.hasOwn(limits,k)&&parts.length===3){const n=Number(v);if(!Number.isFinite(n)||n<limits[k][0]||n>limits[k][1])throw Error('Value outside allowed range: '+k);for(const p of targets)p[k]=n;}else if(cmd==='impulse'&&parts.length===3&&Number.isFinite(Number(k))&&Number.isFinite(Number(v))){for(const p of targets){p.vx+=Number(k);p.vy+=Number(v);}}else if(cmd==='tag'&&k&&parts.length===2){for(const p of targets)p.tag=k;}else if((cmd==='pin'||cmd==='unpin')&&parts.length===1){for(const p of targets)p.fixed=cmd==='pin';}else throw Error('Unknown recipe command: '+line);}validateScene(copy);scene=copy;selection=ids;invalidateHistory();updateScene();toast('Recipe applied.');}catch(e){toast(e.message);}};
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0d1417';ctx.fillRect(0,0,width,height);
  const s=scale(),spacing=40*s,origin=toScreen({x:0,y:0});
  ctx.fillStyle='#263436';for(let x=((origin.x%spacing)+spacing)%spacing;x<width;x+=spacing)for(let y=((origin.y%spacing)+spacing)%spacing;y<height;y+=spacing){ctx.beginPath();ctx.arc(x,y,.65,0,Math.PI*2);ctx.fill();}
  if(scene.settings.bounds){const a=toScreen({x:0,y:0});ctx.strokeStyle='#324440';ctx.setLineDash([4,7]);ctx.strokeRect(a.x,a.y,1000*s,700*s);ctx.setLineDash([]);}
  trail.setTransform(dpr,0,0,dpr,0,0);trail.globalCompositeOperation='destination-out';trail.fillStyle='rgba(0,0,0,.055)';trail.fillRect(0,0,width,height);trail.globalCompositeOperation='source-over';
  if(scene.settings.trails){for(const p of scene.particles){if(p.appear>scene.time||p.fixed)continue;const q=toScreen(p);trail.fillStyle=p.color+'38';trail.beginPath();trail.arc(q.x,q.y,Math.max(1,p.radius*s*.4),0,Math.PI*2);trail.fill();}ctx.drawImage(trailCanvas,0,0,width,height);}else clearTrails();
  const map=new Map(scene.particles.map(p=>[p.id,p]));
  if(scene.settings.connections){ctx.lineWidth=1;for(const l of scene.links){const a=map.get(l.a),b=map.get(l.b);if(!a||!b||a.appear>scene.time||b.appear>scene.time)continue;const u=toScreen(a),v=toScreen(b);ctx.strokeStyle=a.color+'65';ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(v.x,v.y);ctx.stroke();}
    if(scene.kind==='bloom'){ctx.lineWidth=.6;const ps=scene.particles;for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const d=Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y);if(d<65&&ps[i].appear<=scene.time&&ps[j].appear<=scene.time){const a=toScreen(ps[i]),b=toScreen(ps[j]);ctx.strokeStyle=ps[i].color+Math.round((1-d/65)*60).toString(16).padStart(2,'0');ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}
  }
  for(const p of scene.particles){if(p.appear>scene.time)continue;const q=toScreen(p),r=Math.max(1.6,p.radius*s);if(q.x<-80||q.y<-80||q.x>width+80||q.y>height+80)continue;
    if(scene.settings.glow){const gradient=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r*4);gradient.addColorStop(0,p.color+'45');gradient.addColorStop(1,p.color+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(q.x,q.y,r*4,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=scene.settings.opacity;ctx.fillStyle=p.color;ctx.strokeStyle=p.color;ctx.lineWidth=1.5;ctx.beginPath();if(p.shape==='square')ctx.rect(q.x-r,q.y-r,r*2,r*2);else if(p.shape==='diamond'){ctx.moveTo(q.x,q.y-r*1.3);ctx.lineTo(q.x+r,q.y);ctx.lineTo(q.x,q.y+r*1.3);ctx.lineTo(q.x-r,q.y);ctx.closePath();}else ctx.arc(q.x,q.y,r,0,Math.PI*2);if(p.shape==='ring')ctx.stroke();else ctx.fill();ctx.globalAlpha=1;
    if(p.fixed){ctx.fillStyle='#0d1417';ctx.fillRect(q.x-2,q.y-2,4,4);}if(selection.has(p.id)){ctx.strokeStyle='#e2f4c4';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(q.x,q.y,r+7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  }
  if(drag?.type==='box'){const {start,end}=drag;ctx.fillStyle='#b5ef8814';ctx.strokeStyle='#b5ef88';ctx.fillRect(start.x,start.y,end.x-start.x,end.y-start.y);ctx.strokeRect(start.x,start.y,end.x-start.x,end.y-start.y);}
  const t=scene.time;$('time').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(1).padStart(4,'0')}`;
}
function frame(now){const elapsed=Math.min((now-last)/1000||0,.04);last=now;if(running){const total=elapsed*speed;const count=Math.ceil(total/(1/240));for(let i=0;i<count;i++)step(scene,total/count);lastRecord+=elapsed;if(lastRecord>=1/30){record();lastRecord=0;}}
  if($('follow').checked&&selection.size){const ps=selected();if(ps.length){camera.x=ps.reduce((v,p)=>v+p.x,0)/ps.length;camera.y=ps.reduce((v,p)=>v+p.y,0)/ps.length;clearTrails();}}
  draw();frames++;if(now-fpsStart>=1000){$('fps').textContent=Math.round(frames*1000/(now-fpsStart))+' FPS';frames=0;fpsStart=now;}
  if(now-autosave>5000){try{if(!drag)localStorage.setItem('super-magnet-scene',JSON.stringify(scene));}catch{}autosave=now;}
  requestAnimationFrame(frame);
}
try{const saved=localStorage.getItem('super-magnet-scene');if(saved)scene=validateScene(JSON.parse(saved));}catch{}
baseline=snapshot();record();updateScene();requestAnimationFrame(frame);
