# frontend.Dockerfile
# React 프론트엔드 서비스용 Dockerfile입니다.
# TODO: 멀티 스테이지 빌드(빌드 -> nginx 정적 서빙)로 개선

FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json .
RUN npm install

COPY frontend/ .

# TODO: 프로덕션 빌드 후 nginx로 서빙하도록 변경
CMD ["npm", "run", "dev"]
