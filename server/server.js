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
    version: '1.1.0',
    pipeline: '2x10s = 20s Full Automatic (AI Visual Engine)',
    ffmpeg: config.FFMPEG_PATH,
    supportedModels: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', description: 'Tối ưu tốc độ cao, siêu nhẹ, tạo kịch bản và khung hình tức thì.' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Thế hệ mới tốc độ cao và sáng tạo điện ảnh xuất sắc.' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Cân bằng giữa tốc độ và độ chi tiết hình ảnh.' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Suy luận bối cảnh sâu sắc, chi tiết điện ảnh 4K chân thực.' },
      { id: 'google-veo-2', name: 'Google Veo 2', description: 'Mô hình video chuyên biệt độ phân giải cao 1080p.' },
      { id: 'gemini-web-automation', name: 'Gemini Web Account Direct', description: 'Tận dụng trực tiếp tài khoản đăng nhập trên gemini.google.com.' }
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
