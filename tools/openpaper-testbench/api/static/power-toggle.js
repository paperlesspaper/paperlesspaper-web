'use strict';
function nextPowerState(relay){return relay?.error?true:relay?.commanded_power!==true;}
function renderPowerToggle(relay,pending=false){
 const button=document.querySelector('#power-toggle');
 const known=relay?.available&&!relay.error&&typeof relay.commanded_power==='boolean';
 const on=known&&relay.commanded_power;
 button.dataset.power=known?(on?'on':'off'):'unknown';
 button.disabled=pending||!relay?.available||relay.busy;
 button.setAttribute('aria-busy',pending||relay?.busy?'true':'false');
 if(known){button.setAttribute('role','switch');button.setAttribute('aria-checked',String(on));}
 else{button.removeAttribute('role');button.removeAttribute('aria-checked');}
 document.querySelector('#power-value').textContent=known?(on?'An':'Aus'):'Unbekannt';
 document.querySelector('#power-hint').textContent=relay?.busy?'Reset läuft …':pending?'Bitte warten …':!relay?.available?'Relais nicht verbunden':`Tippen: ${on?'ausschalten':'einschalten'}`;
 button.setAttribute('aria-label',known?`Strom, letzter Befehl ${on?'an':'aus'}. ${on?'Ausschalten':'Einschalten'}`:'Strom einschalten; Zustand unbekannt');
}
