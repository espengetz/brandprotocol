import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Plus, ExternalLink, Copy, Check, Trash2, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getUserBrands, deleteBrand } from '../lib/supabase';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    loadBrands();
  }, [user, navigate]);

  const loadBrands = async () => {
    const { data, error } = await getUserBrands(user.id);
    if (!error) {
      setBrands(data || []);
    }
    setLoading(false);
  };

  const handleCopy = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (brandId, brandName) => {
    if (!confirm(`Delete "${brandName}"? This cannot be undone.`)) return;
    
    const { error } = await deleteBrand(brandId);
    if (!error) {
      setBrands(brands.filter(b => b.id !== brandId));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getMcpUrl = (brandId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/mcp/${brandId}`;
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
        backgroundColor: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>{user?.email}</span>
          <button
            onClick={handleSignOut}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <LogOut size={18} color="#666" />
          </button>
        </div>
      </header>

      <main style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            letterSpacing: '-0.02em'
          }}>
            Your Brands
          </h1>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 16px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} />
            New Brand
          </button>
        </div>

        {brands.length === 0 ? (
          <div style={{
            padding: '60px 40px',
            backgroundColor: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#f5f5f5',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Server size={24} color="#999" />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
              No brands yet
            </h2>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
              Create your first brand MCP server to get started.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Create Brand
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {brands.map((brand) => (
              <div
                key={brand.id}
                style={{
                  padding: '24px',
                  backgroundColor: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '12px'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h2 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      marginBottom: '4px'
                    }}>
                      {brand.name}
                    </h2>
                    {brand.description && (
                      <p style={{ fontSize: '13px', color: '#666' }}>
                        {brand.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => navigate(`/dashboard/brand/${brand.id}`)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#f5f5f5',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Manage
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id, brand.name)}
                      style={{
                        padding: '8px',
                        backgroundColor: 'transparent',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={14} color="#999" />
                    </button>
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#fafafa',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <code style={{
                    fontSize: '12px',
                    fontFamily: "'SF Mono', monospace",
                    color: '#666'
                  }}>
                    {getMcpUrl(brand.id)}
                  </code>
                  <button
                    onClick={() => handleCopy(getMcpUrl(brand.id), brand.id)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#fff',
                      border: '1px solid #e5e5e5',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copied === brand.id ? <Check size={12} /> : <Copy size={12} />}
                    {copied === brand.id ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  color: '#999'
                }}>
                  Created {new Date(brand.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        button:active { transform: scale(0.98); }
      `}</style>
    </div>
  );
}
