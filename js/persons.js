document.addEventListener("DOMContentLoaded", () => {
	const pool        = document.getElementById("person-pool");
	const tableBody   = document.getElementById("person-table-body");
	const filterInput = document.getElementById("person-filter");
	const headers     = document.querySelectorAll("#person-table thead th");
	let currentRow    = null;
	const sortState   = { col: -1, dir: 1 };
	let dataReady     = false;
	let pendingHash   = null;

	function selectEntry(row) {
		if (currentRow === row) {
			pool.appendChild(currentRow._teiElement);
			currentRow.classList.remove("ms-selected");
			currentRow._detailRow.style.display = "none";
			currentRow = null;
			return;
		}
		if (currentRow) {
			pool.appendChild(currentRow._teiElement);
			currentRow.classList.remove("ms-selected");
			currentRow._detailRow.style.display = "none";
		}
		row.classList.add("ms-selected");
		row._detailCell.appendChild(row._teiElement);
		row._detailRow.style.display = "";
		currentRow = row;
		row.focus();
		const y = row.getBoundingClientRect().top + window.scrollY - 80;
		window.scrollTo({ top: y, behavior: "smooth" });
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
		const rows = Array.from(tableBody.rows).filter(r => !r.classList.contains("ms-detail-row"));
		rows.sort((a, b) => {
			const aText = a.cells[colIndex]?.textContent?.trim() || "";
			const bText = b.cells[colIndex]?.textContent?.trim() || "";
			if (colIndex === 1 || colIndex === 2) {
				const aYear = parseInt(aText.match(/\d{4}/)?.[0] ?? "9999");
				const bYear = parseInt(bText.match(/\d{4}/)?.[0] ?? "9999");
				return (aYear - bYear) * sortState.dir;
			}
			return aText.localeCompare(bText) * sortState.dir;
		});
		rows.forEach(row => {
			tableBody.appendChild(row);
			tableBody.appendChild(row._detailRow);
		});
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

	headers.forEach((th, i) => th.addEventListener("click", () => sortTable(i)));

	CETEIcean.getHTML5("data/PersonRegister.xml", function(data) {
		pool.appendChild(data);

		Array.from(pool.querySelectorAll("tei-person")).forEach(tei => {
			const id = tei.id;
			if (!id) return;

			const name  = tei.querySelector(".name-group-preferred")?.textContent?.trim() || id;
			const birth = tei.querySelector(".birth-info")?.textContent?.trim() || "";
			const death = tei.querySelector(".death-info")?.textContent?.trim() || "";

			const tr = document.createElement("tr");
			tr.tabIndex = 0;
			tr.dataset.id = id;
			tr._teiElement = tei;

			[name, birth, death].forEach(text => {
				const td = document.createElement("td");
				td.textContent = text;
				tr.appendChild(td);
			});

			const detailTr = document.createElement("tr");
			detailTr.className = "ms-detail-row";
			detailTr.style.display = "none";
			const detailTd = document.createElement("td");
			detailTd.colSpan = 3;
			detailTr.appendChild(detailTd);
			tr._detailRow = detailTr;
			tr._detailCell = detailTd;

			tr.addEventListener("click", () => selectEntry(tr));
			tr.addEventListener("keydown", e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault(); selectEntry(tr);
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
		});

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

		if (window.textHighlighter) {
			const highlightTerms = new URLSearchParams(window.location.search).get("highlight");
			if (highlightTerms) {
				setTimeout(() => window.textHighlighter.highlightSearchTerms(highlightTerms), 200);
			}
		}
	});
});