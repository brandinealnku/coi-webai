const STORAGE_TRAINING='cmc-fossil-lab-training-v3';
const STORAGE_SESSIONS='cmc-fossil-lab-sessions-v3';
const LABELS={fossil:'Fossil',other:'Other object',background:'Background'};
const SCREENS=['Invite','Camera','Observe','Reveal','Connection','Reaction','Thanks'];

let featureModel=null,classifier=null;
let visitorStream=null,researchStream=null,visitorFacing='environment',researchFacing='environment';
let visitorRunning=false,researchRunning=false,visitorRAF=null,lastInfer=0;
let stableFossilFrames=0,currentPrediction=null,currentSession=null;
let sessions=loadJSON(STORAGE_SESSIONS,[]);
let evidence=[];
const cropCanvas=document.createElement('canvas'),cropCtx=cropCanvas.getContext('2d',{willReadFrequently:true});
const shotCanvas=document.createElement('canvas'),shotCtx=shotCanvas.getContext('2d');

const $=id=>document.getElementById(id);
const visitorVideo=$('visitorVideo'),visitorOverlay=$('visitorOverlay'),vctx=visitorOverlay.getContext('2d');
const researchVideo=$('researchVideo');

function loadJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
function saveJSON(key,value){localStorage.setItem(key,JSON.stringify(value))}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'s-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function now(){return Date.now()}
function secs(ms){return Math.max(0,Math.round(ms/1000))}
function median(values){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function showScreen(name){
  SCREENS.forEach(n=>$('screen'+n).classList.toggle('active',n===name));
  if(currentSession){currentSession.events.push({type:'screen',screen:name.toLowerCase(),at:new Date().toISOString(),elapsedMs:now()-currentSession.startedAt});}
}
function startSession(){
  currentSession={id:uuid(),startedAt:now(),startedAtISO:new Date().toISOString(),completed:false,scanStartedAt:null,scanSucceededAt:null,scanTimeMs:null,scanAttempts:0,manualBypass:false,observeChoice:null,lookCloserResponse:null,nextAction:null,events:[]};
  showScreen('Invite');
}
function finalizeSession(){
  if(!currentSession)return;
  currentSession.completed=true;currentSession.completedAtISO=new Date().toISOString();currentSession.totalMs=now()-currentSession.startedAt;
  sessions.push(currentSession);saveJSON(STORAGE_SESSIONS,sessions);$('sessionTime').textContent=formatDuration(currentSession.totalMs);renderDashboard();
}
function formatDuration(ms){const s=Math.max(1,secs(ms));return s<60?s+' sec':Math.floor(s/60)+'m '+(s%60)+'s'}
function classifierCounts(){const c=classifier?.getClassExampleCount?.()||{};return{fossil:c.fossil||0,other:c.other||0,background:c.background||0}}
function trainingReady(){const c=classifierCounts();return c.fossil>=3&&c.other>=3&&c.background>=3}
function cropFrame(video){
  if(!video.videoWidth||!video.videoHeight)return null;
  const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;
  cropCanvas.width=224;cropCanvas.height=224;cropCtx.drawImage(video,sx,sy,side,side,0,0,224,224);return cropCanvas;
}
function activationFor(video){const frame=cropFrame(video);return frame&&featureModel?featureModel.infer(frame,true):null}
async function startStream(video,kind){
  const facing=kind==='visitor'?visitorFacing:researchFacing;
  const existing=kind==='visitor'?visitorStream:researchStream;
  if(existing)existing.getTracks().forEach(t=>t.stop());
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;await video.play();
  if(kind==='visitor'){visitorStream=stream;visitorRunning=true;if(visitorRAF)cancelAnimationFrame(visitorRAF);visitorRAF=requestAnimationFrame(visitorLoop);}
  else{researchStream=stream;researchRunning=true;updateResearchControls();}
}
function stopStream(kind){
  const stream=kind==='visitor'?visitorStream:researchStream;
  if(stream)stream.getTracks().forEach(t=>t.stop());
  if(kind==='visitor'){visitorStream=null;visitorRunning=false;visitorVideo.srcObject=null;if(visitorRAF)cancelAnimationFrame(visitorRAF);}
  else{researchStream=null;researchRunning=false;researchVideo.srcObject=null;updateResearchControls();}
}
async function visitorLoop(ts){
  if(!visitorRunning)return;
  if(ts-lastInfer>260&&classifier&&trainingReady()){
    lastInfer=ts;const a=activationFor(visitorVideo);
    if(a){try{
      const r=await classifier.predictClass(a,5),p=r.confidences||{},label=r.label||'',conf=p[label]||0;
      currentPrediction={label,confidence:conf,probabilities:{fossil:p.fossil||0,other:p.other||0,background:p.background||0}};
      renderVisitorPrediction(currentPrediction);
    }finally{a.dispose()}}
  }
  visitorRAF=requestAnimationFrame(visitorLoop);
}
function renderVisitorPrediction(pred){
  const fossil=pred.probabilities.fossil||0;
  if(pred.label==='fossil'&&fossil>=.78){stableFossilFrames++;$('scanStatus').textContent=stableFossilFrames>=3?'Found it.':'Hold steady…';$('cameraGuidance').textContent='Keep the fossil in the frame for just a moment.';}
  else{stableFossilFrames=Math.max(0,stableFossilFrames-1);$('scanStatus').textContent='Looking…';$('cameraGuidance').textContent=pred.label==='background'?'Move closer so the fossil fills more of the frame.':'Try centering the fossil and holding still.';}
  drawVisitorGuide(pred.label);
  if(stableFossilFrames>=4)recognitionSuccess(pred);
}
function drawVisitorGuide(label){
  visitorOverlay.width=visitorVideo.videoWidth||640;visitorOverlay.height=visitorVideo.videoHeight||480;vctx.clearRect(0,0,visitorOverlay.width,visitorOverlay.height);
  const w=visitorOverlay.width*.66,h=visitorOverlay.height*.66,x=(visitorOverlay.width-w)/2,y=(visitorOverlay.height-h)/2;
  vctx.strokeStyle=label==='fossil'?'#34d399':'rgba(244,181,28,.8)';vctx.lineWidth=Math.max(3,visitorOverlay.width/260);vctx.strokeRect(x,y,w,h);
}
function captureVisitorSnapshot(){
  const w=visitorVideo.videoWidth||640,h=visitorVideo.videoHeight||480;shotCanvas.width=w;shotCanvas.height=h;shotCtx.drawImage(visitorVideo,0,0,w,h);
  return shotCanvas.toDataURL('image/jpeg',.68);
}
function recognitionSuccess(pred){
  if(!currentSession||currentSession.scanSucceededAt)return;
  currentSession.scanSucceededAt=now();currentSession.scanTimeMs=currentSession.scanStartedAt?currentSession.scanSucceededAt-currentSession.scanStartedAt:null;
  currentSession.events.push({type:'recognition-success',confidence:pred.confidence,probabilities:pred.probabilities,elapsedMs:now()-currentSession.startedAt});
  evidence.unshift({id:uuid(),sessionId:currentSession.id,timestamp:new Date().toISOString(),confidence:pred.confidence,probabilities:pred.probabilities,snapshot:captureVisitorSnapshot()});
  stopStream('visitor');setTimeout(()=>showScreen('Observe'),350);
}
async function beginVisitorScan(){
  if(!trainingReady()){alert('This device needs a saved fossil training set before Visitor Mode can run. Open Research Mode to set it up.');return}
  currentSession.scanAttempts++;currentSession.scanStartedAt=currentSession.scanStartedAt||now();stableFossilFrames=0;showScreen('Camera');
  try{await startStream(visitorVideo,'visitor')}catch(e){console.error(e);$('scanStatus').textContent='Camera permission needed';$('cameraGuidance').textContent='Allow camera access in your browser, then try again.'}
}
function manualContinue(){
  if(!currentSession)return;currentSession.manualBypass=true;currentSession.events.push({type:'manual-scan-bypass',elapsedMs:now()-currentSession.startedAt});stopStream('visitor');showScreen('Observe');
}
function applyReveal(choice){
  const map={
    shape:['Shape is one of the first clues.','The outline of an object can help researchers compare it with other specimens and decide what details deserve a closer look.'],
    texture:['Texture can hold important clues.','Ridges, pits, lines, and surface changes can help researchers compare specimens and ask what processes may have shaped them.'],
    pattern:['Patterns can point to relationships.','Repeated structures can help researchers compare one specimen with another and notice similarities that are easy to miss at first glance.']
  };
  const [h,c]=map[choice]||map.shape;$('revealHeading').textContent=h;$('revealCopy').textContent=c;
}
function serializeTraining(){
  if(!classifier)return null;const ds=classifier.getClassifierDataset(),out={version:1,createdAt:new Date().toISOString(),classes:{}};
  Object.entries(ds).forEach(([label,t])=>{out.classes[label]={shape:t.shape,data:Array.from(t.dataSync())}});
  return out;
}
function restoreTraining(saved){
  if(!saved?.classes||!classifier)return false;const ds={};
  for(const [label,obj] of Object.entries(saved.classes)){ds[label]=tf.tensor(obj.data,obj.shape)}
  classifier.setClassifierDataset(ds);return true;
}
function saveTraining(){
  const payload=serializeTraining();if(!payload)return;localStorage.setItem(STORAGE_TRAINING,JSON.stringify(payload));$('savedBadge').textContent='Saved on device';$('savedBadge').classList.add('ready');updateTrainingUI();
}
function loadTraining(){
  try{const raw=localStorage.getItem(STORAGE_TRAINING);if(!raw)return false;const ok=restoreTraining(JSON.parse(raw));if(ok){$('savedBadge').textContent='Saved on device';$('savedBadge').classList.add('ready')}return ok}catch(e){console.warn(e);return false}
}
async function addTrainingExample(label){
  const a=activationFor(researchVideo);if(!a)return;classifier.addExample(a,label);a.dispose();updateTrainingUI();
}
function updateTrainingUI(){
  const c=classifierCounts();$('rcFossil').textContent=c.fossil;$('rcOther').textContent=c.other;$('rcBackground').textContent=c.background;
  ['rAddFossil','rAddOther','rAddBackground'].forEach(id=>$(id).disabled=!researchRunning);
  $('saveTrainingBtn').disabled=!(c.fossil>=3&&c.other>=3&&c.background>=3);
  const strong=c.fossil>=10&&c.other>=10&&c.background>=10;
  $('setupReadiness').textContent=strong?'Strong AI Day baseline: at least 10 examples in every class.':'Aim for at least 10 examples per class before AI Day.';
  $('setupReadiness').classList.toggle('ready',strong);
}
function updateResearchControls(){$('researchStartCameraBtn').disabled=researchRunning;$('researchStopCameraBtn').disabled=!researchRunning;updateTrainingUI()}
function openResearch(){stopStream('visitor');$('visitorApp').classList.add('hidden');$('researchApp').classList.remove('hidden');renderDashboard();renderResearchEvidence()}
function closeResearch(){stopStream('research');$('researchApp').classList.add('hidden');$('visitorApp').classList.remove('hidden');startSession()}
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
  ['Setup','Dashboard','Evidence'].forEach(n=>$('tab'+n).classList.toggle('active',n.toLowerCase()===name));
  if(name==='dashboard')renderDashboard();if(name==='evidence')renderResearchEvidence();
}
function pct(n,d){return d?Math.round(n/d*100)+'%':'—'}
function renderBars(el,data){
  const total=Object.values(data).reduce((a,b)=>a+b,0)||1;
  el.innerHTML=Object.entries(data).map(([k,v])=>'<div class="bar-row"><span>'+k+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(v/total*100)+'%"></div></div><b>'+v+'</b></div>').join('')||'<div class="empty-state">No data yet.</div>';
}
function renderDashboard(){
  const total=sessions.length,complete=sessions.filter(s=>s.completed).length,scanSuccess=sessions.filter(s=>s.scanSucceededAt).length;
  const scanTimes=sessions.map(s=>s.scanTimeMs).filter(Number.isFinite),dwell=sessions.map(s=>s.totalMs).filter(Number.isFinite);
  const looked=sessions.filter(s=>s.lookCloserResponse==='yes'||s.lookCloserResponse==='a-little').length;
  $('mSessions').textContent=total;$('mCompletion').textContent=pct(complete,total);$('mScanSuccess').textContent=pct(scanSuccess,total);$('mScanTime').textContent=median(scanTimes)!=null?formatDuration(median(scanTimes)):'—';$('mLookCloser').textContent=pct(looked,complete);$('mDwell').textContent=median(dwell)!=null?formatDuration(median(dwell)):'—';
  const observe={'Shape':0,'Texture':0,'Pattern':0},next={'Learn fossil':0,'Related object':0,'Scan another':0,'Ask question':0,'Finished':0};
  sessions.forEach(s=>{if(s.observeChoice)observe[s.observeChoice[0].toUpperCase()+s.observeChoice.slice(1)]++;const map={'learn-about-fossil':'Learn fossil','find-related-object':'Related object','scan-something-else':'Scan another','ask-a-question':'Ask question','finished':'Finished'};if(map[s.nextAction])next[map[s.nextAction]]++});
  renderBars($('observeBreakdown'),observe);renderBars($('nextBreakdown'),next);
  if(!total){$('sessionTable').innerHTML='<div class="empty-state">No visitor sessions yet.</div>';return}
  $('sessionTable').innerHTML=sessions.slice().reverse().slice(0,30).map(s=>'<div class="session-row"><span>'+new Date(s.startedAtISO).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span><span>'+(s.completed?'Completed':'Incomplete')+'</span><span>'+(s.scanSucceededAt?'Scan success':s.manualBypass?'Manual bypass':'No scan')+'</span><span>'+(s.nextAction||'—')+'</span><span>'+(s.totalMs?formatDuration(s.totalMs):'—')+'</span></div>').join('');
}
function renderResearchEvidence(){
  if(!evidence.length){$('researchEvidenceGrid').innerHTML='<div class="empty-state">No scan evidence captured in this browser session yet.</div>';return}
  $('researchEvidenceGrid').innerHTML=evidence.map(e=>'<article class="evidence-item"><img src="'+e.snapshot+'" alt="Successful fossil recognition evidence snapshot"><div class="evidence-copy"><strong>'+Math.round(e.confidence*100)+'% fossil confidence</strong><span>'+new Date(e.timestamp).toLocaleTimeString()+' · Session '+e.sessionId.slice(0,8)+'</span></div></article>').join('');
}
function exportResearch(){
  const payload={experiment:'CMC Fossil Experience Lab — AI Day V3',exportedAt:new Date().toISOString(),trainingCounts:classifierCounts(),sessions,evidence:evidence.map(({snapshot,...rest})=>rest),summary:{sessions:sessions.length,completed:sessions.filter(s=>s.completed).length,scanSuccesses:sessions.filter(s=>s.scanSucceededAt).length}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cmc-fossil-experience-ai-day-research.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// Visitor events
$('beginBtn').addEventListener('click',beginVisitorScan);
$('cancelScanBtn').addEventListener('click',()=>{stopStream('visitor');startSession()});
$('manualContinueBtn').addEventListener('click',manualContinue);
document.querySelectorAll('.observe-choice').forEach(b=>b.addEventListener('click',()=>{currentSession.observeChoice=b.dataset.choice;currentSession.events.push({type:'observe-choice',value:b.dataset.choice,elapsedMs:now()-currentSession.startedAt});applyReveal(b.dataset.choice);showScreen('Reveal')}));
$('continueConnectionBtn').addEventListener('click',()=>showScreen('Connection'));
$('continueReactionBtn').addEventListener('click',()=>showScreen('Reaction'));
document.querySelectorAll('.reaction-look').forEach(b=>b.addEventListener('click',()=>{currentSession.lookCloserResponse=b.dataset.choice;currentSession.events.push({type:'look-closer-response',value:b.dataset.choice,elapsedMs:now()-currentSession.startedAt});document.querySelectorAll('.reaction-look').forEach(x=>x.disabled=true);$('nextQuestion').classList.remove('hidden')}));
document.querySelectorAll('.next-choice').forEach(b=>b.addEventListener('click',()=>{currentSession.nextAction=b.dataset.choice;currentSession.events.push({type:'next-action',value:b.dataset.choice,elapsedMs:now()-currentSession.startedAt});finalizeSession();showScreen('Thanks')}));
$('nextVisitorBtn').addEventListener('click',()=>startSession());

// Research events
$('researchModeBtn').addEventListener('click',openResearch);$('closeResearchBtn').addEventListener('click',closeResearch);
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));
$('researchStartCameraBtn').addEventListener('click',async()=>{try{await startStream(researchVideo,'research')}catch(e){alert('Camera access failed. Allow camera permission and try again.')}});
$('researchStopCameraBtn').addEventListener('click',()=>stopStream('research'));
$('researchFlipBtn').addEventListener('click',async()=>{researchFacing=researchFacing==='environment'?'user':'environment';if(researchRunning)await startStream(researchVideo,'research')});
$('rAddFossil').addEventListener('click',()=>addTrainingExample('fossil'));$('rAddOther').addEventListener('click',()=>addTrainingExample('other'));$('rAddBackground').addEventListener('click',()=>addTrainingExample('background'));
$('saveTrainingBtn').addEventListener('click',saveTraining);
$('clearTrainingBtn').addEventListener('click',()=>{if(!confirm('Clear the saved classifier and all training examples on this device?'))return;classifier.clearAllClasses();localStorage.removeItem(STORAGE_TRAINING);$('savedBadge').textContent='Not saved';$('savedBadge').classList.remove('ready');updateTrainingUI()});
$('exportResearchBtn').addEventListener('click',exportResearch);
$('clearSessionsBtn').addEventListener('click',()=>{if(!confirm('Clear all saved AI Day visitor session data on this device?'))return;sessions=[];saveJSON(STORAGE_SESSIONS,sessions);renderDashboard()});

(async function init(){
  try{
    await tf.setBackend('webgl');await tf.ready();featureModel=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();loadTraining();$('modelBadge').textContent='Model ready';$('modelBadge').classList.add('ready');updateTrainingUI();
  }catch(e){console.error(e);$('modelBadge').textContent='Model error'}
  startSession();
})();