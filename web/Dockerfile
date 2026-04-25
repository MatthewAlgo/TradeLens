FROM node:20-alpine AS builder
WORKDIR /app
COPY web/package*.json ./
RUN npm install
COPY web/ .
ARG VITE_WS_URL=ws://localhost:4000/ws
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
