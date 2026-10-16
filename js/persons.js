// Persons page: one table row per person; the rendered TEI record is shown
// in the row's detail panel. Table behaviour lives in catalog-table.js.
document.addEventListener("DOMContentLoaded", () => {
	const pool = document.getElementById("person-pool");

	const table = new CatalogTable({
		table: "person-table",
		filter: "person-filter",
		pool,
		label: "persons",
		// Birth and death columns sort by year
		sortValue: (col, text) => (col === 1 || col === 2) ? CatalogTable.year(text) : text
	});

	CETEIcean.getHTML5("data/PersonRegister.xml", function(data) {
		pool.appendChild(data);

		const persons = Array.from(pool.querySelectorAll("tei-person"));
		persons.forEach(layoutPerson);          // js/person-panel.js
		labelPersonManuscripts(persons);        // shelfmarks for the Role: links, async

		persons.forEach(tei => {
			const id = tei.id;
			if (!id) return;

			const name  = tei.querySelector(".name-group-preferred")?.textContent?.trim() || id;
			const birth = tei.querySelector(".birth-info")?.textContent?.trim() || "";
			const death = tei.querySelector(".death-info")?.textContent?.trim() || "";

			table.addRow({ id, tei, cells: [name, birth, death] });
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
