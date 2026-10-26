const LABELS={fossil:'THIS FOSSIL',other:'OTHER OBJECT',background:'BACKGROUND'};
const video=document.getElementById('video'),overlay=document.getElementById('overlay'),ctx=overlay.getContext('2d');
const modelStatus=document.getElementById('modelStatus'),modelDot=document.getElementById('modelDot');
const startBtn=document.getElementById('startBtn'),stopBtn=document.getElementById('stopBtn'),flipBtn=document.getElementById('flipBtn');
const addFossilBtn=document.getElementById('addFossilBtn'),addOtherBtn=document.getElementById('addOtherBtn'),addBackgroundBtn=document.getElementById('addBackgroundBtn');
const lockBtn=document.getElementById('lockBtn'),scanBtn=document.getElementById('scanBtn'),resetBtn=document.getElementById('resetBtn');
const fossilCount=document.getElementById('fossilCount'),otherCount=document.getElementById('otherCount'),backgroundCount=document.getElementById('backgroundCount');
const trainingPanel=document.getElementById('trainingPanel'),testingPanel=document.getElementById('testingPanel'),trainingState=document.getElementById('trainingState'),phasePill=document.getElementById('phasePill');
const liveLabel=document.getElementById('liveLabel'),fossilProb=document.getElementById('fossilProb'),otherProb=document.getElementById('otherProb'),backgroundProb=document.getElementById('backgroundProb');
const resultTitle=document.getElementById('resultTitle'),resultDetail=document.getElementById('resultDetail');
const metricTests=document.getElementById('metricTests'),metricCorrect=document.getElementById('metricCorrect'),metricAccuracy=document.getElementById('metricAccuracy'),metricFalsePos=document.getElementById('metricFalsePos'),metricFalseNeg=document.getElementById('metricFalseNeg'),metricConfidence=document.getElementById('metricConfidence');
const evidenceGrid=document.getElementById('evidenceGrid'),successGate=document.getElementById('successGate'),exportBtn=document.getElementById('exportBtn'),clearEvidenceBtn=document.getElementById('clearEvidenceBtn');
const truthButtons=[...document.querySelectorAll('.truth-btn')];
const phaseTrain=document.getElementById('phaseTrain'),phaseLock=document.getElementById('phaseLock'),phaseTest=document.getElementById('phaseTest');

let featureModel=null,classifier=null,stream=null,facingMode='environment',running=false,locked=false,scanning=false,raf=null,lastInfer=0,currentPrediction=null;
let tests=[],evidence=[];
const cropCanvas=document.createElement('canvas'),cropCtx=cropCanvas.getContext('2d',{willReadFrequently:true});
const shotCanvas=document.createElement('canvas'),shotCtx=shotCanvas.getContext('2d');

function setModelStatus(text,mode=''){modelStatus.textContent=text;modelDot.className='dot'+(mode?' '+mode:'');}
function counts(){const c=classifier?classifier.getClassExampleCount():{};return{fossil:c.fossil||0,other:c.other||0,background:c.background||0};}
function updateTrainingUI(){
  const c=counts();fossilCount.textContent=c.fossil;otherCount.textContent=c.other;backgroundCount.textContent=c.background;
  const enough=c.fossil>=3&&c.other>=3&&c.background>=3;
  lockBtn.disabled=!running||locked||!enough;
  addFossilBtn.disabled=!running||locked;addOtherBtn.disabled=!running||locked;addBackgroundBtn.disabled=!running||locked;
}
function cropFrame(){
  if(!video.videoWidth||!video.videoHeight)return null;
  const side=Math.min(video.videoWidth,video.videoHeight)*.64,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;
  cropCanvas.width=224;cropCanvas.height=224;cropCtx.drawImage(video,sx,sy,side,side,0,0,224,224);return cropCanvas;
}
function getActivation(){const frame=cropFrame();if(!frame||!featureModel)return null;return featureModel.infer(frame,true);}
async function addExample(label){
  if(locked)return;const activation=getActivation();if(!activation)return;
  classifier.addExample(activation,label);activation.dispose();updateTrainingUI();
  resultTitle.textContent=LABELS[label]+' example added';resultDetail.textContent='Keep varying angle, distance, lighting, and framing.';
}
function setPhase(mode){
  [phaseTrain,phaseLock,phaseTest].forEach(x=>x.classList.remove('active','done'));
  if(mode==='train'){phaseTrain.classList.add('active');phasePill.textContent='TRAINING OPEN';}
  if(mode==='locked'){phaseTrain.classList.add('done');phaseLock.classList.add('done');phaseTest.classList.add('active');phasePill.textContent='TRAINING LOCKED · TEST MODE';}
}
function lockTraining(){
  const c=counts();if(c.fossil<3||c.other<3||c.background<3)return;
  locked=true;scanning=false;trainingState.textContent='LOCKED';trainingState.classList.add('locked');
  trainingPanel.classList.add('hidden');testingPanel.classList.remove('hidden');scanBtn.disabled=!running;
  truthButtons.forEach(b=>b.disabled=true);setPhase('locked');
  resultTitle.textContent='Training locked';resultDetail.textContent=`Frozen set: ${c.fossil} fossil · ${c.other} other · ${c.background} background examples.`;
}
function probs(result){
  const conf=result?.confidences||{};return{fossil:conf.fossil||0,other:conf.other||0,background:conf.background||0};
}
function renderPrediction(result){
  const p=probs(result),label=result?.label||'';
  currentPrediction={label,confidence:p[label]||0,probabilities:p};
  fossilProb.textContent=Math.round(p.fossil*100)+'%';otherProb.textContent=Math.round(p.other*100)+'%';backgroundProb.textContent=Math.round(p.background*100)+'%';
  liveLabel.textContent=LABELS[label]||'No prediction';
  resultTitle.textContent=LABELS[label]||'No prediction';
  resultDetail.textContent=`Confidence ${Math.round((p[label]||0)*100)}% · Fossil ${Math.round(p.fossil*100)}% · Other ${Math.round(p.other*100)}% · Background ${Math.round(p.background*100)}%`;
  drawGuide(label);
}
function drawGuide(label){
  overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;ctx.clearRect(0,0,overlay.width,overlay.height);
  if(!scanning)return;const w=overlay.width*.64,h=overlay.height*.64,x=(overlay.width-w)/2,y=(overlay.height-h)/2;
  ctx.strokeStyle=label==='fossil'?'#34d399':label==='other'?'#60a5fa':'#f7b718';ctx.lineWidth=Math.max(3,overlay.width/260);ctx.strokeRect(x,y,w,h);
}
async function scanLoop(ts){
  if(!running)return;
  if(scanning&&locked&&classifier.getNumClasses()>=3&&ts-lastInfer>240){
    lastInfer=ts;const activation=getActivation();
    if(activation){try{const result=await classifier.predictClass(activation,5);renderPrediction(result);}catch(e){console.warn(e);}finally{activation.dispose();}}
  }
  raf=requestAnimationFrame(scanLoop);
}
async function startCamera(){
  try{
    if(stream)stream.getTracks().forEach(t=>t.stop());
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;await video.play();running=true;startBtn.disabled=true;stopBtn.disabled=false;updateTrainingUI();if(locked)scanBtn.disabled=false;
    liveLabel.textContent='Camera live';if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(scanLoop);
  }catch(err){console.error(err);alert('Camera access failed. Open over HTTPS and allow camera permission.');}
}
function stopCamera(){
  running=false;scanning=false;if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;ctx.clearRect(0,0,overlay.width,overlay.height);
  startBtn.disabled=false;stopBtn.disabled=true;scanBtn.disabled=true;truthButtons.forEach(b=>b.disabled=true);updateTrainingUI();liveLabel.textContent='Camera stopped';
}
function captureSnapshot(){
  const w=video.videoWidth||640,h=video.videoHeight||480;shotCanvas.width=w;shotCanvas.height=h;shotCtx.drawImage(video,0,0,w,h);
  return shotCanvas.toDataURL('image/jpeg',.78);
}
function recordTest(expected){
  if(!scanning||!currentPrediction)return;
  const predicted=currentPrediction.label,confidence=currentPrediction.confidence,correct=predicted===expected;
  const item={id:crypto.randomUUID(),timestamp:new Date().toISOString(),expected,predicted,confidence,probabilities:{...currentPrediction.probabilities},correct,snapshot:captureSnapshot()};
  tests.unshift(item);evidence.unshift(item);renderMetrics();renderEvidence();
  resultTitle.textContent=correct?'Correct test recorded':'Mismatch recorded';
  resultDetail.textContent=`Expected ${LABELS[expected]} · predicted ${LABELS[predicted]} · ${Math.round(confidence*100)}% confidence.`;
}
function renderMetrics(){
  const total=tests.length,correct=tests.filter(t=>t.correct).length;
  const falsePos=tests.filter(t=>t.expected!=='fossil'&&t.predicted==='fossil').length;
  const falseNeg=tests.filter(t=>t.expected==='fossil'&&t.predicted!=='fossil').length;
  const avg=total?tests.reduce((s,t)=>s+t.confidence,0)/total:0;
  metricTests.textContent=total;metricCorrect.textContent=correct;metricAccuracy.textContent=total?Math.round(correct/total*100)+'%':'—';metricFalsePos.textContent=falsePos;metricFalseNeg.textContent=falseNeg;metricConfidence.textContent=total?Math.round(avg*100)+'%':'—';
  exportBtn.disabled=!total;clearEvidenceBtn.disabled=!total;
  const nonFossil=tests.filter(t=>t.expected!=='fossil').length,fpr=nonFossil?falsePos/nonFossil:0,accuracy=total?correct/total:0;
  successGate.classList.remove('pass','fail');
  if(total>=20&&accuracy>=.9&&fpr<=.1){successGate.classList.add('pass');successGate.innerHTML='<strong>Evidence gate: PASS.</strong> ≥20 held-out tests, ≥90% accuracy, and fossil false-positive rate ≤10%.';}
  else if(total>=20){successGate.classList.add('fail');successGate.innerHTML=`<strong>Evidence gate: NOT YET.</strong> Accuracy ${Math.round(accuracy*100)}% · fossil false-positive rate ${Math.round(fpr*100)}%. Review failures before expanding scope.`;}
  else successGate.innerHTML=`<strong>Evidence gate:</strong> ${20-total} more held-out test${20-total===1?'':'s'} needed. Target ≥90% overall accuracy with ≤10% fossil false-positive rate.`;
}
function renderEvidence(){
  if(!evidence.length){evidenceGrid.innerHTML='<div class="empty-state">No validation tests recorded yet.</div>';return;}
  evidenceGrid.innerHTML=evidence.slice(0,30).map((e,i)=>`<article class="evidence-item"><img src="${e.snapshot}" alt="Evidence snapshot ${evidence.length-i}" /><div class="evidence-copy"><div class="evidence-top"><strong>${LABELS[e.expected]}</strong><span class="${e.correct?'badge-correct':'badge-wrong'}">${e.correct?'CORRECT':'MISMATCH'}</span></div><p>Predicted: ${LABELS[e.predicted]} · ${Math.round(e.confidence*100)}% confidence<br>${new Date(e.timestamp).toLocaleTimeString()}</p></div></article>`).join('');
}
function resetAll(){
  if(!confirm('Reset training examples and all validation evidence?'))return;
  classifier.clearAllClasses();locked=false;scanning=false;currentPrediction=null;tests=[];evidence=[];
  trainingPanel.classList.remove('hidden');testingPanel.classList.add('hidden');trainingState.textContent='OPEN';trainingState.classList.remove('locked');
  scanBtn.textContent='Start live classification';fossilProb.textContent=otherProb.textContent=backgroundProb.textContent='—';liveLabel.textContent=running?'Camera live':'Waiting to start';
  resultTitle.textContent='Experiment reset';resultDetail.textContent='Add new examples to all three classes.';setPhase('train');updateTrainingUI();renderMetrics();renderEvidence();
}
function exportResults(){
  const payload={experiment:'CMC Fossil Scan V2',exportedAt:new Date().toISOString(),trainingCounts:counts(),tests:tests.map(({snapshot,...t})=>t),summary:{total:tests.length,correct:tests.filter(t=>t.correct).length,falsePositives:tests.filter(t=>t.expected!=='fossil'&&t.predicted==='fossil').length,falseNegatives:tests.filter(t=>t.expected==='fossil'&&t.predicted!=='fossil').length}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cmc-fossil-scan-v2-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

startBtn.addEventListener('click',startCamera);stopBtn.addEventListener('click',stopCamera);flipBtn.addEventListener('click',async()=>{facingMode=facingMode==='environment'?'user':'environment';if(running)await startCamera();});
addFossilBtn.addEventListener('click',()=>addExample('fossil'));addOtherBtn.addEventListener('click',()=>addExample('other'));addBackgroundBtn.addEventListener('click',()=>addExample('background'));
lockBtn.addEventListener('click',lockTraining);scanBtn.addEventListener('click',()=>{scanning=!scanning;scanBtn.textContent=scanning?'Pause live classification':'Start live classification';truthButtons.forEach(b=>b.disabled=!scanning);liveLabel.textContent=scanning?'Classifying…':'Scan paused';});
truthButtons.forEach(b=>b.addEventListener('click',()=>recordTest(b.dataset.truth)));resetBtn.addEventListener('click',resetAll);exportBtn.addEventListener('click',exportResults);clearEvidenceBtn.addEventListener('click',()=>{tests=[];evidence=[];renderMetrics();renderEvidence();});

(async function init(){
  try{
    await tf.setBackend('webgl');await tf.ready();featureModel=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();setModelStatus('Vision + KNN ready','live');updateTrainingUI();renderMetrics();
  }catch(err){console.error(err);setModelStatus('Model failed to load','error');resultDetail.textContent='Check connection and browser console.';}
})();