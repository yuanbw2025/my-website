export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (req.headers['x-core-version'] !== '8192') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = process.env.SECRET_GEMINI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SECRET_GEMINI_KEY 未配置' });
  }

  const { system = "", user = "" } = req.body || {};
  const fallbackPlan = [
    { version: 'v1beta', model: 'gemini-2.5-flash' },
    { version: 'v1beta', model: 'gemini-2.5-pro' },
    { version: 'v1beta', model: 'gemini-2.0-flash' },
    { version: 'v1beta', model: 'gemini-2.0-flash-lite' }
  ];

  let quotaHits = 0;
  let lastError = "";

  for (const plan of fallbackPlan) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/${plan.version}/models/${plan.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }]
          })
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return res.status(200).json({
          choices: [{ message: { content: text } }],
          _quota: {
            ok: true,
            modelUsed: plan.model,
            exhausted: quotaHits,
            total: fallbackPlan.length,
            remaining: fallbackPlan.length - quotaHits - 1
          }
        });
      } else {
        if (resp.status === 429) quotaHits++;
        lastError = await resp.text();
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  // 计算重置时间
  const pacificNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const hoursLeft = 24 - pacificNow.getHours();
  const allGone = quotaHits >= fallbackPlan.length;

  return res.status(allGone ? 429 : 500).json({
    error: allGone
      ? `🚫 今日免费额度已全部用完（4个模型×20次=80次/天）。将在约${hoursLeft}小时后重置（北京时间约下午3点）。`
      : `所有模型调用失败: ${lastError.substring(0, 300)}`,
    _quota: {
      ok: false,
      allExhausted: allGone,
      exhausted: quotaHits,
      total: fallbackPlan.length,
      resetInHours: hoursLeft
    }
  });
}