-- BrandMCP Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Brands table
create table public.brands (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Brand sources table
create table public.brand_sources (
  id uuid default uuid_generate_v4() primary key,
  brand_id uuid references public.brands(id) on delete cascade not null,
  type text not null, -- 'url', 'pdf', 'document', 'text'
  name text not null,
  content jsonb not null default '{}',
  raw_file_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index brands_user_id_idx on public.brands(user_id);
create index brand_sources_brand_id_idx on public.brand_sources(brand_id);

-- Row Level Security (RLS)
alter table public.brands enable row level security;
alter table public.brand_sources enable row level security;

-- Policies for brands
create policy "Users can view their own brands"
  on public.brands for select
  using (auth.uid() = user_id);

create policy "Users can create their own brands"
  on public.brands for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own brands"
  on public.brands for update
  using (auth.uid() = user_id);

create policy "Users can delete their own brands"
  on public.brands for delete
  using (auth.uid() = user_id);

-- Policies for brand_sources
create policy "Users can view sources of their brands"
  on public.brand_sources for select
  using (
    exists (
      select 1 from public.brands
      where brands.id = brand_sources.brand_id
      and brands.user_id = auth.uid()
    )
  );

create policy "Users can create sources for their brands"
  on public.brand_sources for insert
  with check (
    exists (
      select 1 from public.brands
      where brands.id = brand_sources.brand_id
      and brands.user_id = auth.uid()
    )
  );

create policy "Users can delete sources of their brands"
  on public.brand_sources for delete
  using (
    exists (
      select 1 from public.brands
      where brands.id = brand_sources.brand_id
      and brands.user_id = auth.uid()
    )
  );

-- Allow service role to read brands/sources for MCP endpoint (public access via brand ID)
create policy "Service role can read all brands"
  on public.brands for select
  using (true);

create policy "Service role can read all brand sources"
  on public.brand_sources for select
  using (true);

-- Storage bucket for uploaded files (optional)
-- Run this separately if you want file uploads
-- insert into storage.buckets (id, name, public) values ('brand-files', 'brand-files', true);

-- Updated at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger brands_updated_at
  before update on public.brands
  for each row execute procedure public.handle_updated_at();
