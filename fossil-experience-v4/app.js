const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim();
const $=id=>document.getElementById(id);
const SCREENS=['loading','welcome','camera','observe','discover','connection','notReady'];
const TARGETS=['fossil1','fossil2','fossil3'];
const REQUIRED=[...TARGETS,'other','background'];
const params=new URLSearchParams(location.search);
const MODE=params.get('mode')==='test'?'test':'live';
const requestedDesign=params.get('design');
const DESIGN=(requestedDesign==='blue'||requestedDesign==='gold')?requestedDesign:'nku';
const RELEASE='ai-day-focused-release-2026-10-29';
document.documentElement.dataset.design=DESIGN;
document.documentElement.dataset.mode=MODE;

let model=null,classifier=null,stream=null,raf=null,lastInfer=0,stable=0,stableLabel='',current=null,ready=false;
let journeyId=uid(),visited=new Set(),session=null,cameraGeneration=0;
const video=$('video'),overlay=$('overlay'),ctx=overlay.getContext('2d'),crop=document.createElement('canvas'),cctx=crop.getContext('2d',{willReadFrequently:true});

function uid(){return crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function specimenConfig(label){return CFG.SPECIMENS?.[label]||{name:label}}
function specimenName(label){return specimenConfig(label).name||label}
function isTarget(label){return TARGETS.includes(label)}
function routeNumber(label){return ({fossil1:'1',fossil2:'4',fossil3:'5',finale:'6'})[label]||''}
function nextRouteLabel(label){return ({fossil1:'fossil2',fossil2:'fossil3',fossil3:'finale'})[label]||null}

function show(id){
  document.documentElement.dataset.screen=id;
  SCREENS.forEach(s=>{const el=$(s),on=s===id;el.classList.toggle('active',on);el.setAttribute('aria-hidden',on?'false':'true')});
  const target=$(id),heading=target?.querySelector('h1,h2');
  if(heading){heading.setAttribute('tabindex','-1');requestAnimationFrame(()=>heading.focus({preventScroll:true}))}
  event('screen',{screen:id});
}
function send(payload){
  if(!ENDPOINT)return;
  try{fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{})}catch{}
}
function event(type,data={}){
  if(!session)return;
  const e={
    type,at:new Date().toISOString(),elapsedMs:Date.now()-session.startedAt,
    mode:MODE,design:DESIGN,release:RELEASE,journeyId,
    selectedObject:session.selectedObject||'',recognizedSpecimen:session.recognizedSpecimen||'',
    recognitionMethod:session.recognitionMethod||'',...data
  };
  session.events.push(e);
  send({eventName:CFG.EVENT_NAME||'NKU AI Day 2026',sessionId:session.id,event:e,userAgent:navigator.userAgent});
}
function beginExperience(){event('session-start');show('welcome')}
function newSession(){
  session={
    id:uid(),startedAt:Date.now(),mode:MODE,selectedObject:'',recognizedSpecimen:'',
    recognitionMethod:'',scanAttempts:0,scanStartedAt:null,scanSuccessAt:null,scanTimeMs:null,
    manualBypass:false,observe:null,noticedNew:null,next:null,completed:false,events:[]
  };
  $('studyCode').textContent='Study code '+session.id.slice(0,6).toUpperCase();
  event('page-open');
}
function updateRoute(active=''){
  document.querySelectorAll('[data-route-stop]').forEach(li=>{
    const label=li.dataset.routeStop;
    li.classList.toggle('complete',visited.has(label));
    li.classList.toggle('current',label===active);
    if(label===active)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');
  });
  const names={fossil1:'Stop 1',fossil2:'Stop 4',fossil3:'Stop 5',finale:'Finale'};
  $('routeProgress').textContent=active?('Current: '+names[active]+'. '+visited.size+' object stops completed.'):'Route 1 → 4 → 5 → Finale';
}

async function loadTraining(){
  let data=null;
  try{const r=await fetch('training.json?v=ai-day-release',{cache:'no-store'});if(r.ok)data=await r.json()}catch{}
  if(!data?.classes)return false;
  if(!REQUIRED.every(k=>Object.prototype.hasOwnProperty.call(data.classes,k)))return false;
  const ds={};
  for(const label of REQUIRED){
    const o=data.classes[label];
    if(!Array.isArray(o?.shape)||o.shape.length!==2||o.shape[0]<1||o.shape[1]!==1280||!Array.isArray(o.data)||o.data.length!==o.shape[0]*o.shape[1]||!o.data.every(Number.isFinite))return false;
    ds[label]=tf.tensor(o.data,o.shape);
  }
  classifier.setClassifierDataset(ds);
  return REQUIRED.every(k=>(classifier.getClassExampleCount()?.[k]||0)>0);
}
function cropFrame(){
  if(!video.videoWidth)return null;
  const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;
  crop.width=224;crop.height=224;cctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop;
}
function activation(){const frame=cropFrame();return frame?model.infer(frame,true):null}
function setScanState(kind,text){
  $('scanState').className='scan-state status-'+kind;
  const icon=kind==='recognized'?'✓':kind==='unavailable'?'!':kind==='holding'?'◉':'◌';
  $('scanState').innerHTML='<span aria-hidden="true">'+icon+'</span> '+text;
  $('cameraStatus').textContent=text;
}
async function startCamera(){
  if(!ready){openManualSelection('model');return}
  stopCamera();
  const generation=cameraGeneration;
  session.scanAttempts++;session.scanStartedAt=session.scanStartedAt||Date.now();event('scan-start',{attempt:session.scanAttempts});
  const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  if(generation!==cameraGeneration){acquired.getTracks().forEach(t=>t.stop());return}
  stream=acquired;video.srcObject=stream;await video.play();stable=0;stableLabel='';setScanState('looking','Looking');raf=requestAnimationFrame(loop);
}
function stopCamera(){
  cameraGeneration++;
  if(raf)cancelAnimationFrame(raf);
  if(stream)stream.getTracks().forEach(t=>t.stop());
  stream=null;video.srcObject=null;
}
async function loop(ts){
  if(!stream)return;
  const generation=cameraGeneration;
  try{
    if(ts-lastInfer>250){
      lastInfer=ts;const a=activation();
      if(a){try{
        const r=await classifier.predictClass(a,5),p=r.confidences||{},conf=p[r.label]||0;
        if(generation!==cameraGeneration)return;
        current={label:r.label,confidence:conf,probabilities:p};renderPrediction();
      }finally{a.dispose()}}
    }
  }catch(e){event('scan-error',{message:String(e)});stopCamera();openManualSelection('runtime');return}
  if(stream&&generation===cameraGeneration)raf=requestAnimationFrame(loop);
}
function renderPrediction(){
  const label=current.label,conf=current.confidence||0,positive=isTarget(label)&&conf>=.78;
  if(positive){
    stable=stableLabel===label?stable+1:1;stableLabel=label;
    setScanState(stable>=3?'recognized':'holding',stable>=3?'Recognized':'Hold steady');
    $('guidance').textContent='Keep the object centered.';
  }else{
    stable=0;stableLabel='';setScanState('looking','Looking');
    $('guidance').textContent=label==='background'?'Move closer to the object.':'Center one labeled table object.';
  }
  overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;ctx.clearRect(0,0,overlay.width,overlay.height);
  const w=overlay.width*.66,h=overlay.height*.66,x=(overlay.width-w)/2,y=(overlay.height-h)/2;
  ctx.strokeStyle=positive?'#61d7bf':'#86e3ed';ctx.lineWidth=Math.max(3,overlay.width/260);ctx.strokeRect(x,y,w,h);
  if(stable>=4)completeRecognition(label,current.confidence,current.probabilities,false);
}
function completeRecognition(label,confidence=1,probabilities={},simulated=false){
  if(session.scanSuccessAt||!isTarget(label))return;
  session.selectedObject=label;session.recognizedSpecimen=label;session.recognitionMethod=simulated?'simulated':'model';
  session.scanSuccessAt=Date.now();session.scanTimeMs=session.scanStartedAt?session.scanSuccessAt-session.scanStartedAt:0;
  event('scan-success',{recognizedSpecimen:label,confidence,probabilities,scanTimeMs:session.scanTimeMs,simulated});
  stopCamera();applySpecimenContent(label);setTimeout(()=>show('observe'),180);
}
function completeManual(label,reason='camera'){
  if(!isTarget(label))return;
  session.selectedObject=label;session.recognizedSpecimen='';session.recognitionMethod='manual';session.manualBypass=true;
  event('manual-selection',{selectedObject:label,reason});
  stopCamera();applySpecimenContent(label);show('observe');
}
function openManualSelection(reason='camera'){
  if(MODE==='test'){
    $('scanPanelTitle').textContent='Choose a stop';
    $('scanPanelText').textContent='Simulate recognition for this AI Day route stop.';
  }else{
    setScanState('unavailable','Camera unavailable');
    $('scanPanelTitle').textContent='Choose the table label';
    $('scanPanelText').textContent='Recognition is being skipped. Choose the label beside the object.';
  }
  TARGETS.forEach((label,i)=>{const el=$('scanChoice'+(i+1));if(el)el.textContent=specimenConfig(label).tableLabel||specimenName(label)});
  $('testScanPanel').classList.remove('hidden');$('scanState').classList.add('hidden');
  event('manual-fallback-shown',{reason});
}

function configureReference(cc){
  const fig=$('referenceFigure'),img=$('referenceImage'),caption=$('referenceCaption'),cue=$('promptCue');
  fig.classList.add('hidden');cue.classList.add('hidden');img.removeAttribute('src');img.alt='';
  if(cc.referenceImage){
    img.src=cc.referenceImage;img.alt=cc.referenceAlt||'Museum reference image';
    caption.textContent=cc.referenceCaption||'Look at the museum image.';
    fig.classList.remove('hidden');cue.textContent='Look at the museum image.';cue.classList.remove('hidden');
  }else if(cc.requiresReferenceImage){
    cue.textContent='Reference image required before LIVE release.';cue.classList.remove('hidden');
  }
}
function applySpecimenContent(label){
  const cc=specimenConfig(label);
  updateRoute(label);
  $('recognitionKind').textContent=session.recognitionMethod==='manual'?'Selected:':session.recognitionMethod==='simulated'?'Simulated:':'Recognized:';
  $('recognizedName').textContent=cc.tableLabel||specimenName(label);
  $('scenarioContext').textContent=cc.scenarioName?('Museum story: '+cc.scenarioName):'';
  configureReference(cc);
  $('noticeQuestion').textContent=cc.noticeQuestion||'What do you notice?';
  const choices=cc.noticeChoices||[];
  [...document.querySelectorAll('[data-observe]')].forEach((b,i)=>{
    const choice=choices[i]||{value:'unsure',label:'Not sure',detail:''};
    b.dataset.observe=choice.value;b.querySelector('b').textContent=choice.label;
    const span=b.querySelector('span');if(span)span.textContent=choice.detail||'';
  });
  if(cc.approved&&cc.revealTitle&&cc.revealText){
    $('fossilFactTitle').textContent=cc.revealTitle;$('fossilFactText').textContent=cc.revealText;$('sourceText').textContent=cc.sourceText||'';
    if(cc.uncertaintyText){$('uncertaintyText').textContent=cc.uncertaintyText;$('uncertaintyText').classList.remove('hidden')}else $('uncertaintyText').classList.add('hidden');
    $('fossilFact').classList.remove('hidden');$('curatorNote').classList.add('hidden');
  }else{$('fossilFact').classList.add('hidden');$('curatorNote').classList.remove('hidden')}
}
function resetControls(){
  document.querySelectorAll('[aria-pressed="true"]').forEach(x=>x.setAttribute('aria-pressed','false'));
  document.querySelectorAll('.choice.selected').forEach(x=>x.classList.remove('selected'));
  document.querySelectorAll('[data-noticed]').forEach(x=>{x.disabled=false;x.setAttribute('aria-pressed','false')});
  document.querySelectorAll('details').forEach(x=>x.open=false);
  $('feedbackSummary').textContent='Optional feedback';$('noticeFeedback').classList.remove('hidden');
  $('missionComplete').classList.add('hidden');$('nextStopCard').classList.remove('hidden');$('next-actions')?.classList?.remove('hidden');
  $('finishExperience').classList.remove('hidden');$('tryAnother').classList.remove('hidden');$('tryAnother').textContent='Continue';
  $('testScanPanel').classList.add('hidden');$('scanState').classList.remove('hidden');setScanState('looking','Looking');
  $('guidance').textContent='Move close enough for it to fill most of the frame.';
}
function beginNewJourney(){
  stopCamera();journeyId=uid();visited=new Set();resetControls();updateRoute();newSession();event('session-start');show('welcome');
}
function beginNextSession(){
  stopCamera();resetControls();newSession();event('session-start');show('camera');
  if(MODE==='test')openManualSelection('test');else startCamera().catch(e=>{event('camera-error',{message:String(e)});openManualSelection('permission')});
}
function finishSession(action){
  if(session.completed)return;
  if(session.selectedObject)visited.add(session.selectedObject);
  session.next=action;session.completed=true;session.totalMs=Date.now()-session.startedAt;
  event('session-complete',{totalMs:session.totalMs,scanTimeMs:session.scanTimeMs,observe:session.observe,noticedNew:session.noticedNew,next:session.next,manualBypass:session.manualBypass});
}
function showNextStop(){
  const cc=specimenConfig(session.selectedObject),next=nextRouteLabel(session.selectedObject);
  $('nextStopNumber').textContent=routeNumber(next||'finale');
  $('nextStopName').textContent=cc.relatedObjectName||(next?'Next stop':'Stop 6 · Finale');
  $('missionPrompt').textContent=cc.aiDayDirection||cc.missionPrompt||'Find the matching table label.';
  $('tryAnother').textContent=next?'Continue':'Continue to finale';
  $('finishExperience').textContent='Finish';
  $('nextStopCard').classList.remove('hidden');$('missionComplete').classList.add('hidden');
}
function showFinished(message,subtext){
  $('nextStopCard').classList.add('hidden');$('optionalFeedback').classList.add('hidden');$('tryAnother').classList.add('hidden');
  $('finishExperience').classList.add('hidden');$('missionComplete').classList.remove('hidden');
  $('missionCompleteText').textContent=message;$('missionCompleteSubtext').textContent=subtext;
}

$('startExperience').onclick=()=>{
  show('camera');
  if(MODE==='test'){session.scanAttempts++;session.scanStartedAt=Date.now();event('scan-start',{attempt:1,simulated:true});openManualSelection('test')}
  else startCamera().catch(e=>{event('camera-error',{message:String(e)});$('cameraStatus').textContent='Camera unavailable. Manual fallback is available.';openManualSelection('permission')});
};
document.querySelectorAll('[data-test-object]').forEach(b=>b.onclick=()=>{
  const label=b.dataset.testObject;
  if(MODE==='test'){session.scanStartedAt=session.scanStartedAt||Date.now();event('test-recognition-simulated',{selectedObject:label});completeRecognition(label,1,{[label]:1},true)}
  else completeManual(label,'manual-fallback');
});
$('restart').onclick=beginNewJourney;
$('scanHelp').onclick=()=>{stopCamera();openManualSelection('user')};
$('loadingFallback').onclick=()=>{show('camera');openManualSelection('model')};
$('manualStart').onclick=()=>{show('camera');openManualSelection('model')};

document.querySelectorAll('[data-observe]').forEach(b=>b.onclick=()=>{
  session.observe=b.dataset.observe;
  const cc=specimenConfig(session.selectedObject),choice=(cc.noticeChoices||[]).find(x=>x.value===session.observe);
  event('observe-choice',{value:session.observe,choiceLabel:choice?.label||''});show('discover');
});
$('toConnection').onclick=()=>{showNextStop();show('connection')};
document.querySelectorAll('[data-noticed]').forEach(b=>b.onclick=()=>{
  session.noticedNew=b.dataset.noticed;event('noticed-new',{value:session.noticedNew});
  document.querySelectorAll('[data-noticed]').forEach(x=>{x.disabled=true;x.setAttribute('aria-pressed',x===b?'true':'false');x.classList.toggle('selected',x===b)});
  $('noticeFeedback').classList.add('hidden');$('optionalFeedback').open=false;$('feedbackSummary').textContent='Feedback saved';
});
$('tryAnother').onclick=()=>{
  const next=nextRouteLabel(session.selectedObject);
  finishSession('continue');event('route-continue',{destination:next||'finale'});
  if(!next){
    visited.add('finale');updateRoute('finale');
    showFinished('Stop 6 · Finale','At CMC, compare what changed after the Ordovician extinction. AI Day rehearsal complete.');
    return;
  }
  beginNextSession();
};
$('finishExperience').onclick=()=>{
  finishSession('finish');event('experience-finished');
  showFinished('Thanks for exploring.',MODE==='test'?'Rehearsal complete.':'You can close this tab or keep exploring.');
};

(async()=>{
  newSession();updateRoute();
  if(MODE==='test'){
    $('modePill').textContent='TEST · '+DESIGN.toUpperCase();$('testModeNotice').classList.remove('hidden');event('test-mode-ready');beginExperience();
    return;
  }
  $('modePill').textContent='NKU AI DAY';
  event('model-load-start');
  try{
    await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();event('model-library-ready');
    ready=await loadTraining();
    if(ready){event('training-ready');beginExperience()}else{event('training-missing');show('notReady')}
  }catch(e){event('model-load-error',{message:String(e)});show('notReady')}
})();