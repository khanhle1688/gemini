# Sử dụng node bookworm-slim có sẵn apt để cài FFmpeg
FROM node:20-bookworm-slim

# Cài đặt FFmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy toàn bộ mã nguồn
COPY . .

# Tạo các thư mục lưu trữ nếu chưa có
RUN mkdir -p /app/server/storage/videos /app/server/storage/temp /app/server/data

# Mở cổng 3000
EXPOSE 3000

# Biến môi trường mặc định
ENV NODE_ENV=production
ENV PORT=3000
ENV FFMPEG_PATH=ffmpeg

# Khởi chạy server
CMD ["node", "server/server.js"]
