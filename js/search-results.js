class SearchResultsPage {
	constructor() {
		this.currentResults = [];
		this.currentQuery = '';
		this.basePath = window.versorisSearch ? window.versorisSearch.basePath :
			window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
		this.setupEventHandlers();
		this.loadResults();
	}

	setupEventHandlers() {
		document.getElementById('advanced-search-form').addEventListener('submit', (e) => {
			e.preventDefault();
			this.performNewSearch();
		});

		document.getElementById('clear-search').addEventListener('click', () => {
			this.clearSearch();
		});

		document.querySelectorAll('input[name="filter-type"]').forEach(input => {
			input.addEventListener('change', () => this.applyFilters());
		});

		const urlParams = new URLSearchParams(window.location.search);
		const query = urlParams.get('q');
		if (query) {
			document.getElementById('main-search-input').value = query;
			document.getElementById('search-input').value = query;
		}
	}

	loadResults() {
		const storedResults = sessionStorage.getItem('searchResults');
		if (storedResults) {
			const data = JSON.parse(storedResults);
			if (Date.now() - data.timestamp < 60000) {
				this.displayResults(data.results, data.query);
				return;
			}
		}

		const urlParams = new URLSearchParams(window.location.search);
		const query = urlParams.get('q');
		if (query && window.versorisSearch && window.versorisSearch.isInitialized) {
			this.performSearch(query);
		} else if (query) {
			const checkInit = setInterval(() => {
				if (window.versorisSearch && window.versorisSearch.isInitialized) {
					clearInterval(checkInit);
					this.performSearch(query);
				}
			}, 100);
		}
	}

	performNewSearch() {
		const query = document.getElementById('main-search-input').value.trim();
		if (!query) return;

		const searchType = document.getElementById('search-type').value;

		const url = new URL(window.location);
		url.searchParams.set('q', query);
		if (searchType) {
			url.searchParams.set('type', searchType);
		} else {
			url.searchParams.delete('type');
		}
		window.history.replaceState({}, '', url);

		this.performSearch(query, searchType);
	}

	performSearch(query, type = '') {
		if (!window.versorisSearch || !window.versorisSearch.isInitialized) {
			console.error('Search not initialized');
			return;
		}

		const options = {};
		if (type) options.type = type;

		const results = window.versorisSearch.searchTwoPass(query, options);
		this.displayResults(results, query);
	}

	displayResults(results, query) {
		this.currentResults = results;
		this.currentQuery = query;

		document.getElementById('initial-state').style.display = 'none';

		if (results.length === 0) {
			this.showNoResults(query);
			return;
		}

		document.getElementById('search-results-container').style.display = 'block';
		document.getElementById('no-results').style.display = 'none';

		this.updateSearchSummary(results, query);

		const types = [...new Set(results.map(r => r.type))];
		if (types.length > 1) {
			document.getElementById('search-filters').style.display = 'block';
		}

		this.renderResults(results);
	}

	updateSearchSummary(results, query) {
		const summary = document.getElementById('search-summary');
		const manuscriptCount = results.filter(r => r.type === 'manuscript').length;
		const personCount = results.filter(r => r.type === 'person').length;
		const approxCount = results.filter(r => r.exact === false).length;
		const exactCount = results.length - approxCount;

		summary.textContent = '';

		const prefix = document.createTextNode(
			`Found ${results.length} result${results.length !== 1 ? 's' : ''} for "`
		);
		const strong = document.createElement('strong');
		strong.textContent = query;
		summary.appendChild(prefix);
		summary.appendChild(strong);
		summary.appendChild(document.createTextNode('"'));

		if (manuscriptCount > 0 && personCount > 0) {
			summary.appendChild(document.createTextNode(
				` (${manuscriptCount} manuscript${manuscriptCount !== 1 ? 's' : ''}, ${personCount} person${personCount !== 1 ? 's' : ''})`
			));
		}

		if (approxCount > 0) {
			summary.appendChild(document.createTextNode(
				` — ${exactCount} exact · ${approxCount} approximate`
			));
		}
	}

	renderResults(results) {
		const container = document.getElementById('search-results');
		container.innerHTML = '';

		const hasApprox = results.some(r => r.exact === false);
		let dividerAdded = false;

		results.forEach(result => {
			if (hasApprox && !dividerAdded && result.exact === false) {
				const divider = document.createElement('div');
				divider.className = 'results-section-divider';
				divider.textContent = 'Approximate matches';
				container.appendChild(divider);
				dividerAdded = true;
			}

			const resultDiv = document.createElement('div');
			resultDiv.className = 'search-result';

			const typeClass = result.type === 'manuscript' ? 'manuscript' : 'person';
			const title = result.name || result.title || result.id;
			const displayTitle = this.highlightQuery(title, this.currentQuery);

			const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
			const fullUrl = basePath + result.url;
			const urlWithSearch = new URL(fullUrl, window.location.origin);
			urlWithSearch.searchParams.set('highlight', this.currentQuery);

			const typeSpan = document.createElement('span');
			typeSpan.className = `result-type ${typeClass}`;
			typeSpan.textContent = result.type;

			const titleLink = document.createElement('a');
			titleLink.href = urlWithSearch.toString();
			titleLink.className = 'result-title';
			titleLink.innerHTML = displayTitle;

			const scoreDiv = document.createElement('div');
			scoreDiv.className = 'result-score';
			scoreDiv.textContent = `Relevance: ${Math.round(result.score * 100) / 100}`;

			resultDiv.appendChild(typeSpan);
			resultDiv.appendChild(titleLink);

			const metaParts = result.type === 'manuscript'
				? [result.repository, result.settlement, result.origDate].filter(Boolean)
				: result.type === 'person'
					? [result.birth, result.death].filter(Boolean)
					: [];

			if (metaParts.length) {
				const metaDiv = document.createElement('div');
				metaDiv.className = 'result-meta';
				metaDiv.textContent = metaParts.join(' • ');
				resultDiv.appendChild(metaDiv);
			}

			resultDiv.appendChild(scoreDiv);

			container.appendChild(resultDiv);
		});
	}

	escapeHtml(text) {
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	highlightQuery(text, query) {
		if (!query || !text) return this.escapeHtml(text || '');

		const escaped = this.escapeHtml(text);
		const words = query.toLowerCase().split(/\s+/);
		let highlightedText = escaped;

		words.forEach(word => {
			if (word.length > 2) {
				const escapedWord = this.escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const regex = new RegExp(`(${escapedWord})`, 'gi');
				highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
			}
		});

		return highlightedText;
	}

	applyFilters() {
		const checkedFilter = document.querySelector('input[name="filter-type"]:checked');
		const filterType = checkedFilter ? checkedFilter.value : '';

		const filteredResults = filterType
			? this.currentResults.filter(r => r.type === filterType)
			: this.currentResults;

		this.renderResults(filteredResults);
		this.updateSearchSummary(filteredResults, this.currentQuery);
	}

	showNoResults(query) {
		document.getElementById('search-results-container').style.display = 'none';
		const noResults = document.getElementById('no-results');
		noResults.style.display = 'block';
		noResults.querySelector('h3').textContent = `No results found for "${query}"`;
	}

	clearSearch() {
		document.getElementById('main-search-input').value = '';
		document.getElementById('search-input').value = '';
		document.getElementById('search-type').value = '';

		const url = new URL(window.location);
		url.searchParams.delete('q');
		url.searchParams.delete('type');
		window.history.replaceState({}, '', url);

		document.getElementById('search-results-container').style.display = 'none';
		document.getElementById('no-results').style.display = 'none';
		document.getElementById('initial-state').style.display = 'block';

		sessionStorage.removeItem('searchResults');
	}
}

document.addEventListener('DOMContentLoaded', () => {
	new SearchResultsPage();
});