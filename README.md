# Stochastic BPMN Simulator

A web-based framework for drawing BPMN diagrams, annotating them with probabilities and time intervals, and running probabilistic simulations via Petri nets → WebPPL.

## Features

- **Visual Modeling**: Drag-and-drop BPMN editor (built on bpmn-js).
- **Stochastic Extensions**: Assign probabilities on XOR-split gateways and time ranges on tasks.
- **Automated Translation**:
    1. BPMN → PNML (via **PM4Py**)
    2. PNML → WebPPL (via **DPN-to-WebPPL** converter)
- **Reporting**: View and export a table of `(trace, count, percentage, avgTime)`.

## Prerequisites

- **Node.js** (for NPM & `npx webppl`)
- **Python 3.8+**
- **pip**

## Getting Started

### 1. Clone the repo
```
git clone https://github.com/your-org/stochastic-bpmn-sim.git
```

### 2. Frontend
```
cd src/frontEnd
npm install
npm start # starts the React app
```

### 3. Backend
```
cd src/backEnd
python3 -m venv venv      # optional
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py             # starts the Flask server
```
### 4. DPN-to-WebPPL Converter
```
cd src/backEnd/dpn-converter/DPN-to-WebPPL
pip install -r requirements.txt
```