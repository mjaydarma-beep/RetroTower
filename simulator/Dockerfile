FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt tower_sim.py ./
RUN pip install --no-cache-dir -r requirements.txt
ENV API_URL=http://host.docker.internal:3001
ENV TELEMETRY_INTERVAL=15
CMD ["python", "-u", "tower_sim.py"]
