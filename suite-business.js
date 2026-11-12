/* Business suite: reuses existing authenticated api() and showSmartPage() */
(() => {
 const $s=id=>document.getElementById(id);
 const moneyS=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n||0));
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const msg=(id,txt,ok=false)=>{const el=$s(id);if(el){el.textContent=txt;el.style.color=ok?'#047857':'#b91c1c';}};
 const data=f=>Object.fromEntries(new FormData(f).entries());
 async function purchases(){
  const [products,bills]=await Promise.all([api('/api/products'),api('/api/purchase-bills')]);
  const select=$s('suitePurchaseProduct');const old=select.value;
  select.replaceChildren(new Option('Choose product',''));
  for(const p of products)select.add(new Option(`${p.name} (${p.sku}) · stock ${p.stock}`,p.id));
  if(products.some(p=>String(p.id)===old))select.value=old;
  const tbody=$s('suitePurchaseRows');tbody.replaceChildren();
  for(const b of bills){const tr=document.createElement('tr');const due=Number(b.total)-Number(b.paid);
   tr.innerHTML=`<td>${safe(b.billNumber)}</td><td>${safe(b.supplier)}</td><td>${safe(b.productName)}</td><td>${b.quantity}</td><td>${moneyS(b.total)}</td><td>${moneyS(b.paid)}</td><td class="${due>0?'suite-due':'suite-paid'}">${moneyS(due)}</td><td></td>`;
   if(due>0){const btn=document.createElement('button');btn.type='button';btn.textContent='Record payment';btn.onclick=async()=>{const raw=prompt(`Due ${moneyS(due)}. Amount received by supplier:`);if(raw===null)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0||amount>due){alert('Enter an amount within the outstanding balance.');return;}try{await api(`/api/purchase-bills/${b.id}/payments`,{method:'POST',body:JSON.stringify({amount})});await purchases();}catch(e){alert(e.message);}};tr.lastElementChild.append(btn);}
   tbody.append(tr);
  }
 }
 async function quotations(){
  const quotes=await api('/api/quotations');const tbody=$s('suiteQuoteRows');tbody.replaceChildren();
  for(const q of quotes){const tr=document.createElement('tr');tr.innerHTML=`<td>${safe(q.quoteNumber)}</td><td>${safe(q.customer)}</td><td>${safe(q.description)}</td><td>${moneyS(q.total)}</td><td>${safe(q.validUntil)}</td><td></td><td></td>`;
   const status=document.createElement('select');for(const val of ['DRAFT','SENT','ACCEPTED','REJECTED'])status.add(new Option(val,val));status.value=q.status;
   status.onchange=async()=>{try{await api(`/api/quotations/${q.id}/status`,{method:'PATCH',body:JSON.stringify({status:status.value})});}catch(e){alert(e.message);status.value=q.status;}};tr.children[5].append(status);
   const btn=document.createElement('button');btn.type='button';btn.textContent='Prepare invoice';btn.disabled=q.status!=='ACCEPTED';btn.title='Only accepted quotations can be prepared';
   btn.onclick=()=>{showSmartPage('create');const f=$s('invoiceForm');f.elements.namedItem('customerName').value=q.customer;f.elements.namedItem('invoiceNumber').value=q.quoteNumber+'-INV';const first=$s('invoiceItemRows')?.firstElementChild;if(first){first.querySelector('.item-description').value=q.description;first.querySelector('.item-quantity').value=q.quantity;first.querySelector('.item-price').value=q.unitPrice;}if(typeof updateInvoiceTotals==='function')updateInvoiceTotals();window.scrollTo({top:0,behavior:'smooth'});alert('Invoice draft prepared. Review dates, tax, items and totals, then save manually.');};tr.lastElementChild.append(btn);tbody.append(tr);
  }
 }
 async function settings(){const b=await api('/api/business-settings');const f=$s('suiteSettingsForm');for(const [k,v] of Object.entries(b)){const el=f.elements.namedItem(k);if(el)el.value=v??'';}}
 $s('suitePurchaseForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,d=data(f);d.productId=Number(d.productId);d.quantity=Number(d.quantity);d.unitCost=Number(d.unitCost);d.amountPaid=Number(d.amountPaid);const btn=f.querySelector('button[type=submit]');btn.disabled=true;try{await api('/api/purchase-bills',{method:'POST',body:JSON.stringify(d)});msg('suitePurchaseMessage','Purchase saved. Inventory stock increased.',true);f.reset();await purchases();if(typeof loadProducts==='function')await loadProducts();}catch(err){msg('suitePurchaseMessage',err.message);}finally{btn.disabled=false;}});
 $s('suiteQuoteForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,d=data(f);d.quantity=Number(d.quantity);d.unitPrice=Number(d.unitPrice);try{await api('/api/quotations',{method:'POST',body:JSON.stringify(d)});msg('suiteQuoteMessage','Quotation created.',true);f.reset();await quotations();}catch(err){msg('suiteQuoteMessage',err.message);}});
 $s('suiteSettingsForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/business-settings',{method:'PUT',body:JSON.stringify(data(e.currentTarget))});msg('suiteSettingsMessage','Business settings saved.',true);}catch(err){msg('suiteSettingsMessage',err.message);}});
 document.querySelectorAll('.sidebarLink[data-page]').forEach(link=>link.addEventListener('click',()=>{const page=link.dataset.page;if(page==='purchases')purchases().catch(e=>msg('suitePurchaseMessage',e.message));if(page==='quotations')quotations().catch(e=>msg('suiteQuoteMessage',e.message));if(page==='settings')settings().catch(e=>msg('suiteSettingsMessage',e.message));}));
 const today=new Date().toLocaleDateString('en-CA');for(const id of ['suitePurchaseForm','suiteQuoteForm']){const f=$s(id);if(f){const el=f.querySelector('input[type=date]');if(el)el.value=today;}}
})();
