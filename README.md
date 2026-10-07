# 🎬 Gemini Video 20s Studio (Fullstack Web & Server)

> **Hệ thống tạo video 20s tự động từ 1 Prompt duy nhất**  
> Tự động phân bổ kịch bản thành **2 phân cảnh 10s**, điều phối sinh clip qua Google Veo, ghép nối mượt mà bằng **FFmpeg (Crossfade)** và lưu trữ trực tiếp trên Server.

---

## 🌟 Tính Năng Nổi Bật

1. **Pipeline 2x10s Hoàn Toàn Tự Động (Zero-Click):**
   * Người dùng chỉ cần nhập đúng **1 Master Prompt**.
   * Hệ thống tự động phân tách thành 2 phân cảnh:
     * **Cảnh 1 (0-10s):** Mở đầu & Diễn tiến chính.
     * **Cảnh 2 (10-20s):** Cao trào & Kết thúc trọn vẹn.
   * FFmpeg tự động ghép 2 clip 10s thành **1 video 20s điện ảnh** với hiệu ứng chuyển cảnh mờ chồng (Crossfade) mượt mà.
2. **Lưu Trữ Trực Tiếp Trên Server:**
   * Video xuất ra được lưu vĩnh viễn trong thư mục `/server/storage/videos/` trên server.
   * Hỗ trợ phát trực tiếp trên Web Player (HTML5) và nút tải về tốc độ cao.
3. **Giao Diện Studio Hiện Đại (Dark Cyberpunk Glassmorphism):**
   * Đăng ký, Đăng nhập bảo mật (JWT & Bcrypt).
   * Lựa chọn Model: Google Veo 2, Veo Fast, Gemini Automation.
   * Lựa chọn Tỉ lệ: **16:9** (Ngang / YouTube) hoặc **9:16** (Dọc / TikTok, Reels, Shorts).
   * **✨ Nâng Cấp Prompt (AI Enhancer):** Biến 1 câu ý tưởng đơn giản thành prompt điện ảnh 4K HDR chỉ bằng 1-Click.
   * **Thanh tiến trình thời gian thực:** Cập nhật từng bước: *Phân tích kịch bản -> Sinh Cảnh 1 -> Sinh Cảnh 2 -> Ghép nối FFmpeg -> Hoàn tất.*
   * **Thư viện video (Gallery):** Xem lại, sao chép link server, tải về hoặc xóa video.

---

## 🚀 HƯỚNG DẪN 1: CHẠY NGAY TRÊN MÁY TÍNH CỦA BẠN

### Cách 1: Bấm 1-Click trên Desktop
* Bạn chỉ cần ra màn hình Desktop, bấm đúp vào file:
  👉 **`🎬_CHAY_STUDIO_VIDEO_20S.bat`**
* Trình duyệt sẽ tự động mở trang web: **`http://localhost:3000`**

### Cách 2: Chạy qua Terminal / PowerShell
```bash
# Di chuyển vào thư mục dự án
cd G:\Google

# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi động server
npm start
```

* **Tài khoản Demo có sẵn:**
  * **Email:** `demo@gemini.ai`
  * **Mật khẩu:** `123456`
  *(Hoặc bạn có thể bấm nút "Dùng tài khoản Demo (1-Click)" trên màn hình đăng nhập).*

---

## 🐙 HƯỚNG DẪN 2: ĐẨY CODE LÊN GITHUB

Mã nguồn đã được khởi tạo sẵn sàng cho Git. Để đưa lên GitHub cá nhân của bạn:

1. **Tạo một Repository mới trên GitHub:**
   * Truy cập: [https://github.com/new](https://github.com/new)
   * Đặt tên repository (ví dụ: `gemini-video-20s-studio`).
   * Chọn chế độ **Private** hoặc **Public** rồi bấm **Create repository**.

2. **Chạy các lệnh sau trong PowerShell tại `G:\Google`:**
   ```bash
   # 1. Thêm link remote GitHub của bạn (thay username và repo của bạn vào)
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

   # 2. Đổi tên nhánh chính thành main
   git branch -M main

   # 3. Đẩy code lên GitHub
   git push -u origin main
   ```

---

## 🌐 HƯỚNG DẪN 3: TRIỂN KHAI TRỰC TIẾP LÊN SERVER (VPS / CLOUD)

Dự án đã tích hợp sẵn **Docker** và **Docker Compose**, có sẵn FFmpeg, có thể chạy trên mọi hệ điều hành Linux (Ubuntu, Debian, CentOS) chỉ bằng 1 lệnh.

### Triển Khai Trên VPS (DigitalOcean, Vultr, Linode, AWS, Hetzner...)

1. **Đăng nhập vào VPS qua SSH:**
   ```bash
   ssh root@YOUR_VPS_IP
   ```

2. **Kéo mã nguồn từ GitHub về VPS:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

3. **Khởi chạy hệ thống bằng Docker Compose:**
   ```bash
   docker compose up -d --build
   ```
   * Hệ thống sẽ tự động cài đặt Node.js, FFmpeg, khởi tạo thư mục lưu trữ và chạy trên cổng `3000`.
   * Truy cập web tại: `http://YOUR_VPS_IP:3000`

4. **Cập nhật code mới từ GitHub sau này:**
   Mỗi khi bạn sửa code trên máy tính và đẩy lên GitHub, trên VPS bạn chỉ cần chạy:
   ```bash
   bash deploy/deploy.sh
   ```

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
G:\Google/
├── server/
│   ├── config/index.js           # Cấu hình cổng, JWT, đường dẫn FFmpeg
│   ├── db/index.js               # Database JSON lưu Users & Videos
│   ├── middlewares/auth.js       # Xác thực JWT token
│   ├── controllers/
│   │   ├── authController.js     # Đăng ký, đăng nhập
│   │   └── videoController.js    # Điều phối luồng tạo video 20s
│   ├── services/
│   │   ├── aiStoryboard.js       # AI chia 1 prompt -> 2 cảnh 10s & Enhancer
│   │   ├── videoGenerator.js     # Sinh video qua Veo API / Cinematic Engine
│   │   └── ffmpegMerger.js       # Ghép 2 cảnh qua FFmpeg (Crossfade)
│   ├── storage/
│   │   ├── videos/               # Lưu trữ video 20s thành phẩm trên server
│   │   └── temp/                 # Bộ nhớ đệm xử lý clip tạm
│   └── server.js                 # Entry point Express
│
├── client/
│   ├── index.html                # Giao diện Studio tạo video 20s
│   ├── style.css                 # Dark Cyberpunk Glassmorphism UI
│   └── app.js                    # SPA Logic, Real-time Tracker, Gallery
│
├── deploy/
│   ├── Dockerfile                # Image Node 20 + FFmpeg chuẩn
│   ├── docker-compose.yml        # Chạy 1 lệnh trên server
│   └── deploy.sh                 # Script tự động kéo code từ GitHub
│
├── .gitignore
├── .env.example
├── package.json
└── README.md
```
