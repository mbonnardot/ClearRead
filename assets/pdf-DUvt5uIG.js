import"./profiles-CZR3WoYI.js";import{g as U,s as W,u as $}from"./storage-xVF56a--.js";const z="modulepreload",M=function(e){return"/"+e},A={},V=function(t,a,n){let c=Promise.resolve();if(a&&a.length>0){document.getElementsByTagName("link");const s=document.querySelector("meta[property=csp-nonce]"),r=(s==null?void 0:s.nonce)||(s==null?void 0:s.getAttribute("nonce"));c=Promise.allSettled(a.map(i=>{if(i=M(i),i in A)return;A[i]=!0;const d=i.endsWith(".css"),u=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${i}"]${u}`))return;const l=document.createElement("link");if(l.rel=d?"stylesheet":z,d||(l.as="script"),l.crossOrigin="",l.href=i,r&&l.setAttribute("nonce",r),document.head.appendChild(l),d)return new Promise((g,f)=>{l.addEventListener("load",g),l.addEventListener("error",()=>f(new Error(`Unable to preload CSS for ${i}`)))})}))}function o(s){const r=new Event("vite:preloadError",{cancelable:!0});if(r.payload=s,window.dispatchEvent(r),!r.defaultPrevented)throw s}return c.then(s=>{for(const r of s||[])r.status==="rejected"&&o(r.reason);return t().catch(o)})},N="clearread-overlay-host",j={bar:36,narrow:40,medium:96,wide:160},G=`
  :host {
    all: initial;
  }
  #clearread-tint-layer {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483645;
    mix-blend-mode: multiply;
    display: none;
  }
  #clearread-ruler {
    position: fixed;
    left: 0;
    width: 100vw;
    height: 36px;
    background-color: rgba(255, 255, 0, 0.18);
    border-top: 2px solid rgba(180, 150, 0, 0.35);
    border-bottom: 2px solid rgba(180, 150, 0, 0.35);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
    transform: translateY(-50%);
  }
  #clearread-mask-top {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    background: rgba(18, 18, 22, 0.36);
    border-bottom: 1.5px solid rgba(11, 87, 208, 0.55);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
  }
  #clearread-mask-bottom {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(18, 18, 22, 0.36);
    border-top: 1.5px solid rgba(11, 87, 208, 0.55);
    pointer-events: none;
    z-index: 2147483646;
    display: none;
  }
  #clearread-pdf-banner {
    position: fixed;
    top: 16px;
    right: 20px;
    z-index: 2147483647;
    display: none;
  }
  .pdf-open-btn {
    background: #0b57d0;
    color: #ffffff;
    border: none;
    border-radius: 999px;
    padding: 10px 18px;
    font: 600 13px/1 system-ui, sans-serif;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
    cursor: pointer;
  }
  #clearread-tts-pill {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 9999px;
    background: #1F1F1F;
    color: #FFFFFF;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  }
  #clearread-tts-pill[hidden] {
    display: none !important;
  }
  .pill-btn {
    border: none;
    border-radius: 9999px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: #D3E3FD;
    color: #041E49;
  }
  .pill-btn-stop {
    background: #F9DEDC;
    color: #410E0B;
  }
`;function Y(e,t=document){var y;(y=t.getElementById(N))==null||y.remove();const a=t.createElement("div");a.id=N;const n=a.attachShadow({mode:"open"}),c=t.createElement("style");c.textContent=G;const o=t.createElement("div");o.id="clearread-tint-layer",o.style.display="none";const s=t.createElement("div");s.id="clearread-ruler",s.style.display="none";const r=t.createElement("div");r.id="clearread-mask-top",r.style.display="none";const i=t.createElement("div");i.id="clearread-mask-bottom",i.style.display="none";const d=t.createElement("div");d.id="clearread-pdf-banner",d.style.display="none";const u=t.createElement("button");u.id="clearread-open-pdf-btn",u.className="pdf-open-btn",u.type="button",u.textContent="📖 Read PDF in ClearRead",d.appendChild(u);const l=t.createElement("div");l.id="clearread-tts-pill",l.hidden=!0;const g=t.createElement("span");g.id="clearread-tts-status",g.textContent="Reading…";const f=t.createElement("button");f.id="clearread-tts-pause",f.className="pill-btn",f.type="button",f.textContent="Pause",f.setAttribute("aria-label","Pause reading"),f.addEventListener("click",h=>{h.stopPropagation(),e.onTogglePause()});const m=t.createElement("button");m.id="clearread-tts-stop",m.className="pill-btn pill-btn-stop",m.type="button",m.textContent="Stop",m.setAttribute("aria-label","Stop reading"),m.addEventListener("click",h=>{h.stopPropagation(),e.onStop()});let E=window.location.href;u.addEventListener("click",h=>{var T;h.stopPropagation();const x=`${(T=chrome.runtime)!=null&&T.getURL?chrome.runtime.getURL("pdf.html"):"/pdf.html"}?url=${encodeURIComponent(E)}`;window.location.assign(x)}),l.append(g,f,m),n.append(c,o,s,r,i,d,l),t.documentElement.appendChild(a);let p=!1,S="medium",w=Math.round(window.innerHeight*.4);function C(){if(!p){s.style.display="none",r.style.display="none",i.style.display="none";return}if(S==="bar"){r.style.display="none",i.style.display="none",s.style.display="block",s.style.top=`${w}px`;return}const b=j[S]/2;s.style.display="none",r.style.display="block",i.style.display="block",r.style.height=`${Math.max(0,w-b)}px`,i.style.top=`${Math.max(0,w+b)}px`}const v=h=>{p&&(w=h.clientY,window.requestAnimationFrame(()=>{C()}))};return{setTintColor(h){if(!h||h==="#FFFFFF"){o.style.display="none";return}o.style.backgroundColor=h,o.style.display="block"},setRulerConfig(h,b){const x=p;p=h,S=b,h&&!x?window.addEventListener("mousemove",v,{passive:!0}):!h&&x&&window.removeEventListener("mousemove",v),C()},setRulerEnabled(h){this.setRulerConfig(h,S)},updatePdfBanner(h,b=window.location.href){E=b,d.style.display=h?"block":"none"},setTtsStatus(h){if(h==="hidden"){l.hidden=!0;return}l.hidden=!1;const b=h==="paused";g.textContent=b?"Paused":"Reading…",f.textContent=b?"Resume":"Pause",f.setAttribute("aria-label",b?"Resume reading":"Pause reading")},destroy(){p=!1,window.removeEventListener("mousemove",v),a.remove()}}}function R(e,t){for(const n of e)if(t<=n.end)return{node:n.node,offset:Math.max(0,Math.min(n.node.length,t-n.start))};const a=e[e.length-1];return{node:a.node,offset:a.node.length}}const q='script, style, noscript, [hidden], [aria-hidden="true"]';function Z(e){try{return new Intl.Segmenter(e,{granularity:"sentence"})}catch{return new Intl.Segmenter("en",{granularity:"sentence"})}}function X(e,t=document.documentElement.lang||"en"){var u;const a=e.ownerDocument,n=a.createTreeWalker(e,NodeFilter.SHOW_TEXT),c=[];let o=0,s=n.nextNode();for(;s;)s instanceof Text&&s.data.length>0&&!((u=s.parentElement)!=null&&u.closest(q))&&(c.push({node:s,start:o,end:o+s.data.length}),o+=s.data.length),s=n.nextNode();if(c.length===0)return[];const r=c.map(l=>l.node.data).join("");if(r.trim().length<2)return[];const i=Z(t),d=[];for(const l of i.segment(r)){const g=l.segment.trim();if(!g)continue;const f=l.segment.indexOf(g),m=l.index+f,E=m+g.length,p=R(c,m),S=R(c,E),w=a.createRange();w.setStart(p.node,p.offset),w.setEnd(S.node,S.offset),d.push({text:g,startOffset:m,endOffset:E,range:w,slices:c})}return d}function K(e,t,a){var d;if(t<0||t>=e.text.length)return null;const n=a&&a>0?a:((d=e.text.slice(t).match(/^\S+/))==null?void 0:d[0].length)??0;if(n<=0)return null;const c=e.startOffset+t,o=Math.min(e.endOffset,c+n),s=R(e.slices,c),r=R(e.slices,o),i=e.slices[0].node.ownerDocument.createRange();return i.setStart(s.node,s.offset),i.setEnd(r.node,r.offset),i}const _="clearread-sentence",P="clearread-word";function k(e,t){if(!(typeof CSS>"u"||!("highlights"in CSS)||typeof Highlight>"u")){if(!t){CSS.highlights.delete(e);return}CSS.highlights.set(e,new Highlight(t))}}function J(){typeof CSS<"u"&&"highlights"in CSS&&(CSS.highlights.delete(_),CSS.highlights.delete(P))}function Q(e,t=document){let a=0,n=!1,c=!1,o=1;const s=()=>{a+=1,n=!1,c=!1,"speechSynthesis"in window&&window.speechSynthesis.cancel(),J()},r=()=>{s(),e.setTtsStatus("hidden")},i=(d,u,l)=>{if(l!==a||u>=d.length||!("speechSynthesis"in window)){r();return}const g=d[u],f=new SpeechSynthesisUtterance(g.text);f.rate=o,f.onstart=()=>{l===a&&(k(_,g.range),k(P,null))},f.onboundary=m=>{if(l!==a||m.name!=="word")return;const E=K(g,m.charIndex,m.charLength);k(P,E)},f.onend=()=>{l===a&&i(d,u+1,l)},f.onerror=()=>{l===a&&r()},window.speechSynthesis.speak(f)};return{speakBlock(d){if(!("speechSynthesis"in window))return;s();const u=X(d,t.documentElement.lang||"en");if(u.length===0){e.setTtsStatus("hidden");return}c=!0,n=!1;const l=a;e.setTtsStatus("speaking"),i(u,0,l)},togglePause(){!c||!("speechSynthesis"in window)||(n?(window.speechSynthesis.resume(),n=!1,e.setTtsStatus("speaking")):(window.speechSynthesis.pause(),n=!0,e.setTtsStatus("paused")))},stop:r,setRate(d){o=d}}}const ee=/^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/,te=/[aeiouyAEIOUY]+/g,O=/(\S+|\s+)/g,D=new Set(["bl","br","ch","cl","cr","dr","fl","fr","gl","gr","ph","pl","pr","sc","sh","sk","sp","st","sw","th","tr","tw","wh","wr"]),ne="script, style, pre, code, kbd, samp, button, input, select, textarea, svg";function se(e){const t=ee.exec(e);if(!t)return e;const a=t[1],n=t[2],c=t[3];if(n.length<6)return e;const o=Array.from(n.matchAll(te)).map(l=>({start:l.index??0,end:(l.index??0)+l[0].length}));if(o.length<2)return e;const s=o[o.length-1],r=o.length>2&&s.start===n.length-1&&n[s.start].toLowerCase()==="e"?o.slice(0,-1):o;if(r.length<2)return e;const i=[];for(let l=0;l<r.length-1;l+=1){const g=r[l].end,f=r[l+1].start,m=f-g,E=n.slice(g,f).toLowerCase();let p=g;m===0?p=f:m===1?p=g:m===2?p=D.has(E)?g:g+1:p=D.has(E.slice(-2))?f-2:g+1,p>=2&&p<=n.length-2&&i.push(p)}if(i.length===0)return e;const d=[];let u=0;for(const l of i)l>u&&(d.push(n.slice(u,l)),u=l);return d.push(n.slice(u)),`${a}${d.join("·")}${c}`}function re(e){const t=e.match(O);return t?t.map(a=>/^\s+$/.test(a)?a:se(a)).join(""):e}function ae(e,t){const a=e.querySelectorAll('span[data-cr-enriched="true"]');for(const n of a)if(n instanceof HTMLElement){const c=n.dataset.crOrig??n.textContent??"";n.replaceWith(t.createTextNode(c))}}function oe(e,t,a){const n=e.createElement("span");n.dataset.crEnriched="true",n.dataset.crOrig=t;const c=a.syllables?re(t):t;if(!a.bionic)return n.appendChild(e.createTextNode(c)),n;const o=c.match(O)??[c];for(const s of o)if(/^\s+$/.test(s)||!/[a-zA-Z]/.test(s))n.appendChild(e.createTextNode(s));else{const r=Math.max(1,Math.ceil(s.length*.45)),i=e.createElement("strong");i.className="cr-bionic",i.appendChild(e.createTextNode(s.slice(0,r))),n.appendChild(i),r<s.length&&n.appendChild(e.createTextNode(s.slice(r)))}return n}function ie(e,t){var s;const a=e instanceof Document?e:e.ownerDocument??document;if(ae(e,a),!t.bionic&&!t.syllables)return;const n=a.createTreeWalker(e,NodeFilter.SHOW_TEXT),c=[];let o=n.nextNode();for(;o;)o instanceof Text&&o.data.trim().length>0&&!((s=o.parentElement)!=null&&s.closest(ne))&&c.push(o),o=n.nextNode();for(const r of c)r.replaceWith(oe(a,r.data,t))}function H(e){const t=[];let a=[],n=null,c=12;for(const o of e){const s=o.str.trim();if(!s)continue;const r=o.transform[5]??0,i=Math.abs(o.transform[3]??12)||12,d=Math.max(c,i)*1.9;n!==null&&Math.abs(n-r)>d&&a.length>0?(t.push(a.join(" ")),a=[s]):a.push(s),n=r,c=i}return a.length>0&&t.push(a.join(" ")),t}async function le(e){var n;const t=await V(()=>import("./pdf-CaJW-a52.js"),[]);return t.GlobalWorkerOptions.workerSrc=typeof chrome<"u"&&((n=chrome.runtime)!=null&&n.getURL)?chrome.runtime.getURL("pdf.worker.min.mjs"):"./pdf.worker.min.mjs",await t.getDocument(e).promise}function L(e){for(;e.firstChild;)e.removeChild(e.firstChild)}function ce(e,t,a,n){L(t),t.style.fontFamily=`'${n.font}', sans-serif`,t.style.fontSize=`${(n.fontScale/100*1.125).toFixed(3)}rem`,t.style.lineHeight=n.lineHeight,e.body.style.setProperty("--cr-pdf-bg",n.tintColor),e.body.classList.toggle("cr-pdf-alternation",n.paragraphAlternation);for(const c of a){const o=e.createElement("section");o.className="pdf-reflow-page",o.dataset.page=String(c.pageNumber);for(const s of c.paragraphs){const r=e.createElement("p");r.textContent=s,(n.bionicReading||n.syllableDots)&&ie(r,{bionic:n.bionicReading,syllables:n.syllableDots}),o.appendChild(r)}t.appendChild(o)}}async function de(e,t,a){L(t);for(let n=1;n<=a.numPages;n++){const c=await a.getPage(n),o=c.getViewport({scale:1.25}),s=e.createElement("div");s.className="pdf-canvas-page";const r=e.createElement("canvas");r.className="pdf-page-canvas",r.width=o.width,r.height=o.height;const i=r.getContext("2d");i&&await c.render({canvasContext:i,viewport:o}).promise;const d=e.createElement("div");d.className="pdf-text-layer";const l=(await c.getTextContent()).items.filter(g=>typeof g.str=="string"&&Array.isArray(g.transform));for(const g of H(l)){const f=e.createElement("p");f.textContent=g,d.appendChild(f)}s.appendChild(r),s.appendChild(d),t.appendChild(s)}}function pe(e,t){const a=e.getElementById("pdfFontSelect"),n=e.getElementById("pdfScaleRange"),c=e.getElementById("pdfRulerSelect"),o=e.getElementById("pdfTintSelect"),s=e.getElementById("pdfBionicToggle"),r=e.getElementById("pdfSyllablesToggle"),i=e.getElementById("pdfRateSelect");a&&(a.value=t.font),n&&(n.value=String(t.fontScale)),c&&(c.value=t.rulerStyle),o&&(o.value=t.tintColor),s&&(s.checked=t.bionicReading),r&&(r.checked=t.syllableDots),i&&(i.value=String(t.ttsRate))}async function fe(e={}){const t=e.doc??document,a=e.loadDocument??le;let n=await U(),c="reflow",o=null,s=[];const r=Y({onTogglePause:()=>i.togglePause(),onStop:()=>i.stop()}),i=Q(r),d=t.getElementById("pdfReflowContainer"),u=t.getElementById("pdfCanvasContainer"),l=t.getElementById("pdfDropzone"),g=t.getElementById("pdfStatus"),f=t.getElementById("modeReflowBtn"),m=t.getElementById("modeCanvasBtn"),E=()=>{pe(t,n),r.setRulerConfig(n.rulerEnabled,n.rulerStyle),i.setRate(n.ttsRate),d&&s.length>0&&ce(t,d,s,n)},p=async y=>{c=y,f==null||f.setAttribute("aria-pressed",y==="reflow"?"true":"false"),m==null||m.setAttribute("aria-pressed",y==="canvas"?"true":"false"),d&&(d.hidden=y!=="reflow"||!o),u&&(u.hidden=y!=="canvas"||!o,y==="canvas"&&o&&u.childElementCount===0&&await de(t,u,o))},S=async y=>{try{const h=await a(y);o=h;const b=[];for(let x=1;x<=h.numPages;x++){const B=(await(await h.getPage(x)).getTextContent()).items.filter(I=>typeof I.str=="string"&&Array.isArray(I.transform));b.push({pageNumber:x,items:B,paragraphs:H(B)})}s=b,l&&(l.hidden=!0),u&&L(u),E(),await p(c)}catch{g&&(g.textContent="Could not load PDF directly. Please drop or select a local PDF file.")}};ue(t,y=>{n={...n,...y},E(),$(y)},S,p);const w=y=>{var b;const h=(b=y.target instanceof Element?y.target:null)==null?void 0:b.closest("p");h instanceof HTMLElement&&n.ttsMode!=="off"&&i.speakBlock(h)};t.addEventListener("click",w);const C=W(y=>{n=y,E()});E();const v=e.initialUrl??new URLSearchParams(window.location.search).get("url");return v&&await S({url:v}),{loadPdfSource:S,destroy:()=>{C(),t.removeEventListener("click",w),i.stop(),r.destroy()}}}function ue(e,t,a,n){var d,u,l,g,f,m,E;const c=e.getElementById("modeReflowBtn"),o=e.getElementById("modeCanvasBtn"),s=e.getElementById("openLocalPdfBtn"),r=e.getElementById("pdfFileInput"),i=e.getElementById("pdfDropzone");c==null||c.addEventListener("click",()=>{n("reflow")}),o==null||o.addEventListener("click",()=>{n("canvas")}),s==null||s.addEventListener("click",()=>r==null?void 0:r.click()),r==null||r.addEventListener("change",async()=>{var S;const p=(S=r.files)==null?void 0:S[0];if(p){const w=await p.arrayBuffer();await a({data:w})}}),i==null||i.addEventListener("dragover",p=>p.preventDefault()),i==null||i.addEventListener("drop",async p=>{var C,v;p.preventDefault();const w=(v=(C=p.dataTransfer)==null?void 0:C.files)==null?void 0:v[0];if(w){const y=await w.arrayBuffer();await a({data:y})}}),(d=e.getElementById("pdfFontSelect"))==null||d.addEventListener("change",p=>{t({font:p.target.value})}),(u=e.getElementById("pdfScaleRange"))==null||u.addEventListener("input",p=>{t({fontScale:Number(p.target.value)})}),(l=e.getElementById("pdfRulerSelect"))==null||l.addEventListener("change",p=>{t({rulerEnabled:!0,rulerStyle:p.target.value})}),(g=e.getElementById("pdfTintSelect"))==null||g.addEventListener("change",p=>{t({tintColor:p.target.value})}),(f=e.getElementById("pdfBionicToggle"))==null||f.addEventListener("change",p=>{t({bionicReading:p.target.checked})}),(m=e.getElementById("pdfSyllablesToggle"))==null||m.addEventListener("change",p=>{t({syllableDots:p.target.checked})}),(E=e.getElementById("pdfRateSelect"))==null||E.addEventListener("change",p=>{t({ttsRate:Number(p.target.value)})})}var F;if(typeof window<"u"&&typeof chrome<"u"&&((F=chrome.storage)!=null&&F.sync)){const e=new URLSearchParams(window.location.search);e.has("url")&&fe({initialUrl:e.get("url")})}
