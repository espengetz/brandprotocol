# BrandProtocol

Automatically train any AI agent on your brand. Create an MCP server that Claude, ChatGPT, and Cursor can connect to.

## Features

- **Import brand guidelines** from URL or PDF
- **AI extracts** colors, typography, voice, logo rules automatically
- **Get an instant MCP URL** that you can to connect to any AI assistant
- **Add more knowledge** over time - upload additional docs, URLs, assets
- **User accounts** to manage multiple brands

## Quick Start

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Go to Settings → API and copy your URL and keys

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your Supabase credentials:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_URL` - Same URL (for server-side)
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

Add your environment variables in Vercel's dashboard.

## How It Works

1. **User imports brand guidelines** (URL or PDF upload)
2. **Claude API analyzes** the content and extracts structured brand data
3. **Data is stored** in Supabase under the user's account
4. **MCP endpoint is created** at `/api/mcp/[brandId]`
5. **User copies the URL** and adds it to Claude Desktop or Cursor

## MCP Tools

Each brand MCP server provides these tools:

| Tool | Description |
|------|-------------|
| `get_brand_guidelines` | Get complete brand guidelines |
| `get_brand_color` | Get colors by category |
| `check_brand_compliance` | Check if a color/font is on-brand |
| `get_voice_guidelines` | Get voice and tone guidelines |
| `get_logo_guidelines` | Get logo usage rules |
| `get_typography` | Get typography guidelines |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│    Vercel       │────▶│    Supabase     │
│   (Frontend)    │     │   (API/MCP)     │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Claude API    │     │   MCP Clients   │
│  (Extraction)   │     │ (Claude/Cursor) │
└─────────────────┘     └─────────────────┘
```

## Tech Stack

- **Frontend**: React, Vite, React Router
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Claude API (content extraction)
- **MCP**: mcp-handler

## Connecting to Your Brand MCP

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "brand": {
      "url": "https://your-app.vercel.app/api/mcp/your-brand-id"
    }
  }
}
```

### Cursor

Add to your MCP settings:

```json
{
  "mcpServers": {
    "my-brand": {
      "url": "https://your-app.vercel.app/api/mcp/your-brand-id"
    }
  }
}
```
