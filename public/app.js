// === Konfiguration ===
const CANCEL_FEE = 96;      // 80% von 120 €
const PRICE = 120;
const FEE_HOURS = 24;       // kostenfreie Absage bis 24h vorher

// === Auth entfernt: App ist offen zugänglich, kein PIN-Login mehr ===
const TOKEN = '';

function show(el){el.style.display=''}
function hide(el){el.style.display='none'}

function gotoApp(){
  show(document.getElementById('app'));
  loadList();
}

gotoApp();

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

// === Terminart-Auswahl ===
let selectedType = '';
let ALL_APPTS = [];   // zuletzt geladene Termine (für Patientensuche)
document.querySelectorAll('.typebtn').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.typebtn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    selectedType = b.dataset.type;
  };
});

// === Patientensuche (Name oder Telefon) ===
function uniquePatients(){
  // neueste Daten gewinnen: nach createdAt absteigend, dann pro Person ersten Treffer behalten
  const sorted = [...ALL_APPTS].sort((a,b)=>
    String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const seen = new Map();
  for(const a of sorted){
    const key = ((a.firstName||'')+'|'+(a.lastName||'')+'|'+(a.email||'')).toLowerCase().trim();
    if(key==='||') continue;
    if(!seen.has(key)) seen.set(key, a);
  }
  return [...seen.values()];
}

function patSearch(q){
  const term = q.toLowerCase().trim();
  const digits = q.replace(/\D/g,'');
  if(term.length < 2 && digits.length < 3) return [];
  return uniquePatients().filter(p=>{
    const name = ((p.firstName||'')+' '+(p.lastName||'')).toLowerCase();
    const phone = String(p.phone||'').replace(/\D/g,'');
    const nameHit = term.length>=2 && name.includes(term);
    const phoneHit = digits.length>=3 && phone.includes(digits);
    return nameHit || phoneHit;
  }).slice(0,8);
}

function fillFromPatient(p){
  document.getElementById('firstName').value = p.firstName||'';
  document.getElementById('lastName').value  = p.lastName||'';
  document.getElementById('email').value     = p.email||'';
  document.getElementById('cc').value        = p.cc||'+49';
  document.getElementById('phone').value     = p.phone||'';
  const res = document.getElementById('patResults');
  res.classList.remove('show'); res.innerHTML='';
  document.getElementById('patSearch').value = ((p.firstName||'')+' '+(p.lastName||'')).trim();
}

(function initPatSearch(){
  const inp = document.getElementById('patSearch');
  const res = document.getElementById('patResults');
  if(!inp) return;
  inp.addEventListener('input', ()=>{
    const hits = patSearch(inp.value);
    if(inp.value.trim().length < 2){ res.classList.remove('show'); res.innerHTML=''; return; }
    if(!hits.length){
      res.innerHTML = '<div class="pat-empty">Kein bestehender Patient gefunden.</div>';
      res.classList.add('show'); return;
    }
    res.innerHTML = hits.map((p,i)=>{
      const sub = [p.email, (p.cc||'')+' '+(p.phone||'')].filter(s=>s && s.trim()).join(' · ');
      return `<div class="pat-item" data-i="${i}">
        <div class="pi-name">${esc(p.firstName)} ${esc(p.lastName)}</div>
        <div class="pi-sub">${esc(sub)}</div></div>`;
    }).join('');
    res.classList.add('show');
    res.querySelectorAll('.pat-item').forEach(el=>{
      el.onclick = ()=> fillFromPatient(hits[+el.dataset.i]);
    });
  });
  // Klick außerhalb schließt die Liste
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.patsearch')) res.classList.remove('show');
  });
})();

// === Termin anlegen ===
document.getElementById('submitBtn').onclick = async ()=>{
  const msg = document.getElementById('formMsg');
  msg.className='msg'; msg.style.display='none';

  const data = {
    firstName: val('firstName'), lastName: val('lastName'),
    email: val('email'), cc: val('cc'), phone: val('phone').replace(/\D/g,''),
    date: val('date'), time: val('time'),
    practitioner: val('practitioner'), note: val('note'),
    type: selectedType
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
  if(!d.type) return 'Bitte zuerst die Terminart wählen.';
  if(!d.firstName||!d.lastName) return 'Bitte Vor- und Nachname angeben.';
  if(!/^[^@]+@[^@]+\.[^@]+$/.test(d.email)) return 'Bitte gültige E-Mail angeben.';
  if(!d.date||!d.time) return 'Bitte Datum und Uhrzeit angeben.';
  const dt = new Date(d.date+'T'+d.time);
  if(dt < new Date()) return 'Der Termin liegt in der Vergangenheit.';
  return null;
}
function clearForm(){
  ['firstName','lastName','email','phone','note','patSearch'].forEach(id=>document.getElementById(id).value='');
  document.querySelectorAll('.typebtn').forEach(x=>x.classList.remove('active'));
  selectedType = '';
}

// === Bestätigungs-Overlay (auto-close nach 2,5 s) ===
let toastTimer=null;
function showToast(email, title){
  const t=document.getElementById('toast');
  const tt=document.getElementById('toastTitle');
  if(tt) tt.textContent = title || 'Bestätigung gesendet';
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
    ALL_APPTS = d.appointments||[];
    renderTiles(d.appointments||[]);
    renderList(d.appointments||[]);
  }catch(e){ box.innerHTML='<div class="empty">Verbindungsfehler.</div>'; }
}

function renderTiles(appts){
  const active = appts.filter(a=>(a.status||'active')!=='cancelled' && new Date(a.date+'T'+a.time) >= new Date());
  const cancelled = appts.filter(a=>a.status==='cancelled');
  const tiles=document.getElementById('tiles');
  tiles.innerHTML=
    tile(active.length,'anstehend')+
    tile(cancelled.length,'abgesagt');
}
function tile(n,l){ return `<div class="tile"><div class="n">${n}</div><div class="l">${l}</div></div>`; }

function renderList(appts){
  const box=document.getElementById('apptList');
  const upcoming = appts
    .filter(a=>(a.status||'active')!=='cancelled' && new Date(a.date+'T'+a.time) >= new Date())
    .sort((a,b)=> new Date(a.date+'T'+a.time)-new Date(b.date+'T'+b.time));
  if(!upcoming.length){ box.innerHTML='<div class="empty">Keine anstehenden Termine.</div>'; return; }
  box.innerHTML = upcoming.map(a=>{
    const dt=new Date(a.date+'T'+a.time);
    const when=dt.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})+' · '+a.time;
    const hoursUntil=(dt-new Date())/3600000;
    const free=hoursUntil>=24;
    return `<div class="appt">
      <div class="top"><span class="name">${esc(a.firstName)} ${esc(a.lastName)}</span><span class="when">${when}</span></div>
      <div class="meta">${esc(a.practitioner||'')} · ${a.type==='check'?'Osteo-Check (20 Min)':'Osteopathie (60 Min)'} · ${esc(a.email)}</div>
      <div class="badges">
        ${badge(a.confirmSent,'Bestätigung')}
        ${badge(a.reminder3dSent,'Erinnerung 3 T.')}
        ${badge(a.reminder24hSent,'Erinnerung 24 h')}
      </div>
      <div style="margin-top:11px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button class="ghost cancel-btn" onclick="askCancel('${a.id}','${esc(a.firstName)} ${esc(a.lastName)}','${a.date}','${a.time}')">Termin absagen</button>
        <span style="font-size:.74rem;color:${free?'var(--green)':'var(--warn)'}">
          ${free?'Absage derzeit kostenfrei':'Kurzfristig – Ausfallhonorar-Prüfung'}
        </span>
      </div>
    </div>`;
  }).join('');
}
function badge(done,label){
  return `<span class="badge ${done?'done':'wait'}">${done?'✓ ':''}${label}</span>`;
}
function esc(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// === Termin absagen (Rezeption) ===
async function askCancel(id, name, date, time){
  const dt=new Date(date+'T'+time);
  const hoursUntil=(dt-new Date())/3600000;
  const free=hoursUntil>=24;
  const whenStr=dt.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+' um '+time+' Uhr';
  const msg = free
    ? `Termin von ${name} am ${whenStr} absagen?\n\nDie Absage ist KOSTENFREI (mehr als 24 Stunden vorher).\n\nDer Patient erhält eine Absage-Bestätigung per E-Mail.`
    : `Termin von ${name} am ${whenStr} absagen?\n\n⚠️ KURZFRISTIG: weniger als 24 Stunden vorher.\nGemäß Honorarvereinbarung kann das volle Behandlungshonorar als Ausfallhonorar berechnet werden. Die Absage-Mail weist den Patienten darauf hin, dass wir dies prüfen.\n\nTrotzdem absagen?`;
  if(!confirm(msg)) return;
  try{
    const r = await fetch('/.netlify/functions/cancel-appointment',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},
      body:JSON.stringify({id})
    });
    const d = await r.json();
    if(r.ok){
      showToast('', 'Absage gesendet');
      loadList();
    }else{
      alert(d.error||'Absage fehlgeschlagen.');
    }
  }catch(e){ alert('Verbindungsfehler bei der Absage.'); }
}
