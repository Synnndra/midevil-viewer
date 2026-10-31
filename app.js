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
    downloadBtn: document.getElementById('downloadBtn')
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
        applySort();
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
        // If search is empty, clear search and show all
        filteredNFTs = Object.keys(activeFilters).length > 0
            ? allNFTs.filter(nft => Object.entries(activeFilters).every(([type, values]) => values.includes(nft.traits[type])))
            : [...allNFTs];
        applySort();
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

function applyFilters() {
    const showOneOfOnesOnly = elements.oneOfOnesToggle.checked;

    if (Object.keys(activeFilters).length === 0 && !showOneOfOnesOnly) {
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

            return matchesTraits && isOneOfOne;
        });
    }

    renderActiveFilters();
    applySort();
}

function renderActiveFilters() {
    elements.activeFilters.innerHTML = '';

    if (Object.keys(activeFilters).length === 0) {
        elements.activeFilters.innerHTML = '<span class="no-filters">None</span>';
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
    document.querySelectorAll('.filter-groups .filter-checkbox').forEach(cb => cb.checked = false);
    applyFilters();
}

// ============================================
// SORTING
// ============================================
function applySort() {
    const sortBy = elements.sortSelect.value;
    const nfts = filteredNFTs.length > 0 || Object.keys(activeFilters).length > 0
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
// INITIALIZE
// ============================================
fetchCollection();
