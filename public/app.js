// === Konfiguration ===
const CANCEL_FEE = 96;      // 80% von 120 €
const PRICE = 120;
const FEE_HOURS = 24;       // kostenfreie Absage bis 24h vorher

// === Auth (simpel: PIN -> Token im sessionStorage) ===
// Hinweis: kein localStorage in Artefakten – hier echte PWA, sessionStorage ok auf Netlify.
let TOKEN = sessionStorage.getItem('osteo_token') || '';

function show(el){el.style.display=''}
function hide(el){el.style.display='none'}

function gotoApp(){
  hide(document.getElementById('login'));
  show(document.getElementById('app'));
  loadList();
}

if(TOKEN){ gotoApp(); }

document.getElementById('loginBtn').onclick = async ()=>{
  const pin = document.getElementById('pin').value.trim();
  const msg = document.getElementById('loginMsg');
  if(!pin){ return; }
  try{
    const r = await fetch('/.netlify/functions/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({pin})
    });
    const d = await r.json();
    if(r.ok && d.token){
      TOKEN = d.token; sessionStorage.setItem('osteo_token',TOKEN); gotoApp();
    }else{
      msg.className='msg err'; msg.textContent='Code ungültig.';
    }
  }catch(e){ msg.className='msg err'; msg.textContent='Verbindungsfehler.'; }
};

// === Tabs ===
document.querySelectorAll('.tab').forEach(t=>{
  t.onclick=()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const tab=t.dataset.tab;
    document.getElementById('tab-new').style.display = tab==='new'?'':'none';
    document.getElementById('tab-list').style.display = tab==='list'?'':'none';
    if(tab==='list') loadList();
  };
});

// === Termin anlegen ===
document.getElementById('submitBtn').onclick = async ()=>{
  const msg = document.getElementById('formMsg');
  msg.className='msg'; msg.style.display='none';

  const data = {
    firstName: val('firstName'), lastName: val('lastName'),
    email: val('email'), cc: val('cc'), phone: val('phone').replace(/\D/g,''),
    date: val('date'), time: val('time'),
    practitioner: val('practitioner'), note: val('note')
  };

  // Validierung
  const err = validate(data);
  if(err){ msg.className='msg err'; msg.textContent=err; return; }

  const btn=document.getElementById('submitBtn');
  btn.disabled=true; btn.textContent='Wird gesendet…';
  try{
    const r = await fetch('/.netlify/functions/create-appointment',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},
      body:JSON.stringify(data)
    });
    const d = await r.json();
    if(r.ok){
      clearForm();
      showToast(data.email);
    }else{
      msg.className='msg err'; msg.textContent=d.error||'Fehler beim Anlegen.';
    }
  }catch(e){ msg.className='msg err'; msg.textContent='Verbindungsfehler.'; }
  btn.disabled=false; btn.textContent='Termin anlegen & Bestätigung per E-Mail senden';
};

function val(id){ return document.getElementById(id).value.trim(); }
function validate(d){
  if(!d.firstName||!d.lastName) return 'Bitte Vor- und Nachname angeben.';
  if(!/^[^@]+@[^@]+\.[^@]+$/.test(d.email)) return 'Bitte gültige E-Mail angeben.';
  if(!d.date||!d.time) return 'Bitte Datum und Uhrzeit angeben.';
  const dt = new Date(d.date+'T'+d.time);
  if(dt < new Date()) return 'Der Termin liegt in der Vergangenheit.';
  return null;
}
function clearForm(){
  ['firstName','lastName','email','phone','note'].forEach(id=>document.getElementById(id).value='');
}

// === Bestätigungs-Overlay (auto-close nach 2,5 s) ===
let toastTimer=null;
function showToast(email){
  const t=document.getElementById('toast');
  document.getElementById('toastSub').textContent = email ? ('an '+email) : 'an die angegebene E-Mail-Adresse';
  const check=t.querySelector('.toast-check');
  check.style.display='none'; void check.offsetWidth; check.style.display='';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'), 2500);
}
document.getElementById('toast').onclick=()=>{ document.getElementById('toast').classList.remove('show'); clearTimeout(toastTimer); };

// === Liste laden ===
async function loadList(){
  const box=document.getElementById('apptList');
  try{
    const r = await fetch('/.netlify/functions/list-appointments',{
      headers:{'Authorization':'Bearer '+TOKEN}
    });
    const d = await r.json();
    if(!r.ok){ box.innerHTML='<div class="empty">Konnte Termine nicht laden.</div>'; return; }
    renderTiles(d.appointments||[]);
    renderList(d.appointments||[]);
  }catch(e){ box.innerHTML='<div class="empty">Verbindungsfehler.</div>'; }
}

function renderTiles(appts){
  const upcoming = appts.filter(a=>new Date(a.date+'T'+a.time) >= new Date());
  const tiles=document.getElementById('tiles');
  tiles.innerHTML=
    tile(upcoming.length,'anstehend')+
    tile(appts.length,'gesamt');
}
function tile(n,l){ return `<div class="tile"><div class="n">${n}</div><div class="l">${l}</div></div>`; }

function renderList(appts){
  const box=document.getElementById('apptList');
  const upcoming = appts
    .filter(a=>new Date(a.date+'T'+a.time) >= new Date())
    .sort((a,b)=> new Date(a.date+'T'+a.time)-new Date(b.date+'T'+b.time));
  if(!upcoming.length){ box.innerHTML='<div class="empty">Keine anstehenden Termine.</div>'; return; }
  box.innerHTML = upcoming.map(a=>{
    const dt=new Date(a.date+'T'+a.time);
    const when=dt.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})+' · '+a.time;
    return `<div class="appt">
      <div class="top"><span class="name">${esc(a.firstName)} ${esc(a.lastName)}</span><span class="when">${when}</span></div>
      <div class="meta">${esc(a.practitioner||'')} · ${esc(a.email)}</div>
      <div class="badges">
        ${badge(a.confirmSent,'Bestätigung')}
        ${badge(a.reminder3dSent,'Erinnerung 3 T.')}
        ${badge(a.reminder24hSent,'Erinnerung 24 h')}
      </div>
    </div>`;
  }).join('');
}
function badge(done,label){
  return `<span class="badge ${done?'done':'wait'}">${done?'✓ ':''}${label}</span>`;
}
function esc(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
