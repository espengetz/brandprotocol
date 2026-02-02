import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Server, ArrowLeft, Palette, Type, Image, MessageSquare, 
  FileImage, Layout, CheckCircle, XCircle, Download,
  ChevronDown, ChevronRight, Copy, Check, Loader2, Code, Database,
  FileText, File
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase, getBrand, getBrandSources } from '../lib/supabase';
import { getBrandAssets, groupAssetsByType } from '../lib/ai';

function ColorSwatch({ color }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div onClick={handleCopy} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '80px', height: '80px', backgroundColor: color.hex, borderRadius: '8px',
        border: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {copied && <Check size={16} color="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: '500' }}>{color.name}</div>
        <div style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>{color.hex}</div>
        {color.usage && <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>{color.usage}</div>}
      </div>
    </div>
  );
}

function AssetCard({ asset }) {
  const isImage = ['logo', 'image', 'icon', 'swatch'].includes(asset.type);
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5', overflow: 'hidden' }}>
      <div style={{ height: '120px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isImage ? (
          <img src={asset.public_url} alt={asset.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : asset.type === 'pdf' ? (
          <FileText size={32} color="#ef4444" />
        ) : asset.type === 'font' ? (
          <Type size={32} color="#3b82f6" />
        ) : (
          <File size={32} color="#666" />
        )}
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.name}
        </div>
        <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
          {asset.file_extension?.toUpperCase()} • {asset.size_bytes ? `${Math.round(asset.size_bytes / 1024)}KB` : ''}
        </div>
        <a href={asset.public_url} target="_blank" rel="noopener noreferrer" 
           style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#000', textDecoration: 'none' }}>
          <Download size={12} /> Download
        </a>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true, isEmpty = false, count = 0 }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (isEmpty) {
    return (
      <div style={{ padding: '24px', backgroundColor: '#fafafa', borderRadius: '12px', border: '1px dashed #e5e5e5', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#999' }}>
          <Icon size={20} />
          <span style={{ fontSize: '14px' }}>{title} - No data extracted</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e5e5', marginBottom: '24px', overflow: 'hidden' }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{
        width: '100%', padding: '20px 24px', backgroundColor: '#fafafa', border: 'none',
        borderBottom: isOpen ? '1px solid #e5e5e5' : 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Icon size={20} />
          <span style={{ fontSize: '16px', fontWeight: '600' }}>{title}</span>
          {count > 0 && <span style={{ backgroundColor: '#000', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{count}</span>}
        </div>
        {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>
      {isOpen && <div style={{ padding: '24px' }}>{children}</div>}
    </div>
  );
}

export default function BrandRepo() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [brand, setBrand] = useState(null);
  const [sources, setSources] = useState([]);
  const [assets, setAssets] = useState([]);
  const [groupedAssets, setGroupedAssets] = useState({});
  const [brandData, setBrandData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('visual');

  useEffect(() => {
    if (!user) { navigate('/auth?mode=login'); return; }
    loadBrandData();
  }, [user, brandId, navigate]);

  const loadBrandData = async () => {
    const { data: brandInfo } = await getBrand(brandId);
    if (!brandInfo) { navigate('/dashboard'); return; }
    setBrand(brandInfo);

    const { data: sourcesData } = await getBrandSources(brandId);
    setSources(sourcesData || []);
    
    const assetsData = await getBrandAssets(supabase, brandId);
    setAssets(assetsData);
    setGroupedAssets(groupAssetsByType(assetsData));
    
    // Combine sources
    const combined = {
      brandName: brandInfo.name, description: brandInfo.description || '',
      colors: { primary: [], secondary: [], accent: [], neutral: [] },
      typography: {}, logo: {}, voice: {}, imagery: {}, messaging: {}
    };

    for (const source of (sourcesData || [])) {
      const c = source.content || {};
      
      if (c.colors) {
        for (const [cat, colors] of Object.entries(c.colors)) {
          if (Array.isArray(colors)) {
            combined.colors[cat] = [...(combined.colors[cat] || []), ...colors.filter(x => x?.hex)];
          }
        }
      }
      
      if (c.typography) combined.typography = { ...combined.typography, ...c.typography };
      if (c.logo) {
        combined.logo = { ...combined.logo, ...c.logo };
        if (c.logo.donts) combined.logo.donts = [...(combined.logo.donts || []), ...c.logo.donts];
      }
      if (c.voice) {
        combined.voice = {
          tone: [...(combined.voice.tone || []), ...(c.voice.tone || [])],
          personality: c.voice.personality || combined.voice.personality,
          guidelines: [...(combined.voice.guidelines || []), ...(c.voice.guidelines || [])]
        };
      }
      if (c.imagery) combined.imagery = { ...combined.imagery, ...c.imagery };
      if (c.messaging) {
        combined.messaging = {
          taglines: [...(combined.messaging.taglines || []), ...(c.messaging.taglines || [])],
          keyMessages: [...(combined.messaging.keyMessages || []), ...(c.messaging.keyMessages || [])],
          valuePropositions: [...(combined.messaging.valuePropositions || []), ...(c.messaging.valuePropositions || [])]
        };
      }
      if (c.description && !combined.description) combined.description = c.description;
      if (c.brandName) combined.brandName = c.brandName;
    }

    // Dedupe
    ['primary', 'secondary', 'accent', 'neutral'].forEach(cat => {
      const seen = new Set();
      combined.colors[cat] = (combined.colors[cat] || []).filter(c => {
        if (!c.hex || seen.has(c.hex)) return false;
        seen.add(c.hex); return true;
      });
    });
    if (combined.voice.tone) combined.voice.tone = [...new Set(combined.voice.tone)];
    if (combined.voice.guidelines) combined.voice.guidelines = [...new Set(combined.voice.guidelines)];
    if (combined.logo.donts) combined.logo.donts = [...new Set(combined.logo.donts)];

    setBrandData(combined);
    setLoading(false);
  };

  const hasColors = brandData && Object.values(brandData.colors).some(arr => arr?.length > 0);
  const hasTypography = brandData?.typography?.primary || brandData?.typography?.secondary;
  const hasLogo = brandData?.logo?.description || brandData?.logo?.donts?.length || groupedAssets.logo?.length > 0;
  const hasVoice = brandData?.voice?.tone?.length || brandData?.voice?.personality || brandData?.voice?.guidelines?.length;
  const hasMessaging = brandData?.messaging?.taglines?.length || brandData?.messaging?.keyMessages?.length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const TabButton = ({ tab, icon: Icon, label, count }) => (
    <button onClick={() => setActiveTab(tab)} style={{
      padding: '8px 16px', backgroundColor: activeTab === tab ? '#fff' : 'transparent',
      border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '6px',
      boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
    }}>
      <Icon size={14} /> {label} {count > 0 && `(${count})`}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1a1a1a' }}>
      <header style={{ padding: '20px 40px', borderBottom: '1px solid #e5e5e5', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate(`/dashboard/brand/${brandId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <ArrowLeft size={20} color="#666" />
            </button>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={18} color="#fff" />
            </div>
            <span style={{ fontSize: '15px', fontWeight: '500' }}>{brandData?.brandName || brand?.name}</span>
            <span style={{ fontSize: '13px', color: '#666' }}>/ Brand Repo</span>
          </div>
          
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
            <TabButton tab="visual" icon={Layout} label="Visual" />
            <TabButton tab="assets" icon={Image} label="Assets" count={assets.length} />
            <TabButton tab="raw" icon={Code} label="Raw Data" />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        {activeTab === 'visual' && (
          <>
            <div style={{ backgroundColor: '#000', borderRadius: '16px', padding: '40px', marginBottom: '32px', color: '#fff' }}>
              <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '12px' }}>{brandData?.brandName}</h1>
              {brandData?.description && <p style={{ fontSize: '15px', color: '#999', maxWidth: '600px', lineHeight: '1.6' }}>{brandData.description}</p>}
              <div style={{ display: 'flex', gap: '24px', marginTop: '24px' }}>
                <div><div style={{ fontSize: '24px', fontWeight: '600' }}>{Object.values(brandData?.colors || {}).flat().length}</div><div style={{ fontSize: '12px', color: '#666' }}>Colors</div></div>
                <div><div style={{ fontSize: '24px', fontWeight: '600' }}>{[brandData?.typography?.primary, brandData?.typography?.secondary].filter(Boolean).length}</div><div style={{ fontSize: '12px', color: '#666' }}>Fonts</div></div>
                <div><div style={{ fontSize: '24px', fontWeight: '600' }}>{assets.length}</div><div style={{ fontSize: '12px', color: '#666' }}>Assets</div></div>
              </div>
            </div>

            <Section title="Colors" icon={Palette} isEmpty={!hasColors} count={Object.values(brandData?.colors || {}).flat().length}>
              {Object.entries(brandData?.colors || {}).map(([category, colors]) => colors?.length > 0 && (
                <div key={category} style={{ marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', color: '#666', marginBottom: '16px' }}>{category} Colors</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                    {colors.map((color, i) => <ColorSwatch key={i} color={color} />)}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Typography" icon={Type} isEmpty={!hasTypography}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                {brandData?.typography?.primary && (
                  <div style={{ padding: '24px', backgroundColor: '#fafafa', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Primary Font</div>
                    <div style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>{brandData.typography.primary.name}</div>
                    {brandData.typography.primary.weights && <div style={{ fontSize: '13px', color: '#666' }}>Weights: {brandData.typography.primary.weights.join(', ')}</div>}
                    {brandData.typography.primary.usage && <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>{brandData.typography.primary.usage}</div>}
                  </div>
                )}
                {brandData?.typography?.secondary && (
                  <div style={{ padding: '24px', backgroundColor: '#fafafa', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Secondary Font</div>
                    <div style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>{brandData.typography.secondary.name}</div>
                    {brandData.typography.secondary.weights && <div style={{ fontSize: '13px', color: '#666' }}>Weights: {brandData.typography.secondary.weights.join(', ')}</div>}
                  </div>
                )}
              </div>
            </Section>

            <Section title="Logo Guidelines" icon={FileImage} isEmpty={!hasLogo}>
              {brandData?.logo?.description && <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.6', marginBottom: '20px' }}>{brandData.logo.description}</p>}
              {(brandData?.logo?.clearSpace || brandData?.logo?.minSize) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  {brandData?.logo?.clearSpace && <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px' }}><div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Clear Space</div><div style={{ fontSize: '14px' }}>{brandData.logo.clearSpace}</div></div>}
                  {brandData?.logo?.minSize && <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px' }}><div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Min Size</div><div style={{ fontSize: '14px' }}>{typeof brandData.logo.minSize === 'object' ? `Digital: ${brandData.logo.minSize.digital}, Print: ${brandData.logo.minSize.print}` : brandData.logo.minSize}</div></div>}
                </div>
              )}
              {brandData?.logo?.donts?.length > 0 && (
                <div><h4 style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><XCircle size={14} /> Don'ts</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#333' }}>{brandData.logo.donts.map((d, i) => <li key={i} style={{ marginBottom: '6px' }}>{d}</li>)}</ul>
                </div>
              )}
            </Section>

            <Section title="Voice & Tone" icon={MessageSquare} isEmpty={!hasVoice}>
              {brandData?.voice?.personality && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Personality</div><p style={{ fontSize: '14px', color: '#333', lineHeight: '1.6' }}>{brandData.voice.personality}</p></div>}
              {brandData?.voice?.tone?.length > 0 && <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>Tone</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{brandData.voice.tone.map((t, i) => <span key={i} style={{ padding: '6px 14px', backgroundColor: '#f0f0f0', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>{t}</span>)}</div></div>}
              {brandData?.voice?.guidelines?.length > 0 && <div><div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>Guidelines</div><ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '1.8' }}>{brandData.voice.guidelines.map((g, i) => <li key={i}>{g}</li>)}</ul></div>}
            </Section>

            <Section title="Messaging" icon={Layout} isEmpty={!hasMessaging}>
              {brandData?.messaging?.taglines?.length > 0 && <div style={{ marginBottom: '24px' }}><div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>Taglines</div>{brandData.messaging.taglines.map((t, i) => <div key={i} style={{ padding: '16px 20px', backgroundColor: '#fafafa', borderRadius: '8px', fontSize: '16px', fontStyle: 'italic', marginBottom: '8px' }}>"{t}"</div>)}</div>}
              {brandData?.messaging?.keyMessages?.length > 0 && <div><div style={{ fontSize: '11px', fontWeight: '600', color: '#666', marginBottom: '12px', textTransform: 'uppercase' }}>Key Messages</div><ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '1.8' }}>{brandData.messaging.keyMessages.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
            </Section>

            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e5e5', marginTop: '40px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Data Completeness</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                {[{ name: 'Colors', has: hasColors }, { name: 'Typography', has: hasTypography }, { name: 'Logo', has: hasLogo }, { name: 'Voice', has: hasVoice }, { name: 'Messaging', has: hasMessaging }].map(item => (
                  <div key={item.name} style={{ padding: '12px', backgroundColor: item.has ? '#f0fdf4' : '#fafafa', borderRadius: '8px', textAlign: 'center', border: item.has ? '1px solid #bbf7d0' : '1px solid #e5e5e5' }}>
                    {item.has ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#999" />}
                    <div style={{ fontSize: '11px', color: item.has ? '#166534' : '#666', marginTop: '4px' }}>{item.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'assets' && (
          <>
            <div style={{ backgroundColor: '#000', borderRadius: '16px', padding: '24px', marginBottom: '24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}><Image size={20} /><h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Brand Assets</h2></div>
              <p style={{ fontSize: '13px', color: '#999', margin: 0 }}>{assets.length} asset(s) downloaded</p>
            </div>

            {assets.length === 0 ? (
              <div style={{ padding: '60px 40px', backgroundColor: '#fff', border: '1px dashed #e5e5e5', borderRadius: '12px', textAlign: 'center' }}>
                <Image size={40} color="#ccc" style={{ marginBottom: '16px' }} />
                <div style={{ fontSize: '14px', color: '#666' }}>No assets downloaded yet</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>Add a URL source to download logos, images, and fonts</div>
              </div>
            ) : (
              <>
                {['logo', 'icon', 'image', 'font', 'pdf', 'other'].map(type => groupedAssets[type]?.length > 0 && (
                  <Section key={type} title={type.charAt(0).toUpperCase() + type.slice(1) + 's'} icon={type === 'font' ? Type : type === 'pdf' ? FileText : FileImage} count={groupedAssets[type].length}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                      {groupedAssets[type].map(asset => <AssetCard key={asset.id} asset={asset} />)}
                    </div>
                  </Section>
                ))}
              </>
            )}
          </>
        )}

        {activeTab === 'raw' && (
          <>
            <div style={{ backgroundColor: '#000', borderRadius: '16px', padding: '24px', marginBottom: '24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}><Database size={20} /><h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Raw Source Data</h2></div>
              <p style={{ fontSize: '13px', color: '#999', margin: 0 }}>{sources.length} source(s)</p>
            </div>

            {sources.map((source, i) => (
              <div key={source.id} style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e5e5', marginBottom: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', backgroundColor: '#fafafa', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Source {i + 1}: {source.type}</div><div style={{ fontSize: '12px', color: '#666' }}>{source.name?.slice(0, 60)}</div></div>
                  <div style={{ fontSize: '11px', color: '#999' }}>{new Date(source.created_at).toLocaleString()}</div>
                </div>
                <pre style={{ margin: 0, padding: '20px', fontSize: '12px', fontFamily: 'monospace', backgroundColor: '#1a1a1a', color: '#e5e5e5', overflow: 'auto', maxHeight: '400px' }}>
                  {JSON.stringify(source.content, null, 2)}
                </pre>
              </div>
            ))}

            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e5e5', marginTop: '32px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#000', color: '#fff' }}><div style={{ fontSize: '14px', fontWeight: '600' }}>Combined Data (What MCP sees)</div></div>
              <pre style={{ margin: 0, padding: '20px', fontSize: '12px', fontFamily: 'monospace', backgroundColor: '#1a1a1a', color: '#e5e5e5', overflow: 'auto', maxHeight: '500px' }}>
                {JSON.stringify(brandData, null, 2)}
              </pre>
            </div>
          </>
        )}
      </main>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>
    </div>
  );
}
