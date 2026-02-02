// Frontend AI utilities - calls backend API routes

export const extractFromUrl = async (url) => {
  const response = await fetch("/api/extract-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract from URL');
  }
  
  const data = await response.json();
  return data.content;
};

export const extractBrandData = async (content, isPdf = false, base64Data = null) => {
  const response = await fetch("/api/extract-brand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, isPdf, base64Data })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract brand data');
  }

  const data = await response.json();
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
};
