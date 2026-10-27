const CFG=window.CMC_V4_CONFIG||{},$=id=>document.getElementById(id);let model=null,classifier=null,stream=null;const video=$('video'),crop=document.createElement('canvas'),ctx=crop.getContext('2d',{willReadFrequently:true});
function counts(){const c=classifier?.getClassExampleCount?.()||{};return{fossil:c.fossil||0,other:c.other||0,background:c.background||0}}
function update(){const c=counts();$('fossilCount').textContent=c.fossil;$('otherCount').textContent=c.other;$('backgroundCount').textContent=c.background;const enough=c.fossil>=3&&c.other>=3&&c.background>=3;$('download').disabled=!enough;$('readiness').textContent=c.fossil>=10&&c.other>=10&&c.background>=10?'Strong baseline: 10+ examples in every class.':'Aim for at least 10 examples per class.';$('googleStatus').textContent=CFG.GOOGLE_SCRIPT_URL?'Google Sheets logging is configured.':'Google Sheets logging is not configured yet. Add the Apps Script web-app URL to config.js.'}
function activation(){if(!video.videoWidth)return null;const side=Math.min(video.videoWidth,video.videoHeight)*.66,sx=(video.videoWidth-side)/2,sy=(video.videoHeight-side)/2;crop.width=224;crop.height=224;ctx.drawImage(video,sx,sy,side,side,0,0,224,224);return model.infer(crop,true)}
function serialize(){const ds=classifier.getClassifierDataset(),out={version:4,createdAt:new Date().toISOString(),classes:{}};for(const [label,t] of Object.entries(ds))out.classes[label]={shape:t.shape,data:Array.from(t.dataSync())};return out}
$('start').onclick=async()=>{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();$('start').disabled=true;$('stop').disabled=false;document.querySelectorAll('[data-add]').forEach(b=>b.disabled=false)};
$('stop').onclick=()=>{if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;$('start').disabled=false;$('stop').disabled=true;document.querySelectorAll('[data-add]').forEach(b=>b.disabled=true)};
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const a=activation();if(!a)return;classifier.addExample(a,b.dataset.add);a.dispose();update()});
$('download').onclick=()=>{const blob=new Blob([JSON.stringify(serialize())],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='training.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function loadSharedTraining(){
  return new Promise((resolve,reject)=>{
    if(!CFG.GOOGLE_SCRIPT_URL)return reject(new Error('Google Apps Script URL is not configured.'));
    const cb='cmcTraining_'+Date.now()+'_'+Math.random().toString(16).slice(2);
    const s=document.createElement('script');
    const cleanup=()=>{try{delete window[cb]}catch{};s.remove()};
    window[cb]=data=>{cleanup();resolve(data)};
    s.onerror=()=>{cleanup();reject(new Error('Could not load shared training data.'))};
    s.src=CFG.GOOGLE_SCRIPT_URL+'?action=training&callback='+encodeURIComponent(cb)+'&_='+Date.now();
    document.body.appendChild(s);
  });
}
$('loadShared').onclick=async()=>{
  const btn=$('loadShared'),status=$('sharedStatus');btn.disabled=true;status.textContent='Loading student submissions…';
  try{
    const data=await loadSharedTraining(),ds={};let total=0;
    for(const label of ['fossil','other','background']){
      const rows=data?.classes?.[label]||[];
      if(rows.length){const width=rows[0].length;ds[label]=tf.tensor2d(rows,[rows.length,width]);total+=rows.length}
    }
    if(Object.keys(ds).length){classifier.setClassifierDataset(ds);update()}
    const c=counts();status.textContent=total?'Loaded '+total+' shared examples — fossil '+c.fossil+', other '+c.other+', background '+c.background+'.':'No student submissions found yet.';
  }catch(e){console.error(e);status.textContent=e.message||'Could not load shared submissions.'}
  finally{btn.disabled=false}
};
const visitor=CFG.VISITOR_URL||location.href.replace(/admin\.html.*$/,'');$('visitorUrl').textContent=visitor;new QRCode($('qrcode'),{text:visitor,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});$('copyUrl').onclick=()=>navigator.clipboard.writeText(visitor);
(async()=>{await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();update()})();