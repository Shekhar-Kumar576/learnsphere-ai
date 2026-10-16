# One image = React build + FastAPI backend serving it. Works on Render, Railway, Fly, any Docker host.
FROM node:22-slim AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 DATABASE_PATH=/app/data/app.db
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY --from=web /web/dist dist
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
