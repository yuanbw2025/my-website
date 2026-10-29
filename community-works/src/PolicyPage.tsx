/** Draft policy is visible for review; intake and publication remain server-side closed. */
export function PolicyPage() {
  return <main id="main-content" className="detail-shell policy-page">
    <a className="back-link" href="/community-works/">← 返回作品集</a>
    <p className="eyebrow">COMMUNITY STANDARD / DRAFT</p>
    <h1>社区内容与审核规则</h1>
    <p className="lead">本页是上线前规则草案。投稿与公开发布尚未启用；正式启用前会补充生效日期、运营联系渠道、数据保留期限和适用地区说明。</p>
    <section><h2>可以分享什么</h2>
      <p>作者可以从 StoryForge 明确选择自己拥有发布权的原创小说章节，以及“文档解析 → 导入项目参考 → 作品分析”中自己的拆书分析。仅所选版本进入私有待审；拆书不得上传原书文件、长篇原文或未经授权的摘录。公开笔名与许可由投稿人确认。</p>
    </section>
    <section><h2>禁止内容</h2>
      <ul>
        <li>任何涉及未成年人的性化、性剥削、诱导、交易或相关传播；普通未成年角色和未成年用户本身不是违规理由。</li>
        <li>性暴力的色情化表现、非自愿性内容、露骨色情内容，以及以伤害为目的的血腥暴力、现实威胁或犯罪教唆。</li>
        <li>煽动仇恨或针对身份群体的暴力、骚扰、跟踪、隐私泄露、冒充、诈骗和违法交易。</li>
        <li>未经许可的大段受版权保护原文、盗版、抄袭、虚假权利声明，以及故意规避审核的变形文本或外链。</li>
      </ul>
      <p>对虐待、犯罪或危险题材的非露骨文学讨论可以提交人工判断；词语命中不会单独决定是否违规。涉及高风险材料时不要通过评论、举报或申诉再次复制传播原文。</p>
    </section>
    <section><h2>投稿、评论与处置</h2>
      <p>作品和评论均先进入私有待审，审核员批准后才公开。审核员可要求修改、拒绝或下架；投稿人可查看状态、撤回作品并申诉。申诉被支持不会自动恢复公开，仍需提交待审版本。读者可举报作品或评论，举报内容只供授权人员处理。</p>
      <p>未成年人可正常使用账号；任何涉及未成年人的剥削内容一律禁止。上线前会依据实际服务地区、平台条款和专业审查确定更细的隐私、举报与紧急处置流程。</p>
    </section>
    <section lang="en"><h2>English summary</h2>
      <p>Only author-selected original fiction and the author’s own book analysis may be submitted. Works and comments remain private until human approval. Sexual exploitation or sexualization of minors, non-consensual sexual content, explicit pornography, targeted threats, hate incitement, doxxing, illegal trade, piracy, and plagiarism are prohibited. Ordinary minor characters and young users are not excluded merely for their age. Literary discussion of difficult topics requires human context review. Authors can withdraw and appeal; readers can report. An upheld appeal never republishes a work automatically. This draft does not claim compliance with every jurisdiction; production intake remains closed pending operational and legal review.</p>
    </section>
  </main>
}
