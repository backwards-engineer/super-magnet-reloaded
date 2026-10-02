import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeScene,step,particle,validateScene,connectGroup} from '../app/engine.js';
test('all six experiments remain finite for 20 simulated seconds',()=>{
  for(const kind of ['bloom','orbit','bridge','bubbles','comet','triangles']){
    const s=validateScene(makeScene(kind));const fixed=s.particles.filter(p=>p.fixed).map(p=>({...p}));
    for(let i=0;i<4800;i++)step(s,1/240);
    validateScene(s);
    for(const p of s.particles){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),kind);assert.ok(Math.abs(p.x)<10000&&Math.abs(p.y)<10000,kind+' stays bounded');}
    for(const p of fixed){const q=s.particles.find(q=>q.id===p.id);assert.equal(q.x,p.x);assert.equal(q.y,p.y);}
  }
});
test('pair attraction and repulsion have the right direction and conserve momentum',()=>{
  const s=makeScene('empty');s.settings.friction=0;s.settings.bounds=false;s.particles=[particle(1,400,350),particle(2,600,350)];s.settings.repulsion=0;step(s,1/240);assert.ok(s.particles[0].vx>0);assert.equal(s.particles[0].vx,-s.particles[1].vx);
  s.particles[0].vx=s.particles[1].vx=0;s.settings.attraction=0;s.settings.repulsion=2000;step(s,1/240);assert.ok(s.particles[0].vx<0);
});
test('delayed magnets stay dormant and saved scenes roundtrip',()=>{
  const s=makeScene('empty');s.particles=[particle(1,100,100,{appear:5})];s.settings.gravity=100;step(s,.1);assert.equal(s.particles[0].y,100);assert.deepEqual(validateScene(JSON.parse(JSON.stringify(s))),s);
});
test('imports reject duplicate IDs, invalid settings and dangling links',()=>{
  const s=makeScene();s.particles[1].id=s.particles[0].id;assert.throws(()=>validateScene(s));
  const b=makeScene();b.settings.gravity=Infinity;assert.throws(()=>validateScene(b));
  const c=makeScene();c.links.push({a:999,b:1,length:1,stiffness:20});assert.throws(()=>validateScene(c));
});
test('bridge weight stays connected and on top of the span through impact',()=>{
  const s=makeScene('bridge'),weight=s.particles.filter(p=>p.tag==='weight'),ids=new Set(weight.map(p=>p.id)),links=s.links.filter(l=>ids.has(l.a)&&ids.has(l.b));assert.equal(links.length,36);
  for(let i=0;i<4800;i++){step(s,1/240);for(const p of weight){const deck=s.particles.filter(b=>b.tag==='bridge'&&Math.abs(b.x-p.x)<35);if(deck.length)assert.ok(p.y<Math.max(...deck.map(b=>b.y)),'weight remains above deck');}for(const l of links){const a=weight.find(p=>p.id===l.a),b=weight.find(p=>p.id===l.b);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-l.length)<8,'block retains shape');}}
  assert.equal(connectGroup(s,weight),0,'connecting twice does not duplicate springs');
});
test('particle physics override world values and survive scene roundtrip',()=>{
  const s=makeScene('empty');s.settings.gravity=100;s.settings.friction=0;s.settings.repulsion=0;s.settings.attraction=0;
  s.particles=[particle(1,100,100,{physics:{gravity:-50}}),particle(2,300,100)];step(s,.01);assert.ok(s.particles[0].vy<0);assert.ok(s.particles[1].vy>0);validateScene(JSON.parse(JSON.stringify(s)));
  s.particles[0].physics.gravity=Infinity;assert.throws(()=>validateScene(s));
});
