const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dir=path.join(__dirname,'../api/static');

test('gray rectangle handles reverse drags, boundaries and cancellation',async t=>{
 const dom=new JSDOM('<div id="stage"><img></div>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;w.rigPage='settings';w.rigReady=Promise.resolve();
 vm.runInContext(fs.readFileSync(path.join(dir,'gray-calibration.js'),'utf8'),dom.getInternalVMContext());
 const image=d.querySelector('img'),stage=d.querySelector('#stage');
 image.getBoundingClientRect=()=>({left:100,top:50,width:800,height:400});Object.defineProperty(image,'naturalWidth',{value:1600});
 let value;const controller=w.createGraySelector({image,stage,onChange:r=>value=r});
 controller.show(true);const overlay=stage.querySelector('.gray-selection');overlay.setPointerCapture=()=>{};
 const pointer=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
 overlay.onpointerdown(pointer(700,350));overlay.onpointermove(pointer(300,150));
 assert.deepEqual(JSON.parse(JSON.stringify(value)),{x:.25,y:.25,width:.5,height:.5});
 overlay.onpointermove(pointer(-100,-100));assert.equal(value.x,0);assert.equal(value.y,0);
 overlay.onpointercancel();const previous=value;overlay.onpointermove(pointer(500,200));assert.equal(value,previous);
 controller.show(false);assert.ok(overlay.hidden);assert.ok(!stage.classList.contains('is-gray-selecting'));
});

test('calibration UI validates selection and clears it when switching views',async t=>{
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,calls=[];
 w.rigReady=Promise.resolve();w.rigPage='camera';w.api=async(path,body)=>{calls.push({path,body});return {enabled:false};};w.refresh=async()=>{};w.refreshImage=()=>{};
 vm.runInContext(fs.readFileSync(path.join(dir,'gray-calibration.js'),'utf8'),dom.getInternalVMContext());
 await new Promise(resolve=>setImmediate(resolve));
 const el=id=>d.getElementById(id);
 el('gray-select').click();assert.ok(w.graySelecting);assert.ok(!el('gray-apply').disabled);
 el('gray-x').value=95;el('gray-x').dispatchEvent(new w.Event('input'));assert.ok(el('gray-apply').disabled);
 el('gray-x').value=40;el('gray-x').dispatchEvent(new w.Event('input'));el('gray-target').value=0;el('gray-apply').click();
 assert.equal(calls.filter(c=>c.body).length,0);
 el('gray-target').value=118;el('gray-apply').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.at(-1).body.target,118);assert.equal(calls.at(-1).body.region.x,.4);assert.ok(!w.graySelecting);
 el('gray-select').click();w.dispatchEvent(new w.Event('rig-view-changed'));assert.ok(!w.graySelecting);assert.ok(el('gray-apply').disabled);
});
