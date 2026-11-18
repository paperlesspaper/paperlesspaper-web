'use strict';

// Fit geometry includes object-fit letterboxing; all points use image coordinates.
const zoomPreviewDimensions=new WeakMap();
function zoomImageBounds(image){
 const r=image.getBoundingClientRect();
 if(image.naturalWidth&&image.naturalHeight)zoomPreviewDimensions.set(image,{width:image.naturalWidth,height:image.naturalHeight});
 const size=zoomPreviewDimensions.get(image);
 if(!size||!r.width||!r.height)return null;
 const scale=Math.min(r.width/size.width,r.height/size.height);
 const width=size.width*scale,height=size.height*scale;
 return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};
}
function zoomImagePoint(image,x,y){
 const r=zoomImageBounds(image);
 if(!r||x<r.left||y<r.top||x>r.left+r.width||y>r.top+r.height)return null;
 return {x:(x-r.left)/r.width,y:(y-r.top)/r.height};
}

function createHoverZoom({image,enabled,hoverEnabled,onOpen,onActivity=()=>{}}){
 const lens=document.createElement('div');lens.className='image-hover-loupe';lens.hidden=true;lens.setAttribute('aria-hidden','true');
 const label=document.createElement('div');label.textContent='4× · Klicken zum Zoomen';
 const canvas=document.createElement('canvas');canvas.width=360;canvas.height=360;lens.append(label,canvas);document.body.append(lens);
 const frame=document.createElement('canvas');let point=null,pointer=null,active=false,hasFrame=false;
 image.classList.add('zoom-preview');image.draggable=false;image.tabIndex=0;image.setAttribute('role','button');zoomImageBounds(image);
 image.setAttribute('aria-label',image.alt+' · Zum Zoomen anklicken');
 function hide(){lens.hidden=true;point=null;pointer=null;if(active){active=false;onActivity(false);}hasFrame=false;}
 function capture(){
  // Cache a decoded frame, so polling the next JPEG cannot blank the magnifier.
  if(!active||!image.complete||!image.naturalWidth)return;
  const ctx=frame.getContext('2d');if(!ctx)return;
  frame.width=image.naturalWidth;frame.height=image.naturalHeight;ctx.drawImage(image,0,0);hasFrame=true;
 }
 function draw(){
  if(!enabled()||!hoverEnabled()){hide();return;}
  const r=zoomImageBounds(image);if(!point||!pointer||!r||!hasFrame)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const width=180/4*frame.width/r.width,height=180/4*frame.height/r.height;
  ctx.fillStyle='#e5e7eb';ctx.fillRect(0,0,360,360);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(frame,point.x*frame.width-width/2,point.y*frame.height-height/2,width,height,0,0,360,360);
  lens.hidden=false;
  const box=lens.getBoundingClientRect(),vw=document.documentElement.clientWidth||innerWidth,vh=document.documentElement.clientHeight||innerHeight;
  lens.style.left=Math.max(8,Math.min(vw-box.width-8,pointer.x+28+box.width<vw?pointer.x+28:pointer.x-box.width-28))+'px';
  lens.style.top=Math.max(8,Math.min(vh-box.height-8,pointer.y-box.height-24>8?pointer.y-box.height-24:pointer.y+24))+'px';
 }
 image.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||!enabled()||!hoverEnabled()){hide();return;}
  point=zoomImagePoint(image,e.clientX,e.clientY);if(!point){hide();return;}
  pointer={x:e.clientX,y:e.clientY};if(!active){active=true;onActivity(true);capture();}draw();
 });
 image.addEventListener('pointerleave',hide);
 image.addEventListener('load',()=>{zoomImageBounds(image);capture();draw();});image.addEventListener('error',()=>{zoomPreviewDimensions.delete(image);hide();});
 image.addEventListener('click',e=>{if(!enabled())return;const p=zoomImagePoint(image,e.clientX,e.clientY);if(p){hide();image.focus({preventScroll:true});onOpen(p);}});
 image.addEventListener('keydown',e=>{if(enabled()&&(e.key==='Enter'||e.key===' ')){e.preventDefault();hide();onOpen({x:.5,y:.5});}});
 window.addEventListener('scroll',hide,true);window.addEventListener('blur',hide);
 return {hide};
}

function createZoomViewport({viewport,image,onChange=()=>{}}){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 let zoom=1,pan={x:0,y:0},fit=null,pending=null,gesture=null;
 const pointers=new Map();
 function geometry(){
  const r=viewport.getBoundingClientRect();
  if(!image.naturalWidth||!image.naturalHeight||!r.width||!r.height)return null;
  const scale=Math.min(1,r.width/image.naturalWidth,r.height/image.naturalHeight);
  return {width:image.naturalWidth*scale,height:image.naturalHeight*scale,scale,vw:r.width,vh:r.height,left:r.left,top:r.top};
 }
 function render(){
  const next=geometry();if(!next)return;
  // Keep the same image area centered when resizing or receiving a new frame.
  if(fit){pan.x*=next.width/fit.width;pan.y*=next.height/fit.height;}
  fit=next;zoom=clamp(zoom,1,Math.max(8,1/fit.scale));
  if(pending){zoom=clamp(pending.zoom,1,Math.max(8,1/fit.scale));pan={x:(.5-pending.point.x)*fit.width*zoom,y:(.5-pending.point.y)*fit.height*zoom};pending=null;}
  const mx=Math.max(0,(fit.width*zoom-fit.vw)/2),my=Math.max(0,(fit.height*zoom-fit.vh)/2);
  pan.x=clamp(pan.x,-mx,mx);pan.y=clamp(pan.y,-my,my);
  image.style.width=fit.width+'px';image.style.height=fit.height+'px';
  image.style.transform=`translate(${(fit.vw-fit.width*zoom)/2+pan.x}px, ${(fit.vh-fit.height*zoom)/2+pan.y}px) scale(${zoom})`;
  viewport.classList.toggle('is-zoomed',zoom>1.001);
  onChange({zoom,native:1/fit.scale,max:Math.max(8,1/fit.scale)});
 }
 function anchor(x,y){
  if(!fit)return {x:.5,y:.5};
  return {x:.5+(x-fit.left-fit.vw/2-pan.x)/(fit.width*zoom),y:.5+(y-fit.top-fit.vh/2-pan.y)/(fit.height*zoom)};
 }
 function zoomAt(value,x,y){
  if(!fit)return;
  x??=fit.left+fit.vw/2;y??=fit.top+fit.vh/2;
  const p=anchor(x,y);zoom=clamp(value,1,Math.max(8,1/fit.scale));
  pan={x:x-fit.left-fit.vw/2-(p.x-.5)*fit.width*zoom,y:y-fit.top-fit.vh/2-(p.y-.5)*fit.height*zoom};render();
 }
 function reset(point={x:.5,y:.5},level=1,waitForImage=false){
  pointers.clear();gesture=null;viewport.classList.remove('is-panning');
  zoom=1;pan={x:0,y:0};fit=null;pending={point,zoom:level};if(!waitForImage)render();
 }
 function startPan(e,blocked=false){gesture={kind:'pan',x:e.clientX,y:e.clientY,pan:{...pan},moved:blocked,blocked};}
 viewport.addEventListener('pointerdown',e=>{
  if(e.button!==0||!fit)return;e.preventDefault();viewport.focus({preventScroll:true});
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);
  if(pointers.size===1)startPan(e);
  else if(pointers.size===2){
   const [a,b]=[...pointers.values()],x=(a.x+b.x)/2,y=(a.y+b.y)/2;
   gesture={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,point:anchor(x,y)};
  }
 });
 viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture||!fit)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gesture.kind==='pinch'){
   const [a,b]=[...pointers.values()];if(!b)return;
   zoom=clamp(gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,1,Math.max(8,1/fit.scale));
   pan={x:(a.x+b.x)/2-fit.left-fit.vw/2-(gesture.point.x-.5)*fit.width*zoom,y:(a.y+b.y)/2-fit.top-fit.vh/2-(gesture.point.y-.5)*fit.height*zoom};render();return;
  }
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(Math.hypot(dx,dy)>5)gesture.moved=true;
  if(gesture.moved&&zoom>1){pan={x:gesture.pan.x+dx,y:gesture.pan.y+dy};viewport.classList.add('is-panning');render();}
 });
 function end(e,cancelled=false){
  if(!pointers.has(e.pointerId))return;
  const click=!cancelled&&gesture?.kind==='pan'&&!gesture.moved&&!gesture.blocked&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<=5;
  pointers.delete(e.pointerId);
  if(click&&fit){const p=anchor(e.clientX,e.clientY);if(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)zoomAt(zoom>=Math.max(8,1/fit.scale)-.01?1:zoom*2,e.clientX,e.clientY);}
  if(pointers.size===1){const p=[...pointers.values()][0];startPan({clientX:p.x,clientY:p.y},true);}else if(!pointers.size)gesture=null;
  viewport.classList.remove('is-panning');
 }
 viewport.addEventListener('pointerup',e=>end(e));viewport.addEventListener('pointercancel',e=>end(e,true));viewport.addEventListener('lostpointercapture',e=>end(e,true));
 viewport.addEventListener('wheel',e=>{if(!fit)return;e.preventDefault();zoomAt(zoom*Math.exp(-e.deltaY*(e.deltaMode===1 ? .035 : .002)),e.clientX,e.clientY);},{passive:false});
 viewport.addEventListener('keydown',e=>{
  if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(zoom*1.5);}else if(e.key==='-'){e.preventDefault();zoomAt(zoom/1.5);}
  else if(e.key==='0'){e.preventDefault();reset();}
  else if(e.key==='Enter'){e.preventDefault();zoomAt(zoom*2);}
  else if(e.key.startsWith('Arrow')){e.preventDefault();const delta={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[e.key];if(delta){pan.x+=delta[0];pan.y+=delta[1];render();}}
 });
 image.addEventListener('load',render);
 const resize=new ResizeObserver(()=>render());resize.observe(viewport);
 return {reset,zoomIn:()=>zoomAt(zoom*1.5),zoomOut:()=>zoomAt(zoom/1.5),native:()=>{if(fit)zoomAt(1/fit.scale);},render};
}
