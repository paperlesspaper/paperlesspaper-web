// Run from the repository: node --test tools/openpaper-testbench/tests/test_calibration.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dir=path.join(__dirname,'../api/static');

function editor(t){
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;
 for(const name of ['remote.css','rig.css','workspace.css','calibration.css']){
  const style=d.createElement('style');style.textContent=fs.readFileSync(path.join(dir,name),'utf8');d.head.append(style);
 }
 const image=d.querySelector('#camera-image'),overlay=d.querySelector('#corner-overlay');
 image.getBoundingClientRect=()=>({left:100,top:50,width:800,height:400});
 Object.defineProperties(image,{naturalWidth:{value:1600},naturalHeight:{value:800}});
 const samples=[];
 w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},drawImage(...args){samples.push(args);}});
 let corners=[{x:.1,y:.2},{x:.9,y:.2},{x:.9,y:.8},{x:.1,y:.8}],changes=0,controller;
 vm.runInContext(fs.readFileSync(path.join(dir,'calibration.js'),'utf8'),dom.getInternalVMContext());
 controller=w.createCornerEditor({image,overlay,stage:d.querySelector('.calibration-stage'),getCorners:()=>corners,onChange:()=>{changes++;controller.render(true);}});
 const handles=[...d.querySelectorAll('.corner-handle')];handles.forEach(b=>b.setPointerCapture=()=>{});
 return {w,d,image,overlay,controller,handles,samples,corners,changes:()=>changes};
}

test('round handles and connected outline are visible only while editing',t=>{
 const e=editor(t);e.controller.render(false);
 assert.ok(e.overlay.hasAttribute('hidden'));assert.ok(e.handles.every(b=>b.hidden));
 e.controller.render(true);assert.ok(!e.overlay.hasAttribute('hidden'));
 for(const b of e.handles){
  const s=e.w.getComputedStyle(b);
  assert.equal(s.width,s.height);assert.equal(s.minHeight,s.height);assert.equal(s.borderRadius,'50%');
 }
 assert.equal(e.w.getComputedStyle(e.overlay).visibility,'visible');
 assert.equal(e.overlay.querySelector('#corner-polygon').getAttribute('points'),'100,200 900,200 900,800 100,800');
 assert.equal(e.overlay.querySelector('#corner-polygon-outline').getAttribute('points'),e.overlay.querySelector('#corner-polygon').getAttribute('points'));
});

test('drag preserves grab offset, clamps to the image and updates the loupe',t=>{
 const e=editor(t);e.controller.render(true);const b=e.handles[0];
 const pointer=(x,y)=>({clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,preventDefault(){}});
 b.onpointerdown(pointer(190,140));assert.equal(e.corners[0].x,.1);assert.equal(e.changes(),0);
 b.onpointerup(pointer(190,140));assert.equal(e.changes(),0,'Selecting a corner must not mark the crop as changed');
 b.onpointerdown(pointer(190,140));
 b.onpointermove(pointer(200,140));
 b.onpointermove(pointer(270,180));
 assert.equal(e.corners[0].x,.19375);assert.ok(Math.abs(e.corners[0].y-.3)<1e-12);
 const sample=e.samples.at(-1);
 // A 180px loupe at 4× samples 90 native pixels at this display scale.
 assert.equal(sample[1],265);assert.ok(Math.abs(sample[2]-195)<1e-9);assert.equal(sample[3],90);assert.equal(sample[4],90);
 assert.ok(!e.d.querySelector('.corner-loupe').hidden);
 b.onpointermove(pointer(-900,2000));b.onpointerup(pointer(-900,2000));assert.equal(e.corners[0].x,0);assert.equal(e.corners[0].y,1);
 const before=e.changes();b.onpointermove(pointer(200,200));assert.equal(e.changes(),before);
 e.controller.render(false);assert.ok(e.d.querySelector('.corner-loupe').hidden);
});

test('click and tap jitter never moves a corner, including fractional release coordinates',t=>{
 const e=editor(t);e.controller.render(true);const b=e.handles[0];
 const pointer=(x,y,type='mouse')=>({clientX:x,clientY:y,pointerId:1,pointerType:type,button:0,isPrimary:true,preventDefault(){}});
 for(const type of ['mouse','touch','pen']){
  b.onpointerdown(pointer(190.25,140.25,type));
  b.onpointermove(pointer(192.5,141.75,type));
  b.onpointerup(pointer(193,142,type));
  assert.equal(e.changes(),0);
  assert.deepEqual(e.corners[0],{x:.1,y:.2});
 }
 // A release event alone is selection, even if it reports a different location.
 b.onpointerdown(pointer(190,140));b.onpointerup(pointer(210,160));assert.equal(e.changes(),0);
 assert.ok(!e.d.querySelector('.corner-loupe').hidden);
});

test('starting a drag is smooth and releasing it adds no final movement',t=>{
 const e=editor(t);e.controller.render(true);const b=e.handles[0];
 const pointer=(x,y)=>({clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,preventDefault(){}});
 b.onpointerdown(pointer(190,140));b.onpointermove(pointer(194.9,140));assert.equal(e.changes(),0);
 b.onpointermove(pointer(195.1,140));
 assert.ok(Math.abs(e.corners[0].x-(.1+.1/800))<1e-12,'Crossing the drag threshold must not jump by the threshold distance');
 b.onpointermove(pointer(215,160));const point={...e.corners[0]},changes=e.changes();
 b.onpointerup(pointer(215.75,160.5));assert.deepEqual({...e.corners[0]},point);assert.equal(e.changes(),changes);
});

test('keyboard uses native image pixels; cancellation and image loss hide stale details',t=>{
 const e=editor(t);e.controller.render(true);const b=e.handles[2];b.focus();
 b.onkeydown({key:'ArrowLeft',shiftKey:false,preventDefault(){}});
 assert.ok(Math.abs(e.corners[2].x-(.9-1/1600))<1e-12);
 b.onkeydown({key:'ArrowUp',shiftKey:true,preventDefault(){}});
 assert.ok(Math.abs(e.corners[2].y-(.8-10/800))<1e-12);
 e.image.dispatchEvent(new e.w.Event('error'));assert.ok(e.d.querySelector('.corner-loupe').hidden);
 e.image.dispatchEvent(new e.w.Event('load'));assert.ok(!e.d.querySelector('.corner-loupe').hidden);
 b.onpointerdown({clientX:800,clientY:350,pointerId:1,button:0,isPrimary:true,preventDefault(){}});
 b.onpointercancel();const before=e.changes();b.onpointermove({clientX:0,clientY:0,pointerId:1});assert.equal(e.changes(),before);
 e.controller.render(false);b.onkeydown({key:'ArrowRight',preventDefault(){}});assert.equal(e.changes(),before);
});
