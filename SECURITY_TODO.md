# Kratos CRM Security TODO

This file tracks security hardening work found during the initial audit. The current app mostly uses server API routes for mutations, which is good. The main remaining risk is that most API routes only check authentication, not authorization.

## High Priority

### `app/api/admin/opportunities/route.ts`
- What it does: Creates customers and opportunities.
- Why risky: Any authenticated user can create opportunities and assign `sales_agent_id` without a role check.
- Recommended fix: Require `lead:create`; restrict assigning other users unless role is `owner`, `admin`, or `manager`; write to `audit_logs`.
- Priority: High

### `app/api/admin/opportunities/[id]/route.ts`
- What it does: Updates, status-changes, and soft-deletes opportunities.
- Why risky: Updates and deletes are sensitive sales-record mutations.
- Recommended fix: Require `lead:update` or `lead:update_assigned` for updates, require admin role for delete, and write to `audit_logs`.
- Priority: High
- Status: First safe conversion implemented for `PATCH` and `DELETE`.

### `app/api/admin/customers/[id]/route.ts`
- What it does: Updates customer records.
- Why risky: Any authenticated user can update customer contact data.
- Recommended fix: Require `contact:update` or `contact:update_assigned`; add payload allowlist; write to `audit_logs`.
- Priority: High

## Medium Priority

### `app/api/admin/communications/route.ts`
- What it does: Creates notes, calls, emails, and SMS log entries.
- Why risky: Communications become part of the customer record and may contain sensitive customer details.
- Recommended fix: Require relevant assigned/customer permissions; write to `audit_logs` for note/email/call creation.
- Priority: Medium

### `app/api/admin/tasks/route.ts`
- What it does: Creates tasks and assigns users.
- Why risky: Authenticated users can assign work to others.
- Recommended fix: Let regular users create tasks for themselves; require manager/admin role to assign other users.
- Priority: Medium

### `app/api/admin/follow-ups/route.ts`
- What it does: Creates follow-ups and assigns users.
- Why risky: Authenticated users can assign follow-ups to others.
- Recommended fix: Let regular users create follow-ups for themselves; require manager/admin role to assign other users.
- Priority: Medium

## Low Priority

### `app/api/admin/profiles/route.ts`
- What it does: Lists active profile names for dropdowns.
- Why risky: Exposes internal user list to any authenticated user.
- Recommended fix: Keep basic names available for CRM workflows, but require `user:read` before exposing email/role or expanded profile data.
- Priority: Low

### `supabase/migrations/0001_initial_schema.sql`
- What it does: Enables RLS but grants broad authenticated full access policies.
- Why risky: Database-level RLS does not yet enforce least privilege.
- Recommended fix: Replace broad policies table-by-table after API routes have complete role checks and assigned-record logic.
- Priority: High for production launch, Medium during current internal development.
