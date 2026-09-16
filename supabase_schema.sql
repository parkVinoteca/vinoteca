-- blind_sessions 테이블
create table blind_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  wine_count int not null default 1,
  status text check (status in ('active', 'completed')) default 'active',
  created_at timestamp with time zone default now()
);

-- tastings 테이블
create table tastings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  mode text check (mode in ('normal', 'blind')) default 'normal',
  blind_session_id uuid references blind_sessions(id) on delete set null,
  blind_wine_number int,
  wine_name text,
  producer text,
  vintage int,
  region text,
  country text,
  grape_variety text,
  wine_type text check (wine_type in ('white', 'red', 'rose', 'sparkling', 'sweet')),
  label_image_url text,
  color_hue text,
  color_depth text,
  clarity text,
  viscosity text,
  nose_intensity text,
  nose_condition text,
  aromas text[],
  sweetness text,
  acidity text,
  tannin text,
  tannin_texture text,
  alcohol text,
  body text,
  flavor_intensity text,
  finish text,
  blic_balance int,
  blic_length int,
  blic_intensity int,
  blic_complexity int,
  quality text,
  readiness text,
  deduction_type text,
  deduction_climate text,
  deduction_grape text,
  deduction_region text,
  deduction_vintage_range text,
  deduction_price_range text,
  deduction_notes text,
  answer_producer text,
  answer_wine text,
  score int,
  stars int,
  palate_notes text,
  notes text,
  food_pairing text[],
  ws_score int,
  wa_score int,
  js_score int,
  language text default 'ja',
  created_at timestamp with time zone default now()
);

-- RLS 활성화
alter table tastings enable row level security;
alter table blind_sessions enable row level security;

-- 본인 데이터만 접근 가능
create policy "Users can manage own tastings" on tastings
  for all using (auth.uid() = user_id);

create policy "Users can manage own sessions" on blind_sessions
  for all using (auth.uid() = user_id);

-- Storage 버킷
insert into storage.buckets (id, name, public) values ('label-images', 'label-images', false);

create policy "Users can upload label images" on storage.objects
  for insert with check (bucket_id = 'label-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own label images" on storage.objects
  for select to authenticated using (bucket_id = 'label-images' and auth.uid()::text = (storage.foldername(name))[1]);
