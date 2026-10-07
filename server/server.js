const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const auth = require('./middlewares/auth');
const authController = require('./controllers/authController');
const videoController = require('./controllers/videoController');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Đảm bảo thư mục lưu trữ luôn tồn tại
[config.STORAGE_DIR, config.TEMP_DIR, config.DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Phục vụ các file video đã render tĩnh
app.use('/storage/videos', express.static(config.STORAGE_DIR));

// Phục vụ giao diện Frontend
app.use(express.static(path.join(__dirname, '..', 'client')));

// --- Routes API ---
// 1. Authentication
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/google', authController.googleLogin);
app.post('/api/auth/quick-google', authController.quickGoogleLogin);
app.get('/api/auth/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});
app.get('/api/auth/me', auth, authController.me);

// 2. Videos
app.post('/api/videos', auth, videoController.createVideo);
app.get('/api/videos/status/:id', auth, videoController.getVideoStatus);
app.get('/api/videos/my', auth, videoController.listMyVideos);
app.delete('/api/videos/:id', auth, videoController.deleteVideo);
app.post('/api/videos/enhance-prompt', auth, videoController.enhancePrompt);

// 3. System Info
app.get('/api/system/info', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    pipeline: '2x10s = 20s Full Automatic',
    ffmpeg: config.FFMPEG_PATH,
    supportedModels: [
      { id: 'veo-2', name: 'Google Veo 2 (Mô hình Điện Ảnh Cao Cấp)', description: 'Chất lượng 1080p, màu sắc điện ảnh sâu, chi tiết chân thực.' },
      { id: 'veo-fast', name: 'Google Veo Fast (Tốc Độ Siêu Nhanh)', description: 'Tối ưu tốc độ render, hoàn hảo cho xem thử và phác thảo.' },
      { id: 'gemini-web-automation', name: 'Gemini Web Account Automation', description: 'Tận dụng trực tiếp tài khoản đăng nhập trên gemini.google.com.' }
    ]
  });
});

// Bất kỳ route nào khác đều chuyển về trang chủ SPA (Hỗ trợ Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Khởi động server
app.listen(config.PORT, () => {
  console.log('=============================================================');
  console.log(`🚀 GEMINI VIDEO 20S SERVER ĐANG CHẠY TẠI: http://localhost:${config.PORT}`);
  console.log(`🎬 Pipeline: 1 Prompt -> 2x10s -> Ghép FFmpeg -> Video 20s`);
  console.log(`📁 Thư mục lưu video: ${config.STORAGE_DIR}`);
  console.log(`⚡ FFmpeg Engine: ${config.FFMPEG_PATH}`);
  console.log('=============================================================');
});
