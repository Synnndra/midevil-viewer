// Vercel Serverless Function to proxy Helius API calls

const ALLOWED_COLLECTIONS = new Set([
    'w44WvLKRdLGye2ghhDJBxcmnWpBo31A1tCBko2G6DgW', // MidEvils
    'DpYLtgV5XcWPt3TM9FhXEh8uNg6QFYrj3zCGZxpcA3vF', // Graveyard
]);
const MAX_PAGE = 20; // 1000 items/page; far above either collection's size

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

    if (!HELIUS_API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    const { collection, page = 1 } = req.body || {};

    if (!collection) {
        return res.status(400).json({ error: 'Collection address required' });
    }

    // Only proxy the collections this gallery shows, so the key can't be used as a free Helius relay.
    if (!ALLOWED_COLLECTIONS.has(collection)) {
        return res.status(403).json({ error: 'Collection not allowed' });
    }

    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > MAX_PAGE) {
        return res.status(400).json({ error: 'Invalid page' });
    }

    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'midevil-viewer',
                method: 'getAssetsByGroup',
                params: {
                    groupKey: 'collection',
                    groupValue: collection,
                    page: pageNum,
                    limit: 1000,
                    displayOptions: {
                        showCollectionMetadata: true
                    }
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ error: data.error.message });
        }

        return res.status(200).json(data.result || { items: [] });
    } catch (error) {
        console.error('Helius API error:', error);
        return res.status(500).json({ error: 'Failed to fetch from Helius' });
    }
}
