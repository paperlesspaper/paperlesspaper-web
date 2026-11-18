const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
function setup(t){
 const dom=new JSDOM('<div id="view" tabindex="0"><img id="image"></div>',{runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,viewport=d.getElementById('view'),image=d.getElementById('image'),changes=[];
 w.ResizeObserver=class{observe(){}};viewport.setPointerCapture=()=>{};
 viewport.getBoundingClientRect=()=>({left:0,top:0,width:800,height:400});
 image.getBoundingClientRect=()=>({left:0,top:0,width:800,height:400});
 Object.defineProperties(image,{naturalWidth:{value:1600,configurable:true},naturalHeight:{value:800,configurable:true},complete:{value:true,configurable:true}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/static/image-zoom.js'),'utf8'),dom.getInternalVMContext());
 const zoom=w.createZoomViewport({viewport,image,onChange:s=>changes.push(s)});
 function pointer(type,x,y,id=1){const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:id});viewport.dispatchEvent(e);}
 return {w,d,image,viewport,zoom,changes,pointer};
}
test('image points ignore letterboxing and map to the visible pixels',t=>{
 const e=setup(t);e.image.getBoundingClientRect=()=>({left:10,top:20,width:800,height:800});
 assert.equal(e.w.zoomImagePoint(e.image,410,100),null);
 const p=e.w.zoomImagePoint(e.image,610,420);assert.equal(p.x,.75);assert.equal(p.y,.5);
});
test('opening at a point centers that part of the photo; live frames preserve zoom',t=>{
 const e=setup(t);e.zoom.reset({x:.75,y:.5},2,true);assert.equal(e.changes.length,0);
 e.image.dispatchEvent(new e.w.Event('load'));
 assert.equal(e.image.style.transform,'translate(-800px, -200px) scale(2)');
 const transform=e.image.style.transform;e.image.dispatchEvent(new e.w.Event('load'));assert.equal(e.image.style.transform,transform);
 e.zoom.reset();assert.equal(e.image.style.transform,'translate(0px, 0px) scale(1)');
});
test('click zoom stays anchored, dragging pans and release does not zoom again',t=>{
 const e=setup(t);e.zoom.reset();e.pointer('pointerdown',600,200);e.pointer('pointerup',600,200);
 assert.equal(e.image.style.transform,'translate(-600px, -200px) scale(2)');
 e.pointer('pointerdown',400,200);e.pointer('pointermove',450,220);e.pointer('pointerup',450,220);
 assert.equal(e.image.style.transform,'translate(-550px, -180px) scale(2)');
 e.pointer('pointerdown',450,220);e.pointer('pointercancel',450,220);assert.equal(e.changes.at(-1).zoom,2);
});
test('wheel zoom, native pixel size, keyboard and bounds remain usable',t=>{
 const e=setup(t);e.zoom.reset();const wheel=new e.w.WheelEvent('wheel',{clientX:400,clientY:200,deltaY:-100,cancelable:true});e.viewport.dispatchEvent(wheel);
 assert.ok(wheel.defaultPrevented);assert.ok(e.changes.at(-1).zoom>1);
 e.zoom.native();assert.equal(e.changes.at(-1).zoom,2);
 for(let i=0;i<30;i++)e.zoom.zoomIn();assert.equal(e.changes.at(-1).zoom,8);
 e.viewport.dispatchEvent(new e.w.KeyboardEvent('keydown',{key:'0',cancelable:true}));assert.equal(e.changes.at(-1).zoom,1);
 e.zoom.zoomOut();assert.equal(e.changes.at(-1).zoom,1);
});
test('two-finger pinch zooms around its midpoint without a release click',t=>{
 const e=setup(t);e.zoom.reset();e.pointer('pointerdown',300,200,1);e.pointer('pointerdown',500,200,2);
 e.pointer('pointermove',700,200,2);assert.equal(e.changes.at(-1).zoom,2);
 assert.equal(e.image.style.transform,'translate(-300px, -200px) scale(2)');
 e.pointer('pointerup',700,200,2);e.pointer('pointerup',300,200,1);assert.equal(e.changes.at(-1).zoom,2);
});
test('hover uses a decoded frame; calibration disables preview interactions',t=>{
 const e=setup(t);let enabled=true,opens=0,active=false,draws=0;
 e.w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){draws++;}});
 const hover=e.w.createHoverZoom({image:e.image,enabled:()=>enabled,hoverEnabled:()=>true,onOpen:()=>opens++,onActivity:v=>active=v});
 e.image.dispatchEvent(new e.w.MouseEvent('pointermove',{clientX:400,clientY:200}));assert.ok(active);assert.ok(draws>=2);
 const lens=e.d.querySelector('.image-hover-loupe');assert.equal(lens.hidden,false);
 Object.defineProperty(e.image,'complete',{value:false});
 Object.defineProperties(e.image,{naturalWidth:{value:0},naturalHeight:{value:0}});
 e.image.dispatchEvent(new e.w.MouseEvent('pointermove',{clientX:410,clientY:200}));assert.equal(lens.hidden,false);
 e.image.dispatchEvent(new e.w.MouseEvent('click',{clientX:400,clientY:200}));assert.equal(opens,1);
 enabled=false;e.image.dispatchEvent(new e.w.MouseEvent('click',{clientX:400,clientY:200}));assert.equal(opens,1);
 hover.hide();assert.equal(lens.hidden,true);assert.equal(active,false);
});
