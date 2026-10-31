const $=s=>document.querySelector(s);
let state, busy=false, photoPending=false, pollPending=false, noticeTimer;
async function api(path,body){
 const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Testbench':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(r.status===401){location.replace('/login.html');throw Error('Anmeldung erforderlich');}
 const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:'Ungültige Eingabe. Werte prüfen.');return data;
}
function notify(message){$('#notice').textContent=message;$('#notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').hidden=true,6000);}
function setButtons(){document.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||!state);document.querySelectorAll('.relay-action').forEach(b=>b.disabled=busy||!state?.relay?.available||state?.relay?.busy);$('#reset-six').disabled ||= !$('#confirm-reset').checked;$('#compare').disabled ||= !state?.reference_available;renderPowerToggle(state?.relay,busy);}
function rows(entries){const dl=$('#status-list');dl.replaceChildren();for(const [k,v]of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v??'—';dl.append(dt,dd);}}
async function refresh(){if(pollPending)return;pollPending=true;try{
 state=await api('status');$('#connection').textContent=state.demo?'Demo':'Online';const r=state.relay;
 $('#relay-badge').textContent=r.available?'USB bereit':'Nicht verbunden';
 $('#relay-state').textContent=r.busy?`Reset läuft: ${r.completed}/${r.total}`:r.error|| (r.commanded_power===null?'Stromzustand unbekannt':`Letzter Befehl: Strom ${r.commanded_power?'an':'aus'}`);
 $('#camera-info').textContent=state.camera.connected?`${state.camera.resolution.join(' × ')} · ${state.camera.device}`:'Kamera nicht verbunden';
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
$('#photo').onclick=()=>action(async()=>{const p=await api('photos',{});$('#latest-photo').href=p.url;$('#latest-photo').hidden=false;notify('Foto gespeichert');});
$('#save-reference').onclick=()=>action(async()=>{await api('reference',{region:{x:Number($('#roi-x').value)/100,y:Number($('#roi-y').value)/100,width:Number($('#roi-w').value)/100,height:Number($('#roi-h').value)/100}});$('#analysis').textContent='Referenz gespeichert. Bereit zum Vergleichen.';});
$('#compare').onclick=()=>action(async()=>{const r=await api('analyze',{});$('#analysis').textContent=(r.matches_reference?'Bild stimmt überein':'Bild weicht ab')+'\nMittlere Abweichung: '+(r.mean_difference*100).toFixed(2)+' %\nVeränderte Pixel: '+(r.changed_pixel_fraction*100).toFixed(2)+' %\nHelligkeit: '+r.brightness.toFixed(1)+' / 255';});
function refreshImage(){if(photoPending||document.hidden)return;photoPending=true;$('#camera-image').src='/api/camera.jpg?t='+Date.now();}
$('#camera-image').onload=()=>{photoPending=false;$('#camera-error').hidden=true;};$('#camera-image').onerror=()=>{photoPending=false;$('#camera-error').hidden=false;};
let serialCursor=0,serialSession=null,serialLines=[],serialPaused=false,serialPending=false;
function renderLog(){const filter=$('#log-filter').value.toLowerCase(),lines=serialLines.filter(l=>l.toLowerCase().includes(filter));$('#serial-output').textContent=lines.join('\n')||'Noch keine passende Ausgabe.';$('#log-count').textContent=lines.length+' / '+serialLines.length+' Zeilen';if($('#autoscroll').checked)$('#serial-output').scrollTop=$('#serial-output').scrollHeight;}
$('#log-filter').oninput=renderLog;$('#autoscroll').onchange=renderLog;
$('#pause-log').onclick=()=>{serialPaused=!serialPaused;$('#pause-log').textContent=serialPaused?'Weiter':'Pause';if(!serialPaused)refreshSerial();};
async function refreshSerial(){if(serialPaused||serialPending)return;serialPending=true;try{let r=await api('serial?after='+serialCursor+'&limit=1000');if(serialSession!==r.session){serialCursor=0;serialLines=[];serialSession=r.session;r=await api('serial?limit=1000');}if(r.truncated)serialLines.push('… Puffer überlaufen: ältere Zeilen fehlen …');for(const l of r.lines)serialLines.push(l.at+'  '+l.text);serialLines=serialLines.slice(-2000);serialCursor=r.next_cursor;$('#serial-info').textContent=r.status.connected?`${r.status.device} · ${r.status.baudrate} Baud · nur lesen`:r.status.error||'USB-UART nicht verbunden';if(r.lines.length||!serialLines.length)renderLog();}catch(e){$('#serial-info').textContent='Serial nicht erreichbar';}finally{serialPending=false;}}
setButtons();refresh();refreshSerial();refreshImage();setInterval(refresh,3000);setInterval(refreshSerial,1000);setInterval(refreshImage,500);

$('#logout').onclick=async()=>{try{await api('logout',{});location.replace('/login.html');}catch(e){notify(e.message);}};
