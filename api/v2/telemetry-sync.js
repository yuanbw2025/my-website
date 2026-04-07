export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (req.headers['x-core-version'] !== '8192') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = process.env.SECRET_GEMINI_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Configuration Error: SECRET_GEMINI_KEY is missing in Vercel.'
    });
  }

  const { system = "", user = "" } = req.body || {};
  const fallbackPlan = [
    { version: 'v1beta', model: 'gemini-2.5-flash' },
    { version: 'v1beta', model: 'gemini-2.5-pro' },
    { version: 'v1beta', model: 'gemini-2.0-flash' },
    { version: 'v1beta', model: 'gemini-2.0-flash-lite' }
  ];

  let errors = [];

  for (const plan of fallbackPlan) {
    try {
      const response = await fetch(
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

      if (response.ok) {
        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "No valid response generated.";
        return res.status(200).json({
          choices: [{ message: { content: textContent } }]
        });
      } else {
        const errText = await response.text();
        errors.push(`${plan.model}: ${response.status} - ${errText}`);
      }
    } catch (err) {
      errors.push(`${plan.model}: FETCH_ERROR - ${err.message}`);
    }
  }

  return res.status(500).json({
    error: 'All models failed',
    keyInfo: {
      exists: true,
      length: apiKey.length,
      prefix: apiKey.substring(0, 8) + '...'
    },
    details: errors
  });
}