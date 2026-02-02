import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Loader2, CheckCircle2, Copy, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { createBrand, addBrandSource } from '../lib/supabase';

export default function NewBrand() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [brandData, setBrandData] = useState(null);
  const [sourceType, setSourceType] = useState(null);
  const [sourceName, setSourceName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [brandId, setBrandId] = useState(null);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    // Get pending brand data from session
    const pendingData = sessionStorage.getItem('pendingBrandData');
    const pendingType = sessionStorage.getItem('pendingSourceType');
    const pendingName = sessionStorage.getItem('pendingSourceName');

    if (!pendingData) {
      navigate('/');
      return;
    }

    setBrandData(JSON.parse(pendingData));
    setSourceType(pendingType);
    setSourceName(pendingName);
  }, [user, navigate]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Create brand
      const { data: brand, error: brandError } = await createBrand(
        user.id,
        brandData.brandName || 'My Brand',
        { description: brandData.description }
      );

      if (brandError) throw brandError;

      // Add initial source
      const { error: sourceError } = await addBrandSource(brand.id, {
        type: sourceType,
        name: sourceName,
        content: brandData,
      });

      if (sourceError) throw sourceError;

      // Clear session storage
      sessionStorage.removeItem('pendingBrandData');
      sessionStorage.removeItem('pendingSourceType');
      sessionStorage.removeItem('pendingSourceName');

      setBrandId(brand.id);
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save brand. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getMcpUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/mcp/${brandId}`;
  };

  const claudeConfig = brandId ? JSON.stringify({
    mcpServers: {
      [brandData?.brandName?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'brand']: {
        url: getMcpUrl()
      }
    }
  }, null, 2) : '';

  if (!brandData) {
    return null;
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
          <span style={{ fontSize: '15px', fontWeight: '500' }}>BrandMCP</span>
        </div>
      </header>

      <main style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '60px 24px'
      }}>
        {!saved ? (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '600',
              letterSpacing: '-0.02em',
              marginBottom: '8px'
            }}>
              {brandData.brandName || 'Your Brand'} is ready
            </h1>
            <p style={{
              fontSize: '15px',
              color: '#666',
              marginBottom: '32px'
            }}>
              Review the extracted data and save to create your MCP server.
            </p>

            {/* Preview */}
            <div style={{
              padding: '20px',
              backgroundColor: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: '10px',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
                Extracted Brand Data
              </h3>
              
              {brandData.colors && Object.keys(brandData.colors).some(k => brandData.colors[k]?.length > 0) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#666', marginBottom: '8px' }}>
                    Colors
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Object.values(brandData.colors).flat().filter(Boolean).slice(0, 8).map((color, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{
                          width: '14px',
                          height: '14px',
                          backgroundColor: color.hex,
                          borderRadius: '3px',
                          border: '1px solid #e5e5e5'
                        }} />
                        {color.hex}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brandData.typography?.primary?.name && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#666', marginBottom: '8px' }}>
                    Typography
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    {brandData.typography.primary.name}
                    {brandData.typography.secondary?.name && `, ${brandData.typography.secondary.name}`}
                  </div>
                </div>
              )}

              {brandData.voice?.tone?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#666', marginBottom: '8px' }}>
                    Voice & Tone
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    {brandData.voice.tone.join(', ')}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {saving ? 'Creating MCP Server...' : 'Create MCP Server'}
            </button>
          </div>
        ) : (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Success */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '32px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#dcfce7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={24} color="#16a34a" />
              </div>
              <div>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  marginBottom: '2px'
                }}>
                  Your MCP is live!
                </h1>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Copy the URL below to connect to Claude or Cursor
                </p>
              </div>
            </div>

            {/* MCP URL */}
            <div style={{
              padding: '20px',
              backgroundColor: '#000',
              borderRadius: '10px',
              marginBottom: '24px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#888',
                marginBottom: '8px'
              }}>
                Your MCP URL
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <code style={{
                  flex: 1,
                  padding: '12px 14px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: "'SF Mono', monospace",
                  color: '#fff',
                  overflow: 'auto'
                }}>
                  {getMcpUrl()}
                </code>
                <button
                  onClick={() => handleCopy(getMcpUrl(), 'url')}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#fff',
                    color: '#000',
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
                  {copied === 'url' ? <Check size={14} /> : <Copy size={14} />}
                  {copied === 'url' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Claude Config */}
            <div style={{
              padding: '20px',
              backgroundColor: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: '10px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>
                  Claude Desktop / Cursor Config
                </span>
                <button
                  onClick={() => handleCopy(claudeConfig, 'config')}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: '#f5f5f5',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copied === 'config' ? <Check size={12} /> : <Copy size={12} />}
                  {copied === 'config' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre style={{
                padding: '12px',
                backgroundColor: '#1a1a1a',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#e5e5e5',
                overflow: 'auto',
                margin: 0,
                fontFamily: "'SF Mono', monospace"
              }}>
                {claudeConfig}
              </pre>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => navigate(`/dashboard/brand/${brandId}`)}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Add More Knowledge
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '14px 24px',
                  backgroundColor: '#fff',
                  color: '#000',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
