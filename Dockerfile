# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS builder
 
WORKDIR /app
 
# Install JS dependencies
COPY package.json package-lock.json* ./
RUN npm install
 
# Copy all source and build
COPY . .
RUN npm run build
 
 
# ── Stage 2: Python + FastAPI backend serving the built frontend ──────────────
FROM python:3.11-slim
 
WORKDIR /app
 
# Copy Python files
COPY environment.py graders.py inference.py baseline_inference.py openenv.yaml server.py requirements.txt ./
 
# Copy the compiled React app from Stage 1
COPY --from=builder /app/dist ./dist
 
# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
 
EXPOSE 7860
 
CMD ["python", "server.py"]