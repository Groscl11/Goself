-- ============================================================
-- Security Fix: convert SECURITY DEFINER views → SECURITY INVOKER
--
-- PostgreSQL views are effectively SECURITY DEFINER when owned by
-- a privileged role (postgres/supabase_admin), meaning queries
-- through the view bypass the caller's RLS policies and can return
-- data across all tenants.
--
-- Setting security_invoker = on forces the view to execute with
-- the *querying user's* permissions and RLS context, so existing
-- tenant-isolation policies on the underlying tables are respected.
--
-- Supabase security advisor finding: ERROR level
--   - transaction_summary_view
--   - client_transaction_summary
-- ============================================================

-- transaction_summary_view: used by admin + MemberDetail.tsx
-- With security_invoker=on, clients will only see transactions for
-- members belonging to their own client_id (via member_users RLS).
ALTER VIEW transaction_summary_view SET (security_invoker = on);

-- client_transaction_summary: aggregated view built on transaction_summary_view
ALTER VIEW client_transaction_summary SET (security_invoker = on);
