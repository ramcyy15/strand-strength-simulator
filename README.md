# Strand Strength Simulator

A small vanilla HTML/CSS/JS web app that simulates whether a strand can support
a given weight. The user enters two numbers — the strand's **tensile strength**
and the **weight** to drop on it — and watches the result. The strand either
stretches and holds or snaps and lets the weight fall.

## File structure

```
COPH-Final-proj/
├── index.html              # markup + script/link tags
├── css/
│   └── styles.css          # all visual styles
├── js/
│   ├── references.js       # optional quick-pick reference values
│   ├── simulation.js       # animation + physics-inspired logic
│   └── main.js             # app entry, event wiring, validation
├── assets/                 # reserved for images / future media
└── README.md
```

### Why split this way?

- **`references.js`** is just a list of example tensile strengths the user can
  click to populate the input. Purely a teaching aid — the simulation does
  not depend on it.
- **`simulation.js`** owns the visual behavior. Its `runSimulation(tensileKg,
  weightKg)` API is generic — no material concept inside.
- **`main.js`** is the controller: reads inputs, validates, calls
  `Simulation.runSimulation`.
- **`css/styles.css`** holds all styling. CSS variables at the top make the
  theme easy to retune.

## Running

Open `index.html` in any modern browser. No build step, no dependencies.

For a clean local server:

```bash
python -m http.server 8000
# visit http://localhost:8000
```

## How the simulation works

1. The user types a **tensile strength** (kg) and a **weight** (kg).
2. Inputs are validated: finite, non-negative, tensile strength > 0.
3. The weight box animates down onto the horizontal strand.
4. If `weight <= tensile strength`, the strand sags proportionally and a
   green "Held!" banner appears.
5. If `weight > tensile strength`, the strand briefly stretches, snaps into
   two hanging halves, the weight falls off-stage, and a red "Snapped!"
   banner appears.

## Reference values

The bottom panel lists rough breaking loads for everyday strands (spider silk
through climbing rope). Clicking a row loads its value into the tensile-strength
input — useful for quick experimentation. To add or remove entries, edit
`js/references.js`.
