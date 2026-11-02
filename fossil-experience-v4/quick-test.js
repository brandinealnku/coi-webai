const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
let journey=null,model=null,classifier=null,stream=null,raf=null,target='',classes=[];
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
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;await video.play();$('startCamera').disabled=true;$('stopCamera').disabled=false;loop();
}
function stopCamera(){if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;$('startCamera').disabled=false;$('stopCamera').disabled=true;$('result').textContent='Stopped';$('result').className='result'}
async function loop(){
  if(!stream)return;
  try{
    const a=activation();
    if(a){const r=await classifier.predictClass(a,5);a.dispose();const conf=(r.confidences||{})[r.label]||0;
      const isTarget=r.label===target;
      $('result').textContent=isTarget?'TARGET: '+target:'NOT TARGET: '+r.label;
      $('result').className='result '+(isTarget?(conf>=.78?'good':'warn'):'bad');
      $('confidence').textContent='Top confidence: '+Math.round(conf*100)+'%';
      $('probabilities').innerHTML=classes.map(c=>'<div class="stat"><strong>'+c+'</strong><span>'+Math.round(((r.confidences||{})[c]||0)*100)+'%</span></div>').join('');
    }
  }catch(e){console.error(e)}
  if(stream)raf=requestAnimationFrame(loop);
}
$('loadTraining').onclick=()=>loadTraining().catch(e=>$('trainingStatus').textContent=e.message);
$('startCamera').onclick=()=>startCamera().catch(e=>$('trainingStatus').textContent='Camera error: '+e.message);
$('stopCamera').onclick=stopCamera;
(async()=>{try{
  journey=await loadJourney();const select=$('targetClass');
  for(const a of journey.artifacts||[]){if(!a.recognitionClass)continue;const o=document.createElement('option');o.value=a.recognitionClass;o.textContent='Stop '+a.stopNumber+' · '+(a.name||a.id)+' ('+a.recognitionClass+')';select.appendChild(o)}
  await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});
  if(!select.options.length)$('trainingStatus').textContent='No recognition classes are configured in the journey.';
}catch(e){$('trainingStatus').textContent=e.message}})();