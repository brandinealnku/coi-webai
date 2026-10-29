const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
const MODE=new URLSearchParams(location.search).get('mode')==='test'?'test':'live';
const state={help:'',lookback:'',attention:'',companion:'',outcome:'',sessionId:'',studyCode:'',selectedObject:'',startedAt:'',design:'',journeyId:'',recognitionMethod:''};
function uid(){return crypto.randomUUID?crypto.randomUUID():'obs-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function objectName(label){return CFG.SPECIMENS?.[label]?.name||({fossil1:'Object 1',fossil2:'Object 2',fossil3:'Object 3'}[label]||label)}
function pick(attr,key){
 document.querySelectorAll('['+attr+']').forEach(b=>b.onclick=()=>{
  state[key]=b.getAttribute(attr);
  document.querySelectorAll('['+attr+']').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
  b.classList.add('selected');b.setAttribute('aria-pressed','true');validate()
 })
}
pick('data-help','help');pick('data-lookback','lookback');pick('data-attention','attention');pick('data-companion','companion');pick('data-outcome','outcome');
function validate(){$('submit').disabled=!(state.studyCode&&state.help&&state.lookback&&state.attention&&state.companion&&state.outcome)}
function jsonp(url){
 return new Promise((resolve,reject)=>{
  const cb='cmcActive_'+Date.now()+'_'+Math.random().toString(16).slice(2),s=document.createElement('script');
  const cleanup=()=>{try{delete window[cb]}catch{};s.remove()};
  window[cb]=d=>{cleanup();resolve(d)};s.onerror=()=>{cleanup();reject(new Error('Could not load active visitors.'))};
  s.src=url+(url.includes('?')?'&':'?')+'callback='+encodeURIComponent(cb)+'&_='+Date.now();document.body.appendChild(s)
 })
}
function elapsedLabel(iso){
 const ms=Math.max(0,Date.now()-new Date(iso).getTime()),sec=Math.round(ms/1000);
 return sec<60?'started '+sec+' sec ago':'started '+Math.floor(sec/60)+' min ago'
}
function chooseSession(s){
 state.sessionId=s.sessionId||'';state.studyCode=s.studyCode||'';state.selectedObject=s.selectedObject||'';state.startedAt=s.startedAt||'';state.design=s.design||'';state.journeyId=s.journeyId||'';state.recognitionMethod=s.recognitionMethod||'';
 $('selectedVisitor').classList.remove('hidden');
 $('selectedVisitor').innerHTML='<strong>Observing '+objectName(state.selectedObject)+'</strong><span>'+elapsedLabel(state.startedAt)+' · '+(state.design||'design ?').toUpperCase()+' · '+(state.recognitionMethod||'recognition ?')+' · session '+state.studyCode+'</span>';
 document.querySelectorAll('[data-session]').forEach(b=>b.classList.toggle('selected',b.dataset.session===state.sessionId));
 validate()
}
async function loadActive(){
 const root=$('activeSessions');root.innerHTML='<p class="note">Looking for active visitors…</p>';
 try{
  if(!ENDPOINT)throw new Error('Google Apps Script URL is not configured.');
  const data=await jsonp(ENDPOINT+'?action=active&mode='+encodeURIComponent(MODE));
  const sessions=(data?.sessions||[]).filter(s=>s.selectedObject);
  if(!sessions.length){root.innerHTML='<p class="note">No recent active visitors found yet. Ask the visitor to choose an object in the Visitor Experience, then refresh.</p>';return}
  root.innerHTML='';
  ['fossil1','fossil2','fossil3'].forEach(objectId=>{
   const group=sessions.filter(s=>s.selectedObject===objectId);
   if(!group.length)return;
   const section=document.createElement('section');section.className='active-object-group';
   section.innerHTML='<h3>'+objectName(objectId)+'</h3>';
   const wrap=document.createElement('div');wrap.className='buttons wrap';
   group.forEach(s=>{
    const b=document.createElement('button');b.type='button';b.dataset.session=s.sessionId;b.className='secondary session-choice';
    b.textContent=elapsedLabel(s.startedAt)+' · '+(s.design||'?').toUpperCase()+' · '+(s.recognitionMethod|| (s.recognizedSpecimen?'model':'manual'));
    b.onclick=()=>chooseSession(s);wrap.appendChild(b)
   });
   section.appendChild(wrap);root.appendChild(section)
  })
 }catch(e){console.error(e);root.innerHTML='<p class="note">'+(e.message||'Could not load active visitors.')+'</p>'}
}
function normalizedStudyCode(){return $('studyCodeInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}
function reset(){
 $('notes').value='';$('studyCodeInput').value='';state.help=state.lookback=state.attention=state.companion=state.outcome='';state.sessionId=state.studyCode=state.selectedObject=state.startedAt=state.design=state.journeyId=state.recognitionMethod='';
 document.querySelectorAll('[data-help],[data-lookback],[data-attention],[data-companion],[data-outcome]').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
 $('selectedVisitor').classList.add('hidden');$('selectedVisitor').innerHTML='';validate();loadActive()
}
$('refreshSessions').onclick=loadActive;
$('useManualCode').onclick=()=>{
 const code=normalizedStudyCode();$('studyCodeInput').value=code;
 if(code.length!==6){$('status').textContent='Enter a six-character Study Code.';return}
 state.sessionId='';state.studyCode=code;state.selectedObject='';state.startedAt=new Date().toISOString();
 $('selectedVisitor').classList.remove('hidden');$('selectedVisitor').innerHTML='<strong>Manual pairing</strong><span>Study Code '+code+'</span>';validate()
};
$('submit').onclick=()=>{
 const observationId=uid();
 const event={type:'observer-note',at:new Date().toISOString(),elapsedMs:'',mode:MODE,design:state.design,journeyId:state.journeyId,recognitionMethod:state.recognitionMethod,studyCode:state.studyCode,observedSessionId:state.sessionId,selectedObject:state.selectedObject,observerHelp:state.help,lookedBack:state.lookback,attention:state.attention,companionTalk:state.companion,outcome:state.outcome,observerNotes:$('notes').value.trim()};
 try{
  fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({eventName:CFG.EVENT_NAME||'NKU AI Day 2026',sessionId:observationId,event,userAgent:navigator.userAgent}),keepalive:true});
  $('status').textContent='Observation submitted. Ready for the next visitor.';reset()
 }catch(e){$('status').textContent='Could not submit. Check the network and try again.'}
};
if(MODE==='test')$('modeNotice').classList.remove('hidden');
validate();loadActive();setInterval(loadActive,10000);