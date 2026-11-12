/* InvoTracker Android local data service. IndexedDB, no network requests. */
(function(){
'use strict';
const databaseName='invotracker_android_local_v2';
let dbPromise;
function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(databaseName,1);r.onupgradeneeded=()=>{const d=r.result;for(const n of ['invoices','products','contacts','purchases','quotations','settings','payments','audit'])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return dbPromise;}
async function all(store){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function put(store,item){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store,'readwrite').objectStore(store).put(item);r.onsuccess=()=>resolve(item);r.onerror=()=>reject(r.error);});}
async function del(store,id){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store,'readwrite').objectStore(store).delete(id);r.onsuccess=()=>resolve(null);r.onerror=()=>reject(r.error);});}
function uid(){return Date.now()*1000+Math.floor(Math.random()*999);}
function num(x){return Number(x||0);}
function required(x,label){if(!String(x||'').trim())throw Error(label+' is required');}
function today(){return new Date().toLocaleDateString('en-CA');}
function status(inv){if(inv.cancelled)return 'CANCELLED';if(num(inv.balance)<=0)return 'PAID';if(inv.dueDate&&inv.dueDate<today())return 'OVERDUE';return num(inv.paidAmount)>0?'PARTIALLY_PAID':'UNPAID';}
async function payment(kind,id,amount){const store=kind==='purchase'?'purchases':'invoices';const rows=await all(store);const row=rows.find(x=>String(x.id)===String(id));if(!row)throw Error('Record not found');amount=num(amount);const due=kind==='purchase'?num(row.total)-num(row.paid):num(row.balance);if(!(amount>0&&amount<=due+.001))throw Error('Payment must be greater than zero and not exceed balance');if(kind==='purchase')row.paid=num(row.paid)+amount;else{row.paidAmount=num(row.paidAmount)+amount;row.balance=Math.max(0,num(row.totalAmount)-num(row.paidAmount));row.status=status(row);}await put(store,row);const p={id:uid(),kind,recordId:id,amount,receivedAt:new Date().toISOString()};await put('payments',p);return p;}
async function request(method,path,body){const b=JSON.parse(body||'{}');const u=new URL(path,'https://offline.local');const p=u.pathname;const segments=p.split('/').filter(Boolean);
if(p==='/api/products'){
 if(method==='GET')return all('products');
 if(method==='POST'){required(b.name,'Product name');required(b.sku,'SKU');const rows=await all('products');if(rows.some(x=>x.sku.toLowerCase()===String(b.sku).toLowerCase()))throw Error('SKU already exists');const x={...b,id:uid(),stock:num(b.stock),price:num(b.price),lowStockLevel:num(b.lowStockLevel)};await put('products',x);return x;}
}
if(segments[1]==='products'&&segments[2]){const id=segments[2],row=(await all('products')).find(x=>String(x.id)===id);if(!row)throw Error('Product not found');if(method==='DELETE'){await del('products',row.id);return null;}if(method==='PUT'){const x={...row,...b,id:row.id,stock:num(b.stock),price:num(b.price)};await put('products',x);return x;}}
if(p==='/api/contacts'){if(method==='GET')return all('contacts');if(method==='POST'){required(b.name,'Contact name');const x={...b,id:uid()};await put('contacts',x);return x;}}
if(segments[1]==='contacts'&&segments[2]){const id=segments[2],row=(await all('contacts')).find(x=>String(x.id)===id);if(!row)throw Error('Contact not found');if(method==='DELETE'){await del('contacts',row.id);return null;}if(method==='PUT'){const x={...row,...b,id:row.id};await put('contacts',x);return x;}}
if(p==='/api/invoices/summary'){const invoices=await all('invoices');return {invoiceCount:invoices.length,totalInvoiced:invoices.reduce((s,x)=>s+num(x.totalAmount),0),totalPaid:invoices.reduce((s,x)=>s+num(x.paidAmount),0),outstanding:invoices.reduce((s,x)=>s+num(x.balance),0),overdueCount:invoices.filter(x=>x.balance>0&&x.dueDate<today()).length};}
if(p==='/api/invoices'&&method==='GET')return all('invoices');
if(p==='/api/invoices/itemized'&&method==='POST'){
 required(b.invoiceNumber,'Invoice number');required(b.customerName,'Customer name');const invoices=await all('invoices');if(invoices.some(x=>x.invoiceNumber.toLowerCase()===String(b.invoiceNumber).toLowerCase()))throw Error('Invoice number already exists');
 const items=(b.items||[]).map(x=>({...x,quantity:num(x.quantity),unitPrice:num(x.unitPrice),discountPercent:num(x.discountPercent),gstRate:x.gstRate==null?num(b.gstRate):num(x.gstRate)}));if(!items.length||items.some(x=>!x.description||x.quantity<=0||x.unitPrice<0))throw Error('Enter valid invoice items');
 const products=await all('products');const requested={};for(const x of items)if(x.productId){const product=products.find(p=>String(p.id)===String(x.productId));if(!product)throw Error('Linked product not found');requested[product.id]=(requested[product.id]||0)+x.quantity;}
 for(const [id,qty] of Object.entries(requested)){const product=products.find(x=>String(x.id)===id);if(qty>num(product.stock))throw Error('Insufficient stock: '+product.name);}
 const gross=items.reduce((s,x)=>s+x.quantity*x.unitPrice,0);const discounted=items.reduce((s,x)=>s+x.quantity*x.unitPrice*(1-x.discountPercent/100),0);const discount=num(b.discount);if(discount<0||discount>=discounted)throw Error('Invalid discount');
 const taxable=discounted-discount;const tax=items.reduce((s,x)=>{const line=x.quantity*x.unitPrice*(1-x.discountPercent/100);return s+Math.max(0,line-(discounted?discount*line/discounted:0))*x.gstRate/100;},0);const total=Math.round((taxable+tax)*100)/100;
 const inv={...b,id:uid(),items,gstRate:num(b.gstRate),taxableAmount:taxable,gstAmount:tax,totalAmount:total,paidAmount:0,balance:total,status:'UNPAID',riskLevel:'LOW',issueDate:b.issueDate||today()};
 await put('invoices',inv);for(const [id,qty] of Object.entries(requested)){const product=products.find(x=>String(x.id)===id);product.stock-=qty;await put('products',product);}await put('audit',{id:uid(),invoiceId:inv.id,action:'CREATED',at:new Date().toISOString(),actor:'Offline user'});return inv;
}
if(segments[1]==='invoices'&&segments[2]){
 const id=segments[2];const invoice=(await all('invoices')).find(x=>String(x.id)===id);if(!invoice)throw Error('Invoice not found');const suffix=segments[3];
 if(method==='DELETE'&&!suffix){invoice.cancelled=true;invoice.status='CANCELLED';await put('invoices',invoice);return null;}
 if(suffix==='payments'&&method==='POST')return payment('invoice',id,b.amount);
 if(suffix==='items')return invoice.items||[];
 if(suffix==='payment-history')return (await all('payments')).filter(x=>x.kind==='invoice'&&String(x.recordId)===id);
 if(suffix==='audit')return (await all('audit')).filter(x=>String(x.invoiceId)===id);
 if(suffix==='health')return {valid:!invoice.cancelled&&invoice.balance>=0,warnings:invoice.cancelled?['Cancelled invoice']:[]};
 if(suffix==='fraud-review')return {level:'LOW',score:0,warnings:['Offline basic checks only; not a fraud certification.']};
 if(suffix==='investigation')return {invoiceId:invoice.id,level:'LOW',score:0,warnings:[],signals:[]};
}
if(p==='/api/purchase-bills'){if(method==='GET')return all('purchases');if(method==='POST'){const products=await all('products');const product=products.find(x=>String(x.id)===String(b.productId));if(!product)throw Error('Select a product');const quantity=num(b.quantity),cost=num(b.unitCost),paid=num(b.amountPaid);if(quantity<=0||cost<0||paid<0||paid>quantity*cost)throw Error('Invalid purchase quantity or payment');const x={...b,id:uid(),productName:product.name,total:quantity*cost,paid,quantity,unitCost:cost};await put('purchases',x);product.stock=num(product.stock)+quantity;await put('products',product);return x;}}
if(segments[1]==='purchase-bills'&&segments[3]==='payments'&&method==='POST')return payment('purchase',segments[2],b.amount);
if(p==='/api/quotations'){if(method==='GET')return all('quotations');if(method==='POST'){const x={...b,id:uid(),status:'DRAFT',total:num(b.quantity)*num(b.unitPrice)};await put('quotations',x);return x;}}
if(segments[1]==='quotations'&&segments[3]==='status'&&method==='PATCH'){const q=(await all('quotations')).find(x=>String(x.id)===segments[2]);if(!q)throw Error('Quotation not found');q.status=b.status;await put('quotations',q);return q;}
if(p==='/api/business-settings'){const rows=await all('settings');if(method==='GET')return rows[0]||{};if(method==='PUT'){const x={...rows[0],...b,id:'business'};await put('settings',x);return x;}}
if(p==='/api/party-ledgers'){const contacts=await all('contacts'),invoices=await all('invoices');return contacts.map(c=>({name:c.name,customerName:c.name,totalInvoiced:invoices.filter(x=>x.customerName===c.name).reduce((s,x)=>s+num(x.totalAmount),0),outstanding:invoices.filter(x=>x.customerName===c.name).reduce((s,x)=>s+num(x.balance),0)}));}
if(p==='/api/smartstock/monthly'||p==='/api/smartstock/analytics')return [];
throw Error('Not yet supported offline: '+method+' '+p);
}
async function exportGstCsv(){const invoices=await all('invoices');const rows=[['Invoice No','Customer','Issue Date','Taxable Amount','GST Amount','Total Amount'],...invoices.map(x=>[x.invoiceNumber,x.customerName,x.issueDate,x.taxableAmount,x.gstAmount,x.totalAmount])];const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='invotracker-gst-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
window.InvoLocalApi={request,exportGstCsv};
})();
