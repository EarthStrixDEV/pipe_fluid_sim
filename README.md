# Pipe Flow Lab

An interactive 3D lab bench for steady water flow through a pipe with a valve, a contraction and an expansion, driven by the Bernoulli and continuity equations.

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-0.160-000000?logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?logo=javascript&logoColor=black)

## Overview

Pipe Flow Lab renders a horizontal pipe system in Three.js: a 50 mm main pipe with a gate valve, a reducer into a small pipe (15–50 mm, adjustable), and an expander into an 80 mm outlet pipe. You set the flow rate, small-pipe diameter, valve opening and inlet pressure. The app then computes velocities, pressures at the gauge points and the energy balance, and shows the results on the 3D scene and in readout panels.

The physics code (`src/physics/`) is plain JavaScript with no rendering dependencies. The scene only reads the computed result.

## Features

- Real-time hydraulics that recompute on every slider change (continuity, Bernoulli, valve minor loss)
- Flow limiting: if the inlet pressure cannot push the requested flow through the valve, the actual flow is capped at the achievable maximum
- Cavitation warning when the lowest absolute pressure drops below the vapour pressure of water
- Three display modes: **Water** (realistic), **Pressure** and **Velocity**, the last two coloured along the pipe with a blue-to-red engineering colour ramp and a matching legend
- Clickable pressure gauges (P1–P3) that open a probe panel with local pressure, velocity, flow rate and pipe diameter
- Energy balance table showing pressure head, velocity head, elevation and total head at each point
- Water fill modes: full pipe, half pipe, or a custom level (10–100 % h/D) with a free surface. Partial fill is visual only
- Visual layers: flow tracers (can be toggled), velocity arrows, entrained air bubbles, and shader-based ripples that move at the computed local velocity
- Camera presets (Overview, Valve, Pressure Points, Small Pipe) with smooth fly-to, plus orbit controls

## Physics model

Water at 20 °C. The system is horizontal, so elevation stays the same everywhere ($z = 1.2$ m). Pipe friction is **not** modelled. Head loss comes only from the valve.

| Constant | Value |
|---|---|
| Density $\rho$ | 998.2 kg/m³ |
| Gravity $g$ | 9.81 m/s² |
| Atmospheric pressure $P_{atm}$ | 101 325 Pa |
| Vapour pressure $P_v$ | 2 339 Pa |
| Valve $K$ at 100 % open | 0.25 |
| Main pipe $D_1$ / outlet pipe $D_4$ | 50 mm / 80 mm |

**Continuity**, using the circular cross-section area:

$$
A = \frac{\pi D^2}{4}, \qquad V_i = \frac{Q}{A_i}
$$

**Valve loss.** The loss coefficient grows with the inverse square of the opening fraction $o$:

$$
K(o) = \frac{K_{100\%}}{o^2}, \qquad h_L = K \frac{V_1^2}{2g}
$$

**Maximum achievable flow.** The outlet is open to atmosphere ($P_4 = 0$ gauge) and $P_0$ is the inlet gauge pressure:

$$
P_0 = \tfrac{1}{2}\rho\, Q_{max}^2 \left[ \frac{1}{A_4^2} + \frac{K - 1}{A_1^2} \right]
\quad\Rightarrow\quad Q = \min(Q_{set},\, Q_{max})
$$

**Pressures** (gauge). Loss across the valve, then Bernoulli at constant $z$:

$$
P_1 = P_0, \qquad P_2 = P_1 - \rho g h_L
$$

$$
P_3 = P_2 + \tfrac{1}{2}\rho\,(V_1^2 - V_3^2), \qquad P_4 = P_2 + \tfrac{1}{2}\rho\,(V_1^2 - V_4^2)
$$

If the valve is closed ($o = 0$), there is no flow and the downstream pressures are 0.

**Total head** at each point:

$$
H = \frac{P}{\rho g} + \frac{V^2}{2g} + z
$$

**Cavitation check:**

$$
\min(P_1, P_2, P_3, P_4) + P_{atm} < P_v
$$

The pressure and velocity fields drawn along the pipe (`src/physics/layout.js`) use the same equations. The diameter changes linearly through the reducer and expander, and pressure changes linearly across the valve body.

## Controls

| Panel | Contents |
|---|---|
| **Input Parameters** | Flow rate setpoint 0–400 L/min · Small pipe diameter 15–50 mm · Valve opening 0–100 % · Inlet pressure 0–500 kPa gauge · Status messages (flow limited, residual outlet pressure, cavitation) |
| **Measured Values** | Actual flow · V1 / V3 / V4 · P1 / P2 / P3 · Valve opening · Valve K and hL · Pressure drop P1 − P2 · Energy balance table (P1, P2, P3, Outlet) |
| **Display Mode** | Water / Pressure / Velocity · Flow tracers toggle · Camera presets |
| **Water Fill Mode** | Full Pipe / Half Pipe / Custom (water level slider) |
| **Probe** | Opens when you click gauge P1, P2 or P3 |
| **Legend** | Colour scale with min/max ticks (Pressure and Velocity modes only) |

Mouse: left-drag rotates the view, right-drag pans, the wheel zooms.

Defaults: 120 L/min, 25 mm small pipe, 70 % valve opening, 200 kPa inlet pressure.

## Tech stack

- [React](https://react.dev/) `^18.3.1` for UI panels and state
- [Three.js](https://threejs.org/) `^0.160.0` for the scene: OrbitControls, RoomEnvironment, CSS2DRenderer for labels, and custom shader injection for water motion
- [Vite](https://vitejs.dev/) `^5.4.0` with `@vitejs/plugin-react` `^4.3.1`

## Getting started

Requires Node.js and npm.

```bash
npm install
npm run dev       # start the Vite dev server
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Project structure

```
pipe_fluid_sim/
├── index.html                  # Vite entry HTML
├── prototype-standalone.html   # Single-file prototype (Three.js 0.160 via unpkg import map)
├── vite.config.js              # Vite + React plugin
├── package.json
└── src/
    ├── main.jsx                # React root
    ├── App.jsx                 # App state (params, mode, fill, camera) and panel layout
    ├── physics/
    │   ├── hydraulics.js       # Constants, computeHydraulics, gauge readings, status messages
    │   └── layout.js           # Pipe geometry along x; diameter/velocity/pressure field sampling
    ├── components/
    │   ├── SceneView.jsx       # Mounts PipeFlowScene and forwards React state to it
    │   ├── ControlPanel.jsx    # Input sliders + status
    │   ├── ReadoutPanel.jsx    # Measured values + energy balance table
    │   ├── ModePanel.jsx       # Display mode, tracers toggle, camera presets
    │   ├── FillPanel.jsx       # Water fill mode / level
    │   ├── ProbePanel.jsx      # Gauge readout popup
    │   └── Legend.jsx          # Colour-scale legend
    └── scene/
        ├── PipeFlowScene.js    # Imperative Three.js scene, tracers, arrows, camera presets
        ├── builders.js         # Mesh factories: lab, tank, valve, flanges, gauges, basin
        ├── WaterColumn.js      # Water volume with variable fill level and free surface
        ├── waterMotion.js      # Shader injection for ripples and flow distortion
        ├── Bubbles.js          # Instanced entrained air bubbles
        ├── turbulence.js       # Visual-only turbulence intensity near fittings
        ├── materials.js        # Materials, including the canvas-drawn 0–600 kPa gauge face
        └── colormap.js         # Blue→red ramp shared by the scene and the legend
```

### Standalone prototype

`prototype-standalone.html` is an earlier single-file version of the simulator. It loads Three.js 0.160.0 from unpkg through an import map, so you can open it in a browser without installing or building anything.
