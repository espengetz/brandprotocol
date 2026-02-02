import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Asset type detection based on URL and context
function classifyAsset(url, context = {}) {
  const urlLower = url.toLowerCase();
  const { alt = '', className = '', nearbyText = '' } = context;
  const contextLower = `${alt} ${className} ${nearbyText}`.toLowerCase();

  // Check for logos
  if (
    urlLower.includes('logo') ||
    contextLower.includes('logo') ||
    urlLower.includes('brand-mark') ||
    urlLower.includes('brandmark')
  ) {
    return 'logo';
  }

  // Check for icons/favicons
  if (
    urlLower.includes('favicon') ||
    urlLower.includes('icon') ||
    urlLower.includes('apple-touch')
  ) {
    return 'icon';
  }

  // Check for fonts
  if (
    urlLower.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i)
  ) {
    return 'font';
  }

  // Check for PDFs
  if (urlLower.endsWith('.pdf')) {
    return 'pdf';
  }

  // Check for color swatches
  if (
    contextLower.includes('color') ||
    contextLower.includes('palette') ||
    contextLower.includes('swatch')
  ) {
    return 'swatch';
  }

  // Default to image
  if (urlLower.match(/\.(png|jpg|jpeg|gif|svg|webp)(\?|$)/i)) {
    return 'image';
  }

  return 'other';
}

// Get file extension from URL or mime type
function getFileExtension(url, mimeType) {
  // Try to get from URL
  const urlMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  if (urlMatch) {
    return urlMatch[1].toLowerCase();
  }

  // Fall back to mime type
  const mimeExtensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'font/woff': 'woff',
    'font/woff2': 'woff2',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'application/font-woff': 'woff',
    'application/font-woff2': 'woff2',
  };

  return mimeExtensions[mimeType] || 'bin';
}

// Generate a clean filename
function generateFilename(originalUrl, type, index) {
  const url = new URL(originalUrl);
  const pathParts = url.pathname.split('/').filter(Boolean);
  let baseName = pathParts[pathParts.length - 1] || `${type}-${index}`;
  
  // Clean up the filename
  baseName = baseName
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  return baseName;
}

// Download a single asset and upload to Supabase
async function downloadAndStoreAsset(assetInfo, brandId, sourceId) {
  const { url, type, context, index } = assetInfo;

  try {
    console.log(`Downloading: ${url}`);

    // Download the asset
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandProtocol/1.0)',
        'Accept': '*/*',
      },
      timeout: 30000,
    });

    if (!response.ok) {
      console.log(`Failed to download ${url}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get file details
    const extension = getFileExtension(url, contentType);
    const filename = generateFilename(url, type, index);
    const storagePath = `${brandId}/${type}s/${filename}.${extension}`;

    console.log(`Uploading to storage: ${storagePath}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(storagePath, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error(`Upload error for ${url}:`, uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Save to database
    const assetRecord = {
      brand_id: brandId,
      source_id: sourceId,
      type: type,
      category: context.category || null,
      name: context.alt || context.name || filename,
      description: context.description || null,
      original_url: url,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: contentType,
      file_extension: extension,
      size_bytes: buffer.length,
      extracted_data: {},
    };

    const { data: dbData, error: dbError } = await supabase
      .from('brand_assets')
      .insert(assetRecord)
      .select()
      .single();

    if (dbError) {
      console.error(`Database error for ${url}:`, dbError);
      return null;
    }

    console.log(`Successfully stored: ${publicUrl}`);
    return dbData;

  } catch (error) {
    console.error(`Error processing ${url}:`, error.message);
    return null;
  }
}

// Main handler
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
    const { brandId, sourceId, assets } = req.body;

    if (!brandId) {
      return res.status(400).json({ error: 'brandId is required' });
    }

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: 'assets array is required' });
    }

    console.log(`Processing ${assets.length} assets for brand ${brandId}`);

    // Process assets (limit to 20 at a time to avoid timeouts)
    const assetsToProcess = assets.slice(0, 20);
    const results = [];

    for (let i = 0; i < assetsToProcess.length; i++) {
      const asset = assetsToProcess[i];
      const type = classifyAsset(asset.url, asset.context || {});
      
      const result = await downloadAndStoreAsset(
        { ...asset, type, index: i },
        brandId,
        sourceId
      );

      if (result) {
        results.push(result);
      }
    }

    return res.status(200).json({
      success: true,
      processed: assetsToProcess.length,
      stored: results.length,
      assets: results,
    });

  } catch (error) {
    console.error('Extract assets error:', error);
    return res.status(500).json({ error: error.message });
  }
}
