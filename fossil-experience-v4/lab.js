const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
let journey=null,challenges=[],model=null,stream=null,raf=null,lastInfer=0,targetRows=[],negativeRows=[],targetNorm=[],negativeNorm=[],assetsPromise=null;
let currentIndex=0,currentDecision=null,currentScores=null,selectedFeature='',stableTargetFrames=0,recognitionTriggered=false,reflection={look:'',trust:'',value:''},sessionId=crypto.randomUUID?crypto.randomUUID():'lab-'+Date.now();
const video=$('video'),crop=document.createElement('canvas'),ctx=crop.getContext('2d',{willReadFrequently:true});

function send(type,data={}){
  if(!ENDPOINT)return;
  const event={type,at:new Date().toISOString(),mode:'lab',release:'computer-vision-lab-2026-11-02',journeyId:journey?.id||'',selectedObject:challenges[currentIndex]?.id||'',recognizedSpecimen:currentDecision||'',recognitionMethod:'model',...data};
  try{fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({eventName:journey?.eventLabel||'NKU AI Day 2026',sessionId,event,userAgent:navigator.userAgent}),keepalive:true}).catch(()=>{})}catch{}
}
async function loadJourney(){
  const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Could not load journey configuration.');return r.json()
}
function jsonp(url){return new Promise((resolve,reject)=>{const cb='lab_'+Date.now()+'_'+Math.random().toString(16).slice(2),s=document.createElement('script'),cleanup=()=>{try{delete window[cb]}catch{};s.remove()};window[cb]=d=>{cleanup();resolve(d)};s.onerror=()=>{cleanup();reject(new Error('Could not load shared training.'))};s.src=url+'&callback='+encodeURIComponent(cb)+'&_='+Date.now();document.body.appendChild(s)})}
function norm(v){let s=0;for(const x of v)s+=x*x;return Math.sqrt(s)||1}
function normalize(v){const n=norm(v);return v.map(x=>x/n)}
function cosine(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s}
function bestSimilarity(vec,rows){let best=-1;for(const r of rows){const s=cosine(vec,r);if(s>best)best=s}return best}
function cropFrame(){if(!video.videoWidth)return null;const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;crop.width=224;crop.height=224;ctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop}
function embedding(){const f=cropFrame();if(!f)return null;const t=model.infer(f,true),arr=Array.from(t.dataSync());t.dispose();return normalize(arr)}
function show(id){for(const s of ['intro','challenge','camera','result','reflection','finale'])$(s).classList.toggle('hidden',s!==id);window.scrollTo({top:0,behavior:'smooth'})}
function renderProgress(){
  const labels=[challenges[0]?.shortLabel||challenges[0]?.name||'Target Rock','Reflect'];$('progress').innerHTML='';
  labels.forEach((x,i)=>{const s=document.createElement('span');s.textContent=x;if(currentIndex>0&&i===0)s.classList.add('done');if((currentIndex===0&&i===0)||(currentIndex>0&&i===1))s.classList.add('active');$('progress').appendChild(s)})
}
function expectedFor(){return 'recognize the Target Rock'}
function expectedDecision(){return 'recognized'}
function renderChallenge(){
  const c=challenges[currentIndex];renderProgress();$('challengeName').textContent=c.name||'Challenge';$('challengeObject').textContent=c.physicalObjectName||'';$('expectedBehavior').textContent=expectedFor(currentIndex);$('challengeDirection').textContent=c.labInstruction||'Place the requested view inside the camera box.';show('challenge');send('lab-challenge-open',{challengeIndex:currentIndex,expected:expectedDecision(currentIndex)})
}
async function loadTraining(){
  const targetClass=challenges[0]?.recognitionClass||'fossil1';
  const data=await jsonp(ENDPOINT+'?action=training');
  targetRows=data?.classes?.[targetClass]||[];
  negativeRows=[...(data?.classes?.other||[]),...(data?.classes?.background||[])];
  if(targetRows.length<2)throw new Error('Not enough target training examples.');
  if(negativeRows.length<2)throw new Error('Add at least 2 Other/Background examples before running the lab.');
  targetNorm=targetRows.map(normalize);negativeNorm=negativeRows.map(normalize)
}
async function warmRecognitionAssets(){
  if(model&&targetNorm.length)return;
  if(assetsPromise)return assetsPromise;
  assetsPromise=(async()=>{
    if(!model){
      await tf.setBackend('webgl');
      await tf.ready();
      model=await mobilenet.load({version:2,alpha:1});
    }
    if(!targetNorm.length)await loadTraining();
  })();
  try{await assetsPromise}catch(e){assetsPromise=null;throw e}
}
async function startCamera(){
  const btn=$('beginCamera');
  btn.disabled=true;btn.textContent='Opening camera…';
  currentDecision=null;currentScores=null;stableTargetFrames=0;recognitionTriggered=false;
  $('recognitionFlash').classList.add('hidden');
  document.querySelector('.stage')?.classList.remove('recognized');
  $('recordCameraResult').disabled=true;
  $('decisionText').textContent='Starting camera…';
  $('targetScore').textContent='—';$('rejectScore').textContent='—';
  $('decisionExplanation').textContent='Camera is opening while the AI finishes getting ready.';
  $('analysisStatus').textContent='Opening camera…';
  $('cameraChallenge').textContent=challenges[currentIndex]?.name||'Live model';
  show('camera');

  const cameraPromise=navigator.mediaDevices.getUserMedia({
    video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},
    audio:false
  });
  const assets=warmRecognitionAssets();

  stream=await cameraPromise;
  video.srcObject=stream;
  await video.play();
  $('analysisStatus').textContent='Camera ready. Finishing AI setup…';

  await assets;
  $('decisionText').textContent='Looking for the Target Rock…';
  $('decisionExplanation').textContent='The AI is ready and analyzing the live camera view.';
  $('analysisStatus').textContent='Camera running. Hold the requested view inside the box and slowly change the angle.';
  btn.disabled=false;btn.textContent='Test with camera';
  raf=requestAnimationFrame(loop)
}
function stopCamera(){if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null}
function loop(ts){
  if(!stream)return;
  if(ts-lastInfer<300){raf=requestAnimationFrame(loop);return}lastInfer=ts;
  try{
    const e=embedding();
    if(e){
      const target=bestSimilarity(e,targetNorm),reject=bestSimilarity(e,negativeNorm),margin=target-reject;
      const targetChallenge=currentIndex===0;
      const recognized=targetChallenge ? target>=.70 : (target>=.90&&margin>=.025);
      currentDecision=recognized?'recognized':'rejected';currentScores={target,reject,margin};
      $('targetScore').textContent=(target*100).toFixed(1)+'%';$('rejectScore').textContent=(reject*100).toFixed(1)+'%';
      $('decisionText').textContent=recognized?'✓ TARGET MATCH':'○ NO TARGET MATCH';
      $('focusBox').className='focus-box '+(recognized?'match':'reject');
      $('focusLabel').textContent=recognized?'TARGET MATCH':'NO TARGET MATCH';
      $('decisionExplanation').textContent=targetChallenge
        ? 'Recognition gate: Target Rock similarity ≥ 70% for 3 consecutive frames.'
        : 'The AI compares this live view with the trained Target Rock and rejection examples.';
      $('recordCameraResult').disabled=false;

      if(currentIndex===0&&!recognitionTriggered){
        stableTargetFrames=recognized?stableTargetFrames+1:0;
        $('analysisStatus').textContent=recognized
          ? 'Possible Target Rock match — hold steady… '+Math.min(stableTargetFrames,3)+'/3'
          : 'Looking for the Target Rock. Recognition needs 70%+ similarity for 3 frames.';
        if(stableTargetFrames>=3){
          recognitionTriggered=true;
          $('recognitionFlashName').textContent=challenges[0]?.name||'Target Rock';
          $('recognitionFlash').classList.remove('hidden');
          document.querySelector('.stage')?.classList.add('recognized');
          $('analysisStatus').textContent='Target Rock recognized.';
          send('lab-recognition-moment',{challengeIndex:currentIndex,decision:'recognized',probabilities:currentScores||{}});
          try{if(navigator.vibrate)navigator.vibrate([80,40,120])}catch{}
          setTimeout(()=>recordResult('recognized'),1100);
          return;
        }
      }
    }
  }catch(e){$('analysisStatus').textContent='Analysis error: '+e.message}
  if(stream)raf=requestAnimationFrame(loop)
}
function recordResult(decision=currentDecision){
  stopCamera();$('recognitionFlash').classList.add('hidden');document.querySelector('.stage')?.classList.remove('recognized');currentDecision=decision||'unavailable';
  const expected=expectedDecision(currentIndex),correct=currentDecision===expected;
  const c=challenges[currentIndex];
  $('resultHeadline').textContent=correct?'The model behaved as expected.':'The model behaved differently than expected.';
  $('resultSummary').textContent='Expected: '+expected+'. Model result: '+currentDecision+'.';
  const outcome=$('outcomeState');outcome.className='result-outcome '+(correct?'expected':'unexpected');outcome.textContent=correct?'✓ Expected outcome':'! Different from expected';
  $('resultLesson').innerHTML='<strong>'+((c.discover?.title)||'What this tells us')+'</strong><br>'+((c.discover?.text)||'This result is evidence about the recognition approach.');
  selectedFeature='';$('continueChallenge').disabled=true;renderFeatureChoices();
  send('lab-model-result',{challengeIndex:currentIndex,expected,decision:currentDecision,outcome:correct?'correct':'incorrect',probabilities:currentScores||{}});
  show('result')
}
function renderFeatureChoices(){
  const opts=['Shape','Color','Texture / pattern','Background','I’m not sure'],root=$('featureChoices');root.innerHTML='';
  for(const label of opts){const b=document.createElement('button');b.className='secondary';b.textContent=label;b.onclick=()=>{selectedFeature=label;[...root.children].forEach(x=>x.classList.toggle('selected',x===b));$('continueChallenge').disabled=false};root.appendChild(b)}
}
function nextChallenge(){
  send('lab-feature-reflection',{outcome:selectedFeature});
  currentIndex=1;
  renderProgress();renderReflection();show('reflection')
}
function choiceGroup(id,options,key){
  const root=$(id);root.innerHTML='';
  for(const label of options){const b=document.createElement('button');b.className='secondary';b.textContent=label;b.onclick=()=>{reflection[key]=label;[...root.children].forEach(x=>x.classList.toggle('selected',x===b));$('finishReflection').disabled=!(reflection.look&&reflection.trust&&reflection.value)};root.appendChild(b)}
}
function renderReflection(){
  choiceGroup('lookChoices',['Yes','Maybe','No'],'look');
  choiceGroup('trustChoices',['Computer vision','QR code','Manual object selection','A combination'],'trust');
  choiceGroup('valueChoices',['Yes','Maybe','No'],'value')
}
function finish(){
  send('lab-cmc-reflection',{outcome:'look='+reflection.look+'; trust='+reflection.trust+'; value='+reflection.value,probabilities:{look:reflection.look,trust:reflection.trust,value:reflection.value}});
  $('outcomeState').className='result-outcome hidden';
  const f=journey.finale||{};$('completionLabel').textContent=(f.title||'Experiment complete').toUpperCase();$('finaleHeadline').textContent=f.headline||'Experiment complete.';$('finaleBody').textContent=f.body||'';$('learnMore').textContent=f.learnMoreLabel||'Why this matters for CMC';$('learnMore').href=f.learnMoreUrl||'project.html';show('finale')
}
function reset(){stopCamera();currentIndex=0;currentDecision=null;currentScores=null;selectedFeature='';stableTargetFrames=0;recognitionTriggered=false;reflection={look:'',trust:'',value:''};sessionId=crypto.randomUUID?crypto.randomUUID():'lab-'+Date.now();$('recognitionFlash').classList.add('hidden');document.querySelector('.stage')?.classList.remove('recognized');$('outcomeState').className='result-outcome hidden';renderProgress();show('intro');send('lab-restart')}
$('startLab').onclick=()=>{send('lab-start');renderChallenge();warmRecognitionAssets().catch(e=>{console.error(e);send('lab-preload-error',{outcome:e.message||'asset preload failed'})})};
$('beginCamera').onclick=()=>startCamera().catch(e=>{const btn=$('beginCamera');btn.disabled=false;btn.textContent='Try camera again';$('decisionText').textContent='Camera could not start';$('analysisStatus').textContent='Camera/model error: '+e.message;show('camera')});
$('skipCamera').onclick=()=>recordResult('unavailable');
$('recordCameraResult').onclick=()=>recordResult();
$('stopCamera').onclick=()=>{stopCamera();$('analysisStatus').textContent='Camera stopped.'};
$('continueChallenge').onclick=nextChallenge;
$('finishReflection').onclick=finish;
$('restartLab').onclick=reset;

(async()=>{try{
  journey=await loadJourney();challenges=(journey.artifacts||[]).slice(0,1);
  $('brandTitle').textContent=journey.title||'Computer Vision Lab';$('brandLine').textContent=journey.brandLine||'';$('eventLabel').textContent=journey.eventLabel||'';
  $('introEyebrow').textContent=journey.welcome?.eyebrow||'COMPUTER VISION LAB';$('introHeadline').textContent=journey.welcome?.headline||'Can the AI tell what it’s looking at?';$('introBody').textContent=journey.welcome?.body||'';$('privacyText').textContent=journey.privacy?.body||'';
  $('startLab').textContent=journey.welcome?.startButton||'Start the experiment';renderProgress();send('lab-page-open')
}catch(e){$('introBody').textContent='The lab could not load: '+e.message}})();