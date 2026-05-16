-- Keep estimate deposits aligned with the Kratos default.

alter table public.opportunities
  alter column deposit_amount set default 150.00;

update public.opportunities
set deposit_amount = 150.00
where deposit_amount is null;
