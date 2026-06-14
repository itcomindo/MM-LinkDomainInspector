/**
 * MM Serp Crawler - content.js
 * Runs on Google SERP pages AND regular HTML pages.
 * - On SERP: highlights result cards that match saved domains.
 * - On other pages: highlights <a> links pointing to saved domains.
 */

'use strict';

const MM_CLASS = 'mm-serp-hl';
const MM_PAGE_CLASS = 'mm-page-hl';
const MM_PAGE_CLASS_NOFOLLOW = 'mm-page-hl-nofollow';
const KEY_DOMAINS = 'mm_serp_domains';
const KEY_HL = 'mm_serp_highlight_enabled';
const KEY_EXCLUDE = 'mm_serp_exclude_domains';

const isGoogleSerp = location.hostname === 'www.google.com' && location.pathname.startsWith('/search');

// ── Domain matching ───────────────────────────────────────────────────────────
function hostMatchesDomains(hostname, domains) {
    const h = hostname.toLowerCase().replace(/^www\./, '');
    return domains.some(d => {
        const clean = d.toLowerCase().replace(/^www\./, '');
        return h === clean || h.endsWith('.' + clean);
    });
}

// ── SERP: Find the card container of an anchor ────────────────────────────────
function getResultCard(anchor) {
    let candidate = null;
    let node = anchor.parentElement;

    while (node && node !== document.body) {
        if (node.hasAttribute('data-hveid')) { candidate = node; break; }
        if (node.classList.contains('g')) { candidate = node; break; }
        node = node.parentElement;
    }

    if (!candidate || candidate.querySelectorAll('h3').length > 1) return null;

    return candidate;
}

// ── Resolve potential Google redirect href ────────────────────────────────────
function resolveHref(href) {
    if (!href) return null;
    try {
        if (href.includes('google.') && href.includes('/url?')) {
            const u = new URL(href);
            const target = u.searchParams.get('q') || u.searchParams.get('url');
            if (target && target.startsWith('http')) return target;
        }
        return href.startsWith('http') ? href : null;
    } catch {
        return null;
    }
}

// ── SERP: Apply highlights on result cards ────────────────────────────────────
function applyHighlights(domains) {
    document.querySelectorAll('.' + MM_CLASS).forEach(el => el.classList.remove(MM_CLASS));

    if (!domains || domains.length === 0) return;

    const marked = new WeakSet();

    document.querySelectorAll('#rso h3, #search h3').forEach(h3 => {
        const a = h3.closest('a') || h3.parentElement?.closest('a');
        if (!a) return;

        const href = resolveHref(a.href);
        if (!href) return;

        try {
            const hostname = new URL(href).hostname;
            if (!hostMatchesDomains(hostname, domains)) return;

            const card = getResultCard(a);
            if (card && !marked.has(card)) {
                marked.add(card);
                card.classList.add(MM_CLASS);
            }
        } catch { /* skip malformed URLs */ }
    });
}

// ── SERP: Remove all highlights ───────────────────────────────────────────────
function removeHighlights() {
    document.querySelectorAll('.' + MM_CLASS).forEach(el => el.classList.remove(MM_CLASS));
}

// ── Detect nofollow on an anchor ─────────────────────────────────────────────
function isNofollow(anchor) {
    const rel = (anchor.getAttribute('rel') || '').toLowerCase().split(/\s+/);
    return rel.includes('nofollow');
}

// ── Page: Apply highlights on matching <a> links ──────────────────────────────
function applyPageHighlights(domains) {
    document.querySelectorAll('.' + MM_PAGE_CLASS + ', .' + MM_PAGE_CLASS_NOFOLLOW).forEach(el => {
        el.classList.remove(MM_PAGE_CLASS);
        el.classList.remove(MM_PAGE_CLASS_NOFOLLOW);
    });

    if (!domains || domains.length === 0) return;

    // Filter out domains that match the current page's own hostname
    // so links on codef.id never get highlighted while browsing codef.id.
    const currentHost = location.hostname.toLowerCase().replace(/^www\./, '');
    const filteredDomains = domains.filter(d => {
        const clean = d.toLowerCase().replace(/^www\./, '');
        return currentHost !== clean && !currentHost.endsWith('.' + clean);
    });

    if (filteredDomains.length === 0) return;

    document.querySelectorAll('a[href]').forEach(a => {
        try {
            const url = new URL(a.href);
            if (hostMatchesDomains(url.hostname, filteredDomains)) {
                if (isNofollow(a)) {
                    a.classList.add(MM_PAGE_CLASS_NOFOLLOW);
                } else {
                    a.classList.add(MM_PAGE_CLASS);
                }
            }
        } catch { /* skip malformed href */ }
    });
}

// ── Page: Remove link highlights ──────────────────────────────────────────────
function removePageHighlights() {
    document.querySelectorAll('.' + MM_PAGE_CLASS + ', .' + MM_PAGE_CLASS_NOFOLLOW).forEach(el => {
        el.classList.remove(MM_PAGE_CLASS);
        el.classList.remove(MM_PAGE_CLASS_NOFOLLOW);
    });
}

// ── Read storage and (re)apply ────────────────────────────────────────────────
function refresh() {
    chrome.storage.local.get([KEY_DOMAINS, KEY_HL, KEY_EXCLUDE], result => {
        const domains = result[KEY_DOMAINS] || [];
        const enabled = !!result[KEY_HL];
        const excludeDomains = result[KEY_EXCLUDE] || [];

        // If the current page's hostname is in the exclude list, remove all highlights and stop.
        const currentHost = location.hostname.toLowerCase().replace(/^www\./, '');
        const isPageExcluded = excludeDomains.some(d => {
            const clean = d.toLowerCase().replace(/^www\./, '');
            return currentHost === clean || currentHost.endsWith('.' + clean);
        });

        if (isGoogleSerp) {
            if (enabled && !isPageExcluded) applyHighlights(domains);
            else removeHighlights();
        } else {
            if (enabled && !isPageExcluded) applyPageHighlights(domains);
            else removePageHighlights();
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
    refresh();

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        refresh();
    });

    const target = isGoogleSerp
        ? (document.querySelector('#rso') || document.querySelector('#search') || document.body)
        : document.body;

    let debounceTimer = null;

    new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(refresh, 350);
    }).observe(target, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
