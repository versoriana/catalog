// Shared site chrome: navbar, footer and light/dark toggle.
// Loaded in <head> so the theme is applied before first paint and the
// navbar exists before search.js binds to #search-form on DOMContentLoaded.

(function () {
    const THEME_KEY = 'versoris-theme';

    function storedTheme() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }

    function applyTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    function effectiveTheme() {
        const attr = document.documentElement.getAttribute('data-theme');
        if (attr) return attr;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    applyTheme(storedTheme());

    const NAV_ITEMS = [
        { href: 'manuscripts.html', label: 'Manuscripts' },
        { href: 'persons.html', label: 'Persons' },
        { href: 'opera.html', label: 'Opera' },
        { href: 'about.html', label: 'About' }
    ];

    function currentPage() {
        const page = window.location.pathname.split('/').pop();
        return page === '' ? 'index.html' : page;
    }

    function navHtml() {
        const page = currentPage();
        const links = NAV_ITEMS.map(item => {
            const active = item.href === page;
            return `<li class="nav-item"><a class="nav-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''} href="${item.href}">${item.label}</a></li>`;
        }).join('');

        return `
<nav class="navbar navbar-expand-md site-nav" aria-label="Main">
  <div class="container">
    <a class="navbar-brand" href="index.html">Bibliotheca Manuscripta Versoriana<small>Johannes Versoris · ca. 1440–1500</small></a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#site-nav-collapse" aria-controls="site-nav-collapse" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="site-nav-collapse">
      <ul class="navbar-nav ms-md-4 me-auto mb-2 mb-md-0">${links}</ul>
      <div class="d-flex align-items-center gap-2">
        <form class="nav-search" id="search-form" role="search">
          <i class="bi bi-search" aria-hidden="true"></i>
          <input class="form-control" type="search" placeholder="Search the catalogue…" aria-label="Search" id="search-input">
        </form>
        <button class="theme-toggle" type="button" id="theme-toggle" aria-label="Toggle dark mode"><i class="bi"></i></button>
      </div>
    </div>
  </div>
</nav>`;
    }

    function footerHtml() {
        return `
<div class="container">
  <div class="row align-items-center">
    <div class="col-md-7">
      <p class="mb-1"><strong>Transferts des savoirs et création d'autorité : La diffusion européenne des ouvrages de Jean Versoris (ca. 1440–1500)</strong></p>
      <p class="mb-1">Dr. Aurora Panzica, University of Basel</p>
      <p class="mb-0">SNSF Ambizione (2024–2027) · <a href="https://data.snf.ch/grants/grant/216086" target="_blank" rel="noopener">Grant 216086</a></p>
    </div>
    <div class="col-md-5">
      <div class="logos">
        <a href="https://www.snf.ch/" target="_blank" rel="noopener"><img src="images/snf.png" alt="Swiss National Science Foundation"></a>
        <a href="https://www.unibas.ch/" target="_blank" rel="noopener"><img src="images/basellogo.png" alt="University of Basel"></a>
      </div>
    </div>
  </div>
</div>`;
    }

    function updateToggleIcon(button) {
        const icon = button.querySelector('.bi');
        const dark = effectiveTheme() === 'dark';
        icon.className = 'bi ' + (dark ? 'bi-sun' : 'bi-moon');
        button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const header = document.getElementById('site-header');
        if (header) {
            header.innerHTML = navHtml();
            // Sticky header height as --header-h, so anchor jumps land below it (theme.css)
            const setHeaderHeight = () => document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
            setHeaderHeight();
            if (window.ResizeObserver) new ResizeObserver(setHeaderHeight).observe(header);
        }

        const footer = document.getElementById('site-footer');
        if (footer) {
            footer.classList.add('site-footer');
            footer.innerHTML = footerHtml();
        }

        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            updateToggleIcon(toggle);
            toggle.addEventListener('click', () => {
                const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
                updateToggleIcon(toggle);
            });
        }
    });
})();
