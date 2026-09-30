# Taste radar proposal — not implemented

Requested 2026-09-29. Keep existing match algorithm; add explicit self-reported preferences without overwriting them when new tastings arrive.

Suggested six axes: body, acidity, tannin, sweetness, aroma intensity, alcohol warmth. The current profile computes the first three and alcohol; tasting records also store sweetness and nose_intensity but these are not yet profile dimensions. The scanned-wine schema needs corresponding numeric dimensions and evidence state. Unknown is not a middle value or zero. These are product choices, not an industry-standard six-axis score. Aroma strength is not liking a particular aroma.

Maintain separate manual, history-derived and blended vectors. In My Page show the blended vector with manual edit mode and reset; after saving a tasting only the derived/blended vectors update. In AI Sommelier overlay the blended preference and target wine. Label model-estimated target features and insufficient data. Distinguish wine types to avoid treating red tannin preferences as sparkling preferences. Offer accessible sliders in addition to draggable vertices.

Initial experimental final score: 40% manual-profile match plus 60% existing record-based match, only when both have sufficient comparable evidence. The 40% term must use the manual vector, not an already blended vector (would double-count history). Missing dimensions omitted; require a minimum evidence threshold. Without either source retain a clearly labelled partial result or no score rather than manufacturing certainty. Do not present score as a probability. Include all personal ratings and preserve negative evidence in the existing algorithm.

Radar drawing, preference edits and arithmetic require no AI calls. New AI target dimensions can be included in the existing analysis request, with modest output growth; usage measurement needed. Never copy model-derived tastes into user-observed tasting fields to train against the model's own output.

Rollout proposal: first a read-only comparison with evidence state and accessibility; then optional manual profile and owner-protected persistence, then 40/60 weighting validated against held-out ratings. Changes to DB, prompts and scoring require dedicated tests. Current PR17 only includes map and flyer changes; this is a proposal, not a shipped feature.

2026-09-29: User accepted overall proposal and authorized wine trials. Existing production trial reveals body prose/number inconsistency; see RADAR_RELIABILITY_20260929.md before implementing graph. Do not treat the four-axis trial as validation of a six-axis feature.
