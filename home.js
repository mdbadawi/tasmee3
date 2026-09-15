const listEl=document.getElementById('surahList');
const searchEl=document.getElementById('search');
const installBtn=document.getElementById('installBtn');
const offlineBtn=document.getElementById('offlineBtn');
const offlineStatus=document.getElementById('offlineStatus');
const offlineProgress=document.getElementById('offlineProgress');
const progressBar=offlineProgress.querySelector('span');
let deferredPrompt=null;

function renderList(query=''){
  const q=query.trim();
  listEl.innerHTML='';
  SURAHS.filter(s=>!q || s.name.includes(q) || String(s.number)===q).forEach(s=>{
    const item=document.createElement(s.enabled?'a':'div');
    item.className='surah-card '+(s.enabled?'enabled':'disabled');
    if(s.enabled) item.href=`./reader.html?surah=${s.number}`;
    item.innerHTML=`<span class="surah-no">${s.number}</span><span class="surah-name">${s.name}</span><span class="surah-state">${s.enabled?'متاح':'لاحقا'}</span>`;
    listEl.appendChild(item);
  });
}
renderList();
searchEl.addEventListener('input',()=>renderList(searchEl.value));

function showResume(){
  try{
    const s=JSON.parse(localStorage.getItem('quran_reader_state_2_v1')||'null');
    if(!s) return;
    document.getElementById('resumeCard').classList.add('show');
    document.getElementById('resumeMeta').textContent=`البقرة — صفحة ${s.page||2} — آية ${s.ayah||1}`;
  }catch(e){}
}
showResume();

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredPrompt=e; installBtn.hidden=false;
});
installBtn.addEventListener('click',async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null; installBtn.hidden=true;
});
window.addEventListener('appinstalled',()=>{installBtn.hidden=true;});

async function registerSW(){
  if(!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('./sw.js',{scope:'./'});
}
const swRegistration=registerSW();

function baqarahUrls(){
  const s=getSurahConfig(2); const urls=[];
  for(let p=s.firstPage;p<=s.lastPage;p++){
    urls.push(`https://api.quran.com/api/v4/verses/by_page/${p}?words=true&word_fields=code_v2,text_qpc_hafs,text_uthmani,line_number,page_number&per_page=50`);
    urls.push(`https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${p}.woff2`);
  }
  urls.push('https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2');
  return urls;
}

offlineBtn.addEventListener('click',async()=>{
  if(!navigator.onLine){offlineStatus.textContent='يلزم اتصال بالإنترنت لعملية التنزيل الأولى.';return;}
  offlineBtn.disabled=true; offlineProgress.classList.add('show'); progressBar.style.width='0%';
  offlineStatus.textContent='بدء التنزيل…';
  const reg=await swRegistration;
  await navigator.serviceWorker.ready;
  const sw=navigator.serviceWorker.controller || reg.active || reg.waiting;
  if(!sw){offlineStatus.textContent='أعد فتح الصفحة ثم حاول مرة أخرى.';offlineBtn.disabled=false;return;}
  sw.postMessage({type:'CACHE_URLS',id:'baqarah',urls:baqarahUrls()});
});

navigator.serviceWorker?.addEventListener('message',e=>{
  const d=e.data||{}; if(d.id!=='baqarah') return;
  if(d.type==='CACHE_PROGRESS'){
    const pct=Math.round((d.done/d.total)*100); progressBar.style.width=pct+'%';
    offlineStatus.textContent=`تنزيل ${d.done} من ${d.total}`;
  }else if(d.type==='CACHE_DONE'){
    progressBar.style.width='100%'; offlineStatus.textContent='اكتمل التنزيل. البقرة جاهزة للعمل دون إنترنت.';
    localStorage.setItem('offline_baqarah_ready','1'); offlineBtn.textContent='تم'; offlineBtn.disabled=true;
  }else if(d.type==='CACHE_ERROR'){
    offlineStatus.textContent='تعذر تنزيل بعض الملفات. أعد المحاولة مع اتصال ثابت.'; offlineBtn.disabled=false;
  }
});
if(localStorage.getItem('offline_baqarah_ready')==='1'){offlineBtn.textContent='تم';offlineBtn.disabled=true;offlineStatus.textContent='البقرة مجهزة للأوفلاين.';}
