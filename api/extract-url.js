import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use the latest, most capable model
const MODEL = 'claude-sonnet-4-20250514';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    console.log('Fetching URL:', url);

    // Step 1: Fetch raw HTML to extract assets
    let html = '';
    let baseUrl = url;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (response.ok) {
        html = await response.text();
        baseUrl = response.url;
      }
    } catch (e) {
      console.log('Direct fetch failed:', e.message);
    }

    // Extract asset URLs from HTML
    const assets = extractAssetUrls(html, baseUrl);
    console.log(`Found ${assets.length} potential assets`);

    // Step 2: Use Claude with web search to deeply analyze the page
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      tools: [{ type: 'web_search', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `You are a brand guidelines expert. Thoroughly analyze this brand guidelines page: ${url}

IMPORTANT: I need you to extract EVERY SINGLE piece of brand information. Be exhaustive and specific.

## COLORS - CRITICAL
Find ALL colors. For each color, I need:
- Exact hex code (e.g., #FF5733) - LOOK FOR THESE SPECIFICALLY
- Color name (e.g., "Brand Red", "Primary Blue")
- RGB values if shown (e.g., rgb(255, 87, 51))
- CMYK values if shown
- Pantone code if shown
- Usage description (e.g., "Use for primary buttons", "Background color")
- Category: Is it Primary, Secondary, Accent, or Neutral?

Look in CSS, style attributes, color swatches, and any text mentioning colors. Brand guidelines ALWAYS have specific hex codes - find them.

## TYPOGRAPHY
For each font:
- Exact font family name (e.g., "Inter", "Helvetica Neue")
- Available weights (e.g., 400, 500, 600, 700 or Light, Regular, Medium, Bold)
- Usage: headings, body text, captions, etc.
- Font size guidelines if specified
- Line height recommendations
- Letter spacing
- Any font pairing rules

## LOGO
- All logo variations (primary, secondary, icon-only, wordmark, etc.)
- Clear space requirements (usually expressed as "x" height or specific pixels)
- Minimum size requirements for print and digital
- Approved color variations (full color, white/reverse, black/mono)
- Background color requirements
- SPECIFIC "Don'ts" - what NOT to do with the logo (stretch, rotate, recolor, etc.)

## VOICE & TONE
- Brand personality traits (e.g., "friendly but professional")
- Tone attributes (list them all)
- Writing style guidelines
- Words/phrases to USE
- Words/phrases to AVOID
- Example sentences showing correct tone

## IMAGERY
- Photography style (candid, staged, lifestyle, product)
- Color treatment for photos
- Illustration style if applicable
- Icon style guidelines
- Image composition rules

## ADDITIONAL
- Taglines or slogans
- Key messages
- Value propositions
- Any spacing/grid systems
- Motion/animation guidelines

Return ALL information you find. Include exact values, codes, and measurements. Do not summarize or skip details.`
      }],
    });

    // Extract text content
    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text + '\n';
      }
    }

    return res.status(200).json({ 
      content,
      assets: assets.slice(0, 50),
      sourceUrl: url,
    });

  } catch (error) {
    console.error('Extract URL error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Extract asset URLs from HTML
function extractAssetUrls(html, baseUrl) {
  if (!html) return [];
  
  const assets = [];
  const seen = new Set();
  
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const addAsset = (urlStr, context = {}) => {
    if (!urlStr || urlStr.startsWith('data:') || urlStr.startsWith('javascript:')) return;
    
    try {
      const fullUrl = new URL(urlStr, base).href;
      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);
      
      // Skip tracking/analytics
      if (/google-analytics|facebook\.com|twitter\.com|linkedin\.com|analytics|tracking|pixel|advertisement/i.test(fullUrl)) {
        return;
      }
      
      assets.push({ url: fullUrl, context });
    } catch {}
  };

  // Extract images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*(?:class=["']([^"']*)["'])?/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    addAsset(match[1], { alt: match[2] || '', className: match[3] || '', type: 'img' });
  }

  // Background images
  const bgRegex = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'background' });
  }

  // PDFs and downloads
  const linkRegex = /<a[^>]+href=["']([^"']+\.(?:pdf|zip|eps|ai|svg))["'][^>]*>([^<]*)/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    addAsset(match[1], { name: match[2].trim() || '', type: 'download' });
  }

  // Fonts
  const fontRegex = /url\(["']?([^"')]+\.(?:woff2?|ttf|otf|eot))["']?\)/gi;
  while ((match = fontRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'font' });
  }

  // Icons/favicons
  const iconRegex = /<link[^>]+(?:rel=["'](?:icon|apple-touch-icon|shortcut icon)["'])[^>]+href=["']([^"']+)["']/gi;
  while ((match = iconRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'icon' });
  }

  // SVGs
  const svgRegex = /<(?:img|object|embed)[^>]+(?:src|data)=["']([^"']+\.svg)["']/gi;
  while ((match = svgRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'svg' });
  }

  // Sort by relevance
  return assets.sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a));
}

function getRelevanceScore(asset) {
  const url = asset.url.toLowerCase();
  const context = `${asset.context?.alt || ''} ${asset.context?.className || ''} ${asset.context?.name || ''}`.toLowerCase();
  
  let score = 0;
  
  if (url.includes('logo') || context.includes('logo')) score += 100;
  if (url.includes('brand') || context.includes('brand')) score += 50;
  if (url.includes('color') || context.includes('color')) score += 40;
  if (url.includes('palette') || context.includes('palette')) score += 40;
  if (url.includes('typography') || context.includes('typography')) score += 30;
  if (url.includes('font') || context.includes('font')) score += 30;
  if (url.includes('icon') || context.includes('icon')) score += 20;
  if (url.includes('guideline')) score += 30;
  
  if (url.endsWith('.svg')) score += 15;
  if (url.endsWith('.pdf')) score += 25;
  if (url.match(/\.(woff2?|ttf|otf)$/)) score += 20;
  
  if (url.includes('avatar')) score -= 20;
  if (url.includes('profile')) score -= 20;
  if (url.includes('thumb')) score -= 10;
  if (url.includes('placeholder')) score -= 30;
  
  return score;
}
