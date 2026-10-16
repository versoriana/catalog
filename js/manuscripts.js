// Manuscripts page: one table row per msDesc; the rendered TEI description
// is shown in the row's detail panel. Table behaviour lives in catalog-table.js.
document.addEventListener("DOMContentLoaded", () => {
  const pool     = document.getElementById("Versoris");
  const DATE_COL = 3;

  const table = new CatalogTable({
    table: "ms-table",
    filter: "ms-filter",
    pool,
    label: "manuscripts",
    sortValue: (col, text) => col === DATE_COL ? CatalogTable.year(text) : text
  });

  CETEIcean.getHTML5("data/mss.xml", function(data) {
    pool.appendChild(data);

    Array.from(pool.querySelectorAll("tei-msdesc")).forEach(tei => {
      const id = tei.id;
      if (!id) return;

      const msIdent    = tei.querySelector("tei-msIdentifier");
      const settlement = msIdent?.querySelector("tei-settlement")?.textContent?.trim() || "";
      const repository = msIdent?.querySelector("tei-repository")?.textContent?.trim() || "";
      const idno       = msIdent?.querySelector(":scope > tei-idno")?.textContent?.trim() || id;
      const origDateEl = tei.querySelector(".origDate-info");
      const origDate   = origDateEl?.dataset?.short || origDateEl?.textContent?.trim() || "";
      const origPlace  = tei.querySelector("tei-origPlace")?.textContent?.trim() || "";
      const attrEl     = tei.querySelector('tei-ab[type="explicit_attribution"]');
      const attributed = attrEl ? (attrEl.getAttribute('cert') === '1' ? 'Yes' : 'No') : '';

      const shelfmark = document.createElement("span");
      shelfmark.className = "shelfmark";
      shelfmark.textContent = idno;

      table.addRow({ id, tei, cells: [settlement, repository, shelfmark, origDate, origPlace, attributed] });
    });

    table.ready();

    if (window.textHighlighter) {
      const highlightTerms = new URLSearchParams(window.location.search).get("highlight");
      if (highlightTerms) {
        setTimeout(() => window.textHighlighter.highlightSearchTerms(highlightTerms), 200);
      }
    }
  });
});
