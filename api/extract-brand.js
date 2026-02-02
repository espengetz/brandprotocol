import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use the latest, most capable model
const MODEL = 'claude-sonnet-4-20250514';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { content, isPdf, base64Data } = req.body;

    if (!content && !base64Data) {
      return res.status(400).json({ error: 'Content or base64Data is required' });
    }

    console.log('Starting multi-pass brand extraction...');

    let rawContent = content;

    // If PDF, extract text first
    if (isPdf && base64Data) {
      console.log('Processing PDF...');
      const pdfResponse = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `Extract ALL text content from this brand guidelines PDF. Include:
- Every color code (hex, RGB, CMYK, Pantone)
- Every font name and specification
- All logo usage rules
- Voice and tone guidelines
- Any measurements or specifications

Be thorough - extract everything verbatim where possible.`
            }
          ],
        }],
      });

      rawContent = pdfResponse.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
    }

    // PASS 1: Extract structured data with strict JSON schema
    console.log('Pass 1: Extracting structured data...');
    const extractionResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `You are a brand data extraction expert. Extract brand information from this content into a precise JSON structure.

CONTENT TO ANALYZE:
${rawContent}

CRITICAL INSTRUCTIONS:
1. Extract EVERY color with its EXACT hex code (e.g., #FF5733). If you see a color mentioned, find its hex code.
2. Look for hex codes in formats: #RRGGBB, #RGB, rgb(), rgba()
3. If RGB is given but not hex, convert it (e.g., rgb(255,87,51) = #FF5733)
4. Categorize colors as: primary, secondary, accent, or neutral
5. Extract ALL fonts with exact names and available weights
6. Include EVERY "don't" rule for logos

Return ONLY valid JSON matching this exact structure:

{
  "brandName": "string or null",
  "description": "string or null",
  "colors": {
    "primary": [
      {"name": "Color Name", "hex": "#XXXXXX", "rgb": "rgb(R,G,B)", "cmyk": "cmyk(C,M,Y,K)", "pantone": "XXXX C", "usage": "description"}
    ],
    "secondary": [],
    "accent": [],
    "neutral": []
  },
  "typography": {
    "primary": {"name": "Font Name", "weights": ["400", "500", "700"], "usage": "Headings"},
    "secondary": {"name": "Font Name", "weights": ["400", "500"], "usage": "Body text"},
    "hierarchy": {
      "h1": {"size": "48px", "weight": "700", "lineHeight": "1.2"},
      "h2": {"size": "36px", "weight": "600", "lineHeight": "1.3"},
      "body": {"size": "16px", "weight": "400", "lineHeight": "1.5"}
    }
  },
  "logo": {
    "description": "General logo description",
    "clearSpace": "Minimum clear space requirement",
    "minSize": {"digital": "24px", "print": "10mm"},
    "variations": ["Primary", "Secondary", "Icon", "Wordmark"],
    "backgrounds": {"approved": ["White", "Black"], "forbidden": ["Busy images"]},
    "donts": ["Don't stretch", "Don't rotate", "Don't change colors"]
  },
  "voice": {
    "personality": "Overall brand personality description",
    "tone": ["Friendly", "Professional", "Approachable"],
    "guidelines": ["Write in active voice", "Keep sentences short"],
    "vocabulary": {"use": ["innovative", "seamless"], "avoid": ["cheap", "basically"]}
  },
  "imagery": {
    "photography": "Photography style description",
    "illustration": "Illustration style description",
    "icons": "Icon style description",
    "guidelines": ["Use natural lighting", "Show real people"]
  },
  "messaging": {
    "taglines": ["Main tagline"],
    "keyMessages": ["Key message 1", "Key message 2"],
    "valuePropositions": ["Value prop 1"]
  }
}

Only include fields where you found actual data. Use null for missing single values, empty arrays [] for missing lists.
Return ONLY the JSON, no markdown code blocks, no explanation.`
      }],
    });

    let extractedData;
    const extractedText = extractionResponse.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    try {
      // Clean up potential markdown code blocks
      let jsonStr = extractedText.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      extractedData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.log('Raw response:', extractedText.substring(0, 500));
      // Return a minimal valid structure if parsing fails
      extractedData = {
        colors: { primary: [], secondary: [], accent: [], neutral: [] },
        typography: {},
        logo: {},
        voice: {},
        imagery: {},
        messaging: {}
      };
    }

    // PASS 2: Validate and find missing color hex codes
    console.log('Pass 2: Validating and finding missing data...');
    
    const allColors = [
      ...(extractedData.colors?.primary || []),
      ...(extractedData.colors?.secondary || []),
      ...(extractedData.colors?.accent || []),
      ...(extractedData.colors?.neutral || [])
    ];

    const colorsMissingHex = allColors.filter(c => !c.hex || !c.hex.startsWith('#'));
    
    if (colorsMissingHex.length > 0 || allColors.length === 0) {
      console.log('Finding missing hex codes...');
      
      const hexSearchResponse = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Search this content for ALL color hex codes (#XXXXXX format):

${rawContent}

List every hex code you find with its associated name. Format as JSON array:
[{"name": "Color Name", "hex": "#XXXXXX", "category": "primary|secondary|accent|neutral"}]

Look for:
- Explicit hex codes like #FF5733
- RGB values (convert to hex)
- Color names near hex codes
- CSS color definitions
- Color palette sections

Return ONLY the JSON array, no explanation.`
        }],
      });

      try {
        let hexJson = hexSearchResponse.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('')
          .trim();
        
        if (hexJson.startsWith('```')) {
          hexJson = hexJson.replace(/```json?\n?/g, '').replace(/```/g, '');
        }
        
        const foundColors = JSON.parse(hexJson);
        
        // Merge found colors into extracted data
        for (const color of foundColors) {
          if (color.hex && color.hex.startsWith('#')) {
            const category = color.category || 'primary';
            if (!extractedData.colors[category]) {
              extractedData.colors[category] = [];
            }
            
            // Check if this hex already exists
            const exists = extractedData.colors[category].some(
              c => c.hex?.toLowerCase() === color.hex.toLowerCase()
            );
            
            if (!exists) {
              extractedData.colors[category].push({
                name: color.name || `Color ${color.hex}`,
                hex: color.hex.toUpperCase(),
                usage: color.usage || ''
              });
            }
          }
        }
      } catch (e) {
        console.log('Hex search parse error:', e.message);
      }
    }

    // PASS 3: Deduplicate and clean
    console.log('Pass 3: Deduplicating and cleaning...');
    
    // Deduplicate colors by hex code
    for (const category of ['primary', 'secondary', 'accent', 'neutral']) {
      if (extractedData.colors?.[category]) {
        const seen = new Set();
        extractedData.colors[category] = extractedData.colors[category].filter(color => {
          if (!color.hex) return false;
          const hex = color.hex.toUpperCase();
          if (seen.has(hex)) return false;
          seen.add(hex);
          color.hex = hex; // Normalize to uppercase
          return true;
        });
      }
    }

    // Deduplicate voice tone and guidelines
    if (extractedData.voice?.tone) {
      extractedData.voice.tone = [...new Set(extractedData.voice.tone)];
    }
    if (extractedData.voice?.guidelines) {
      extractedData.voice.guidelines = [...new Set(extractedData.voice.guidelines)];
    }

    // Deduplicate logo donts
    if (extractedData.logo?.donts) {
      extractedData.logo.donts = [...new Set(extractedData.logo.donts)];
    }

    // Clean empty values
    extractedData = cleanEmptyValues(extractedData);

    console.log('Extraction complete. Colors found:', {
      primary: extractedData.colors?.primary?.length || 0,
      secondary: extractedData.colors?.secondary?.length || 0,
      accent: extractedData.colors?.accent?.length || 0,
      neutral: extractedData.colors?.neutral?.length || 0,
    });

    return res.status(200).json(extractedData);

  } catch (error) {
    console.error('Extract brand error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Remove empty arrays, null values, and empty objects
function cleanEmptyValues(obj) {
  if (Array.isArray(obj)) {
    const cleaned = obj.map(cleanEmptyValues).filter(v => v !== null && v !== undefined);
    return cleaned.length > 0 ? cleaned : [];
  }
  
  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanEmptyValues(value);
      if (
        cleanedValue !== null &&
        cleanedValue !== undefined &&
        cleanedValue !== '' &&
        !(Array.isArray(cleanedValue) && cleanedValue.length === 0) &&
        !(typeof cleanedValue === 'object' && Object.keys(cleanedValue).length === 0)
      ) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : {};
  }
  
  return obj;
}
