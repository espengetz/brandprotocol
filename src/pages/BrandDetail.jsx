import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Server, ArrowLeft, Plus, Upload, Link, FileText, Trash2, Copy, Check, Loader2, X, Eye, Image } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getBrand, getBrandSources, addBrandSource, deleteBrandSource } from '../lib/supabase';
import { extractFromUrl, extractBrandData, extractAndStoreAssets, readFileAsBase64, readFileAsText } from '../lib/ai';

export default function BrandDetail() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [brand, setBrand] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState(null); // null, 'url', 'file'
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    loadBrandData();
  }, [user, brandId, navigate]);

  const loadBrandData = async () => {
    const { data: brandData, error: brandError } = await getBrand(brandId);
    if (brandError || !brandData) {
      navigate('/dashboard');
      return;
    }
    setBrand(brandData);

    const { data: sourcesData } = await getBrandSources(brandId);
    setSources(sourcesData || []);
    setLoading(false);
  };

  const handleAddSource = async () => {
    setError('');
    setProcessing(true);

    try {
      let content;
      let sourceName;
      let sourceType;
      let extractedAssets = [];

      if (addMode === 'url') {
        setStatus('Fetching content and discovering assets...');
        sourceName = url;
        sourceType = 'url';
        
        // Extract content and discover assets
        const extractResult = await extractFromUrl(url);
        extractedAssets = extractResult.assets || [];
        
        setStatus(`Found ${extractedAssets.length} assets. Extracting brand information...`);
        content = await extractBrandData(extractResult.content);
        
      } else if (file) {
        sourceName = file.name;
        sourceType = file.type === 'application/pdf' ? 'pdf' : 'document';
        
        setStatus('Reading file...');
        if (file.type === 'application/pdf') {
          const base64 = await readFileAsBase64(file);
          setStatus('Extracting brand information from PDF...');
          content = await extractBrandData('', true, base64);
        } else {
          const text = await readFileAsText(file);
          setStatus('Extracting brand information...');
          content = await extractBrandData(text);
        }
      }

      setStatus('Saving source...');
      const { data, error: saveError } = await addBrandSource(brandId, {
        type: sourceType,
        name: sourceName,
        content,
      });

      if (saveError) throw saveError;

      // Now download and store assets if we found any
      if (extractedAssets.length > 0) {
        setStatus(`Downloading ${Math.min(extractedAssets.length, 20)} assets...`);
        try {
          const assetResult = await extractAndStoreAssets(brandId, data.id, extractedAssets);
          console.log(`Stored ${assetResult.stored} assets`);
        } catch (assetError) {
          console.error('Asset extraction error (non-fatal):', assetError);
          // Don't fail the whole operation if asset extraction fails
        }
      }

      setSources([data, ...sources]);
      setAddMode(null);
      setUrl('');
      setFile(null);
      setAdding(false);
    } catch (err) {
      setError(err.message || 'Failed to add source. Please try again.');
    } finally {
      setProcessing(false);
      setStatus('');
    }
  };

  const handleDeleteSource = async (sourceId) => {
    if (!confirm('Delete this source?')) return;
    
    const { error } = await deleteBrandSource(sourceId);
    if (!error) {
      setSources(sources.filter(s => s.id !== sourceId));
    }
  };

  const handleCopy = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAddMode('file');
    }
  };

  const getMcpUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/mcp/${brandId}/mcp`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ fontSize: '14px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#1a1a1a'
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 40px',
        borderBottom: '1px solid #e5e5e5',
        backgroundColor: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex'
            }}
          >
            <ArrowLeft size={20} color="#666" />
          </button>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#000',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Server size={18} color="#fff" />
          </div>
          <span style={{ fontSize: '15px', fontWeight: '500' }}>{brand?.name}</span>
        </div>
      </header>

      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 24px'
      }}>
        {/* View Brand Repo Button */}
        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '10px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Brand Repo</div>
            <div style={{ fontSize: '13px', color: '#666' }}>View all extracted brand guidelines and assets</div>
          </div>
          <button
            onClick={() => navigate(`/dashboard/brand/${brandId}/repo`)}
            style={{
              padding: '10px 16px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={14} />
            View Repo
          </button>
        </div>

        {/* MCP URL */}
        <div style={{
          padding: '20px',
          backgroundColor: '#000',
          borderRadius: '10px',
          marginBottom: '32px'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '500',
            color: '#888',
            marginBottom: '8px'
          }}>
            MCP URL
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <code style={{
              flex: 1,
              padding: '10px 12px',
              backgroundColor: '#1a1a1a',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: "'SF Mono', monospace",
              color: '#fff'
            }}>
              {getMcpUrl()}
            </code>
            <button
              onClick={() => handleCopy(getMcpUrl(), 'url')}
              style={{
                padding: '10px 14px',
                backgroundColor: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copied === 'url' ? <Check size={14} /> : <Copy size={14} />}
              {copied === 'url' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Knowledge Sources */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
            Knowledge Sources
          </h2>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} />
              Add Source
            </button>
          )}
        </div>

        {/* Add Source UI */}
        {adding && (
          <div style={{
            padding: '24px',
            backgroundColor: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: '10px',
            marginBottom: '20px'
          }}>
            {!addMode && !processing && (
              <>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Add Knowledge Source</span>
                  <button
                    onClick={() => setAdding(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex'
                    }}
                  >
                    <X size={18} color="#666" />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    onClick={() => setAddMode('url')}
                    style={{
                      padding: '20px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Link size={20} style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>From URL</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Extracts content + downloads assets
                    </div>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '20px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Upload size={20} style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>Upload File</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      PDF, TXT, MD, DOCX
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.docx"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </>
            )}

            {addMode === 'url' && !processing && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <button
                    onClick={() => setAddMode(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <X size={18} color="#666" />
                  </button>
                  <span style={{ fontSize: '13px', color: '#666' }}>Add from URL</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://brand.com/guidelines"
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      fontSize: '14px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleAddSource}
                    disabled={!url}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: url ? '#000' : '#e5e5e5',
                      color: url ? '#fff' : '#999',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: url ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                  <Image size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Will automatically download logos, images, fonts, and other assets
                </div>
              </>
            )}

            {addMode === 'file' && !processing && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <button
                    onClick={() => { setAddMode(null); setFile(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <X size={18} color="#666" />
                  </button>
                  <span style={{ fontSize: '13px', color: '#666' }}>Upload file</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={18} color="#666" />
                    <span style={{ fontSize: '14px' }}>{file?.name}</span>
                  </div>
                  <button
                    onClick={handleAddSource}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
              </>
            )}

            {processing && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '20px 0'
              }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px', color: '#666' }}>{status}</span>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#b91c1c',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Sources List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sources.length === 0 ? (
            <div style={{
              padding: '40px',
              backgroundColor: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '14px', color: '#666' }}>
                No knowledge sources yet. Add your first source above.
              </p>
            </div>
          ) : (
            sources.map((source) => (
              <div
                key={source.id}
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {source.type === 'url' ? (
                    <Link size={18} color="#666" />
                  ) : (
                    <FileText size={18} color="#666" />
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      {source.name.length > 50 ? source.name.slice(0, 50) + '...' : source.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      Added {new Date(source.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSource(source.id)}
                  style={{
                    padding: '8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <Trash2 size={16} color="#999" />
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
