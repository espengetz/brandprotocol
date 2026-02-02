import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Link, FileText, Loader2, ArrowRight, X, Server } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { extractFromUrl, extractBrandData, readFileAsBase64, readFileAsText } from '../lib/ai';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inputType, setInputType] = useState(null);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleGenerate = async () => {
    setError('');
    setLoading(true);

    try {
      let brandData;

      if (inputType === 'url') {
        setStatus('Fetching brand guidelines...');
        const content = await extractFromUrl(url);
        setStatus('Analyzing brand data...');
        brandData = await extractBrandData(content);
      } else if (file) {
        setStatus('Reading file...');
        if (file.type === 'application/pdf') {
          const base64 = await readFileAsBase64(file);
          setStatus('Analyzing brand data...');
          brandData = await extractBrandData('', true, base64);
        } else {
          const text = await readFileAsText(file);
          setStatus('Analyzing brand data...');
          brandData = await extractBrandData(text);
        }
      }

      // Store in sessionStorage to pass to auth/dashboard
      sessionStorage.setItem('pendingBrandData', JSON.stringify(brandData));
      sessionStorage.setItem('pendingSourceType', inputType);
      sessionStorage.setItem('pendingSourceName', inputType === 'url' ? url : file.name);

      // Navigate based on auth state
      if (user) {
        navigate('/dashboard/new');
      } else {
        navigate('/auth?mode=signup');
      }
    } catch (err) {
      setError(err.message || 'Failed to analyze brand guidelines. Please try again.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setInputType('file');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setInputType('file');
    }
  };

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
        {user ? (
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Dashboard
          </button>
        ) : (
          <button
            onClick={() => navigate('/auth?mode=login')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#fff',
              color: '#000',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Sign In
          </button>
        )}
      </header>

      <main style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '80px 24px'
      }}>
        {!loading ? (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h1 style={{
              fontSize: '42px',
              fontWeight: '600',
              letterSpacing: '-0.03em',
              marginBottom: '16px',
              lineHeight: '1.1'
            }}>
              Turn brand guidelines<br />into an AI tool
            </h1>
            <p style={{
              fontSize: '17px',
              color: '#666',
              marginBottom: '48px',
              lineHeight: '1.6'
            }}>
              Create an MCP server from your brand guidelines. Connect it to Claude, 
              ChatGPT, or Cursor so AI always knows your brand.
            </p>

            {!inputType && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px'
              }}>
                <button
                  onClick={() => setInputType('url')}
                  style={{
                    padding: '32px 24px',
                    backgroundColor: '#fff',
                    border: '1px solid #e5e5e5',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = '#000'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = '#e5e5e5'}
                >
                  <Link size={24} style={{ marginBottom: '16px' }} />
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                    From URL
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Paste your brand guidelines link
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    padding: '32px 24px',
                    backgroundColor: '#fff',
                    border: '1px solid #e5e5e5',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = '#000'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = '#e5e5e5'}
                >
                  <Upload size={24} style={{ marginBottom: '16px' }} />
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                    Upload File
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    PDF, DOCX, or text file
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
            )}

            {inputType === 'url' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <button
                    onClick={() => setInputType(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <X size={18} color="#666" />
                  </button>
                  <span style={{ fontSize: '13px', color: '#666' }}>Import from URL</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://brand.company.com/guidelines"
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      fontSize: '15px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#000'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={!url}
                    style={{
                      padding: '14px 24px',
                      backgroundColor: url ? '#000' : '#e5e5e5',
                      color: url ? '#fff' : '#999',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '500',
                      cursor: url ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    Continue
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {inputType === 'file' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <button
                    onClick={() => { setInputType(null); setFile(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <X size={18} color="#666" />
                  </button>
                  <span style={{ fontSize: '13px', color: '#666' }}>Upload file</span>
                </div>
                <div style={{
                  padding: '20px',
                  backgroundColor: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} color="#666" />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{file?.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {file && (file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerate}
                    style={{
                      padding: '12px 20px',
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
                    Continue
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: '20px',
                padding: '14px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px'
              }}>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              backgroundColor: '#000',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <Loader2 size={24} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '6px' }}>
              Analyzing Brand Guidelines
            </h2>
            <p style={{ fontSize: '14px', color: '#666' }}>{status}</p>
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
