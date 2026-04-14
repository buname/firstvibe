# Deployment Guide

## Local Development (Docker)

```bash
# Build Docker image
docker build -t geopolitical-risk-map .

# Run container
docker run -p 3000:3000 geopolitical-risk-map

# Or use Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop container
docker-compose down
```

Health endpoint: `http://localhost:3000/api/health`

## Deploy to Render.com (Free Tier)

1. Push this repository to GitHub.
2. Sign in to [Render](https://render.com/) with GitHub.
3. Click **New +** -> **Web Service**.
4. Select your repository.
5. Configure:
   - **Environment:** Docker
   - **Build Command:** leave empty (Dockerfile is used)
   - **Start Command:** leave empty (Dockerfile `CMD` is used)
   - **Instance Type:** Free
6. Add required environment variables from `.env`.
7. Click **Create Web Service** and wait for first deploy.

## Deploy to Railway (Free Limits)

1. Push this repository to GitHub.
2. Sign in to [Railway](https://railway.app/) with GitHub.
3. Click **New Project** -> **Deploy from GitHub repo**.
4. Choose this repository.
5. Railway detects the Dockerfile automatically.
6. Add required environment variables.
7. Deploy and use the generated public URL.

## Notes

- Docker image uses non-root runtime user (`nextjs`).
- Next.js runs in `standalone` mode for a smaller runtime image.
- Health checks are enabled at `/api/health`.
