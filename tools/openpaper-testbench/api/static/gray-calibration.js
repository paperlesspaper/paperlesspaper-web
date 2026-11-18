'use strict';

function createGraySelector({stage,image,onChange}){
 const overlay=document.createElement('div');overlay.className='gray-selection';overlay.hidden=true;
 const box=document.createElement('div');box.className='gray-selection-box';overlay.append(box);stage.append(overlay);
 let start=null,region={x:.4,y:.4,width:.2,height:.2};
 function render(){Object.assign(box.style,{left:region.x*100+'%',top:region.y*100+'%',width:region.width*100+'%',height:region.height*100+'%'});}
 function point(e){const r=image.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 overlay.onpointerdown=e=>{if(e.button!==0||e.isPrimary===false||!image.naturalWidth)return;e.preventDefault();start=point(e);overlay.setPointerCapture(e.pointerId);};
 overlay.onpointermove=e=>{if(!start)return;const end=point(e);region={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(start.x-end.x),height:Math.abs(start.y-end.y)};render();onChange({...region});};
 overlay.onpointerup=overlay.onpointercancel=overlay.onlostpointercapture=()=>{start=null;};
 return {set(value){region={...value};render();},show(enabled){overlay.hidden=!enabled;stage.classList.toggle('is-gray-selecting',enabled);start=null;render();}};
}

(async()=>{
 await window.rigReady;if(window.rigPage!=='camera')return;
 const el=id=>document.getElementById(id),keys=['x','y','width','height'];
 let region=null,pending=false,calibrated=false,generation=0;
 const selector=createGraySelector({stage:document.querySelector('.calibration-stage'),image:el('camera-image'),onChange:value=>{region=value;keys.forEach(k=>el('gray-'+k).value=(region[k]*100).toFixed(2));update();}});
 function valid(){return region&&region.width>0&&region.height>0&&region.x>=0&&region.y>=0&&region.x+region.width<=1.00001&&region.y+region.height<=1.00001;}
 function update(){
  el('gray-apply').disabled=pending||!valid();el('gray-reset').disabled=pending||!calibrated;
  el('gray-select').disabled=pending;el('gray-target').disabled=pending;el('gray-region').disabled=pending;
 }
 function selection(enabled){
  window.graySelecting=enabled;selector.show(enabled);el('gray-select').setAttribute('aria-pressed',String(enabled));el('gray-select').textContent=enabled?'Auswahl beenden':'Graufläche auswählen';el('gray-region').hidden=!enabled;
 }
 function render(data){
  calibrated=data.enabled;
  el('gray-status').textContent=data.enabled?`Kalibriert · gemessen RGB ${data.sample_rgb.join(' / ')} → Ziel ${data.target} / ${data.target} / ${data.target}.`:'Keine Bildkorrektur aktiv.';
  if(data.enabled)el('gray-target').value=data.target;
  update();
 }
 async function load(){const current=++generation;try{const data=await api('camera/gray-calibration');if(current===generation)render(data);}catch(e){if(current===generation){calibrated=false;el('gray-status').textContent=e.message;update();}}}
 el('gray-select').onclick=()=>{
  if(window.graySelecting){selection(false);return;}
  el('calibrate').checked=false;el('calibrate').dispatchEvent(new Event('change'));
  el('camera-view').value='original';el('camera-view').dispatchEvent(new Event('change'));
  region=null;keys.forEach(k=>{const value=Number(el('gray-'+k).value)/100;region={...region,[k]:value};});
  selector.set(region);selection(true);update();
  el('gray-status').textContent='Rechteck über der Graufläche ziehen oder Position und Größe eingeben.';
 };
 keys.forEach(k=>el('gray-'+k).oninput=()=>{region=Object.fromEntries(keys.map(key=>[key,el('gray-'+key).value===''?NaN:Number(el('gray-'+key).value)/100]));if(valid())selector.set(region);update();});
 async function save(reset){
  if(pending)return;
  const target=Number(el('gray-target').value);
  if(!reset&&(!valid()||!Number.isInteger(target)||target<32||target>224)){el('gray-status').textContent='Messfläche und Zielhelligkeit (32–224) prüfen.';return;}
  pending=true;const current=++generation;update();el('gray-status').textContent='Kalibrierung wird gespeichert …';
  try{
   const data=await api('camera/gray-calibration'+(reset?'/reset':''),reset?{}:{region,target});
   if(current!==generation)return;
   render(data);selection(false);el('analysis').textContent='Kalibrierung geändert. Bitte eine neue Vergleichsreferenz aufnehmen.';await refresh();refreshImage();
  }catch(e){if(current===generation)el('gray-status').textContent=e.message;}
  finally{pending=false;update();}
 }
 el('gray-apply').onclick=()=>save(false);el('gray-reset').onclick=()=>save(true);
 el('gray-panel').addEventListener('toggle',()=>{if(!el('gray-panel').open)selection(false);});
 el('calibrate').addEventListener('change',()=>{if(el('calibrate').checked){selection(false);region=null;update();}});
 window.addEventListener('rig-view-changed',()=>{selection(false);region=null;update();});
 window.addEventListener('rig-frame-changed',()=>{selection(false);region=null;calibrated=false;update();load();});
 el('camera-image').addEventListener('error',()=>{selection(false);region=null;update();});
 load();
})();
