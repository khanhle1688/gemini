require('dotenv').config();
const path = require('path');
const os = require('os');
const fs = require('fs');

// Tìm FFmpeg trên Windows hoặc Linux
function resolveFFmpeg() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  // Đường dẫn đã cài đặt trên máy người dùng Windows
  const userProfile = process.env.USERPROFILE || 'C:\\Users\\HKC';
  const wingetPkg = path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  
  if (fs.existsSync(wingetPkg)) {
    try {
      const dirs = fs.readdirSync(wingetPkg);
      for (const d of dirs) {
        if (d.startsWith('Gyan.FFmpeg')) {
          const binPath = path.join(wingetPkg, d, 'ffmpeg-9.0.2-full_build', 'bin', 'ffmpeg.exe');
          if (fs.existsSync(binPath)) return binPath;
          // Tìm đệ quy
          const subdirs = fs.readdirSync(path.join(wingetPkg, d));
          for (const sub of subdirs) {
            const candidate = path.join(wingetPkg, d, sub, 'bin', 'ffmpeg.exe');
            if (fs.existsSync(candidate)) return candidate;
          }
        }
      }
    } catch (e) {}
  }

  // Mặc định gọi lệnh hệ thống (hoặc trên Docker/Linux)
  return 'ffmpeg';
}

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'gemini-video-20s-super-secret-key-2026',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  STORAGE_DIR: path.join(__dirname, '..', 'storage', 'videos'),
  TEMP_DIR: path.join(__dirname, '..', 'storage', 'temp'),
  DATA_DIR: path.join(__dirname, '..', 'data'),
  FFMPEG_PATH: resolveFFmpeg(),
};
