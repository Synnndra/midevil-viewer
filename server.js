// Local dev server: serves the static site and runs the same /api/helius handler Vercel uses.
// Key comes from HELIUS_API_KEY or .env.local (gitignored). Never hardcode it here.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import heliusHandler from './api/helius.js';
import collectionHandler from './api/collection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// Load .env.local if present (no dependency needed)
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.json': 'application/json'
};

// Minimal shim so the Vercel-style handler (req.body, res.status().json()) runs under node:http
function vercelRes(res) {
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
        return res;
    };
    res.send = (body) => { res.end(body); return res; };
    return res;
}

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

    if (urlPath === '/api/collection') {
        Promise.resolve(collectionHandler(req, vercelRes(res))).catch((err) => {
            console.error(err);
            if (!res.headersSent) vercelRes(res).status(500).json({ error: 'Server error' });
        });
        return;
    }

    if (urlPath === '/api/helius') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
            try {
                req.body = body ? JSON.parse(body) : {};
            } catch {
                return vercelRes(res).status(400).json({ error: 'Invalid JSON' });
            }
            await heliusHandler(req, vercelRes(res));
        });
        return;
    }

    // Static files (query strings like ?v=20260202 are ignored; no escaping the project dir)
    const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
    const rel = path.relative(__dirname, filePath);
    if (!filePath.startsWith(__dirname + path.sep) || /(^|[\\/])\./.test(rel) || /^(api|node_modules)([\\/]|$)|^(server\.js|package\.json|vercel\.json)$/.test(rel)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`MidEvil Gallery running at http://localhost:${PORT}`);
    if (!process.env.HELIUS_API_KEY) console.warn('WARNING: HELIUS_API_KEY not set — /api/helius will return 500');
});
