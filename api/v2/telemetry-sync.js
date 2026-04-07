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

  // 2. 安全解构参数，设置默认值防崩溃
  const { system = "", user = "", proxy = "" } = req.body || {};
  const model = proxy === 'pro' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

  try {
    // 3. 执行原生 Gemini 规范的调用
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }]
      })
    });

    // 4. 原样透传报错，方便 Vercel 控制台排查
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Gemini API Error: ${errorText}` });
    }

    const data = await response.json();
    
    // 5. 安全提取本文（加入兜底字符防截断崩溃）
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "No valid response generated.";

    // 6. 伪装回 OpenAI 结构格式返回给前端解析器
    return res.status(200).json({
      choices: [
        {
          message: {
            content: textContent
          }
        }
      ]
    });
  } catch (err) {
    return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
}
