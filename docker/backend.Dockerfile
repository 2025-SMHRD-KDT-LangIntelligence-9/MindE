# backend.Dockerfile
# FastAPI 백엔드 서비스용 Dockerfile입니다.
# TODO: 의존성 설치 최적화(레이어 캐싱), 비root 사용자 설정 등 보강

FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# TODO: 프로덕션용 CMD로 교체 (예: gunicorn + uvicorn worker)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
