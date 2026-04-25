FROM python:3.14-slim
WORKDIR /app
COPY services/backtester/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/backtester/app/ ./app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
