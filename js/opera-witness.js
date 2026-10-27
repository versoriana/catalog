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

// An msItem's folio range as display text ("ff. 1r–99v"), or "". Reads the item's DIRECT
// locus/locusGrp, for the same reason as operaCode: nested items and colophons carry their own.
// A locusGrp is either a bound/unbound pair (Kraków incunabula: "ff. 129r–204r [1r–76r]") or
// discontinuous ranges ("ff. 114r–159v, 113r–113v"); a locus with no @from may carry prose.
function locusText(item) {
  const range = l => {
    const from = l.getAttribute("from");
    const to   = l.getAttribute("to");
    return from && to ? `${from}–${to}` : from || to || "";
  };
  const locusGrp = item.querySelector(":scope > tei-locusgrp");
  if (locusGrp) {
    const bound   = locusGrp.querySelector('tei-locus[scheme="#bound"]');
    const unbound = locusGrp.querySelector('tei-locus[scheme="#unbound"]');
    if (bound || unbound) {
      let text = "";
      if (bound && range(bound)) text = `${range(bound).includes("–") ? "ff." : "f."} ${range(bound)}`;
      if (unbound && range(unbound)) text += ` [${range(unbound)}]`;
      return text.trim();
    }
    const parts = Array.from(locusGrp.querySelectorAll("tei-locus:not([scheme])")).map(range).filter(Boolean);
    if (!parts.length) return "";
    const prefix = parts.length === 1 && !parts[0].includes("–") ? "f." : "ff.";
    return `${prefix} ${parts.join(", ")}`;
  }
  const locus = item.querySelector(":scope > tei-locus");
  if (!locus) return "";
  const from = locus.getAttribute("from");
  const to   = locus.getAttribute("to");
  if (from && to) return `ff. ${from}–${to}`;
  if (from || to) return `f. ${from || to}`;
  return locus.textContent.trim();
}
