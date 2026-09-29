# Location pins (supersedes unshipped Google Places implementation)

User requested simpler location recording, no venue lookup. Removed Google Places route, secrets, quota function/log migration and provider result UI before any production activation. No Google billing/key setup required. No AI calls, geocoding, restaurant lookup or map SDK dependency.

Shared location button requests browser geolocation once, high accuracy, 15-second timeout. Captured location previews a small OSM tile map with a marker in a 128px square. Clicking the square opens Google Maps at the coordinates using a public Maps URL (no Maps API or key). Device accuracy is displayed; The displayed area is not a precision guarantee or search radius. Name/memo stays user-entered. Clicking Save persists latitude, longitude and optional accuracy under existing tasting owner RLS. Coordinates are nullable/removable, invalid pairs rejected by DB. Saved locations do not request device GPS again. Saved map remains collapsed until clicked so coordinates are not sent to OSM merely by opening a record.

Apply `20260928_location.sql` only after owner approval, before deploying frontend. Old rows remain null; no old Places migration was applied. Location permission and external-map transfer are explained next to the button. Unmount/removal invalidates late GPS callbacks. No background tracking.

OSM tile display has no API key or metered API integration. Attribution is retained; public community tile service is best-effort and usage-policy bound, not a guaranteed unlimited commercial hosting service. No prefetch or offline tile download. For higher traffic consider a compatible hosted map provider. Official references: https://wiki.openstreetmap.org/wiki/Export and https://operations.osmfoundation.org/policies/tiles/.

Privacy notice addition for review: Location capture is optional. Coordinates and device accuracy are stored with the user's private wine record after Save. The device is queried only when the user requests it. Displaying the map transmits coordinates and normal web request information to OpenStreetMap. Users can remove saved location through Edit and Save. Venue names are entered manually. https://osmfoundation.org/wiki/Privacy_Policy

Validation: pure coordinate/map URL tests, PGlite DB range/pair checks and cross-user isolation. Browser uses an explicitly synthetic Tokyo Station coordinate for visual map verification; actual user GPS permission is not exercised automatically.
