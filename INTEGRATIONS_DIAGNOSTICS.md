# Kratos CRM Integration Diagnostics

The admin diagnostics page is available at:

`/admin/settings/integrations`

Use it before testing customer-facing workflows. It reports configuration status without exposing API keys, JWTs, service-role keys, or webhook secrets.

## Required Environment Variables

Core:
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Email:
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM_DEFAULT`
- `EMAIL_REPLY_TO_DEFAULT`

RingCentral:
- `RINGCENTRAL_CLIENT_ID`
- `RINGCENTRAL_CLIENT_SECRET`
- `RINGCENTRAL_JWT`
- `RINGCENTRAL_SERVER_URL=https://platform.ringcentral.com`
- `RINGCENTRAL_FROM_NUMBER`

Stripe:
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

## RingCentral Requirements

RingOut calling requires:
- RingCentral app scope: `RingOut`
- a fresh JWT generated after the scope is added
- an authenticated user/extension that is allowed to place outbound RingOut calls
- a `RINGCENTRAL_FROM_NUMBER` that is valid for the authenticated extension or acceptable as caller ID

RingCentral SMS has a stricter limitation:
- SMS must be sent from a phone number owned by the authenticated extension.
- The sending number should appear in `/restapi/v1.0/account/~/extension/~/phone-number`.
- The number must include the `SmsSender` feature.
- A super admin cannot send SMS on behalf of other user extensions through this endpoint.

If SmartMoving prompts each user to log into RingCentral, it may be using per-user OAuth rather than one company-wide JWT. Kratos CRM currently diagnoses the configured server-side JWT first.

## Resend Requirements

Resend email requires:
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- verified sender or domain for `EMAIL_FROM_DEFAULT`
- valid `EMAIL_REPLY_TO_DEFAULT`

The diagnostics page does not send email automatically. Use the “Send test email” button to verify the Resend key and sender/domain configuration.

## Stripe Requirements

Stripe diagnostics check:
- secret key presence
- publishable key presence
- webhook secret presence
- a read-only balance API request
- live/test mode from key prefix where possible

Diagnostics never creates payments.

## Portal Requirements

Customer portal diagnostics check:
- `NEXT_PUBLIC_APP_URL`
- `estimate_portal_links` table
- `estimate_signatures` table

Diagnostics does not create portal links automatically.

## Testing Order

1. Open `/admin/settings/integrations`.
2. Confirm environment variables are present.
3. Send a Resend test email.
4. Test portal preview.
5. Test Send Estimate Email.
6. Test RingCentral call after diagnostics confirms auth and `RingOut`.
7. Test SMS only after diagnostics confirms the from number belongs to the authenticated extension and has `SmsSender`.
