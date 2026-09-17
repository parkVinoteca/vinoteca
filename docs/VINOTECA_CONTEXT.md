# Vinoteca 제품과 개발 맥락

갱신: 2026-09-17. 최초 점검 기록은 INITIAL_AUDIT.md에 보존하며, 그 문서의 결함 목록은 수정 전 상태다.
저장소: https://github.com/parkVinoteca/vinoteca
운영: https://vinoteca-bice.vercel.app

## 제품과 작업 원칙

일본 중심의 와인 애호가용 개인 기록·AI 소믈리에. 한국어/일본어, 모바일 우선, 네이비/골드, Cormorant Garamond/Noto Sans JP를 유지한다. 웹/PWA 안정화가 우선이며 유료화와 네이티브 앱은 이후 단계다.
사용자는 최초 점검에 따른 필요한 개선 전체의 자율 진행을 승인했다. 로그인과 비밀값 입력은 직접 한다. 브라우저는 Codex 내부 브라우저를 사용하고 불가능할 때만 Chrome을 사용한다. 비밀값은 출력하지 않는다.

## 현재 구현

- Next.js 15.5.24, React 19.3.0, Node 24, TypeScript, Tailwind 3.4.19. 보안 수정 버전으로 갱신했다.
- page.tsx 상태로 홈/테이스팅/블라인드/셀러/소믈리에를 전환한다.
- Supabase 이메일/Google 인증, 비밀번호 재설정, 언어 유지와 친화적 오류 안내.
- 일반 라벨은 /api/label → Gemini gemini-3.5-flash-lite, 소믈리에는 /api/sommelier → Claude claude-sonnet-5 + 웹 검색(최대 3회).
- AI는 사용자 검증, 이미지 크기/형식 검사, DB 사용량 예약, 시간 제한, 응답 검증 후 표시한다. 웹 검색 결과에 없는 가격/블렌딩 출처는 제거한다.
- 취향 점수는 TypeScript로 계산. 일본어/한국어 척도를 같은 값으로 정규화하고 미입력값을 제외한다. 동일 와인 타입과 높은 평점 기록을 기준으로 비교한다. 기존 제품 조건인 레드 10개·화이트 10개 충족 조건은 유지한다.
- 미각 메모 저장/상세 표시, 전체 기록 기반 통계, 블라인드 저장 후 초기화 및 재개, 중복 저장 방어.
- 사진은 사용자 크롭 후 1024px JPEG로 압축하여 비공개 Storage에 저장. 사용자 소유 경로와 1시간 서명 URL 사용.
- PWA 아이콘·오프라인 안내. API/사진/개인 기록을 서비스워커에 캐시하지 않는다.
- Node 테스트 + PGlite DB 검증, ESLint, typecheck, GitHub Actions 추가.

## 실제 관리 화면에서 확인한 설정

- Vercel Hobby, GitHub main 연동. Supabase Free Tokyo 프로젝트.
- Production/Preview에 Supabase 공개 연결 변수, ANTHROPIC_API_KEY, 사용자가 직접 저장한 GEMINI_API_KEY 존재 확인. 값은 읽지 않았다.
- 기존 NEXT_PUBLIC_GEMINI_API_KEY 변수는 남아 있으나 새 코드에서 사용하지 않는다. 과거 공개된 키의 폐기·재발급 여부는 확인하지 못했다.
- 운영 DB migration `supabase/migrations/20260916_reliability.sql` 적용 완료. 읽기 검증: palate_notes=true, quota 함수=true, anon 함수 실행=false, 클라이언트 사용량 로그 insert=false, 이미지 public=false.
- OAuth 관리 설정 변경 없음. 실제 Google 로그인과 비밀번호 재설정 이메일 전달은 아직 종단 검증하지 않았다.

## 비용 보호와 데이터 보호

일본 시간 기준: 사용자별 소믈리에 20/일·100/월, 라벨 50/일·300/월. 전체 프로젝트 월 소믈리에 500·라벨 2000. 호출 간 10초. 실패한 외부 호출도 예약에 포함. 실제 금액 상한은 제공사별 설정으로 별도 관리한다.
RLS 소유자 검사, 블라인드 세션 소유권 검사, 세션/와인 번호 중복 방지, 비공개 이미지. service_role 없이 동작한다.

## 개발과 남은 검증

Node 24 환경에서 npm ci → typecheck/lint/test/build. 키 없이 테스트 및 빌드 가능. 실제 실행에는 개발용 Supabase 연결 설정 필요. README와 .env.example 참고.
이 Mac은 시스템 개발 도구 대신 Codex 번들 Node/Git/Python을 사용했다. 로컬 저장소 `/Users/gaon/Documents/vinoteca`.
로컬 브라우저 검증에는 127.0.0.1:4511의 메모리 DB 모형을 사용했으며 운영 고객 데이터를 변경하지 않았다.
실제 사진으로 두 AI 제공사의 응답 성공, Google OAuth, 복구 메일 전달, iOS/Android 설치 동작은 별도 실제 기기/계정 검증이 남아 있다.
사진을 올리고 기록을 취소하면 미사용 파일이 남을 수 있다. 셀러의 대량 사진 서명 요청과 통계 전건 조회는 데이터가 커질 때 페이지별 조회/집계로 개선할 과제다.


## 2026-09-17 분석 실패 및 크롭 후속 개선

실제 운영 재현: Gemini HTTP 429(제공사 사용량 제한), Claude 응답 수신 후 invalid_ai_result. 키/사진/제공사 원문을 노출하지 않는 오류 분류를 먼저 배포했다. 429 오류 메시지에 billing 안내가 포함돼도 결제 오류로 오인하지 않도록 상태 코드 우선 분류한다.
라벨 모델은 단순 문서·이미지 추출용 gemini-3.5-flash-lite로 변경하고 JSON 응답 스키마를 지정한다. 실제 프로젝트 할당량은 별도 검증이 필요하며 모델 변경만으로 한도 복구를 보장하지 않는다.
소믈리에는 검색 전 설명과 최종 JSON을 연결하던 처리를 제거하고 최종 텍스트 블록에서 따옴표/중괄호를 고려해 JSON 하나만 읽는다. 출처 검증은 유지한다.
크롭 슬라이더 제거, 44px 모서리 조작점·영역 이동·키보드 지원. 브라우저 내 명도/연결 영역 분석으로 밝은 종이 라벨 후보를 추천한다. OCR이나 실시간 추적은 아니며 확신이 없으면 원본 전체를 제안한다. 외부 호출/비용/의존성 추가 없음. 같은 사진 취소 후 다시 선택할 수 있도록 파일 입력값을 초기화한다.
