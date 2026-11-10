/** Public community rules; runtime controls remain authoritative. */
export function PolicyPage() {
  return <main id="main-content" className="community-page policy-page">
    <a className="back-link" href="/community-works/">← 返回作品集</a>
    <div className="page-heading"><h1>社区内容与审核规则</h1></div>
    <p className="lead">生效日期：2026 年 11 月 3 日。社区作品集供作者自愿分享原创小说与拆书分析，作品和评论先审后显。运营方：北京悬象科技有限公司。</p>
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
      <p>作品和评论均先进入私有待审。自动审核会将所选投稿文字、公开笔名和必要评论上下文会交给 Agnes 模型服务进行内容分类；每段内容经过两次检查，只有全部明确通过且发布开关已开启才会公开。有疑点、内容超出自动审核预算或处理失败时转人工复核，不会自动删除原稿或封禁账号。模型可能误判，不能证明作品版权或保证所有地区的法律合规。举报和申诉由人工处理。审核员可要求修改、拒绝或下架；投稿人可查看状态、撤回作品并申诉。申诉被支持不会自动恢复公开，仍需提交待审版本。读者可举报作品或评论，举报内容只供授权人员处理。</p>
      <p>遇到疑难或高风险内容会转入审核台，暂停公开，交由人工处理。举报不向被举报人公开举报者身份；请提供作品链接和问题类型，不上传身份证、私人手稿或高风险原文。紧急人身危险请联系所在地紧急服务，本社区不是全天候应急渠道。</p>
    </section>
    <section><h2>账号、隐私与数据保留</h2>
      <p>浏览公开作品和本地创作不需要账号；投稿和互动使用邮箱验证码登录。邮箱用于身份验证，不显示在作品署名中。请不要在公开笔名、正文或评论中填写私人联系方式。Supabase 保存账号、私有投稿和审核数据，Vercel 提供页面与接口，Brevo 投递登录邮件；这些服务可能在你所在地以外处理数据。Agnes 仅接收审核所需文本，不读取你的全部本地作品。</p>
      <p>未完成投稿的上传对象在创建超过 48 小时后进入每日清理队列；已提交内容、审核记录、账号和互动数据在服务期间保留。撤回会立即隐藏公开作品，但不会删除待审原件或审计记录。申请删除账号或相关内容请使用注册邮箱联系下方地址，我们核验归属后处理，并说明为处理争议或履行法律义务必须保留的部分。备份与在线数据分别管理，撤回不等于备份已被即时擦除。</p>
    </section>
    <section><h2>使用限制与权利</h2>
      <p>每账号每日最多申请 10 次上传，每份公开快照最多 32 MiB；评论和回复每日合计最多 10 条。容量、邮件投递或审核额度不足时，系统可能暂停收稿或转人工。花花免费领取，没有充值、提现或兑换功能。分享不转让作品所有权；读者只能在作者所选许可范围内使用，禁止未经许可转载。</p>
      <p>请遵守你所在地适用的法律以及本规则。我们可能依据具体投诉限制内容或访问，不能保证作品适用于所有地区。页面中明确标注的示例用于展示功能，不代表真实用户投稿或人气。</p>
    </section>
    <section><h2>联系、版权投诉与删除申请</h2>
      <p>联系邮箱：<a href="mailto:BJxuanxiangkeji@163.com">BJxuanxiangkeji@163.com</a>。请注明“社区作品集”、作品链接、诉求及能证明权利或账号归属的必要信息。普通违规可直接使用作品或评论旁的举报；投稿人可在“我的投稿”查看处理状态和申诉。请勿通过邮件发送密码或验证码。</p>
    </section>
    <section lang="en"><h2>English summary</h2>
      <p>Only author-selected original fiction and the author’s own book analysis may be submitted. Works and comments remain private pending review. When enabled, Agnes receives submitted text, public pen names and necessary comment context for two classification passes per segment. Only fully cleared submissions can be published when publication is enabled. Uncertain, oversized or failed checks require human review; the model does not delete manuscripts or ban accounts. Model decisions can be wrong and do not establish copyright or legal compliance. Reports and appeals are handled by human reviewers. Sexual exploitation or sexualization of minors, non-consensual sexual content, explicit pornography, targeted threats, hate incitement, doxxing, illegal trade, piracy, and plagiarism are prohibited. Ordinary minor characters and young users are not excluded merely for their age. Literary discussion of difficult topics requires human context review. Authors can withdraw and appeal; readers can report. An upheld appeal never republishes a work automatically. Effective November 3, 2026. Operated by Beijing Xuanxiang Technology Co., Ltd. Email verification is required only for submissions and interaction. Supabase, Vercel, Brevo and Agnes process the data needed for their respective functions, potentially outside your country. Unsubmitted uploads become eligible for daily cleanup after 48 hours; submitted content and audit records are retained during operation. Withdrawal hides a work immediately but does not erase its private original or backups. Contact BJxuanxiangkeji@163.com for copyright complaints and verified deletion requests. Local law and service limits also apply; availability or model approval is not a guarantee of legal compliance everywhere.</p>
    </section>
  </main>
}
