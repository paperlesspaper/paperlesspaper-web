'use strict';

// Coordinates always refer to the displayed, already rotated camera image.
function createCornerEditor({image, stage, overlay, getCorners, onChange}) {
 const labels=['oben links','oben rechts','unten rechts','unten links'];
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 let enabled=false,active=null,drag=null,imageFailed=false;
 const lens=document.createElement('div');lens.className='corner-loupe';lens.hidden=true;
 lens.setAttribute('aria-hidden','true');
 const caption=document.createElement('div');caption.className='corner-loupe-caption';
 const canvas=document.createElement('canvas');canvas.width=360;canvas.height=360;
 const hint=document.createElement('div');hint.className='corner-loupe-hint';hint.textContent='Pfeiltasten: 1 Pixel · Shift: 10';
 lens.append(caption,canvas,hint);document.body.append(lens);
 const handles=labels.map((name,i)=>{
  const b=document.createElement('button');b.className='corner-handle';b.type='button';b.textContent=i+1;
  b.setAttribute('aria-label','Display-Ecke '+name);b.title='Ziehen oder mit Pfeiltasten pixelgenau verschieben';b.hidden=true;
  b.onfocus=()=>{active=i;updateLens();};
  b.onblur=()=>{if(!drag){active=null;updateLens();}};
  b.onpointerenter=()=>{if(!drag){active=i;updateLens();}};
  b.onpointerleave=()=>{if(!drag&&document.activeElement!==b){active=null;updateLens();}};
  b.onpointerdown=e=>{
   if(!enabled||!e.isPrimary||e.button!==0)return;
   e.preventDefault();b.focus({preventScroll:true});active=i;
   const p=getCorners()[i];drag={id:e.pointerId,i,x:e.clientX,y:e.clientY,point:{...p},started:false,threshold:e.pointerType==='touch'?8:5};
   b.setPointerCapture(e.pointerId);updateLens();
  };
  const move=e=>{
   if(!drag||drag.id!==e.pointerId)return;
   const r=image.getBoundingClientRect();if(!r.width||!r.height)return;
   if(!drag.started){
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y,distance=Math.hypot(dx,dy);
    if(distance<=drag.threshold)return;
    // Ignore click/tap jitter. Subtract the activation distance so crossing the
    // threshold starts smoothly rather than jumping by five/eight pixels.
    drag.x+=dx/distance*drag.threshold;drag.y+=dy/distance*drag.threshold;
    drag.started=true;b.classList.add('is-dragging');
   }
   // Keep the initial grab offset: touching the edge of a handle must not jump it.
   const next={x:clamp(drag.point.x+(e.clientX-drag.x)/r.width,0,1),y:clamp(drag.point.y+(e.clientY-drag.y)/r.height,0,1)};
   if(next.x===getCorners()[i].x&&next.y===getCorners()[i].y)return;
   getCorners()[i]=next;
   onChange();
  };
  const finish=()=>{drag=null;b.classList.remove('is-dragging');};
  b.onpointermove=move;
  // Release coordinates may be rounded or jittery; only pointermove edits points.
  b.onpointerup=finish;
  b.onpointercancel=finish;b.onlostpointercapture=finish;
  b.onkeydown=e=>{
   const axis={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',-1],ArrowDown:['y',1]}[e.key];
   if(!enabled||!axis)return;e.preventDefault();active=i;
   const r=image.getBoundingClientRect();
   const pixels=axis[0]==='x'?(image.naturalWidth||r.width):(image.naturalHeight||r.height);
   if(!pixels)return;
   const p=getCorners()[i];p[axis[0]]=clamp(p[axis[0]]+axis[1]*(e.shiftKey?10:1)/pixels,0,1);onChange();
  };
  stage.append(b);return b;
 });
 function updateLens(){
  const r=image.getBoundingClientRect();
  if(!enabled||active===null||imageFailed||!image.naturalWidth||!r.width||!r.height){lens.hidden=true;return;}
  const p=getCorners()[active],size=canvas.width,zoom=4,viewSize=180;
  const spanX=viewSize/zoom*image.naturalWidth/r.width,spanY=viewSize/zoom*image.naturalHeight/r.height;
  const ctx=canvas.getContext('2d');if(!ctx){lens.hidden=true;return;}
  ctx.fillStyle='#e5e7eb';ctx.fillRect(0,0,size,size);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,p.x*image.naturalWidth-spanX/2,p.y*image.naturalHeight-spanY/2,spanX,spanY,0,0,size,size);
  // Two-tone crosshair remains legible on both black and white display borders.
  for(const [colour,width] of [['#fff',6],['#104aa1',2]]){
   ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.beginPath();
   ctx.moveTo(size/2,0);ctx.lineTo(size/2,size);ctx.moveTo(0,size/2);ctx.lineTo(size,size/2);ctx.stroke();
  }
  caption.textContent=`Ecke ${active+1} · 4×`;
  lens.hidden=false;
  const box=lens.getBoundingClientRect(),x=r.left+p.x*r.width,y=r.top+p.y*r.height;
  const viewportWidth=document.documentElement.clientWidth||window.innerWidth;
  const viewportHeight=document.documentElement.clientHeight||window.innerHeight;
  lens.style.left=clamp(x+36+box.width<=viewportWidth-8?x+36:x-box.width-36,8,Math.max(8,viewportWidth-box.width-8))+'px';
  lens.style.top=clamp(y-box.height-36>=8?y-box.height-36:y+36,8,Math.max(8,viewportHeight-box.height-8))+'px';
 }
 function render(editing){
  enabled=editing;stage.classList.toggle('is-calibrating',enabled);overlay.toggleAttribute('hidden',!enabled);
  const points=getCorners();
  overlay.querySelectorAll('polygon').forEach(p=>p.setAttribute('points',points.map(p=>`${p.x*1000},${p.y*1000}`).join(' ')));
  handles.forEach((b,i)=>{b.style.left=points[i].x*100+'%';b.style.top=points[i].y*100+'%';b.hidden=!enabled;});
  if(!enabled){active=null;drag=null;handles.forEach(b=>b.classList.remove('is-dragging'));}
  updateLens();
 }
 image.addEventListener('load',()=>{imageFailed=false;updateLens();});
 image.addEventListener('error',()=>{imageFailed=true;updateLens();});
 window.addEventListener('scroll',updateLens,true);window.addEventListener('resize',updateLens);
 return {render};
}
