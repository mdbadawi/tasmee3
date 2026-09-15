const listEl=document.getElementById('surahList');
const searchEl=document.getElementById('search');
const installBtn=document.getElementById('installBtn');
const offlineAllBtn=document.getElementById('offlineAllBtn');
const offlineAllProgress=document.getElementById('offlineAllProgress');
const offlineAllBar=offlineAllProgress.querySelector('span');
const offlineAllStatus=document.getElementById('offlineAllStatus');
const storageHint=document.getElementById('storageHint');
let deferredPrompt=null;
function renderList(query=''){
 const q=query.trim(); listEl.innerHTML='';
 SURAHS.filter(s=>!q||s.name.includes(q)||String(s.number)===q).forEach(s=>{
  const item=document.createElement('a'); item.className='surah-card enabled'; item.href=`./reader.html?surah=${s.number}`;
  item.innerHTML=`<span class="surah-no">${s.number}</span><span class="surah-name">${s.name}</span><span class="surah-state">${s.ayahCount} آية</span>`;
  listEl.appendChild(item);
 });
}
renderList(); searchEl.addEventListener('input',()=>renderList(searchEl.value));
function latestReaderState(){let best=null; SURAHS.forEach(s=>{try{const state=JSON.parse(localStorage.getItem(`quran_reader_state_${s.number}_v1`)||'null'); if(!state)return; const c={surah:s,state}; if(!best||Number(state.updatedAt||0)>Number(best.state.updatedAt||0))best=c;}catch(e){}}); return best;}
function showResume(){const f=latestReaderState(); if(!f)return; const {surah,state}=f; document.getElementById('resumeCard').classList.add('show'); document.getElementById('resumeMeta').textContent=`${surah.name} — صفحة ${state.page||surah.firstPage} — آية ${state.ayah||1}`; document.getElementById('resumeBtn').href=`./reader.html?surah=${surah.number}`;}
showResume();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false;});
installBtn.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.hidden=true;});
window.addEventListener('appinstalled',()=>{installBtn.hidden=true;});
async function registerSW(){if(!('serviceWorker' in navigator))return null;return navigator.serviceWorker.register('./sw.js',{scope:'./'});} const swRegistration=registerSW();
function pageApiUrl(p){return `https://api.quran.com/api/v4/verses/by_page/${p}?words=true&word_fields=code_v2,text_qpc_hafs,text_uthmani,line_number,page_number&per_page=50`;}
function pageFontUrl(p){return `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${p}.woff2`;}
function wholeQuranUrls(){const urls=[];for(let p=1;p<=604;p++){urls.push(pageApiUrl(p),pageFontUrl(p));}urls.push('https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2');return urls;}
async function showStorageEstimate(){if(!navigator.storage?.estimate)return;try{const {usage=0,quota=0}=await navigator.storage.estimate();if(!quota)return;const free=Math.max(0,quota-usage);storageHint.textContent=`المتاح للتطبيق في المتصفح حاليا نحو ${Math.round(free/1024/1024)} MB.`;}catch(e){}}
showStorageEstimate();
if(localStorage.getItem('offline_full_quran_ready')==='1'){offlineAllBtn.textContent='تم';offlineAllBtn.disabled=true;offlineAllStatus.textContent='المصحف محفوظ للعمل دون إنترنت.';}
offlineAllBtn.addEventListener('click',async()=>{if(!navigator.onLine){offlineAllStatus.textContent='يلزم اتصال بالإنترنت لبدء التنزيل.';return;}offlineAllBtn.disabled=true;offlineAllProgress.classList.add('show');offlineAllBar.style.width='0%';offlineAllStatus.textContent='تجهيز التنزيل…';try{if(navigator.storage?.persist){try{await navigator.storage.persist();}catch(e){}}const reg=await swRegistration;await navigator.serviceWorker.ready;const sw=navigator.serviceWorker.controller||reg?.active||reg?.waiting;if(!sw){offlineAllStatus.textContent='أعد فتح الصفحة ثم حاول مرة أخرى.';offlineAllBtn.disabled=false;return;}const urls=wholeQuranUrls();sw.postMessage({type:'CACHE_URLS',id:'full-quran',urls});}catch(e){offlineAllStatus.textContent='تعذر بدء التنزيل.';offlineAllBtn.disabled=false;}});
navigator.serviceWorker?.addEventListener('message',e=>{const d=e.data||{};if(d.id!=='full-quran')return;if(d.type==='CACHE_PROGRESS'){const pct=d.total?Math.round(d.done/d.total*100):0;offlineAllProgress.classList.add('show');offlineAllBar.style.width=pct+'%';offlineAllStatus.textContent=`تنزيل ${d.done} من ${d.total} — ${pct}%`;}else if(d.type==='CACHE_DONE'){offlineAllBar.style.width='100%';offlineAllStatus.textContent='اكتمل تنزيل المصحف كاملا للعمل دون إنترنت.';localStorage.setItem('offline_full_quran_ready','1');offlineAllBtn.textContent='تم';offlineAllBtn.disabled=true;showStorageEstimate();}else if(d.type==='CACHE_ERROR'){offlineAllStatus.textContent='تعذر تنزيل بعض الملفات. اضغط استكمال لإكمال الناقص.';offlineAllBtn.textContent='استكمال';offlineAllBtn.disabled=false;showStorageEstimate();}});
