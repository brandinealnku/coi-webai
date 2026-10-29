const $=id=>document.getElementById(id);
const STORAGE_KEY='expand-your-world-journey-draft-v1';
let published=null,journey=null,selectedId=null;

function clone(x){return JSON.parse(JSON.stringify(x))}
function slug(s){return String(s||'artifact').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'artifact'}
function status(msg){$('builderStatus').textContent=msg}
async function loadPublished(){
  const r=await fetch('journey.json?v='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw new Error('Could not load journey.json');
  published=await r.json();
  const saved=localStorage.getItem(STORAGE_KEY);
  journey=saved?JSON.parse(saved):clone(published);
}
function saveDraft(msg='Draft saved locally.'){
  syncJourneySettings();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(journey));
  status(msg);
}
function syncJourneySettings(){
  journey.title=$('journeyTitle').value.trim()||'Expand Your World';
  journey.eventLabel=$('eventLabel').value.trim();
  journey.brandLine=$('brandLine').value.trim();
  journey.theme=$('journeyTheme').value||'nku';
  journey.welcome=journey.welcome||{};
  journey.welcome.headline=$('welcomeHeadline').value.trim();
  journey.welcome.body=$('welcomeBody').value.trim();
  journey.finale=journey.finale||{};
  journey.finale.stopNumber=$('finaleNumber').value.trim()||'Finale';
  journey.finale.headline=$('finaleHeadline').value.trim();
  journey.finale.body=$('finaleBody').value.trim();
  journey.finale.learnMoreLabel=$('learnMoreLabel').value.trim();
  journey.finale.learnMoreUrl=$('learnMoreUrl').value.trim();
}
function renderSettings(){
  $('journeyTitle').value=journey.title||'';
  $('eventLabel').value=journey.eventLabel||'';
  $('brandLine').value=journey.brandLine||'';
  $('journeyTheme').value=journey.theme||'nku';
  $('welcomeHeadline').value=journey.welcome?.headline||'';
  $('welcomeBody').value=journey.welcome?.body||'';
  $('finaleNumber').value=journey.finale?.stopNumber||'';
  $('finaleHeadline').value=journey.finale?.headline||'';
  $('finaleBody').value=journey.finale?.body||'';
  $('learnMoreLabel').value=journey.finale?.learnMoreLabel||'';
  $('learnMoreUrl').value=journey.finale?.learnMoreUrl||'';
}
function renderList(){
  const root=$('artifactList');root.innerHTML='';
  (journey.artifacts||[]).forEach((a,i)=>{
    const row=document.createElement('div');row.className='artifact-row';
    const move=document.createElement('div');
    const up=document.createElement('button');up.type='button';up.textContent='↑';up.title='Move up';up.disabled=i===0;
    const down=document.createElement('button');down.type='button';down.textContent='↓';down.title='Move down';down.disabled=i===journey.artifacts.length-1;
    up.onclick=()=>moveArtifact(i,-1);down.onclick=()=>moveArtifact(i,1);move.append(up,down);
    const main=document.createElement('button');main.type='button';main.className='secondary';main.style.textAlign='left';
    main.innerHTML='<span class="meta"><strong>Stop '+esc(a.stopNumber)+' · '+esc(a.name||a.tableLabel||a.id)+'</strong><small>'+esc(a.physicalObjectName||'No physical object name')+' · '+esc(a.recognitionClass||'manual only')+'</small></span>';
    main.onclick=()=>selectArtifact(a.id);
    const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='×';del.title='Remove';del.onclick=()=>removeArtifact(a.id);
    row.append(move,main,del);root.appendChild(row);
  });
  refreshNextOptions();
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function moveArtifact(i,delta){
  const j=i+delta;if(j<0||j>=journey.artifacts.length)return;
  [journey.artifacts[i],journey.artifacts[j]]=[journey.artifacts[j],journey.artifacts[i]];
  saveDraft('Artifact order updated.');renderList();
}
function addArtifact(){
  let base='artifact-'+(journey.artifacts.length+1),id=base,n=2;
  while(journey.artifacts.some(a=>a.id===id))id=base+'-'+n++;
  const stop=String(journey.artifacts.length+1);
  journey.artifacts.push({
    id,stopNumber:stop,shortLabel:'Object '+stop,name:'New artifact',tableLabel:'Stop '+stop+' · New artifact',
    recognitionClass:'',physicalObjectName:'',scenarioLabel:'',
    referenceImage:'',referenceAlt:'',referenceCaption:'Look at the reference image.',
    notice:{question:'What do you notice?',choices:[
      {value:'choice-1',label:'Choice 1',detail:''},
      {value:'choice-2',label:'Choice 2',detail:''},
      {value:'unsure',label:'Not sure',detail:''}
    ]},
    discover:{title:'Look closer.',text:'Add the reveal here.',uncertainty:'',source:''},
    next:{artifactId:'finale',label:'Finale',direction:'Continue to the finale.'}
  });
  saveDraft('Artifact added.');renderList();selectArtifact(id);
}
function removeArtifact(id){
  if(!confirm('Remove this artifact from the journey?'))return;
  journey.artifacts=journey.artifacts.filter(a=>a.id!==id);
  journey.artifacts.forEach(a=>{if(a.next?.artifactId===id)a.next.artifactId='finale'});
  if(selectedId===id){selectedId=null;$('artifactForm').classList.add('hidden');$('emptyEditor').classList.remove('hidden')}
  saveDraft('Artifact removed.');renderList();
}
function artifact(){return journey.artifacts.find(a=>a.id===selectedId)}
function selectArtifact(id){
  selectedId=id;const a=artifact();if(!a)return;
  $('emptyEditor').classList.add('hidden');$('artifactForm').classList.remove('hidden');
  $('artifactId').value=a.id||'';
  $('stopNumber').value=a.stopNumber||'';
  $('shortLabel').value=a.shortLabel||'';
  $('artifactName').value=a.name||'';
  $('tableLabel').value=a.tableLabel||'';
  $('recognitionClass').value=a.recognitionClass||'';
  $('physicalObjectName').value=a.physicalObjectName||'';
  $('scenarioLabel').value=a.scenarioLabel||'';
  $('referenceImage').value=a.referenceImage||'';
  $('referenceAlt').value=a.referenceAlt||'';
  $('noticeQuestion').value=a.notice?.question||'';
  $('discoverTitle').value=a.discover?.title||'';
  $('discoverText').value=a.discover?.text||'';
  $('discoverUncertainty').value=a.discover?.uncertainty||'';
  $('discoverSource').value=a.discover?.source||'';
  renderChoices(a.notice?.choices||[]);
  refreshNextOptions();
  $('nextArtifact').value=a.next?.artifactId||'finale';
  $('nextLabel').value=a.next?.label||'';
  $('nextDirection').value=a.next?.direction||'';
}
function renderChoices(choices){
  const root=$('choiceEditor');root.innerHTML='';
  choices.forEach((c,i)=>{
    const wrap=document.createElement('div');wrap.className='privacy-box';wrap.dataset.index=i;
    wrap.innerHTML='<label>Choice label<input class="choice-label" value="'+esc(c.label)+'"></label><label>Choice value<input class="choice-value" value="'+esc(c.value)+'"></label><label>Optional detail<input class="choice-detail" value="'+esc(c.detail||'')+'"></label><button type="button" class="danger choice-remove">Remove choice</button>';
    wrap.querySelector('.choice-remove').onclick=()=>{choices.splice(i,1);renderChoices(choices)};
    root.appendChild(wrap);
  });
}
function collectChoices(){
  return [...document.querySelectorAll('#choiceEditor .privacy-box')].map((w,i)=>({
    label:w.querySelector('.choice-label').value.trim()||('Choice '+(i+1)),
    value:slug(w.querySelector('.choice-value').value.trim()||('choice-'+(i+1))),
    detail:w.querySelector('.choice-detail').value.trim()
  }));
}
function refreshNextOptions(){
  const select=$('nextArtifact');if(!select)return;
  const current=select.value;select.innerHTML='';
  for(const a of journey.artifacts){
    if(a.id===selectedId)continue;
    const o=document.createElement('option');o.value=a.id;o.textContent='Stop '+a.stopNumber+' · '+(a.name||a.id);select.appendChild(o);
  }
  const finale=document.createElement('option');finale.value='finale';finale.textContent='Finale';select.appendChild(finale);
  if([...select.options].some(o=>o.value===current))select.value=current;
}
function applyArtifact(e){
  e.preventDefault();const a=artifact();if(!a)return;
  const oldId=a.id,newId=slug($('artifactId').value);
  if(newId!==oldId&&journey.artifacts.some(x=>x.id===newId))return status('Artifact ID must be unique.');
  a.id=newId;a.stopNumber=$('stopNumber').value.trim();a.shortLabel=$('shortLabel').value.trim();a.name=$('artifactName').value.trim();
  a.tableLabel=$('tableLabel').value.trim();a.recognitionClass=$('recognitionClass').value.trim();a.physicalObjectName=$('physicalObjectName').value.trim();
  a.scenarioLabel=$('scenarioLabel').value.trim();a.referenceImage=$('referenceImage').value.trim();a.referenceAlt=$('referenceAlt').value.trim();
  a.notice={question:$('noticeQuestion').value.trim(),choices:collectChoices()};
  a.discover={title:$('discoverTitle').value.trim(),text:$('discoverText').value.trim(),uncertainty:$('discoverUncertainty').value.trim(),source:$('discoverSource').value.trim()};
  a.next={artifactId:$('nextArtifact').value,label:$('nextLabel').value.trim(),direction:$('nextDirection').value.trim()};
  if(newId!==oldId)journey.artifacts.forEach(x=>{if(x.next?.artifactId===oldId)x.next.artifactId=newId});
  selectedId=newId;saveDraft('Artifact changes applied and draft saved.');renderList();selectArtifact(newId);
}
function duplicateArtifact(){
  const a=artifact();if(!a)return;const copy=clone(a);let id=a.id+'-copy',n=2;while(journey.artifacts.some(x=>x.id===id))id=a.id+'-copy-'+n++;
  copy.id=id;copy.stopNumber=String(a.stopNumber)+'B';copy.name=(a.name||'Artifact')+' copy';copy.tableLabel='Stop '+copy.stopNumber+' · '+copy.name;
  journey.artifacts.splice(journey.artifacts.indexOf(a)+1,0,copy);saveDraft('Artifact duplicated.');renderList();selectArtifact(id);
}
function exportJourney(){
  syncJourneySettings();const blob=new Blob([JSON.stringify(journey,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download='journey.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);status('journey.json exported.');
}
async function importJourney(file){
  try{const data=JSON.parse(await file.text());if(!Array.isArray(data.artifacts))throw new Error('JSON must contain an artifacts array.');
    journey=data;selectedId=null;saveDraft('Imported journey saved as local draft.');renderSettings();renderList();$('artifactForm').classList.add('hidden');$('emptyEditor').classList.remove('hidden');
  }catch(e){status('Import failed: '+e.message)}
}
$('addArtifact').onclick=addArtifact;
$('saveDraft').onclick=()=>saveDraft();
$('exportJourney').onclick=exportJourney;
$('importJourney').onclick=()=>$('importFile').click();
$('importFile').onchange=e=>{const f=e.target.files?.[0];if(f)importJourney(f);e.target.value=''};
$('resetJourney').onclick=()=>{if(confirm('Discard local draft and restore the published journey?')){journey=clone(published);localStorage.removeItem(STORAGE_KEY);selectedId=null;renderSettings();renderList();$('artifactForm').classList.add('hidden');$('emptyEditor').classList.remove('hidden');status('Restored published journey.')}};
$('artifactForm').onsubmit=applyArtifact;
$('duplicateArtifact').onclick=duplicateArtifact;
$('deleteArtifact').onclick=()=>selectedId&&removeArtifact(selectedId);
$('addChoice').onclick=()=>{const a=artifact();if(!a)return;const choices=collectChoices();choices.push({value:'choice-'+(choices.length+1),label:'New choice',detail:''});renderChoices(choices)};
for(const id of ['journeyTitle','eventLabel','brandLine','journeyTheme','welcomeHeadline','welcomeBody','finaleNumber','finaleHeadline','finaleBody','learnMoreLabel','learnMoreUrl']){
  $(id).addEventListener('change',()=>saveDraft('Journey settings saved.'));
}
(async()=>{try{await loadPublished();renderSettings();renderList();status(localStorage.getItem(STORAGE_KEY)?'Local draft loaded. Preview reflects this draft when opened from the builder.':'Published journey loaded.')}catch(e){status(e.message)}})();