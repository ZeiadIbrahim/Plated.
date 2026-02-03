# Plated

High-end personal cookbook & recipe parser with a digital editorial aesthetic.

## Requirements

- Node.js 18+
- A Gemini API key

## Setup

1. Create a .env.local file and set:
	- GEMINI_API_KEY=

2. (Optional) Configure Supabase credentials:
	- NEXT_PUBLIC_SUPABASE_URL=
	- NEXT_PUBLIC_SUPABASE_ANON_KEY=

3. Run the dev server:
	- npm run dev

## Project Notes

- Supabase SQL schema is in supabase/schema.sql.
- Recipe parsing endpoint: POST /api/parse { url }.
- Core UI component: RecipeCard in src/components/RecipeCard.tsx.
