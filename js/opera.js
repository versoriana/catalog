// Opera page: a work-centred index built by inverting the manuscript descriptions.
// For each work in the `versoris_opera` taxonomy (teiHeader of data/mss.xml) we collect
// every msItem title keyed to it (title/@ref="#CODE") and list its distinct witnessing
// manuscripts, each linking into manuscripts.html#<msDesc-id>.
document.addEventListener("DOMContentLoaded", () => {
  const pool        = document.getElementById("Versoris");
  const tableBody   = document.getElementById("opera-table-body");
  const filterInput = document.getElementById("opera-filter");
  const headers     = document.querySelectorAll("#opera-table thead th");
  const COUNT_COL   = 2; // the "# mss" column is sorted numerically
  let currentRow    = null;
  const sortState   = { col: -1, dir: 1 };
  let dataReady     = false;
  let pendingHash   = null;

  function selectEntry(row) {
    if (currentRow === row) {
      currentRow.classList.remove("ms-selected");
      currentRow._detailRow.style.display = "none";
      currentRow = null;
      return;
    }
    if (currentRow) {
      currentRow.classList.remove("ms-selected");
      currentRow._detailRow.style.display = "none";
    }
    row.classList.add("ms-selected");
    row._detailRow.style.display = "";
    currentRow = row;
    row.focus();
    const y = row.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // Re-append every row (and its detail row) in `rows` order, then pin the
  // placeholder "not by Versoris" rows to the bottom regardless of sort.
  function layoutRows(rows) {
    const pinned = Array.from(tableBody.rows).filter(
      r => !r.classList.contains("ms-detail-row") && r.dataset.pinned === "1"
    );
    rows.forEach(row => {
      tableBody.appendChild(row);
      tableBody.appendChild(row._detailRow);
    });
    pinned.forEach(row => {
      tableBody.appendChild(row);
      tableBody.appendChild(row._detailRow);
    });
  }

  function sortTable(colIndex) {
    if (sortState.col === colIndex) {
      sortState.dir *= -1;
    } else {
      sortState.col = colIndex;
      sortState.dir = 1;
    }
    headers.forEach((h, i) => {
      h.classList.remove("sort-asc", "sort-desc");
      if (i === colIndex) h.classList.add(sortState.dir === 1 ? "sort-asc" : "sort-desc");
    });
    const rows = Array.from(tableBody.rows).filter(
      r => !r.classList.contains("ms-detail-row") && r.dataset.pinned !== "1"
    );
    rows.sort((a, b) => {
      const aText = a.cells[colIndex]?.textContent?.trim() || "";
      const bText = b.cells[colIndex]?.textContent?.trim() || "";
      if (colIndex === COUNT_COL) {
        return (parseInt(aText || "0", 10) - parseInt(bText || "0", 10)) * sortState.dir;
      }
      return aText.localeCompare(bText) * sortState.dir;
    });
    layoutRows(rows);
  }

  function navigateToHash(hash) {
    if (!hash) return;
    const id  = decodeURIComponent(hash.substring(1));
    const row = tableBody.querySelector(`tr[data-id="${id}"]`);
    if (row) selectEntry(row);
  }

  window.addEventListener("hashchange", () => {
    if (dataReady) {
      navigateToHash(window.location.hash);
    } else {
      pendingHash = window.location.hash;
    }
  });

  headers.forEach((th, i) => {
    th.addEventListener("click", () => sortTable(i));
  });

  // --- Read the work authority list (taxonomy) ----------------------------
  // Returns an ordered [{code, title}] list. Prefers the CETEIcean-rendered
  // header; falls back to parsing the raw XML if the header is not present.
  function readTaxonomy(renderedPool) {
    const fromDom = Array.from(renderedPool.querySelectorAll("tei-category"))
      .filter(cat => cat.id)
      .map(cat => ({
        code:  cat.id,
        title: cat.querySelector("tei-catDesc")?.textContent?.trim() || cat.id
      }));
    if (fromDom.length) return Promise.resolve(fromDom);

    return fetch("data/mss.xml")
      .then(r => r.text())
      .then(text => {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        return Array.from(doc.querySelectorAll("taxonomy#versoris_opera category, taxonomy[*|id='versoris_opera'] category"))
          .map(cat => ({
            code:  cat.getAttribute("xml:id") || cat.id,
            title: cat.querySelector("catDesc")?.textContent?.trim() || ""
          }))
          .filter(c => c.code);
      })
      .catch(() => []);
  }

  // Human label for a manuscript: "Settlement Shelfmark" (e.g. "Bonn S 67").
  function msLabel(msDesc) {
    const msIdent    = msDesc.querySelector("tei-msIdentifier");
    const settlement = msIdent?.querySelector("tei-settlement")?.textContent?.trim() || "";
    const idno       = msIdent?.querySelector(":scope > tei-idno")?.textContent?.trim() || "";
    const repository = msIdent?.querySelector("tei-repository")?.textContent?.trim() || "";
    const label = [settlement, idno].filter(Boolean).join(" ").trim() || msDesc.id;
    return { label, repository };
  }

  function buildWitnessList(witnesses) {
    const ul = document.createElement("ul");
    ul.className = "opera-witnesses";
    Array.from(witnesses.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach(w => {
        const li = document.createElement("li");
        const a  = document.createElement("a");
        a.href = `manuscripts.html#${encodeURIComponent(w.id)}`;
        if (w.repository) a.title = w.repository;
        a.textContent = w.label;
        li.appendChild(a);
        ul.appendChild(li);
      });
    return ul;
  }

  function addRow({ code, title, witnesses, isNonVersoris }) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.dataset.id = code;
    if (isNonVersoris) {
      tr.classList.add("opera-nonversoris");
      tr.dataset.pinned = "1";
    }

    const displayTitle = isNonVersoris ? "Not by Versoris (placeholder)" : title;
    [displayTitle, code, String(witnesses.size)].forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });

    const detailTr = document.createElement("tr");
    detailTr.className = "ms-detail-row";
    detailTr.style.display = "none";
    const detailTd = document.createElement("td");
    detailTd.colSpan = headers.length;
    detailTd.appendChild(buildWitnessList(witnesses));
    detailTr.appendChild(detailTd);
    tr._detailRow = detailTr;

    tr.addEventListener("click", () => selectEntry(tr));
    tr.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectEntry(tr);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        let next = detailTr.nextElementSibling;
        while (next && (next.classList.contains("ms-detail-row") || next.style.display === "none")) next = next.nextElementSibling;
        if (next) { next.focus(); selectEntry(next); }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        let prev = tr.previousElementSibling;
        while (prev && (prev.classList.contains("ms-detail-row") || prev.style.display === "none")) prev = prev.previousElementSibling;
        if (prev) { prev.focus(); selectEntry(prev); }
      } else if (e.key === "Escape") {
        if (currentRow === tr) selectEntry(tr);
      }
    });

    tableBody.appendChild(tr);
    tableBody.appendChild(detailTr);
  }

  CETEIcean.getHTML5("data/mss.xml", function(data) {
    pool.appendChild(data);

    // Invert title/@ref -> work: collect distinct witnessing manuscripts per code.
    const witnessesByCode = new Map(); // code -> Map<msDescId, {id, label, repository}>
    Array.from(pool.querySelectorAll("tei-title[ref]")).forEach(title => {
      const code   = title.getAttribute("ref").replace(/^#/, "");
      if (!code) return;
      const msDesc = title.closest("tei-msdesc");
      if (!msDesc || !msDesc.id) return;
      if (!witnessesByCode.has(code)) witnessesByCode.set(code, new Map());
      const witnesses = witnessesByCode.get(code);
      if (!witnesses.has(msDesc.id)) {
        const { label, repository } = msLabel(msDesc);
        witnesses.set(msDesc.id, { id: msDesc.id, label, repository });
      }
    });

    readTaxonomy(pool).then(categories => {
      // Canonical works first (only those with at least one witness), sorted by
      // witness count descending; the nonVersoris placeholder is pinned last.
      const works = categories
        .filter(c => c.code !== "nonVersoris" && (witnessesByCode.get(c.code)?.size || 0) > 0)
        .map(c => ({ ...c, witnesses: witnessesByCode.get(c.code) }))
        .sort((a, b) => b.witnesses.size - a.witnesses.size);

      works.forEach(w => addRow({ code: w.code, title: w.title, witnesses: w.witnesses }));

      const nonVersoris = witnessesByCode.get("nonVersoris");
      if (nonVersoris && nonVersoris.size) {
        addRow({ code: "nonVersoris", title: "", witnesses: nonVersoris, isNonVersoris: true });
      }

      // Reflect the default ordering (count desc) in the header indicator.
      sortState.col = COUNT_COL;
      sortState.dir = -1;
      headers[COUNT_COL]?.classList.add("sort-desc");

      filterInput.addEventListener("input", () => {
        const q = filterInput.value.toLowerCase();
        Array.from(tableBody.rows).forEach(row => {
          if (row.classList.contains("ms-detail-row")) return;
          const match = row.textContent.toLowerCase().includes(q);
          row.style.display = match ? "" : "none";
          row._detailRow.style.display = (!match || row !== currentRow) ? "none" : "";
        });
      });

      dataReady = true;
      navigateToHash(pendingHash || window.location.hash);
      pendingHash = null;
    });
  });
});
