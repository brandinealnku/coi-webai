const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
let model=null,classifier=null,journey=null,LABELS=[],NAMES={};const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
async function loadJourney(){const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Could not load journey.json');return r.json()}
function nameFor(label){return NAMES[label]||({other:'Other objects',background:'Background'}[label]||label)}
function loadSharedTraining(){return new Promise((resolve,reject)=>{const cb='journeyValidation_'+Date.now()+'_'+Math.random().toString(16).slice(2),s=document.createElement('script'),cleanup=()=>{try{delete window[cb]}catch{};s.remove()};window[cb]=d=>{cleanup();resolve(d)};s.onerror=()=>{cleanup();reject(new Error('Could not load shared training data.'))};s.src=ENDPOINT+'?action=training&callback='+encodeURIComponent(cb)+'&_='+Date.now();document.body.appendChild(s)})}
function readImage(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=e=>{URL.revokeObjectURL(u);reject(e)};img.src=u})}
function activation(img){const side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;canvas.width=224;canvas.height=224;ctx.drawImage(img,sx,sy,side,side,0,0,224,224);return model.infer(canvas,true)}
function buildInputs(){
 const root=$('validationInputs');root.innerHTML='';
 LABELS.forEach(label=>{const d=document.createElement('section'),safe=label.replace(/[^a-z0-9_-]/gi,'-'),name=nameFor(label);
   d.innerHTML='<h2>'+name+'</h2><p class="note">Choose only held-out photos whose correct class is '+name+'. These must not have been used for training.</p><label for="test-'+safe+'">Choose held-out photos</label><input id="test-'+safe+'" data-label="'+label+'" type="file" accept="image/*" multiple><hr>';root.appendChild(d)})
}
$('runValidation').onclick=async()=>{
 const btn=$('runValidation');btn.disabled=true;$('validationStatus').textContent='Testing unseen photos…';const rows=[];let allCorrect=0,allTotal=0;
 for(const actual of LABELS){const input=document.querySelector('[data-label="'+CSS.escape(actual)+'"]'),files=[...(input?.files||[])];let correct=0;const confs=[];
   for(const file of files){try{const img=await readImage(file),a=activation(img),r=await classifier.predictClass(a,5);a.dispose();const conf=(r.confidences||{})[r.label]||0;if(r.label===actual)correct++;confs.push(conf)}catch(e){console.error(e)}}
   allCorrect+=correct;allTotal+=files.length;rows.push({actual,total:files.length,correct,accuracy:files.length?correct/files.length:null,avgConfidence:confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:null})
 }
 render(rows,allCorrect,allTotal);btn.disabled=false
};
function render(rows,correct,total){$('validationStatus').textContent=total?'Overall held-out accuracy: '+correct+'/'+total+' ('+Math.round(correct/total*100)+'%).':'Choose at least one held-out photo.';$('validationResults').innerHTML='<h2>Validation results</h2>'+rows.map(r=>'<div class="validation-row"><strong>'+nameFor(r.actual)+'</strong><span>'+r.correct+' of '+r.total+' correct</span><span>'+(r.accuracy===null?'No photos':Math.round(r.accuracy*100)+'%')+'</span></div>').join('')}
(async()=>{try{
 journey=await loadJourney();const targets=(journey.artifacts||[]).filter(a=>a.recognitionClass);
 LABELS=[...targets.map(a=>a.recognitionClass),'other','background'];for(const a of targets)NAMES[a.recognitionClass]='Stop '+a.stopNumber+' · '+(a.name||a.id);
 if(!targets.length)throw new Error('No artifacts have recognition classes. Validation is not needed until recognition is configured.');
 await tf.setBackend('webgl');await tf.ready();model=await mobilenet.load({version:2,alpha:1});classifier=knnClassifier.create();
 const data=await loadSharedTraining(),ds={};for(const label of LABELS){const rows=data?.classes?.[label]||[];if(!rows.length)throw new Error('Missing shared training examples for '+nameFor(label)+'.');ds[label]=tf.tensor2d(rows,[rows.length,rows[0].length])}
 classifier.setClassifierDataset(ds);buildInputs();$('loading').classList.add('hidden');$('validator').classList.remove('hidden')
}catch(e){console.error(e);$('loading').textContent=e.message||'Validation setup could not load.'}})();