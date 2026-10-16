// Shared by opera.js (counts) and manuscripts.html (per-item link to the opera page), so the
// two pages can never disagree about which items are Versoris's. See docs/opera_catalog.md.
//
// Mirrors the encoding rule in MssVersoris/plan_new_ms.md:
//   opera code + no <author>  =  Versoris's
//   an <author> appears ONLY to say the item is NOT his
// `spuria` marks an ascription to Versoris that has been examined and rejected, at either of
// two levels, and overrides everything:
//   - `subtype="spuria"` on the msDesc's explicit_attribution — the manuscript sits in the
//     source's "Spuria" section, so every opera-coded item in it is rejected (Frankfurt
//     Praed. 111, Mühlhausen 60/19, Oxford Digby 44)
//   - `subtype="spuria"` on an msItem's `note[@type="attribution"]` — the manuscript is an
//     ordinary witness but this one item's ascription is rejected (Colmar 223's four
//     Caulaincourt items, Siena H.VI.7's QsApos, Aarau F 42's QdC fragment)

// The work an msItem is keyed to, or null. Reads the item's DIRECT title only: question-level
// items nest inside work-level ones. `questionID` marks a question, not a work.
function operaCode(item) {
  const ref  = item.querySelector(":scope > tei-title[ref]")?.getAttribute("ref") || "";
  const code = ref.replace(/^#/, "");
  return code && code !== "questionID" ? code : null;
}

const spuriaCache = new WeakMap();
function isSpuria(msDesc) {
  if (!spuriaCache.has(msDesc)) {
    spuriaCache.set(msDesc, !!msDesc.querySelector(
      'tei-ab[type="explicit_attribution"][subtype="spuria"]'));
  }
  return spuriaCache.get(msDesc);
}

function witnessClass(item, msDesc) {
  if (isSpuria(msDesc)) return "rejected";
  if (item.querySelector(':scope > tei-note[type="attribution"][subtype="spuria"]')) return "rejected";
  const a = item.querySelector(":scope > tei-author")?.textContent?.trim();
  if (!a)                    return "versoris";
  if (a === "Anonymus")      return "anonymous";
  return "other";
}
