# Docker Local Development

This project can be run locally in Docker using either `docker build`/`docker run` or Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- A `.env` file in the project root (used by `docker-compose.yml`)

## Build and Run with Docker

```bash
docker build -t geopolitical-globe .
docker run -p 3000:3000 geopolitical-globe
```

App URL: `http://localhost:3000`

## Run with Docker Compose

```bash
docker-compose up -d
docker-compose down
```

## Notes

- The `Dockerfile` uses a 3-stage build: dependencies, build, production.
- Production container runs with `NODE_ENV=production`.
- Health checks are enabled in the image.
