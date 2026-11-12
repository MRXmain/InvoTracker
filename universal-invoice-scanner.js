/* InvoTracker universal invoice extraction: conservative, review-first, no external API. */
(()=>{'use strict';
const n=s=>Number(String(s??'').replace(/[₹,\s]/g,''));
const money=s=>/^-?\d[\d,]*(?:\.\d+)?$/.test(String(s||'').trim());
const pick=(text,patterns)=>{for(const p of patterns){const m=text.match(p);if(m)return m[1].trim();}return '';};
const valid=(v)=>Number.isFinite(v)&&v>=0;
function parse(raw){
 const text=String(raw||'').replace(/\u00a0/g,' '), lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const invoiceNumber=pick(text,[/(?:invoice\s*(?:no\.?|number|#)|bill\s*(?:no\.?|#))\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]+)/i]);
 const customer=pick(text,[/(?:bill\s*to|invoice\s*to|customer\s*name|legal\s*name)\s*:\s*([^\n]+)/i]);
 const supplier=pick(text,[/(?:seller\s*name|invoice\s*from|supplier\s*name)\s*:\s*([^\n]+)/i]);
 const gstins=[...text.matchAll(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g)].map(m=>m[0]);
 const items=[],warnings=[];
 const header=/\b(?:description of goods|description|item|product)\b/i;
 const taxHeader=/\b(?:CGST|SGST|IGST|HSN|SAC|taxable|cess)\b/i;
 const hasTaxTable=lines.some(l=>header.test(l)&&taxHeader.test(l))||/CGST\s*%|SGST\s*%|IGST\s*%/i.test(text);
 const totals=[];
 for(const l of lines){const m=l.match(/(?:invoice\s*(?:value|total)|grand\s*total|total\s*amount)\s*(?:\(.*?\))?\s*[:₹ ]+([\d,]+(?:\.\d+)?)/i);if(m)totals.push(n(m[1]));}
 // Simple table rows: description, qty, unit price, line total.
 for(const line of lines){
  if(/^(?:total|subtotal|grand|invoice|amount in words|tax|gst|page|---)/i.test(line))continue;
  let m=line.match(/^\s*(?:\d+[.)]\s+)?([\p{L}][\p{L}\p{N} .,&()\/+\-]{2,100}?)\s{2,}(\d+(?:\.\d+)?)\s{2,}(?:₹\s*)?([\d,]+(?:\.\d+)?)\s{2,}(?:₹\s*)?([\d,]+(?:\.\d+)?)\s*$/u);
  if(!m)m=line.match(/^\s*(?:\d+[.)]\s+)?([\p{L}][\p{L}\p{N} .,&()\/+\-]{2,100}?)\s+(\d+(?:\.\d+)?)\s+(?:₹\s*)?([\d,]+(?:\.\d+)?)\s+(?:₹\s*)?([\d,]+(?:\.\d+)?)\s*$/u);
  if(m){const qty=n(m[2]),rate=n(m[3]),amount=n(m[4]);if(valid(qty)&&qty>0&&valid(rate)&&valid(amount)&&!/(?:invoice|balance|total|amount|taxable|discount)/i.test(m[1]))items.push({description:m[1].trim(),quantity:qty,unitPrice:rate,lineTotal:amount,hsn:'',cgst:null,sgst:null,igst:null,confidence:'medium'});}
 }
 // GST tables: detect HSN and quantities; preserve raw rows rather than mislabel columns as prices.
 const gstRows=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];const match=line.match(/\b(\d{4,8})\b/);
  if(!match||!/^\s*(?:\d+[.)]?\s+)?[A-Za-z]/.test(line)||/HSN|SAC|code|description|subtotal/i.test(line))continue;
  const pre=line.slice(0,match.index).replace(/^\d+[.)]?\s*/,'').trim();
  const nums=(line.slice(match.index+match[0].length).match(/\d+(?:\.\d+)?/g)||[]).map(Number);
  if(pre.length>2&&nums.length>=4){
   // GST-heavy tables contain taxable, discount, net taxable, CGST%, CGST, SGST%, SGST, etc.
   gstRows.push({description:pre,hsn:match[1],raw:line,values:nums});
  }
 }
 if(hasTaxTable){
   warnings.push('GST columns detected. Per-item CGST, SGST, IGST, discounts and taxable values require verification against the original table.');
   if(gstRows.length){warnings.push(`${gstRows.length} possible GST item row(s) found; check the source layout before importing.`);}
 }
 const rates=[...text.matchAll(/(?:GST|IGST|CGST|SGST)\s*(?:rate)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/gi)].map(m=>Number(m[1]));
 const unique=[...new Set(rates)];const singleTaxRate=unique.length===1&&!hasTaxTable?unique[0]:null;
 if(hasTaxTable)warnings.push('A single invoice-wide GST rate cannot represent mixed-rate GST invoices. Tax details are shown for review only.');
 if(!items.length)warnings.push('No reliably mapped product rows. Use the original invoice to fill items manually; nothing has been guessed.');
 if(!invoiceNumber)warnings.push('Invoice number not confidently identified.');
 if(!totals.length)warnings.push('Invoice total not confidently identified.');
 const pageMarkers=[...text.matchAll(/--- PAGE (\d+) ---/g)].length;
 if(pageMarkers>1)warnings.push('Multipage document: pages may contain separate invoices. Confirm document boundaries before importing.');
 return {invoiceNumber,customer,supplier,gstins,items,gstRows,hasTaxTable,invoiceTotal:totals[0]??null,singleTaxRate,warnings,raw:text};
}
function showReview(r){
 let panel=document.getElementById('universalScannerReview');
 if(!panel){panel=document.createElement('section');panel.id='universalScannerReview';panel.style.cssText='margin:14px 0;padding:18px;border:1px solid #8391b5;border-radius:14px;background:var(--card-bg,#171c28);color:inherit;max-height:450px;overflow:auto';const target=document.getElementById('ocrResult');target?.parentElement?.insertAdjacentElement('afterend',panel);}
 panel.replaceChildren();const title=document.createElement('h3');title.textContent='Invoice extraction review · Verify before saving';panel.append(title);
 const summary=document.createElement('p');summary.textContent=`Invoice: ${r.invoiceNumber||'Uncertain'} | Supplier: ${r.supplier||'Uncertain'} | Products: ${r.items.length} | GST candidates: ${r.gstRows.length} | Total: ${r.invoiceTotal===null?'Uncertain':'₹'+r.invoiceTotal}`;panel.append(summary);
 for(const warning of r.warnings){const x=document.createElement('p');x.textContent='⚠ '+warning;x.style.color='#e8a65d';panel.append(x);}
 if(r.gstRows.length){const h=document.createElement('h4');h.textContent='GST table candidates (raw source retained)';panel.append(h);for(const row of r.gstRows){const x=document.createElement('p');x.textContent=`${row.description} · HSN ${row.hsn} · ${row.values.join(' | ')}`;x.style.cssText='font-size:12px;overflow-wrap:anywhere;border-bottom:1px solid #7774;padding:7px';panel.append(x);}}
}
window.InvoUniversalScanner={parse,showReview};
})();
