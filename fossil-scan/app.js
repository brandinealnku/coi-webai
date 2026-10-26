const video=document.getElementById('video');
const overlay=document.getElementById('overlay'),ctx=overlay.getContext('2d');
const modelStatus=document.getElementById('modelStatus'),modelDot=document.getElementById('modelDot');
const startBtn=document.getElementById('startBtn'),stopBtn=document.getElementById('stopBtn'),flipBtn=document.getElementById('flipBtn');
const addFossilBtn=document.getElementById('addFossilBtn'),addBackgroundBtn=document.getElementById('addBackgroundBtn'),scanBtn=document.getElementById('scanBtn');
const fossilCount=document.getElementById('fossilCount'),backgroundCount=document.getElementById('backgroundCount');
const threshold=document.getElementById('threshold'),thresholdLabel=document.getElementById('thresholdLabel');
const liveScore=document.getElementById('liveScore'),liveLabel=document.getElementById('liveLabel');
const resultTitle=document.getElementById('resultTitle'),resultDetail=document.getElementById('resultDetail'),resetBtn=document.getElementById('resetBtn');

let model=null,stream=null,facingMode='environment',running=false,scanning=false,raf=null,lastInfer=0;
let fossilExamples=[],backgroundExamples=[];
const cropCanvas=document.createElement('canvas'),cropCtx=cropCanvas.getContext('2d',{willReadFrequently:true});

function setModelStatus(text,mode=''){modelStatus.textContent=text;modelDot.className='dot'+(mode?' '+mode:'');}
function updateCounts(){fossilCount.textContent=fossilExamples.length;backgroundCount.textContent=backgroundExamples.length;scanBtn.disabled=!(running&&fossilExamples.length>=3&&backgroundExamples.length>=3);}
function cropFrame(){
  if(!video.videoWidth||!video.videoHeight)return null;
  const side=Math.min(video.videoWidth,video.videoHeight)*0.64;
  const sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;
  cropCanvas.width=224;cropCanvas.height=224;
  cropCtx.drawImage(video,sx,sy,side,side,0,0,224,224);
  return cropCanvas;
}
function embedding(){
  const frame=cropFrame();if(!frame||!model)return null;
  return tf.tidy(()=>model.infer(frame,true).squeeze());
}
async function captureExample(target){
  const emb=embedding();if(!emb)return;
  const values=Array.from(await emb.data());emb.dispose();
  target.push(values);updateCounts();
}
function cosine(a,b){
  let dot=0,aa=0,bb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
  return dot/(Math.sqrt(aa)*Math.sqrt(bb)+1e-8);
}
function meanTopSimilarity(sample,examples,n=3){
  if(!examples.length)return 0;
  const scores=examples.map(ex=>cosine(sample,ex)).sort((a,b)=>b-a);
  const top=scores.slice(0,Math.min(n,scores.length));
  return top.reduce((s,v)=>s+v,0)/top.length;
}
function drawGuide(score,isMatch){
  overlay.width=video.videoWidth||640;overlay.height=video.videoHeight||480;
  ctx.clearRect(0,0,overlay.width,overlay.height);
  if(!scanning)return;
  const w=overlay.width*.64,h=overlay.height*.64,x=(overlay.width-w)/2,y=(overlay.height-h)/2;
  ctx.strokeStyle=isMatch?'#34d399':'rgba(247,183,24,.85)';ctx.lineWidth=Math.max(3,overlay.width/260);
  ctx.strokeRect(x,y,w,h);
}
async function scanLoop(ts){
  if(!running){return;}
  if(scanning&&ts-lastInfer>260){
    lastInfer=ts;
    const emb=embedding();
    if(emb){
      const sample=Array.from(await emb.data());emb.dispose();
      const pos=meanTopSimilarity(sample,fossilExamples);
      const neg=meanTopSimilarity(sample,backgroundExamples);
      const adjusted=Math.max(0,Math.min(1,(pos-neg+.18)/.36));
      const pct=Math.round(adjusted*100);
      const cutoff=Number(threshold.value);
      const match=pct>=cutoff;
      liveScore.textContent=pct+'%';
      liveLabel.textContent=match?'Likely fossil match':'No confident match';
      resultTitle.textContent=match?'Fossil-like object detected':'No fossil match';
      resultDetail.textContent=`Positive similarity ${(pos*100).toFixed(1)}% · background similarity ${(neg*100).toFixed(1)}% · threshold ${cutoff}%`;
      drawGuide(pct,match);
    }
  }
  raf=requestAnimationFrame(scanLoop);
}
async function startCamera(){
  try{
    if(stream)stream.getTracks().forEach(t=>t.stop());
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;await video.play();running=true;
    startBtn.disabled=true;stopBtn.disabled=false;addFossilBtn.disabled=false;addBackgroundBtn.disabled=false;updateCounts();
    liveLabel.textContent='Camera live';raf=requestAnimationFrame(scanLoop);
  }catch(err){console.error(err);alert('Camera access failed. Open this page over HTTPS and allow camera permission.');}
}
function stopCamera(){running=false;scanning=false;if(raf)cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;ctx.clearRect(0,0,overlay.width,overlay.height);startBtn.disabled=false;stopBtn.disabled=true;addFossilBtn.disabled=true;addBackgroundBtn.disabled=true;scanBtn.disabled=true;scanBtn.textContent='Start live scan';liveLabel.textContent='Camera stopped';}
startBtn.addEventListener('click',startCamera);stopBtn.addEventListener('click',stopCamera);
flipBtn.addEventListener('click',async()=>{facingMode=facingMode==='environment'?'user':'environment';if(running)await startCamera();});
addFossilBtn.addEventListener('click',async()=>{await captureExample(fossilExamples);resultTitle.textContent='Fossil example added';resultDetail.textContent='Capture several angles before scanning.';});
addBackgroundBtn.addEventListener('click',async()=>{await captureExample(backgroundExamples);resultTitle.textContent='Background example added';resultDetail.textContent='Include table, hand, empty frame, and nearby objects.';});
scanBtn.addEventListener('click',()=>{scanning=!scanning;scanBtn.textContent=scanning?'Pause live scan':'Start live scan';liveLabel.textContent=scanning?'Scanning…':'Scan paused';});
threshold.addEventListener('input',()=>thresholdLabel.textContent=threshold.value+'%');
resetBtn.addEventListener('click',()=>{fossilExamples=[];backgroundExamples=[];scanning=false;scanBtn.textContent='Start live scan';liveScore.textContent='—';liveLabel.textContent=running?'Camera live':'Waiting to scan';resultTitle.textContent='Training reset';resultDetail.textContent='Add new fossil and background examples.';updateCounts();});

(async function init(){
  try{
    await tf.setBackend('webgl');await tf.ready();
    model=await mobilenet.load({version:2,alpha:1.0});
    setModelStatus('Vision model ready','live');
  }catch(err){console.error(err);setModelStatus('Model failed to load','error');resultDetail.textContent='Check internet connection and browser console.';}
})();