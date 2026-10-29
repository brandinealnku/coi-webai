const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim();
const $=id=>document.getElementById(id);
const screens=['loading','welcome','camera','observe','discover','connection','notReady'];
const SPECIMEN_LABELS=['fossil1','fossil2','fossil3'];
const REQUIRED_LABELS=[...SPECIMEN_LABELS,'other','background'];
const params=new URLSearchParams(location.search),MODE=params.get('mode')==='test'?'test':'live';
const DESIGN=params.get('design')==='gold'?'gold':'blue',RELEASE='ai-day-2026-10-29';
let journeyId=crypto.randomUUID(),visited=new Set(),ready=false,stableLabel=null,cameraGeneration=0;
document.documentElement.dataset.design=DESIGN;
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
 const e={type,at:new Date().toISOString(),elapsedMs:Date.now()-session.startedAt,mode:MODE,design:DESIGN,release:RELEASE,journeyId,selectedObject:session.selectedObject||'',recognizedSpecimen:session.recognizedSpecimen||'',...data};
 session.events.push(e);
 sendToGoogle({eventName:(CFG.EVENT_NAME||'NKU AI Day 2026')+' | '+RELEASE+' | '+DESIGN+' | journey:'+journeyId,sessionId:session.id,event:e,userAgent:navigator.userAgent})
}
async function loadTraining(){
 let data=null;
 try{const r=await fetch('training.json?v=4.3',{cache:'no-store'});if(r.ok)data=await r.json()}catch{}
 if(!data?.classes)return false;
 const keys=Object.keys(data.classes);
 if(!REQUIRED_LABELS.every(k=>keys.includes(k)))return false;
 const ds={};
 for(const label of REQUIRED_LABELS){const o=data.classes[label];if(!Array.isArray(o?.shape)||o.shape.length!==2||o.shape[0]<1||o.shape[1]!==1280||!Array.isArray(o.data)||o.data.length!==o.shape[0]*o.shape[1]||!o.data.every(Number.isFinite))return false}
 for(const label of REQUIRED_LABELS){const o=data.classes[label];ds[label]=tf.tensor(o.data,o.shape)}
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
 if(!ready){openObjectFallback(false);return}
 stopCamera();const generation=cameraGeneration;
 session.scanAttempts++;session.scanStartedAt=session.scanStartedAt||Date.now();event('scan-start',{attempt:session.scanAttempts});
 const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
 if(generation!==cameraGeneration){acquired.getTracks().forEach(t=>t.stop());return}
 stream=acquired;video.srcObject=stream;await video.play();stable=0;stableLabel=null;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)
}
function stopCamera(){cameraGeneration++;if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null}
async function loop(ts){
 if(!stream)return;const generation=cameraGeneration;
 try{
 if(ts-lastInfer>250){
   lastInfer=ts;const a=activation();
   if(a){try{const r=await classifier.predictClass(a,5),p=r.confidences||{},conf=p[r.label]||0;if(generation!==cameraGeneration)return;current={label:r.label,confidence:conf,probabilities:p};renderPrediction()}finally{a.dispose()}}
 }
 }catch(e){event('scan-error',{message:String(e)});stopCamera();openObjectFallback(false);return}
 if(stream&&generation===cameraGeneration)raf=requestAnimationFrame(loop)
}
function renderPrediction(){
 const label=current.label,conf=current.confidence||0,positive=isSpecimen(label)&&conf>=.78;
 if(positive){
   stable=stableLabel===label?stable+1:1;stableLabel=label;$('scanState').textContent=stable>=3?'Found it.':'Hold steady…';
   $('guidance').textContent='Keep the object centered for one more moment.'
 }else{
   stable=0;stableLabel=null;$('scanState').textContent='Looking…';
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
function resetSession(start=true){
 stopCamera();stable=0;current=null;
 document.querySelectorAll('[aria-pressed="true"]').forEach(x=>x.setAttribute('aria-pressed','false'));
 document.querySelectorAll('.choice.selected').forEach(x=>x.classList.remove('selected'));
 document.querySelectorAll('[data-noticed]').forEach(x=>{x.disabled=false;x.setAttribute('aria-pressed','false')});
 document.querySelectorAll('details').forEach(x=>x.open=false);
 $('feedbackSummary').textContent='Optional: notice something new?';$('noticeFeedback').classList.remove('hidden');
 $('connectionHeading').textContent='Notice something new?';
 $('missionComplete').classList.add('hidden');
 $('completionLabel').textContent='NEXT STOP';
 $('cameraStatus').textContent='';$('scanState').textContent='Looking…';
 $('guidance').textContent='Move close enough for the object to fill most of the frame.';
 $('finishExperience').classList.remove('hidden');$('tryAnother').classList.remove('hidden');$('tryAnother').textContent='Continue to next stop';
 $('testScanPanel').classList.add('hidden');$('scanState').classList.remove('hidden');
 if(start){journeyId=crypto.randomUUID();visited=new Set();$('routeProgress').textContent='Route 1 → 4 → 5 → Finale'}
 $('optionalFeedback').classList.remove('hidden');$('optionalFeedback').open=false;
 newSession();if(start)beginExperience()
}
function finish(){
 if(session.completed)return;
 visited.add(session.selectedObject);session.completed=true;session.completedAtISO=new Date().toISOString();session.totalMs=Date.now()-session.startedAt;
 event('session-complete',{totalMs:session.totalMs,scanTimeMs:session.scanTimeMs,selectedObject:session.selectedObject,recognizedSpecimen:session.recognizedSpecimen,observe:session.observe,noticedNew:session.noticedNew,next:session.next,manualBypass:session.manualBypass});
}
function nextRouteLabel(){
 return ({fossil1:'fossil2',fossil2:'fossil3'})[session.selectedObject]||null
}
function showNextActions(){
 const cc=specimenConfig(session.selectedObject);
 $('connectionHeading').textContent='What next?';
 $('missionCompleteText').textContent=cc.relatedObjectName||'Route complete';
 $('missionCompleteSubtext').textContent=nextRouteLabel()?'Find the matching stop label at the AI Day table.':'Finish the rehearsal with a look ahead to CMC.';
 $('tryAnother').textContent=nextRouteLabel()?'Continue to next stop':'Continue to finale';
 $('missionComplete').classList.remove('hidden');
 $('tryAnother').focus({preventScroll:true});window.scrollTo(0,0)
}
async function continueRoute(){
 const nextLabel=nextRouteLabel();
 session.next='yes';event('next-action',{value:'yes',source:'navigation'});finish();
 event('route-continue',{destination:nextLabel||'finale'});
 if(!nextLabel){
   $('optionalFeedback').classList.add('hidden');$('routeProgress').textContent='Finale · '+visited.size+' of 3 object stops visited';
   $('completionLabel').textContent='STOP 6 · FINALE';
   $('connectionHeading').textContent='Expand your world.';
   $('missionCompleteText').textContent='Silurian–Devonian case';
   $('missionCompleteSubtext').textContent='At CMC, the story continues with life after the Ordovician extinction. This is the end of the AI Day rehearsal.';
   $('tryAnother').classList.add('hidden');
   $('finishExperience').focus({preventScroll:true});return
 }
 resetSession(false);event('session-start');show('camera');
 if(MODE==='test'){
   session.scanAttempts++;session.scanStartedAt=Date.now();
   event('scan-start',{attempt:session.scanAttempts,simulated:true});
   event('test-recognition-simulated',{selectedObject:nextLabel});
   completeRecognition(nextLabel,1,{[nextLabel]:1},true)
 }else{
   $('guidance').textContent='Find '+specimenName(nextLabel)+' and scan its proxy object.';
   try{await startCamera()}catch(e){event('camera-error',{message:String(e)});openObjectFallback(false)}
 }
}

function applySpecimenContent(label){
 const cc=specimenConfig(label);
 $('routeProgress').textContent='Route 1 → 4 → 5 → Finale · At stop '+({fossil1:1,fossil2:4,fossil3:5}[label])+' · '+visited.size+' visited';
 $('recognitionKind').textContent=session.manualBypass?'Selected:':MODE==='test'?'Simulated match:':'Found:';
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

   $('fossilFactTitle').textContent=cc.revealTitle;$('fossilFactText').textContent=cc.revealText;
   $('sourceText').textContent=cc.sourceText||'';
   if(cc.uncertaintyText){$('uncertaintyText').textContent=cc.uncertaintyText;$('uncertaintyText').classList.remove('hidden')}
   else{$('uncertaintyText').textContent='';$('uncertaintyText').classList.add('hidden')}
   $('fossilFact').classList.remove('hidden');$('curatorNote').classList.add('hidden')
 }else{

   $('fossilFact').classList.add('hidden');$('curatorNote').classList.remove('hidden')
 }


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
   session.manualBypass=true;session.selectedObject=label;session.recognizedSpecimen='';session.scanSuccessAt=Date.now();session.scanTimeMs=session.scanStartedAt?session.scanSuccessAt-session.scanStartedAt:0;
   $('recognizedName').textContent=specimenName(label);applySpecimenContent(label);event('manual-bypass',{selectedObject:label,recognizedSpecimen:''});stopCamera();show('observe')
 }
});
$('restart').onclick=()=>resetSession();
$('scanHelp').onclick=()=>{session.manualBypass=true;event('manual-bypass-open');stopCamera();openObjectFallback(false)};
document.querySelectorAll('[data-observe]').forEach(b=>b.onclick=()=>{
 session.observe=b.dataset.observe;
 const cc=specimenConfig(session.selectedObject),choice=(cc.noticeChoices||[]).find(x=>x.value===session.observe);
 event('observe-choice',{value:session.observe,choiceLabel:choice?.label||''});
 show('discover')
});
$('toConnection').onclick=()=>{show('connection');showNextActions()};
document.querySelectorAll('[data-noticed]').forEach(b=>b.onclick=()=>{
 session.noticedNew=b.dataset.noticed;event('noticed-new',{value:session.noticedNew});
 document.querySelectorAll('[data-noticed]').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',on?'true':'false');x.disabled=true});
 $('noticeFeedback').classList.add('hidden');$('optionalFeedback').open=false;$('feedbackSummary').textContent='Feedback saved — thank you';
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
   if(ok){ready=true;event('training-ready');$('loading').setAttribute('aria-busy','false');if($('loading').classList.contains('active'))beginExperience()}
   else{event('training-missing');if($('loading').classList.contains('active'))show('notReady')}
 }catch(e){console.error(e);event('model-load-error',{message:String(e)});if($('loading').classList.contains('active'))show('notReady')}
})();
$('tryAnother').onclick=()=>{if(session.experienceFinished)resetSession();else continueRoute()};
$('finishExperience').onclick=()=>{
 if(!session.completed){session.next='no';event('next-action',{value:'no',source:'navigation'});finish()}
 session.experienceFinished=true;event('experience-finished');$('optionalFeedback').classList.add('hidden');
 $('connectionHeading').textContent='All done.';$('completionLabel').textContent='DONE';
 $('tryAnother').classList.remove('hidden');
 $('missionCompleteText').textContent='Thanks for exploring.';
 $('missionCompleteSubtext').textContent=MODE==='test'?'This rehearsal is complete. You can close this tab or start again.':'You’re all set. You can close this tab or keep exploring the exhibit.';
 $('tryAnother').textContent='Start again';
 $('finishExperience').classList.add('hidden');
};


$('manualStart').onclick=()=>{show('camera');openObjectFallback(false)};
$('loadingFallback').onclick=()=>{show('camera');openObjectFallback(false)};
