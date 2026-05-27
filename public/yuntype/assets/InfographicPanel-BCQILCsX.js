import{r as $,j as e,_ as I}from"./index-CHOy0k9U.js";function H(n){const{data:o,style:c,width:t}=n,r=t/375;switch(o.type){case"flow":return R(o,c,t,r);case"comparison":return D(o,c,t,r);case"card":return _(o,c,t,r);case"timeline":return L(o,c,t,r)}}function E(){return[{type:"flow",name:"流程图",icon:"🔄",description:"展示步骤流程、操作指南",sampleData:{type:"flow",title:"项目开发流程",steps:["需求分析","原型设计","开发编码","测试验收","上线运营"]}},{type:"comparison",name:"对比表",icon:"⚖️",description:"两方案/产品对比分析",sampleData:{type:"comparison",title:"方案对比",columns:[{title:"方案A",items:["速度快","成本低","易上手","功能基础"]},{title:"方案B",items:["精度高","成本适中","需学习","功能丰富"]}]}},{type:"card",name:"知识卡片",icon:"📌",description:"核心要点、知识总结",sampleData:{type:"card",title:"高效学习的5个方法",icon:"💡",points:["番茄工作法 — 25分钟专注 + 5分钟休息","费曼技巧 — 用自己的话讲给别人听","间隔重复 — 利用遗忘曲线安排复习","主动回忆 — 合上书本回想关键内容","思维导图 — 构建知识之间的关联"]}},{type:"timeline",name:"时间线",icon:"📅",description:"时间轴、发展历程",sampleData:{type:"timeline",title:"产品发展历程",events:[{time:"2024 Q1",content:"项目启动，完成产品设计"},{time:"2024 Q2",content:"MVP上线，获得首批用户"},{time:"2024 Q3",content:"功能迭代，用户突破1万"},{time:"2024 Q4",content:"商业化探索，实现盈利"}]}}]}function i(n,o){return`${Math.round(n*o)}px`}function g(n,o){const c=parseInt(n.slice(1,3),16),t=parseInt(n.slice(3,5),16),r=parseInt(n.slice(5,7),16);return`rgba(${c}, ${t}, ${r}, ${o})`}function z(n,o,c,t){return n?`
    <div style="
      text-align: center;
      margin-bottom: ${i(24,c)};
    ">
      ${t?`<div style="font-size: ${i(32,c)}; margin-bottom: ${i(8,c)};">${t}</div>`:""}
      <div style="
        font-size: ${i(22,c)};
        font-weight: 800;
        color: ${o.text};
        letter-spacing: 1px;
        line-height: 1.4;
      ">${n}</div>
      <div style="
        width: ${i(40,c)};
        height: ${i(3,c)};
        background: ${o.primary};
        margin: ${i(10,c)} auto 0;
        border-radius: ${i(2,c)};
      "></div>
    </div>
  `:""}function k(n,o,c,t,r=0){return`
    <div style="
      width: ${c}px;
      background: ${o.pageBg};
      padding: ${i(32,t)} ${i(24,t)} ${i(32+r,t)};
      box-sizing: border-box;
      font-family: 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
    ">
      <div style="
        background: ${o.contentBg};
        border-radius: ${i(16,t)};
        padding: ${i(28,t)} ${i(24,t)};
        box-shadow: 0 ${i(2,t)} ${i(12,t)} ${g(o.text,.06)};
      ">
        ${n}
      </div>
      <div style="
        text-align: center;
        margin-top: ${i(12,t)};
        font-size: ${i(10,t)};
        color: ${o.textMuted};
        opacity: 0.5;
      ">云中书 · YunType</div>
    </div>
  `}function R(n,o,c,t){const r=o.color.colors,h=n.steps,p=h.map((l,d)=>{const a=d===h.length-1,x=String(d+1).padStart(2,"0");return`
      <div style="display: flex; align-items: stretch; min-height: ${i(52,t)};">
        <!-- 左侧编号圆圈 + 连接线 -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          width: ${i(44,t)};
          flex-shrink: 0;
        ">
          <div style="
            width: ${i(36,t)};
            height: ${i(36,t)};
            border-radius: 50%;
            background: ${d===0?r.primary:g(r.primary,.12)};
            color: ${d===0?r.contentBg:r.primary};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${i(14,t)};
            font-weight: 800;
            flex-shrink: 0;
          ">${x}</div>
          ${a?"":`
            <div style="
              flex: 1;
              width: ${i(2,t)};
              background: linear-gradient(to bottom, ${r.primary}, ${g(r.primary,.15)});
              margin: ${i(4,t)} 0;
              min-height: ${i(16,t)};
            "></div>
          `}
        </div>
        <!-- 右侧内容 -->
        <div style="
          flex: 1;
          margin-left: ${i(12,t)};
          padding: ${i(8,t)} ${i(16,t)};
          background: ${g(r.primary,d===0?.08:.03)};
          border-radius: ${i(10,t)};
          border-left: ${i(3,t)} solid ${g(r.primary,d===0?1:.25)};
          display: flex;
          align-items: center;
          margin-bottom: ${a?"0":i(6,t)};
        ">
          <span style="
            font-size: ${i(15,t)};
            font-weight: 600;
            color: ${r.text};
            line-height: 1.5;
          ">${l}</span>
        </div>
      </div>
    `}).join(""),s=z(n.title,r,t,"🔄")+p;return k(s,r,c,t)}function D(n,o,c,t){const r=o.color.colors,h=n.columns;if(h.length<2)return"<div>需要至少2列数据</div>";const p=Math.max(...h.map(x=>x.items.length)),s=h.map((x,f)=>`
    <div style="
      flex: 1;
      padding: ${i(12,t)} ${i(8,t)};
      background: ${f===0?r.primary:r.secondary};
      color: ${f===0?r.contentBg:r.text};
      text-align: center;
      font-size: ${i(15,t)};
      font-weight: 700;
      ${f===0?`border-radius: ${i(10,t)} 0 0 0;`:""}
      ${f===h.length-1?`border-radius: 0 ${i(10,t)} 0 0;`:""}
    ">${x.title}</div>
  `).join("");let l="";for(let x=0;x<p;x++){const f=h.map((j,u)=>{const m=j.items[x]||"",b=x===p-1;return`
        <div style="
          flex: 1;
          padding: ${i(10,t)} ${i(12,t)};
          font-size: ${i(13,t)};
          color: ${r.text};
          text-align: center;
          line-height: 1.5;
          background: ${x%2===0?r.contentBg:g(r.secondary,.2)};
          border-bottom: 1px solid ${g(r.secondary,.5)};
          ${b&&u===0?`border-radius: 0 0 0 ${i(10,t)};`:""}
          ${b&&u===h.length-1?`border-radius: 0 0 ${i(10,t)} 0;`:""}
        ">${m?`<span style="
          display: inline-block;
          padding: ${i(2,t)} ${i(8,t)};
          background: ${g(r.primary,u===0?.08:.04)};
          border-radius: ${i(4,t)};
        ">${m}</span>`:"—"}</div>
      `}).join("");l+=`<div style="display: flex;">${f}</div>`}const d=`
    <div style="
      border-radius: ${i(10,t)};
      overflow: hidden;
      border: 1px solid ${g(r.secondary,.6)};
    ">
      <div style="display: flex;">${s}</div>
      ${l}
    </div>
  `,a=z(n.title,r,t,"⚖️")+d;return k(a,r,c,t)}function _(n,o,c,t){const r=o.color.colors,h=n.icon||"📌",p=n.points.map((d,a)=>{const x=a+1;return`
      <div style="
        display: flex;
        gap: ${i(12,t)};
        padding: ${i(14,t)} ${i(16,t)};
        background: ${a%2===0?g(r.primary,.04):"transparent"};
        border-radius: ${i(10,t)};
        margin-bottom: ${i(6,t)};
        align-items: flex-start;
      ">
        <div style="
          width: ${i(28,t)};
          height: ${i(28,t)};
          border-radius: ${i(8,t)};
          background: ${g(r.primary,.12)};
          color: ${r.primary};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${i(13,t)};
          font-weight: 800;
          flex-shrink: 0;
          margin-top: ${i(1,t)};
        ">${x}</div>
        <div style="
          flex: 1;
          font-size: ${i(14,t)};
          color: ${r.text};
          line-height: 1.7;
        ">${d}</div>
      </div>
    `}).join(""),l=`
    <div style="
      background: linear-gradient(135deg, ${r.primary}, ${g(r.primary,.7)});
      margin: ${i(-28,t)} ${i(-24,t)} ${i(20,t)};
      padding: ${i(24,t)} ${i(24,t)};
      border-radius: ${i(16,t)} ${i(16,t)} 0 0;
      text-align: center;
    ">
      <div style="font-size: ${i(32,t)}; margin-bottom: ${i(8,t)};">${h}</div>
      <div style="
        font-size: ${i(20,t)};
        font-weight: 800;
        color: ${r.contentBg};
        letter-spacing: 1px;
        line-height: 1.4;
      ">${n.title}</div>
    </div>
  `+p;return k(l,r,c,t)}function L(n,o,c,t){const r=o.color.colors,h=n.events.map((s,l)=>{const d=l===0,a=l===n.events.length-1;return`
      <div style="
        display: flex;
        min-height: ${i(70,t)};
        position: relative;
      ">
        <!-- 时间标签 -->
        <div style="
          width: ${i(80,t)};
          flex-shrink: 0;
          text-align: right;
          padding-right: ${i(16,t)};
          padding-top: ${i(2,t)};
        ">
          <span style="
            font-size: ${i(12,t)};
            font-weight: 700;
            color: ${r.primary};
            letter-spacing: 0.5px;
          ">${s.time}</span>
        </div>

        <!-- 中间轴线 + 圆点 -->
        <div style="
          width: ${i(24,t)};
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        ">
          <!-- 上方线段 -->
          ${d?`<div style="height: ${i(8,t)};"></div>`:`
            <div style="
              width: ${i(2,t)};
              height: ${i(8,t)};
              background: ${g(r.primary,.2)};
            "></div>
          `}
          <!-- 圆点 -->
          <div style="
            width: ${i(14,t)};
            height: ${i(14,t)};
            border-radius: 50%;
            background: ${d?r.primary:r.contentBg};
            border: ${i(3,t)} solid ${r.primary};
            flex-shrink: 0;
            z-index: 1;
          "></div>
          <!-- 下方线段 -->
          ${a?"":`
            <div style="
              width: ${i(2,t)};
              flex: 1;
              background: ${g(r.primary,.2)};
              min-height: ${i(20,t)};
            "></div>
          `}
        </div>

        <!-- 内容 -->
        <div style="
          flex: 1;
          padding-left: ${i(12,t)};
          padding-bottom: ${i(16,t)};
        ">
          <div style="
            padding: ${i(10,t)} ${i(14,t)};
            background: ${g(r.primary,.05)};
            border-radius: ${i(10,t)};
            border-left: ${i(3,t)} solid ${g(r.primary,d?1:.3)};
          ">
            <span style="
              font-size: ${i(14,t)};
              color: ${r.text};
              line-height: 1.6;
            ">${s.content}</span>
          </div>
        </div>
      </div>
    `}).join(""),p=z(n.title,r,t,"📅")+h;return k(p,r,c,t)}function J({style:n}){const o=$.useMemo(()=>E(),[]),[c,t]=$.useState("flow"),[r,h]=$.useState(()=>{const u={};for(const m of E())u[m.type]=JSON.parse(JSON.stringify(m.sampleData));return u}),[p,s]=$.useState(!1),l=$.useRef(null),d=r[c],a=o.find(u=>u.type===c),x=$.useCallback(u=>{h(m=>({...m,[c]:u}))},[c]),f=$.useMemo(()=>H({data:d,style:n,width:375}),[d,n]),j=async()=>{s(!0);try{const u=H({data:d,style:n,width:1080}),m=document.createElement("div");m.innerHTML=u,m.style.position="fixed",m.style.left="-99999px",m.style.top="0",m.style.zIndex="-9999",document.body.appendChild(m);const b=m.firstElementChild,{default:N}=await I(async()=>{const{default:w}=await import("./html2canvas.esm-QH1iLAAe.js");return{default:w}},[]),T=await N(b,{width:1080,scale:2,useCORS:!0,allowTaint:!1,backgroundColor:null,logging:!1});document.body.removeChild(m),T.toBlob(w=>{if(!w)return;const B=URL.createObjectURL(w),M=document.createElement("a");M.href=B,M.download=`yuntype-infographic-${c}-${Date.now()}.png`,M.click(),URL.revokeObjectURL(B)},"image/png",1)}catch(u){alert("导出信息图失败: "+(u instanceof Error?u.message:"未知错误"))}finally{s(!1)}};return e.jsxs("div",{className:"infographic-workbench",children:[e.jsxs("div",{className:"infographic-toolbar",children:[e.jsxs("div",{className:"infographic-title",children:[e.jsx("strong",{children:"信息图生成"}),e.jsxs("span",{children:[a==null?void 0:a.name," · ",a==null?void 0:a.description]})]}),e.jsx("button",{onClick:j,disabled:p,className:"infographic-export-btn",children:p?"导出中...":"导出 PNG"})]}),e.jsxs("div",{className:"infographic-main",children:[e.jsxs("aside",{className:"infographic-control-panel",children:[e.jsxs("section",{className:"infographic-section",children:[e.jsxs("div",{className:"infographic-section-title",children:[e.jsx("strong",{children:"模板"}),e.jsxs("span",{children:[o.length," 种结构"]})]}),e.jsx("div",{className:"infographic-template-grid",children:o.map(u=>e.jsxs("button",{onClick:()=>t(u.type),className:`infographic-template-card ${c===u.type?"is-active":""}`,children:[e.jsx(F,{type:u.type}),e.jsxs("span",{children:[u.icon," ",u.name]}),e.jsx("small",{children:u.description})]},u.type))})]}),e.jsxs("section",{className:"infographic-section infographic-editor-section",children:[e.jsxs("div",{className:"infographic-section-title",children:[e.jsx("strong",{children:"数据"}),e.jsx("span",{children:P(d)})]}),d.type==="flow"&&e.jsx(O,{data:d,onChange:x}),d.type==="comparison"&&e.jsx(A,{data:d,onChange:x}),d.type==="card"&&e.jsx(Q,{data:d,onChange:x}),d.type==="timeline"&&e.jsx(U,{data:d,onChange:x})]})]}),e.jsxs("section",{className:"infographic-preview-area",children:[e.jsx("div",{className:"infographic-preview-head",children:e.jsxs("div",{children:[e.jsx("strong",{children:"预览"}),e.jsx("span",{children:"375px 编辑预览，导出为 1080px 高清图"})]})}),e.jsx("div",{ref:l,className:"infographic-preview-card",children:e.jsx("div",{dangerouslySetInnerHTML:{__html:f}})})]})]})]})}function P(n){var o;switch(n.type){case"flow":return`${n.steps.length} 个步骤`;case"comparison":return`${n.columns.length} 列 · ${((o=n.columns[0])==null?void 0:o.items.length)??0} 行`;case"card":return`${n.points.length} 个要点`;case"timeline":return`${n.events.length} 个事件`}}function F({type:n}){return n==="flow"?e.jsxs("svg",{viewBox:"0 0 120 72","aria-hidden":"true",children:[e.jsx("rect",{x:"8",y:"25",width:"24",height:"22",rx:"7"}),e.jsx("rect",{x:"48",y:"25",width:"24",height:"22",rx:"7"}),e.jsx("rect",{x:"88",y:"25",width:"24",height:"22",rx:"7"}),e.jsx("path",{d:"M35 36H45M75 36H85"})]}):n==="comparison"?e.jsxs("svg",{viewBox:"0 0 120 72","aria-hidden":"true",children:[e.jsx("rect",{x:"14",y:"12",width:"42",height:"48",rx:"8"}),e.jsx("rect",{x:"64",y:"12",width:"42",height:"48",rx:"8"}),e.jsx("path",{d:"M24 29H46M24 39H44M74 29H96M74 39H91"})]}):n==="card"?e.jsxs("svg",{viewBox:"0 0 120 72","aria-hidden":"true",children:[e.jsx("rect",{x:"20",y:"12",width:"80",height:"48",rx:"10"}),e.jsx("circle",{cx:"38",cy:"31",r:"8"}),e.jsx("path",{d:"M54 27H86M54 37H80M32 47H88"})]}):e.jsxs("svg",{viewBox:"0 0 120 72","aria-hidden":"true",children:[e.jsx("path",{d:"M60 11V61"}),e.jsx("circle",{cx:"60",cy:"20",r:"6"}),e.jsx("circle",{cx:"60",cy:"36",r:"6"}),e.jsx("circle",{cx:"60",cy:"52",r:"6"}),e.jsx("path",{d:"M68 20H96M24 36H52M68 52H92"})]})}const y={width:"100%",padding:"7px 10px",fontSize:"12px",border:"1px solid var(--border-color)",borderRadius:"6px",outline:"none",boxSizing:"border-box",color:"var(--text-primary)",background:"var(--bg-card)",transition:"border-color 0.15s"},v={fontSize:"11px",fontWeight:600,color:"var(--text-muted)",marginBottom:"4px",display:"block"},S={width:"100%",padding:"7px",fontSize:"12px",color:"var(--accent)",background:"var(--accent-soft)",border:"1px dashed var(--accent)",borderRadius:"6px",cursor:"pointer",marginTop:"4px"},C={padding:"2px 6px",fontSize:"11px",color:"#E53E3E",background:"none",border:"none",cursor:"pointer",flexShrink:0};function O({data:n,onChange:o}){const c=p=>o({...n,title:p}),t=(p,s)=>{const l=[...n.steps];l[p]=s,o({...n,steps:l})},r=()=>o({...n,steps:[...n.steps,`步骤${n.steps.length+1}`]}),h=p=>{n.steps.length<=2||o({...n,steps:n.steps.filter((s,l)=>l!==p)})};return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"10px"},children:[e.jsxs("div",{children:[e.jsx("label",{style:v,children:"标题"}),e.jsx("input",{style:y,value:n.title||"",onChange:p=>c(p.target.value),placeholder:"流程图标题"})]}),e.jsxs("div",{children:[e.jsxs("label",{style:v,children:["步骤 (",n.steps.length,")"]}),n.steps.map((p,s)=>e.jsxs("div",{style:{display:"flex",gap:"4px",marginBottom:"4px",alignItems:"center"},children:[e.jsxs("span",{style:{fontSize:"11px",color:"var(--text-muted)",width:"20px",flexShrink:0},children:[s+1,"."]}),e.jsx("input",{style:{...y,flex:1},value:p,onChange:l=>t(s,l.target.value)}),e.jsx("button",{style:C,onClick:()=>h(s),title:"删除",children:"✕"})]},s)),e.jsx("button",{style:S,onClick:r,children:"+ 添加步骤"})]})]})}function A({data:n,onChange:o}){const c=s=>o({...n,title:s}),t=(s,l)=>{const d=n.columns.map((a,x)=>x===s?{...a,title:l}:a);o({...n,columns:d})},r=(s,l,d)=>{const a=n.columns.map((x,f)=>{if(f!==s)return x;const j=[...x.items];return j[l]=d,{...x,items:j}});o({...n,columns:a})},h=()=>{const s=n.columns.map(l=>({...l,items:[...l.items,""]}));o({...n,columns:s})},p=s=>{if(n.columns[0].items.length<=1)return;const l=n.columns.map(d=>({...d,items:d.items.filter((a,x)=>x!==s)}));o({...n,columns:l})};return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"10px"},children:[e.jsxs("div",{children:[e.jsx("label",{style:v,children:"标题"}),e.jsx("input",{style:y,value:n.title||"",onChange:s=>c(s.target.value),placeholder:"对比表标题"})]}),n.columns.map((s,l)=>e.jsxs("div",{children:[e.jsxs("label",{style:v,children:["列",l+1," 标题"]}),e.jsx("input",{style:{...y,marginBottom:"6px"},value:s.title,onChange:d=>t(l,d.target.value)}),s.items.map((d,a)=>e.jsxs("div",{style:{display:"flex",gap:"4px",marginBottom:"4px",alignItems:"center"},children:[e.jsx("input",{style:{...y,flex:1},value:d,onChange:x=>r(l,a,x.target.value),placeholder:`第${a+1}项`}),l===0&&e.jsx("button",{style:C,onClick:()=>p(a),title:"删除行",children:"✕"})]},a))]},l)),e.jsx("button",{style:S,onClick:h,children:"+ 添加行"})]})}function Q({data:n,onChange:o}){const c=s=>o({...n,title:s}),t=s=>o({...n,icon:s}),r=(s,l)=>{const d=[...n.points];d[s]=l,o({...n,points:d})},h=()=>o({...n,points:[...n.points,""]}),p=s=>{n.points.length<=1||o({...n,points:n.points.filter((l,d)=>d!==s)})};return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"10px"},children:[e.jsxs("div",{style:{display:"flex",gap:"8px"},children:[e.jsxs("div",{style:{flex:1},children:[e.jsx("label",{style:v,children:"标题"}),e.jsx("input",{style:y,value:n.title,onChange:s=>c(s.target.value),placeholder:"卡片标题"})]}),e.jsxs("div",{style:{width:"60px"},children:[e.jsx("label",{style:v,children:"图标"}),e.jsx("input",{style:y,value:n.icon||"",onChange:s=>t(s.target.value),placeholder:"💡"})]})]}),e.jsxs("div",{children:[e.jsxs("label",{style:v,children:["要点 (",n.points.length,")"]}),n.points.map((s,l)=>e.jsxs("div",{style:{display:"flex",gap:"4px",marginBottom:"4px",alignItems:"center"},children:[e.jsxs("span",{style:{fontSize:"11px",color:"var(--text-muted)",width:"20px",flexShrink:0},children:[l+1,"."]}),e.jsx("input",{style:{...y,flex:1},value:s,onChange:d=>r(l,d.target.value)}),e.jsx("button",{style:C,onClick:()=>p(l),title:"删除",children:"✕"})]},l)),e.jsx("button",{style:S,onClick:h,children:"+ 添加要点"})]})]})}function U({data:n,onChange:o}){const c=p=>o({...n,title:p}),t=(p,s,l)=>{const d=n.events.map((a,x)=>x===p?{...a,[s]:l}:a);o({...n,events:d})},r=()=>o({...n,events:[...n.events,{time:"",content:""}]}),h=p=>{n.events.length<=2||o({...n,events:n.events.filter((s,l)=>l!==p)})};return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"10px"},children:[e.jsxs("div",{children:[e.jsx("label",{style:v,children:"标题"}),e.jsx("input",{style:y,value:n.title||"",onChange:p=>c(p.target.value),placeholder:"时间线标题"})]}),e.jsxs("div",{children:[e.jsxs("label",{style:v,children:["事件 (",n.events.length,")"]}),n.events.map((p,s)=>e.jsxs("div",{style:{display:"flex",gap:"4px",marginBottom:"6px",alignItems:"flex-start",padding:"6px",background:s%2===0?"#FAFAFA":"#fff",borderRadius:"6px"},children:[e.jsx("input",{style:{...y,width:"80px",flexShrink:0},value:p.time,onChange:l=>t(s,"time",l.target.value),placeholder:"时间"}),e.jsx("input",{style:{...y,flex:1},value:p.content,onChange:l=>t(s,"content",l.target.value),placeholder:"事件内容"}),e.jsx("button",{style:C,onClick:()=>h(s),title:"删除",children:"✕"})]},s)),e.jsx("button",{style:S,onClick:r,children:"+ 添加事件"})]})]})}export{J as default};
