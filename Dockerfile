FROM python:3.13-slim

WORKDIR /app
COPY . .

ENV DATA_DIR=/app/data
EXPOSE 8787

CMD ["python", "server.py"]
