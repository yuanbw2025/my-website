import{c as k,r as i,l as E,j as e,w as T,x as L,y as A}from"./index-CHOy0k9U.js";import{A as F}from"./APIConfigForm-B6Lyj2B6.js";const m=[{id:"pitch",name:"产品介绍",icon:"🚀",description:"产品发布、功能展示",examplePrompt:"介绍一款AI写作助手产品，包含产品定位、核心功能（智能续写、风格改写、多语言翻译）、使用场景、定价方案。风格现代科技感。"},{id:"report",name:"工作汇报",icon:"📊",description:"周报、月报、季度总结",examplePrompt:"2024年Q3产品团队工作汇报：完成了3个大版本迭代，用户增长35%，NPS提升到72分，下季度计划重点是国际化和AI功能。"},{id:"tutorial",name:"教学课件",icon:"📚",description:"知识讲解、培训课件",examplePrompt:"讲解CSS Grid布局的基础知识，从什么是Grid、基本术语、常用属性到实际案例，适合前端初学者。"},{id:"proposal",name:"方案提案",icon:"💡",description:"商业计划、项目提案",examplePrompt:"社区团购小程序项目提案：市场分析、竞品对比、产品方案、技术架构、团队配置、预算和时间表。"},{id:"story",name:"故事叙述",icon:"📖",description:"品牌故事、个人经历",examplePrompt:"讲述一个独立开发者从0到1做出一款月收入过万的产品的故事，包含灵感来源、艰难时刻、关键转折和经验总结。"},{id:"data",name:"数据展示",icon:"📈",description:"数据报告、趋势分析",examplePrompt:"2024年中国移动互联网趋势报告：用户规模、时长分布、热门赛道（短视频、直播电商、AI应用）、未来预测。用图表展示关键数据。"}],R=`你是一位顶级演示设计师。用户会描述演示主题，你需要生成一个完整的单文件 HTML 演示稿。

## 核心要求

1. **生成完整的 HTML 文件**，包含所有 CSS 和 JS，不依赖任何外部资源
2. **幻灯片结构**：每页用 \`<section class="slide">\` 包裹，默认生成 6-10 页
3. **16:9 比例**：每页 960×540 的设计尺寸，居中显示
4. **键盘/点击导航**：左右箭头键切换，点击也可前进，底部显示页码指示器
5. **过渡动画**：页面切换时有流畅的淡入滑动动画

## 设计原则

- 每页内容精简，大字报风格，一个核心观点
- 善用留白，文字不超过页面 60%
- 标题页要有冲击力
- 数据页用 CSS 绘制简单图表（柱状图、环形图、进度条）
- 配色协调，全局统一，用 CSS 变量管理主题色
- 适当使用 emoji 作为视觉元素
- 最后一页是总结或 CTA

## 动画要求

- 每页进入时元素依次出现（staggered animation）
- 标题、正文、图表分别设置不同的入场延迟
- 使用 CSS @keyframes，不依赖外部库
- 动画要克制优雅，不要花哨

## 交互功能

- 键盘左右箭头切换幻灯片
- 点击页面右半部分前进，左半部分后退
- 底部圆点指示器，可点击跳转
- 按 F 键全屏
- 当前页高亮指示

## HTML 结构模板

\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>演示标题</title>
  <style>
    /* 全局样式、幻灯片容器、动画、导航指示器 */
  </style>
</head>
<body>
  <div class="deck">
    <section class="slide"><!-- 每页内容 --></section>
    ...
  </div>
  <div class="nav-dots"><!-- 页码指示器 --></div>
  <script>
    // 导航逻辑、动画触发、全屏
  <\/script>
</body>
</html>
\`\`\`

## 输出规则

- 只输出 HTML 代码，不要任何解释
- 代码用 \`\`\`html 包裹
- 确保代码完整可运行`;async function I(s,c){const a=await k(s,[{role:"system",content:R},{role:"user",content:c}]);if(!a.success||!a.content)return{success:!1,error:a.error||"生成失败"};const r=O(a.content);if(!r)return{success:!1,error:"未能从 AI 响应中提取 HTML"};const n=(r.match(/<section\s+class="slide"/g)||[]).length;return{success:!0,html:r,slideCount:n}}function O(s){const c=s.match(/```html\s*([\s\S]*?)```/);if(c)return c[1].trim();if(s.includes("<!DOCTYPE")||s.includes("<html")){const a=s.indexOf("<!DOCTYPE")>=0?s.indexOf("<!DOCTYPE"):s.indexOf("<html");return s.slice(a).trim()}return null}function M(s,c="presentation.html"){const a=new Blob([s],{type:"text/html;charset=utf-8"}),r=URL.createObjectURL(a),n=document.createElement("a");n.href=r,n.download=c,n.click(),URL.revokeObjectURL(r)}function U(){var N;const[s,c]=i.useState(""),[a,r]=i.useState(!1),[n,j]=i.useState(null),[l,v]=i.useState(null),[P,h]=i.useState(!1),[o,b]=i.useState(null),[S,p]=i.useState(!1),u=i.useRef(null),x=i.useRef(null);i.useEffect(()=>{const t=E();v(t)},[]);const w=i.useCallback(async()=>{if(!l||!s.trim())return;r(!0),j(null);const t=await I(l,s.trim());j(t),r(!1)},[l,s]),y=t=>{const d=m.find(f=>f.id===t);d&&(b(t),c(d.examplePrompt))},g=()=>{var d;if(!(n!=null&&n.html))return;const t=o?`${((d=m.find(f=>f.id===o))==null?void 0:d.name)||"presentation"}.html`:"presentation.html";M(n.html,t)},C=()=>{x.current&&(document.fullscreenElement?document.exitFullscreen().then(()=>p(!1)).catch(()=>{}):x.current.requestFullscreen().then(()=>p(!0)).catch(()=>{}))};return i.useEffect(()=>{const t=()=>p(!!document.fullscreenElement);return document.addEventListener("fullscreenchange",t),()=>document.removeEventListener("fullscreenchange",t)},[]),i.useEffect(()=>{if(n!=null&&n.html&&u.current){const t=u.current.contentDocument;t&&(t.open(),t.write(n.html),t.close())}},[n==null?void 0:n.html]),e.jsxs("div",{className:"presentation-workbench",children:[e.jsx("aside",{className:"presentation-control-panel",children:P?e.jsx("div",{className:"presentation-config-wrap",children:e.jsx(F,{title:"配置 AI 服务",description:"演示稿生成需要 AI 大模型。推荐使用通义千问或 DeepSeek。",config:l,providers:A.filter(t=>t.id!=="custom").slice(0,8),accent:T.purple,onSave:t=>{v(t),L(t),h(!1)},onCancel:()=>l&&h(!1)})}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"presentation-toolbar",children:[e.jsxs("div",{className:"presentation-title",children:[e.jsx("strong",{children:"演示稿"}),e.jsx("span",{children:o?(N=m.find(t=>t.id===o))==null?void 0:N.name:"生成可交互 HTML 演示"})]}),e.jsx("button",{onClick:()=>h(!0),className:"presentation-ghost-btn",children:"API 配置"})]}),e.jsxs("section",{className:"presentation-section",children:[e.jsxs("div",{className:"presentation-section-title",children:[e.jsx("strong",{children:"场景"}),e.jsxs("span",{children:[m.length," 个模板"]})]}),e.jsx("div",{className:"presentation-preset-grid",children:m.map(t=>e.jsxs("button",{onClick:()=>y(t.id),className:`presentation-preset ${o===t.id?"is-active":""}`,children:[e.jsx("span",{children:t.icon}),e.jsx("span",{children:t.name})]},t.id))})]}),e.jsxs("section",{className:"presentation-prompt-section",children:[e.jsxs("div",{className:"presentation-section-title",children:[e.jsx("strong",{children:"主题"}),e.jsxs("span",{children:[s.trim().length," 字"]})]}),e.jsx("textarea",{value:s,onChange:t=>c(t.target.value),placeholder:"例如：介绍我们团队的新产品，一款面向设计师的 AI 工具..."}),e.jsx("button",{onClick:w,disabled:a||!s.trim()||!l,className:"presentation-primary-btn",children:a?"生成中...":"生成演示稿"}),!l&&e.jsx("div",{className:"presentation-config-warning",children:"请先点击右上角配置 API Key"})]}),e.jsxs("div",{className:"presentation-action-area",children:[(n==null?void 0:n.html)&&e.jsxs(e.Fragment,{children:[e.jsx("button",{onClick:g,className:"presentation-download-btn",children:"下载"}),e.jsx("button",{onClick:C,className:"presentation-fullscreen-btn",children:"全屏"})]}),!(n!=null&&n.html)&&e.jsx("div",{className:"presentation-action-hint",children:"生成后支持键盘导航（← →）、点击翻页、全屏放映"})]})]})}),e.jsx("section",{className:"presentation-preview-area",children:n!=null&&n.html?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"presentation-preview-bar",children:[e.jsxs("span",{children:["预览 · ",n.slideCount||"?"," 页演示稿"]}),e.jsxs("div",{children:[e.jsx("button",{onClick:C,className:"presentation-fullscreen-btn",children:"全屏放映"}),e.jsx("button",{onClick:g,className:"presentation-download-btn",children:"下载"})]})]}),e.jsx("div",{ref:x,className:`presentation-stage ${S?"is-fullscreen":""}`,children:e.jsx("div",{className:"presentation-frame",children:e.jsx("iframe",{ref:u,sandbox:"allow-scripts allow-same-origin",title:"演示预览"})})})]}):n!=null&&n.error?e.jsx("div",{className:"presentation-empty-wrap",children:e.jsx("div",{className:"presentation-error",children:n.error})}):e.jsx("div",{className:"presentation-empty-wrap",children:e.jsxs("div",{className:"presentation-empty-state",children:[e.jsx("div",{children:"🎬"}),e.jsx("strong",{children:"等待生成演示稿"}),e.jsx("span",{children:"在左侧描述演示主题，生成后可预览、下载或全屏放映。"}),e.jsxs("p",{children:[e.jsx("span",{children:"⌨ 键盘导航"}),e.jsx("span",{children:"🖱 点击翻页"}),e.jsx("span",{children:"⛶ 全屏放映"})]})]})})})]})}export{U as default};
