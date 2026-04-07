export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  if (req.headers['x-core-version'] !== '8192') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { system, user, proxy } = req.body;
  // Fallback to the user's provided free Gemini key if environment variable is not yet set
  const apiKey = process.env.SECRET_GEMINI_KEY || 'AIzaSyDvl15O_tAFdMt02ETGO31lIfKQXSGI08A';
  
  const model = proxy === 'pro' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system || "" }]
        },
        contents: [
          { role: 'user', parts: [{ text: user || "" }] }
        ]
      })
    });
    
    if (!response.ok) {
       const text = await response.text();
       return res.status(response.status).json({ error: text });
    }
    
    const data = await response.json();
    
    // Map response to OpenAI format expected by the frontend
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
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
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
