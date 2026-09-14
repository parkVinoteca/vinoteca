-- AI 사용량 로그 테이블
create table if not exists ai_usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  feature text not null, -- 'sommelier' or 'label_scan'
  created_at timestamp with time zone default now()
);

alter table ai_usage_logs enable row level security;

create policy "Users can view own usage logs" on ai_usage_logs
  for select using (auth.uid() = user_id);

create policy "Users can insert own usage logs" on ai_usage_logs
  for insert with check (auth.uid() = user_id);
