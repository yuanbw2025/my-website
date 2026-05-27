import{r as C,j as c}from"./index-CHOy0k9U.js";function R(e){var m,k;if(!e.trim())return"";if(y(e))return e;const l=e.split(`
`),t=[];let i=0,n=!1,r=!1;for(;i<l.length;){const s=l[i].trim(),o=i+1<l.length?(m=l[i+1])==null?void 0:m.trim():"",d=i>0?(k=l[i-1])==null?void 0:k.trim():"";if(!s){t.push(""),n=!1,r=!1,i++;continue}const f=s.match(/^(\d+)\s*[.、）)]\s*(.+)/);if(f){!r&&t.length>0&&t[t.length-1]!==""&&t.push(""),t.push(`${f[1]}. ${f[2]}`),r=!0,n=!1,i++;continue}const g=s.match(/^[·•●○◆◇▸▶►➤→\-–—]\s*(.+)/);if(g){!r&&t.length>0&&t[t.length-1]!==""&&t.push(""),t.push(`- ${g[1]}`),r=!0,n=!1,i++;continue}if(r=!1,O(s)){const a=s.replace(/^[「"'『【（(]/,"").replace(/[」"'』】）)]$/,"").trim();n||t.push(""),t.push(`> ${a}`),t.push(""),n=!1,i++;continue}if(A(s,d,o)){const a=q(s,t);!n&&t.length>0&&t[t.length-1]!==""&&t.push(""),t.push(`${"#".repeat(a)} ${s}`),t.push(""),n=!0,i++;continue}if(/^[-=_~·.。]{3,}$/.test(s)||/^[─━═]{2,}$/.test(s)){t.push(""),t.push("---"),t.push(""),n=!1,i++;continue}t.push(s),n=!1,i++}let p=t.join(`
`);return p=p.replace(/\n{3,}/g,`

`),p.trim()}function y(e){const l=e.split(`
`).slice(0,30);let t=0;for(const i of l){const n=i.trim();/^#{1,6}\s/.test(n)&&(t+=2),/^\*\*[^*]+\*\*/.test(n)&&t++,/^>\s/.test(n)&&t++,/^[-*+]\s/.test(n)&&t++,/^\d+\.\s/.test(n)&&t++,/^```/.test(n)&&(t+=2),/^\|.*\|/.test(n)&&t++,/^---$/.test(n)&&t++}return t>=3}function A(e,l,t){if(e.length>40||e.length<2||/[。！？…，；：、\.\!\?\,\;]$/.test(e))return!1;const i=!l,n=!t;let r=0;return i&&(r+=2),n&&(r+=2),/^[一二三四五六七八九十]+[、.．·]\s*/.test(e)&&(r+=3),/^\d+\.\d+\s/.test(e)&&(r+=3),e.length<=15&&(r+=1),/[:：]/.test(e)&&e.length<=30&&(r+=1),r>=3}function O(e){return!!(/^[「『""].*[」』""]$/.test(e)||/^["'].*["']$/.test(e)&&e.length>10)}function q(e,l){return/^[一二三四五六七八九十]+[、.．]/.test(e)?2:/^\d+\.\d+/.test(e)?3:!l.some(i=>/^# /.test(i))&&e.length<=30?1:2}const I=`# 如何高效阅读一本书

阅读是一种**终身学习**的方式。掌握正确的阅读方法，能让你事半功倍。

## 选书：找到值得读的书

不是所有书都值得从头读到尾。选书的关键是：

- 看目录，判断结构是否清晰
- 看序言，了解作者的写作动机
- 看评价，但不要被评分绑架

> 一本好书，是作者用几年时间浓缩的思考，你用几天时间就能吸收。

## 阅读：主动阅读四步法

### 第一步：略读

花15分钟快速翻阅，了解全书框架。

### 第二步：精读

带着问题阅读核心章节，做标记和笔记。

### 第三步：复述

用自己的话总结每章要点。

### 第四步：实践

把书中的方法应用到实际场景中。

---

## 笔记：构建知识体系

1. 写读书笔记，不是抄书
2. 用思维导图梳理逻辑
3. 与已有知识建立连接

> 知识只有被使用，才真正属于你。

## 总结

阅读不在于速度，而在于**深度**。希望这篇文章能帮你建立自己的阅读方法论。
`,P=[{id:"bold",label:"B",title:"加粗"},{id:"italic",label:"I",title:"斜体"},{id:"h1",label:"H1",title:"一级标题"},{id:"h2",label:"H2",title:"二级标题"},{id:"h3",label:"H3",title:"三级标题"},{id:"list",label:"≡",title:"无序列表"},{id:"quote",label:"“",title:"引用"},{id:"hr",label:"—",title:"分割线"},{id:"link",label:"🔗",title:"链接"}];function F({value:e,onChange:l}){const t=C.useRef(null),[i,n]=C.useState(""),r=e.replace(/\s/g,"").length,p=e?e.split(`
`).length:0,m=s=>{n(s),window.setTimeout(()=>n(""),1800)},k=()=>{if(!e.trim())return;const s=R(e);if(s===e){m("内容已经是 Markdown 格式");return}l(s),m("已整理为 Markdown")},E=s=>{const o=t.current;if(!o)return;const d=o.selectionStart,f=o.selectionEnd,g=e.slice(d,f),a=e.slice(0,d),w=e.slice(f),H=a.lastIndexOf(`
`)+1,N=a.slice(0,H),S=a.slice(H);let $=e,h=d,x=f;const L=(u,M=u,j="文字")=>{const T=g||j;$=`${a}${u}${T}${M}${w}`,h=d+u.length,x=h+T.length},b=(u,M="标题")=>{const j=g||M;$=`${N}${u}${S}${j}${w}`,h=N.length+u.length+S.length,x=h+j.length};switch(s){case"bold":L("**");break;case"italic":L("*");break;case"h1":b("# ");break;case"h2":b("## ");break;case"h3":b("### ");break;case"list":b("- ","列表项");break;case"quote":b("> ","引用内容");break;case"hr":$=`${a}${a.endsWith(`
`)||a.length===0?"":`
`}---
${w}`,h=x=d+4;break;case"link":L("[","](https://example.com)","链接文字");break}l($),requestAnimationFrame(()=>{o.focus(),o.setSelectionRange(h,x)})};return c.jsxs("div",{className:"article-editor",children:[c.jsxs("div",{className:"article-editor-actions",children:[c.jsx("button",{onClick:k,disabled:!e.trim(),children:"🪄 整理"}),c.jsx("button",{onClick:()=>l(I),children:"示例"})]}),i&&c.jsx("div",{className:"article-notice",children:i}),c.jsxs("div",{className:"article-toolbar","aria-label":"Markdown 格式工具",children:[P.map(s=>c.jsx("button",{title:s.title,onClick:()=>E(s.id),children:s.label},s.id)),c.jsx("span",{children:"Markdown"})]}),c.jsx("div",{className:"article-paper",children:c.jsx("textarea",{ref:t,value:e,onChange:s=>l(s.target.value),spellCheck:!1,placeholder:`粘贴你的文章到这里...

支持 Markdown，也可以粘贴纯文本后点击「整理」自动转换。`})}),c.jsxs("div",{className:"article-status",children:[c.jsxs("span",{children:[r," 字"]}),c.jsxs("span",{children:[p," 行"]})]})]})}export{F as default};
