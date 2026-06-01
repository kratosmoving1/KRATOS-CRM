alter table public.communications
  drop constraint if exists communications_call_outcome_check;

alter table public.communications
  add constraint communications_call_outcome_check
  check (
    call_outcome is null
    or call_outcome in (
      'connected',
      'voicemail',
      'no_answer',
      'wrong_number',
      'busy',
      'pending',
      'left_live_message',
      'number_disconnected'
    )
  );
