import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Fetching URL:', url);

    // First, fetch the raw HTML to extract asset URLs
    let html = '';
    let baseUrl = url;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });
      
      if (response.ok) {
        html = await response.text();
        baseUrl = response.url; // Handle redirects
      }
    } catch (e) {
      console.log('Direct fetch failed, will rely on Claude:', e.message);
    }

    // Extract asset URLs from HTML
    const assets = extractAssetUrls(html, baseUrl);
    console.log(`Found ${assets.length} potential assets`);

    // Use Claude to fetch and analyze the page content
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      tools: [
        {
          type: 'web_search',
          name: 'web_search',
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Please fetch and analyze this brand guidelines page: ${url}

I need you to extract ALL brand information including:

1. **Colors**: Find EVERY color mentioned with:
   - Color name
   - Hex code (look for #XXXXXX patterns)
   - RGB values if available
   - CMYK values if available
   - Pantone codes if available
   - Usage guidelines for each color

2. **Typography**: Find ALL fonts with:
   - Font family names
   - Available weights
   - Usage (headings, body, etc.)
   - Any font pairing rules
   - Line height and spacing guidelines

3. **Logo**: Find ALL logo information:
   - Logo variations (primary, secondary, icon, etc.)
   - Clear space requirements
   - Minimum size requirements
   - Color variations (full color, white, black)
   - Background requirements
   - What NOT to do with the logo

4. **Voice & Tone**:
   - Brand personality traits
   - Tone attributes
   - Writing style guidelines
   - Words to use / avoid
   - Example phrases

5. **Imagery**:
   - Photography style
   - Illustration style
   - Icon style
   - Image treatment guidelines

6. **Assets & Downloads**: List any downloadable assets you find:
   - Logo files
   - Font files
   - Templates
   - PDF guidelines

Return the complete raw content you find. Include specific values, measurements, and rules. Don't summarize - I need the detailed information.`,
        },
      ],
    });

    // Extract text content from response
    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text + '\n';
      }
    }

    return res.status(200).json({ 
      content,
      assets: assets.slice(0, 50), // Return top 50 assets found
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
  
  // Parse base URL for resolving relative paths
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  // Helper to resolve and add URL
  const addAsset = (urlStr, context = {}) => {
    if (!urlStr || urlStr.startsWith('data:') || urlStr.startsWith('javascript:')) {
      return;
    }
    
    try {
      // Resolve relative URLs
      const fullUrl = new URL(urlStr, base).href;
      
      // Skip if already seen
      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);
      
      // Skip common non-brand assets
      if (
        fullUrl.includes('google-analytics') ||
        fullUrl.includes('facebook.com') ||
        fullUrl.includes('twitter.com') ||
        fullUrl.includes('linkedin.com') ||
        fullUrl.includes('analytics') ||
        fullUrl.includes('tracking') ||
        fullUrl.includes('pixel') ||
        fullUrl.includes('ads') ||
        fullUrl.includes('advertisement')
      ) {
        return;
      }
      
      assets.push({ url: fullUrl, context });
    } catch {
      // Invalid URL, skip
    }
  };

  // Extract images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*(?:class=["']([^"']*)["'])?/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    addAsset(match[1], { 
      alt: match[2] || '', 
      className: match[3] || '',
      type: 'img'
    });
  }

  // Extract background images from inline styles
  const bgRegex = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'background' });
  }

  // Extract PDFs and downloadable files
  const linkRegex = /<a[^>]+href=["']([^"']+\.(?:pdf|zip|eps|ai|svg))["'][^>]*>([^<]*)/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    addAsset(match[1], { 
      name: match[2].trim() || '',
      type: 'download'
    });
  }

  // Extract fonts from CSS
  const fontRegex = /url\(["']?([^"')]+\.(?:woff2?|ttf|otf|eot))["']?\)/gi;
  while ((match = fontRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'font' });
  }

  // Extract favicons and icons
  const iconRegex = /<link[^>]+(?:rel=["'](?:icon|apple-touch-icon|shortcut icon)["'])[^>]+href=["']([^"']+)["']/gi;
  while ((match = iconRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'icon' });
  }

  // Extract SVGs (inline src)
  const svgRegex = /<(?:img|object|embed)[^>]+(?:src|data)=["']([^"']+\.svg)["']/gi;
  while ((match = svgRegex.exec(html)) !== null) {
    addAsset(match[1], { type: 'svg' });
  }

  // Sort by relevance (logos first, then images, then others)
  return assets.sort((a, b) => {
    const aScore = getRelevanceScore(a);
    const bScore = getRelevanceScore(b);
    return bScore - aScore;
  });
}

// Score assets by relevance to brand guidelines
function getRelevanceScore(asset) {
  const url = asset.url.toLowerCase();
  const context = `${asset.context?.alt || ''} ${asset.context?.className || ''} ${asset.context?.name || ''}`.toLowerCase();
  
  let score = 0;
  
  // High priority keywords
  if (url.includes('logo') || context.includes('logo')) score += 100;
  if (url.includes('brand') || context.includes('brand')) score += 50;
  if (url.includes('color') || context.includes('color')) score += 40;
  if (url.includes('palette') || context.includes('palette')) score += 40;
  if (url.includes('typography') || context.includes('typography')) score += 30;
  if (url.includes('font') || context.includes('font')) score += 30;
  if (url.includes('icon') || context.includes('icon')) score += 20;
  if (url.includes('guideline')) score += 30;
  
  // File type scoring
  if (url.endsWith('.svg')) score += 15;
  if (url.endsWith('.pdf')) score += 25;
  if (url.match(/\.(woff2?|ttf|otf)$/)) score += 20;
  
  // Penalize common non-brand assets
  if (url.includes('avatar')) score -= 20;
  if (url.includes('profile')) score -= 20;
  if (url.includes('thumb')) score -= 10;
  if (url.includes('placeholder')) score -= 30;
  
  return score;
}
