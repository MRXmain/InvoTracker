(()=>{
const $=id=>document.getElementById(id), fmt=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n||0));
let ledgers=[];
const cell=(row,text)=>{const td=document.createElement('td');td.textContent=text;row.append(td);return td;};
function render(){const rows=$('itLedgerRows');rows.replaceChildren();const q=$('itLedgerSearch').value.trim().toLowerCase(),type=$('itLedgerType').value;
for(const l of ledgers.filter(l=>(type==='ALL'||l.type===type)&&l.name.toLowerCase().includes(q))){const tr=document.createElement('tr');cell(tr,l.name);cell(tr,l.type);cell(tr,fmt(l.billed));cell(tr,fmt(l.paid));cell(tr,fmt(l.balance));const td=cell(tr,'');const b=document.createElement('button');b.type='button';b.textContent='View ledger';b.addEventListener('click',()=>{const body=$('itLedgerEntries');body.replaceChildren();$('itLedgerPartyName').textContent=l.name+' — '+l.type;for(const e of l.entries){const row=document.createElement('tr');for(const v of [e.date,e.kind,e.reference,fmt(e.debit),fmt(e.credit),e.description])cell(row,v);body.append(row);}if(!l.entries.length){const row=document.createElement('tr');const c=cell(row,'No transactions for this party yet.');c.colSpan=6;body.append(row);}$('itLedgerDetails').hidden=false;});td.append(b);rows.append(tr);}
}
async function load(){try{$('itLedgerMessage').textContent='Loading...';ledgers=await api('/api/party-ledgers');$('itReceivables').textContent=fmt(ledgers.filter(x=>x.type==='CUSTOMER').reduce((a,x)=>a+Number(x.balance),0));$('itPayables').textContent=fmt(ledgers.filter(x=>x.type==='SUPPLIER').reduce((a,x)=>a+Number(x.balance),0));$('itPartyCount').textContent=String(ledgers.length);$('itLedgerDetails').hidden=true;render();$('itLedgerMessage').textContent='';}catch(e){$('itLedgerMessage').textContent=e.message||'Unable to load ledgers';}}
$('itLedgerSearch')?.addEventListener('input',render);$('itLedgerType')?.addEventListener('change',render);$('itLedgerRefresh')?.addEventListener('click',load);
document.querySelector('[data-page="ledger"]')?.addEventListener('click',()=>setTimeout(load,0));
})();
