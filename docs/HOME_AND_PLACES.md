# v1.4.5 changes (not deployed)

- Japanese modes: かんたん入力 / 一般入力 / 専門的; Korean: 간단 입력 / 일반 입력 / 전문 입력. Stored mode keys are unchanged.
- Wine type order: red, white, sparkling, rose.
- Blind menu introduction explains hiding the label, observing, revealing and saving.
- Home country/type cards show two most frequent categories with counts. Country aliases are combined. Equal counts share rank, with deterministic key ordering. Missing or legacy sweet types are excluded from the four-type chart rather than guessed. Recent records list remains; only recent-wine summary card is replaced.
- Built-in image generation produced a Japanese promotional flyer in output/marketing. Not published externally.

## Places integration recommendation (research only)
Button-triggered browser geolocation (user permission), followed by one server-side Nearby Search for restaurant/bar/store candidates. User confirms the venue: coordinates do not identify a specific restaurant reliably in dense buildings. Keep manual entry available. No maps service or billing enabled in this change.

2026-09-28 official Google pricing: Nearby Search Pro monthly free cap 5,000, then $32 per 1,000 in the first paid band. Display name/address/Maps URL can be requested in this tier without separate details calls. Hours/ratings require a higher tier. Free cap is shared by billing account usage, not per app member. Billing activation and restricted key required. Example 6,000 monthly calls = $32 before tax, other SKUs excluded. https://developers.google.com/maps/billing-and-pricing/pricing and https://developers.google.com/maps/documentation/places/web-service/nearby-search
