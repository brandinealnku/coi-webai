const CFG=window.CMC_V4_CONFIG||{},$=id=>document.getElementById(id);
const key='cmc-ai-day-release-gates-v1';
const saved=JSON.parse(localStorage.getItem(key)||'{}');
document.querySelectorAll('[data-gate]').forEach(cb=>{cb.checked=!!saved[cb.dataset.gate];cb.onchange=()=>{saved[cb.dataset.gate]=cb.checked;localStorage.setItem(key,JSON.stringify(saved));evaluate()}});
function evaluate(){
 const boxes=[...document.querySelectorAll('[data-gate]')],passed=boxes.filter(x=>x.checked).length,all=passed===boxes.length;
 $('releaseDecision').innerHTML=all?'<strong>RELEASE GATE PASSED</strong><span>All recorded interface and model checks are complete. Publish LIVE only if the evidence behind these checks is current.</span>':'<strong>LIVE BLOCKED · '+passed+'/'+boxes.length+' checks</strong><span>Continue TEST or use clearly labeled manual-selection demonstration until every release check is supported.</span>';
}
function mapArtifacts(){
 const root=$('artifactMap');root.innerHTML='<h3>Current mapping</h3>';
 for(const label of ['fossil1','fossil2','fossil3']){
  const m=CFG.ARTIFACT_MAPPING?.[label]||{},s=CFG.SPECIMENS?.[label]||{};
  const div=document.createElement('div');div.className='privacy-box';
  div.innerHTML='<strong>'+label+' → '+(m.routeStop||'')+'</strong><span>Physical artifact: '+(m.artifact||'NEEDS CONFIRMATION')+'<br>Table label: '+(m.tableLabel||s.tableLabel||'')+'<br>Prompt audit: '+(s.promptAudit||'NEEDS REVIEW')+'</span>';root.appendChild(div)
 }
}
function jsonp(url){return new Promise((resolve,reject)=>{const cb='release_'+Date.now(),s=document.createElement('script');window[cb]=d=>{delete window[cb];s.remove();resolve(d)};s.onerror=()=>{delete window[cb];s.remove();reject(new Error('Could not load training data'))};s.src=url+'&callback='+cb+'&_='+Date.now();document.body.appendChild(s)})}
(async()=>{mapArtifacts();evaluate();try{if(!CFG.GOOGLE_SCRIPT_URL)throw new Error('Apps Script not configured');const d=await jsonp(CFG.GOOGLE_SCRIPT_URL+'?action=training');const c=d.classes||{};$('trainingStatus').textContent=['fossil1','fossil2','fossil3','other','background'].map(k=>k+': '+(c[k]?.length||0)).join(' · ')}catch(e){$('trainingStatus').textContent=e.message}})();