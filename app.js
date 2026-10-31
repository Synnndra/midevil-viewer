// MidEvil NFT Gallery

// ============================================
// CONFIGURATION
// ============================================
const PLACEHOLDER_IMAGE = 'Placeholder.jpg';

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    totalCount: document.getElementById('totalCount'),
    sortSelect: document.getElementById('sortSelect'),
    searchInput: document.getElementById('searchInput'),
    sidebar: document.getElementById('sidebar'),
    filterToggle: document.getElementById('filterToggle'),
    graveyardToggle: document.getElementById('graveyardToggle'),
    oneOfOnesToggle: document.getElementById('oneOfOnesToggle'),
    filterGroups: document.getElementById('filterGroups'),
    activeFilters: document.getElementById('activeFilters'),
    clearFilters: document.getElementById('clearFilters'),
    nftGrid: document.getElementById('nftGrid'),
    detailsModal: document.getElementById('detailsModal'),
    closeDetails: document.getElementById('closeDetails'),
    detailsTitle: document.getElementById('detailsTitle'),
    detailsImage: document.getElementById('detailsImage'),
    detailsTraits: document.getElementById('detailsTraits'),
    detailsMint: document.getElementById('detailsMint'),
    downloadBtn: document.getElementById('downloadBtn'),
    walletBtn: document.getElementById('walletBtn'),
    walletModal: document.getElementById('walletModal'),
    closeWallet: document.getElementById('closeWallet'),
    walletOptions: document.getElementById('walletOptions'),
    walletStatus: document.getElementById('walletStatus'),
    walletPaste: document.getElementById('walletPaste'),
    walletPasteBtn: document.getElementById('walletPasteBtn'),
    mineToggleWrap: document.getElementById('mineToggleWrap'),
    mineToggle: document.getElementById('mineToggle'),
    mineToggleLabel: document.getElementById('mineToggleLabel')
};

// ============================================
// STATE
// ============================================
let allNFTs = [];
let filteredNFTs = [];
let activeFilters = {};
let traitCounts = {};

// Pagination
const ITEMS_PER_PAGE = 50;
let currentPage = 0;
let isLoadingMore = false;

// ============================================
// EVENT LISTENERS
// ============================================
elements.filterToggle.addEventListener('click', toggleSidebar);
elements.graveyardToggle.addEventListener('change', fetchCollection);
elements.oneOfOnesToggle.addEventListener('change', applyFilters);
elements.mineToggle.addEventListener('change', applyFilters);
elements.clearFilters.addEventListener('click', clearFilters);
elements.sortSelect.addEventListener('change', applySort);
elements.searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') searchById();
});
elements.searchInput.addEventListener('input', () => {
    if (elements.searchInput.value === '') searchById();
});

elements.closeDetails.addEventListener('click', closeDetails);

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
    if (elements.sidebar.classList.contains('open') &&
        !elements.sidebar.contains(e.target) &&
        !elements.filterToggle.contains(e.target)) {
        elements.sidebar.classList.remove('open');
    }
});

// ============================================
// API FUNCTIONS
// ============================================
// One cached request for the whole set (see api/collection.js). Burnt items are already removed
// and image URLs are already resolved on the server.
let fetchToken = 0;

async function fetchCollection() {
    const token = ++fetchToken; // ignore results from an older request if the toggle flips mid-load
    showLoading(true);
    hideError();
    allNFTs = [];
    filteredNFTs = [];
    activeFilters = {};

    const set = elements.graveyardToggle.checked ? 'graveyard' : 'main';

    try {
        const response = await fetch(`/api/collection?set=${set}`);
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        if (token !== fetchToken) return;

        allNFTs = (data.items || []).map(nft => {
            const number = extractNumber(nft.name);
            return {
                id: nft.id,
                name: nft.name ? nft.name.replace(/#?\d+/, `#${number}`) : 'Unknown',
                number: number,
                imageUrl: nft.image,
                thumbnailUrl: nft.thumb,
                thumbnailFallback: nft.thumbFallback || '',
                traits: nft.traits || {},
                owner: nft.owner || '',
                mint: nft.id
            };
        });

        if (allNFTs.length === 0) {
            showError('No NFTs found in the collection');
            showLoading(false);
            return;
        }

        elements.totalCount.textContent = `${allNFTs.length} Items`;
        setupFilters();
        updateMineCount();
        applyFilters(); // keeps 1/1s and My MidEvils applied when switching Graveyard on/off
    } catch (err) {
        if (token !== fetchToken) return;
        showError('Failed to fetch collection: ' + err.message);
    }

    showLoading(false);
}

function extractNumber(name) {
    const match = name?.match(/#?(\d+)/);
    return match ? parseInt(match[1]) + 1 : 0;
}


// ============================================
// UI FUNCTIONS
// ============================================
function showLoading(show) {
    elements.loading.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    elements.error.textContent = message;
    elements.error.style.display = 'block';
}

function hideError() {
    elements.error.style.display = 'none';
}

function toggleSidebar() {
    elements.sidebar.classList.toggle('open');
}

function searchById() {
    const query = elements.searchInput.value.trim();

    if (!query) {
        // Search cleared: go back to whatever the filters show
        applyFilters();
        return;
    }

    // Parse search query - extract number
    const searchNum = parseInt(query.replace(/[^0-9]/g, ''));

    if (isNaN(searchNum)) {
        return;
    }

    // Find NFT with matching number
    const found = allNFTs.filter(nft => nft.number === searchNum);

    if (found.length > 0) {
        filteredNFTs = found;
        renderNFTs();
    } else {
        // Show no results
        elements.nftGrid.innerHTML = '<div class="no-results">No NFT found with ID #' + searchNum + '</div>';
    }
}

// ============================================
// FILTERS
// ============================================
function setupFilters() {
    // Count traits
    traitCounts = {};
    allNFTs.forEach(nft => {
        Object.entries(nft.traits).forEach(([type, value]) => {
            if (!traitCounts[type]) traitCounts[type] = {};
            traitCounts[type][value] = (traitCounts[type][value] || 0) + 1;
        });
    });

    // Render filter groups
    elements.filterGroups.innerHTML = '';

    Object.entries(traitCounts).forEach(([traitType, values]) => {
        const sortedValues = Object.entries(values).sort((a, b) => a[0].localeCompare(b[0]));

        const group = document.createElement('div');
        group.className = 'filter-group';
        group.innerHTML = `
            <div class="filter-group-header" data-trait="${traitType}">
                <h3>${traitType}</h3>
                <span class="chevron">+</span>
            </div>
            <div class="filter-options" style="display: none;">
                <input type="text" class="filter-search" placeholder="Search ${traitType}...">
                <div class="filter-options-list">
                    ${sortedValues.map(([value, count]) => `
                        <label class="filter-option" data-trait="${traitType}" data-value="${value}">
                            <input type="checkbox" class="filter-checkbox">
                            <span class="filter-value">${value}</span>
                            <span class="count">${count}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;

        // Toggle group
        group.querySelector('.filter-group-header').addEventListener('click', () => {
            const options = group.querySelector('.filter-options');
            const chevron = group.querySelector('.chevron');
            const isHidden = options.style.display === 'none';
            options.style.display = isHidden ? 'flex' : 'none';
            chevron.textContent = isHidden ? '−' : '+';
            
            // Focus search input when opened
            if (isHidden) {
                const searchInput = group.querySelector('.filter-search');
                setTimeout(() => searchInput.focus(), 10);
            }
        });

        // Search within filter options
        group.querySelector('.filter-search').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const options = group.querySelectorAll('.filter-option');
            options.forEach(option => {
                const value = option.dataset.value.toLowerCase();
                option.style.display = value.includes(query) ? 'flex' : 'none';
            });
        });

        // Filter checkbox changes
        group.querySelectorAll('.filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const option = checkbox.closest('.filter-option');
                const trait = option.dataset.trait;
                const value = option.dataset.value;

                if (!activeFilters[trait]) {
                    activeFilters[trait] = [];
                }

                if (checkbox.checked) {
                    activeFilters[trait].push(value);
                } else {
                    activeFilters[trait] = activeFilters[trait].filter(v => v !== value);
                    if (activeFilters[trait].length === 0) {
                        delete activeFilters[trait];
                    }
                }

                applyFilters();
            });
        });

        elements.filterGroups.appendChild(group);
    });
}

function mineFilterOn() {
    return elements.mineToggle.checked && myWallets.size > 0;
}

function anyFilterOn() {
    return Object.keys(activeFilters).length > 0 || elements.oneOfOnesToggle.checked || mineFilterOn();
}

function applyFilters() {
    const showOneOfOnesOnly = elements.oneOfOnesToggle.checked;
    const mineOnly = mineFilterOn();

    if (!anyFilterOn()) {
        filteredNFTs = [...allNFTs];
    } else {
        filteredNFTs = allNFTs.filter(nft => {
            // Check trait filters
            const matchesTraits = Object.keys(activeFilters).length === 0 ||
                Object.entries(activeFilters).every(([type, values]) =>
                    values.includes(nft.traits[type])
                );

            // Check 1/1 filter - the "1/1" trait should NOT be "None"
            const isOneOfOne = !showOneOfOnesOnly ||
                (nft.traits['1/1'] && nft.traits['1/1'].toLowerCase() !== 'none');

            const isMine = !mineOnly || myWallets.has(nft.owner);

            return matchesTraits && isOneOfOne && isMine;
        });
    }

    renderActiveFilters();
    applySort();
}

function renderActiveFilters() {
    elements.activeFilters.innerHTML = '';

    if (mineFilterOn()) {
        const tag = document.createElement('div');
        tag.className = 'active-filter';
        tag.innerHTML = '<span>My MidEvils</span><button type="button" aria-label="Remove">&times;</button>';
        tag.querySelector('button').addEventListener('click', () => {
            elements.mineToggle.checked = false;
            applyFilters();
        });
        elements.activeFilters.appendChild(tag);
    }

    if (Object.keys(activeFilters).length === 0) {
        if (!mineFilterOn()) elements.activeFilters.innerHTML = '<span class="no-filters">None</span>';
        return;
    }

    Object.entries(activeFilters).forEach(([type, values]) => {
        values.forEach(value => {
            const tag = document.createElement('div');
            tag.className = 'active-filter';
            tag.innerHTML = `
                <span>${type}: ${value}</span>
                <button data-trait="${type}" data-value="${value}">&times;</button>
            `;

            tag.querySelector('button').addEventListener('click', (e) => {
                const trait = e.target.dataset.trait;
                const val = e.target.dataset.value;

                // Uncheck the checkbox
                const checkbox = document.querySelector(`.filter-option[data-trait="${trait}"][data-value="${val}"] .filter-checkbox`);
                if (checkbox) checkbox.checked = false;

                // Remove from activeFilters
                activeFilters[trait] = activeFilters[trait].filter(v => v !== val);
                if (activeFilters[trait].length === 0) {
                    delete activeFilters[trait];
                }
                applyFilters();
            });

            elements.activeFilters.appendChild(tag);
        });
    });
}

function clearFilters() {
    activeFilters = {};
    elements.oneOfOnesToggle.checked = false;
    elements.mineToggle.checked = false;
    document.querySelectorAll('.filter-groups .filter-checkbox').forEach(cb => cb.checked = false);
    applyFilters();
}

// ============================================
// SORTING
// ============================================
function applySort() {
    const sortBy = elements.sortSelect.value;
    // An empty result from active filters must stay empty (e.g. a wallet with no MidEvils)
    const nfts = filteredNFTs.length > 0 || anyFilterOn()
        ? [...filteredNFTs]
        : [...allNFTs];

    if (sortBy === 'random') {
        // Fisher-Yates shuffle
        for (let i = nfts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nfts[i], nfts[j]] = [nfts[j], nfts[i]];
        }
    } else if (sortBy === 'number') {
        nfts.sort((a, b) => a.number - b.number);
    } else {
        nfts.sort((a, b) => {
            const valA = a.traits[sortBy] || '';
            const valB = b.traits[sortBy] || '';
            return valA.localeCompare(valB);
        });
    }

    filteredNFTs = nfts;
    renderNFTs();
}

// ============================================
// NFT RENDERING
// ============================================
function renderNFTs(reset = true) {
    if (reset) {
        elements.nftGrid.innerHTML = '';
        currentPage = 0;
        if (filteredNFTs.length === 0 && allNFTs.length > 0) {
            const set = elements.graveyardToggle.checked ? 'Graveyard MidEvils' : 'MidEvils';
            elements.nftGrid.innerHTML = mineFilterOn()
                ? `<div class="no-results">No ${set} in ${myWallets.size === 1 ? 'this wallet' : 'these wallets'}${anyTraitOrOneOfOne() ? ' with these filters' : ''}</div>`
                : '<div class="no-results">No MidEvils match these filters</div>';
            return;
        }
    }

    const start = currentPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const nftsToRender = filteredNFTs.slice(start, end);

    nftsToRender.forEach(nft => {
        const card = document.createElement('div');
        card.className = 'nft-card';

        const inner = document.createElement('div');
        inner.className = 'nft-card-inner';

        const img = document.createElement('img');
        img.className = 'nft-image loading';
        img.alt = nft.name;
        img.loading = 'lazy';
        img.onload = () => {
            img.classList.remove('loading');
            img.classList.add('loaded');
        };
        // If a thumbnail fails: R2 thumb -> Helius resize -> full image, each tried once
        const fallbacks = [nft.thumbnailFallback, nft.imageUrl].filter(Boolean);
        img.onerror = () => {
            const next = fallbacks.shift();
            if (next) img.src = next;
        };
        // Use pre-cached CDN thumbnail for fast loading
        img.src = nft.thumbnailUrl;

        const info = document.createElement('div');
        info.className = 'nft-info';
        info.innerHTML = `<div class="nft-name">${nft.name}</div>`;

        inner.appendChild(img);
        inner.appendChild(info);
        card.appendChild(inner);

        card.addEventListener('click', () => showDetails(nft));

        elements.nftGrid.appendChild(card);
    });

    currentPage++;
    isLoadingMore = false;
}

function loadMoreIfNeeded() {
    if (isLoadingMore) return;
    
    const scrollY = window.scrollY + window.innerHeight;
    const pageHeight = document.documentElement.scrollHeight;
    
    // Load more when user is within 500px of bottom
    if (scrollY >= pageHeight - 500) {
        const totalLoaded = currentPage * ITEMS_PER_PAGE;
        if (totalLoaded < filteredNFTs.length) {
            isLoadingMore = true;
            renderNFTs(false);
        }
    }
}

// Infinite scroll listener
window.addEventListener('scroll', loadMoreIfNeeded);

// ============================================
// NFT DETAILS
// ============================================
function showDetails(nft) {
    elements.detailsTitle.textContent = nft.name;
    elements.detailsImage.src = nft.imageUrl;
    elements.detailsTraits.innerHTML = Object.entries(nft.traits)
        .map(([type, value]) => `
            <div class="trait-item">
                <div class="trait-type">${type}</div>
                <div class="trait-value">${value}</div>
            </div>
        `).join('');
    elements.detailsMint.textContent = nft.mint;
    elements.downloadBtn.onclick = () => downloadFullImage(nft);
    elements.downloadBtn.textContent = 'Download full size';
    elements.downloadBtn.disabled = !nft.imageUrl;
    elements.detailsModal.style.display = 'flex';
}

// Downloads the original full-resolution image (not the resized tile).
// Fetch as a blob so the browser saves it with a proper name instead of navigating
// (the download attribute is ignored for cross-origin links like arweave.net).
async function downloadFullImage(nft) {
    const btn = elements.downloadBtn;
    if (!nft.imageUrl || btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Downloading…';
    try {
        const response = await fetch(nft.imageUrl);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const blob = await response.blob();
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[blob.type] || 'png';
        const fileName = `${nft.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.${ext}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        btn.textContent = 'Download full size';
    } catch (err) {
        // Fallback: open the original in a new tab so it can be saved manually
        window.open(nft.imageUrl, '_blank', 'noopener');
        btn.textContent = 'Download full size';
    }
    btn.disabled = false;
}

function closeDetails() {
    elements.detailsModal.style.display = 'none';
}

// ============================================
// WALLET ("My MidEvils")
// ============================================
// Connect-only: we ask the wallet for its public address and nothing else. No signMessage,
// no transactions, so there is nothing for Phantom to warn about. Ownership comes from the
// collection data already loaded (owner field, refreshed every 5 minutes on the server);
// staked MidEvils still list the holder as owner.
const WALLET_STORE = 'midevils-gallery.wallet';
const MAX_PASTED = 20;
const CONNECT_SLOW_MS = 5000;   // after this, explain what to check (but keep waiting)
const CONNECT_GIVE_UP_MS = 60000;

let myWallets = new Set();
let connected = null; // { key, name, provider, address } when connected through a wallet
const watchedProviders = new WeakSet();

const enc = encodeURIComponent;
const WALLETS = [
    {
        key: 'phantom', name: 'Phantom',
        get: () => (window.phantom?.solana?.isPhantom ? window.phantom.solana : (window.solana?.isPhantom ? window.solana : null)),
        browse: (u) => `https://phantom.app/ul/browse/${enc(u)}?ref=${enc(u)}`,
        install: 'https://phantom.app/download'
    },
    {
        key: 'solflare', name: 'Solflare',
        get: () => (window.solflare?.isSolflare ? window.solflare : null),
        browse: (u) => `https://solflare.com/ul/v1/browse/${enc(u)}?ref=${enc(u)}`,
        install: 'https://solflare.com/download'
    },
    {
        key: 'backpack', name: 'Backpack',
        get: () => (window.backpack?.solana?.connect ? window.backpack.solana : (window.backpack?.connect ? window.backpack : null)),
        browse: null,
        install: 'https://backpack.app/downloads'
    }
];

function isAddress(s) {
    return typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function shortAddress(a) {
    return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || ''));
}

function anyTraitOrOneOfOne() {
    return Object.keys(activeFilters).length > 0 || elements.oneOfOnesToggle.checked;
}

function setWalletStatus(text, isError = false) {
    elements.walletStatus.textContent = text;
    elements.walletStatus.classList.toggle('error', isError);
}

function saveWalletState() {
    try {
        if (myWallets.size === 0) localStorage.removeItem(WALLET_STORE);
        else localStorage.setItem(WALLET_STORE, JSON.stringify({
            wallet: connected?.key || null,
            addresses: [...myWallets],
            mine: elements.mineToggle.checked
        }));
    } catch { /* private mode etc. — just don't remember */ }
}

function loadWalletState() {
    try {
        const saved = JSON.parse(localStorage.getItem(WALLET_STORE) || 'null');
        if (saved && Array.isArray(saved.addresses)) {
            const addresses = saved.addresses.filter(isAddress).slice(0, MAX_PASTED);
            if (addresses.length) return { ...saved, addresses };
        }
    } catch { /* ignore */ }
    return null;
}

function updateMineCount() {
    if (myWallets.size === 0) return;
    const count = allNFTs.filter(n => myWallets.has(n.owner)).length;
    elements.mineToggleLabel.textContent = `${elements.graveyardToggle.checked ? 'My Graveyard' : 'My MidEvils'} (${count})`;
}

function updateWalletButton() {
    const btn = elements.walletBtn;
    if (myWallets.size === 0) {
        btn.textContent = 'Connect wallet';
        btn.classList.remove('connected');
    } else {
        btn.textContent = myWallets.size === 1 ? shortAddress([...myWallets][0]) : `${myWallets.size} wallets`;
        btn.classList.add('connected');
    }
}

// Sets which wallets count as "mine" and turns the My MidEvils filter on (or keeps the saved state)
function setMyWallets(addresses, { showMine = true } = {}) {
    myWallets = new Set(addresses);
    elements.mineToggleWrap.hidden = myWallets.size === 0;
    elements.mineToggle.checked = myWallets.size > 0 && showMine;
    updateWalletButton();
    updateMineCount();
    saveWalletState();
    if (allNFTs.length) applyFilters();
}

function disconnectWallet() {
    const provider = connected?.provider;
    connected = null;
    try { provider?.disconnect?.(); } catch { /* ignore */ }
    setMyWallets([]);
    renderWalletOptions();
    setWalletStatus('');
}

function watchAccount(provider) {
    if (watchedProviders.has(provider) || typeof provider.on !== 'function') return;
    watchedProviders.add(provider);
    try {
        provider.on('accountChanged', (pk) => {
            // Phantom sends null when switching to an account this site hasn't seen; keep the old view then
            const address = pk?.toString?.();
            if (connected?.provider === provider && isAddress(address)) {
                connected.address = address;
                setMyWallets([address]);
            }
        });
        provider.on('disconnect', () => {
            if (connected?.provider === provider) disconnectWallet();
        });
    } catch { /* some wallets don't emit events */ }
}

function friendlyWalletError(err, name) {
    const code = err?.code;
    if (code === 4001) return 'Cancelled. Tap the wallet to try again.';
    if (code === 4100) return `${name} refused the request. Close every ${name} browser tab, restart ${name}, then try again.`;
    if (code === 'timeout') return `No answer from ${name}. Make sure it's unlocked, then try again.`;
    return `Couldn't connect to ${name}${err?.message ? `: ${err.message}` : ''}.`;
}

async function connectWallet(wallet) {
    const provider = wallet.get();
    if (!provider) {
        setWalletStatus(`${wallet.name} not found in this browser.`, true);
        return;
    }
    setWalletStatus(`Approve the connection in ${wallet.name}…`);
    let giveUpTimer;
    const slowTimer = setTimeout(() => {
        setWalletStatus(`Still waiting for ${wallet.name}. No popup? Unlock ${wallet.name} and check its window.`);
    }, CONNECT_SLOW_MS);
    try {
        const resp = await Promise.race([
            provider.connect(),
            new Promise((_, reject) => { giveUpTimer = setTimeout(() => reject({ code: 'timeout' }), CONNECT_GIVE_UP_MS); })
        ]);
        const address = (resp?.publicKey || provider.publicKey)?.toString?.();
        if (!isAddress(address)) throw new Error('no address returned');
        connected = { key: wallet.key, name: wallet.name, provider, address };
        watchAccount(provider);
        setMyWallets([address]);
        setWalletStatus('');
        closeWalletModal();
    } catch (err) {
        setWalletStatus(friendlyWalletError(err, wallet.name), true);
    } finally {
        clearTimeout(slowTimer);
        clearTimeout(giveUpTimer);
    }
}

function usePastedAddresses() {
    const parts = elements.walletPaste.value.split(/[\s,;]+/).filter(Boolean);
    if (parts.length === 0) {
        setWalletStatus('Paste at least one wallet address.', true);
        return;
    }
    const bad = parts.find(p => !isAddress(p));
    if (bad) {
        setWalletStatus(`Not a Solana address: ${bad.slice(0, 48)}`, true);
        return;
    }
    const addresses = [...new Set(parts)];
    if (addresses.length > MAX_PASTED) {
        setWalletStatus(`Up to ${MAX_PASTED} addresses at a time.`, true);
        return;
    }
    if (connected) {
        try { connected.provider?.disconnect?.(); } catch { /* ignore */ }
        connected = null;
    }
    setMyWallets(addresses);
    setWalletStatus('');
    elements.walletPaste.value = '';
    closeWalletModal();
}

function renderWalletOptions() {
    const box = elements.walletOptions;
    box.innerHTML = '';

    if (myWallets.size > 0) {
        const current = document.createElement('div');
        current.className = 'wallet-current';
        const label = connected ? `Connected with ${connected.name}` : (myWallets.size === 1 ? 'Showing wallet' : `Showing ${myWallets.size} wallets`);
        // Addresses are validated base58, safe to put in HTML
        current.innerHTML = `<div class="wallet-current-label">${label}</div>` +
            [...myWallets].map(a => `<div class="wallet-current-addr">${a}</div>`).join('');
        const off = document.createElement('button');
        off.type = 'button';
        off.className = 'wallet-option wallet-disconnect';
        off.textContent = connected ? 'Disconnect' : 'Clear wallets';
        off.addEventListener('click', disconnectWallet);
        current.appendChild(off);
        box.appendChild(current);
    }

    const installed = WALLETS.filter(w => w.get());
    installed.forEach(w => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'wallet-option';
        b.textContent = connected?.key === w.key ? `${w.name} (switch account)` : w.name;
        b.addEventListener('click', () => connectWallet(w));
        box.appendChild(b);
    });

    if (installed.length === 0) {
        if (isMobile()) {
            // Regular phone browsers have no wallet injected: open this page inside the wallet's browser
            const here = location.href.split('#')[0];
            WALLETS.filter(w => w.browse).forEach(w => {
                const a = document.createElement('a');
                a.className = 'wallet-option';
                a.href = w.browse(here);
                a.textContent = `Open in ${w.name}`;
                box.appendChild(a);
            });
        } else {
            const p = document.createElement('p');
            p.className = 'wallet-none';
            p.innerHTML = 'No wallet extension found. Get ' +
                WALLETS.map(w => `<a href="${w.install}" target="_blank" rel="noopener">${w.name}</a>`).join(', ') +
                ', or paste an address below.';
            box.appendChild(p);
        }
    }
}

function openWalletModal() {
    setWalletStatus('');
    renderWalletOptions();
    elements.walletModal.style.display = 'flex';
}

function closeWalletModal() {
    elements.walletModal.style.display = 'none';
}

elements.walletBtn.addEventListener('click', openWalletModal);
elements.closeWallet.addEventListener('click', closeWalletModal);
elements.walletPasteBtn.addEventListener('click', usePastedAddresses);
elements.walletModal.addEventListener('click', (e) => {
    if (e.target === elements.walletModal) closeWalletModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.walletModal.style.display !== 'none') closeWalletModal();
});
elements.mineToggle.addEventListener('change', saveWalletState);

// Returning visitor: show their saved wallets right away (public data, no wallet needed), then
// quietly re-attach Phantom only if it already trusts this site (no popup otherwise).
function restoreWallet() {
    const saved = loadWalletState();
    if (!saved) return;
    setMyWallets(saved.addresses, { showMine: saved.mine !== false });
    if (saved.wallet !== 'phantom' || saved.addresses.length !== 1) return;
    // Wallets can inject late; wait a moment before looking
    setTimeout(async () => {
        const wallet = WALLETS.find(w => w.key === 'phantom');
        const provider = wallet.get();
        if (!provider) return;
        try {
            const resp = await provider.connect({ onlyIfTrusted: true });
            const address = (resp?.publicKey || provider.publicKey)?.toString?.();
            if (!isAddress(address)) return;
            connected = { key: wallet.key, name: wallet.name, provider, address };
            watchAccount(provider);
            if (!myWallets.has(address) || myWallets.size !== 1) setMyWallets([address], { showMine: elements.mineToggle.checked });
            else saveWalletState();
        } catch { /* not trusted any more: keep showing the saved address */ }
    }, 800);
}

// ============================================
// INITIALIZE
// ============================================
restoreWallet();
fetchCollection();
