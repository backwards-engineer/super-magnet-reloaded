// A modern numerical port of the force families in Daniel White's AMOS source.
export const COLORS = ['#70e0c6','#b6ef89','#88b6fc','#d0a2f7','#efb87c','#f194ae'];
export function particle(id,x,y,options={}) {
  return {id,x,y,vx:0,vy:0,defense:1,power:1,radius:5,appear:0,color:COLORS[id%6],tag:'molecule',shape:'circle',fixed:false,...options};
}
export function makeScene(kind='bloom') {
  const s={version:1,name:'Molecular bloom',kind,time:0,particles:[],links:[],settings:{gravity:0,friction:0.3,attraction:1,repulsion:2600,exponent:1,bounds:true,trails:true,glow:true,connections:true,opacity:.9}};
  const add=(x,y,o)=>{const p=particle(s.particles.length+1,x,y,o);s.particles.push(p);return p;};
  const link=(a,b,stiffness=20)=>s.links.push({a:a.id,b:b.id,length:Math.hypot(a.x-b.x,a.y-b.y),stiffness});
  if(kind==='bloom') {
    for(let i=0;i<78;i++){const a=i*2.3999632297,r=16*Math.sqrt(i);add(500+Math.cos(a)*r,350+Math.sin(a)*r,{vx:-Math.sin(a)*17,vy:Math.cos(a)*17,color:COLORS[Math.floor(i/13)%6]});}
  } else if(kind==='orbit') {
    s.name='Orbital dance';s.settings.attraction=0;s.settings.repulsion=0;s.settings.friction=0;s.settings.bounds=false;
    add(500,350,{fixed:true,power:8,radius:20,color:'#efc77d',tag:'sun'});
    for(let i=0;i<65;i++){const a=i*2.39996,r=100+(i%5)*33;const v=Math.sqrt(850000/r);add(500+Math.cos(a)*r,350+Math.sin(a)*r,{vx:-Math.sin(a)*v,vy:Math.cos(a)*v,radius:3+(i%3),color:COLORS[i%6],tag:'satellite'});}
  } else if(kind==='bridge') {
    s.name='Elastic bridge';s.settings.gravity=65;s.settings.attraction=0;s.settings.repulsion=0;s.settings.friction=.18;
    const rows=[];for(let j=0;j<2;j++){rows[j]=[];for(let i=0;i<23;i++){const p=add(170+i*30,360+j*26,{fixed:i===0||i===22,radius:5,color:j?'#79c9d9':'#bded92',tag:'bridge'});rows[j].push(p);if(i)link(rows[j][i-1],p,150);if(j){link(rows[0][i],p,150);if(i)link(rows[0][i-1],p,100);}}}
    const weight=[];
    for(let i=0;i<9;i++)weight.push(add(430+(i%3)*23,170-Math.floor(i/3)*24,{radius:11,color:'#efbc80',tag:'weight'}));
    connectGroup(s,weight);
  } else if(kind==='bubbles') {
    s.name='Bubble bath';s.settings.gravity=35;s.settings.attraction=0;s.settings.repulsion=0;s.settings.friction=.7;
    for(let i=0;i<72;i++)add(260+(i%12)*42,140+Math.floor(i/12)*52,{radius:12+(i%5)*2,color:COLORS[i%6],shape:'ring',tag:'bubble',vx:Math.sin(i)*20});
  } else if(kind==='comet') {
    s.name='Comet collision';s.settings.friction=.08;s.settings.attraction=.9;s.settings.repulsion=2300;
    for(let i=0;i<85;i++){const a=i*2.39996,r=12*Math.sqrt(i);add(600+Math.cos(a)*r,360+Math.sin(a)*r,{color:i%3?'#75c8d6':'#a7dd93',tag:'planet'});}
    for(let i=0;i<23;i++){const a=i*2.39996,r=6*Math.sqrt(i);add(150+Math.cos(a)*r,230+Math.sin(a)*r,{vx:150,vy:32,color:'#f4b780',tag:'comet',radius:4});}
  } else if(kind==='triangles') {
    s.name='Molecular machines';s.settings.attraction=0;s.settings.repulsion=0;s.settings.gravity=20;
    for(let j=0;j<16;j++){const ps=[];for(let k=0;k<3;k++){const a=k*Math.PI*2/3;ps.push(add(180+(j%4)*210+Math.cos(a)*32,130+Math.floor(j/4)*130+Math.sin(a)*32,{color:COLORS[j%6],tag:'triangle-'+(j+1),vx:Math.sin(j)*30,vy:Math.cos(j)*20,radius:8}));}for(let k=0;k<3;k++)link(ps[k],ps[(k+1)%3],100);}
  } else {s.name='Untitled world';s.kind='empty';}
  return s;
}
export function step(s,dt) {
  const ps=s.particles, opt=s.settings, n=ps.length;
  const ax=new Float64Array(n),ay=new Float64Array(n);
  // Pair forces accumulate before integration, like the original BEGIN/XCE buffers.
  for(let i=0;i<n;i++) {const a=ps[i];if(a.appear>s.time)continue;
    for(let j=i+1;j<n;j++){const b=ps[j];if(b.appear>s.time)continue;
      let dx=b.x-a.x,dy=b.y-a.y;let raw=Math.hypot(dx,dy);if(raw<.001){dx=.01;dy=.003;raw=Math.hypot(dx,dy);}
      const d=Math.max(raw,8),ux=dx/raw,uy=dy/raw;
      const force=p=>{const o=p.physics||{};return s.kind==='orbit'?106250/(d*d):(o.attraction??opt.attraction)*d*.065-(o.repulsion??opt.repulsion)/Math.pow(d,o.exponent??opt.exponent);};
      const fa=Math.max(-2400,Math.min(2400,force(a)*a.defense*b.power));
      const fb=Math.max(-2400,Math.min(2400,force(b)*b.defense*a.power));
      ax[i]+=ux*fa;ay[i]+=uy*fa;ax[j]-=ux*fb;ay[j]-=uy*fb;
      const overlap=a.radius+b.radius-raw;
      if(overlap>0){const push=overlap*100;ax[i]-=ux*push;ay[i]-=uy*push;ax[j]+=ux*push;ay[j]+=uy*push;}
    }
  }
  const byId=new Map(ps.map((p,i)=>[p.id,i]));
  for(const l of s.links){const i=byId.get(l.a),j=byId.get(l.b);if(i===undefined||j===undefined)continue;const a=ps[i],b=ps[j];if(a.appear>s.time||b.appear>s.time)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001,f=(d-l.length)*l.stiffness;ax[i]+=dx/d*f;ay[i]+=dy/d*f;ax[j]-=dx/d*f;ay[j]-=dy/d*f;}
  for(let i=0;i<n;i++){const p=ps[i];if(p.fixed||p.appear>s.time)continue;const damping=Math.exp(-(p.physics?.friction??opt.friction)*dt);p.vx=(p.vx+ax[i]*dt)*damping;p.vy=(p.vy+(ay[i]+(p.physics?.gravity??opt.gravity))*dt)*damping;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(opt.bounds){if(p.x<p.radius){p.x=p.radius;p.vx=Math.abs(p.vx)*.7;}if(p.x>1000-p.radius){p.x=1000-p.radius;p.vx=-Math.abs(p.vx)*.7;}if(p.y<p.radius){p.y=p.radius;p.vy=Math.abs(p.vy)*.7;}if(p.y>700-p.radius){p.y=700-p.radius;p.vy=-Math.abs(p.vy)*.7;}}
  }
  // Resolve contact geometrically: soft forces alone allow fast weights to tunnel
  // through the bridge. Equal particle masses, with pinned bodies at infinite mass.
  for(let pass=0;pass<3;pass++)for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const a=ps[i],b=ps[j];if(a.appear>s.time||b.appear>s.time||(a.fixed&&b.fixed))continue;
    let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const overlap=a.radius+b.radius-d;if(overlap<=0)continue;
    if(d<1e-8){dx=1;dy=0;d=1;}
    const ux=dx/d,uy=dy/d,wa=a.fixed?0:1,wb=b.fixed?0:1,total=wa+wb;
    const correction=Math.max(0,overlap-.01)/total;
    a.x-=ux*correction*wa;a.y-=uy*correction*wa;b.x+=ux*correction*wb;b.y+=uy*correction*wb;
    const closing=(b.vx-a.vx)*ux+(b.vy-a.vy)*uy;
    if(closing<0){const impulse=-(1.15)*closing/total;a.vx-=ux*impulse*wa;a.vy-=uy*impulse*wa;b.vx+=ux*impulse*wb;b.vy+=uy*impulse*wb;}
  }
  s.time+=dt;
}
export function connectGroup(scene,particles,stiffness=300){
  const existing=new Set(scene.links.map(l=>[Math.min(l.a,l.b),Math.max(l.a,l.b)].join(':'))),added=[];
  for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){
    const a=particles[i],b=particles[j],key=[Math.min(a.id,b.id),Math.max(a.id,b.id)].join(':');
    if(!existing.has(key))added.push({a:a.id,b:b.id,length:Math.hypot(a.x-b.x,a.y-b.y),stiffness});
  }
  if(scene.links.length+added.length>5000)throw Error('Too many connections. Select a smaller group.');
  scene.links.push(...added);return added.length;
}
export function validateScene(s) {
  if(!s||s.version!==1||!Array.isArray(s.particles)||s.particles.length>600||!Array.isArray(s.links)||s.links.length>5000)throw Error('Expected a Super Magnet scene with up to 600 magnets.');
  const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
  const ids=new Set();
  for(const p of s.particles){if(!Number.isInteger(p.id)||ids.has(p.id))throw Error('Invalid or duplicate particle ID.');ids.add(p.id);
    for(const k of ['x','y','vx','vy'])if(!finite(p[k],-1e7,1e7))throw Error('Invalid particle '+k);
    for(const [k,lo,hi] of [['defense',0,10],['power',-10,10],['radius',2,40],['appear',0,1e7]])if(!finite(p[k],lo,hi))throw Error('Invalid particle '+k);
    if(!/^#[0-9a-f]{6}$/i.test(p.color)||!['circle','ring','diamond','square'].includes(p.shape)||typeof p.tag!=='string'||p.tag.length>32||typeof p.fixed!=='boolean')throw Error('Invalid particle style.');
  }
  const ranges={gravity:[-100,200],friction:[0,5],attraction:[0,8],repulsion:[0,10000],exponent:[.5,3],opacity:[.1,1]};
  for(const p of s.particles)if(p.physics!==undefined){if(!p.physics||typeof p.physics!=='object'||Array.isArray(p.physics))throw Error('Invalid particle physics.');for(const [k,v]of Object.entries(p.physics)){if(!['gravity','friction','attraction','repulsion','exponent'].includes(k)||!finite(v,...ranges[k]))throw Error('Invalid particle physics '+k);}}
  if(!s.settings)throw Error('Missing world settings.');
  for(const [k,r]of Object.entries(ranges))if(!finite(s.settings[k],...r))throw Error('Invalid setting '+k);
  for(const k of ['bounds','trails','glow','connections'])if(typeof s.settings[k]!=='boolean')throw Error('Invalid setting '+k);
  for(const l of s.links)if(!ids.has(l.a)||!ids.has(l.b)||l.a===l.b||!finite(l.length,0,1e7)||!finite(l.stiffness,0,300))throw Error('Invalid connection.');
  if(!finite(s.time,0,1e7)||typeof s.name!=='string'||s.name.length>100||!['bloom','orbit','bridge','bubbles','comet','triangles','empty'].includes(s.kind))throw Error('Invalid scene metadata.');
  return s;
}
