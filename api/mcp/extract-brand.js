const API_CONFIG = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 8192
};

const BRAND_EXTRACTION_PROMPT = `You are a brand guidelines expert. Analyze the following content and extract ALL brand information into a structured JSON format.

Extract whatever brand-relevant information is present:
- Brand name
- Brand colors (with hex codes, names, and usage context)
- Typography (fonts, sizes, weights, usage)
- Logo guidelines (usage rules, spacing, backgrounds)
- Voice and tone guidelines
- Imagery style guidelines
- Do's and Don'ts
- Any other brand standards, messaging, or guidelines

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "brandName": "Company Name",
  "description": "Brief brand description",
  "colors": {
    "primary": [{"name": "Color Name", "hex": "#FFFFFF", "usage": "When to use"}],
    "secondary": [],
    "accent": [],
    "neutral": []
  },
  "typography": {
    "primary": {"name": "Font Name", "weights": ["400", "700"], "usage": "Headers"},
    "secondary": {"name": "Font Name", "weights": ["400"], "usage": "Body text"},
    "sizes": {}
  },
  "logo": {
    "description": "",
    "clearSpace": "",
    "minSize": "",
    "backgrounds": [],
    "donts": []
  },
  "voice": {
    "tone": [],
    "personality": "",
    "guidelines": []
  },
  "imagery": {
    "style": "",
    "guidelines": []
  },
  "messaging": {
    "taglines": [],
    "keyMessages": [],
    "valuePropositions": []
  },
  "additionalGuidelines": {}
}

Extract ACTUAL values from the content. Use empty arrays/strings for missing sections.

Content to analyze:
`;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, isPdf, base64Data } = req.body;

  if (!content && !base64Data) {
    return res.status(400).json({ error: 'Content or base64Data is required' });
  }

  // Check if base64 data is too large (Anthropic has limits)
  if (base64Data) {
    const sizeInMB = (base64Data.length * 0.75) / (1024 * 1024);
    if (sizeInMB > 32) {
      return res.status(400).json({ 
        error: `PDF too large (${sizeInMB.toFixed(1)}MB). Maximum size is 32MB. Please compress your PDF and try again.` 
      });
    }
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error: API key not set' });
  }

  try {
    const messages = isPdf && base64Data
      ? [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64Data }
              },
              { type: "text", text: BRAND_EXTRACTION_PROMPT + "[PDF content provided above]" }
            ]
          }
        ]
      : [
          {
            role: "user",
            content: BRAND_EXTRACTION_PROMPT + content
          }
        ];

    console.log('Sending request to Anthropic API...');
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        max_tokens: API_CONFIG.max_tokens,
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      
      // Parse error for better message
      let errorMessage = 'Failed to extract brand data';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      
      return res.status(response.status).json({ error: errorMessage });
    }

    const data = await response.json();
    console.log('Received response from Anthropic');
    
    const jsonText = data.content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("");

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const brandData = JSON.parse(jsonMatch[0]);
        return res.status(200).json({ brandData });
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(500).json({ error: 'Failed to parse brand data from AI response' });
      }
    }
    
    console.error('No JSON found in response:', jsonText.substring(0, 500));
    return res.status(500).json({ error: 'No valid brand data found in AI response' });
  } catch (error) {
    console.error('Error extracting brand data:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
