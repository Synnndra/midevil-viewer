// MidEvil NFT Gallery

// ============================================
// CONFIGURATION
// ============================================
const MIDEVIL_COLLECTION = 'w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW';
const GRAVEYARD_COLLECTION = 'DpYLtgV5XcWPt3TM9FhXEh8uNg6QFYrj3zCGZxpcA3vF';
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
    searchBtn: document.getElementById('searchBtn'),
    sidebar: document.getElementById('sidebar'),
    filterToggle: document.getElementById('filterToggle'),
    graveyardToggle: document.getElementById('graveyardToggle'),
    filterGroups: document.getElementById('filterGroups'),
    activeFilters: document.getElementById('activeFilters'),
    clearFilters: document.getElementById('clearFilters'),
    nftGrid: document.getElementById('nftGrid'),
    detailsModal: document.getElementById('detailsModal'),
    closeDetails: document.getElementById('closeDetails'),
    detailsTitle: document.getElementById('detailsTitle'),
    detailsImage: document.getElementById('detailsImage'),
    detailsTraits: document.getElementById('detailsTraits'),
    detailsMint: document.getElementById('detailsMint')
};

// ============================================
// STATE
// ============================================
let allNFTs = [];
let filteredNFTs = [];
let activeFilters = {};
let traitCounts = {};
let graveyardIds = new Set();

// ============================================
// EVENT LISTENERS
// ============================================
elements.filterToggle.addEventListener('click', toggleSidebar);
elements.graveyardToggle.addEventListener('change', fetchCollection);
elements.clearFilters.addEventListener('click', clearFilters);
elements.sortSelect.addEventListener('change', applySort);
elements.searchBtn.addEventListener('click', searchById);
elements.searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') searchById();
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
async function fetchGraveyardIds() {
    graveyardIds.clear();
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const response = await fetch('/api/helius', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: GRAVEYARD_COLLECTION, page })
        });

        if (!response.ok) break;

        const data = await response.json();
        const items = data.items || [];

        items.forEach(nft => graveyardIds.add(nft.id));

        hasMore = items.length === 1000;
        page++;
    }
}

async function fetchCollection() {
    showLoading(true);
    hideError();
    allNFTs = [];
    filteredNFTs = [];
    activeFilters = {};

    const showGraveyard = elements.graveyardToggle.checked;

    // If showing main collection, first get graveyard IDs to exclude
    if (!showGraveyard && graveyardIds.size === 0) {
        await fetchGraveyardIds();
    }

    const collection = showGraveyard ? GRAVEYARD_COLLECTION : MIDEVIL_COLLECTION;

    try {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch('/api/helius', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ collection, page })
            });

            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();
            const items = data.items || [];

            items.forEach(nft => {
                const name = nft.content?.metadata?.name || '';
                const isBurnt = nft.burnt === true;
                const hasGraveyardInName = name.toLowerCase().includes('graveyard');

                // If showing main collection, exclude graveyard NFTs
                if (!showGraveyard) {
                    if (graveyardIds.has(nft.id) || hasGraveyardInName || isBurnt) {
                        return; // Skip this NFT
                    }
                }

                const number = extractNumber(name);
                const displayName = name ? name.replace(/#?\d+/, `#${number}`) : 'Unknown';

                allNFTs.push({
                    id: nft.id,
                    name: displayName,
                    number: number,
                    imageUrl: getImageUrl(nft),
                    traits: extractTraits(nft.content?.metadata?.attributes || []),
                    mint: nft.id
                });
            });

            hasMore = items.length === 1000;
            page++;
        }

        if (allNFTs.length === 0) {
            showError('No NFTs found in the collection');
            showLoading(false);
            return;
        }

        elements.totalCount.textContent = `${allNFTs.length} Items`;
        setupFilters();
        applySort();
    } catch (err) {
        showError('Failed to fetch collection: ' + err.message);
    }

    showLoading(false);
}

function extractNumber(name) {
    const match = name?.match(/#?(\d+)/);
    return match ? parseInt(match[1]) + 1 : 0;
}

function getImageUrl(nft) {
    // Try to get optimized/smaller image first
    const links = nft.content?.links || {};
    const files = nft.content?.files || [];

    // Prefer CDN links which are usually faster
    if (links.image) {
        // Add size parameter if it's an Arweave or IPFS gateway
        let url = links.image;
        if (url.includes('arweave.net') || url.includes('ipfs')) {
            // Return as-is, these are usually already optimized
            return url;
        }
        return url;
    }

    // Fall back to first file
    if (files.length > 0) {
        return files[0].uri || files[0].cdn_uri || '';
    }

    return '';
}

function extractTraits(attributes) {
    const traits = {};
    attributes.forEach(attr => {
        if (attr.trait_type && attr.value) {
            traits[attr.trait_type] = attr.value;
        }
    });
    return traits;
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
                ${sortedValues.map(([value, count]) => `
                    <label class="filter-option" data-trait="${traitType}" data-value="${value}">
                        <input type="checkbox" class="filter-checkbox">
                        <span class="filter-value">${value}</span>
                        <span class="count">${count}</span>
                    </label>
                `).join('')}
            </div>
        `;

        // Toggle group
        group.querySelector('.filter-group-header').addEventListener('click', () => {
            const options = group.querySelector('.filter-options');
            const chevron = group.querySelector('.chevron');
            const isHidden = options.style.display === 'none';
            options.style.display = isHidden ? 'flex' : 'none';
            chevron.textContent = isHidden ? '−' : '+';
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
    if (Object.keys(activeFilters).length === 0) {
        filteredNFTs = [...allNFTs];
    } else {
        filteredNFTs = allNFTs.filter(nft => {
            return Object.entries(activeFilters).every(([type, values]) =>
                values.includes(nft.traits[type])
            );
        });
    }

    renderActiveFilters();
    applySort();
}

function renderActiveFilters() {
    elements.activeFilters.innerHTML = '';

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
    document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
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
function renderNFTs() {
    elements.nftGrid.innerHTML = '';

    filteredNFTs.forEach(nft => {
        const card = document.createElement('div');
        card.className = 'nft-card';

        const img = document.createElement('img');
        img.className = 'nft-image loading';
        img.alt = nft.name;
        img.loading = 'lazy';
        img.onload = () => {
            img.classList.remove('loading');
            img.classList.add('loaded');
        };
        img.src = nft.imageUrl;

        const info = document.createElement('div');
        info.className = 'nft-info';
        info.innerHTML = `<div class="nft-name">${nft.name}</div>`;

        card.appendChild(img);
        card.appendChild(info);

        card.addEventListener('click', () => showDetails(nft));

        elements.nftGrid.appendChild(card);
    });
}

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
    elements.detailsModal.style.display = 'flex';
}

function closeDetails() {
    elements.detailsModal.style.display = 'none';
}

// ============================================
// INITIALIZE
// ============================================
fetchCollection();
