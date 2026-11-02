const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
let journey=null,targets=[],model=null,stream=null,raf=null,lastInfer=0,negativeRows=[],negativeNorm=[],targetSets=[],assetsPromise=null;
let currentStage=0,currentDecision=null,currentScores=null,selectedFeature='',stableFrames=0,lastCandidate='',recognitionTriggered=false,recognizedTarget=null,reflection={look:'',trust:'',value:''},sessionId=crypto.randomUUID?crypto.randomUUID():'lab-'+Date.now();
const video=$('video'),crop=document.createElement('canvas'),ctx=crop.getContext('2d',{willReadFrequently:true});

function send(type,data={}){
  if(!ENDPOINT)return;
  const event={type,at:new Date().toISOString(),mode:'lab',release:'computer-vision-lab-multitarget-2026-11-02',journeyId:journey?.id||'',selectedObject:recognizedTarget?.id||'',recognizedSpecimen:recognizedTarget?.recognitionClass||currentDecision||'',recognitionMethod:'model',...data};
  try{fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({eventName:journey?.eventLabel||'NKU AI Day 2026',sessionId,event,userAgent:navigator.userAgent}),keepalive:true}).catch(()=>{})}catch{}
}
async function loadJourney(){const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Could not load journey configuration.');return r.json()}
function jsonp(url){return new Promise((resolve,reject)=>{const cb='lab_'+Date.now()+'_'+Math.random().toString(16).slice(2),s=document.createElement('script'),cleanup=()=>{try{delete window[cb]}catch{};s.remove()};window[cb]=d=>{cleanup();resolve(d)};s.onerror=()=>{cleanup();reject(new Error('Could not load shared training.'))};s.src=url+'&callback='+encodeURIComponent(cb)+'&_='+Date.now();document.body.appendChild(s)})}
function norm(v){let s=0;for(const x of v)s+=x*x;return Math.sqrt(s)||1}
function normalize(v){const n=norm(v);return v.map(x=>x/n)}
function cosine(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s}
function bestSimilarity(vec,rows){let best=-1;for(const r of rows){const s=cosine(vec,r);if(s>best)best=s}return best}
function cropFrame(){if(!video.videoWidth)return null;const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;crop.width=224;crop.height=224;ctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop}
function embedding(){const f=cropFrame();if(!f)return null;const t=model.infer(f,true),arr=Array.from(t.dataSync());t.dispose();return normalize(arr)}
function show(id){for(const s of ['intro','challenge','camera','result','reflection','finale'])$(s).classList.toggle('hidden',s!==id);window.scrollTo({top:0,behavior:'smooth'})}
function renderProgress(){const labels=['Scan a Rock','Reflect'];$('progress').innerHTML='';labels.forEach((x,i)=>{const s=document.createElement('span');s.textContent=x;if(currentStage>0&&i===0)s.classList.add('done');if((currentStage===0&&i===0)||(currentStage>0&&i===1))s.classList.add('active');$('progress').appendChild(s)})}
function renderChallenge(){
  renderProgress();
  $('challengeName').textContent='Choose any trained rock';
  $('challengeObject').textContent='Use whichever Target Rock is available at the table.';
  $('expectedBehavior').textContent='recognize which trained rock you are holding';
  $('challengeDirection').textContent='Place one trained rock inside the camera box and slowly change the angle. The AI will identify the best-matching trained object.';
  show('challenge');send('lab-challenge-open',{expected:'recognize one trained target'})
}
async function loadTraining(){
  const data=await jsonp(ENDPOINT+'?action=training');
  negativeRows=[...(data?.classes?.other||[]),...(data?.classes?.background||[])];
  negativeNorm=negativeRows.map(normalize);
  targetSets=targets.map(t=>({target:t,rows:(data?.classes?.[t.recognitionClass]||[]).map(normalize)})).filter(x=>x.rows.length>=2);
  if(!targetSets.length)throw new Error('No trained target rocks are available yet.');
}
async function warmRecognitionAssets(){
  if(model&&targetSets.length)return;
  if(assetsPromise)return assetsPromise;
  assetsPromise=(async()=>{if(!model){await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1})}if(!targetSets.length)await loadTraining()})();
  try{await assetsPromise}catch(e){assetsPromise=null;throw e}
}
async function startCamera(){
  const btn=$('beginCamera');btn.disabled=true;btn.textContent='Opening camera…';
  currentDecision=null;currentScores=null;stableFrames=0;lastCandidate='';recognitionTriggered=false;recognizedTarget=null;
  $('recognitionFlash').classList.add('hidden');document.querySelector('.stage')?.classList.remove('recognized');$('recordCameraResult').disabled=true;
  $('decisionText').textContent='Starting camera…';$('targetScore').textContent='—';$('rejectScore').textContent='—';$('decisionExplanation').textContent='Camera is opening while the AI finishes getting ready.';$('analysisStatus').textContent='Opening camera…';$('cameraChallenge').textContent='Scan any trained rock';show('camera');
  const cameraPromise=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  const assets=warmRecognitionAssets();
  stream=await cameraPromise;video.srcObject=stream;await video.play();$('analysisStatus').textContent='Camera ready. Finishing AI setup…';
  await assets;
  $('decisionText').textContent='Looking for a trained rock…';$('decisionExplanation').textContent='The AI is comparing this view with all trained Target Rocks.';$('analysisStatus').textContent='Center one trained rock and slowly change the angle.';
  btn.disabled=false;btn.textContent='Test with camera';raf=requestAnimationFrame(loop)
}
function stopCamera(){if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null}
function loop(ts){
  if(!stream)return;if(ts-lastInfer<300){raf=requestAnimationFrame(loop);return}lastInfer=ts;
  try{
    const e=embedding();
    if(e){
      const ranked=targetSets.map(s=>({target:s.target,score:bestSimilarity(e,s.rows)})).sort((a,b)=>b.score-a.score);
      const best=ranked[0],second=ranked[1]||{score:-1},reject=negativeNorm.length?bestSimilarity(e,negativeNorm):-1;
      const recognized=best&&best.score>=.70;
      currentDecision=recognized?'recognized':'rejected';
      currentScores={target:best?.score??-1,second:second.score,reject,margin:(best?.score??-1)-second.score};
      $('targetScore').textContent=best?((best.score*100).toFixed(1)+'% · '+(best.target.name||best.target.id)):'—';
      $('rejectScore').textContent=reject>=0?(reject*100).toFixed(1)+'%':'—';
      $('decisionText').textContent=recognized?'✓ POSSIBLE MATCH: '+(best.target.name||'TRAINED ROCK'):'○ LOOKING FOR A TRAINED ROCK';
      $('focusBox').className='focus-box '+(recognized?'match':'reject');$('focusLabel').textContent=recognized?'POSSIBLE MATCH':'CENTER ROCK HERE';
      $('decisionExplanation').textContent='Recognition gate: best trained-rock similarity ≥ 70% for 3 consecutive frames.';
      $('recordCameraResult').disabled=false;

      if(!recognitionTriggered){
        const candidate=recognized?(best.target.recognitionClass||best.target.id):'';
        if(recognized&&candidate===lastCandidate)stableFrames++;else stableFrames=recognized?1:0;
        lastCandidate=candidate;
        $('analysisStatus').textContent=recognized
          ? 'Possible '+(best.target.name||'rock')+' match — hold steady… '+Math.min(stableFrames,3)+'/3'
          : 'Looking for a trained rock. Keep it centered and slowly change the angle.';
        if(recognized&&stableFrames>=3){
          recognitionTriggered=true;recognizedTarget=best.target;currentDecision='recognized';
          $('recognitionFlashName').textContent=recognizedTarget.name||'Trained Rock';$('recognitionFlash').classList.remove('hidden');document.querySelector('.stage')?.classList.add('recognized');$('analysisStatus').textContent=(recognizedTarget.name||'Rock')+' recognized.';
          send('lab-recognition-moment',{decision:'recognized',recognizedObjectId:recognizedTarget.id,recognizedObjectName:recognizedTarget.name,recognizedClass:recognizedTarget.recognitionClass,probabilities:currentScores||{}});
          try{if(navigator.vibrate)navigator.vibrate([80,40,120])}catch{}
          setTimeout(()=>recordResult('recognized'),1100);return;
        }
      }
    }
  }catch(e){$('analysisStatus').textContent='Analysis error: '+e.message}
  if(stream)raf=requestAnimationFrame(loop)
}
function recordResult(decision=currentDecision){
  stopCamera();$('recognitionFlash').classList.add('hidden');document.querySelector('.stage')?.classList.remove('recognized');currentDecision=decision||'unavailable';
  const correct=currentDecision==='recognized',c=recognizedTarget||targets[0]||{};
  $('resultHeadline').textContent=correct?'The AI recognized a trained rock.':'The AI did not recognize a trained rock.';
  $('resultSummary').textContent=correct?'Recognized: '+(recognizedTarget?.name||'Trained Rock')+'.':'No trained rock was confirmed.';
  const outcome=$('outcomeState');outcome.className='result-outcome '+(correct?'expected':'unexpected');outcome.textContent=correct?'✓ Recognition confirmed':'! No confirmed recognition';
  $('resultLesson').innerHTML='<strong>'+((c.discover?.title)||'What this tells us')+'</strong><br>'+((c.discover?.text)||'This result is evidence about the recognition approach.');
  selectedFeature='';$('continueChallenge').disabled=true;renderFeatureChoices();
  send('lab-model-result',{decision:currentDecision,outcome:correct?'recognized':'not-recognized',recognizedObjectId:recognizedTarget?.id||'',recognizedObjectName:recognizedTarget?.name||'',recognizedClass:recognizedTarget?.recognitionClass||'',probabilities:currentScores||{}});
  show('result')
}
function renderFeatureChoices(){const opts=['Shape','Color','Texture / pattern','Background','I’m not sure'],root=$('featureChoices');root.innerHTML='';for(const label of opts){const b=document.createElement('button');b.className='secondary';b.textContent=label;b.onclick=()=>{selectedFeature=label;[...root.children].forEach(x=>x.classList.toggle('selected',x===b));$('continueChallenge').disabled=false};root.appendChild(b)}}
function nextChallenge(){send('lab-feature-reflection',{outcome:selectedFeature,recognizedObjectName:recognizedTarget?.name||''});currentStage=1;renderProgress();renderReflection();show('reflection')}
function choiceGroup(id,options,key){const root=$(id);root.innerHTML='';for(const label of options){const b=document.createElement('button');b.className='secondary';b.textContent=label;b.onclick=()=>{reflection[key]=label;[...root.children].forEach(x=>x.classList.toggle('selected',x===b));$('finishReflection').disabled=!(reflection.look&&reflection.trust&&reflection.value)};root.appendChild(b)}}
function renderReflection(){choiceGroup('lookChoices',['Yes','Maybe','No'],'look');choiceGroup('trustChoices',['Computer vision','QR code','Manual object selection','A combination'],'trust');choiceGroup('valueChoices',['Yes','Maybe','No'],'value')}
function finish(){send('lab-cmc-reflection',{outcome:'look='+reflection.look+'; trust='+reflection.trust+'; value='+reflection.value,recognizedObjectName:recognizedTarget?.name||'',probabilities:{look:reflection.look,trust:reflection.trust,value:reflection.value}});$('outcomeState').className='result-outcome hidden';const f=journey.finale||{};$('completionLabel').textContent=(f.title||'Experiment complete').toUpperCase();$('finaleHeadline').textContent=f.headline||'Experiment complete.';$('finaleBody').textContent=f.body||'';$('learnMore').textContent=f.learnMoreLabel||'Why this matters for CMC';$('learnMore').href=f.learnMoreUrl||'project.html';show('finale')}
function reset(){stopCamera();currentStage=0;currentDecision=null;currentScores=null;selectedFeature='';stableFrames=0;lastCandidate='';recognitionTriggered=false;recognizedTarget=null;reflection={look:'',trust:'',value:''};sessionId=crypto.randomUUID?crypto.randomUUID():'lab-'+Date.now();$('recognitionFlash').classList.add('hidden');document.querySelector('.stage')?.classList.remove('recognized');$('outcomeState').className='result-outcome hidden';renderProgress();show('intro');send('lab-restart')}
$('startLab').onclick=()=>{send('lab-start');renderChallenge();warmRecognitionAssets().catch(e=>{console.error(e);send('lab-preload-error',{outcome:e.message||'asset preload failed'})})};
$('beginCamera').onclick=()=>startCamera().catch(e=>{const btn=$('beginCamera');btn.disabled=false;btn.textContent='Try camera again';$('decisionText').textContent='Camera could not start';$('analysisStatus').textContent='Camera/model error: '+e.message;show('camera')});
$('skipCamera').onclick=()=>recordResult('unavailable');$('recordCameraResult').onclick=()=>recordResult();$('stopCamera').onclick=()=>{stopCamera();$('analysisStatus').textContent='Camera stopped.'};$('continueChallenge').onclick=nextChallenge;$('finishReflection').onclick=finish;$('restartLab').onclick=reset;

(async()=>{try{
  journey=await loadJourney();targets=(journey.artifacts||[]).filter(a=>a.recognitionClass);
  $('brandTitle').textContent=journey.title||'Computer Vision Lab';$('brandLine').textContent=journey.brandLine||'';$('eventLabel').textContent=journey.eventLabel||'';
  $('introEyebrow').textContent=journey.welcome?.eyebrow||'COMPUTER VISION LAB';$('introHeadline').textContent=journey.welcome?.headline||'Can the AI tell what it’s looking at?';$('introBody').textContent=journey.welcome?.body||'';$('privacyText').textContent=journey.privacy?.body||'';$('startLab').textContent=journey.welcome?.startButton||'Start the experiment';renderProgress();send('lab-page-open')
}catch(e){$('introBody').textContent='The lab could not load: '+e.message}})();