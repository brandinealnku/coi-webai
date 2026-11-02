const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
let journey=null,model=null,classifier=null,stream=null,raf=null,target='',classes=[],stable=0,lastTarget=false,framesAnalyzed=0,lastAnalysisAt=0;
const video=$('video'),crop=document.createElement('canvas'),ctx=crop.getContext('2d',{willReadFrequently:true});
async function loadJourney(){const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Could not load journey.json');return r.json()}
function jsonp(url){return new Promise((resolve,reject)=>{const cb='quick_'+Date.now()+'_'+Math.random().toString(16).slice(2),s=document.createElement('script'),cleanup=()=>{try{delete window[cb]}catch{};s.remove()};window[cb]=d=>{cleanup();resolve(d)};s.onerror=()=>{cleanup();reject(new Error('Could not load shared training.'))};s.src=url+'&callback='+encodeURIComponent(cb)+'&_='+Date.now();document.body.appendChild(s)})}
function cropFrame(){if(!video.videoWidth)return null;const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;crop.width=224;crop.height=224;ctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop}
function activation(){const f=cropFrame();return f?model.infer(f,true):null}
function renderCounts(data){
  const root=$('counts');root.innerHTML='';
  for(const c of classes){const d=document.createElement('div');d.className='stat';d.innerHTML='<strong>'+c+'</strong><span>'+(data?.classes?.[c]?.length||0)+'</span>';root.appendChild(d)}
}
async function loadTraining(){
  target=$('targetClass').value;if(!target)return;
  $('trainingStatus').textContent='Loading shared training…';
  const data=await jsonp(ENDPOINT+'?action=training'),ds={};classes=[target,'other','background'];
  for(const c of classes){const rows=data?.classes?.[c]||[];if(rows.length)ds[c]=tf.tensor2d(rows,[rows.length,rows[0].length])}
  renderCounts(data);
  if(!ds[target])throw new Error('No shared training found for '+target+'.');
  classifier=knnClassifier.create();classifier.setClassifierDataset(ds);
  const negatives=(data?.classes?.other?.length||0)+(data?.classes?.background?.length||0);
  $('trainingStatus').textContent='Loaded '+(data.classes[target]?.length||0)+' target examples and '+negatives+' negative examples.'+(negatives<2?' Add a few Other or Background examples for a meaningful test.':'');
  $('startCamera').disabled=false;
}
async function startCamera(){
  $('cameraStatus').textContent='Requesting camera permission…';
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;
  await video.play();
  framesAnalyzed=0;stable=0;lastTarget=false;
  $('cameraStatus').textContent='Camera started. Center one object inside the box.';
  $('analysisStatus').textContent='Waiting for first frame…';
  $('startCamera').disabled=true;$('stopCamera').disabled=false;
  raf=requestAnimationFrame(loop);
}
function stopCamera(){if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;stable=0;lastTarget=false;$('focusBox').className='focus-box';$('boxLabel').textContent='CENTER OBJECT HERE';$('startCamera').disabled=false;$('stopCamera').disabled=true;$('result').textContent='Stopped';$('result').className='result';$('cameraStatus').textContent='Camera stopped.'}
async function loop(ts){
  if(!stream)return;
  if(ts-lastAnalysisAt<250){raf=requestAnimationFrame(loop);return}
  lastAnalysisAt=ts;
  try{
    const a=activation();
    if(!a){
      $('analysisStatus').textContent='Camera is on, but no usable frame is available yet.';
    }
    if(a){
      const r=await classifier.predictClass(a,5);a.dispose();
      const p=r.confidences||{},targetScore=p[target]||0;
      const negativeScore=Math.max(p.other||0,p.background||0);
      const margin=targetScore-negativeScore;
      const candidate=r.label===target&&targetScore>=.72&&margin>=.18;
      stable=(candidate&&lastTarget)?stable+1:(candidate?1:0);lastTarget=candidate;
      const recognized=stable>=4;
      framesAnalyzed++;
      $('analysisStatus').textContent='Analyzing live camera · frame '+framesAnalyzed+' · top class: '+r.label;
      $('focusBox').className='focus-box '+(recognized?'recognized':candidate?'':'rejected');
      $('boxLabel').textContent=recognized?'RECOGNIZED':candidate?'HOLD STEADY':'CENTER TARGET OBJECT';
      $('result').textContent=recognized?'RECOGNIZED: '+target:(candidate?'POSSIBLE: '+target:'NOT RECOGNIZED');
      $('result').className='result '+(recognized?'good':candidate?'warn':'bad');
      $('confidence').textContent='Similarity score: '+Math.round(targetScore*100)+'% · margin over negatives: '+Math.round(margin*100)+' pts · stable frames: '+stable+'/4';
      $('probabilities').innerHTML=classes.map(c=>'<div class="stat"><strong>'+c+'</strong><span>'+Math.round((p[c]||0)*100)+'%</span></div>').join('');
    }
  }catch(e){
    console.error(e);
    $('analysisStatus').textContent='Analysis error: '+(e?.message||String(e));
    $('result').textContent='ANALYSIS ERROR';
    $('result').className='result bad';
  }
  if(stream)raf=requestAnimationFrame(loop);
}
$('loadTraining').onclick=()=>loadTraining().catch(e=>$('trainingStatus').textContent=e.message);
$('startCamera').onclick=()=>startCamera().catch(e=>{$('cameraStatus').textContent='Camera error: '+e.message;$('trainingStatus').textContent='Camera could not start.'});
$('stopCamera').onclick=stopCamera;
(async()=>{try{
  journey=await loadJourney();const select=$('targetClass');
  for(const a of journey.artifacts||[]){if(!a.recognitionClass)continue;const o=document.createElement('option');o.value=a.recognitionClass;o.textContent='Stop '+a.stopNumber+' · '+(a.name||a.id)+' ('+a.recognitionClass+')';select.appendChild(o)}
  await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});
  if(!select.options.length)$('trainingStatus').textContent='No recognition classes are configured in the journey.';
}catch(e){$('trainingStatus').textContent=e.message}})();