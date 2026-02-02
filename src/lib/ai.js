// AI utilities for brand extraction - calls backend APIs

const API_BASE = '/api';

// Extract content from a URL (calls our backend)
export async function extractFromUrl(url) {
  const response = await fetch(`${API_BASE}/extract-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract content from URL');
  }

  const data = await response.json();
  return data; // Returns { content, assets, sourceUrl }
}

// Extract brand data from content (calls our backend)
export async function extractBrandData(content, isPdf = false, base64Data = null) {
  const response = await fetch(`${API_BASE}/extract-brand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, isPdf, base64Data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract brand data');
  }

  return response.json();
}

// Download and store assets for a brand
export async function extractAndStoreAssets(brandId, sourceId, assets) {
  if (!assets || assets.length === 0) {
    return { success: true, stored: 0, assets: [] };
  }

  const response = await fetch(`${API_BASE}/extract-assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId, sourceId, assets }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract assets');
  }

  return response.json();
}

// Get all assets for a brand from Supabase
export async function getBrandAssets(supabase, brandId) {
  const { data, error } = await supabase
    .from('brand_assets')
    .select('*')
    .eq('brand_id', brandId)
    .order('type')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching brand assets:', error);
    return [];
  }

  return data || [];
}

// Group assets by type
export function groupAssetsByType(assets) {
  const grouped = {
    logo: [],
    icon: [],
    image: [],
    font: [],
    pdf: [],
    swatch: [],
    other: [],
  };

  for (const asset of assets) {
    if (grouped[asset.type]) {
      grouped[asset.type].push(asset);
    } else {
      grouped.other.push(asset);
    }
  }

  return grouped;
}

// Read file as base64 (for PDF uploads)
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove the data URL prefix to get just the base64
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Read file as text (for text files)
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
