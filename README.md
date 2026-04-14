# BEX - Geopolitical Risk & Options Analytics

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker&logoColor=white)

Production-minded Next.js dashboard for market and geopolitical analytics, packaged with Docker for local and cloud deployment.

## Live Demo

- Add your Render or Railway URL here after first deploy.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docker Commands

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Compose up/down
npm run docker:compose
npm run docker:stop
```

Health endpoint: `http://localhost:3000/api/health`

## Deployment

- Detailed guide: `DEPLOYMENT.md`
- Docker notes: `DOCKER.md`
- CV-ready summary: `CV_FEATURES.md`

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Docker / Docker Compose
