import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Combine multiple sources into unified brand knowledge
function combineSourcesIntoBrandData(brand, sources) {
  const combined = {
    brandName: brand.name,
    description: brand.description || '',
    colors: { primary: [], secondary: [], accent: [], neutral: [] },
    typography: {},
    logo: {},
    voice: {},
    messaging: {},
    additionalGuidelines: {}
  };

  for (const source of sources) {
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
    
    // Merge typography (later sources override)
    if (content.typography) {
      combined.typography = { ...combined.typography, ...content.typography };
    }
    
    // Merge logo guidelines
    if (content.logo) {
      combined.logo = { ...combined.logo, ...content.logo };
      if (content.logo.donts) {
        combined.logo.donts = [
          ...(combined.logo.donts || []),
          ...content.logo.donts
        ];
      }
    }
    
    // Merge voice
    if (content.voice) {
      combined.voice = {
        tone: [...(combined.voice.tone || []), ...(content.voice.tone || [])],
        personality: content.voice.personality || combined.voice.personality,
        guidelines: [...(combined.voice.guidelines || []), ...(content.voice.guidelines || [])]
      };
    }
    
    // Merge messaging
    if (content.messaging) {
      combined.messaging = {
        taglines: [...(combined.messaging.taglines || []), ...(content.messaging.taglines || [])],
        keyMessages: [...(combined.messaging.keyMessages || []), ...(content.messaging.keyMessages || [])],
        valuePropositions: [...(combined.messaging.valuePropositions || []), ...(content.messaging.valuePropositions || [])]
      };
    }

    // Update description if present
    if (content.description && !combined.description) {
      combined.description = content.description;
    }
    if (content.brandName && combined.brandName === brand.name) {
      combined.brandName = content.brandName;
    }
  }

  // Dedupe arrays
  combined.voice.tone = [...new Set(combined.voice.tone)];
  combined.voice.guidelines = [...new Set(combined.voice.guidelines)];
  combined.logo.donts = [...new Set(combined.logo.donts || [])];

  return combined;
}

// Cache for brand data to avoid repeated DB calls
const brandCache = new Map();

async function getBrandData(brandId) {
  if (brandCache.has(brandId)) {
    return brandCache.get(brandId);
  }

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single();

  if (brandError || !brand) {
    return null;
  }

  const { data: sources } = await supabase
    .from('brand_sources')
    .select('*')
    .eq('brand_id', brandId);

  const brandKnowledge = combineSourcesIntoBrandData(brand, sources || []);
  brandCache.set(brandId, brandKnowledge);
  
  return brandKnowledge;
}

export default async function handler(req, res) {
  // Extract brandId from URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const brandId = pathParts[pathParts.length - 1];

  if (!brandId || brandId === 'mcp') {
    return res.status(400).json({ error: 'Brand ID required' });
  }

  const brandKnowledge = await getBrandData(brandId);
  
  if (!brandKnowledge) {
    return res.status(404).json({ error: 'Brand not found' });
  }

  const brandName = brandKnowledge.brandName;

  const mcpHandler = createMcpHandler(
    (server) => {
      server.tool(
        'get_brand_guidelines',
        `Get complete ${brandName} brand guidelines`,
        {},
        async () => {
          let response = `# ${brandName} Brand Guidelines\n\n`;
          
          if (brandKnowledge.description) {
            response += `## Overview\n${brandKnowledge.description}\n\n`;
          }
          
          if (Object.values(brandKnowledge.colors).some(arr => arr.length > 0)) {
            response += `## Brand Colors\n`;
            for (const [category, colors] of Object.entries(brandKnowledge.colors)) {
              if (colors?.length > 0) {
                response += `\n### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
                colors.forEach(c => response += `• ${c.name}: ${c.hex} - ${c.usage || 'General use'}\n`);
              }
            }
          }
          
          if (brandKnowledge.typography?.primary || brandKnowledge.typography?.secondary) {
            response += `\n## Typography\n`;
            if (brandKnowledge.typography.primary) {
              response += `• Primary: ${brandKnowledge.typography.primary.name}\n`;
            }
            if (brandKnowledge.typography.secondary) {
              response += `• Secondary: ${brandKnowledge.typography.secondary.name}\n`;
            }
          }
          
          if (brandKnowledge.logo?.description || brandKnowledge.logo?.donts?.length) {
            response += `\n## Logo Usage\n`;
            if (brandKnowledge.logo.description) response += `${brandKnowledge.logo.description}\n`;
            if (brandKnowledge.logo.clearSpace) response += `• Clear space: ${brandKnowledge.logo.clearSpace}\n`;
            if (brandKnowledge.logo.donts?.length) {
              response += `Don'ts:\n`;
              brandKnowledge.logo.donts.forEach(d => response += `❌ ${d}\n`);
            }
          }
          
          if (brandKnowledge.voice?.tone?.length || brandKnowledge.voice?.personality) {
            response += `\n## Voice & Tone\n`;
            if (brandKnowledge.voice.tone?.length) response += `Tone: ${brandKnowledge.voice.tone.join(", ")}\n`;
            if (brandKnowledge.voice.personality) response += `Personality: ${brandKnowledge.voice.personality}\n`;
          }
          
          return { content: [{ type: "text", text: response }] };
        }
      );

      server.tool(
        'get_brand_color',
        `Get ${brandName} brand colors by category`,
        { category: z.enum(["primary", "secondary", "accent", "neutral"]).describe("Color category to retrieve") },
        async ({ category }) => {
          const colors = brandKnowledge.colors[category];
          if (!colors?.length) {
            return { content: [{ type: "text", text: `No ${category} colors defined.` }] };
          }
          const list = colors.map(c => `• ${c.name}: ${c.hex}\n  ${c.usage || ''}`).join("\n\n");
          return { content: [{ type: "text", text: `${brandName} ${category} colors:\n\n${list}` }] };
        }
      );

      server.tool(
        'check_brand_compliance',
        `Check if a color or font complies with ${brandName} guidelines`,
        {
          type: z.enum(["color", "font"]).describe("Type of element to check"),
          value: z.string().describe("The color hex code or font name to check")
        },
        async ({ type, value }) => {
          if (type === "color") {
            const normalized = value.toUpperCase().replace(/^#/, '');
            const allColors = Object.values(brandKnowledge.colors).flat();
            const match = allColors.find(c => c.hex?.toUpperCase().replace(/^#/, '') === normalized);
            if (match) {
              return { content: [{ type: "text", text: `✅ COMPLIANT: ${match.name} (${match.hex})` }] };
            }
            return { content: [{ type: "text", text: `❌ NOT COMPLIANT: #${normalized} is not in the brand palette.\n\nApproved: ${allColors.map(c => c.hex).join(", ")}` }] };
          }
          
          if (type === "font") {
            const fonts = [brandKnowledge.typography?.primary?.name, brandKnowledge.typography?.secondary?.name].filter(Boolean);
            const isOk = fonts.some(f => f?.toLowerCase().includes(value.toLowerCase()));
            if (isOk) return { content: [{ type: "text", text: `✅ COMPLIANT: "${value}" is approved.` }] };
            return { content: [{ type: "text", text: `❌ NOT COMPLIANT: "${value}"\n\nApproved fonts: ${fonts.join(", ")}` }] };
          }
          
          return { content: [{ type: "text", text: "Invalid type" }] };
        }
      );

      server.tool(
        'get_voice_guidelines',
        `Get ${brandName} voice and tone guidelines`,
        {},
        async () => {
          const v = brandKnowledge.voice;
          if (!v?.tone?.length && !v?.personality) {
            return { content: [{ type: "text", text: "No voice guidelines defined." }] };
          }
          let text = `# ${brandName} Voice & Tone\n\n`;
          if (v.tone?.length) text += `**Tone:** ${v.tone.join(", ")}\n\n`;
          if (v.personality) text += `**Personality:** ${v.personality}\n\n`;
          if (v.guidelines?.length) {
            text += `**Guidelines:**\n`;
            v.guidelines.forEach(g => text += `• ${g}\n`);
          }
          return { content: [{ type: "text", text }] };
        }
      );

      server.tool(
        'get_logo_guidelines',
        `Get ${brandName} logo usage guidelines`,
        {},
        async () => {
          const l = brandKnowledge.logo;
          if (!l?.description && !l?.donts?.length) {
            return { content: [{ type: "text", text: "No logo guidelines defined." }] };
          }
          let text = `# ${brandName} Logo Guidelines\n\n`;
          if (l.description) text += `${l.description}\n\n`;
          if (l.clearSpace) text += `**Clear Space:** ${l.clearSpace}\n`;
          if (l.minSize) text += `**Minimum Size:** ${l.minSize}\n`;
          if (l.donts?.length) {
            text += `\n**Don'ts:**\n`;
            l.donts.forEach(d => text += `❌ ${d}\n`);
          }
          return { content: [{ type: "text", text }] };
        }
      );

      server.tool(
        'get_typography',
        `Get ${brandName} typography guidelines`,
        {},
        async () => {
          const t = brandKnowledge.typography;
          if (!t?.primary && !t?.secondary) {
            return { content: [{ type: "text", text: "No typography guidelines defined." }] };
          }
          let text = `# ${brandName} Typography\n\n`;
          if (t.primary) {
            text += `**Primary:** ${t.primary.name}\n`;
            if (t.primary.usage) text += `  Usage: ${t.primary.usage}\n`;
          }
          if (t.secondary) {
            text += `**Secondary:** ${t.secondary.name}\n`;
            if (t.secondary.usage) text += `  Usage: ${t.secondary.usage}\n`;
          }
          return { content: [{ type: "text", text }] };
        }
      );
    },
    { 
      name: `${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-brand-mcp`, 
      version: '1.0.0' 
    },
    { 
      basePath: `/api/mcp/${brandId}`,
      verboseLogs: true
    }
  );

  return mcpHandler(req, res);
}
