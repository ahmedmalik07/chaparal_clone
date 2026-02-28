# Chaparral Clone — Stingray Boats Configurator (Proof of Concept)

A pixel-accurate recreation of the [Chaparral Boats](https://www.chaparralboats.com) website's **SSi Outboard models listing** and **interactive boat builder/configurator**, rebranded as **Stingray Boats** for client demonstration purposes.

## 🚀 Live Demo

Serve locally and open:
- **Models page:** `http://localhost:8089/index.html`
- **Boat builder:** `http://localhost:8089/configurator.html?model=19ssiob`

---

## 📁 Project Structure

```
chaparal_clone/
├── index.html              # Models listing page (SSi Outboard lineup)
├── configurator.html       # Interactive boat builder / configurator
├── css/
│   ├── models.css          # Styles for models listing page
│   └── configurator.css    # Styles for boat builder page
├── js/
│   ├── models.js           # Models page interactivity
│   └── configurator.js     # Full configurator logic & state management
├── images/                 # Local image assets (placeholder)
├── package.json            # Dev scripts
└── README.md               # This file
```

---

## ✨ Features

### Models Listing Page (`index.html`)
- Responsive header with navigation
- Hero banner with model line tabs (SSi OB, SSX, OSX)
- 4 model cards: **19 SSi OB**, **21 SSi OB**, **21 SSi OB Ski & Fish**, **23 SSi OB**
- Each card shows specs (length, beam, capacity, weight), pricing, and "BUILD YOURS" CTA
- Full footer with links and cookie notice

### Boat Builder / Configurator (`configurator.html`)
- **7 configuration sections** navigable via dropdown or arrows:
  1. **Exterior Colors/Graphics** — White Hull (4 options), Hull Side (4 options), VX Sport (4 options at $440 each)
  2. **Power** — 5 engines (Yamaha 115/115W/150, Mercury 115/150) + 4 propeller upgrades
  3. **Cockpit Interior** — Sterling (included) or Cayenne White Storm ($265)
  4. **Canvas** — Color selection + Bimini Top, Bow Cover, Cockpit Cover, Full Cover
  5. **Electronics** — Garmin 7"/9" fishfinders, JL Audio stereo/subwoofer
  6. **Accessories** — Ski tow, table, shower, LED lights, carpet, depth finder
  7. **Trailer** — Standard/Aluminum/Black upgraded + spare tire & side guides

- **Real-time layered boat visualization** using 10 composited PNG overlays (1200×460px each)
  - Hull base, arch, deck accent, hull side color, VX sport graphics, interior, engine, trailer, spare tire, side guides
  - Each layer updates independently with smooth fade transitions

- **Dynamic pricing** — "Stingray One Price" and MSRP update in real-time as options change
- **MSRP toggle** — Show/hide manufacturer suggested retail price
- **Save Build / Get Quote** modal with form and build summary
- **Standard features modal** — Full list of included features
- **Responsive design** — Desktop sidebar + mobile stacked layout

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **HTML5 / CSS3 / Vanilla JS** | No frameworks — lightweight, fast, portable |
| **Google Fonts** | Montserrat (headings) + Open Sans (body) |
| **Font Awesome 6.4.0** | Icon library via CDN |
| **CSS Custom Properties** | Theming and consistent design tokens |
| **Image Compositing** | Layered transparent PNGs for real-time boat preview |

---

## 🏃 Running Locally

### Option 1: Python (no install needed)
```bash
cd chaparal_clone
python3 -m http.server 8089
```

### Option 2: Node.js (with live reload)
```bash
cd chaparal_clone
npm run dev
```

Then open `http://localhost:8089` in your browser.

---

## ⚙️ How the Configurator Works

### Image Layer System
The boat preview uses **10 stacked transparent PNG layers**, all exactly **1200×460 pixels**, rendered in a CSS `aspect-ratio` container:

```
Layer 1:  Hull base (white_hull.png)           — always visible
Layer 2:  Arch (arch_black.png)                — always visible
Layer 3:  Deck accent (deckacc_*.png)          — changes with White Hull selection
Layer 4:  Hull side (hullside_*.png)           — optional, from Hull Side group
Layer 5:  VX Sport graphics (vxsport_*.png)    — optional, $440 add-on
Layer 6:  Interior (interior_cayenne.png)      — optional upgrade
Layer 7:  Engine (yamaha_gray*.png)            — changes with engine selection
Layer 8:  Trailer (std/alm/blk_trailer.png)   — changes with trailer selection
Layer 9:  Spare tire overlay                   — checkbox toggle
Layer 10: Side guides                          — checkbox toggle
```

### Pricing Logic
- Base price per model (e.g., 19 SSi OB = $49,955) includes default Yamaha F115XB engine
- Options add/subtract from base: `totalPrice = basePrice + (selectedOptions - defaultEnginePrice)`
- MSRP calculated in parallel with markup

### State Management
All selections stored in a central `selectedOptions` object. Every click triggers:
1. UI state update (selection highlighting)
2. `updatePrice()` — recalculates total
3. `updateBoatImage()` — swaps relevant PNG layer(s)

---

## 🖼️ Image Sources

> **Note:** This is a proof of concept. All boat builder overlay images are loaded from Chaparral Boats' CDN (`https://www.chaparralboats.com/images/builder/`). For production use, images must be self-hosted or replaced with the client's own assets.

---

## 📋 Models Data

| Model | Base Price | MSRP | Length | Beam | Max HP |
|---|---|---|---|---|---|
| 19 SSi OB | $49,955 | $64,130 | 19'3" | 8'0" | 150 |
| 21 SSi OB | $59,455 | $76,230 | 21'5" | 8'6" | 200 |
| 23 SSi OB | $72,455 | $92,130 | 23'0" | 8'6" | 250 |

---

## 📄 License

This project is a **proof of concept** for demonstration purposes only. Not for commercial distribution.

---

## 👤 Author

Ahmed Malik — [@ahmedmalik07](https://github.com/ahmedmalik07)
