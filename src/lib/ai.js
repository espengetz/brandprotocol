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

export const extractFromUrl = async (url) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  
  const data = await response.json();
  const textContent = data.content
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join("\n");
  
  return textContent;
};

export const extractBrandData = async (content, isPdf = false, base64Data = null) => {
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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: API_CONFIG.model,
      max_tokens: API_CONFIG.max_tokens,
      messages
    })
  });

  const data = await response.json();
  const jsonText = data.content
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join("");

  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('Failed to parse brand data');
};

export const extractTextFromContent = async (content, contentType = 'document') => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: API_CONFIG.model,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Extract and summarize all brand-relevant information from this ${contentType}. Include specific details like colors (with hex codes), fonts, guidelines, tone of voice, messaging, etc. Be thorough but concise.\n\nContent:\n${content}`
        }
      ]
    })
  });

  const data = await response.json();
  return data.content
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join("");
};

export const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
