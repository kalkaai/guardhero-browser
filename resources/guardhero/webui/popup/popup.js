import{r as c,j as e,c as h}from"../shared/chrome-guardhero-6U_S8VxX.js";function b({currentDomain:o}){const[t,a]=c.useState(!0),[s,u]=c.useState(!1);c.useEffect(()=>{var p,n,i;(p=window.chrome)!=null&&p.guardhero&&o&&((i=(n=window.chrome.guardhero).isBlockingEnabled)==null||i.call(n).then(r=>a(r)).catch(()=>{}))},[o]);async function l(){var p,n,i,r;u(!0);try{const d=!t;d===!1&&o&&await((n=(p=window.chrome)==null?void 0:p.guardhero)==null?void 0:n.allowDomain(o)),await((r=(i=window.chrome)==null?void 0:i.guardhero)==null?void 0:r.setBlockingEnabled(d)),a(d)}catch(d){console.error("Failed to toggle blocking",d)}finally{u(!1)}}return e.jsxs("div",{className:"popup-toggle-row",children:[e.jsxs("div",{className:"popup-toggle-label",children:[e.jsx("span",{className:`popup-shield-dot ${t?"active":"paused"}`}),e.jsxs("span",{children:["EagleEye ",t?"ON":"OFF"]})]}),e.jsx("button",{className:`popup-toggle-btn ${t?"on":"off"}`,onClick:l,disabled:s,"aria-checked":t,role:"switch","aria-label":`EagleEye blocking ${t?"on":"off"}`,children:e.jsx("span",{className:"popup-toggle-thumb"})})]})}function f({tabId:o,maxItems:t=10}){const[a,s]=c.useState([]),[u,l]=c.useState(0);return c.useEffect(()=>{async function p(){var n,i;try{const r=await((i=(n=window.chrome)==null?void 0:n.guardhero)==null?void 0:i.getPageStats(o??-1)),d=((r==null?void 0:r.blocked_trackers)??[]).map(g=>({domain:m(g),url:g,type:"request",decision:"BLOCKED"}));s(d.slice(0,t)),l((r==null?void 0:r.blocked)??0)}catch{s([{domain:"analytics.google.com",url:"https://analytics.google.com/collect",type:"XHR",decision:"BLOCKED"},{domain:"facebook.net",url:"https://connect.facebook.net/tr",type:"Pixel",decision:"BLOCKED"},{domain:"doubleclick.net",url:"https://doubleclick.net/pixel",type:"Image",decision:"BLOCKED"}]),l(3)}}p()},[o,t]),e.jsxs("div",{className:"popup-tracker-section",children:[e.jsxs("div",{className:"popup-section-header",children:[e.jsx("span",{children:"This page"}),e.jsxs("span",{className:"popup-blocked-badge",children:[u," blocked"]})]}),e.jsx("div",{className:"popup-tracker-list",role:"list",children:a.length===0?e.jsx("div",{className:"popup-no-trackers",children:e.jsx("span",{children:"✓ No trackers detected"})}):a.map((p,n)=>e.jsxs("div",{className:"popup-tracker-row",role:"listitem",children:[e.jsx("span",{className:"popup-tracker-domain",children:p.domain}),e.jsx("span",{className:`popup-tracker-badge ${p.decision.toLowerCase()}`,children:p.decision})]},`${p.domain}-${n}`))})]})}function m(o){try{return new URL(o).hostname}catch{return o}}function k({domain:o,onAllowed:t}){const[a,s]=c.useState("idle");async function u(){var l,p;if(o){s("loading");try{await((p=(l=window.chrome)==null?void 0:l.guardhero)==null?void 0:p.allowDomain(o)),s("done"),t==null||t()}catch{s("idle")}}}return e.jsx("button",{className:"popup-action-btn allow",onClick:u,disabled:a!=="idle","aria-label":`Allow ${o??"this site"}`,children:a==="loading"?"...":a==="done"?"✓ Allowed":"Allow this site"})}function w({currentUrl:o}){function t(){const a=o?`?url=${encodeURIComponent(o)}`:"";window.open(`https://guardhero.app/report${a}`,"_blank","noopener")}return e.jsx("button",{className:"popup-action-btn report",onClick:t,"aria-label":"Report a false positive",children:"Report"})}const j=`
  body { margin:0; background:#0A0E1A; color:#fff;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         font-size:13px; min-width:280px; max-width:320px; }
  .popup-header { display:flex; align-items:center; justify-content:space-between;
                  padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.08); }
  .popup-title { display:flex; align-items:center; gap:8px; font-weight:600; }
  .popup-shield { color:#00D4FF; font-size:18px; }
  .popup-toggle-row { display:flex; align-items:center; justify-content:space-between; }
  .popup-toggle-label { display:flex; align-items:center; gap:8px; }
  .popup-shield-dot { width:8px;height:8px;border-radius:50%; }
  .popup-shield-dot.active { background:#00D4FF; }
  .popup-shield-dot.paused { background:#888; }
  .popup-toggle-btn { width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;
                       position:relative;transition:background 0.2s; }
  .popup-toggle-btn.on { background:#00D4FF; }
  .popup-toggle-btn.off { background:#444; }
  .popup-toggle-thumb { position:absolute;top:3px;width:16px;height:16px;border-radius:50%;
                          background:#fff;transition:left 0.2s; }
  .popup-toggle-btn.on .popup-toggle-thumb { left:21px; }
  .popup-toggle-btn.off .popup-toggle-thumb { left:3px; }
  .popup-section-header { display:flex;align-items:center;justify-content:space-between;
                           padding:8px 16px;font-size:11px;color:#8892A4;text-transform:uppercase;
                           letter-spacing:0.08em; }
  .popup-blocked-badge { background:rgba(255,75,110,0.15);color:#FF4B6E;
                          padding:2px 8px;border-radius:999px;font-weight:600; }
  .popup-tracker-list { max-height:180px;overflow-y:auto; }
  .popup-tracker-row { display:flex;align-items:center;justify-content:space-between;
                        padding:6px 16px;border-bottom:1px solid rgba(255,255,255,0.04); }
  .popup-tracker-domain { font-size:12px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px; }
  .popup-tracker-badge { font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase; }
  .popup-tracker-badge.blocked { background:rgba(255,75,110,0.15);color:#FF4B6E; }
  .popup-tracker-badge.allowed { background:rgba(0,230,118,0.12);color:#00E676; }
  .popup-no-trackers { padding:16px;text-align:center;color:#4A5568;font-size:12px; }
  .popup-footer { display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08); }
  .popup-action-btn { flex:1;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);
                       background:transparent;color:#ccc;cursor:pointer;font-size:12px;
                       transition:all 0.15s; }
  .popup-action-btn:hover { border-color:#00D4FF;color:#00D4FF; }
  .popup-action-btn.report:hover { border-color:#FF4B6E;color:#FF4B6E; }
`;function y(){const o="example.com";return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:j}),e.jsxs("div",{children:[e.jsxs("header",{className:"popup-header",children:[e.jsxs("div",{className:"popup-title",children:[e.jsx("span",{className:"popup-shield",children:"🛡"}),"Guard Hero"]}),e.jsx(b,{currentDomain:o})]}),e.jsx(f,{maxItems:8}),e.jsxs("footer",{className:"popup-footer",children:[e.jsx(k,{domain:o}),e.jsx(w,{currentUrl:`https://${o}`})]})]})]})}const x=document.getElementById("root");if(!x)throw new Error("Root element not found");h(x).render(e.jsx(c.StrictMode,{children:e.jsx(y,{})}));
