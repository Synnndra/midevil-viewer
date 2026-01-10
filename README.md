# MidEvil NFT Gallery

A gallery viewer for the MidEvil NFT collection on Solana. Features filtering by traits, search by ID, and a graveyard toggle.

## Demo

Live at: https://midevil-viewer-v2.vercel.app

## Features

- Browse all MidEvil NFTs
- Filter by traits (background, body, clothes, etc.)
- Search by NFT ID number
- Sort by number or random
- Toggle between main collection and Graveyard MidEvils
- Click any NFT to view larger image and all traits

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Vercel CLI](https://vercel.com/cli) (`npm i -g vercel`)
- A free [Helius](https://helius.dev) API key

### Deploy Your Own

1. **Fork this repository**

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/midevil-viewer-v2.git
   cd midevil-viewer-v2
   ```

3. **Deploy to Vercel**
   ```bash
   vercel
   ```

4. **Add your Helius API key**
   - Go to your project on [Vercel Dashboard](https://vercel.com)
   - Settings → Environment Variables
   - Add `HELIUS_API_KEY` with your API key
   - Redeploy for changes to take effect

### Customization

To use this for a different NFT collection:

1. Edit `app.js` and change the collection addresses:
   ```javascript
   const MIDEVIL_COLLECTION = 'YOUR_COLLECTION_ADDRESS';
   const GRAVEYARD_COLLECTION = 'YOUR_GRAVEYARD_ADDRESS'; // optional
   ```

2. Replace the images:
   - `MidLogo.png` - Your logo
   - `Background.png` - Main background
   - `Background2.jpg` - Header background
   - `Placeholder.jpg` - Placeholder image

3. Update `style.css` for your branding (colors, fonts, etc.)

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- Helius API for Solana NFT data
- Vercel for hosting and serverless functions

## License

MIT
