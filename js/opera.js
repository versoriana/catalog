// Opera page: a work-centred index built by inverting the manuscript descriptions.
// For each work in the `versoris_opera` taxonomy (teiHeader of data/mss.xml) we collect
// every msItem title keyed to it (title/@ref="#CODE") and list its distinct witnessing
// manuscripts, each linking into manuscripts.html#<msDesc-id>.
//
// An opera code says WHICH WORK a text is a text of — not that Versoris wrote this copy.
// That is said by the ABSENCE of <author>. So each msItem is classified (see witnessClass)
// and the "# mss" count reports Versoris's own witnesses; anonymous copies, copies by named
// authors and rejected ascriptions are kept visible as "related" rather than counted or
// dropped. See docs/opera_catalog.md.
document.addEventListener("DOMContentLoaded", () => {
  const pool      = document.getElementById("Versoris");
  const COUNT_COL = 2; // the "# mss" column is sorted numerically

  // Table behaviour (expand, sort, filter, keyboard, #hash) lives in catalog-table.js.
  // Placeholder and umbrella rows are pinned to the bottom regardless of sort.
  const table = new CatalogTable({
    table: "opera-table",
    filter: "opera-filter",
    label: "works",
    sortValue: (col, text) => col === COUNT_COL ? parseInt(text || "0", 10) : text
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
  // operaCode / witnessClass live in js/opera-witness.js, shared with manuscripts.html.
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
    const classes = [];
    if (isNonVersoris) classes.push("opera-nonversoris");
    // Umbrellas sit at the end of the table: their figures are gathered from rows above and
    // would otherwise read as rivals to them.
    if (members) classes.push("opera-umbrella");

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
    if (!isNonVersoris && nVersoris === 0) classes.push("opera-no-witness");

    // "# mss": Versoris's own witnesses; related copies (not his) follow as a muted "(+n)"
    const count = document.createElement("span");
    count.className = "opera-count";
    count.textContent = String(nVersoris);
    if (nRelated) {
      const extra = document.createElement("span");
      extra.className = "opera-related";
      extra.title = `${nRelated} related manuscripts not by Versoris`;
      extra.textContent = `(+${nRelated})`;
      count.append(" ", extra);
    }

    const codeEl = document.createElement("code");
    codeEl.className = "opera-code";
    codeEl.textContent = code;

    table.addRow({
      id: code,
      cells: [displayTitle, codeEl, count],
      detail: buildWitnessList(witnesses, isNonVersoris),
      classes,
      pinned: isNonVersoris || !!members
    });
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
      const code = operaCode(item);
      if (!code) return;
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

      // Rows were emitted in count-descending order; reflect that in the header indicator.
      table.ready({ sortCol: COUNT_COL, sortDir: -1 });
    });
  });
});
