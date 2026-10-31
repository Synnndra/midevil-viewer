// GET /api/collection?set=main|graveyard
// Fetches the whole collection from Helius on the server (pages in parallel), drops burnt items,
// and returns only the fields the gallery uses. Cached for 5 minutes (CDN + in-memory), so
// visitors get one small cached response and Helius is hit about once per 5 minutes in total.

const SETS = {
    main: 'w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW',      // MidEvils
    graveyard: 'DpYLtgV5XcWPt3TM9FhXEh8uNg6QFYrj3zCGZxpcA3vF', // Graveyard
};
const PAGE_SIZE = 1000;
const PAGES_PER_WAVE = 4;   // main is ~7 pages → 2 waves
const MAX_PAGES = 20;
const CACHE_MS = 5 * 60 * 1000;
const THUMB_PARAMS = 'width=400,quality=80,format=auto';
const R2_THUMBS = 'https://assets.midevils.com/thumbs/400';

const memoryCache = new Map(); // set -> { at, body }
const inFlight = new Map();    // set -> Promise<body>, so concurrent misses share one Helius fetch

async function fetchPage(apiKey, collection, page) {
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'midevil-gallery',
            method: 'getAssetsByGroup',
            params: { groupKey: 'collection', groupValue: collection, page, limit: PAGE_SIZE },
        }),
    });
    if (!response.ok) throw new Error(`Helius HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`Helius: ${data.error.message}`);
    return data.result?.items || [];
}

async function fetchAll(apiKey, collection) {
    const items = [];
    for (let start = 1; start <= MAX_PAGES; start += PAGES_PER_WAVE) {
        const pages = [];
        for (let p = start; p < start + PAGES_PER_WAVE && p <= MAX_PAGES; p++) pages.push(p);
        const results = await Promise.all(pages.map((p) => fetchPage(apiKey, collection, p)));
        for (const r of results) items.push(...r);
        if (results[results.length - 1].length < PAGE_SIZE) break; // last page reached
    }
    return items;
}

function slim(nft, set) {
    const file = nft.content?.files?.[0] || {};
    const links = nft.content?.links || {};
    const image = file.uri || links.image || '';
    let heliusThumb = file.cdn_uri || image;
    // Helius CDN serves the 2048px original unless asked to resize; tiles are ~200px.
    heliusThumb = heliusThumb.replace('cdn.helius-rpc.com/cdn-cgi/image//', `cdn.helius-rpc.com/cdn-cgi/image/${THUMB_PARAMS}/`);

    // Main collection: pre-made 400px WebP thumbnails on our R2 (made from the archive originals).
    // The browser falls back to the Helius resize if one is missing.
    const thumb = set === 'main' ? `${R2_THUMBS}/${nft.id}.webp` : heliusThumb;
    const thumbFallback = set === 'main' ? heliusThumb : '';

    const traits = {};
    for (const a of nft.content?.metadata?.attributes || []) {
        if (a.trait_type && a.value) traits[a.trait_type] = a.value;
    }
    // owner = holder wallet (staked/frozen MidEvils still list the holder as owner) — used by "My MidEvils"
    return { id: nft.id, name: nft.content?.metadata?.name || '', image, thumb, thumbFallback, traits, owner: nft.ownership?.owner || '' };
}

async function build(apiKey, set) {
    const raw = await fetchAll(apiKey, SETS[set]);
    const items = set === 'main'
        // Main grid hides burnt assets and anything named "Graveyard" (same rule as before)
        ? raw.filter((n) => n.burnt !== true && !(n.content?.metadata?.name || '').toLowerCase().includes('graveyard'))
        : raw;
    return JSON.stringify({ set, count: items.length, updatedAt: new Date().toISOString(), items: items.map((n) => slim(n, set)) });
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    const set = new URL(req.url, 'http://localhost').searchParams.get('set') || 'main';
    if (!SETS[set]) {
        return res.status(400).json({ error: 'Unknown set' });
    }

    try {
        let cached = memoryCache.get(set);
        if (!cached || Date.now() - cached.at > CACHE_MS) {
            if (!inFlight.has(set)) {
                inFlight.set(set, build(apiKey, set).finally(() => inFlight.delete(set)));
            }
            cached = { at: Date.now(), body: await inFlight.get(set) };
            memoryCache.set(set, cached);
        }

        // Vercel CDN keeps it 5 min, then serves the stale copy while refreshing in the background
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(cached.body);
    } catch (error) {
        console.error('Collection fetch error:', error);
        // Helius hiccup: serve the last good copy if we have one, but don't let the CDN keep it long
        const stale = memoryCache.get(set);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(stale.body);
        }
        res.setHeader('Cache-Control', 'no-store');
        return res.status(502).json({ error: 'Failed to fetch collection' });
    }
}
