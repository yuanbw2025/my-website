export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (req.headers['x-core-version'] !== '8192') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 1. 严格检查环境变量，从根源斩断硬编码泄露风险
  const apiKey = process.env.SECRET_GEMINI_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Configuration Error: SECRET_GEMINI_KEY is missing in Vercel. Please add it in project settings.'
    });
  }

  // 2. 建立级联降级策略 (模型名 + 对应接口版本)
  const { system = "", user = "" } = req.body || {};
  const fallbackPlan = [
    { version: 'v1beta', model: 'gemini-2.5-flash' },   // 冲锋：最新 Flash
    { version: 'v1beta', model: 'gemini-2.5-pro' },     // 稳健：最新 Pro
    { version: 'v1beta', model: 'gemini-2.0-flash' },   // 兜底：上一代 Flash
    { version: 'v1beta', model: 'gemini-1.5-flash' }    // 最终兜底：1.5 Flash
  ];

  let lastErrorText = "";

  // 3. 循环尝试每一个方案直到成功
  for (const plan of fallbackPlan) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/${plan.version}/models/${plan.model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "No valid response generated.";

        return res.status(200).json({
          choices: [{ message: { content: textContent } }]
        });
      } else {
        lastErrorText = await response.text();
        console.warn(`Plan [${plan.version}/${plan.model}] failed: ${lastErrorText}. Trying next fallback...`);
      }
    } catch (err) {
      lastErrorText = err.message;
      console.error(`Fetch error for model ${plan.model}: ${err.message}`);
    }
  }

  // 如果所有方案都彻底歇菜了
  return res.status(500).json({
    error: `Total integration failure. Exhausted all fallback plans. Last error: ${lastErrorText}`
  });
}