const listEl=document.getElementById('surahList');
const searchEl=document.getElementById('search');
const installBtn=document.getElementById('installBtn');
const offlineList=document.getElementById('offlineList');
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

function latestReaderState(){
  let best=null;
  SURAHS.filter(s=>s.enabled).forEach(s=>{
    try{
      const state=JSON.parse(localStorage.getItem(`quran_reader_state_${s.number}_v1`)||'null');
      if(!state) return;
      const candidate={surah:s,state};
      if(!best || Number(state.updatedAt||0)>Number(best.state.updatedAt||0)) best=candidate;
    }catch(e){}
  });
  return best;
}

function showResume(){
  const found=latestReaderState();
  if(!found) return;

  const {surah,state}=found;
  document.getElementById('resumeCard').classList.add('show');
  document.getElementById('resumeMeta').textContent=
    `${surah.name} — صفحة ${state.page||surah.firstPage} — آية ${state.ayah||1}`;

  const btn=document.getElementById('resumeBtn');
  btn.href=`./reader.html?surah=${surah.number}`;
}
showResume();

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredPrompt=e;
  installBtn.hidden=false;
});

installBtn.addEventListener('click',async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  installBtn.hidden=true;
});

window.addEventListener('appinstalled',()=>{installBtn.hidden=true;});

async function registerSW(){
  if(!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('./sw.js',{scope:'./'});
}
const swRegistration=registerSW();

function surahUrls(s){
  const urls=[];
  for(let p=s.firstPage;p<=s.lastPage;p++){
    urls.push(
      `https://api.quran.com/api/v4/verses/by_page/${p}`+
      `?words=true&word_fields=code_v2,text_qpc_hafs,text_uthmani,line_number,page_number&per_page=50`
    );
    urls.push(`https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${p}.woff2`);
  }
  urls.push('https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2');
  return urls;
}

const offlineViews=new Map();

function renderOffline(){
  offlineList.innerHTML='';

  SURAHS.filter(s=>s.enabled).forEach(s=>{
    const item=document.createElement('div');
    item.className='offline-item';

    const ready=localStorage.getItem(`offline_surah_${s.number}_ready`)==='1';

    item.innerHTML=`
      <div class="offline-row">
        <div>
          <div class="offline-name">${s.name}</div>
          <div class="offline-pages">الصفحات ${s.firstPage}–${s.lastPage}</div>
        </div>
        <button class="download-btn" ${ready?'disabled':''}>${ready?'تم':'تنزيل'}</button>
      </div>
      <div class="progress"><span></span></div>
      <div class="status">${ready?'جاهزة للعمل دون إنترنت.':''}</div>
    `;

    const btn=item.querySelector('.download-btn');
    const progress=item.querySelector('.progress');
    const bar=progress.querySelector('span');
    const status=item.querySelector('.status');

    offlineViews.set(s.number,{s,item,btn,progress,bar,status});

    btn.addEventListener('click',()=>downloadSurah(s.number));
    offlineList.appendChild(item);
  });
}
renderOffline();

async function downloadSurah(number){
  const view=offlineViews.get(Number(number));
  if(!view) return;
  const {s,btn,progress,bar,status}=view;

  if(!navigator.onLine){
    status.textContent='يلزم اتصال بالإنترنت لعملية التنزيل الأولى.';
    return;
  }

  btn.disabled=true;
  progress.classList.add('show');
  bar.style.width='0%';
  status.textContent='بدء التنزيل…';

  try{
    const reg=await swRegistration;
    await navigator.serviceWorker.ready;
    const sw=navigator.serviceWorker.controller || reg?.active || reg?.waiting;

    if(!sw){
      status.textContent='أعد فتح الصفحة ثم حاول مرة أخرى.';
      btn.disabled=false;
      return;
    }

    sw.postMessage({
      type:'CACHE_URLS',
      id:`surah-${s.number}`,
      urls:surahUrls(s)
    });
  }catch(e){
    status.textContent='تعذر بدء التنزيل.';
    btn.disabled=false;
  }
}

navigator.serviceWorker?.addEventListener('message',e=>{
  const d=e.data||{};
  const m=String(d.id||'').match(/^surah-(\d+)$/);
  if(!m) return;

  const number=Number(m[1]);
  const view=offlineViews.get(number);
  if(!view) return;

  const {s,btn,progress,bar,status}=view;

  if(d.type==='CACHE_PROGRESS'){
    const pct=d.total ? Math.round((d.done/d.total)*100) : 0;
    progress.classList.add('show');
    bar.style.width=pct+'%';
    status.textContent=`تنزيل ${d.done} من ${d.total}`;
  }else if(d.type==='CACHE_DONE'){
    bar.style.width='100%';
    status.textContent=`اكتمل التنزيل. ${s.name} جاهزة للعمل دون إنترنت.`;
    localStorage.setItem(`offline_surah_${s.number}_ready`,'1');
    btn.textContent='تم';
    btn.disabled=true;
  }else if(d.type==='CACHE_ERROR'){
    status.textContent='تعذر تنزيل بعض الملفات. أعد المحاولة مع اتصال ثابت.';
    btn.disabled=false;
  }
});
