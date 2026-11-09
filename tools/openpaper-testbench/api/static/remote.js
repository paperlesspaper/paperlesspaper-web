const $=s=>document.querySelector(s);
let state, busy=false, photoPending=false, pollPending=false, noticeTimer;
let viewerMode='live',viewerCropped=false,viewerOpener=null;
async function api(path,body){
 const requestedFrame=window.rigFrameId;await window.rigReady;
 const scoped=/^(status|camera\/|photos(?:\?|$)|power$|reset$|serial(?:[.?]|$)|reference$|analyze$)/.test(path);
 const targetFrame=requestedFrame||window.rigFrameId;
 if(window.rigPage==='detail'&&/^(status$|photos(?:\?|$))/.test(path))path+=(path.includes('?')?'&':'?')+'detail=true';
 else if(scoped&&targetFrame)path+=(path.includes('?')?'&':'?')+'frame_id='+encodeURIComponent(targetFrame);
 const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Testbench':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(r.status===401){location.replace('/login.html?next='+encodeURIComponent(location.pathname+location.search));throw Error('Anmeldung erforderlich');}
 const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Ungültige Eingabe. Werte prüfen.');return data;
}
function notify(message){$('#notice').textContent=message;$('#notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').hidden=true,6000);}
function setButtons(){$('#frame-select').disabled=busy||!!window.cameraEditBusy;document.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||!state);document.querySelectorAll('.relay-action').forEach(b=>b.disabled=busy||!state?.relay?.available||state?.relay?.busy);$('#reset-six').disabled ||= !$('#confirm-reset').checked;$('#compare').disabled ||= !state?.reference_available;$('#photo').disabled=busy||!state?.camera?.connected;renderPowerToggle(state?.relay,busy);}
function rows(entries){const dl=$('#status-list');dl.replaceChildren();for(const [k,v]of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v??'—';dl.append(dt,dd);}}
async function refresh(){await window.rigReady;if(pollPending)return;pollPending=true;try{
 const frame=window.rigFrameId;const result=await api('status');if(frame!==window.rigFrameId)return;state=result;$('#connection').textContent=state.demo?'Demo':'Online';const r=state.relay;
 $('#relay-badge').textContent=r.available?'USB bereit':'Nicht verbunden';
 $('#relay-state').textContent=r.busy?`Reset läuft: ${r.completed}/${r.total}`:r.error|| (r.commanded_power===null?'Stromzustand unbekannt':`Letzter Befehl: Strom ${r.commanded_power?'an':'aus'}`);
 $('#page-camera-state').textContent=state.camera.connected?'Kamera verbunden':state.camera.paused?'Kamera pausiert':'Kamera nicht verbunden';
 $('#page-camera-state').classList.toggle('is-online',!!state.camera.connected);
 $('#camera-info').textContent=state.camera.connected?`${(window.rigPage!=='detail'&&[90,270].includes(window.rigRotation)?[...state.camera.resolution].reverse():state.camera.resolution).join(' × ')} · Aufnahmeauflösung`:state.camera.paused?'Kamera pausiert':'Kamera nicht verbunden';
 $('#temperature').textContent=state.temperature_c===null?'—':state.temperature_c.toFixed(1)+' °C';
 $('#reference-state').textContent=state.reference_available?'Referenz gespeichert':'Keine Referenz';
 rows([['Modell',state.model],['Laufzeit',Math.floor(state.uptime_seconds/60)+' min'],['Versorgung Pi',state.power.undervoltage===true?'Unterspannung':state.power.undervoltage===false?'OK':'Unbekannt'],['Speicher frei',state.storage_free_mb+' MB'],['Relais',r.device||'Nicht verbunden'],['Serial',state.serial.connected?state.serial.device+' · '+state.serial.baudrate+' Baud':'Nicht verbunden'],['Letzte UART-Daten',state.serial.last_received?new Date(state.serial.last_received).toLocaleTimeString():'Noch keine'],['GPIO-Taster',state.button.available?'Bereit':'Nicht angeschlossen'],['Netzwerk',state.network_urls.join(', ')]]);
 $('#raw-status').textContent=JSON.stringify(state,null,2);setButtons();
 }catch(e){state=null;$('#connection').textContent='Offline';setButtons();}finally{pollPending=false;}}
async function action(fn){if(busy)return;busy=true;setButtons();try{await fn();}catch(e){notify(e.message);}finally{busy=false;await refresh();setButtons();}}
$('#power-toggle').onclick=()=>action(async()=>{const on=nextPowerState(state?.relay);state.relay=await api('power',{on});renderPowerToggle(state.relay,true);$('#control-result').textContent=`Strom-${on?'an':'aus'}-Befehl gesendet.`;});
$('#restart').onclick=()=>action(async()=>{$('#control-result').textContent='Reset-Impuls läuft …';await api('reset',{count:1});$('#control-result').textContent='250-ms-Impuls gesendet; Neustart im Serial-Log prüfen.';});
$('#confirm-reset').onchange=setButtons;
$('#reset-six').onclick=()=>action(async()=>{$('#control-result').textContent='6× Reset läuft …';await api('reset',{count:6,confirm_data_loss:true});$('#confirm-reset').checked=false;$('#control-result').textContent='6 Stromzyklen abgeschlossen. Ergebnis im Serial-Log prüfen.';});
$('#photo').onclick=()=>action(async()=>{const p=await api('photos'+(window.rigCropped?'?cropped=true':''),{});$('#latest-photo').href=p.url;$('#latest-photo').hidden=false;notify('Foto gespeichert · '+p.resolution.join(' × ')+' · maximale JPEG-Qualität');});
$('#save-reference').onclick=()=>action(async()=>{await api('reference',{});$('#analysis').textContent='Referenz für diesen Rahmen gespeichert.';});
$('#compare').onclick=()=>action(async()=>{const r=await api('analyze',{});$('#analysis').textContent=(r.matches_reference?'Bild stimmt überein':'Bild weicht ab')+'\nMittlere Abweichung: '+(r.mean_difference*100).toFixed(2)+' %\nVeränderte Pixel: '+(r.changed_pixel_fraction*100).toFixed(2)+' %\nHelligkeit: '+r.brightness.toFixed(1)+' / 255';});
async function refreshImage(){
 await window.rigReady;
 const large=$('#camera-large').open;
 if(window.rigPage==='settings'||photoPending||document.hidden||(large&&viewerMode==='photo'))return;
 photoPending=true;
 const cropped=large?viewerCropped:window.rigCropped;
 const high=large||$('#calibrate').checked||$('#camera-high-quality').checked||window.zoomPreviewImage===$('#camera-image');
 $(large?'#camera-large-image':'#camera-image').src='/api/camera.jpg?'+(window.rigPage==='detail'?'detail=true':'frame_id='+encodeURIComponent(window.rigFrameId))+(cropped?'&cropped=true':'')+(high?'&quality=high':'')+'&t='+Date.now();
}
$('#camera-image').onload=()=>{photoPending=false;$('#camera-error').hidden=true;$('#live-frame-time').textContent='Live · '+new Date().toLocaleTimeString();};$('#camera-image').onerror=()=>{photoPending=false;$('#camera-error').hidden=false;$('#live-frame-time').textContent='Kein aktuelles Bild';};
let serialCursor=0,serialSession=null,serialLines=[],serialPaused=false,serialPending=false;
function renderLog(){const filter=$('#log-filter').value.toLowerCase(),lines=serialLines.filter(l=>l.toLowerCase().includes(filter));$('#serial-output').textContent=lines.join('\n')||'Noch keine passende Ausgabe.';$('#log-count').textContent=lines.length+' / '+serialLines.length+' Zeilen';if($('#autoscroll').checked)$('#serial-output').scrollTop=$('#serial-output').scrollHeight;}
$('#serial-panel').addEventListener('toggle',()=>{if($('#serial-panel').open)refreshSerial();});
$('#log-filter').oninput=renderLog;$('#autoscroll').onchange=renderLog;
$('#pause-log').onclick=()=>{serialPaused=!serialPaused;$('#pause-log').textContent=serialPaused?'Weiter':'Pause';if(!serialPaused)refreshSerial();};
async function refreshSerial(){await window.rigReady;if(window.rigPage!=='camera'||!$('#serial-panel').open||serialPaused||serialPending||document.hidden)return;serialPending=true;try{const frame=window.rigFrameId;let r=await api('serial?after='+serialCursor+'&limit=1000');if(frame!==window.rigFrameId)return;if(serialSession!==r.session){serialCursor=0;serialLines=[];serialSession=r.session;r=await api('serial?limit=1000');}if(r.truncated)serialLines.push('… Puffer überlaufen: ältere Zeilen fehlen …');for(const l of r.lines)serialLines.push(l.at+'  '+l.text);serialLines=serialLines.slice(-2000);serialCursor=r.next_cursor;$('#serial-info').textContent=r.status.connected?`${r.status.device} · ${r.status.baudrate} Baud · nur lesen`:r.status.error||'USB-UART nicht verbunden';if(r.lines.length||!serialLines.length)renderLog();}catch(e){$('#serial-info').textContent='Serial nicht erreichbar';}finally{serialPending=false;}}
window.rigReady.then(()=>{document.querySelector('a[download]').href='/api/serial.txt?frame_id='+encodeURIComponent(window.rigFrameId);});
setButtons();refresh();refreshSerial();refreshImage();setInterval(refresh,3000);setInterval(refreshSerial,1000);setInterval(refreshImage,500);

$('#logout').onclick=async()=>{try{await window.releaseLight();await api('logout',{});location.replace('/login.html');}catch(e){notify(e.message);}};

window.addEventListener('rig-frame-changed',()=>{state=null;serialCursor=0;serialSession=null;serialLines=[];photoPending=false;$('#latest-photo').hidden=true;$('#analysis').textContent='Referenz und Vergleich gehören zum ausgewählten Rahmen.';$('#control-result').textContent='';$('#confirm-reset').checked=false;document.querySelector('a[download]').href='/api/serial.txt?frame_id='+encodeURIComponent(window.rigFrameId);setButtons();refresh();refreshImage();renderLog();refreshSerial();});

window.addEventListener('rig-view-changed',()=>{photoPending=false;$('#live-frame-time').textContent='Lade Livebild …';refreshImage();});

$('#camera-high-quality').onchange=()=>{photoPending=false;$('#live-frame-time').textContent='Lade Livebild …';refreshImage();};

// Live and saved photos share one viewer. Photo viewing pauses the live poll.
const largeCamera=$('#camera-large');
const imageZoom=createZoomViewport({viewport:$('#zoom-viewport'),image:$('#camera-large-image'),onChange:({zoom,native,max})=>{
 $('#zoom-level').textContent=zoom.toLocaleString('de-DE',{maximumFractionDigits:1})+'×';
 $('#zoom-out').disabled=zoom<=1.001;$('#zoom-in').disabled=zoom>=max-.001;
 $('#zoom-native').setAttribute('aria-pressed',String(Math.abs(zoom-native)<.01));
}});
const previewZooms=[];
function openImageViewer({mode='live',url=null,point=null,cropped=window.rigCropped,title=null}={}){
 previewZooms.forEach(p=>p.hide());viewerMode=mode;viewerCropped=cropped;viewerOpener=document.activeElement;
 $('#camera-large-title').textContent=title||$('#page-title').textContent+(cropped?' · Displayausschnitt':' · Livebild');
 $('#camera-large-status').textContent=mode==='photo'?'Lade Foto in voller Auflösung …':'Lade Livebild in voller Auflösung …';
 const download=$('#zoom-download');download.hidden=mode!=='photo';
 if(url)download.href=url;else download.removeAttribute('href');
 $('#camera-large-image').removeAttribute('src');
 $('#camera-large-image').alt=mode==='photo'?'Gespeichertes Foto mit Zoom':'Livebild mit Zoom';
 largeCamera.showModal();document.body.classList.add('camera-large-open');
 imageZoom.reset(point||{x:.5,y:.5},point?2:1,true);
 photoPending=false;
 if(mode==='photo')$('#camera-large-image').src=url;else refreshImage();
}
$('#camera-enlarge').onclick=()=>openImageViewer();
$('#camera-large-close').onclick=()=>largeCamera.close();
$('#zoom-in').onclick=imageZoom.zoomIn;$('#zoom-out').onclick=imageZoom.zoomOut;
$('#zoom-fit').onclick=()=>imageZoom.reset();$('#zoom-native').onclick=imageZoom.native;
largeCamera.addEventListener('close',()=>{
 document.body.classList.remove('camera-large-open');$('#camera-large-image').removeAttribute('src');
 imageZoom.reset();viewerMode='live';photoPending=false;refreshImage();
 if(viewerOpener?.isConnected)viewerOpener.focus({preventScroll:true});
});
$('#camera-large-image').onload=()=>{
 photoPending=false;const image=$('#camera-large-image');
 $('#camera-large-status').textContent=`${image.naturalWidth} × ${image.naturalHeight} · `+(viewerMode==='photo'?'JPEG · volle Auflösung':'Live · '+new Date().toLocaleTimeString());
};
$('#camera-large-image').onerror=()=>{
 photoPending=false;
 if(largeCamera.open)$('#camera-large-status').textContent=viewerMode==='photo'?'Foto nicht verfügbar. Bitte erneut öffnen.':'Kein aktuelles Kamerabild – Verbindung wird erneut geprüft';
};
for(const [id,cropped] of [['camera-image',null],['crop-preview',true]]){
 const image=$('#'+id);
 previewZooms.push(createHoverZoom({image,enabled:()=>!window.graySelecting&&!$('#calibrate').checked&&!largeCamera.open,hoverEnabled:()=>$('#zoom-hover').checked,
  onOpen:point=>openImageViewer({point,cropped:cropped??window.rigCropped}),
  onActivity:active=>{if(active)window.zoomPreviewImage=image;else if(window.zoomPreviewImage===image)window.zoomPreviewImage=null;}
 }));
}
for(const id of ['calibrate','zoom-hover'])$('#'+id).addEventListener('change',()=>previewZooms.forEach(p=>p.hide()));
window.addEventListener('rig-view-changed',()=>previewZooms.forEach(p=>p.hide()));
window.addEventListener('rig-frame-changed',()=>{previewZooms.forEach(p=>p.hide());if(largeCamera.open)largeCamera.close();});
for(const id of ['latest-photo','night-result'])$('#'+id).addEventListener('click',e=>{
 if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;
 const url=new URL(e.currentTarget.href,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/photos/'))return;
 e.preventDefault();openImageViewer({mode:'photo',url:url.pathname+url.search,title:id==='night-result'?'Nachtfoto':'Foto'});
});
