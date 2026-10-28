const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim();
const $=id=>document.getElementById(id);
const screens=['loading','welcome','camera','observe','discover','connection','notReady'];
const SPECIMEN_LABELS=['fossil1','fossil2','fossil3'];
const REQUIRED_LABELS=[...SPECIMEN_LABELS,'other','background'];
const params=new URLSearchParams(location.search),MODE=params.get('mode')==='test'?'test':'live';
let model=null,classifier=null,stream=null,raf=null,lastInfer=0,stable=0,current=null,session=null;
const video=$('video'),overlay=$('overlay'),ctx=overlay.getContext('2d'),crop=document.createElement('canvas'),cctx=crop.getContext('2d',{willReadFrequently:true});

function uid(){return crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function specimenConfig(label){
 const source=MODE==='test'?(CFG.TEST_SPECIMENS||CFG.SPECIMENS):CFG.SPECIMENS;
 return source?.[label]||{name:label}
}
function specimenName(label){return specimenConfig(label).name||label}
function isSpecimen(label){return SPECIMEN_LABELS.includes(label)}
function show(id){
 screens.forEach(s=>{const el=$(s),active=s===id;el.classList.toggle('active',active);el.setAttribute('aria-hidden',active?'false':'true')});
 const target=$(id);
 if(target){const heading=target.querySelector('h1,h2');if(heading){heading.setAttribute('tabindex','-1');requestAnimationFrame(()=>heading.focus({preventScroll:true}))}}
 event('screen',{screen:id})
}
function sendToGoogle(payload){
 if(!ENDPOINT)return;
 try{fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{})}catch{}
}
function event(type,data={}){
 if(!session)return;
 const e={type,at:new Date().toISOString(),elapsedMs:Date.now()-session.startedAt,mode:MODE,selectedObject:session.selectedObject||'',recognizedSpecimen:session.recognizedSpecimen||'',...data};
 session.events.push(e);
 sendToGoogle({eventName:CFG.EVENT_NAME||'NKU AI Day 2026',sessionId:session.id,event:e,userAgent:navigator.userAgent})
}
async function loadTraining(){
 let data=null;
 try{const r=await fetch('training.json?v=4.3',{cache:'no-store'});if(r.ok)data=await r.json()}catch{}
 if(!data?.classes)return false;
 const keys=Object.keys(data.classes);
 if(!REQUIRED_LABELS.every(k=>keys.includes(k)))return false;
 const ds={};
 for(const [label,o] of Object.entries(data.classes))ds[label]=tf.tensor(o.data,o.shape);
 classifier.setClassifierDataset(ds);
 return REQUIRED_LABELS.every(k=>(classifier.getClassExampleCount()?.[k]||0)>0)
}
function cropFrame(){
 if(!video.videoWidth)return null;
 const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;
 crop.width=224;crop.height=224;cctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop
}
function activation(){const f=cropFrame();return f?model.infer(f,true):null}
async function startCamera(){
 session.scanAttempts++;session.scanStartedAt=session.scanStartedAt||Date.now();event('scan-start',{attempt:session.scanAttempts});
 stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
 video.srcObject=stream;await video.play();stable=0;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)
}
function stopCamera(){if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null}
async function loop(ts){
 if(!stream)return;
 if(ts-lastInfer>250){
   lastInfer=ts;const a=activation();
   if(a){try{const r=await classifier.predictClass(a,5),p=r.confidences||{},conf=p[r.label]||0;current={label:r.label,confidence:conf,probabilities:p};renderPrediction()}finally{a.dispose()}}
 }
 raf=requestAnimationFrame(loop)
}
function renderPrediction(){
 const label=current.label,conf=current.confidence||0,positive=isSpecimen(label)&&conf>=.78;
 if(positive){
   stable++;$('scanState').textContent=stable>=3?'Found it.':'Hold steady…';
   $('guidance').textContent='Keep the object centered for one more moment.'
 }else{
   stable=Math.max(0,stable-1);$('scanState').textContent='Looking…';
   $('guidance').textContent=label==='background'?'Move closer so the object fills more of the frame.':'Center one featured object and hold still.'
 }
 overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;ctx.clearRect(0,0,overlay.width,overlay.height);
 const w=overlay.width*.66,h=overlay.height*.66,x=(overlay.width-w)/2,y=(overlay.height-h)/2;
 ctx.strokeStyle=positive?'#34d399':'#f2b51d';ctx.lineWidth=Math.max(3,overlay.width/260);ctx.strokeRect(x,y,w,h);
 if(stable>=4)completeRecognition(label,current.confidence,current.probabilities,false)
}
function completeRecognition(label,confidence=1,probabilities={},simulated=false){
 if(session.scanSuccessAt||!isSpecimen(label))return;
 session.selectedObject=label;session.recognizedSpecimen=label;session.scanSuccessAt=Date.now();
 session.scanTimeMs=session.scanStartedAt?session.scanSuccessAt-session.scanStartedAt:0;
 $('recognizedName').textContent=specimenName(label);applySpecimenContent(label);
 event('scan-success',{selectedObject:label,recognizedSpecimen:label,recognizedName:specimenName(label),confidence,probabilities,scanTimeMs:session.scanTimeMs,simulated});
 stopCamera();setTimeout(()=>show('observe'),250)
}
function newSession(){
 session={id:uid(),startedAt:Date.now(),startedAtISO:new Date().toISOString(),mode:MODE,selectedObject:'',scanAttempts:0,scanStartedAt:null,scanSuccessAt:null,scanTimeMs:null,manualBypass:false,recognizedSpecimen:'',observe:null,noticedNew:null,next:null,events:[]};
 $('studyCode').textContent='Study code '+session.id.slice(0,6).toUpperCase();event('page-open')
}
function beginExperience(){event('session-start');show('welcome')}
function resetSession(){
 stopCamera();stable=0;current=null;
 document.querySelectorAll('[aria-pressed="true"]').forEach(x=>x.setAttribute('aria-pressed','false'));
 document.querySelectorAll('.choice.selected').forEach(x=>x.classList.remove('selected'));
 $('followBlock').classList.add('hidden');$('missionComplete').classList.add('hidden');
 $('finishExperience').classList.remove('hidden');$('tryAnother').textContent='Try another route stop';
 $('testScanPanel').classList.add('hidden');$('scanState').classList.remove('hidden');
 newSession();beginExperience()
}
function finish(){
 if(session.completed)return;
 session.completed=true;session.completedAtISO=new Date().toISOString();session.totalMs=Date.now()-session.startedAt;
 event('session-complete',{totalMs:session.totalMs,scanTimeMs:session.scanTimeMs,selectedObject:session.selectedObject,recognizedSpecimen:session.recognizedSpecimen,observe:session.observe,noticedNew:session.noticedNew,next:session.next,manualBypass:session.manualBypass});
 const cc=specimenConfig(session.selectedObject);
 $('missionCompleteText').textContent=session.next==='yes'?(cc.missionPrompt||'Continue to the next stop and see what you notice.'):'You’ve completed this route stop.';
 $('missionCompleteSubtext').textContent=MODE==='test'?'Route-stop test complete. Try another stop or finish the rehearsal.':'Try another route stop, or finish when you’re ready.';
 $('missionComplete').classList.remove('hidden');
 $('tryAnother').focus({preventScroll:true})
}
function applySpecimenContent(label){
 const cc=specimenConfig(label);
 $('scenarioContext').textContent=cc.scenarioName?('CMC route scenario: '+cc.scenarioName):'';
 $('noticeQuestion').textContent=cc.noticeQuestion||'What do you notice?';
 const choices=cc.noticeChoices||[
   {value:'shape',label:'Shape',detail:'The overall form or outline'},
   {value:'texture',label:'Texture',detail:'Ridges, pits, lines, or surface'},
   {value:'pattern',label:'Pattern',detail:'Repeated or unusual details'}
 ];
 const buttons=[...document.querySelectorAll('[data-observe]')];
 choices.slice(0,3).forEach((choice,i)=>{
   const b=buttons[i];if(!b)return;
   b.dataset.observe=choice.value;b.querySelector('b').textContent=choice.label;
   const span=b.querySelector('span');if(span)span.textContent=choice.detail||''
 });

 if(cc.approved&&cc.revealTitle&&cc.revealText){
   $('discoverTitle').textContent='Look what that clue reveals.';
   $('discoverText').textContent='';
   $('fossilFactTitle').textContent=cc.revealTitle;$('fossilFactText').textContent=cc.revealText;
   $('sourceText').textContent=cc.sourceText||'';
   if(cc.uncertaintyText){$('uncertaintyText').textContent=cc.uncertaintyText;$('uncertaintyText').classList.remove('hidden')}
   else{$('uncertaintyText').textContent='';$('uncertaintyText').classList.add('hidden')}
   $('fossilFact').classList.remove('hidden');$('curatorNote').classList.add('hidden')
 }else{
   $('discoverTitle').textContent='Look what that clue reveals.';
   $('discoverText').textContent='This object’s interpretive story is still being reviewed.';
   $('fossilFact').classList.add('hidden');$('curatorNote').classList.remove('hidden')
 }

 $('relatedObjectName').textContent=cc.relatedObjectName||'A related object';
 $('relatedCatalog').textContent=cc.relatedCatalogNumber||'';
 $('relatedObjectReason').textContent=cc.relatedObjectReason||'This object connects to another part of the gallery story.';
 $('relatedStop').textContent=cc.relatedStop||'';
 $('missionPrompt').textContent=cc.missionPrompt||'See if you can spot the connection yourself.'
}
function openObjectFallback(testMode){
 $('scanPanelTitle').textContent=testMode?'Choose what the test should recognize':'Which featured object are you using?';
 $('scanPanelText').textContent=testMode?'This replaces camera recognition only. Everything after this matches the MVP flow.':'Camera recognition is being skipped. Choose the label beside the physical object.';
 ['fossil1','fossil2','fossil3'].forEach((label,i)=>{
   const el=$('scanChoice'+(i+1));const cc=specimenConfig(label);
   if(el)el.textContent=testMode?(cc.shortName||cc.name||('Object '+(i+1))):((CFG.SPECIMENS?.[label]?.name)||('Object '+(i+1)))
 });
 $('testScanPanel').classList.remove('hidden');$('scanState').classList.add('hidden')
}

$('startExperience').onclick=async()=>{
 show('camera');
 if(MODE==='test'){
   session.scanAttempts++;session.scanStartedAt=Date.now();event('scan-start',{attempt:session.scanAttempts,simulated:true});
   openObjectFallback(true);return
 }
 try{await startCamera()}catch(e){
   event('camera-error',{message:String(e)});$('cameraStatus').textContent='Camera access was not available. You can continue without it.';
   $('guidance').textContent='Camera access was not available. Use the no-camera option below.'
 }
};
document.querySelectorAll('[data-test-object]').forEach(b=>b.onclick=()=>{
 const label=b.dataset.testObject;if(!isSpecimen(label))return;
 if(MODE==='test'){
   current={label,confidence:1,probabilities:{[label]:1}};event('test-recognition-simulated',{selectedObject:label});completeRecognition(label,1,current.probabilities,true)
 }else{
   session.manualBypass=true;session.selectedObject=label;session.recognizedSpecimen=label;session.scanSuccessAt=Date.now();session.scanTimeMs=session.scanStartedAt?session.scanSuccessAt-session.scanStartedAt:0;
   $('recognizedName').textContent=specimenName(label);applySpecimenContent(label);event('manual-bypass',{selectedObject:label,recognizedSpecimen:label});stopCamera();show('observe')
 }
});
$('restart').onclick=resetSession;
$('scanHelp').onclick=()=>{session.manualBypass=true;event('manual-bypass-open');stopCamera();openObjectFallback(false)};
document.querySelectorAll('[data-observe]').forEach(b=>b.onclick=()=>{
 session.observe=b.dataset.observe;
 const cc=specimenConfig(session.selectedObject),choice=(cc.noticeChoices||[]).find(x=>x.value===session.observe);
 event('observe-choice',{value:session.observe,choiceLabel:choice?.label||''});
 show('discover')
});
$('toConnection').onclick=()=>show('connection');
document.querySelectorAll('[data-noticed]').forEach(b=>b.onclick=()=>{
 session.noticedNew=b.dataset.noticed;event('noticed-new',{value:session.noticedNew});
 document.querySelectorAll('[data-noticed]').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',on?'true':'false');x.disabled=true});
 $('followBlock').classList.remove('hidden');$('followBlock').querySelector('h3').setAttribute('tabindex','-1');$('followBlock').querySelector('h3').focus({preventScroll:true})
});
document.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{
 session.next=b.dataset.next;event('next-action',{value:session.next});
 document.querySelectorAll('[data-next]').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',on?'true':'false');x.disabled=true});
 finish()
});

(async()=>{
 newSession();
 if(MODE==='test'){
   $('modePill').textContent='TEST MODE';$('testModeNotice').classList.remove('hidden');$('loading').setAttribute('aria-busy','false');event('test-mode-ready');beginExperience();return
 }
 event('model-load-start');
 try{
   await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();event('model-library-ready');
   const ok=await loadTraining();
   if(ok){event('training-ready');$('loading').setAttribute('aria-busy','false');beginExperience()}
   else{event('training-missing');show('notReady')}
 }catch(e){console.error(e);event('model-load-error',{message:String(e)});$('loadingMsg').textContent='The recognition model could not load. Check your connection and refresh.'}
})();
$('tryAnother').onclick=()=>resetSession();
$('finishExperience').onclick=()=>{
 event('experience-finished');
 $('missionCompleteText').textContent='Thanks for exploring.';
 $('missionCompleteSubtext').textContent=MODE==='test'?'This rehearsal is complete. You can close this tab or start again.':'You’re all set. You can close this tab or keep exploring the exhibit.';
 $('tryAnother').textContent='Start again';
 $('finishExperience').classList.add('hidden');
};
