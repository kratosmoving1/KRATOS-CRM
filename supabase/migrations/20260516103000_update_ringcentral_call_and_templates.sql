-- RingCentral call metadata and communication template defaults

alter table public.communications
  add column if not exists phone_number text,
  add column if not exists status text;

alter table public.communications
  drop constraint if exists communications_call_outcome_check;

alter table public.communications
  add constraint communications_call_outcome_check
  check (
    call_outcome is null
    or call_outcome in ('connected', 'voicemail', 'no_answer', 'wrong_number', 'busy', 'pending')
  );

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  trigger text not null,
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communication_templates
  drop constraint if exists communication_templates_channel_check;

alter table public.communication_templates
  drop constraint if exists communication_templates_trigger_check;

alter table public.communication_templates
  add constraint communication_templates_channel_check
  check (channel in ('sms', 'email', 'call'));

alter table public.communication_templates
  add constraint communication_templates_trigger_check
  check (
    trigger in (
      'no_answer',
      'voicemail',
      'connected',
      'custom',
      'estimate_ready',
      'quote_sent_not_booked',
      'deposit_pending',
      'move_confirmed',
      'day_before_move',
      'job_completed'
    )
  );

create index if not exists idx_communication_templates_channel_trigger
  on public.communication_templates(channel, trigger);

alter table public.communication_templates enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'communication_templates'
      and policyname = 'auth users full access'
  ) then
    create policy "auth users full access"
    on public.communication_templates
    for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'No Answer Follow-Up', 'sms', 'no_answer', null,
'Hi {{customer_first_name}}, this is {{agent_first_name}} from Kratos Moving. I tried reaching you regarding your move. Please call us back at {{company_phone}} or reply here when you have a moment.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'no_answer' and name = 'No Answer Follow-Up'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Voicemail Follow-Up', 'sms', 'voicemail', null,
'Hi {{customer_first_name}}, this is {{agent_first_name}} from Kratos Moving. I just left you a voicemail regarding your move. You can call us back at {{company_phone}} or reply here directly.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'voicemail' and name = 'Voicemail Follow-Up'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Estimate Ready', 'sms', 'estimate_ready', null,
'Hi {{customer_first_name}}, your Kratos Moving estimate is ready. You can review it here: {{estimate_link}}. Let us know if you have any questions.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'estimate_ready' and name = 'Estimate Ready'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Booking Follow-Up', 'sms', 'quote_sent_not_booked', null,
'Hi {{customer_first_name}}, this is {{agent_first_name}} from Kratos Moving. I wanted to follow up on your moving estimate. If you are ready, we can help secure your move date.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'quote_sent_not_booked' and name = 'Booking Follow-Up'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Deposit Reminder', 'sms', 'deposit_pending', null,
'Hi {{customer_first_name}}, this is a reminder that your move with Kratos Moving is not fully secured until the deposit is completed. Please contact us at {{company_phone}} if you need help.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'deposit_pending' and name = 'Deposit Reminder'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Move Confirmation', 'sms', 'move_confirmed', null,
'Hi {{customer_first_name}}, your move with Kratos Moving is confirmed for {{move_date}}. Our team will contact you if any further details are required.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'move_confirmed' and name = 'Move Confirmation'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Day Before Move Reminder', 'sms', 'day_before_move', null,
'Hi {{customer_first_name}}, this is a reminder that your Kratos Moving service is scheduled for {{move_date}}. Please make sure parking/elevator arrangements are ready if applicable.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'day_before_move' and name = 'Day Before Move Reminder'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Review Request', 'sms', 'job_completed', null,
'Hi {{customer_first_name}}, thank you for choosing Kratos Moving. If our team delivered the service as promised, we would appreciate your review. Your feedback helps our movers and company grow.', true
where not exists (
  select 1 from public.communication_templates where channel = 'sms' and trigger = 'job_completed' and name = 'Review Request'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'No Answer Email', 'email', 'no_answer', 'Following up on your move',
'Hi {{customer_first_name}},

I tried reaching you regarding your upcoming move. Please call us back at {{company_phone}} or reply to this email when you have a moment.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.', true
where not exists (
  select 1 from public.communication_templates where channel = 'email' and trigger = 'no_answer' and name = 'No Answer Email'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Estimate Ready Email', 'email', 'estimate_ready', 'Your Kratos Moving estimate is ready',
'Hi {{customer_first_name}},

Your Kratos Moving estimate is ready for review.

You can view your estimate here:
{{estimate_link}}

If you have any questions or would like to secure your move date, please reply to this email or call us at {{company_phone}}.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.', true
where not exists (
  select 1 from public.communication_templates where channel = 'email' and trigger = 'estimate_ready' and name = 'Estimate Ready Email'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Booking Follow-Up Email', 'email', 'quote_sent_not_booked', 'Following up on your moving estimate',
'Hi {{customer_first_name}},

I wanted to follow up on your moving estimate with Kratos Moving.

If you are ready to proceed, we can help secure your move date and confirm the next steps.

Please reply to this email or call us at {{company_phone}}.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.', true
where not exists (
  select 1 from public.communication_templates where channel = 'email' and trigger = 'quote_sent_not_booked' and name = 'Booking Follow-Up Email'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Deposit Reminder Email', 'email', 'deposit_pending', 'Deposit required to secure your move',
'Hi {{customer_first_name}},

This is a reminder that your move date is not fully secured until the deposit is completed.

Please contact us at {{company_phone}} if you need assistance completing the deposit.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.', true
where not exists (
  select 1 from public.communication_templates where channel = 'email' and trigger = 'deposit_pending' and name = 'Deposit Reminder Email'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Move Confirmation Email', 'email', 'move_confirmed', 'Your move with Kratos Moving is confirmed',
'Hi {{customer_first_name}},

Your move with Kratos Moving is confirmed for {{move_date}}.

Please ensure that parking, elevator bookings, and access arrangements are ready where applicable.

If anything changes, please contact us as soon as possible at {{company_phone}}.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.', true
where not exists (
  select 1 from public.communication_templates where channel = 'email' and trigger = 'move_confirmed' and name = 'Move Confirmation Email'
);

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Review Request Email', 'email', 'job_completed', 'Thank you for choosing Kratos Moving',
'Hi {{customer_first_name}},

Thank you for choosing Kratos Moving.

If our team delivered the service as promised, we would greatly appreciate your review. Your feedback helps recognize our movers and helps future customers choose Kratos with confidence.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.', true
where not exists (
  select 1 from public.communication_templates where channel = 'email' and trigger = 'job_completed' and name = 'Review Request Email'
);
