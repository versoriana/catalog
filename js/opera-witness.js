// Shared by opera.js (counts) and manuscripts.html (per-item link to the opera page), so the
// two pages can never disagree about which items are Versoris's. See docs/opera_catalog.md.
//
// Mirrors the encoding rule in MssVersoris/plan_new_ms.md:
//   opera code + no <author>  =  Versoris's
//   an <author> appears ONLY to say the item is NOT his
// `subtype="spuria"` on the msDesc's explicit_attribution overrides everything: the
// ascription to Versoris has been examined and rejected (e.g. Frankfurt Praed. 111, whose
// CsPH item carries no author yet is argued not to be his).

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
  const a = item.querySelector(":scope > tei-author")?.textContent?.trim();
  if (!a)                    return "versoris";
  if (a === "Anonymus")      return "anonymous";
  return "other";
}
