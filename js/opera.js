// Opera page: a work-centred index built by inverting the manuscript descriptions.
// For each work in the `versoris_opera` taxonomy (teiHeader of data/mss.xml) we collect
// every msItem title keyed to it (title/@ref="#CODE") and list its distinct witnessing
// manuscripts, each linking into manuscripts.html#<msDesc-id>.
//
// An opera code says WHICH WORK a text is a text of — not that Versoris wrote this copy.
// That is said by the ABSENCE of <author>. So each msItem is classified (see witnessClass)
// and the "# mss" count reports Versoris's own witnesses; anonymous copies, copies by named
// authors and rejected ascriptions are kept visible as "related" rather than counted or
// dropped. See docs/opera_versoris_filter.md.
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
        code:    cat.id,
        title:   cat.querySelector(":scope > tei-catDesc")?.textContent?.trim() || cat.id,
        // @corresp names the umbrella this work belongs to (Parva naturalia, Ars vetus/nova)
        corresp: (cat.getAttribute("corresp") || "").replace(/^#/, "")
      }));
    if (fromDom.length) return Promise.resolve(fromDom);

    return fetch("data/mss.xml")
      .then(r => r.text())
      .then(text => {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        return Array.from(doc.querySelectorAll("taxonomy#versoris_opera category, taxonomy[*|id='versoris_opera'] category"))
          .map(cat => ({
            code:    cat.getAttribute("xml:id") || cat.id,
            title:   cat.querySelector("catDesc")?.textContent?.trim() || "",
            corresp: (cat.getAttribute("corresp") || "").replace(/^#/, "")
          }))
          .filter(c => c.code);
      })
      .catch(() => []);
  }

  // --- Classifying a witness ------------------------------------------------
  // Mirrors the encoding rule in MssVersoris/plan_new_ms.md:
  //   opera code + no <author>  =  Versoris's
  //   an <author> appears ONLY to say the item is NOT his
  // `subtype="spuria"` on the msDesc's explicit_attribution overrides everything: the
  // ascription to Versoris has been examined and rejected (e.g. Frankfurt Praed. 111, whose
  // CsPH item carries no author yet is argued not to be his).
  const spuriaCache = new Map();
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

  const CLASS_LABEL = {
    anonymous:    "anonymous",
    other:        "by another author",
    rejected:     "ascription rejected"
  };

  // Human label for a manuscript: "Settlement Shelfmark" (e.g. "Bonn S 67").
  function msLabel(msDesc) {
    const msIdent    = msDesc.querySelector("tei-msIdentifier");
    const settlement = msIdent?.querySelector("tei-settlement")?.textContent?.trim() || "";
    const idno       = msIdent?.querySelector(":scope > tei-idno")?.textContent?.trim() || "";
    const repository = msIdent?.querySelector("tei-repository")?.textContent?.trim() || "";
    const label = [settlement, idno].filter(Boolean).join(" ").trim() || msDesc.id;
    return { label, repository };
  }

  function witnessItem(w, withClassNote) {
    const li = document.createElement("li");
    const a  = document.createElement("a");
    a.href = `manuscripts.html#${encodeURIComponent(w.id)}`;
    if (w.repository) a.title = w.repository;
    a.textContent = w.label;
    li.appendChild(a);

    const notes = [];
    if (withClassNote) {
      // a ms may hold several items for one work; name every non-Versoris class present
      Object.keys(CLASS_LABEL)
        .filter(c => w.classes.has(c))
        .forEach(c => notes.push(CLASS_LABEL[c]));
    }
    if (w.flags.has("defective")) notes.push("text incomplete or lost");
    if (notes.length) {
      const span = document.createElement("span");
      span.className = "opera-witness-note";
      span.textContent = ` (${notes.join("; ")})`;
      li.appendChild(span);
    }
    return li;
  }

  function witnessGroup(heading, list, withClassNote) {
    const frag = document.createDocumentFragment();
    const h    = document.createElement("p");
    h.className = "opera-witness-heading";
    h.textContent = `${heading} (${list.length})`;
    frag.appendChild(h);
    const ul = document.createElement("ul");
    ul.className = "opera-witnesses";
    list.sort((a, b) => a.label.localeCompare(b.label))
        .forEach(w => ul.appendChild(witnessItem(w, withClassNote)));
    frag.appendChild(ul);
    return frag;
  }

  // Versoris's own witnesses first, then everything else that carries the same opera code.
  // The #nonVersoris placeholder is not a work, so its list is left flat: an authorless item
  // there is a base text (Aristotle, Petrus Hispanus), not a witness to anything of Versoris's.
  function buildWitnessList(witnesses, isNonVersoris) {
    const all  = Array.from(witnesses.values());
    const wrap = document.createElement("div");
    wrap.className = "opera-witness-groups";
    if (isNonVersoris) {
      const ul = document.createElement("ul");
      ul.className = "opera-witnesses";
      all.sort((a, b) => a.label.localeCompare(b.label))
         .forEach(w => ul.appendChild(witnessItem(w, false)));
      wrap.appendChild(ul);
      return wrap;
    }
    const versoris = all.filter(w => w.classes.has("versoris"));
    const related  = all.filter(w => !w.classes.has("versoris"));
    if (versoris.length) wrap.appendChild(witnessGroup("Witnesses", versoris, false));
    if (related.length)  wrap.appendChild(witnessGroup("Related, not by Versoris", related, true));
    return wrap;
  }

  function addRow({ code, title, witnesses, isNonVersoris, members, group, complete }) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.dataset.id = code;
    if (isNonVersoris) {
      tr.classList.add("opera-nonversoris");
      tr.dataset.pinned = "1";
    }
    // Umbrellas sit at the end of the table: their figures are gathered from rows above and
    // would otherwise read as rivals to them.
    if (members) {
      tr.classList.add("opera-umbrella");
      tr.dataset.pinned = "1";
    }

    let displayTitle = isNonVersoris ? "Not by Versoris (placeholder)" : title;
    // An umbrella is a curriculum grouping: its count is rolled up from its members, which keep
    // their own rows. A member says which group it belongs to — invisible in the data before
    // @corresp was added to the taxonomy.
    if (members) {
      displayTitle += ` (${members.length} works: ${members.join(", ")}`;
      displayTitle += complete ? `, complete in ${complete.complete} of ${complete.total})` : ")";
    }
    else if (group) displayTitle += ` (part of ${group})`;
    const nVersoris = isNonVersoris
      ? witnesses.size
      : Array.from(witnesses.values()).filter(w => w.classes.has("versoris")).length;
    const nRelated  = isNonVersoris ? 0 : witnesses.size - nVersoris;
    const countText = nRelated ? `${nVersoris} (+${nRelated})` : String(nVersoris);
    if (!isNonVersoris && nVersoris === 0) tr.classList.add("opera-no-witness");

    [displayTitle, code, countText].forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });

    const detailTr = document.createElement("tr");
    detailTr.className = "ms-detail-row";
    detailTr.style.display = "none";
    const detailTd = document.createElement("td");
    detailTd.colSpan = headers.length;
    detailTd.appendChild(buildWitnessList(witnesses, isNonVersoris));
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

    // Invert title/@ref -> work, classifying each msItem. Iterate msItem (not title) and read
    // its DIRECT title/author: question-level items nest inside work-level ones, so
    // closest() would pick up the wrong element's author.
    // A manuscript can contribute several items for one code — e.g. Kraków BJ cod. 2087 holds
    // both Versoris's QsP and the anonymous Cracovian QsP — so classes accumulate per ms, and
    // a ms counts as a witness if ANY of its items for that code is Versoris's.
    const witnessesByCode = new Map(); // code -> Map<msDescId, {id,label,repository,classes,flags}>
    Array.from(pool.querySelectorAll("tei-msitem")).forEach(item => {
      const title = item.querySelector(":scope > tei-title[ref]");
      if (!title) return;
      const code = title.getAttribute("ref").replace(/^#/, "");
      if (!code || code === "questionID") return;
      const msDesc = item.closest("tei-msdesc");
      if (!msDesc || !msDesc.id) return;

      if (!witnessesByCode.has(code)) witnessesByCode.set(code, new Map());
      const witnesses = witnessesByCode.get(code);
      if (!witnesses.has(msDesc.id)) {
        const { label, repository } = msLabel(msDesc);
        witnesses.set(msDesc.id, {
          id: msDesc.id, label, repository, classes: new Set(), flags: new Set()
        });
      }
      const w = witnesses.get(msDesc.id);
      w.classes.add(witnessClass(item, msDesc));
      if (item.getAttribute("defective") === "true") w.flags.add("defective");
    });

    readTaxonomy(pool).then(categories => {
      // Canonical works first (only those with at least one witness), sorted by
      // witness count descending; the nonVersoris placeholder is pinned last.
      const countVersoris = ws =>
        Array.from(ws.values()).filter(w => w.classes.has("versoris")).length;

      // @corresp on a category names the umbrella it belongs to. Build both directions.
      const membersOf = new Map();   // umbrella -> [member codes]
      const groupOf   = new Map();   // member   -> umbrella title
      const titleOf   = new Map(categories.map(c => [c.code, c.title]));
      categories.filter(c => c.corresp).forEach(c => {
        if (!membersOf.has(c.corresp)) membersOf.set(c.corresp, []);
        membersOf.get(c.corresp).push(c.code);
        groupOf.set(c.code, titleOf.get(c.corresp) || c.corresp);
      });

      // An umbrella code (Parva naturalia, Ars vetus/nova) is used only where a source
      // described the group as an undivided block — one manuscript each. Counting only that
      // would report "Parva naturalia: 1" while its four works are in 33–37 manuscripts. So
      // roll the members up, merging per manuscript so classes and flags survive.
      function rolledUp(code) {
        const own     = witnessesByCode.get(code) || new Map();
        const members = membersOf.get(code);
        if (!members) return own;
        const merged = new Map();
        const absorb = map => map.forEach((w, id) => {
          if (!merged.has(id)) {
            merged.set(id, { ...w, classes: new Set(w.classes), flags: new Set(w.flags) });
          } else {
            w.classes.forEach(c => merged.get(id).classes.add(c));
            w.flags.forEach(f => merged.get(id).flags.add(f));
          }
        });
        members.forEach(m => absorb(witnessesByCode.get(m) || new Map()));
        absorb(own);
        return merged;
      }

      // How many of an umbrella's manuscripts carry ALL its member works. The rolled-up count
      // is a union: one member is enough to be counted, which is fair for Parva naturalia
      // (32 of 37 complete) but generous for the logic groups (Ars vetus: 19 of 34). So the
      // row states both.
      function completeness(code) {
        const members = membersOf.get(code);
        if (!members) return null;
        const maps  = members.map(m => witnessesByCode.get(m) || new Map());
        const union = new Set();
        maps.forEach(mp => mp.forEach((_, id) => union.add(id)));
        let complete = 0;
        union.forEach(id => { if (maps.every(mp => mp.has(id))) complete++; });
        return { complete, total: union.size };
      }

      // A work is listed if it has any witness at all, directly or rolled up.
      const works = categories
        .filter(c => c.code !== "nonVersoris")
        .map(c => ({ ...c, witnesses: rolledUp(c.code) }))
        .filter(c => c.witnesses.size > 0)
        .sort((a, b) => countVersoris(b.witnesses) - countVersoris(a.witnesses)
                     || b.witnesses.size - a.witnesses.size);

      const emit = w => addRow({
        code: w.code, title: w.title, witnesses: w.witnesses,
        members: membersOf.get(w.code), group: groupOf.get(w.code),
        complete: completeness(w.code)
      });
      works.filter(w => !membersOf.has(w.code)).forEach(emit);   // individual works
      works.filter(w =>  membersOf.has(w.code)).forEach(emit);   // then the umbrellas

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
