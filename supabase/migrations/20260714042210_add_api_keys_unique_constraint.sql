/*
# Add unique constraint on api_keys(user_id, provider)

## Problem
The `api_keys` table had no unique constraint on `(user_id, provider)`.
The `upsert` with `onConflict: "user_id,provider"` was silently inserting
duplicate rows instead of updating the existing key, because there was no
conflict to trigger on.

## Changes
- Adds a unique index on `(user_id, provider)` so the upsert conflict target exists.
- This is safe to re-run (IF NOT EXISTS).
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_user_provider_unique
ON api_keys(user_id, provider);