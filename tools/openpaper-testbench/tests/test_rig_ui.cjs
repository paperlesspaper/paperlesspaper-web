const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../api/static');
async function setup(t,{blockedDiscovery=false,blockedLight=false}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'http://localhost/settings',runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const w=dom.window,el=id=>w.document.getElementById(id),writes=[];
 let rejectSave=false,offline=false;
 let config={revision:0,frames:[1,2].map(i=>({id:'frame-'+i,name:'epd'+i+'-123456abcdef',camera:'camera-'+i,rotation:0,relay:null,serial:null,corners:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]})),detail_camera:null,light_device:null};
 w.structuredClone=structuredClone;w.setInterval=()=>0;w.IntersectionObserver=class{observe(){}};
 w.createCornerEditor=()=>({render(){}});
 w.fetch=async(url,opts)=>{
  if((url==='/api/devices'&&blockedDiscovery)||(url==='/api/light'&&blockedLight))return new Promise((resolve,reject)=>{
   opts.signal.addEventListener('abort',()=>reject(new w.DOMException('aborted','AbortError')));
  });
  let data={};let ok=true;
  if(url==='/api/rig'){
   if(opts.method==='POST'){
    writes.push(JSON.parse(opts.body));
    if(rejectSave){ok=false;data={detail:'Konflikt'};}
    else{config=JSON.parse(opts.body);config.revision++;data=config;}
   }else data=config;
  }else if(url==='/api/devices')data={cameras:offline?[]:[1,2,3].map(i=>({id:'camera-'+i,name:'USB Camera',device:'/dev/video'+i})),ports:[]};
  return {ok,status:ok?200:409,json:async()=>structuredClone(data)};
 };
 vm.runInContext(fs.readFileSync(path.join(dir,'rig.js'),'utf8'),dom.getInternalVMContext());await w.rigReady;
 await new Promise(resolve=>setImmediate(resolve));
 const edit=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new w.Event(id==='frame-name'?'input':'change'));};
 return {w,el,writes,edit,reject:()=>{rejectSave=true;},unplug:()=>{offline=true;}};
}
test('discovery preserves unsaved camera/name and disconnected assignments',async t=>{
 const {el,writes,edit,unplug}=await setup(t);
 edit('frame-camera','camera-3');edit('frame-name','epd7-58e6c5eb0a48');unplug();
 await el('rig-reload').onclick();
 assert.equal(el('frame-camera').value,'camera-3');assert.equal(el('frame-name').value,'epd7-58e6c5eb0a48');
 assert.match(el('frame-camera').selectedOptions[0].textContent,/Nicht verbunden/);
 await el('rig-save').onclick();assert.equal(writes[0].frames[0].camera,'camera-3');
 assert.equal(writes[0].frames[0].name,'epd7-58e6c5eb0a48');
});
test('blocked discovery and lamp do not hide saved settings or block navigation',async t=>{
 const {w,el}=await setup(t,{blockedDiscovery:true,blockedLight:true});
 assert.equal(w.document.body.dataset.page,'settings');
 assert.match(el('camera-nav').textContent,/epd1-123456abcdef/);
 assert.equal(el('frame-camera').value,'camera-1');
 assert.equal(el('frame-name').value,'epd1-123456abcdef');
 assert.equal(el('rig-save').disabled,false);
 el('frame-select').value='frame-2';await el('frame-select').onchange();
 assert.equal(w.rigFrameId,'frame-2');
 assert.equal(el('frame-camera').value,'camera-2');
});
test('switching frames saves first and shows EPD names throughout navigation',async t=>{
 const {w,el,writes,edit}=await setup(t);
 assert.match(el('camera-nav').textContent,/epd1-123456abcdef/);
 edit('frame-camera','camera-3');el('frame-select').value='frame-2';await el('frame-select').onchange();
 assert.equal(writes[0].frames[0].camera,'camera-3');assert.equal(w.rigFrameId,'frame-2');
 el('frame-select').value='frame-1';await el('frame-select').onchange();assert.equal(el('frame-camera').value,'camera-3');
});
test('failed save keeps current frame and pending input; navigation warns',async t=>{
 const {w,el,edit,reject}=await setup(t);reject();edit('frame-camera','camera-3');
 el('frame-select').value='frame-2';await el('frame-select').onchange();
 assert.equal(w.rigFrameId,'frame-1');assert.equal(el('frame-select').value,'frame-1');
 assert.equal(el('frame-camera').value,'camera-3');assert.equal(el('rig-status').textContent,'Konflikt');
 const event=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
});
test('saving calibration does not discard pending assignment edits',async t=>{
 const {el,writes,edit}=await setup(t);edit('frame-camera','camera-3');
 await el('corners-save').onclick();assert.equal(writes[0].frames[0].camera,'camera-1');
 assert.equal(el('frame-camera').value,'camera-3');assert.match(el('rig-status').textContent,/noch nicht gespeichert/);
 await el('rig-save').onclick();assert.equal(writes[1].frames[0].camera,'camera-3');
});
