// Person record layout, applied to each rendered <tei-person> after CETEIcean has run
// (called from persons.js). Behaviors render each element in place; this file only moves
// things into reading order and fills in what needs data from mss.xml:
//
//   name / variants
//   Born: … · Died: … · Floruit: …   ← birth, death, floruit on one line
//   bio
//   Order: …              (CSS on tei-affiliation)
//   Role: … — role note   (occupation behavior + CSS)
//   BIBLIOGRAPHY
//   Authority files: …    ← tei-idno moved here
//
// Manuscript links (a.ms-link[data-ms]) get their shelfmark label from mss.xml; a link whose
// id is not in mss.xml becomes plain text.

(function () {
  function text(el, sel) {
    return el.querySelector(sel)?.textContent?.trim() || "";
  }

  function datesLine(person) {
    const parts = [
      ["Born",    text(person, ".birth-info")],
      ["Died",    text(person, ".death-info")],
      ["Floruit", text(person, ".floruit-info")]
    ].filter(([, value]) => value);
    if (!parts.length) return null;
    const div = document.createElement("div");
    div.className = "person-dates";
    parts.forEach(([label, value], i) => {
      if (i) div.appendChild(document.createTextNode(" · "));
      const b = document.createElement("span");
      b.className = "person-dates-label";
      b.textContent = `${label}: `;
      div.append(b, value);
    });
    return div;
  }

  function authorityLine(person) {
    const ids = Array.from(person.querySelectorAll(":scope > tei-idno"))
      .filter(idno => idno.querySelector(".authority-link"));
    if (!ids.length) return null;
    const div = document.createElement("div");
    div.className = "person-authority";
    div.appendChild(document.createTextNode("Authority files: "));
    ids.forEach((idno, i) => {
      if (i) div.appendChild(document.createTextNode(" · "));
      div.appendChild(idno);          // already processed, so moving it does not re-render
    });
    return div;
  }

  window.layoutPerson = function (person) {
    const name = person.querySelector(":scope > tei-persName:not([type='sort'])");
    const dates = datesLine(person);
    if (dates && name) name.after(dates);

    const authority = authorityLine(person);
    if (authority) person.appendChild(authority);
  };

  // --- Manuscript labels -------------------------------------------------------------------
  // "Settlement Shelfmark" as on the opera page (e.g. "Basel F III 10"); repository as tooltip.
  function readMsLabels(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    const labels = new Map();
    doc.querySelectorAll("msDesc").forEach(ms => {
      const id = ms.getAttribute("xml:id");
      const ident = ms.querySelector("msIdentifier");
      if (!id || !ident) return;
      const settlement = ident.querySelector("settlement")?.textContent?.trim() || "";
      const repository = ident.querySelector("repository")?.textContent?.trim() || "";
      const idno = Array.from(ident.children).find(c => c.localName === "idno")?.textContent?.trim() || id;
      labels.set(id, { settlement, repository, idno });
    });
    return labels;
  }

  // Replace ids with labels. Within one role group, a link from the same settlement as the
  // previous one shows only the shelfmark: "Basel F III 10, F III 11".
  function applyMsLabels(persons, labels) {
    persons.forEach(person => person.querySelectorAll(".tei-occupation").forEach(line => {
      let prevSettlement = null;
      Array.from(line.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && /;\s*$/.test(node.textContent)) prevSettlement = null;
        if (!(node instanceof HTMLAnchorElement) || !node.dataset.ms) return;
        const ms = labels.get(node.dataset.ms);
        if (!ms) {
          const plain = document.createElement("span");
          plain.className = "ms-unresolved";
          plain.textContent = node.dataset.ms;
          plain.title = "Not in the manuscript catalogue";
          node.replaceWith(plain);
          prevSettlement = null;
          return;
        }
        node.textContent = ms.settlement && ms.settlement === prevSettlement
          ? ms.idno
          : [ms.settlement, ms.idno].filter(Boolean).join(" ");
        if (ms.repository) node.title = `${ms.settlement}, ${ms.repository}, ${ms.idno}`;
        prevSettlement = ms.settlement;
      });
    }));
  }

  // `persons`: the <tei-person> elements (they move between the hidden pool and open rows)
  window.labelPersonManuscripts = function (persons) {
    return fetch("data/mss.xml")
      .then(r => r.text())
      .then(xml => applyMsLabels(persons, readMsLabels(xml)))
      .catch(() => { /* links keep their ids */ });
  };
})();
