// WhatsApp-Versand via Meta Cloud API.
// Läuft, sobald die ENV-Variablen gesetzt sind. Bis dahin: no-op mit Logeintrag.
//
// Benötigte ENV:
//   WHATSAPP_TOKEN        – permanenter System-User Access Token
//   WHATSAPP_PHONE_ID     – Phone Number ID der Praxis-Nummer
//   WHATSAPP_TPL_3D       – Name des genehmigten 3-Tage-Templates (z.B. "osteo_erinnerung_3d")
//   WHATSAPP_TPL_24H      – Name des genehmigten 24h-Templates (z.B. "osteo_erinnerung_24h")
//   WHATSAPP_TPL_LANG     – Sprachcode des Templates (z.B. "de")

function isConfigured(){
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

// to: vollständige Nummer im internationalen Format ohne + (z.B. 4915123456789)
// params: Array der Template-Variablen {{1}}, {{2}}, ...
async function sendTemplate(to, templateName, params){
  // Sicherheitsschalter: ohne LIVE_MODE=true wird NICHT real gesendet.
  if(process.env.LIVE_MODE !== 'true'){
    console.log(`[TESTMODUS] WhatsApp NICHT gesendet: ${templateName} an ${to} ::`, params);
    return { testMode:true };
  }
  if(!isConfigured()){
    console.log(`[WhatsApp] (nicht konfiguriert) würde senden: ${templateName} an ${to} ::`, params);
    return { skipped:true };
  }
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const body = {
    messaging_product:'whatsapp',
    to,
    type:'template',
    template:{
      name: templateName,
      language:{ code: process.env.WHATSAPP_TPL_LANG || 'de' },
      components:[{
        type:'body',
        parameters: params.map(p=>({type:'text', text:String(p)}))
      }]
    }
  };
  const r = await fetch(url,{
    method:'POST',
    headers:{'Authorization':'Bearer '+process.env.WHATSAPP_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const d = await r.json();
  if(!r.ok) throw new Error('WhatsApp send: '+JSON.stringify(d));
  return d;
}

// Baut die Empfängernummer aus cc + phone (ohne +, ohne führende 0)
function buildRecipient(cc, phone){
  const ccNum = (cc||'+49').replace(/\D/g,'');
  let p = (phone||'').replace(/\D/g,'');
  if(p.startsWith('0')) p = p.slice(1);
  return ccNum + p;
}

// Template-Parameter:
//   3-Tage:  {{1}} Vorname, {{2}} Datum (z.B. "Mo, 15.06."), {{3}} Uhrzeit
//   24h:     identisch
function reminder3d(a){
  return sendTemplate(
    buildRecipient(a.cc, a.phone),
    process.env.WHATSAPP_TPL_3D || 'osteo_erinnerung_3d',
    [a.firstName, fmtDate(a), a.time]
  );
}
function reminder24h(a){
  return sendTemplate(
    buildRecipient(a.cc, a.phone),
    process.env.WHATSAPP_TPL_24H || 'osteo_erinnerung_24h',
    [a.firstName, fmtDate(a), a.time]
  );
}
function fmtDate(a){
  const dt = new Date(a.date+'T'+a.time);
  return dt.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
}

module.exports = { sendTemplate, reminder3d, reminder24h, buildRecipient, isConfigured };
