import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signUp = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Brand helpers
export const createBrand = async (userId, name, initialData = {}) => {
  const { data, error } = await supabase
    .from('brands')
    .insert({
      user_id: userId,
      name,
      description: initialData.description || null,
    })
    .select()
    .single();
  return { data, error };
};

export const getUserBrands = async (userId) => {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
};

export const getBrand = async (brandId) => {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single();
  return { data, error };
};

export const deleteBrand = async (brandId) => {
  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', brandId);
  return { error };
};

// Brand sources helpers
export const addBrandSource = async (brandId, source) => {
  const { data, error } = await supabase
    .from('brand_sources')
    .insert({
      brand_id: brandId,
      type: source.type,
      name: source.name,
      content: source.content,
      raw_file_url: source.rawFileUrl || null,
    })
    .select()
    .single();
  return { data, error };
};

export const getBrandSources = async (brandId) => {
  const { data, error } = await supabase
    .from('brand_sources')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  return { data, error };
};

export const deleteBrandSource = async (sourceId) => {
  const { error } = await supabase
    .from('brand_sources')
    .delete()
    .eq('id', sourceId);
  return { error };
};

// Get complete brand data for MCP
export const getBrandWithSources = async (brandId) => {
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single();

  if (brandError) return { data: null, error: brandError };

  const { data: sources, error: sourcesError } = await supabase
    .from('brand_sources')
    .select('*')
    .eq('brand_id', brandId);

  if (sourcesError) return { data: null, error: sourcesError };

  return {
    data: { ...brand, sources },
    error: null,
  };
};

// File upload helper
export const uploadFile = async (brandId, file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${brandId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('brand-files')
    .upload(fileName, file);

  if (error) return { url: null, error };

  const { data: { publicUrl } } = supabase.storage
    .from('brand-files')
    .getPublicUrl(fileName);

  return { url: publicUrl, error: null };
};
