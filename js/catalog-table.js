// Shared behaviour for the index tables (manuscripts, persons, opera):
// expandable detail rows, column sorting, text filter with a live count,
// keyboard navigation and #id deep links.
//
// Usage:
//   const table = new CatalogTable({ table: "ms-table", filter: "ms-filter", pool: poolEl,
//                                    sortValue: (col, text) => ... });
//   table.addRow({ id, cells: [...], tei: element });        // detail = TEI element, moved in/out of pool
//   table.addRow({ id, cells: [...], detail: node });        // detail = static node
//   table.ready({ sortCol, sortDir });                       // after all rows are added
//
// Rows with `pinned: true` stay at the bottom regardless of sort order, and empty
// values (sortValue returning null or "") sort last in both directions.

(function () {
  function CatalogTable(opts) {
    this.table     = document.getElementById(opts.table);
    this.tbody     = this.table.tBodies[0];
    this.headers   = Array.from(this.table.tHead.rows[0].cells);
    this.filter    = opts.filter ? document.getElementById(opts.filter) : null;
    this.pool      = opts.pool || null;
    this.sortValue = opts.sortValue || ((col, text) => text);
    this.label     = opts.label || "entries";
    this.current   = null;
    this.sort      = { col: -1, dir: 1 };
    this.isReady   = false;
    this.pendingHash = null;

    this._setupHeaders();
    this._setupFilterCount();

    window.addEventListener("hashchange", () => {
      if (this.isReady) this.navigateToHash(window.location.hash);
      else this.pendingHash = window.location.hash;
    });
  }

  CatalogTable.prototype._setupHeaders = function () {
    this.headers.forEach((th, i) => {
      th.scope = "col";
      th.tabIndex = 0;
      th.setAttribute("aria-sort", "none");
      th.addEventListener("click", () => this.sortBy(i));
      th.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.sortBy(i); }
      });
    });
  };

  CatalogTable.prototype._setupFilterCount = function () {
    if (!this.filter) return;
    this.countEl = document.createElement("span");
    this.countEl.className = "filter-count";
    this.countEl.setAttribute("aria-live", "polite");
    const bar = this.filter.closest(".filter-bar");
    (bar || this.filter.parentNode).appendChild(this.countEl);
  };

  CatalogTable.prototype._entryRows = function () {
    return Array.from(this.tbody.rows).filter(r => !r.classList.contains("ms-detail-row"));
  };

  CatalogTable.prototype.addRow = function ({ id, cells, tei, detail, classes, pinned }) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.dataset.id = id;
    tr.setAttribute("aria-expanded", "false");
    if (classes) classes.forEach(c => tr.classList.add(c));
    if (pinned) tr.dataset.pinned = "1";

    cells.forEach(content => {
      const td = document.createElement("td");
      if (content instanceof Node) td.appendChild(content);
      else td.textContent = content;
      tr.appendChild(td);
    });

    const detailTr = document.createElement("tr");
    detailTr.className = "ms-detail-row";
    detailTr.style.display = "none";
    const detailTd = document.createElement("td");
    detailTd.colSpan = this.headers.length;
    if (detail) detailTd.appendChild(detail);
    detailTr.appendChild(detailTd);

    tr._detailRow  = detailTr;
    tr._detailCell = detailTd;
    tr._teiElement = tei || null;

    tr.addEventListener("click", () => this.select(tr));
    tr.addEventListener("keydown", e => this._onRowKey(e, tr));

    this.tbody.appendChild(tr);
    this.tbody.appendChild(detailTr);
    return tr;
  };

  CatalogTable.prototype._close = function (row) {
    if (this.pool && row._teiElement) this.pool.appendChild(row._teiElement);
    row.classList.remove("ms-selected");
    row.setAttribute("aria-expanded", "false");
    row._detailRow.style.display = "none";
  };

  CatalogTable.prototype.select = function (row) {
    if (this.current === row) {
      this._close(row);
      this.current = null;
      return;
    }
    if (this.current) this._close(this.current);
    row.classList.add("ms-selected");
    row.setAttribute("aria-expanded", "true");
    if (row._teiElement) row._detailCell.appendChild(row._teiElement);
    row._detailRow.style.display = "";
    this.current = row;
    row.focus();
    const y = row.getBoundingClientRect().top + window.scrollY - 80;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

  CatalogTable.prototype._visibleSibling = function (start, forward) {
    let el = start;
    while (el && (el.classList.contains("ms-detail-row") || el.style.display === "none")) {
      el = forward ? el.nextElementSibling : el.previousElementSibling;
    }
    return el;
  };

  CatalogTable.prototype._onRowKey = function (e, tr) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.select(tr);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = this._visibleSibling(tr._detailRow.nextElementSibling, true);
      if (next) { next.focus(); this.select(next); }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = this._visibleSibling(tr.previousElementSibling, false);
      if (prev) { prev.focus(); this.select(prev); }
    } else if (e.key === "Escape") {
      if (this.current === tr) this.select(tr);
    }
  };

  CatalogTable.prototype._markSort = function () {
    this.headers.forEach((h, i) => {
      h.classList.remove("sort-asc", "sort-desc");
      h.setAttribute("aria-sort", "none");
      if (i === this.sort.col) {
        h.classList.add(this.sort.dir === 1 ? "sort-asc" : "sort-desc");
        h.setAttribute("aria-sort", this.sort.dir === 1 ? "ascending" : "descending");
      }
    });
  };

  CatalogTable.prototype.sortBy = function (col) {
    if (this.sort.col === col) this.sort.dir *= -1;
    else { this.sort.col = col; this.sort.dir = 1; }
    this._markSort();

    const entries = this._entryRows();
    const pinned  = entries.filter(r => r.dataset.pinned === "1");
    const rows    = entries.filter(r => r.dataset.pinned !== "1");
    rows.sort((a, b) => {
      const av = this.sortValue(col, a.cells[col]?.textContent?.trim() || "");
      const bv = this.sortValue(col, b.cells[col]?.textContent?.trim() || "");
      // Empty values (undated, unknown origin…) always go last, whichever the direction
      const aEmpty = av === null || av === "", bEmpty = bv === null || bv === "";
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : (aEmpty ? 1 : -1);
      const cmp = (typeof av === "number" && typeof bv === "number") ? av - bv : String(av).localeCompare(String(bv));
      return cmp * this.sort.dir;
    });
    rows.concat(pinned).forEach(row => {
      this.tbody.appendChild(row);
      this.tbody.appendChild(row._detailRow);
    });
  };

  CatalogTable.prototype.applyFilter = function () {
    const q = this.filter ? this.filter.value.toLowerCase() : "";
    let shown = 0;
    const entries = this._entryRows();
    entries.forEach(row => {
      const match = row.textContent.toLowerCase().includes(q);
      row.style.display = match ? "" : "none";
      row._detailRow.style.display = (!match || row !== this.current) ? "none" : "";
      if (match) shown++;
    });
    if (this.countEl) {
      this.countEl.textContent = q
        ? `${shown} of ${entries.length} ${this.label}`
        : `${entries.length} ${this.label}`;
    }
  };

  CatalogTable.prototype.navigateToHash = function (hash) {
    if (!hash) return;
    const id  = decodeURIComponent(hash.substring(1));
    const row = this.tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (row) this.select(row);
  };

  // Call once all rows are added. Optionally reflect a default ordering in the headers.
  CatalogTable.prototype.ready = function ({ sortCol, sortDir } = {}) {
    if (sortCol !== undefined) {
      this.sort = { col: sortCol, dir: sortDir || 1 };
      this._markSort();
    }
    if (this.filter) this.filter.addEventListener("input", () => this.applyFilter());
    this.applyFilter();
    this.isReady = true;
    this.navigateToHash(this.pendingHash || window.location.hash);
    this.pendingHash = null;
  };

  // Year sort helper shared by the date columns: first four-digit number, or null if undated.
  CatalogTable.year = text => {
    const m = text.match(/\d{4}/);
    return m ? parseInt(m[0], 10) : null;
  };

  window.CatalogTable = CatalogTable;
})();
