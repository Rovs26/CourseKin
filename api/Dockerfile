FROM python:3.11-slim

# Run as non-root for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directories writable by appuser
RUN mkdir -p /app/data /app/uploads && chown -R appuser:appuser /app

USER appuser

# Default: development mode with hot-reload
# Override CMD in docker-compose.prod.yml for production
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]