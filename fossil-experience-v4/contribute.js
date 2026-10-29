const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
let model=null,journey=null;const batchId=(crypto.randomUUID?crypto.randomUUID():'batch-'+Date.now());
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function loadJourney(){const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Could not load journey.json');return r.json()}
function readImage(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(u);reject(e)};img.src=u})}
function embeddingFor(img){const side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;canvas.width=224;canvas.height=224;ctx.clearRect(0,0,224,224);ctx.drawImage(img,sx,sy,side,side,0,0,224,224);const t=model.infer(canvas,true),arr=Array.from(t.dataSync());t.dispose();return arr}
async function sendExample(label,embedding){await fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({kind:'training-example',eventName:journey?.eventLabel||CFG.EVENT_NAME||'Guided Object Journey',batchId,label,embedding,userAgent:navigator.userAgent}),keepalive:true})}
function targetCard(label,name,help){
 const safe=label.replace(/[^a-z0-9_-]/gi,'-'),section=document.createElement('section');
 section.innerHTML='<h2>'+esc(name)+'</h2><p class="note">'+esc(help)+'</p><label for="'+safe+'Files">Choose training photos</label><input id="'+safe+'Files" type="file" accept="image/*" capture="environment" multiple><button data-submit="'+esc(label)+'" data-input="'+safe+'Files" data-status="'+safe+'Status">Submit photos</button><span id="'+safe+'Status" class="upload-status" role="status" aria-live="polite"></span><hr>';
 return section;
}
function buildTargets(){
 const root=$('trainingTargets');root.innerHTML='';
 const targets=(journey.artifacts||[]).filter(a=>a.recognitionClass);
 if(!targets.length)root.innerHTML='<p class="note">No artifacts currently have recognition classes. Add a recognition class in Journey Builder if you want AI recognition.</p>';
 targets.forEach(a=>root.appendChild(targetCard(a.recognitionClass,'Stop '+a.stopNumber+' · '+(a.name||a.id),'Photograph the actual physical object mapped to class '+a.recognitionClass+' from varied conditions.')));
 root.appendChild(targetCard('other','Other objects','Add nearby non-target or visually similar objects that the scanner should reject.'));
 root.appendChild(targetCard('background','Background','Add empty/background views around the table or exhibit area.'));
 root.querySelectorAll('[data-submit]').forEach(btn=>btn.onclick=async()=>{
   const label=btn.dataset.submit,input=$(btn.dataset.input),status=$(btn.dataset.status),files=[...(input?.files||[])];
   if(!files.length){status.textContent='Choose at least one photo first.';return}
   btn.disabled=true;status.textContent='Processing 0 of '+files.length+'…';let done=0;
   for(const file of files){try{const img=await readImage(file),embedding=embeddingFor(img);await sendExample(label,embedding);done++;status.textContent='Submitted '+done+' of '+files.length+'…'}catch(e){console.error(e)}}
   status.textContent='Submitted '+done+' training example'+(done===1?'':'s')+'.';input.value='';btn.disabled=false;
 });
}
(async()=>{try{journey=await loadJourney();await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});buildTargets();$('loading').classList.add('hidden');$('trainer').classList.remove('hidden')}catch(e){console.error(e);$('loading').textContent=e.message||'Training setup could not load.'}})();