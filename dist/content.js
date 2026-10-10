var ClearReadContent=function(y){"use strict";var O;const _=Object.freeze({mild:Object.freeze({enabled:!0,profile:"mild",font:"Lexend",lineHeight:"1.65",letterSpacing:"0.04em",wordSpacing:"0.10em",tintColor:"#FFFFFF",rulerEnabled:!1,ttsMode:"off"}),moderate:Object.freeze({enabled:!0,profile:"moderate",font:"Atkinson Hyperlegible",lineHeight:"1.8",letterSpacing:"0.06em",wordSpacing:"0.14em",tintColor:"#FBF0D9",rulerEnabled:!0,ttsMode:"alt-click"}),heavy:Object.freeze({enabled:!0,profile:"heavy",font:"OpenDyslexic",lineHeight:"2.0",letterSpacing:"0.08em",wordSpacing:"0.18em",tintColor:"#FFF7E6",rulerEnabled:!0,ttsMode:"click"})}),g=Object.freeze({..._.moderate,enabled:!1,hasSeenOnboarding:!1}),I=new Set(["mild","moderate","heavy"]),A=new Set(["Lexend","Atkinson Hyperlegible","OpenDyslexic"]),P=new Set(["#FFFFFF","#FBF0D9","#FFF7E6","#EAEFE9"]),M=new Set(["off","alt-click","click"]);function B(e){if(!(typeof e=="string"&&/^\d+(\.\d+)?$/.test(e)))return!1;const t=Number.parseFloat(e);return Number.isFinite(t)&&t>=1.2&&t<=3}function x(e){return typeof e=="string"&&/^\d+(\.\d+)?em$/.test(e)}function N(e){return Object.freeze({enabled:typeof e.enabled=="boolean"?e.enabled:g.enabled,profile:I.has(e.profile)?e.profile:g.profile,font:A.has(e.font)?e.font:g.font,lineHeight:B(e.lineHeight)?e.lineHeight:g.lineHeight,letterSpacing:x(e.letterSpacing)?e.letterSpacing:g.letterSpacing,wordSpacing:x(e.wordSpacing)?e.wordSpacing:g.wordSpacing,tintColor:P.has(e.tintColor)?e.tintColor:g.tintColor,rulerEnabled:typeof e.rulerEnabled=="boolean"?e.rulerEnabled:g.rulerEnabled,ttsMode:M.has(e.ttsMode)?e.ttsMode:g.ttsMode,hasSeenOnboarding:typeof e.hasSeenOnboarding=="boolean"?e.hasSeenOnboarding:g.hasSeenOnboarding})}function C(){return new Promise(e=>{chrome.storage.sync.get({...g},t=>{e(N(t))})})}function $(e){const t=(n,i)=>{i==="sync"&&C().then(e)};return chrome.storage.onChanged.addListener(t),()=>{chrome.storage.onChanged.removeListener(t)}}const k="clearread-overlay-host",z=`
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
`;function j(e,t=document){var h;(h=t.getElementById(k))==null||h.remove();const n=t.createElement("div");n.id=k;const i=n.attachShadow({mode:"open"}),d=t.createElement("style");d.textContent=z;const c=t.createElement("div");c.id="clearread-tint-layer",c.style.display="none";const r=t.createElement("div");r.id="clearread-ruler";const f=t.createElement("div");f.id="clearread-tts-pill",f.hidden=!0;const a=t.createElement("span");a.id="clearread-tts-status",a.textContent="Reading…";const o=t.createElement("button");o.id="clearread-tts-pause",o.className="pill-btn",o.type="button",o.textContent="Pause",o.setAttribute("aria-label","Pause reading"),o.addEventListener("click",s=>{s.stopPropagation(),e.onTogglePause()});const l=t.createElement("button");l.id="clearread-tts-stop",l.className="pill-btn pill-btn-stop",l.type="button",l.textContent="Stop",l.setAttribute("aria-label","Stop reading"),l.addEventListener("click",s=>{s.stopPropagation(),e.onStop()}),f.append(a,o,l),i.append(d,c,r,f),t.documentElement.appendChild(n);let p=!1;const u=s=>{p&&window.requestAnimationFrame(()=>{p&&(r.style.display="block",r.style.top=`${s.clientY}px`)})};return{setTintColor(s){!s||s==="#FFFFFF"?c.style.display="none":(c.style.backgroundColor=s,c.style.display="block")},setRulerEnabled(s){s!==p&&(p=s,s?(r.style.display="block",r.style.top=`${Math.round(window.innerHeight*.4)}px`,window.addEventListener("mousemove",u,{passive:!0})):(window.removeEventListener("mousemove",u),r.style.display="none"))},setTtsStatus(s){if(s==="hidden"){f.hidden=!0;return}f.hidden=!1,a.textContent=s==="paused"?"Paused":"Reading…",o.textContent=s==="paused"?"Resume":"Pause",o.setAttribute("aria-label",s==="paused"?"Resume reading":"Pause reading")},destroy(){p=!1,window.removeEventListener("mousemove",u),n.remove()}}}const S="clearread-styles",T="clearread-fonts";function V(){const e=chrome.runtime.getURL("fonts/Lexend-Regular.woff2"),t=chrome.runtime.getURL("fonts/AtkinsonHyperlegible-Regular.woff2"),n=chrome.runtime.getURL("fonts/OpenDyslexic-Regular.woff2");return`
    @font-face {
      font-family: 'Lexend';
      src: url('${e}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Atkinson Hyperlegible';
      src: url('${t}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${n}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
  `}function G(e){return e==="#FFFFFF"?"":`
    html, body, main, article, section, div:not([id^="clearread"]) {
      background-color: ${e} !important;
      color: #1F1F1F !important;
    }
    p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6, td, th, span {
      color: #1F1F1F !important;
    }
    a {
      color: #0B57D0 !important;
    }
  `}function U(e,t=document){if(!e.enabled){b(t);return}let n=t.getElementById(T);n||(n=t.createElement("style"),n.id=T,n.textContent=V(),t.head.appendChild(n));let i=t.getElementById(S);i||(i=t.createElement("style"),i.id=S,t.head.appendChild(i)),i.textContent=`
    p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6, td, th, figcaption, label, summary, [role="article"] p, article div:not(:has(div, p, ul, ol, table, section, article, aside, header, footer, nav)) {
      font-family: '${e.font}', -apple-system, BlinkMacSystemFont, sans-serif !important;
      line-height: ${e.lineHeight} !important;
      letter-spacing: ${e.letterSpacing} !important;
      word-spacing: ${e.wordSpacing} !important;
      text-align: left !important;
    }
    p span, li span, a, strong, em, b, u, small, mark, time {
      font-family: inherit !important;
      letter-spacing: inherit !important;
      word-spacing: inherit !important;
    }
    p, li, dd, dt, blockquote {
      max-width: 75ch !important;
    }
    code, pre, kbd, samp, svg, i, [class*="icon"], [class*="fa-"] {
      font-family: inherit !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
    ::highlight(clearread-sentence) {
      background-color: rgba(26, 115, 232, 0.16);
      color: #1F1F1F;
    }
    ::highlight(clearread-word) {
      background-color: rgba(251, 188, 4, 0.45);
      color: #1F1F1F;
    }
    ${G(e.tintColor)}
  `}function b(e=document){var t;(t=e.getElementById(S))==null||t.remove()}const q="p, li, dd, dt, blockquote, h1, h2, h3, h4, h5, h6",W='a, button, input, select, textarea, summary, [role="button"]';function Y(e){if(!(e instanceof Element))return null;const t=e.closest(q);return t instanceof HTMLElement?t:null}function K(e,t){if(t==="off"||t==="alt-click"&&!e.altKey)return null;if(!e.altKey&&e.target instanceof Element){if(e.target.closest(W))return null;const n=window.getSelection();if(n&&!n.isCollapsed)return null}return Y(e.target)}function m(e,t){for(const i of e)if(t<=i.end)return{node:i.node,offset:Math.max(0,Math.min(i.node.length,t-i.start))};const n=e[e.length-1];return{node:n.node,offset:n.node.length}}const X='script, style, noscript, [hidden], [aria-hidden="true"]';function J(e){try{return new Intl.Segmenter(e,{granularity:"sentence"})}catch{return new Intl.Segmenter("en",{granularity:"sentence"})}}function Q(e,t=document.documentElement.lang||"en"){var l;const n=e.ownerDocument,i=n.createTreeWalker(e,NodeFilter.SHOW_TEXT),d=[];let c=0,r=i.nextNode();for(;r;)r instanceof Text&&r.data.length>0&&!((l=r.parentElement)!=null&&l.closest(X))&&(d.push({node:r,start:c,end:c+r.data.length}),c+=r.data.length),r=i.nextNode();if(d.length===0)return[];const f=d.map(p=>p.node.data).join("");if(f.trim().length<2)return[];const a=J(t),o=[];for(const p of a.segment(f)){const u=p.segment.trim();if(!u)continue;const h=p.segment.indexOf(u),s=p.index+h,R=s+u.length,D=m(d,s),H=m(d,R),F=n.createRange();F.setStart(D.node,D.offset),F.setEnd(H.node,H.offset),o.push({text:u,startOffset:s,endOffset:R,range:F,slices:d})}return o}function Z(e,t,n){var o;if(t<0||t>=e.text.length)return null;const i=n&&n>0?n:((o=e.text.slice(t).match(/^\S+/))==null?void 0:o[0].length)??0;if(i<=0)return null;const d=e.startOffset+t,c=Math.min(e.endOffset,d+i),r=m(e.slices,d),f=m(e.slices,c),a=e.slices[0].node.ownerDocument.createRange();return a.setStart(r.node,r.offset),a.setEnd(f.node,f.offset),a}const L="clearread-sentence",E="clearread-word";function w(e,t){if(!(typeof CSS>"u"||!("highlights"in CSS)||typeof Highlight>"u")){if(!t){CSS.highlights.delete(e);return}CSS.highlights.set(e,new Highlight(t))}}function ee(){typeof CSS<"u"&&"highlights"in CSS&&(CSS.highlights.delete(L),CSS.highlights.delete(E))}function te(e,t=document){let n=0,i=!1,d=!1;const c=()=>{n+=1,i=!1,d=!1,"speechSynthesis"in window&&window.speechSynthesis.cancel(),ee()},r=()=>{c(),e.setTtsStatus("hidden")},f=(a,o,l)=>{if(l!==n||o>=a.length||!("speechSynthesis"in window)){r();return}const p=a[o],u=new SpeechSynthesisUtterance(p.text);u.rate=.95,u.onstart=()=>{l===n&&(w(L,p.range),w(E,null))},u.onboundary=h=>{if(l!==n||h.name!=="word")return;const s=Z(p,h.charIndex,h.charLength);w(E,s)},u.onend=()=>{l===n&&f(a,o+1,l)},u.onerror=()=>{l===n&&r()},window.speechSynthesis.speak(u)};return{speakBlock(a){if(!("speechSynthesis"in window))return;c();const o=Q(a,t.documentElement.lang||"en");if(o.length===0){e.setTtsStatus("hidden");return}d=!0,i=!1;const l=n;e.setTtsStatus("speaking"),f(o,0,l)},togglePause(){!d||!("speechSynthesis"in window)||(i?(window.speechSynthesis.resume(),i=!1,e.setTtsStatus("speaking")):(window.speechSynthesis.pause(),i=!0,e.setTtsStatus("paused")))},stop:r}}async function v(){var a;(a=window.__clearReadCleanup)==null||a.call(window);let e=await C();const t=j({onTogglePause:()=>n.togglePause(),onStop:()=>n.stop()}),n=te(t),i=o=>{e=o,e.enabled?(U(e),t.setTintColor(e.tintColor),t.setRulerEnabled(e.rulerEnabled),e.ttsMode==="off"&&n.stop()):(b(),t.setTintColor(null),t.setRulerEnabled(!1),n.stop())};i(e);const d=$(i),c=o=>{if(!e.enabled)return;const l=K(o,e.ttsMode);l&&(o.altKey&&o.preventDefault(),n.speakBlock(l))},r=o=>{o.key==="Escape"&&n.stop()};window.addEventListener("click",c),window.addEventListener("keydown",r);const f=()=>{d(),window.removeEventListener("click",c),window.removeEventListener("keydown",r),n.stop(),t.destroy(),b()};return window.__clearReadCleanup=f,f}return typeof chrome<"u"&&((O=chrome.storage)!=null&&O.sync)&&v(),y.initContentScript=v,Object.defineProperty(y,Symbol.toStringTag,{value:"Module"}),y}({});
