# Customer Signal Supabase Setup

1. Create a Supabase project.
2. In the project SQL editor, run the migrations in order:
   - `supabase/migrations/001_customer_signal_phase3.sql`
   - `supabase/migrations/002_pgvector_rag.sql`
   - `supabase/migrations/003_feedback_metadata.sql`
   - `supabase/migrations/004_workspace_delete_cascade.sql`
   - `supabase/migrations/006_delete_saved_reports_on_workspace_delete.sql`
   - `supabase/migrations/007_repair_workspace_delete_feedback_cascade.sql`
3. In Authentication settings, enable Email provider. For local testing, disable email confirmation or confirm users manually.
4. Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

OPENAI_API_KEY=your-server-side-openai-key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

5. Restart the Next.js dev server.

All app data tables use Row Level Security. Users can only select, insert, update, or delete rows where `user_id = auth.uid()`. Profiles are keyed by `auth.users.id`.

Do not prefix the OpenAI key with `NEXT_PUBLIC_`. It is used only by server routes.

Phase 5 uses pgvector. New imports go through `/api/import-feedback`, generate embeddings with OpenAI `text-embedding-3-small` server-side, and store them in `feedback_items.embedding`. Ask AI embeds the question with the same OpenAI embedding model, calls `match_feedback_items`, then sends only matched evidence to OpenAI for the structured answer.

Flexible imports save unmapped CSV columns into `feedback_items.metadata`. Run `003_feedback_metadata.sql` before importing generic datasets with metadata.

Workspace deletion removes workspace-owned data. Run `004_workspace_delete_cascade.sql`, `006_delete_saved_reports_on_workspace_delete.sql`, and `007_repair_workspace_delete_feedback_cascade.sql` so deleting a workspace removes its feedback, saved reports, and workspace-scoped usage events. Migration `007` also removes orphaned feedback rows left by an earlier workspace delete.
