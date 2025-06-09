# 1) Base image with Python + Node.js
FROM python:3.9-slim

# 2) Install system deps + nodejs & npm
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl build-essential nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# 3) Create app directory
WORKDIR /app

# ──────────────────────────────────────────────────────────────────────────────
# Backend setup
# ──────────────────────────────────────────────────────────────────────────────

# 4) Copy & install Flask backend requirements
COPY src/requirements.txt ./requirements-backend.txt
RUN pip install --no-cache-dir -r requirements-backend.txt

# 5) Copy & install the DPN-to-WebPPL converter’s requirements
COPY src/dpn_converter/DPN-to-WebPPL/requirements.txt ./requirements-dpn.txt
RUN pip install --no-cache-dir -r requirements-dpn.txt

# 5b) Copy the converter source itself (no setup.py, so just add it to PYTHONPATH)
COPY src/dpn_converter/DPN-to-WebPPL /app/dpn_to_webppl
# ensure Python can import pnml_to_webppl from that location
ENV PYTHONPATH="/app/dpn_to_webppl:${PYTHONPATH}"

# 6) Copy your Flask API code
# Copy app.py
COPY src/backEnd/app.py /app/src/backEnd/app.py

# Copy helpers.py
COPY src/backEnd/helpers.py /app/src/backEnd/helpers.py 

# ──────────────────────────────────────────────────────────────────────────────
# Frontend setup
# ──────────────────────────────────────────────────────────────────────────────

# 7a) Copy only the react app’s package.json and lockfile from the root
COPY package.json package-lock.json /app/src/frontEnd/
COPY tsconfig.json                /app/src/frontEnd/

WORKDIR /app/src/frontEnd
RUN npm install

# 7b) Now copy the rest of the CRA app
COPY src             /app/src/frontEnd/src/
COPY src/frontEnd/   /app/src/frontEnd/src/
COPY public/         /app/src/frontEnd/public/

# 7c) Build the static assets
RUN npm run build

# 8) Install a static server
RUN npm install -g serve
# ──────────────────────────────────────────────────────────────────────────────
# Final runtime
# ──────────────────────────────────────────────────────────────────────────────

# Expose Flask port and React port
EXPOSE 5002 3000

# Start both the Flask API and serve the built React concurrently
WORKDIR /app/src/backEnd
CMD ["sh", "-c", \
    "python app.py & serve -s /app/src/frontEnd/build -l 3000" \
]
