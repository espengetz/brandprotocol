import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Server, ArrowLeft, Palette, Type, Image, MessageSquare, 
  FileImage, Layout, CheckCircle, XCircle, Download, ExternalLink,
  ChevronDown, ChevronRight, Copy, Check, Loader2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getBrand, getBrandSources } from '../lib/supabase';

// Color swatch component
function ColorSwatch({ color, size = 'medium' }) {
  const [copied, setCopied] = useState(false);
  const sizes = {
    small: { box: '40px', text: '11px' },
    medium: { box: '80px', text: '12px' },
    large: { box: '120px', text: '13px' }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div 
      onClick={handleCopy}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <div style={{
        width: sizes[size].box,
        height: sizes[size].box,
        backgroundColor: color.hex,
        borderRadius: '8px',
        border: '1px solid #e5e5e5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s ease'
      }}>
        {copied && <Check size={16} color="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: sizes[size].text, fontWeight: '500' }}>{color.name}</div>
        <div style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>{color.hex}</div>
        {color.usage && <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>{color.usage}</div>}
      </div>
    </div>
  );
}

// Section component with collapse functionality
function Section({ title, icon: Icon, children, defaultOpen = true, isEmpty = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (isEmpty) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#fafafa',
        borderRadius: '12px',
        border: '1px dashed #e5e5e5',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#999' }}>
          <Icon size={20} />
          <span style={{ fontSize: '14px' }}>{title} - No data extracted</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      border: '1px solid #e5e5e5',
      marginBottom: '24px',
      overflow: 'hidden'
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '20px 24px',
          backgroundColor: '#fafafa',
          border: 'none',
          borderBottom: isOpen ? '1px solid #e5e5e5' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Icon size={20} />
          <span style={{ fontSize: '16px', fontWeight: '600' }}>{title}</span>
        </div>
        {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>
      {isOpen && (
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Do's and Don'ts list
function DosDonts({ dos = [], donts = [] }) {
  if (!dos.length && !donts.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
      {dos.length > 0 && (
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={14} /> Do's
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#333' }}>
            {dos.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}
          </ul>
        </div>
      )}
      {donts.length > 0 && (
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <XCircle size={14} /> Don'ts
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#333' }}>
            {donts.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function BrandRepo() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [brand, setBrand] = useState(null);
  const [brandData, setBrandData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    loadBrandData();
  }, [user, brandId, navigate]);

  const loadBrandData = async () => {
    const { data: brandInfo } = await getBrand(brandId);
    if (!brandInfo) {
      navigate('/dashboard');
      return;
    }
    setBrand(brandInfo);

    const { data: sources } = await getBrandSources(brandId);
    
    // Combine all sources into unified brand data
    const combined = {
      brandName: brandInfo.name,
      description: brandInfo.description || '',
      colors: { primary: [], secondary: [], accent: [], neutral: [] },
      typography: {},
      logo: {},
      voice: {},
      imagery: {},
      messaging: {},
      additionalGuidelines: {}
    };

    for (const source of (sources || [])) {
      const content = source.content || {};
      
      // Merge colors
      if (content.colors) {
        for (const [category, colors] of Object.entries(content.colors)) {
          if (colors && Array.isArray(colors)) {
            combined.colors[category] = [
              ...(combined.colors[category] || []),
              ...colors.filter(c => c && c.hex)
            ];
          }
        }
      }
      
      // Merge other sections
      if (content.typography) combined.typography = { ...combined.typography, ...content.typography };
      if (content.logo) {
        combined.logo = { ...combined.logo, ...content.logo };
        if (content.logo.donts) {
          combined.logo.donts = [...(combined.logo.donts || []), ...content.logo.donts];
        }
      }
      if (content.voice) {
        combined.voice = {
          tone: [...(combined.voice.tone || []), ...(content.voice.tone || [])],
          personality: content.voice.personality || combined.voice.personality,
          guidelines: [...(combined.voice.guidelines || []), ...(content.voice.guidelines || [])]
        };
      }
      if (content.imagery) combined.imagery = { ...combined.imagery, ...content.imagery };
      if (content.messaging) {
        combined.messaging = {
          taglines: [...(combined.messaging.taglines || []), ...(content.messaging.taglines || [])],
          keyMessages: [...(combined.messaging.keyMessages || []), ...(content.messaging.keyMessages || [])],
          valuePropositions: [...(combined.messaging.valuePropositions || []), ...(content.messaging.valuePropositions || [])]
        };
      }
      if (content.description && !combined.description) combined.description = content.description;
      if (content.brandName) combined.brandName = content.brandName;
    }

    // Dedupe arrays
    if (combined.voice.tone) combined.voice.tone = [...new Set(combined.voice.tone)];
    if (combined.voice.guidelines) combined.voice.guidelines = [...new Set(combined.voice.guidelines)];
    if (combined.logo.donts) combined.logo.donts = [...new Set(combined.logo.donts)];

    setBrandData(combined);
    setLoading(false);
  };

  const hasColors = brandData && Object.values(brandData.colors).some(arr => arr?.length > 0);
  const hasTypography = brandData?.typography?.primary || brandData?.typography?.secondary;
  const hasLogo = brandData?.logo?.description || brandData?.logo?.donts?.length;
  const hasVoice = brandData?.voice?.tone?.length || brandData?.voice?.personality || brandData?.voice?.guidelines?.length;
  const hasImagery = brandData?.imagery?.style || brandData?.imagery?.guidelines?.length;
  const hasMessaging = brandData?.messaging?.taglines?.length || brandData?.messaging?.keyMessages?.length;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafafa'
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
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
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate(`/dashboard/brand/${brandId}`)}
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
            <div>
              <span style={{ fontSize: '15px', fontWeight: '500' }}>{brandData?.brandName || brand?.name}</span>
              <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>/ Brand Repo</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate(`/dashboard/brand/${brandId}`)}
              style={{
                padding: '8px 14px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Manage Sources
            </button>
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '40px 24px'
      }}>
        {/* Brand Header */}
        <div style={{
          backgroundColor: '#000',
          borderRadius: '16px',
          padding: '40px',
          marginBottom: '32px',
          color: '#fff'
        }}>
          <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '12px' }}>
            {brandData?.brandName || brand?.name}
          </h1>
          {brandData?.description && (
            <p style={{ fontSize: '15px', color: '#999', maxWidth: '600px', lineHeight: '1.6' }}>
              {brandData.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '24px', marginTop: '24px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '600' }}>
                {Object.values(brandData?.colors || {}).flat().length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Colors</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '600' }}>
                {[brandData?.typography?.primary, brandData?.typography?.secondary].filter(Boolean).length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Fonts</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '600' }}>
                {(brandData?.voice?.guidelines?.length || 0) + (brandData?.logo?.donts?.length || 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Rules</div>
            </div>
          </div>
        </div>

        {/* Colors Section */}
        <Section 
          title="Colors" 
          icon={Palette} 
          isEmpty={!hasColors}
        >
          {Object.entries(brandData?.colors || {}).map(([category, colors]) => (
            colors?.length > 0 && (
              <div key={category} style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  textTransform: 'uppercase', 
                  color: '#666',
                  marginBottom: '16px',
                  letterSpacing: '0.5px'
                }}>
                  {category} Colors
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                  {colors.map((color, i) => (
                    <ColorSwatch key={i} color={color} size="medium" />
                  ))}
                </div>
              </div>
            )
          ))}
        </Section>

        {/* Typography Section */}
        <Section 
          title="Typography" 
          icon={Type} 
          isEmpty={!hasTypography}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {brandData?.typography?.primary && (
              <div style={{
                padding: '24px',
                backgroundColor: '#fafafa',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Primary Font
                </div>
                <div style={{ 
                  fontSize: '28px', 
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  {brandData.typography.primary.name}
                </div>
                {brandData.typography.primary.weights && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                    Weights: {brandData.typography.primary.weights.join(', ')}
                  </div>
                )}
                {brandData.typography.primary.usage && (
                  <div style={{ fontSize: '13px', color: '#999' }}>
                    {brandData.typography.primary.usage}
                  </div>
                )}
              </div>
            )}
            {brandData?.typography?.secondary && (
              <div style={{
                padding: '24px',
                backgroundColor: '#fafafa',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Secondary Font
                </div>
                <div style={{ 
                  fontSize: '28px', 
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  {brandData.typography.secondary.name}
                </div>
                {brandData.typography.secondary.weights && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                    Weights: {brandData.typography.secondary.weights.join(', ')}
                  </div>
                )}
                {brandData.typography.secondary.usage && (
                  <div style={{ fontSize: '13px', color: '#999' }}>
                    {brandData.typography.secondary.usage}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Logo Section */}
        <Section 
          title="Logo Guidelines" 
          icon={FileImage} 
          isEmpty={!hasLogo}
        >
          {brandData?.logo?.description && (
            <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.6', marginBottom: '20px' }}>
              {brandData.logo.description}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {brandData?.logo?.clearSpace && (
              <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Clear Space</div>
                <div style={{ fontSize: '14px' }}>{brandData.logo.clearSpace}</div>
              </div>
            )}
            {brandData?.logo?.minSize && (
              <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Minimum Size</div>
                <div style={{ fontSize: '14px' }}>{brandData.logo.minSize}</div>
              </div>
            )}
          </div>
          <DosDonts donts={brandData?.logo?.donts || []} />
        </Section>

        {/* Voice & Tone Section */}
        <Section 
          title="Voice & Tone" 
          icon={MessageSquare} 
          isEmpty={!hasVoice}
        >
          {brandData?.voice?.personality && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                Brand Personality
              </div>
              <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.6' }}>
                {brandData.voice.personality}
              </p>
            </div>
          )}
          {brandData?.voice?.tone?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>
                Tone Attributes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {brandData.voice.tone.map((tone, i) => (
                  <span key={i} style={{
                    padding: '6px 14px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {tone}
                  </span>
                ))}
              </div>
            </div>
          )}
          {brandData?.voice?.guidelines?.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>
                Writing Guidelines
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
                {brandData.voice.guidelines.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Imagery Section */}
        <Section 
          title="Imagery" 
          icon={Image} 
          isEmpty={!hasImagery}
        >
          {brandData?.imagery?.style && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                Visual Style
              </div>
              <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.6' }}>
                {brandData.imagery.style}
              </p>
            </div>
          )}
          {brandData?.imagery?.guidelines?.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
              {brandData.imagery.guidelines.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </Section>

        {/* Messaging Section */}
        <Section 
          title="Messaging" 
          icon={Layout} 
          isEmpty={!hasMessaging}
        >
          {brandData?.messaging?.taglines?.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>
                Taglines
              </div>
              {brandData.messaging.taglines.map((tagline, i) => (
                <div key={i} style={{
                  padding: '16px 20px',
                  backgroundColor: '#fafafa',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontStyle: 'italic',
                  marginBottom: '8px'
                }}>
                  "{tagline}"
                </div>
              ))}
            </div>
          )}
          {brandData?.messaging?.keyMessages?.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>
                Key Messages
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
                {brandData.messaging.keyMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          {brandData?.messaging?.valuePropositions?.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>
                Value Propositions
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
                {brandData.messaging.valuePropositions.map((vp, i) => (
                  <li key={i}>{vp}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Data Completeness Indicator */}
        <div style={{
          padding: '24px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e5e5',
          marginTop: '40px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Data Completeness</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            {[
              { name: 'Colors', has: hasColors },
              { name: 'Typography', has: hasTypography },
              { name: 'Logo', has: hasLogo },
              { name: 'Voice', has: hasVoice },
              { name: 'Imagery', has: hasImagery },
              { name: 'Messaging', has: hasMessaging },
            ].map((item) => (
              <div key={item.name} style={{
                padding: '12px',
                backgroundColor: item.has ? '#f0fdf4' : '#fafafa',
                borderRadius: '8px',
                textAlign: 'center',
                border: item.has ? '1px solid #bbf7d0' : '1px solid #e5e5e5'
              }}>
                {item.has ? (
                  <CheckCircle size={16} color="#16a34a" style={{ marginBottom: '4px' }} />
                ) : (
                  <XCircle size={16} color="#999" style={{ marginBottom: '4px' }} />
                )}
                <div style={{ fontSize: '11px', color: item.has ? '#166534' : '#666' }}>{item.name}</div>
              </div>
            ))}
          </div>
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
