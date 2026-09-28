# Places setup — implementation ready, not enabled

## Scope
All tasting modes share the nearby-place selector. User explicitly presses search and permits browser geolocation. Server authenticates the user before searching within 500m for restaurants, bars, liquor stores and cafes. Eight candidates maximum. User selects the venue. Manual location memo remains separate.

Only place ID is persisted. Google names/addresses/attributions live in component memory and refresh when reopening a saved record (Place Details Pro request). No coordinates are persisted or logged. Responses are no-store. Google Maps and third-party attributions are shown; links use saved place IDs. No photos/reviews/rating requests.

## Activation order (user action/approval needed)
1. Choose dedicated Maps project or existing Search Test project; enable billing and Places API (New). Free usage still requires billing setup. User enters payment details and accepts terms directly.
2. Create an API key restricted to Places API (New), for server-side requests. User saves `GOOGLE_PLACES_API_KEY` in Vercel Preview and Production, not in chat. Do not use browser-referrer restrictions for server requests; Vercel static-egress IP restrictions require separate infrastructure. Never use NEXT_PUBLIC_.
3. Review/approve and publish public Terms and Privacy notices incorporating required Google terms/privacy links. Current repo does not yet contain these public pages; do not enable live feature before this step.
4. Apply `20260928_places.sql` after explicit approval. It adds nullable place ID, private usage logs and a security-definer reservation function with no client write permissions.
5. After setup/legal approval, set `GOOGLE_PLACES_ENABLED=true` and redeploy. Preview first: owner manually grants geolocation; verify one search and one saved-place detail lookup. Real Google calls not tested yet.

## Cost controls
Both searches and detail lookups reserve one request before contacting Google. App-wide cap 4,500 requests per calendar month (America/Los_Angeles); 5 requests/user/minute anti-repeat guard. Failures count conservatively. No retries. Table/role tests verify the limits. They do not control requests made by other apps/projects on the same billing account. Free cap/pricing can change; check Cloud quotas and billing. Stored IDs link to Google Maps even when API lookup fails or quota is exhausted. The map cap is separate from unlimited beta wine AI.

Official policy: https://developers.google.com/maps/documentation/places/web-service/policies
Official pricing: https://developers.google.com/maps/billing-and-pricing/pricing

## Draft notice text — requires owner approval before publication
JA: 「現在地からお店を探す」を使用すると、許可した位置情報を近隣店舗の検索のためGoogle Maps Platformに送信します。Vinotecaは座標をワイン記録に保存せず、選択した店舗の識別子を保存します。店舗情報の表示時にGoogleへ問い合わせます。手入力も利用できます。
KO: 현재 위치에서 가게 찾기를 사용하면 허용한 위치 정보를 주변 가게 검색을 위해 Google Maps Platform에 전송합니다. Vinoteca는 좌표를 와인 기록에 저장하지 않고 선택한 가게 식별자를 저장합니다. 가게 정보를 표시할 때 Google에 조회하며 직접 입력도 가능합니다.
These paragraphs supplement, but do not replace, a complete privacy policy or terms review. Required links: https://maps.google.com/help/terms_maps/ and https://policies.google.com/privacy.
