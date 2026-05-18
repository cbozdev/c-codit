import{h as x,r,i as h,j as e,d as u}from"./index-CieEObIj.js";import{f as c,a as o}from"./format-C72RnWZ7.js";import{S as f}from"./StatusBadge-Bkc6PtCx.js";import{C as v,a as y}from"./chevron-right-DCq9ujLT.js";/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=x("Printer",[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]]);function j(a){const n=a.type==="wallet_funding"||a.type==="refund",i=window.open("","_blank","width=420,height=620");i&&(i.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Receipt · ${a.reference}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; padding: 32px 24px; max-width: 340px; margin: 0 auto; color: #111; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 4px; font-family: sans-serif; }
  .sub { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; font-family: sans-serif; }
  .divider { border-top: 1px dashed #ccc; margin: 14px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 3px 0; }
  .label { color: #555; }
  .val { text-align: right; word-break: break-all; max-width: 60%; }
  .amount-row { font-size: 20px; font-weight: bold; padding: 8px 0; }
  .credit { color: #16a34a; }
  .debit { color: #111; }
  .footer { text-align: center; font-size: 11px; color: #999; margin-top: 20px; font-family: sans-serif; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h1>C-codit</h1>
<p class="sub">Transaction Receipt</p>
<div class="divider"></div>
<div class="row"><span class="label">Reference</span><span class="val">${a.reference}</span></div>
<div class="row"><span class="label">Type</span><span class="val">${a.type.replace(/_/g," ")}</span></div>
<div class="row"><span class="label">Status</span><span class="val">${a.status}</span></div>
<div class="row"><span class="label">Date</span><span class="val">${o(a.created_at)}</span></div>
${a.description?`<div class="row"><span class="label">Note</span><span class="val">${a.description}</span></div>`:""}
<div class="divider"></div>
<div class="row amount-row ${n?"credit":"debit"}">
  <span>${n?"Credited":"Debited"}</span>
  <span>${n?"+":"−"}${c(a.amount_minor,a.currency)}</span>
</div>
<div class="divider"></div>
<p class="footer">Thank you for using C-codit<br>support@c-codit.com</p>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body></html>`),i.document.close())}function C(){const[a,n]=r.useState(1),[i,p]=r.useState(""),[l,m]=r.useState(""),t=h({queryKey:["transactions",{page:a,type:i,status:l}],queryFn:()=>u({url:"/wallet/transactions",params:{page:a,per_page:20,type:i||void 0,status:l||void 0}})});return e.jsxs("div",{className:"space-y-6 max-w-5xl",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-semibold tracking-tight",children:"Transactions"}),e.jsx("p",{className:"text-sm text-ink-600 mt-1",children:"Every credit and debit, fully traceable."})]}),e.jsxs("div",{className:"card-pad",children:[e.jsxs("div",{className:"flex flex-wrap gap-3 mb-4",children:[e.jsxs("select",{value:i,onChange:s=>{p(s.target.value),n(1)},className:"input max-w-xs",children:[e.jsx("option",{value:"",children:"All types"}),e.jsx("option",{value:"wallet_funding",children:"Funding"}),e.jsx("option",{value:"service_purchase",children:"Service purchase"}),e.jsx("option",{value:"refund",children:"Refund"})]}),e.jsxs("select",{value:l,onChange:s=>{m(s.target.value),n(1)},className:"input max-w-xs",children:[e.jsx("option",{value:"",children:"All statuses"}),e.jsx("option",{value:"success",children:"Success"}),e.jsx("option",{value:"processing",children:"Processing"}),e.jsx("option",{value:"failed",children:"Failed"}),e.jsx("option",{value:"refunded",children:"Refunded"})]})]}),t.isLoading?e.jsx("div",{className:"text-sm text-ink-500 py-8 text-center",children:"Loading…"}):t.data?.items.length===0?e.jsx("div",{className:"text-sm text-ink-500 py-8 text-center",children:"No transactions match your filters."}):e.jsx("div",{className:"overflow-x-auto -mx-2",children:e.jsxs("table",{className:"min-w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"text-left text-ink-500 text-xs uppercase tracking-wide border-b border-ink-100",children:[e.jsx("th",{className:"px-2 py-3 font-medium",children:"Reference"}),e.jsx("th",{className:"px-2 py-3 font-medium",children:"Type"}),e.jsx("th",{className:"px-2 py-3 font-medium",children:"Amount"}),e.jsx("th",{className:"px-2 py-3 font-medium",children:"Status"}),e.jsx("th",{className:"px-2 py-3 font-medium",children:"When"}),e.jsx("th",{className:"px-2 py-3 font-medium"})]})}),e.jsx("tbody",{children:t.data.items.map(s=>{const d=s.type==="wallet_funding"||s.type==="refund";return e.jsxs("tr",{className:"border-b border-ink-100 last:border-0 hover:bg-ink-50/50",children:[e.jsxs("td",{className:"px-2 py-3",children:[e.jsx("div",{className:"font-mono text-xs",children:s.reference}),s.description&&e.jsx("div",{className:"text-xs text-ink-500 mt-0.5",children:s.description})]}),e.jsx("td",{className:"px-2 py-3 text-ink-600",children:s.type.replace("_"," ")}),e.jsx("td",{className:"px-2 py-3 font-mono",children:e.jsxs("span",{className:d?"text-brand-700":"text-ink-900",children:[d?"+":"−",c(s.amount_minor,s.currency)]})}),e.jsx("td",{className:"px-2 py-3",children:e.jsx(f,{status:s.status})}),e.jsx("td",{className:"px-2 py-3 text-ink-600",children:o(s.created_at)}),e.jsx("td",{className:"px-2 py-3",children:e.jsx("button",{onClick:()=>j(s),title:"Print receipt",className:"p-1.5 text-ink-400 hover:text-ink-700 transition rounded",children:e.jsx(g,{className:"h-3.5 w-3.5"})})})]},s.id)})})]})}),t.data&&t.data.meta.last_page>1&&e.jsxs("div",{className:"flex items-center justify-between mt-4",children:[e.jsxs("span",{className:"text-xs text-ink-500",children:["Page ",t.data.meta.current_page," of ",t.data.meta.last_page," · ",t.data.meta.total," total"]}),e.jsxs("div",{className:"flex gap-1",children:[e.jsx("button",{onClick:()=>n(s=>Math.max(1,s-1)),disabled:a===1,className:"btn-outline px-2 py-1.5",children:e.jsx(v,{className:"h-4 w-4"})}),e.jsx("button",{onClick:()=>n(s=>s+1),disabled:a>=t.data.meta.last_page,className:"btn-outline px-2 py-1.5",children:e.jsx(y,{className:"h-4 w-4"})})]})]})]})]})}export{C as default};
