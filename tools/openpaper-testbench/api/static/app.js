const $ = s => document.querySelector(s);
let view = 'home', state, timer, busy = false, imagePending = false;
function toast(text) { $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(timer); timer = setTimeout(() => $('#toast').hidden = true, 4500); }
async function api(path, body) {
  const response = await fetch('/api/' + path, {method:body === undefined ? 'GET' : 'POST', headers: {'Content-Type':'application/json','X-Testbench':'1'}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
  if(response.status === 401) { location.replace('/login.html'); throw Error('Anmeldung erforderlich'); }
  const data = await response.json();
  if(!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'Ungültige Eingabe. Bildausschnitt und Werte prüfen.');
  return data;
}
const pages = {home:'Übersicht', camera:'Webcam', status:'Status', compare:'Bildvergleich', region:'Bildausschnitt', control:'Steuerung', serial:'Serial', 'reset-confirm':'Reset 6×'};
const parentPage = () => view === 'reset-confirm' ? 'control' : view === 'region' ? 'compare' : view === 'compare' ? 'camera' : 'home';
function navigate(next, focus = true) {
  view = Object.hasOwn(pages, next) ? next : 'home';
  document.querySelectorAll('.view').forEach(e => e.hidden = e.id !== view);
  document.body.dataset.page = view;
  $('#page-title').textContent = pages[view];
  document.title = pages[view] + ' · OpenPaper';
  $('#back').hidden = view === 'home';
  $('#back').setAttribute('aria-label', 'Zurück zu ' + pages[parentPage()]);
  window.scrollTo(0, 0);
  if (focus) $('#page-title').focus({preventScroll:true});
  if (view === 'camera') refreshImage();
  if (view === 'serial') refreshSerial();
}
document.querySelectorAll('[data-view]').forEach(e => e.onclick = () => {location.hash = e.dataset.view;});
$('#back').onclick = () => {location.hash = parentPage();};
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
function rows(target, entries) { const dl=$(target); dl.replaceChildren(); for(const [label,value] of entries) { const dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=label; dd.textContent=value ?? '—'; dl.append(dt,dd); } }
async function refresh() {
  try {
    state=await api('status');
    $('#connection').textContent=state.demo?'Demo-Modus':'Online';
    document.querySelectorAll('.press-button').forEach(b => b.disabled=busy || !state.button.available);
    $('#analyze').disabled=!state.reference_available;
    document.querySelectorAll('.relay-action').forEach(b => b.disabled=busy || state.relay?.busy || !state.relay?.available);
    const r=state.relay;
    renderPowerToggle(r,busy);
    $('#relay-state').textContent=r?.busy ? `Reset läuft: ${r.completed}/${r.total}` : !r?.available ? 'Relais nicht verbunden' : r.error ? 'Relaisfehler – erneut versuchen' : r.commanded_power === null ? 'Relais bereit · Stromzustand unbekannt' : `Letzter Befehl: Strom ${r.commanded_power?'an':'aus'} · ohne Rückmeldung`;

    rows('#status-summary',[
      ['Kamera',state.camera.connected?'Bereit':'Nicht verbunden'],
      ['Strom',state.power?.undervoltage === true ? 'Unterspannung' : state.power?.undervoltage === false ? 'OK' : 'Unbekannt'],
      ['Knopf',state.button.available?'Bereit':state.button.enabled?'GPIO-Fehler':'Nicht angeschlossen'],
      ['Temperatur',state.temperature_c === null ? '—' : Math.round(state.temperature_c)+' °C']
    ]);
    $('#network-url').textContent=state.network_urls?.[0] || location.origin;
  } catch(e) {state=null;renderPowerToggle(null,true);$('#connection').textContent='Offline';rows('#status-summary',[['Kamera','Unbekannt'],['Strom','Unbekannt'],['Knopf','Nicht verfügbar'],['Verbindung','Offline']]);document.querySelectorAll('.press-button,.relay-action').forEach(b=>b.disabled=true);}
}
function refreshImage(){ if(view!=='camera'||imagePending)return; imagePending=true; $('#live').src='/api/camera.jpg?t='+Date.now(); }
$('#live').onload=()=>{imagePending=false;$('#camera-error').hidden=true;};
$('#live').onerror=()=>{imagePending=false;$('#camera-error').hidden=false;$('#camera-error').textContent='Kein Kamerabild. USB-Webcam anschließen oder Status prüfen.';};
async function action(fn) { if(busy)return; busy=true; document.querySelectorAll('.actions button,.press-button,.relay-action').forEach(b=>b.disabled=true); try{await fn();}catch(e){toast(e.message);}finally{busy=false;document.querySelectorAll('.actions button').forEach(b=>b.disabled=false);await refresh();} }
document.querySelectorAll('.press-button').forEach(b=>b.onclick=()=>action(async()=>{const result=await api('button/press',{duration_ms:250});toast(result.demo?'Demo: Tastendruck simuliert':'Knopf für 250 ms gedrückt');}));
$('#take-photo').onclick=()=>action(async()=>{await api('photos',{});toast('Foto gespeichert');});
$('#save-reference').onclick=()=>action(async()=>{await api('reference',{region:{x:Number($('#roi-x').value)/100,y:Number($('#roi-y').value)/100,width:Number($('#roi-w').value)/100,height:Number($('#roi-h').value)/100}});$('#analysis-result').textContent='Referenz gespeichert. Bereit zum Vergleichen.';toast('Referenz gespeichert');});
$('#analyze').onclick=()=>action(async()=>{const r=await api('analyze',{});$('#analysis-result').textContent=(r.matches_reference?'Bild stimmt überein.':'Bild weicht ab.')+'\nAbweichung: '+(r.mean_difference*100).toFixed(1)+' %';$('#analysis-result').hidden=false;});
$('#power-toggle').onclick=()=>action(async()=>{const on=nextPowerState(state?.relay);state.relay=await api('power',{on});renderPowerToggle(state.relay,true);toast(`Strom-${on?'an':'aus'}-Befehl gesendet`);});
$('#reset-once').onclick=()=>action(async()=>{await api('reset',{count:1});toast('250-ms-Impuls gesendet');});
$('#reset-six').onclick=()=>action(async()=>{location.hash='control';await api('reset',{count:6,confirm_data_loss:true});toast('6 Stromzyklen abgeschlossen');});
let serialCursor=0, serialSession=null, serialLines=[], serialPaused=false, serialPending=false;
$('#serial-pause').onclick=()=>{serialPaused=!serialPaused;$('#serial-pause').textContent=serialPaused?'Weiter':'Pause';if(!serialPaused)refreshSerial();};
async function refreshSerial(){
  if(view!=='serial'||serialPaused||serialPending)return;
  serialPending=true;
  try{
    let result=await api('serial?after='+serialCursor+'&limit=500');
    if(serialSession!==result.session){serialCursor=0;serialLines=[];serialSession=result.session;result=await api('serial?limit=500');}
    if(result.truncated)serialLines.push('… ältere Zeilen nicht mehr im Puffer …');
    for(const line of result.lines)serialLines.push(line.at.slice(11,19)+' '+line.text);
    serialLines=serialLines.slice(-1000);serialCursor=result.next_cursor;
    const status=result.status;
    $('#serial-state').textContent=status.connected?'Verbunden · '+status.baudrate+' Baud':'USB-UART nicht verbunden';
    const log=$('#serial-log'), atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;
    if(result.lines.length||!serialLines.length){log.textContent=serialLines.join('\n')||'Verbunden? Bei Neustart erscheinen hier Boot-Logs.';if(atBottom)log.scrollTop=log.scrollHeight;}
  }catch(e){$('#serial-state').textContent='Serial nicht erreichbar';}finally{serialPending=false;}
}
setInterval(refreshSerial,1000);
navigate(location.hash.slice(1) || 'home', false);
refresh();setInterval(refresh,3000);setInterval(refreshImage,500);
