class VersorisSearch {
    constructor() {
        this.manuscriptsIndex = null;
        this.personsIndex = null;
        this.manuscriptsData = [];
        this.personsData = [];
        this.isInitialized = false;
        // Auto-detect base path: extract everything before the current page
        // For localhost: /
        // For GitHub Pages: /repo-name/
        this.basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            await this.loadAndIndexManuscripts();
            await this.loadAndIndexPersons();
            this.setupSearchHandlers();
            this.isInitialized = true;
            console.log('Versoris search initialized successfully');
        } catch (error) {
            console.error('Failed to initialize search:', error);
        }
    }

    async loadAndIndexManuscripts() {
        try {
            const response = await fetch('data/mss.xml');
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            this.manuscriptsData = this.extractManuscriptData(xmlDoc);

            this.manuscriptsIndex = new MiniSearch({
                fields: ['title', 'repository', 'settlement', 'idno', 'origDate', 'origPlace', 'material', 'author', 'content', 'notes'],
                storeFields: ['id', 'title', 'repository', 'settlement', 'idno', 'origDate', 'type', 'url'],
                searchOptions: {
                    boost: { title: 3, author: 2, content: 1.5 },
                    fuzzy: 1,
                    prefix: true
                }
            });

            this.manuscriptsIndex.addAll(this.manuscriptsData);

        } catch (error) {
            console.error('Failed to load manuscripts:', error);
        }
    }

    extractManuscriptData(xmlDoc) {
        const manuscripts = [];
        const msDescElements = xmlDoc.querySelectorAll('msDesc');

        msDescElements.forEach(msDesc => {
            const id = msDesc.getAttribute('xml:id') || msDesc.id;
            if (!id) return;

            const manuscript = {
                id: id,
                type: 'manuscript',
                url: `manuscripts.html#${id}`
            };

            // Basic identification
            const repository = msDesc.querySelector('repository');
            manuscript.repository = repository ? repository.textContent.trim() : '';

            const settlement = msDesc.querySelector('settlement');
            manuscript.settlement = settlement ? settlement.textContent.trim() : '';

            const idno = msDesc.querySelector('idno');
            manuscript.idno = idno ? idno.textContent.trim() : '';

            // Title (construct from repository + idno if no explicit title)
            manuscript.title = `${manuscript.settlement}, ${manuscript.repository}, ${manuscript.idno}`.replace(/^,\s*|,\s*$/g, '');

            // Date information
            const origDate = msDesc.querySelector('origDate');
            if (origDate) {
                const when = origDate.getAttribute('when');
                const from = origDate.getAttribute('from');
                const to = origDate.getAttribute('to');
                const notBefore = origDate.getAttribute('notBefore');
                const notAfter = origDate.getAttribute('notAfter');

                if (when) {
                    manuscript.origDate = when;
                } else if (from && to) {
                    manuscript.origDate = from === to ? from : `${from}-${to}`;
                } else if (from) {
                    manuscript.origDate = `from ${from}`;
                } else if (to) {
                    manuscript.origDate = `to ${to}`;
                } else if (notBefore && notAfter) {
                    manuscript.origDate = `${notBefore}-${notAfter}`;
                } else if (notBefore) {
                    manuscript.origDate = `after ${notBefore}`;
                } else if (notAfter) {
                    manuscript.origDate = `before ${notAfter}`;
                } else {
                    manuscript.origDate = origDate.textContent.trim();
                }
            }

            // Place of origin
            const origPlace = msDesc.querySelector('origPlace');
            manuscript.origPlace = origPlace ? origPlace.textContent.trim() : '';

            // Material
            const material = msDesc.querySelector('material');
            manuscript.material = material ? material.textContent.trim() : '';

            // Extract authors and titles from msItems
            const authors = [];
            const titles = [];
            const content = [];

            const msItems = msDesc.querySelectorAll('msItem');
            msItems.forEach(item => {
                const author = item.querySelector('author');
                if (author) authors.push(author.textContent.trim());

                const title = item.querySelector('title');
                if (title) titles.push(title.textContent.trim());

                // Get all text content for full-text search
                content.push(item.textContent.trim());
            });

            manuscript.author = authors.join('; ');
            manuscript.titles = titles.join('; ');
            manuscript.content = content.join(' ');

            // Extract notes
            const notes = [];
            const noteElements = msDesc.querySelectorAll('note');
            noteElements.forEach(note => {
                notes.push(note.textContent.trim());
            });
            manuscript.notes = notes.join(' ');

            manuscripts.push(manuscript);
        });

        return manuscripts;
    }

    async loadAndIndexPersons() {
        try {
            const response = await fetch('data/PersonRegister.xml');
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            this.personsData = this.extractPersonsData(xmlDoc);

            this.personsIndex = new MiniSearch({
                fields: ['name', 'nameVariations', 'birth', 'death', 'occupation', 'note', 'idno', 'affiliation'],
                storeFields: ['id', 'name', 'nameVariations', 'birth', 'death', 'occupation', 'type', 'url', 'affiliation'],
                searchOptions: {
                    boost: { name: 3, nameVariations: 3, occupation: 2, affiliation: 2 },
                    fuzzy: 1,
                    prefix: true
                }
            });

            this.personsIndex.addAll(this.personsData);

        } catch (error) {
            console.error('Failed to load persons:', error);
        }
    }

    extractPersonsData(xmlDoc) {
        const persons = [];
        // Try multiple ways to find person elements due to namespace issues
        let personElements = xmlDoc.querySelectorAll('person');

        if (personElements.length === 0) {
            // Try with TEI namespace
            personElements = xmlDoc.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'person');
        }

        if (personElements.length === 0) {
            // Try getElementsByTagName as fallback
            personElements = xmlDoc.getElementsByTagName('person');
        }

        Array.from(personElements).forEach(person => {
            const id = person.getAttribute('xml:id') || person.id;
            if (!id) return;

            const personData = {
                id: id,
                type: 'person',
                url: `persons.html#${id}`
            };

            // Name extraction - handle new <persName> structure with forename/nameLink/surname
            // Extract preferred name components
            const preferredForename = person.querySelector('persName forename[type="preferred"]')?.textContent.trim() || '';
            const preferredNameLink = person.querySelector('persName nameLink[type="preferred"]')?.textContent.trim() || '';
            const preferredSurname = person.querySelector('persName surname[type="preferred"]')?.textContent.trim() || '';

            // Build primary display name from preferred components
            const nameParts = [preferredForename, preferredNameLink, preferredSurname].filter(p => p);

            // Get sort name (used for search boost, not display)
            const sortName = person.querySelector('persName[type="sort"]')?.textContent.trim() || '';

            // Collect all name component variations for comprehensive search
            const allForenames = Array.from(person.querySelectorAll('persName forename'))
                .map(el => el.textContent.trim())
                .filter(t => t);
            const allNameLinks = Array.from(person.querySelectorAll('persName nameLink'))
                .map(el => el.textContent.trim())
                .filter(t => t);
            const allSurnames = Array.from(person.querySelectorAll('persName surname'))
                .map(el => el.textContent.trim())
                .filter(t => t);

            if (nameParts.length > 0) {
                // Use preferred components as primary display name
                personData.name = nameParts.join(' ');
                // Store all name variations for search (components + sort name)
                personData.nameVariations = [
                    ...allForenames,
                    ...allNameLinks,
                    ...allSurnames,
                    sortName
                ].filter(n => n).join(' ');
            } else {
                // Fallback to ID if no persName structure found
                personData.name = id.replace(/([A-Z])/g, ' $1').trim();
                personData.nameVariations = personData.name;
            }

            // Birth information
            const birth = person.querySelector('birth');
            if (birth) {
                const when = birth.getAttribute('when');
                const notBefore = birth.getAttribute('notBefore');
                const notAfter = birth.getAttribute('notAfter');

                if (when) {
                    personData.birth = when;
                } else if (notBefore && notAfter) {
                    personData.birth = `${notBefore}-${notAfter}`;
                } else if (notBefore) {
                    personData.birth = `after ${notBefore}`;
                } else if (notAfter) {
                    personData.birth = `before ${notAfter}`;
                }
            }

            // Death information
            const death = person.querySelector('death');
            if (death) {
                const when = death.getAttribute('when');
                const notBefore = death.getAttribute('notBefore');
                const notAfter = death.getAttribute('notAfter');

                if (when) {
                    personData.death = when;
                } else if (notBefore && notAfter) {
                    personData.death = `${notBefore}-${notAfter}`;
                } else if (notBefore) {
                    personData.death = `after ${notBefore}`;
                } else if (notAfter) {
                    personData.death = `before ${notAfter}`;
                }
            }

            // Occupation information
            const occupations = [];
            const occupationElements = person.querySelectorAll('occupation');
            occupationElements.forEach(occ => {
                const role = occ.getAttribute('role');
                if (role) {
                    occupations.push(role);
                }
            });
            personData.occupation = occupations.join(' ');

            // Notes
            const notes = [];
            const noteElements = person.querySelectorAll('note');
            noteElements.forEach(note => {
                notes.push(note.textContent.trim());
            });
            personData.note = notes.join(' ');

            // External identifiers
            const idnos = [];
            const idnoElements = person.querySelectorAll('idno');
            idnoElements.forEach(idno => {
                const type = idno.getAttribute('type');
                const value = idno.textContent.trim();
                idnos.push(`${type}: ${value}`);
            });
            personData.idno = idnos.join(' ');

            // Affiliation information
            const affiliations = [];
            let affiliationElements = person.querySelectorAll('affiliation');

            // Try namespace-aware approach if no affiliations found
            if (affiliationElements.length === 0) {
                affiliationElements = person.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'affiliation');
            }

            if (affiliationElements.length === 0) {
                affiliationElements = person.getElementsByTagName('affiliation');
            }

            Array.from(affiliationElements).forEach(aff => {
                const affiliationText = aff.textContent.trim();
                if (affiliationText) {
                    affiliations.push(affiliationText);
                }
            });
            personData.affiliation = affiliations.join(' ');

            persons.push(personData);
        });

        return persons;
    }

    _runSearch(query, searchOptions, type) {
        const results = [];
        if (type === 'manuscript' && this.manuscriptsIndex) {
            results.push(...this.manuscriptsIndex.search(query, searchOptions));
        } else if (type === 'person' && this.personsIndex) {
            results.push(...this.personsIndex.search(query, searchOptions));
        } else {
            if (this.manuscriptsIndex) results.push(...this.manuscriptsIndex.search(query, searchOptions));
            if (this.personsIndex) results.push(...this.personsIndex.search(query, searchOptions));
        }
        return results;
    }

    search(query, options = {}) {
        if (!this.isInitialized) {
            console.warn('Search not initialized');
            return [];
        }
        const searchOptions = {
            fuzzy: options.fuzzy !== undefined ? options.fuzzy : 1,
            prefix: options.prefix !== undefined ? options.prefix : true,
            boost: options.boost || {}
        };
        return this._runSearch(query, searchOptions, options.type)
            .sort((a, b) => b.score - a.score);
    }

    searchTwoPass(query, options = {}) {
        if (!this.isInitialized) {
            console.warn('Search not initialized');
            return [];
        }
        const boost = options.boost || {};
        const type = options.type;

        const exactIds = new Set(
            this._runSearch(query, { fuzzy: false, prefix: false, boost }, type).map(r => r.id)
        );

        const all = this._runSearch(query, { fuzzy: 1, prefix: true, boost }, type);
        all.forEach(r => { r.exact = exactIds.has(r.id); });

        return all.sort((a, b) => {
            if (a.exact !== b.exact) return a.exact ? -1 : 1;
            return b.score - a.score;
        });
    }

    setupSearchHandlers() {
        // Setup search form handlers for all pages
        const searchForms = document.querySelectorAll('#search-form');
        const searchInputs = document.querySelectorAll('#search-input');

        searchForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = form.querySelector('#search-input');
                if (input && input.value.trim()) {
                    this.performSearch(input.value.trim());
                }
            });
        });

        // Add live search suggestions
        searchInputs.forEach(input => {
            input._activeSuggestionIndex = -1;
            let timeout;

            input.addEventListener('focus', () => {
                const query = input.value.trim();
                if (query.length >= 2) {
                    this.showSearchSuggestions(query, input);
                }
            });

            input.addEventListener('input', (e) => {
                input._activeSuggestionIndex = -1;
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    const query = e.target.value.trim();
                    if (query.length >= 2) {
                        this.showSearchSuggestions(query, input);
                    } else {
                        this.hideSearchSuggestions();
                    }
                }, 300);
            });

            input.addEventListener('keydown', (e) => {
                const suggestions = document.querySelectorAll('#search-suggestions .search-suggestion');
                const open = suggestions.length > 0;

                if (e.key === 'ArrowDown') {
                    if (!open) return;
                    e.preventDefault();
                    input._activeSuggestionIndex = Math.min(input._activeSuggestionIndex + 1, suggestions.length - 1);
                    this.updateActiveSuggestion(suggestions, input._activeSuggestionIndex);
                } else if (e.key === 'ArrowUp') {
                    if (!open) return;
                    e.preventDefault();
                    input._activeSuggestionIndex = Math.max(input._activeSuggestionIndex - 1, -1);
                    this.updateActiveSuggestion(suggestions, input._activeSuggestionIndex);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const active = document.querySelector('#search-suggestions .search-suggestion-active');
                    this.hideSearchSuggestions();
                    input._activeSuggestionIndex = -1;
                    if (active) {
                        active.click();
                        input.value = '';
                    } else if (input.value.trim()) {
                        this.performSearch(input.value.trim());
                    }
                } else if (e.key === 'Escape') {
                    this.hideSearchSuggestions();
                    input._activeSuggestionIndex = -1;
                }
            });
        });
    }

    updateActiveSuggestion(suggestions, activeIndex) {
        suggestions.forEach((s, i) => {
            s.classList.toggle('search-suggestion-active', i === activeIndex);
        });
    }

    performSearch(query) {
        const results = this.searchTwoPass(query);

        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const searchUrl = new URL(basePath + 'search.html', window.location.origin);
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('mode', 'fuzzy');

        sessionStorage.setItem('searchResults', JSON.stringify({
            query: query,
            mode: 'fuzzy',
            results: results,
            timestamp: Date.now()
        }));

        window.location.href = searchUrl.toString();
    }

    showSearchSuggestions(query, inputElement) {
        const results = this.search(query).slice(0, 5);

        this.hideSearchSuggestions();
        inputElement._activeSuggestionIndex = -1;

        if (results.length === 0) return;

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'search-suggestions';
        suggestionsDiv.className = 'search-suggestions';

        results.forEach(result => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'search-suggestion';
            suggestionDiv.innerHTML = `
                <div class="suggestion-title">${result.name || result.title || result.id}</div>
                <div class="suggestion-type">${result.type}</div>
            `;
            suggestionDiv.addEventListener('click', () => {
                // Get base path for proper navigation on GitHub Pages
                const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
                window.location.href = basePath + result.url;
            });
            suggestionsDiv.appendChild(suggestionDiv);
        });

        // Position suggestions relative to input
        inputElement.parentNode.style.position = 'relative';
        inputElement.parentNode.appendChild(suggestionsDiv);

        // Hide suggestions when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.hideSuggestionsHandler = (e) => {
                if (!inputElement.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                    this.hideSearchSuggestions();
                }
            });
        }, 0);
    }

    hideSearchSuggestions() {
        const existing = document.getElementById('search-suggestions');
        if (existing) {
            existing.remove();
        }
        if (this.hideSuggestionsHandler) {
            document.removeEventListener('click', this.hideSuggestionsHandler);
            this.hideSuggestionsHandler = null;
        }
    }
}

// Text highlighting functionality
class TextHighlighter {
    constructor() {
        this.highlightedElements = [];
        this.isHighlighting = false;
    }

    highlightSearchTerms(searchTerms) {
        if (!searchTerms || searchTerms.trim() === '') return;

        // Prevent duplicate highlighting if already in progress
        if (this.isHighlighting) {
            console.log('Highlighting already in progress, skipping...');
            return;
        }

        this.isHighlighting = true;

        // Clear any existing highlights
        this.clearHighlights();

        const terms = searchTerms.toLowerCase().split(/\s+/).filter(term => term.length > 2);
        if (terms.length === 0) return;

        // Use TreeWalker to find all text nodes
        const walker = document.createTreeWalker(
            document.querySelector('main'),
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Skip empty text nodes and those inside script/style tags
                    if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentElement;
                    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        // Process each text node
        textNodes.forEach(textNode => {
            this.highlightInTextNode(textNode, terms);
        });

        // Highlighting complete - no indicator needed

        // Reset highlighting flag
        this.isHighlighting = false;
    }

    highlightInTextNode(textNode, terms) {
        const originalText = textNode.textContent;
        let foundTerms = false;

        // Check if any terms match
        terms.forEach(term => {
            const regex = new RegExp(this.escapeRegex(term), 'gi');
            if (regex.test(originalText)) {
                foundTerms = true;
            }
        });

        if (!foundTerms) return;

        // Create highlighted HTML
        let highlightedText = originalText;
        terms.forEach(term => {
            const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark class="search-highlight" data-term="$1">$1</mark>');
        });

        // Replace text node with highlighted content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = highlightedText;

        const parent = textNode.parentNode;

        // Insert all new nodes before the text node
        while (tempDiv.firstChild) {
            parent.insertBefore(tempDiv.firstChild, textNode);
        }

        // Remove the original text node
        parent.removeChild(textNode);

        // Track the parent element for cleanup
        this.highlightedElements.push(parent);

        // Scroll to first highlight if this is the first one found
        // BUT only if there's no URL fragment (user hasn't navigated to specific section)
        if (this.highlightedElements.length === 1) {
            setTimeout(() => {
                // Check if user navigated to a specific section (URL has fragment)
                if (window.location.hash) {
                    // User clicked on a specific person/section, don't override their navigation
                    return;
                }

                const firstHighlight = document.querySelector('.search-highlight');
                if (firstHighlight) {
                    firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
    }

    highlightInElement(element, terms) {
        const originalText = element.textContent;
        let highlightedText = originalText;
        let foundTerms = false;

        terms.forEach(term => {
            const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
            if (regex.test(highlightedText)) {
                highlightedText = highlightedText.replace(regex, '<mark class="search-highlight" data-term="$1">$1</mark>');
                foundTerms = true;
            }
        });

        if (foundTerms) {
            element.innerHTML = highlightedText;
            this.highlightedElements.push(element);

            // Scroll to first highlight if this is the first one found
            // BUT only if there's no URL fragment (user hasn't navigated to specific section)
            if (this.highlightedElements.length === 1) {
                setTimeout(() => {
                    // Check if user navigated to a specific section (URL has fragment)
                    if (window.location.hash) {
                        // User clicked on a specific person/section, don't override their navigation
                        return;
                    }

                    const firstHighlight = element.querySelector('.search-highlight');
                    if (firstHighlight) {
                        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 500);
            }
        }
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    clearHighlights() {
        // Remove existing highlights
        this.highlightedElements.forEach(element => {
            const highlights = element.querySelectorAll('.search-highlight');
            highlights.forEach(highlight => {
                const parent = highlight.parentNode;
                parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                parent.normalize(); // Merge adjacent text nodes
            });
        });

        this.highlightedElements = [];
        this.hideHighlightIndicator();

        // Reset highlighting flag when clearing
        this.isHighlighting = false;
    }

    showHighlightIndicator(searchTerms, count) {
        // Remove existing indicator
        this.hideHighlightIndicator();

        const indicator = document.createElement('div');
        indicator.id = 'search-highlight-indicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 80px;
                right: 20px;
                background: #0d6efd;
                color: white;
                padding: 10px 15px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1050;
                font-size: 0.9rem;
                max-width: 300px;
            ">
                <div style="margin-bottom: 5px;">
                    <strong>Search highlights:</strong> "${searchTerms}"
                </div>
                <div style="font-size: 0.8rem; opacity: 0.9;">
                    Found ${count} highlighted section${count !== 1 ? 's' : ''}
                </div>
                <button id="clear-highlights" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    margin-top: 8px;
                    cursor: pointer;
                ">Clear highlights</button>
            </div>
        `;

        document.body.appendChild(indicator);

        // Add event listener for clear button
        document.getElementById('clear-highlights').addEventListener('click', () => {
            this.clearHighlights();
            // Remove highlight parameter from URL
            const url = new URL(window.location);
            url.searchParams.delete('highlight');
            window.history.replaceState({}, '', url);
        });

        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hideHighlightIndicator();
        }, 10000);
    }

    hideHighlightIndicator() {
        const existing = document.getElementById('search-highlight-indicator');
        if (existing) {
            existing.remove();
        }
    }
}

// Global search instance
window.versorisSearch = new VersorisSearch();
window.textHighlighter = new TextHighlighter();

// Function to check for highlights after content loads
function checkForHighlighting() {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightTerms = urlParams.get('highlight');
    if (highlightTerms) {
        window.textHighlighter.highlightSearchTerms(highlightTerms);
    }
}

// Initialize search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.versorisSearch.initialize();

    // When a #hash is present the page-level getHTML5 callback handles highlighting
    // after opening the specific entry — skip the global retry to avoid duplicates.
    const urlParams = new URLSearchParams(window.location.search);
    const highlightTerms = urlParams.get('highlight');
    if (highlightTerms && !window.location.hash) {
        let attempts = 0;
        const maxAttempts = 10;

        const tryHighlight = () => {
            attempts++;
            const mainContent = document.querySelector('main');
            const hasContent = mainContent && mainContent.textContent.trim().length > 200;
            if (hasContent || attempts >= maxAttempts) {
                window.textHighlighter.highlightSearchTerms(highlightTerms);
            } else {
                setTimeout(tryHighlight, attempts * 500);
            }
        };

        setTimeout(tryHighlight, 1000);
    }
});