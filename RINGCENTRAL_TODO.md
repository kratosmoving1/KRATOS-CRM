RINGCENTRAL_TODO.md

Plan and implementation notes for RingCentral integration

Features needed

1. Click-to-call from CRM
   - Implement a secure server-side API that creates RingCentral calls using OAuth or JWT
   - Use server-side credentials only; never expose client secret in the browser
   - Provide UI integration to start call and show call progress

2. Send SMS from CRM
   - Implement POST /api/communications/sms/send
   - Render templates server-side and substitute variables
   - Ensure sending number is SMS-enabled and belongs to extension
   - Save communications records and audit logs only after successful send

3. Sync call logs from RingCentral to CRM
   - Create a webhook endpoint to receive call logs and message events
   - Map RingCentral call/message objects to `communications` table

4. Sync inbound SMS replies to CRM
   - Receive SMS inbound webhooks, attach to customer/opportunity, create timeline entries
   - Optionally notify assigned agent

5. Attach communications to opportunity/customer
   - Use `communications.opportunity_id` and `communications.customer_id` fields

6. Show timeline activity
   - Ensure `app/api/admin/opportunities/[id]/timeline` includes fetched ringcentral synced items

7. Respect opt-out/compliance rules
   - Maintain do-not-contact lists per customer
   - Add consent/status fields and check before sending

8. Handle failed SMS/calls
   - Save failed attempts with status and error information
   - Retry policy and alerting for persistent failures

Required environment variables (server only)

- RINGCENTRAL_CLIENT_ID
- RINGCENTRAL_CLIENT_SECRET
- RINGCENTRAL_JWT (optional; for JWT auth)
- RINGCENTRAL_SERVER_URL (default: https://platform.ringcentral.com)
- RINGCENTRAL_FROM_NUMBER

Notes

- RingCentral SMS requires that the sending number be SMS-enabled for the authenticated extension. Verify from the RingCentral admin dashboard.
- Prefer server-to-server JWT or OAuth with a service account and store secrets in environment variables or a secrets manager.
- Use official RingCentral SDK for Node when implementing production flows.
- Document exact API usage and scopes required in README when implementing.
