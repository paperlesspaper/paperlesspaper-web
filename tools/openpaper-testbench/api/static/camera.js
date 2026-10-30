'use strict';
let nativeControls=[], nightSupported=false, cameraEditing=false, nightActive=false, nightPending=false, lastNightState='idle';
function exposureAvailability(){
 const mode=document.querySelector('[data-native="auto_exposure"]');
 const manual=!mode||mode.value==='1';
 document.querySelectorAll('[data-exposure]').forEach(el=>el.disabled=!manual);
}
function renderCameraControls(data){
 nativeControls=data.controls;nightSupported=data.night_supported;
 const parent=$('#camera-controls');parent.replaceChildren();
 for(const c of nativeControls){
  const row=document.createElement('div');row.className='native-control';
  const label=document.createElement('label');label.htmlFor='native-'+c.name;label.textContent=c.label;
  const exposure=c.name==='exposure_time_absolute', scale=exposure?10:1;
  let input;
  if(c.type==='menu'||c.type==='bool'){
   input=document.createElement('select');
   const choices=c.type==='bool'?{'0':'Aus','1':'An'}:c.choices;
   for(const [value,title]of Object.entries(choices)){const o=document.createElement('option');o.value=value;o.textContent=c.name==='auto_exposure'?(value==='1'?'Manuell':value==='3'?'Automatisch':title):title;input.append(o);}
   input.value=String(c.value);row.append(label,input);
  }else{
   const wrap=document.createElement('div');wrap.className='control-inputs';
   input=document.createElement('input');input.type='number';
   const slider=document.createElement('input');slider.type='range';slider.setAttribute('aria-label',c.label);
   for(const el of [input,slider]){el.min=c.min/scale;el.max=c.max/scale;el.step=c.step/scale;el.value=c.value/scale;if(exposure)el.dataset.exposure='1';}
   slider.oninput=()=>{input.value=slider.value;};input.oninput=()=>{slider.value=input.value;};
   const hint=document.createElement('span');hint.className='control-hint';hint.textContent=`${c.min/scale}–${c.max/scale}${exposure?' ms':''}`;
   wrap.append(slider,input);row.append(label,wrap,hint);
  }
  input.id='native-'+c.name;input.dataset.native=c.name;
  input.disabled=c.read_only;
  if(c.name==='auto_exposure')input.onchange=exposureAvailability;
  parent.append(row);
 }
 $('#camera-controls-info').textContent=data.max_exposure_ms?`Treibergrenze: ${data.max_exposure_ms} ms pro Einzelbild · tatsächliche Zeit ggf. durch Bildrate begrenzt`:'Native Einstellungen';
 $('#camera-night-profile').disabled=!data.night_supported;
 $('#night-start').disabled=!data.night_supported||nightActive;
 exposureAvailability();
}
async function loadCameraControls(){
 try{renderCameraControls(await api('camera/controls'));}
 catch(e){$('#camera-controls-info').textContent=e.message;}
}
async function editCamera(fn){
 if(cameraEditing||nightActive)return;
 cameraEditing=true;$('#camera-settings').disabled=true;
 try{renderCameraControls(await fn());notify('Kameraeinstellungen übernommen');}
 catch(e){notify(e.message);await loadCameraControls();}
 finally{cameraEditing=false;$('#camera-settings').disabled=nightActive;}
}
$('#camera-reload').onclick=loadCameraControls;
$('#camera-apply').onclick=()=>editCamera(async()=>{
 const values={};
 for(const c of nativeControls){
  const input=document.querySelector(`[data-native="${c.name}"]`);
  // The enclosing fieldset is disabled while saving; check only the control's own state.
  if(c.read_only||input.disabled)continue;
  if(input.value==='')throw Error('Wert fehlt für '+c.label);
  const value=Number(input.value)*(c.name==='exposure_time_absolute'?10:1);
  if(!Number.isFinite(value)||Math.abs(value-Math.round(value))>.00001)throw Error('Ungültiger Wert für '+c.label);
  values[c.name]=Math.round(value);
 }
 return api('camera/controls',{values});
});
$('#camera-restore').onclick=()=>editCamera(()=>api('camera/restore',{}));
$('#camera-night-profile').onclick=()=>editCamera(()=>api('camera/night-profile',{}));
function renderNight(job){
 nightActive=['starting','settling','capturing','restoring'].includes(job.status);
 $('#camera-settings').disabled=nightActive||cameraEditing;
 $('#camera-reload').disabled=nightActive;
 $('#night-start').disabled=nightActive||!nightSupported;
 $('#night-seconds').disabled=nightActive;
 $('#night-cancel').hidden=!nightActive;
 const labels={idle:'Bereit.',starting:'Nachtaufnahme startet …',settling:'Kamera auf Nachtbelichtung einstellen …',capturing:`Sammle Bilder: ${job.elapsed_seconds||0} / ${job.seconds} s · ${job.frames||0} Bilder`,restoring:'Kameraeinstellungen wiederherstellen …',complete:`Nachtfoto fertig · ${job.frames} Bilder gemittelt · native Belichtung auf ${job.native_exposure_ms} ms gesetzt`,cancelled:'Aufnahme abgebrochen; Einstellungen wiederhergestellt.',failed:job.error||'Aufnahme fehlgeschlagen'};
 $('#night-status').textContent=labels[job.status]||job.status;
 $('#night-result').hidden=!job.result;
 if(job.result)$('#night-result').href=job.result.url;
 if(lastNightState!==job.status&&!nightActive&&lastNightState!=='idle')loadCameraControls();
 lastNightState=job.status;
}
async function refreshNight(){if(nightPending)return;nightPending=true;try{renderNight(await api('camera/night'));}catch(e){$('#night-status').textContent=e.message;}finally{nightPending=false;}}
$('#night-start').onclick=async()=>{if(nightActive)return;$('#night-start').disabled=true;try{renderNight(await api('camera/night',{seconds:Number($('#night-seconds').value)}));}catch(e){notify(e.message);await refreshNight();}};
$('#night-cancel').onclick=async()=>{try{renderNight(await api('camera/night/cancel',{}));}catch(e){notify(e.message);}};
loadCameraControls();refreshNight();setInterval(refreshNight,1000);
