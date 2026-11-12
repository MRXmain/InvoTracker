/* SmartStock upgrade: browser OCR interpretation + server-authoritative receipts. */
(()=>{
 const el=id=>document.getElementById(id);
 const note=(msg,ok=false)=>{const e=el('smartReceiptMessage');e.textContent=msg;e.style.color=ok?'#16803c':'#b42318';};
 let catalog=[];
 async function refreshCatalog(){try{const result=await api('/api/products');catalog=Array.isArray(result)?result:[];return true;}catch(error){catalog=[];console.warn('Product catalog unavailable; continuing with OCR recognition:',error);return false;}}
 function addLine(data={}){
  const row=document.createElement('div');row.className='smartstock-line';
  const field=(label,key,type='text')=>{const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.dataset.key=key;input.type=type;input.value=data[key]??'';if(type==='number'){input.min='0';input.step=key==='price'?'0.01':'1';}wrap.append(input);row.append(wrap);return input;};
  const match=document.createElement('label');match.textContent='Catalog match';const sel=document.createElement('select');sel.dataset.key='productId';sel.add(new Option('Create new product',''));for(const p of catalog)sel.add(new Option(`${p.name} (${p.sku}) · ${p.stock} in stock`,p.id));match.append(sel);row.append(match);
  const name=field('Product name','name');const sku=field('SKU / barcode','sku');const qty=field('Received quantity','quantity','number');const price=field('Unit price ₹','price','number');
  if(data.productId)sel.value=String(data.productId);
  sel.addEventListener('change',()=>{const p=catalog.find(p=>String(p.id)===sel.value);if(p){name.value=p.name;sku.value=p.sku;price.value=p.price;}});
  const del=document.createElement('button');del.type='button';del.textContent='Remove';del.addEventListener('click',()=>row.remove());row.append(del);el('smartLines').append(row);
 }
 function parse(text){
  const pages=String(text||'').split(/(?=--- PAGE \d+ ---)/).filter(x=>x.trim());
  const invoicePages=pages.filter(x=>/\b(?:invoice\s*(?:no|number)|seller name|invoice from)\s*:/i.test(x));
  // Multiple independent invoices must never be merged into a single stock receipt.
  const source=invoicePages[0]||pages[0]||String(text||'');
  const lines=source.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const labeled=source.match(/(?:seller\s*name|supplier\s*name|vendor|sold\s*by|invoice\s*from)\s*:\s*([^\n]+?)(?=\s{2,}(?:Invoice To|Seller GSTIN|GSTIN|FSSAI|Address)\s*:|$)/i);
  const supplier=labeled?.[1]?.trim()||'';
  const inv=source.match(/(?:invoice\s*(?:number|no\.?|#)|bill\s*(?:number|no\.?|#))\s*[:#-]?\s*([A-Z0-9\/-]{2,})/i);
  const products=[];let uncertain=0;
  const clean=x=>String(x||'').replace(/^\d+[.)]\s*/,'').replace(/\s+/g,' ').trim();
  const isName=x=>!!x&&/[a-z]{3}/i.test(x)&&!/^(?:tax invoice|invoice|gstin|hsn|discount|net|total|amount|code|quantity|description|sr\b|no\b|page\b|---|cess|cgst|sgst|igst|subtotal|date|state|category|seller|customer|order|address|document|fssai|place|taxable|additional)/i.test(x);
  // GST row: row-number [optional description] quantity UQC HSN taxable discount net CGST% CGST SGST% SGST cess% cess additional-cess amount
  const gstRow=/^(\d{1,3})[.)]\s*(.*?)\s+(\d+(?:\.\d+)?)\s+(NOS|PCS?|PIECES?|UNITS?|KG|G|LTR|LITRES?|BOX(?:ES)?)\s+(\d{4,8})\s+(.+)$/i;
  for(let i=0;i<lines.length;i++){
   const m=lines[i].match(gstRow);if(!m)continue;
   const values=(m[6].match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);
   if(values.length<10){uncertain++;continue;}
   const preceding=[];for(let j=i-1;j>=0&&j>=i-2;j--){const v=clean(lines[j]);if(isName(v)&&!gstRow.test(lines[j])&&!/^\d+[.)]/.test(lines[j]))preceding.unshift(v);else break;}
   const following=[];for(let j=i+1;j<lines.length&&j<=i+2;j++){const v=clean(lines[j]);if(isName(v)&&!gstRow.test(lines[j])&&!/^\d+[.)]/.test(lines[j]))following.push(v);else break;}
   const name=[...preceding,clean(m[2]),...following].filter(isName).join(' ').trim();
   const qty=Number(m[3]),hsn=m[5],lineTotal=values[values.length-1];
   // On GST-inclusive receipts the final line amount / quantity is the stock cost.
   const price=qty>0?Math.round(lineTotal/qty*100)/100:NaN;
   if(!name||!Number.isFinite(price)||qty<=0||!Number.isInteger(qty)){uncertain++;continue;}
   const normalize=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
   const matched=catalog.find(p=>normalize(p.name)===normalize(name));
   products.push({name,sku:matched?.sku||'',quantity:qty,price,productId:matched?.id||null,hsn,confidence:'medium'});
  }
  if(!products.length){
   // Simple invoice fallback; never apply this to GST tables (prevents tax columns becoming quantities).
   const hasGST=/\b(?:CGST|SGST|IGST)\b/i.test(source)&&/\bHSN\b/i.test(source);
   if(!hasGST)for(const original of lines){
    if(/^(?:subtotal|total|grand total|tax|gst|amount|invoice|date|supplier|bill to|ship to|terms)/i.test(original))continue;
    const m=original.match(/^(?:\d{1,3}[.\s]+)?(.{3,75}?)\s+(\d{1,6})\s+(?:₹\s*)?([\d,]+(?:\.\d{1,2})?)(?:\s|$)/);
    if(!m)continue;const name=m[1].trim(),quantity=Number(m[2]),price=Number(m[3].replaceAll(',',''));
    if(!isName(name)||quantity<=0||!Number.isFinite(price))continue;
    products.push({name,sku:'',quantity,price,productId:null});
   }
  }
  const classification='Direction unverified — confirm this is a supplier purchase before receiving stock';
  return {supplier,invoiceNumber:inv?.[1]||'',products,classification,supplierSuggested:false,
   needsReview:uncertain>0||invoicePages.length>1||!supplier||!products.length,
   warning:(invoicePages.length>1?'Multiple invoices detected: only the first invoice was parsed. Scan each invoice separately. ':'')+(uncertain?`${uncertain} GST row(s) could not be mapped. `:'')+(!supplier?'Supplier not confidently identified. ':'')};
 }
 el('smartParse')?.addEventListener('click',async()=>{
  try{const raw=el('ocrResult').value;if(!raw.trim())throw Error('Scan or upload an invoice first.');const catalogAvailable=await refreshCatalog();
   const result=parse(raw);el('smartSupplier').value=result.supplier;el('smartInvoiceNo').value=result.invoiceNumber;el('smartLines').replaceChildren();result.products.forEach(addLine);
   if(!result.products.length)addLine();el('smartDetected').textContent=`Document classification: ${result.classification}. Recognized ${result.products.length} possible product line(s). ${result.warning||''}Check all amounts against the image before receiving stock.`;
   el('smartReceive').dataset.scanReviewRequired=result.needsReview?'true':'false';
   note('Products recognized. Review the fields before confirming receipt.'+(catalogAvailable?'':' Catalog unavailable: existing-product matching was skipped.'),true);
  }catch(e){note(e.message);}
 });
 el('smartAddLine')?.addEventListener('click',async()=>{try{if(!catalog.length)await refreshCatalog();addLine();}catch(e){note(e.message);}});
 el('smartReceive')?.addEventListener('click',async()=>{
  const button=el('smartReceive');try{
   const supplier=el('smartSupplier').value.trim(),invoiceNumber=el('smartInvoiceNo').value.trim();
   const items=[...el('smartLines').children].map(row=>{const get=k=>row.querySelector(`[data-key="${k}"]`)?.value||'';return {name:get('name').trim(),sku:get('sku').trim(),quantity:Number(get('quantity')),price:Number(get('price')),productId:get('productId')?Number(get('productId')):null};});
   if(!supplier||!invoiceNumber||!items.length||items.some(i=>!i.name||!Number.isInteger(i.quantity)||i.quantity<=0||!Number.isFinite(i.price)||i.price<0))throw Error('Check supplier, invoice number, product names, quantities and prices.');
   if(button.dataset.scanReviewRequired==='true'&&!confirm('Scanner flagged incomplete or multiple-invoice data. Have you manually verified every product, quantity, price, and supplier?'))return;
   if(!confirm(`Confirm actual receipt of ${items.reduce((s,i)=>s+i.quantity,0)} units from ${supplier}? Inventory will increase.`))return;
   button.disabled=true;const result=await api('/api/smartstock/receive',{method:'POST',body:JSON.stringify({supplier,invoiceNumber,items})});
   note(`Receipt saved: ${result.unitsReceived} units across ${result.productTypes} lines. ${result.productsCreated} new catalog product(s).`,true);
   await refreshCatalog();await showMonthly();
  }catch(e){note(e.message);}finally{button.disabled=false;}
 });
 async function showMonthly(){
  const month=el('smartMonth').value;const rows=el('smartStatsRows');rows.replaceChildren();
  const data=await api('/api/smartstock/monthly'+(month?'?month='+encodeURIComponent(month):''));
  const sold=data.map(p=>p.unitsSold).filter(v=>v>0).sort((a,b)=>a-b);
  const median=sold.length?sold[Math.floor((sold.length-1)/2)]:0;
  for(const p of data){
   const category=p.unitsSold===0?'No sales':p.unitsSold>=median&&p.unitsSold>0?'Fast-moving':'Slow-moving';
   const tr=rows.insertRow();for(const v of [p.product,p.unitsSold,money(p.revenue),p.stock,p.suggestedOrder,category]){const td=tr.insertCell();td.textContent=v;}
  }
  if(!data.length){const tr=rows.insertRow();tr.insertCell().textContent='No catalog products yet.';}
 }
 el('smartMonth').value=[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0')].join('-');
 document.addEventListener('invotracker:inventory-changed',()=>showMonthly().catch(e=>console.warn('Monthly statistics refresh failed:',e)));
 el('smartStatsRefresh')?.addEventListener('click',()=>showMonthly().catch(e=>note(e.message)));
 document.querySelectorAll('[data-page="products"]').forEach(link=>link.addEventListener('click',()=>showMonthly().catch(console.warn)));
 const zoom=el('smartZoom');zoom?.addEventListener('input',async()=>{
  const video=el('ocrVideo'),track=video.srcObject?.getVideoTracks?.()[0];if(!track)return;
  try{await track.applyConstraints({advanced:[{zoom:Number(zoom.value)}]});el('zoomNote').textContent=`Zoom ${Number(zoom.value).toFixed(1)}×`;}catch(e){el('zoomNote').textContent='Zoom adjustment not supported: '+e.message;}
 });
 el('scanProductBarcode')?.addEventListener('click',async()=>{
  const target=el('barcodeFeedback');try{
   if(!('BarcodeDetector' in window))throw Error('Barcode scanning is unavailable in this browser. Enter SKU manually.');
   const video=el('ocrVideo');if(!video.videoWidth)throw Error('Start the camera first.');
   const detector=new BarcodeDetector();const found=await detector.detect(video);if(!found.length)throw Error('No barcode found. Move closer, adjust zoom and retry.');
   const code=found[0].rawValue;target.textContent='Scanned barcode: '+code;
   const row=el('smartLines').lastElementChild;if(row)row.querySelector('[data-key="sku"]').value=code;
  }catch(e){target.textContent=e.message;}
 });
})();
