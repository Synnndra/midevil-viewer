// Simple local development server
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'fae97e4f-e2de-46d7-828f-9e18aec8e579';

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
    // Handle API requests
    if (req.url === '/api/helius' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { collection, page = 1 } = JSON.parse(body);

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
                            page: page,
                            limit: 1000,
                            displayOptions: { showCollectionMetadata: true }
                        }
                    })
                });

                const data = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data.result || { items: [] }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`MidEvil Viewer running at http://localhost:${PORT}`);
});
