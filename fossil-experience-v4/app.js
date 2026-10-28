const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim();
const $=id=>document.getElementById(id),screens=['loading','welcome','camera','observe','discover','connection','feedback','thanks','notReady'];
const SPECIMEN_LABELS=['fossil1','fossil2','fossil3'];
const REQUIRED_LABELS=[...SPECIMEN_LABELS,'other','background'];
const params=new URLSearchParams(location.search),MODE=params.get('mode')==='test'?'test':'live';
let model=null,classifier=null,stream=null,raf=null,lastInfer=0,stable=0,current=null,session=null,selectedObject='';
const video=$('video'),overlay=$('overlay'),ctx=overlay.getContext('2d'),crop=document.createElement('canvas'),cctx=crop.getContext('2d',{willReadFrequently:true});

function uid(){return crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function specimenConfig(label){const source=MODE==='test'?(CFG.TEST_SPECIMENS||CFG.SPECIMENS):CFG.SPECIMENS;return source?.[label]||{name:label}}
function specimenName(label){return specimenConfig(label).name||label}
function isSpecimen(label){return SPECIMEN_LABELS.includes(label)}
function show(id){
 screens.forEach(s=>{const el=$(s),active=s===id;el.classList.toggle('active',active);el.setAttribute('aria-hidden',active?'false':'true')});
 const target=$(id);if(target){const heading=target.querySelector('h1,h2');if(heading){heading.setAttribute('tabindex','-1');requestAnimationFrame(()=>heading.focus({preventScroll:true}))}}
 event('screen',{screen:id})
}
function sendToGoogle(payload){if(!ENDPOINT)return;try{fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{})}catch{}}
function event(type,data={}){
 if(!session)return;
 const e={type,at:new Date().toISOString(),elapsedMs:Date.now()-session.startedAt,mode:MODE,selectedObject:session.selectedObject||'',recognizedSpecimen:session.recognizedSpecimen||'',...data};
 session.events.push(e);
 sendToGoogle({eventName:CFG.EVENT_NAME||'NKU AI Day 2026',sessionId:session.id,event:e,userAgent:navigator.userAgent})
}
async function loadTraining(){let data=null;try{const r=await fetch('training.json?v=4.2',{cache:'no-store'});if(r.ok)data=await r.json()}catch{}if(!data?.classes)return false;const keys=Object.keys(data.classes);if(!REQUIRED_LABELS.every(k=>keys.includes(k)))return false;const ds={};for(const [label,o] of Object.entries(data.classes))ds[label]=tf.tensor(o.data,o.shape);classifier.setClassifierDataset(ds);return REQUIRED_LABELS.every(k=>(classifier.getClassExampleCount()?.[k]||0)>0)}
function cropFrame(){if(!video.videoWidth)return null;const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;crop.width=224;crop.height=224;cctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop}
function activation(){const f=cropFrame();return f?model.infer(f,true):null}
async function startCamera(){
 session.scanAttempts++;session.scanStartedAt=session.scanStartedAt||Date.now();event('scan-start',{attempt:session.scanAttempts});
 stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
 video.srcObject=stream;await video.play();stable=0;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)
}
function stopCamera(){if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null}
async function loop(ts){if(!stream)return;if(ts-lastInfer>250){lastInfer=ts;const a=activation();if(a){try{const r=await classifier.predictClass(a,5),p=r.confidences||{},conf=p[r.label]||0;current={label:r.label,confidence:conf,probabilities:p};renderPrediction()}finally{a.dispose()}}}raf=requestAnimationFrame(loop)}
function renderPrediction(){
 const label=current.label,conf=current.confidence||0;
 const expected=selectedObject;
 const correct=isSpecimen(label)&&label===expected&&conf>=.78;
 if(correct){
   stable++;
   $('scanState').textContent=stable>=3?'Found '+specimenName(label)+'.':'Hold steady…';
   $('guidance').textContent='Keep '+specimenName(expected)+' centered for just a moment.'
 }else{
   stable=Math.max(0,stable-1);$('scanState').textContent='Looking…';
   if(isSpecimen(label)&&label!==expected&&conf>=.78){
     $('guidance').textContent='This looks like '+specimenName(label)+'. Point at '+specimenName(expected)+', or start over to choose a different object.'
   }else if(label==='background'){
     $('guidance').textContent='Move closer so '+specimenName(expected)+' fills more of the frame.'
   }else{
     $('guidance').textContent='Center '+specimenName(expected)+' and hold still.'
   }
 }
 overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;ctx.clearRect(0,0,overlay.width,overlay.height);
 const w=overlay.width*.66,h=overlay.height*.66,x=(overlay.width-w)/2,y=(overlay.height-h)/2;
 ctx.strokeStyle=correct?'#34d399':'#f2b51d';ctx.lineWidth=Math.max(3,overlay.width/260);ctx.strokeRect(x,y,w,h);
 if(stable>=4)success()
}
function success(){
 if(session.scanSuccessAt)return;
 session.recognizedSpecimen=current.label;session.scanSuccessAt=Date.now();session.scanTimeMs=session.scanSuccessAt-session.scanStartedAt;
 $('recognizedName').textContent=specimenName(current.label);applySpecimenContent(current.label);
 event('scan-success',{recognizedSpecimen:current.label,recognizedName:specimenName(current.label),confidence:current.confidence,probabilities:current.probabilities,scanTimeMs:session.scanTimeMs});
 stopCamera();setTimeout(()=>show('observe'),300)
}
function newSession(){
 session={id:uid(),startedAt:Date.now(),startedAtISO:new Date().toISOString(),mode:MODE,selectedObject:'',scanAttempts:0,scanStartedAt:null,scanSuccessAt:null,scanTimeMs:null,manualBypass:false,recognizedSpecimen:'',observe:null,lookCloser:null,next:null,events:[]};
 $('studyCode').textContent='Study code '+session.id.slice(0,6).toUpperCase();
 event('page-open')
}
function resetObjectSelection(){
 selectedObject='';session.selectedObject='';
 document.querySelectorAll('[data-object]').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
 $('startExperience').disabled=true;$('startExperience').textContent='Choose an object to start'
}
function selectObject(label){
 if(!SPECIMEN_LABELS.includes(label))return;
 selectedObject=label;session.selectedObject=label;
 document.querySelectorAll('[data-object]').forEach(x=>{const on=x.dataset.object===label;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',on?'true':'false')});
 $('selectedObjectName').textContent=specimenName(label);
 $('startExperience').disabled=false;$('startExperience').textContent='Start with '+specimenName(label);
 event('object-selected',{selectedObject:label,selectedObjectName:specimenName(label)})
}
function beginExperience(){event('session-start');show('welcome')}
function resetSession(){
 stopCamera();document.querySelectorAll('[data-look]').forEach(x=>{x.disabled=false;x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
 $('nextBlock').classList.add('hidden');newSession();resetObjectSelection();beginExperience()
}
function finish(){
 session.completed=true;session.completedAtISO=new Date().toISOString();session.totalMs=Date.now()-session.startedAt;
 event('session-complete',{totalMs:session.totalMs,scanTimeMs:session.scanTimeMs,selectedObject:session.selectedObject,recognizedSpecimen:session.recognizedSpecimen,observe:session.observe,lookCloser:session.lookCloser,next:session.next,manualBypass:session.manualBypass});
 $('duration').textContent=session.totalMs<60000?Math.round(session.totalMs/1000)+' sec':Math.floor(session.totalMs/60000)+'m '+Math.round(session.totalMs%60000/1000)+'s';show('thanks')
}
function applySpecimenContent(label){
 const cc=specimenConfig(label);
 $('sourceObjectName').textContent=cc.name||'This object';
 $('sourceCatalog').textContent=cc.catalogNumber?cc.catalogNumber:'';
 $('noticeQuestion').textContent=cc.noticeQuestion||'What catches your attention first?';

 const choices=cc.noticeChoices||[
  {value:'shape',label:'Shape',detail:'The overall form or outline'},
  {value:'texture',label:'Texture',detail:'Ridges, pits, lines, or surface'},
  {value:'pattern',label:'Pattern',detail:'Repeated or unusual details'}
 ];
 const buttons=[...document.querySelectorAll('[data-observe]')];
 choices.slice(0,3).forEach((choice,i)=>{
   const b=buttons[i];if(!b)return;
   b.dataset.observe=choice.value;
   b.querySelector('b').textContent=choice.label;
   const span=b.querySelector('span');if(span)span.textContent=choice.detail||'';
 });

 if(cc.approved&&cc.revealTitle&&cc.revealText){
   $('discoverTitle').textContent=cc.revealTitle;
   $('discoverText').textContent='';
   $('fossilFactTitle').textContent=cc.revealTitle;
   $('fossilFactText').textContent=cc.revealText;
   $('sourceText').textContent=cc.sourceText||'';
   if(cc.uncertaintyText){$('uncertaintyText').textContent=cc.uncertaintyText;$('uncertaintyText').classList.remove('hidden')}
   else{$('uncertaintyText').textContent='';$('uncertaintyText').classList.add('hidden')}
   $('fossilFact').classList.remove('hidden');$('curatorNote').classList.add('hidden')
 }else{
   $('discoverTitle').textContent='That detail is a clue.';
   $('discoverText').textContent='The full object story will be added only after the content is reviewed and approved.';
   $('fossilFact').classList.add('hidden');$('curatorNote').classList.remove('hidden')
 }

 $('relatedObjectName').textContent=cc.relatedObjectName||'Curator-approved related content';
 $('relatedCatalog').textContent=cc.relatedCatalogNumber||'';
 $('relatedObjectReason').textContent=cc.relatedObjectReason||'A future museum version could add an approved connection here.';
 $('relatedStop').textContent=cc.relatedStop||'';
 $('connectionIntro').textContent=cc.relatedObjectName?'This object connects to another real object in the gallery.':'A future museum version could connect this object to curator-approved related content.'
}

document.querySelectorAll('[data-object]').forEach(b=>b.onclick=()=>selectObject(b.dataset.object));
$('startExperience').onclick=async()=>{
 if(!selectedObject)return;
 show('camera');
 if(MODE==='test'){
   session.scanAttempts++;session.scanStartedAt=Date.now();event('scan-start',{attempt:session.scanAttempts,simulated:true});
   $('testScanPanel').classList.remove('hidden');$('scanState').classList.add('hidden');$('guidance').textContent='Test mode is simulating recognition for '+specimenName(selectedObject)+'.';
   return
 }
 try{await startCamera()}catch(e){event('camera-error',{message:String(e)});$('scanState').textContent='Camera permission needed';$('guidance').textContent='Allow camera access in your browser, or use the continue-without-scanning option.';$('cameraStatus').textContent='Camera access was not available. You can allow camera access or continue without scanning.'}
};
$('simulateRecognition').onclick=()=>{
 if(MODE!=='test'||!selectedObject)return;
 current={label:selectedObject,confidence:1,probabilities:{[selectedObject]:1}};
 event('test-recognition-simulated',{selectedObject});
 success()
};
$('restart').onclick=()=>resetSession();
$('scanHelp').onclick=()=>{
 session.manualBypass=true;event('manual-bypass');$('cameraStatus').textContent='Continuing without camera scanning.';stopCamera();
 $('recognizedName').textContent='Scan skipped';applySpecimenContent(selectedObject);show('observe')
};
document.querySelectorAll('[data-observe]').forEach(b=>b.onclick=()=>{
 session.observe=b.dataset.observe;
 const cc=specimenConfig(session.selectedObject);
 const choice=(cc.noticeChoices||[]).find(x=>x.value===session.observe);
 event('observe-choice',{value:session.observe,choiceLabel:choice?.label||''});
 show('discover')
});
$('toConnection').onclick=()=>show('connection');$('toFeedback').onclick=()=>show('feedback');
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{
 session.lookCloser=b.dataset.look;event('look-closer',{value:session.lookCloser});
 document.querySelectorAll('[data-look]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');x.disabled=true});
 $('nextBlock').classList.remove('hidden')
});
document.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{session.next=b.dataset.next;event('next-action',{value:session.next});finish()});

(async()=>{
 newSession();resetObjectSelection();
 if(MODE==='test'){
   $('modePill').textContent='TEST MODE';$('testModeNotice').classList.remove('hidden');
   ['fossil1','fossil2','fossil3'].forEach((label,i)=>{const el=$('objectLabel'+(i+1));if(el){const cc=specimenConfig(label);el.textContent=cc.shortName||cc.name||('Object '+(i+1))}});
   $('loading').setAttribute('aria-busy','false');event('test-mode-ready');beginExperience();return
 }
 event('model-load-start');
 try{
   await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();event('model-library-ready');
   const ok=await loadTraining();
   if(ok){event('training-ready');$('loading').setAttribute('aria-busy','false');beginExperience()}
   else{event('training-missing');show('notReady')}
 }catch(e){console.error(e);event('model-load-error',{message:String(e)});$('loadingMsg').textContent='The vision model could not load. Check your connection and refresh.'}
})();