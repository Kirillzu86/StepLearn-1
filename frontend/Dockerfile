# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Переменная окружения для API бэкенда (Coolify передает ее через Build Arguments)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_TEACHER_APP_URL
ENV VITE_TEACHER_APP_URL=$VITE_TEACHER_APP_URL

COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY src ./src
COPY index.html ./

RUN npm install --production=false
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]