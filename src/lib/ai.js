// Frontend AI utilities - calls backend API routes

export const extractFromUrl = async (url) => {
  const response = await fetch("/api/extract-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to extract from URL');
  }
  
  return data.content;
};

export const extractBrandData = async (content, isPdf = false, base64Data = null) => {
  // Check file size before sending
  if (base64Data) {
    const sizeInMB = (base64Data.length * 0.75) / (1024 * 1024);
    if (sizeInMB > 20) {
      throw new Error(`File too large (${sizeInMB.toFixed(1)}MB). Please use a PDF under 20MB.`);
    }
  }

  const response = await fetch("/api/extract-brand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, isPdf, base64Data })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to extract brand data');
  }

  return data.brandData;
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
