const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim();
const $=id=>document.getElementById(id);
const SCREENS=['loading','welcome','camera','observe','discover','connection','notReady'];
const params=new URLSearchParams(location.search);
const MODE=params.get('mode')==='test'?'test':'live';
const USE_DRAFT=params.get('draft')==='1';
const requestedDesign=params.get('design');
let DESIGN=(requestedDesign==='blue'||requestedDesign==='gold')?requestedDesign:'nku';
const RELEASE='journey-framework-2026-10-29';
const DRAFT_KEY='expand-your-world-journey-draft-v1';

let JOURNEY=null,ARTIFACTS=[],ARTIFACT_BY_ID=new Map(),CLASS_TO_ARTIFACT=new Map(),RECOGNITION_CLASSES=[];
let model=null,classifier=null,stream=null,raf=null,lastInfer=0,stable=0,stableLabel='',current=null,ready=false;
let journeyId=uid(),visited=new Set(),session=null,cameraGeneration=0;
const video=$('video'),overlay=$('overlay'),ctx=overlay.getContext('2d'),crop=document.createElement('canvas'),cctx=crop.getContext('2d',{willReadFrequently:true});

function uid(){return crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function artifact(id){return ARTIFACT_BY_ID.get(id)||null}
function isArtifact(id){return ARTIFACT_BY_ID.has(id)}
function recognitionArtifact(label){return CLASS_TO_ARTIFACT.get(label)||null}
function nextArtifactId(id){
  const a=artifact(id);if(!a)return null;
  if(a.next?.artifactId)return a.next.artifactId;
  const i=ARTIFACTS.findIndex(x=>x.id===id);
  return i>=0&&i<ARTIFACTS.length-1?ARTIFACTS[i+1].id:'finale';
}
function routeNumber(id){if(id==='finale')return JOURNEY?.finale?.stopNumber||'✓';return artifact(id)?.stopNumber||''}
function routeName(id){if(id==='finale')return JOURNEY?.finale?.shortLabel||'Finale';return artifact(id)?.shortLabel||artifact(id)?.name||id}

async function loadJourney(){
  if(USE_DRAFT){
    try{const saved=localStorage.getItem(DRAFT_KEY);if(saved){const j=JSON.parse(saved);if(Array.isArray(j.artifacts))return j}}catch{}
  }
  const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw new Error('Could not load journey configuration.');
  return r.json();
}
function initializeJourney(j){
  JOURNEY=j;ARTIFACTS=(j.artifacts||[]).filter(a=>a&&a.id);ARTIFACT_BY_ID=new Map(ARTIFACTS.map(a=>[a.id,a]));
  CLASS_TO_ARTIFACT=new Map();
  for(const a of ARTIFACTS){if(a.recognitionClass)CLASS_TO_ARTIFACT.set(a.recognitionClass,a.id)}
  RECOGNITION_CLASSES=[...CLASS_TO_ARTIFACT.keys()];
  DESIGN=requestedDesign||j.theme||'nku';
  document.documentElement.dataset.design=DESIGN;document.documentElement.dataset.mode=MODE;
  document.title=(j.title||'Journey')+' · '+(j.eventLabel||'');
  document.querySelector('.brand strong').textContent=j.title||'Expand Your World';
  document.querySelector('.brand div span:last-child').textContent=j.brandLine||'';
  $('modePill').textContent=MODE==='test'?('TEST · '+DESIGN.toUpperCase()):(j.eventLabel||'LIVE');
  const w=j.welcome||{};
  document.querySelector('#welcome .eyebrow').textContent=w.eyebrow||j.eventLabel||'EXPLORE';
  document.querySelector('#welcome h1').textContent=w.headline||'Look closer.';
  document.querySelector('#welcome .lede').textContent=w.body||'Scan an object. Notice one clue. Follow where it leads.';
  $('startExperience').textContent=w.startButton||'Start exploring';
  const p=j.privacy||{};
  const ps=$('welcome').querySelector('.privacy-details summary');if(ps)ps.textContent=p.summary||'Camera & privacy';
  const pp=$('welcome').querySelector('.privacy-details p:not(.privacy-code)');if(pp)pp.textContent=p.body||'Images stay on your device.';
  renderRoute();
  renderObjectPicker();
  renderFinaleCopy();
}
function renderRoute(){
  const root=$('routeList');root.innerHTML='';root.style.setProperty('--route-count',String(Math.max(2,ARTIFACTS.length+1)));
  for(const a of ARTIFACTS){
    const li=document.createElement('li');li.dataset.routeStop=a.id;
    li.innerHTML='<span>'+esc(a.stopNumber||'•')+'</span><small>'+esc(a.shortLabel||a.name||a.id)+'</small>';root.appendChild(li);
  }
  const li=document.createElement('li');li.dataset.routeStop='finale';
  li.innerHTML='<span>'+esc(JOURNEY?.finale?.stopNumber||'✓')+'</span><small>'+esc(JOURNEY?.finale?.shortLabel||'Finale')+'</small>';root.appendChild(li);
  $('routeProgress').textContent='Route '+[...ARTIFACTS.map(a=>a.stopNumber),JOURNEY?.finale?.stopNumber||'Finale'].join(' → ');
}
function renderObjectPicker(){
  const root=$('testObjectGrid');root.innerHTML='';
  for(const a of ARTIFACTS){
    const b=document.createElement('button');b.type='button';b.className='secondary test-object-choice';b.dataset.artifactId=a.id;
    b.textContent=a.tableLabel||('Stop '+a.stopNumber+' · '+(a.name||a.id));b.onclick=()=>chooseArtifact(a.id);root.appendChild(b);
  }
}
function renderFinaleCopy(){
  const f=JOURNEY?.finale||{};
  $('completionLabel').textContent=(f.title||'Journey complete').toUpperCase();
  $('missionCompleteText').textContent=f.headline||'Thanks for exploring.';
  $('missionCompleteSubtext').textContent=f.body||'You made it to the end.';
  $('learnMoreProject').textContent=f.learnMoreLabel||'Learn more';
  $('learnMoreProject').href=f.learnMoreUrl||'project.html';
  $('startAgainFinale').textContent=f.restartLabel||'Start again';
  const note=document.querySelector('.finale-close-note');if(note)note.textContent=f.closeNote||'Done for now? You can close this tab.';
}

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
  const e={type,at:new Date().toISOString(),elapsedMs:Date.now()-session.startedAt,mode:MODE,design:DESIGN,release:RELEASE,journeyId,
    selectedObject:session.selectedObject||'',recognizedSpecimen:session.recognizedSpecimen||'',recognitionMethod:session.recognitionMethod||'',...data};
  session.events.push(e);send({eventName:JOURNEY?.eventLabel||CFG.EVENT_NAME||'Guided Object Journey',sessionId:session.id,event:e,userAgent:navigator.userAgent});
}
function beginExperience(){event('session-start');show('welcome')}
function newSession(){
  session={id:uid(),startedAt:Date.now(),mode:MODE,selectedObject:'',recognizedSpecimen:'',recognitionMethod:'',scanAttempts:0,scanStartedAt:null,scanSuccessAt:null,scanTimeMs:null,manualBypass:false,observe:null,noticedNew:null,next:null,completed:false,events:[]};
  $('studyCode').textContent='Study code '+session.id.slice(0,6).toUpperCase();event('page-open');
}
function updateRoute(active=''){
  document.querySelectorAll('[data-route-stop]').forEach(li=>{const id=li.dataset.routeStop;li.classList.toggle('complete',visited.has(id));li.classList.toggle('current',id===active);if(id===active)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current')});
  $('routeProgress').textContent=active?('Current: '+routeName(active)+'. '+visited.size+' stops completed.'):'Journey ready.';
}

async function loadTraining(){
  if(!RECOGNITION_CLASSES.length)return false;
  let data=null;try{const r=await fetch('training.json?v='+Date.now(),{cache:'no-store'});if(r.ok)data=await r.json()}catch{}
  if(!data?.classes)return false;
  const required=[...RECOGNITION_CLASSES,'other','background'];
  if(!required.every(k=>Object.prototype.hasOwnProperty.call(data.classes,k)))return false;
  const ds={};
  for(const label of required){
    const o=data.classes[label];
    if(!Array.isArray(o?.shape)||o.shape.length!==2||o.shape[0]<1||o.shape[1]!==1280||!Array.isArray(o.data)||o.data.length!==o.shape[0]*o.shape[1]||!o.data.every(Number.isFinite))return false;
    ds[label]=tf.tensor(o.data,o.shape);
  }
  classifier.setClassifierDataset(ds);return required.every(k=>(classifier.getClassExampleCount()?.[k]||0)>0);
}
function cropFrame(){if(!video.videoWidth)return null;const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;crop.width=224;crop.height=224;cctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop}
function activation(){const frame=cropFrame();return frame?model.infer(frame,true):null}
function setScanState(kind,text){$('scanState').className='scan-state status-'+kind;const icon=kind==='recognized'?'✓':kind==='unavailable'?'!':kind==='holding'?'◉':'◌';$('scanState').innerHTML='<span aria-hidden="true">'+icon+'</span> '+text;$('cameraStatus').textContent=text}
async function startCamera(){
  if(!ready){openManualSelection('model');return}
  stopCamera();const generation=cameraGeneration;session.scanAttempts++;session.scanStartedAt=session.scanStartedAt||Date.now();event('scan-start',{attempt:session.scanAttempts});
  const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  if(generation!==cameraGeneration){acquired.getTracks().forEach(t=>t.stop());return}
  stream=acquired;video.srcObject=stream;await video.play();stable=0;stableLabel='';setScanState('looking','Looking');raf=requestAnimationFrame(loop);
}
function stopCamera(){cameraGeneration++;if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null}
async function loop(ts){
  if(!stream)return;const generation=cameraGeneration;
  try{if(ts-lastInfer>250){lastInfer=ts;const a=activation();if(a){try{const r=await classifier.predictClass(a,5),p=r.confidences||{},conf=p[r.label]||0;if(generation!==cameraGeneration)return;current={label:r.label,confidence:conf,probabilities:p};renderPrediction()}finally{a.dispose()}}}}
  catch(e){event('scan-error',{message:String(e)});stopCamera();openManualSelection('runtime');return}
  if(stream&&generation===cameraGeneration)raf=requestAnimationFrame(loop);
}
function renderPrediction(){
  const cls=current.label,artifactId=recognitionArtifact(cls),conf=current.confidence||0,positive=!!artifactId&&conf>=.78;
  if(positive){stable=stableLabel===cls?stable+1:1;stableLabel=cls;setScanState(stable>=3?'recognized':'holding',stable>=3?'Recognized':'Hold steady');$('guidance').textContent='Keep the object centered.'}
  else{stable=0;stableLabel='';setScanState('looking','Looking');$('guidance').textContent=cls==='background'?'Move closer to the object.':'Center one journey object.'}
  overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;ctx.clearRect(0,0,overlay.width,overlay.height);
  const w=overlay.width*.66,h=overlay.height*.66,x=(overlay.width-w)/2,y=(overlay.height-h)/2;ctx.strokeStyle=positive?'#FFC72C':'#aaa';ctx.lineWidth=Math.max(3,overlay.width/260);ctx.strokeRect(x,y,w,h);
  if(stable>=4)completeRecognition(artifactId,cls,current.confidence,current.probabilities,false);
}
function completeRecognition(artifactId,cls='',confidence=1,probabilities={},simulated=false){
  if(session.scanSuccessAt||!isArtifact(artifactId))return;
  session.selectedObject=artifactId;session.recognizedSpecimen=cls||artifact(artifactId)?.recognitionClass||'';session.recognitionMethod=simulated?'simulated':'model';
  session.scanSuccessAt=Date.now();session.scanTimeMs=session.scanStartedAt?session.scanSuccessAt-session.scanStartedAt:0;
  event('scan-success',{recognizedSpecimen:session.recognizedSpecimen,artifactId,confidence,probabilities,scanTimeMs:session.scanTimeMs,simulated});
  stopCamera();applyArtifactContent(artifactId);setTimeout(()=>show('observe'),180);
}
function completeManual(artifactId,reason='camera'){
  if(!isArtifact(artifactId))return;session.selectedObject=artifactId;session.recognizedSpecimen='';session.recognitionMethod='manual';session.manualBypass=true;
  event('manual-selection',{selectedObject:artifactId,reason});stopCamera();applyArtifactContent(artifactId);show('observe');
}
function chooseArtifact(artifactId){
  const a=artifact(artifactId);if(!a)return;
  if(MODE==='test'){session.scanStartedAt=session.scanStartedAt||Date.now();event('test-recognition-simulated',{selectedObject:artifactId,recognitionClass:a.recognitionClass||''});completeRecognition(artifactId,a.recognitionClass||'',1,{[a.recognitionClass||artifactId]:1},true)}
  else completeManual(artifactId,'manual-fallback');
}
function openManualSelection(reason='camera'){
  if(MODE==='test'){$('scanPanelTitle').textContent='Choose a stop';$('scanPanelText').textContent='Simulate recognition for any artifact in this journey.'}
  else{setScanState('unavailable','Recognition unavailable');$('scanPanelTitle').textContent='Choose the table label';$('scanPanelText').textContent='Recognition is being skipped. Choose the label beside the object.'}
  $('testScanPanel').classList.remove('hidden');$('scanState').classList.add('hidden');event('manual-fallback-shown',{reason});
}

function configureReference(a){
  const fig=$('referenceFigure'),img=$('referenceImage'),caption=$('referenceCaption'),cue=$('promptCue');fig.classList.add('hidden');cue.classList.add('hidden');img.removeAttribute('src');img.alt='';
  if(a.referenceImage){img.src=a.referenceImage;img.alt=a.referenceAlt||'Reference image';caption.textContent=a.referenceCaption||'Look at the reference image.';fig.classList.remove('hidden');cue.textContent=a.referenceCaption||'Look at the reference image.';cue.classList.remove('hidden')}
}
function renderNoticeChoices(a){
  const root=$('noticeChoices');root.innerHTML='';const choices=a.notice?.choices||[];
  for(const choice of choices){
    const b=document.createElement('button');b.className='choice';b.dataset.observe=choice.value||choice.label;b.innerHTML='<b>'+esc(choice.label||'Choice')+'</b><span>'+esc(choice.detail||'')+'</span>';
    b.onclick=()=>{session.observe=b.dataset.observe;event('observe-choice',{value:session.observe,choiceLabel:choice.label||''});show('discover')};root.appendChild(b);
  }
}
function applyArtifactContent(id){
  const a=artifact(id);if(!a)return;updateRoute(id);
  $('recognitionKind').textContent=session.recognitionMethod==='manual'?'Selected:':session.recognitionMethod==='simulated'?'Simulated:':'Recognized:';
  $('recognizedName').textContent=a.tableLabel||a.name||id;$('scenarioContext').textContent=a.scenarioLabel?('Story: '+a.scenarioLabel):'';
  configureReference(a);$('noticeQuestion').textContent=a.notice?.question||'What do you notice?';renderNoticeChoices(a);
  const d=a.discover||{};
  if(d.title||d.text){$('fossilFactTitle').textContent=d.title||'';$('fossilFactText').textContent=d.text||'';$('sourceText').textContent=d.source||'';
    if(d.uncertainty){$('uncertaintyText').textContent=d.uncertainty;$('uncertaintyText').classList.remove('hidden')}else $('uncertaintyText').classList.add('hidden');
    $('fossilFact').classList.remove('hidden');$('curatorNote').classList.add('hidden')
  }else{$('fossilFact').classList.add('hidden');$('curatorNote').classList.remove('hidden')}
}
function resetControls(){
  document.querySelectorAll('[aria-pressed="true"]').forEach(x=>x.setAttribute('aria-pressed','false'));document.querySelectorAll('.choice.selected').forEach(x=>x.classList.remove('selected'));
  document.querySelectorAll('[data-noticed]').forEach(x=>{x.disabled=false;x.setAttribute('aria-pressed','false')});document.querySelectorAll('details').forEach(x=>x.open=false);
  $('feedbackSummary').textContent='Optional feedback';$('noticeFeedback').classList.remove('hidden');$('missionComplete').classList.add('hidden');$('nextStopCard').classList.remove('hidden');
  $('finishExperience').classList.remove('hidden');$('tryAnother').classList.remove('hidden');$('tryAnother').textContent='Continue';$('testScanPanel').classList.add('hidden');$('scanState').classList.remove('hidden');setScanState('looking','Looking');$('guidance').textContent='Move close enough for it to fill most of the frame.';$('optionalFeedback').classList.remove('hidden');
}
function beginNewJourney(){stopCamera();journeyId=uid();visited=new Set();resetControls();updateRoute();newSession();event('session-start');show('welcome')}
function beginNextSession(){stopCamera();resetControls();newSession();event('session-start');show('camera');if(MODE==='test')openManualSelection('test');else startCamera().catch(e=>{event('camera-error',{message:String(e)});openManualSelection('permission')})}
function finishSession(action){if(session.completed)return;if(session.selectedObject)visited.add(session.selectedObject);session.next=action;session.completed=true;session.totalMs=Date.now()-session.startedAt;event('session-complete',{totalMs:session.totalMs,scanTimeMs:session.scanTimeMs,observe:session.observe,noticedNew:session.noticedNew,next:session.next,manualBypass:session.manualBypass})}
function showNextStop(){
  const a=artifact(session.selectedObject),next=nextArtifactId(session.selectedObject);
  $('nextStopNumber').textContent=routeNumber(next||'finale');
  if(next==='finale'){$('nextStopName').textContent=a?.next?.label||('Stop '+routeNumber('finale')+' · '+routeName('finale'));$('missionPrompt').textContent=a?.next?.direction||'Continue to the finale.'}
  else{const n=artifact(next);$('nextStopName').textContent=a?.next?.label||n?.tableLabel||n?.name||'Next stop';$('missionPrompt').textContent=a?.next?.direction||('Find '+(n?.tableLabel||'the next stop')+'.')}
  $('tryAnother').textContent=next==='finale'?'Continue to finale':'Continue';$('finishExperience').textContent='Finish';$('nextStopCard').classList.remove('hidden');$('missionComplete').classList.add('hidden');
}
function showFinished(message='',subtext=''){
  $('nextStopCard').classList.add('hidden');$('optionalFeedback').classList.add('hidden');$('tryAnother').classList.add('hidden');$('finishExperience').classList.add('hidden');$('missionComplete').classList.remove('hidden');
  renderFinaleCopy();if(message)$('missionCompleteText').textContent=message;if(subtext)$('missionCompleteSubtext').textContent=subtext;
}
function showFinale(){visited.add('finale');updateRoute('finale');showFinished()}

$('startExperience').onclick=()=>{show('camera');if(MODE==='test'){session.scanAttempts++;session.scanStartedAt=Date.now();event('scan-start',{attempt:1,simulated:true});openManualSelection('test')}else startCamera().catch(e=>{event('camera-error',{message:String(e)});openManualSelection('permission')})};
$('restart').onclick=beginNewJourney;$('scanHelp').onclick=()=>{stopCamera();openManualSelection('user')};$('loadingFallback').onclick=()=>{show('camera');openManualSelection('model')};$('manualStart').onclick=()=>{show('camera');openManualSelection('model')};
$('toConnection').onclick=()=>{showNextStop();show('connection')};
document.querySelectorAll('[data-noticed]').forEach(b=>b.onclick=()=>{session.noticedNew=b.dataset.noticed;event('noticed-new',{value:session.noticedNew});document.querySelectorAll('[data-noticed]').forEach(x=>{x.disabled=true;x.setAttribute('aria-pressed',x===b?'true':'false');x.classList.toggle('selected',x===b)});$('noticeFeedback').classList.add('hidden');$('optionalFeedback').open=false;$('feedbackSummary').textContent='Feedback saved'});
$('tryAnother').onclick=()=>{const next=nextArtifactId(session.selectedObject);finishSession('continue');event('route-continue',{destination:next||'finale'});if(!next||next==='finale'){showFinale();return}beginNextSession()};
$('finishExperience').onclick=()=>{finishSession('finish');event('experience-finished');showFinished('Thanks for exploring.','You chose to end the journey here.')};
$('startAgainFinale').onclick=()=>{event('finale-start-again');beginNewJourney()};$('learnMoreProject').onclick=()=>event('finale-learn-more');

(async()=>{
  try{
    JOURNEY=await loadJourney();initializeJourney(JOURNEY);newSession();updateRoute();
    if(MODE==='test'){$('testModeNotice').classList.remove('hidden');event('test-mode-ready',{draft:USE_DRAFT});beginExperience();return}
    event('model-load-start');
    try{await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();event('model-library-ready');ready=await loadTraining();if(ready){event('training-ready');beginExperience()}else{event('training-missing');beginExperience()}}
    catch(e){event('model-load-error',{message:String(e)});beginExperience()}
  }catch(e){console.error(e);$('loadingMsg').textContent='Journey could not load.';$('loadingFallback').classList.add('hidden')}
})();