/**
 * MM Serp Crawler - popup.js
 * Manifest V3 | Chrome Extension
 */

'use strict';

const STORAGE_KEY = 'mm_serp_domains';
const STORAGE_KEY_HL = 'mm_serp_highlight_enabled';
const STORAGE_KEY_EX = 'mm_serp_exclude_domains';
const STORAGE_KEY_EXT = 'mm_ext_link_enabled';

let domains = [];
let excludeDomains = [];
let editingIdx = -1;

// ── DOM refs ────────────────────────────────────────────────────────────────
const domainInput = document.getElementById('domainInput');
const addBtn = document.getElementById('addBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const domainTable = document.getElementById('domainTable');
const domainTableBody = document.getElementById('domainTableBody');
const emptyState = document.getElementById('emptyState');
const grabBtn = document.getElementById('grabBtn');
const statusEl = document.getElementById('status');
const resultBox = document.getElementById('resultBox');
const resultCount = document.getElementById('resultCount');
const resultText = document.getElementById('resultText');
const copyBtn = document.getElementById('copyBtn');
const highlightCheckbox = document.getElementById('highlightCheckbox');
const findBtn = document.getElementById('findBtn');
const extLinkCheckbox = document.getElementById('extLinkCheckbox');
const extLinkCount = document.getElementById('extLinkCount');

// Exclude domain DOM refs
const excludeInput = document.getElementById('excludeInput');
const addExcludeBtn = document.getElementById('addExcludeBtn');
const clearAllExcludeBtn = document.getElementById('clearAllExcludeBtn');
const excludeTable = document.getElementById('excludeTable');
const excludeTableBody = document.getElementById('excludeTableBody');
const excludeEmptyState = document.getElementById('excludeEmptyState');

// ── Storage ─────────────────────────────────────────────────────────────────
async function loadDomains() {
    const data = await chrome.storage.local.get([STORAGE_KEY, STORAGE_KEY_HL, STORAGE_KEY_EX, STORAGE_KEY_EXT]);
    domains = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    excludeDomains = Array.isArray(data[STORAGE_KEY_EX]) ? data[STORAGE_KEY_EX] : [];
    highlightCheckbox.checked = !!data[STORAGE_KEY_HL];
    extLinkCheckbox.checked = !!data[STORAGE_KEY_EXT];
    renderTable();
    renderExcludeTable();
    if (extLinkCheckbox.checked) setTimeout(refreshExtLinkCount, 400);
}

async function saveDomains() {
    await chrome.storage.local.set({ [STORAGE_KEY]: domains });
}

async function saveExcludeDomains() {
    await chrome.storage.local.set({ [STORAGE_KEY_EX]: excludeDomains });
}

// ── Validation & Cleanup ────────────────────────────────────────────────────
function cleanDomain(raw) {
    return raw.trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0];
}

function isValidDomain(domain) {
    return /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(domain);
}

// ── Status message ───────────────────────────────────────────────────────────
let statusTimer = null;

function showStatus(msg, type = 'info') {
    clearTimeout(statusTimer);
    statusEl.textContent = msg;
    statusEl.className = `status status-${type}`;
    statusEl.style.display = 'block';
    statusTimer = setTimeout(() => { statusEl.style.display = 'none'; }, 3500);
}

// ── Render table ─────────────────────────────────────────────────────────────
function renderTable() {
    domainTableBody.innerHTML = '';

    const empty = domains.length === 0;
    domainTable.style.display = empty ? 'none' : 'table';
    emptyState.style.display = empty ? 'block' : 'none';
    clearAllBtn.disabled = empty;

    domains.forEach((domain, i) => {
        const tr = document.createElement('tr');

        if (editingIdx === i) {
            tr.innerHTML = `
        <td>${i + 1}</td>
        <td><input class="edit-input" type="text" id="editInput_${i}" value="${escapeHtml(domain)}" /></td>
        <td class="actions">
          <button class="btn btn-xs btn-success" data-action="save"   data-i="${i}">Simpan</button>
          <button class="btn btn-xs btn-secondary" data-action="cancel" data-i="${i}">Batal</button>
        </td>`;
        } else {
            tr.innerHTML = `
        <td>${i + 1}</td>
        <td class="domain-cell">${escapeHtml(domain)}</td>
        <td class="actions">
          <button class="btn btn-xs btn-outline"  data-action="edit"   data-i="${i}">Edit</button>
          <button class="btn btn-xs btn-danger"   data-action="delete" data-i="${i}">Hapus</button>
        </td>`;
        }

        domainTableBody.appendChild(tr);
    });

    // Focus edit input if editing
    if (editingIdx >= 0) {
        const inp = document.getElementById(`editInput_${editingIdx}`);
        if (inp) { inp.focus(); inp.select(); }
    }
}

// ── Table event delegation ───────────────────────────────────────────────────
domainTableBody.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.i, 10);

    if (action === 'edit') {
        editingIdx = idx;
        renderTable();

    } else if (action === 'cancel') {
        editingIdx = -1;
        renderTable();

    } else if (action === 'save') {
        const inp = document.getElementById(`editInput_${idx}`);
        const newDomain = cleanDomain(inp ? inp.value : '');
        if (!isValidDomain(newDomain)) {
            showStatus('Format domain tidak valid. Contoh: codef.id', 'error');
            return;
        }
        if (domains.includes(newDomain) && domains.indexOf(newDomain) !== idx) {
            showStatus('Domain sudah ada dalam daftar.', 'error');
            return;
        }
        domains[idx] = newDomain;
        editingIdx = -1;
        await saveDomains();
        renderTable();
        showStatus(`Domain diperbarui: ${newDomain}`, 'success');

    } else if (action === 'delete') {
        domains.splice(idx, 1);
        if (editingIdx === idx) editingIdx = -1;
        await saveDomains();
        renderTable();
        showStatus('Domain dihapus.', 'info');
    }
});

// Allow Save on Enter key inside edit input
domainTableBody.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('edit-input')) {
        const saveBtn = e.target.closest('tr')?.querySelector('[data-action="save"]');
        if (saveBtn) saveBtn.click();
    }
    if (e.key === 'Escape' && e.target.classList.contains('edit-input')) {
        const cancelBtn = e.target.closest('tr')?.querySelector('[data-action="cancel"]');
        if (cancelBtn) cancelBtn.click();
    }
});

// ── Add domain ───────────────────────────────────────────────────────────────
async function addDomain() {
    const domain = cleanDomain(domainInput.value);

    if (!domain) return;

    if (!isValidDomain(domain)) {
        showStatus('Format domain tidak valid. Contoh: codef.id', 'error');
        return;
    }

    if (domains.includes(domain)) {
        showStatus(`Domain "${domain}" sudah ada.`, 'error');
        return;
    }

    domains.push(domain);
    await saveDomains();
    domainInput.value = '';
    renderTable();
    showStatus(`"${domain}" berhasil ditambahkan.`, 'success');
}

addBtn.addEventListener('click', addDomain);
domainInput.addEventListener('keydown', e => { if (e.key === 'Enter') addDomain(); });

// ── Clear all ─────────────────────────────────────────────────────────────────
clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Hapus semua domain dari daftar?')) return;
    domains = [];
    editingIdx = -1;
    await saveDomains();
    renderTable();
    showStatus('Semua domain telah dihapus.', 'info');
});

// ── Render exclude table ──────────────────────────────────────────────────────
function renderExcludeTable() {
    excludeTableBody.innerHTML = '';
    const empty = excludeDomains.length === 0;
    excludeTable.style.display = empty ? 'none' : 'table';
    excludeEmptyState.style.display = empty ? 'block' : 'none';
    clearAllExcludeBtn.disabled = empty;

    excludeDomains.forEach((domain, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${i + 1}</td>
        <td class="domain-cell exclude-domain-cell">${escapeHtml(domain)}</td>
        <td class="actions">
          <button class="btn btn-xs btn-danger" data-ex-action="delete" data-i="${i}">Hapus</button>
        </td>`;
        excludeTableBody.appendChild(tr);
    });
}

// ── Exclude table events ──────────────────────────────────────────────────────
excludeTableBody.addEventListener('click', async e => {
    const btn = e.target.closest('[data-ex-action]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.i, 10);
    if (btn.dataset.exAction === 'delete') {
        excludeDomains.splice(idx, 1);
        await saveExcludeDomains();
        renderExcludeTable();
        showStatus('Domain exclude dihapus.', 'info');
    }
});

// ── Add exclude domain ────────────────────────────────────────────────────────
async function addExcludeDomain() {
    const domain = cleanDomain(excludeInput.value);
    if (!domain) return;

    if (!isValidDomain(domain)) {
        showStatus('Format domain tidak valid. Contoh: aaa.com', 'error');
        return;
    }

    if (excludeDomains.includes(domain)) {
        showStatus(`Domain "${domain}" sudah ada di daftar exclude.`, 'error');
        return;
    }

    excludeDomains.push(domain);
    await saveExcludeDomains();
    excludeInput.value = '';
    renderExcludeTable();
    showStatus(`"${domain}" ditambahkan ke exclude.`, 'success');
}

addExcludeBtn.addEventListener('click', addExcludeDomain);
excludeInput.addEventListener('keydown', e => { if (e.key === 'Enter') addExcludeDomain(); });

// ── Clear all exclude ─────────────────────────────────────────────────────────
clearAllExcludeBtn.addEventListener('click', async () => {
    if (!confirm('Hapus semua domain dari daftar exclude?')) return;
    excludeDomains = [];
    await saveExcludeDomains();
    renderExcludeTable();
    showStatus('Semua domain exclude telah dihapus.', 'info');
});

// ── Grab URLs ─────────────────────────────────────────────────────────────────
grabBtn.addEventListener('click', async () => {
    if (domains.length === 0) {
        showStatus('Tambahkan minimal 1 domain terlebih dahulu.', 'error');
        return;
    }

    grabBtn.disabled = true;
    grabBtn.textContent = '⏳ Sedang Grab...';
    resultBox.style.display = 'none';

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.url) {
            showStatus('Tidak dapat membaca halaman aktif.', 'error');
            return;
        }

        const isSerp = tab.url.includes('google.com/search');

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: isSerp ? extractSerpUrls : extractPageUrls,
        });

        const allUrls = results?.[0]?.result ?? [];
        const snapshot = [...domains]; // safe copy

        const filtered = allUrls.filter(url => {
            try {
                const hostname = new URL(url).hostname.replace(/^www\./, '');
                return snapshot.some(d => hostname === d || hostname.endsWith('.' + d));
            } catch {
                return false;
            }
        });

        if (filtered.length === 0) {
            showStatus('Tidak ada URL yang cocok dengan domain dalam daftar.', 'error');
            return;
        }

        const text = filtered.join('\n');
        await navigator.clipboard.writeText(text);

        resultText.value = text;
        resultCount.textContent = `✅ ${filtered.length} URL ditemukan — tersalin ke clipboard!`;
        resultBox.style.display = 'block';
        showStatus(`${filtered.length} URL berhasil di-grab dan disalin!`, 'success');

    } catch (err) {
        console.error('[MM Serp Crawler]', err);
        showStatus('Gagal: ' + err.message, 'error');
    } finally {
        grabBtn.disabled = false;
        grabBtn.textContent = '▶ Grab URLs dari Halaman';
    }
});

// ── Copy again button ─────────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
    if (!resultText.value) return;
    await navigator.clipboard.writeText(resultText.value);
    showStatus('URL disalin ulang ke clipboard!', 'success');
});

// ── SERP scraper — injected into the Google page ──────────────────────────────
/**
 * NOTE: This function runs in the context of the Google SERP page.
 * It MUST be self-contained (no closures from popup scope).
 */
function extractSerpUrls() {
    const urls = [];
    const seen = new Set();

    function tryAdd(href) {
        if (!href) return;

        // Resolve Google redirect URLs like /url?q=https://example.com
        if (href.includes('google.') && href.includes('/url?')) {
            try {
                const u = new URL(href);
                const target = u.searchParams.get('q') || u.searchParams.get('url');
                if (target && target.startsWith('http')) tryAdd(target);
            } catch { /* ignore */ }
            return;
        }

        if (!href.startsWith('http')) return;

        try {
            const u = new URL(href);
            const h = u.hostname;
            // Skip Google-owned hosts
            if (h.endsWith('google.com') || h.endsWith('googleapis.com') ||
                h.endsWith('gstatic.com') || h.endsWith('googleusercontent.com') ||
                h.endsWith('youtube.com') || h === 'youtu.be') return;
        } catch { return; }

        if (seen.has(href)) return;
        seen.add(href);
        urls.push(href);
    }

    // Strategy 1: heading anchors — most reliable organic result links
    document.querySelectorAll('h3').forEach(h3 => {
        const a = h3.closest('a') || h3.parentElement?.closest('a');
        if (a && a.href) tryAdd(a.href);
    });

    // Strategy 2: all links inside #rso (organic section)
    document.querySelectorAll('#rso a[href]').forEach(a => tryAdd(a.href));

    // Strategy 3: fallback — whole #search container
    if (urls.length === 0) {
        document.querySelectorAll('#search a[href]').forEach(a => tryAdd(a.href));
    }

    return urls;
}

// ── Page scraper — injected into any HTML page ────────────────────────────────
/**
 * NOTE: This function runs in the context of the active tab page.
 * It MUST be self-contained (no closures from popup scope).
 */
function extractPageUrls() {
    const urls = [];
    const seen = new Set();

    document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        if (!href || !href.startsWith('http')) return;
        if (seen.has(href)) return;
        seen.add(href);
        urls.push(href);
    });

    return urls;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Highlight toggle ─────────────────────────────────────────────────────────
highlightCheckbox.addEventListener('change', async () => {
    await chrome.storage.local.set({ [STORAGE_KEY_HL]: highlightCheckbox.checked });
});

// ── Find next matched link ────────────────────────────────────────────────────
findBtn.addEventListener('click', async () => {
    if (domains.length === 0) {
        showStatus('Tambahkan domain terlebih dahulu.', 'error');
        return;
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            showStatus('Tidak dapat membaca halaman aktif.', 'error');
            return;
        }

        const result = await chrome.tabs.sendMessage(tab.id, { type: 'MM_FIND_NEXT' });

        if (!result?.count) {
            showStatus('Tidak ada link yang cocok di halaman ini.', 'error');
            return;
        }

        showStatus(`Link ${result.index + 1} dari ${result.count}`, 'success');
    } catch {
        showStatus('Gagal menemukan link. Muat ulang halaman lalu coba lagi.', 'error');
    }
});

// ── External link checker toggle ─────────────────────────────────────────────
extLinkCheckbox.addEventListener('change', async () => {
    await chrome.storage.local.set({ [STORAGE_KEY_EXT]: extLinkCheckbox.checked });
    if (extLinkCheckbox.checked) {
        setTimeout(refreshExtLinkCount, 400);
    } else {
        extLinkCount.textContent = '';
    }
});

// ── Refresh external link count from active tab ───────────────────────────────
async function refreshExtLinkCount() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
                df: document.querySelectorAll('.mm-ext-link-hl').length,
                nf: document.querySelectorAll('.mm-ext-link-hl-nf').length,
            }),
        });
        const { df, nf } = results?.[0]?.result ?? { df: 0, nf: 0 };
        const total = df + nf;
        extLinkCount.textContent = total > 0
            ? `${total} link (${df} dofollow · ${nf} nofollow)`
            : 'tidak ada external link';
    } catch {
        extLinkCount.textContent = '';
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadDomains();
