import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Exercise actual editor handlers in a minimal DOM harness. Visual/browser QA is separate.
test('editor initializes, runs frames, edits, duplicates, connects, rewinds, and validates recipes',async()=>{
  const noop=()=>{};
  const context=new Proxy({createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
  class Element{
    constructor(){this.children=[];this.dataset={};this.style={};this.classList={toggle:noop,add:noop,remove:noop};this.value='';this.checked=false;this.tagName='DIV';}
    append(e){this.children.push(e);}setAttribute(){}getContext(){return context;}getBoundingClientRect(){return{width:900,height:650,left:0,top:0};}focus(){globalThis.document.activeElement=this;}setPointerCapture(){}click(){this.onclick?.();}
  }
  const elements=new Map();const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],new Element());
  elements.get('recipe').value='set power 1\nset defense 1\nimpulse 0 -60';
  elements.get('speed').value='1';
  for(const name of ['select','add','link','pan','erase']){const e=new Element();e.dataset.tool=name;elements.get('tools').append(e);}
  const tabs=['world','magnet'].map(name=>{const e=new Element();e.dataset.tab=name;return e;});
  globalThis.document={getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelectorAll:()=>tabs,activeElement:new Element()};
  globalThis.devicePixelRatio=1;
  globalThis.ResizeObserver=class{constructor(cb){this.cb=cb;}observe(){this.cb();}};
  let callback;globalThis.requestAnimationFrame=cb=>callback=cb;
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
  await import('../app/app.js');
  assert.equal(elements.get('count').textContent,78);assert.equal(elements.get('presets').children.length,6);
  for(let i=1;i<20;i++)callback(i*40);
  elements.get('clear').onclick();assert.equal(elements.get('count').textContent,0);
  const canvas=elements.get('world');const event=(x,y)=>({clientX:x,clientY:y,pointerId:1,button:0,shiftKey:false});
  canvas.onpointerdown(event(400,300));assert.equal(elements.get('count').textContent,1);
  elements.get('override-gravity').value='-20';elements.get('override-gravity').onchange();assert.equal(elements.get('override-gravity').value,-20);
  elements.get('inherit-physics').onclick();assert.equal(elements.get('override-gravity').value,'');
  elements.get('duplicate').onclick();assert.equal(elements.get('count').textContent,2);
  elements.get('recipe').value='set power 2\ntag test';elements.get('run-recipe').onclick();assert.equal(elements.get('power').value,2);
  elements.get('recipe').value='set power 4\ninvalid command';elements.get('run-recipe').onclick();assert.equal(elements.get('power').value,2,'invalid recipes are atomic');
  elements.get('tools').children.find(e=>e.dataset.tool==='link').onclick();
  canvas.onpointerdown(event(400,300));canvas.onpointerdown(event(419.8,319.8));assert.equal(elements.get('links-count').textContent,1);
  for(let i=20;i<100;i++)callback(i*40);
  elements.get('rewind').onclick();assert.equal(elements.get('play').textContent,'▶');
  elements.get('delete').onclick();assert.equal(elements.get('count').textContent,1);assert.equal(elements.get('links-count').textContent,0);
});
