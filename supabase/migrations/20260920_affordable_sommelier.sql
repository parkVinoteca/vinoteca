-- Paid subscription includes 20 sommelier requests per Japanese calendar month.
-- Free tier, existing usage history, global safety limits and RLS remain unchanged.
begin;
update public.subscription_limits
set sommelier_monthly_limit = 20
where plan = 'paid';
commit;
