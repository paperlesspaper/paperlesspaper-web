'use strict';
// Balena's proxy does not identify the original protocol to the backend.
// Never reveal a login form or submit a password over its public HTTP URL.
if(location.hostname.endsWith('.balena-devices.com') && location.protocol!=='https:'){
  location.replace('https://'+location.host+'/login.html'+location.search);
}else{
const returnToPage=()=>{
 const target=new URL(new URLSearchParams(location.search).get('next')||'/',location.origin);
 location.replace(target.origin===location.origin?target.pathname+target.search+target.hash:'/');
};
// Also recovers existing Strict cookies after an external link redirected here.
fetch('/api/session',{cache:'no-store'}).then(response=>{
 if(response.ok)returnToPage();
}).catch(()=>{});
document.querySelector('#login-form').hidden=false;
document.querySelector('#login-form').onsubmit=async event=>{
  event.preventDefault();
  const button=event.currentTarget.querySelector('button');
  const error=document.querySelector('#error');
  button.disabled=true;error.textContent='';
  try{
    const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Testbench':'1'},body:JSON.stringify({password:document.querySelector('#password').value,remember:document.querySelector('#remember').checked})});
    if(!response.ok){const data=await response.json();throw Error(typeof data.detail==='string'?data.detail:'Anmeldung nicht möglich');}
    document.querySelector('#password').value='';
    returnToPage();
  }catch(e){error.textContent=e.message||'Verbindung fehlgeschlagen';button.disabled=false;}
};
}
