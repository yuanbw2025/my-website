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

  // 2. 建立级联降级模型队列 (优先考虑 3.1 Flash Live Preview，不行的话用 1.5 Pro)
  const { system = "", user = "" } = req.body || {};
  const modelQueue = ['gemini-3.1-flash-live-preview', 'gemini-1.5-pro'];
  
  let lastErrorText = "";

  // 3. 循环尝试每一个模型直到成功
  for (const model of modelQueue) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
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

        // 原样透传 OpenAI 结构格式返回
        return res.status(200).json({
          choices: [{ message: { content: textContent } }]
        });
      } else {
        lastErrorText = await response.text();
        console.warn(`Model ${model} failed: ${lastErrorText}. Retrying next model...`);
        // 继续循环尝试下一个
      }
    } catch (err) {
      lastErrorText = err.message;
      console.error(`Fetch error for model ${model}: ${err.message}`);
    }
  }

  // 如果所有模型都失败了
  return res.status(500).json({ 
    error: `All models in fallback queue failed. Last error: ${lastErrorText}` 
  });
}
