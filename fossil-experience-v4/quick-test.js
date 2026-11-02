const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
let journey=null,model=null,stream=null,raf=null,target='',targetRows=[],negativeRows=[];
let centroid=null,threshold=.85,framesAnalyzed=0,lastAnalysisAt=0,stable=0,lastPositive=false;
const video=$('video'),crop=document.createElement('canvas'),ctx=crop.getContext('2d',{willReadFrequently:true});

async function loadJourney(){const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Could not load journey.json');return r.json()}
function jsonp(url){return new Promise((resolve,reject)=>{const cb='quick_'+Date.now()+'_'+Math.random().toString(16).slice(2),s=document.createElement('script'),cleanup=()=>{try{delete window[cb]}catch{};s.remove()};window[cb]=d=>{cleanup();resolve(d)};s.onerror=()=>{cleanup();reject(new Error('Could not load shared training.'))};s.src=url+'&callback='+encodeURIComponent(cb)+'&_='+Date.now();document.body.appendChild(s)})}
function cropFrame(){if(!video.videoWidth)return null;const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;crop.width=224;crop.height=224;ctx.drawImage(video,sx,sy,side,side,0,0,224,224);return crop}
function embedding(){const f=cropFrame();if(!f)return null;const t=model.infer(f,true),arr=Array.from(t.dataSync());t.dispose();return arr}
function norm(v){let s=0;for(const x of v)s+=x*x;return Math.sqrt(s)||1}
function normalize(v){const n=norm(v);return v.map(x=>x/n)}
function cosine(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s}
function meanVector(rows){
 const out=new Array(rows[0].length).fill(0);
 for(const r of rows)for(let i=0;i<r.length;i++)out[i]+=r[i];
 for(let i=0;i<out.length;i++)out[i]/=rows.length;
 return normalize(out);
}
function percentile(sorted,p){if(!sorted.length)return 0;const i=Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*p)));return sorted[i]}
function scoreRows(rows){return rows.map(r=>cosine(normalize(r),centroid)).sort((a,b)=>a-b)}
function renderCounts(data){
 const t=data?.classes?.[target]?.length||0,o=data?.classes?.other?.length||0,b=data?.classes?.background?.length||0;
 $('counts').innerHTML=
   '<div class="stat"><strong>'+target+' examples</strong><span>'+t+'</span></div>'+
   '<div class="stat"><strong>Other rejection examples</strong><span>'+o+'</span></div>'+
   '<div class="stat"><strong>Background rejection examples</strong><span>'+b+'</span></div>';
}
async function loadTraining(){
 target=$('targetClass').value;if(!target)return;
 $('trainingStatus').textContent='Loading shared training…';
 const data=await jsonp(ENDPOINT+'?action=training');
 targetRows=data?.classes?.[target]||[];
 negativeRows=[...(data?.classes?.other||[]),...(data?.classes?.background||[])];
 renderCounts(data);
 if(targetRows.length<2)throw new Error('Need at least 2 '+target+' examples.');
 centroid=meanVector(targetRows);
 const pos=scoreRows(targetRows),neg=scoreRows(negativeRows);
 const posFloor=percentile(pos,.10);
 const maxNeg=neg.length?Math.max(...neg):0;
 if(neg.length&&posFloor>maxNeg){
   threshold=(posFloor+maxNeg)/2;
   $('trainingStatus').textContent='One-class verifier ready. '+targetRows.length+' fossil examples define the target; '+negativeRows.length+' rejection examples help set the cutoff.';
 }else if(neg.length){
   threshold=Math.max(.82,posFloor);
   $('trainingStatus').textContent='One-class verifier loaded, but target and rejection examples overlap. Current cutoff is conservative; add more varied fossil1 and rejection photos if false positives continue.';
 }else{
   threshold=Math.max(.85,posFloor-.03);
   $('trainingStatus').textContent='One-class verifier loaded with no rejection examples. It can test fossil similarity, but add Other/Background examples to improve the cutoff.';
 }
 $('trainingStatus').textContent+=' Match cutoff: '+Math.round(threshold*100)+'%.';
 $('startCamera').disabled=false;
}
async function startCamera(){
 if(!centroid){$('cameraStatus').textContent='Load training first.';return}
 $('cameraStatus').textContent='Requesting camera permission…';
 stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
 video.srcObject=stream;await video.play();framesAnalyzed=0;stable=0;lastPositive=false;
 $('cameraStatus').textContent='Camera started. Center the fossil inside the box.';
 $('analysisStatus').textContent='Waiting for first frame…';
 $('startCamera').disabled=true;$('stopCamera').disabled=false;raf=requestAnimationFrame(loop);
}
function stopCamera(){if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;stable=0;lastPositive=false;$('focusBox').className='focus-box';$('boxLabel').textContent='CENTER FOSSIL HERE';$('startCamera').disabled=false;$('stopCamera').disabled=true;$('result').textContent='Stopped';$('result').className='result';$('cameraStatus').textContent='Camera stopped.'}
async function loop(ts){
 if(!stream)return;if(ts-lastAnalysisAt<250){raf=requestAnimationFrame(loop);return}lastAnalysisAt=ts;
 try{
   const e=embedding();
   if(!e){$('analysisStatus').textContent='Camera is on, but no usable frame is available yet.'}
   else{
     const score=cosine(normalize(e),centroid),positive=score>=threshold;
     stable=(positive&&lastPositive)?stable+1:(positive?1:0);lastPositive=positive;
     const recognized=stable>=4;framesAnalyzed++;
     $('analysisStatus').textContent='Analyzing live camera · frame '+framesAnalyzed;
     $('focusBox').className='focus-box '+(recognized?'recognized':positive?'':'rejected');
     $('boxLabel').textContent=recognized?'FOSSIL1 RECOGNIZED':positive?'HOLD STEADY':'NOT FOSSIL1';
     $('result').textContent=recognized?'RECOGNIZED: '+target:(positive?'POSSIBLE MATCH':'REJECTED');
     $('result').className='result '+(recognized?'good':positive?'warn':'bad');
     $('confidence').textContent='Fossil match score: '+Math.round(score*100)+'% · cutoff: '+Math.round(threshold*100)+'% · stable frames: '+stable+'/4';
     $('probabilities').innerHTML=
       '<div class="stat"><strong>fossil1 match</strong><span>'+Math.round(score*100)+'%</span></div>'+
       '<div class="stat"><strong>decision</strong><span>'+(score>=threshold?'candidate':'reject')+'</span></div>';
   }
 }catch(e){console.error(e);$('analysisStatus').textContent='Analysis error: '+(e?.message||String(e));$('result').textContent='ANALYSIS ERROR';$('result').className='result bad'}
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