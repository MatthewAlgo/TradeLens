FROM python:3.14-slim

WORKDIR /app

COPY services/mock-exchange/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/mock-exchange/app/ ./app/

EXPOSE 8765

CMD ["python", "-u", "-m", "app.main"]
