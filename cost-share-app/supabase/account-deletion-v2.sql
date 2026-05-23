-- account-deletion-v2.sql
-- Idempotent migration. Replaces the v1 soft-delete with full GDPR-compliant flow:
--   * PII anonymization on delete_my_account()
--   * deleted_account_emails (sha256 block list) + auth.users trigger
--   * account_deletions_audit (GDPR Art. 30)
--   * storage_cleanup_queue (orphaned avatars consumed by an edge function)
--   * is_caller_active() helper + write-policy guards
--   * profiles.name → NULL-able
-- Safe to run multiple times. Run in Supabase SQL Editor on the remote project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
