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
https://github.com/Wulfi1/Bachelor.git
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
cd src/dpn-converter/DPN-to-WebPPL
pip install -r requirements.txt
```

## Dockerbuild

To build the docker image, stay in the root directory and run:
### 1. Build the image
```
docker build -t stochastic-bpmn-simulator .
```
### 2. Run the container
```
docker run -p 5002:5002 -p 3000:3000 stochastic-bpmn-simulator
```
### 3. Access the app
Navigate your browser to `http://localhost:3000`