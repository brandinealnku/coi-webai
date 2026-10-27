const CFG=window.CMC_V4_CONFIG||{},ENDPOINT=(CFG.GOOGLE_SCRIPT_URL||'').trim(),$=id=>document.getElementById(id);
const state={help:'',lookback:'',attention:'',companion:'',outcome:''};
function uid(){return crypto.randomUUID?crypto.randomUUID():'obs-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function pick(attr,key){
  document.querySelectorAll('['+attr+']').forEach(b=>b.onclick=()=>{
    state[key]=b.getAttribute(attr);
    document.querySelectorAll('['+attr+']').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
    b.classList.add('selected');
    b.setAttribute('aria-pressed','true');
    validate();
  });
}
pick('data-help','help');pick('data-lookback','lookback');pick('data-attention','attention');pick('data-companion','companion');pick('data-outcome','outcome');
function validate(){$('submit').disabled=!(state.help&&state.lookback&&state.attention&&state.companion&&state.outcome)}
function reset(){
  $('notes').value='';
  Object.keys(state).forEach(k=>state[k]='');
  document.querySelectorAll('[data-help],[data-lookback],[data-attention],[data-companion],[data-outcome]').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false')});
  validate();
}
$('submit').onclick=()=>{
  const observationId=uid();
  const event={type:'observer-note',at:new Date().toISOString(),elapsedMs:'',observerHelp:state.help,lookedBack:state.lookback,attention:state.attention,companionTalk:state.companion,outcome:state.outcome,observerNotes:$('notes').value.trim()};
  try{
    fetch(ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({eventName:CFG.EVENT_NAME||'NKU AI Day 2026',sessionId:observationId,event,userAgent:navigator.userAgent}),keepalive:true});
    $('status').textContent='Observation saved. Ready for the next visitor.';
    reset();
  }catch(e){
    $('status').textContent='Could not save. Check the network and try again.';
  }
};
validate();