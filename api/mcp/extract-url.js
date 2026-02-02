const API_CONFIG = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 8192
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Fetch and extract all brand-related content from this URL: ${url}. Return the raw content including colors, fonts, logo usage, voice/tone, messaging, etc. Extract specific values.`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return res.status(response.status).json({ error: 'Failed to fetch from Anthropic API' });
    }

    const data = await response.json();
    const textContent = data.content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("\n");

    res.json({ content: textContent });
  } catch (error) {
    console.error('Error extracting from URL:', error);
    res.status(500).json({ error: error.message });
  }
}
