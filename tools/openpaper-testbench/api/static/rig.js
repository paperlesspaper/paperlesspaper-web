'use strict';
window.rigPage=location.pathname==='/settings'?'settings':location.pathname==='/cameras/detail'?'detail':'camera';
const routeFrame=location.pathname.match(/^\/cameras\/([a-zA-Z0-9_-]+)\/?$/)?.[1];
if(window.rigPage==='camera'&&routeFrame)window.rigFrameId=routeFrame;
window.rigReady = (async () => {
 const el=id=>document.getElementById(id);
 const request=async(path,body,keepalive=false)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
  const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Testbench':'1'},...(body===undefined?{}:{body:JSON.stringify(body)}),keepalive,signal:controller.signal});
  if(r.status===401){location.replace('/login.html?next='+encodeURIComponent(location.pathname+location.search));throw Error('Anmeldung erforderlich');}
  const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Zuordnung oder Ecken ungültig. Bitte prüfen.');return data;
  }catch(e){if(e.name==='AbortError')throw Error('Anfrage dauert zu lange. Bitte erneut versuchen.');throw e;}
  finally{clearTimeout(timer);}
 };
 const message=e=>{el('rig-status').textContent=e.message;};
 let config,devices={cameras:[],ports:[]},corners,dirty=false,saving=false,assignmentDirty=false;
 const assignmentFields=['frame-name','frame-camera','frame-rotation','frame-relay','frame-serial','detail-camera','light-device'];
 function markAssignmentDirty(){
  assignmentDirty=true;
  el('rig-status').textContent='Zuordnung noch nicht gespeichert';
 }
 for(const id of assignmentFields)el(id).addEventListener(id==='frame-name'?'input':'change',markAssignmentDirty);
 window.addEventListener('beforeunload',event=>{
  if(assignmentDirty||dirty||saving){event.preventDefault();event.returnValue='';}
 });
 window.rigCropped=false;
 function changeView(){
  window.rigCropped=el('camera-view').value==='display';
  if(window.rigCropped)el('calibrate').checked=false;
  el('corner-overlay').toggleAttribute('hidden',window.rigCropped);
  el('camera-image').alt=window.rigCropped?'Live-Ansicht des entzerrten Displays':'Livebild der zugeordneten Webcam';
  draw();window.dispatchEvent(new Event('rig-view-changed'));
 }
 el('camera-view').onchange=changeView;
 const frame=()=>config.frames.find(f=>f.id===window.rigFrameId);
 const option=(value,text)=>{const o=document.createElement('option');o.value=value||'';o.textContent=text;return o;};
 function select(id,list,value){
  const input=el(id);input.replaceChildren(option('','Nicht zugeordnet'));
  for(const d of list)input.append(option(d.id,`${d.name} · ${d.device} · ${d.id.split('/').pop()}`));
  if(value&&!list.some(d=>d.id===value))input.append(option(value,`Nicht verbunden · ${value}`));
  input.value=value||'';
 }
 function draw(){calibration.render(el('calibrate').checked);}
 function changed(){dirty=true;el('corners-save').disabled=false;el('corner-status').textContent='Ausschnitt noch nicht gespeichert';draw();}
 function render(){
  const nav=el('camera-nav');nav.replaceChildren();
  const entries=config.frames.map(f=>({id:f.id,name:f.name,assigned:!!f.camera}));
  if(config.detail_camera)entries.push({id:'detail',name:'Endoskop',assigned:true});
  for(const entry of entries){
   const link=document.createElement('a');link.href='/cameras/'+encodeURIComponent(entry.id);
   const name=document.createElement('span');name.textContent=entry.name;link.append(name);
   if(!entry.assigned){const hint=document.createElement('small');hint.textContent='Nicht zugeordnet';link.append(hint);}
   if(location.pathname===link.getAttribute('href'))link.setAttribute('aria-current','page');
   nav.append(link);
  }
  el('settings-link').toggleAttribute('aria-current',window.rigPage==='settings');
  if(window.rigPage==='settings')el('settings-link').setAttribute('aria-current','page');
  el('frame-select').replaceChildren(...config.frames.map(f=>option(f.id,f.name)));
  el('frame-select').value=window.rigFrameId;
  const f=frame();window.rigRotation=f.rotation||0;el('frame-name').value=f.name;el('frame-heading').textContent=window.rigPage==='detail'?'Endoskop':'Livebild';
  const title=window.rigPage==='settings'?'Geräte & Einstellungen':window.rigPage==='detail'?'Endoskop':f.name;
  el('page-title').textContent=title;document.title=title+' · Testbench';
  el('page-subtitle').textContent=window.rigPage==='settings'?'Kameras zuordnen und Teststand verwalten':window.rigPage==='detail'?'Detailkamera · Livebild & Fotos':'Livebild, Fotos & Rahmensteuerung';
  select('frame-camera',devices.cameras,f.camera);el('frame-rotation').value=String(f.rotation||0);
  const ch=devices.ports.filter(p=>p.vid===0x1a86&&p.pid===0x7523);
  select('frame-relay',ch,f.relay);select('light-device',ch,config.light_device);
  select('frame-serial',devices.ports.filter(p=>p.vid===0x10c4&&p.pid===0xea60),f.serial);
  select('detail-camera',devices.cameras,config.detail_camera);
  corners=structuredClone(f.corners);dirty=false;el('corners-save').disabled=true;el('corner-status').textContent='Gespeicherter Ausschnitt';draw();
  if(window.rigPage==='camera')el('crop-preview').src='/api/camera.jpg?cropped=true&frame_id='+encodeURIComponent(f.id)+'&t='+Date.now();
  el('crop-preview').hidden=!f.camera;el('detail-photo').disabled=!config.detail_camera;
 }
 async function reload(){
  config=await request('rig');
  if(!config.frames.some(f=>f.id===window.rigFrameId))window.rigFrameId=config.frames[0].id;
  render();el('rig-status').textContent='Gespeicherte Zuordnung geladen · Geräte werden gesucht …';
 }
 async function save(onlyCorners=false){
  if(saving)return false;saving=true;
  // Keep input stable until the server acknowledges this exact configuration.
  const controls=[...assignmentFields,'frame-select','frame-add','rig-reload','rig-save','corners-save'];
  for(const id of controls)el(id).disabled=true;
  try{
   const next=structuredClone(config),f=next.frames.find(f=>f.id===window.rigFrameId);
   f.corners=corners;
   if(!onlyCorners){f.rotation=Number(el('frame-rotation').value);f.name=el('frame-name').value.trim();f.camera=el('frame-camera').value||null;f.relay=el('frame-relay').value||null;f.serial=el('frame-serial').value||null;next.detail_camera=el('detail-camera').value||null;next.light_device=el('light-device').value||null;}
   // Saving corners must not discard edits in the assignment form.
   const pending=onlyCorners&&assignmentDirty?Object.fromEntries(assignmentFields.map(id=>[id,el(id).value])):null;
   config=await request('rig',next);render();
   if(pending){for(const [id,value] of Object.entries(pending))el(id).value=value;markAssignmentDirty();}
   else{assignmentDirty=false;el('rig-status').textContent='Dauerhaft gespeichert';}
   window.dispatchEvent(new Event('rig-frame-changed'));return true;
  }catch(e){message(e);return false;}finally{
   saving=false;for(const id of controls)el(id).disabled=false;el('corners-save').disabled=!dirty;
  }
 }
 const calibration=createCornerEditor({image:el('camera-image'),stage:document.querySelector('.calibration-stage'),overlay:el('corner-overlay'),getCorners:()=>corners,onChange:changed});
 el('calibrate').onchange=()=>{if(el('calibrate').checked){el('camera-view').value='original';changeView();}else draw();};el('corners-save').onclick=()=>save(true);el('rig-save').onclick=()=>save(false);
 el('frame-select').onchange=async()=>{
  const nextId=el('frame-select').value;el('frame-select').value=window.rigFrameId;
  if((assignmentDirty||dirty)&&!await save(false))return;
  window.rigFrameId=nextId;render();window.dispatchEvent(new Event('rig-frame-changed'));
 };
 el('rig-reload').onclick=async()=>{
  el('rig-reload').disabled=true;
  try{
   devices=await request('devices');
   // Device discovery must not reload the saved profile over the user's edits.
   const ch=devices.ports.filter(p=>p.vid===0x1a86&&p.pid===0x7523);
   for(const [id,list] of [['frame-camera',devices.cameras],['detail-camera',devices.cameras],['frame-relay',ch],['light-device',ch],['frame-serial',devices.ports.filter(p=>p.vid===0x10c4&&p.pid===0xea60)]])select(id,list,el(id).value);
   el('rig-status').textContent=`${devices.cameras.length} Kameras · ${devices.ports.length} USB-Serial-Geräte`+(assignmentDirty?' · Zuordnung noch nicht gespeichert':'');
  }catch(e){message(e);}finally{el('rig-reload').disabled=false;}
 };
 el('frame-add').onclick=async()=>{
  if(config.frames.length>=8){message(Error('Maximal acht Rahmen'));return;}
  if((assignmentDirty||dirty)&&!await save(false))return;
  const next=structuredClone(config),id='frame-'+Date.now();next.frames.push({id,name:'Rahmen '+(next.frames.length+1),camera:null,relay:null,serial:null,corners:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]});
  try{config=await request('rig',next);window.rigFrameId=id;render();window.dispatchEvent(new Event('rig-frame-changed'));}catch(e){message(e);}
 };
 // crypto.randomUUID is not available on plain HTTP LAN origins.
 const random=new Uint8Array(16);crypto.getRandomValues(random);const client=Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
 let presencePending=false,detailPending=false,lightDirty=false;
 function renderLight(s){
  el('light-status').textContent=s.error?'Licht: '+s.error:!s.device?'USB-Licht zuordnen':!s.confirmed?'Warte auf Licht':s.commanded_brightness>0?`Licht an · ${s.commanded_brightness} % · ${s.effective_kelvin} K`:'Licht aus';
  if(!lightDirty){el('light-mode').value=s.mode||(s.enabled?'auto':'off');el('light-kelvin').value=s.kelvin;el('light-kelvin-value').textContent=s.kelvin+' K';}
 }
 const presence=async()=>{if(presencePending)return;presencePending=true;try{renderLight(await request('ui/presence',{client_id:client,visible:!document.hidden&&window.rigPage!=='settings'}));}catch(e){el('light-status').textContent=e.message;}finally{presencePending=false;}};
 window.releaseLight=()=>request('ui/presence',{client_id:client,visible:false},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)window.releaseLight().catch(()=>{});else presence();});
 window.addEventListener('pagehide',()=>window.releaseLight().catch(()=>{}));
 const lightChanged=()=>{lightDirty=true;el('light-save').textContent='Licht speichern';};
 el('light-mode').onchange=lightChanged;
 el('light-kelvin').oninput=()=>{lightChanged();el('light-kelvin-value').textContent=el('light-kelvin').value+' K';};
 el('light-save').onclick=async()=>{
  el('light-save').disabled=true;
  try{const s=await request('light',{mode:el('light-mode').value,brightness:100,kelvin:Number(el('light-kelvin').value)});lightDirty=false;renderLight(s);el('light-save').textContent='Dauerhaft gespeichert';}
  catch(e){el('light-status').textContent=e.message;}finally{el('light-save').disabled=false;}
 };
 el('detail-image').onload=()=>{detailPending=false;el('detail-image').hidden=false;el('detail-error').hidden=true;};
 el('detail-image').onerror=()=>{detailPending=false;el('detail-image').hidden=true;el('detail-error').hidden=false;el('detail-error').textContent='Kein Bild von der Endoskopkamera';};
 el('detail-photo').onclick=async()=>{try{const p=await request('photos?detail=true',{});el('latest-photo').href=p.url;el('latest-photo').hidden=false;el('detail-info').textContent='Detailfoto gespeichert · Link unter Webcam';}catch(e){el('detail-info').textContent=e.message;}};
 try{
  await reload();document.body.dataset.page=window.rigPage;
  // Hardware queries must never keep the whole page in its loading state.
  el('rig-reload').onclick();
  request('light').then(renderLight).catch(e=>{el('light-status').textContent=e.message;});
 }catch(e){message(e);el('page-error').hidden=false;el('page-error').textContent=e.message+' · Bitte Seite neu laden.';}
 let cropVisible=false,cropPending=false;
 const cropObserver=new IntersectionObserver(entries=>{cropVisible=entries[0].isIntersecting;});
 cropObserver.observe(el('crop-preview'));
 el('crop-preview').onload=()=>{cropPending=false;};el('crop-preview').onerror=()=>{cropPending=false;};
 setInterval(()=>{if(window.rigPage!=='camera'||document.hidden||!cropVisible||cropPending||!frame()?.camera)return;cropPending=true;if(window.rigPage==='camera')el('crop-preview').src='/api/camera.jpg?cropped=true&frame_id='+encodeURIComponent(window.rigFrameId)+(window.zoomPreviewImage===el('crop-preview')?'&quality=high':'')+'&t='+Date.now();},1000);
 presence();setInterval(presence,5000);
})();
