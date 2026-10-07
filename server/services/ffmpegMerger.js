const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');

class FFmpegMergerService {
  constructor() {
    this.ffmpegPath = config.FFMPEG_PATH;
  }

  /**
   * Chạy lệnh FFmpeg an toàn qua Promise
   */
  runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      execFile(this.ffmpegPath, args, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`FFmpeg lỗi (${error.message}): ${stderr}`));
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * Ghép 2 clip 10s thành 1 video 20s
   */
  async merge2Scenes(clipPaths, outputPath, options = {}) {
    if (!fs.existsSync(config.STORAGE_DIR)) {
      fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
    }

    const { useCrossfade = true } = options;

    // Cách 1: Chuyển cảnh mờ chồng điện ảnh (Crossfade 1s giữa cảnh 1 và cảnh 2)
    if (useCrossfade && clipPaths.length === 2) {
      try {
        console.log('[*] Đang áp dụng hiệu ứng chuyển cảnh mượt mà (Crossfade)...');
        // Clip 1 dài 10s, bắt đầu crossfade tại giây thứ 9 (offset 9, duration 1s) -> Tổng thời lượng ~19-20s
        const argsCrossfade = [
          '-y',
          '-i', clipPaths[0],
          '-i', clipPaths[1],
          '-filter_complex',
          '[0:v][1:v]xfade=transition=fade:duration=1:offset=9[v]',
          '-map', '[v]',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'veryfast',
          outputPath
        ];

        await this.runFFmpeg(argsCrossfade);

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 5000) {
          return true;
        }
      } catch (err) {
        console.warn('[!] Crossfade thất bại, chuyển sang phương pháp Concat tiêu chuẩn:', err.message);
      }
    }

    // Cách 2: Ghép nối chuỗi tiêu chuẩn (Concat Demuxer)
    const listFilePath = path.join(config.TEMP_DIR, `concat_${Date.now()}.txt`);
    try {
      const fileContent = clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(listFilePath, fileContent, 'utf-8');

      const argsConcat = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFilePath,
        '-c', 'copy',
        outputPath
      ];

      await this.runFFmpeg(argsConcat);

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 5000) {
        return true;
      }

      // Cách 3: Nối qua filter_complex nếu copy không tương thích
      const argsReencode = [
        '-y',
        '-i', clipPaths[0],
        '-i', clipPaths[1],
        '-filter_complex', '[0:v:0][1:v:0]concat=n=2:v=1:a=0[outv]',
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        outputPath
      ];

      await this.runFFmpeg(argsReencode);
      return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 5000;

    } finally {
      if (fs.existsSync(listFilePath)) {
        try { fs.unlinkSync(listFilePath); } catch (e) {}
      }
    }
  }

  /**
   * Tạo thumbnail hình ảnh cho video
   */
  async generateThumbnail(videoPath, thumbnailPath) {
    try {
      const args = [
        '-y',
        '-ss', '00:00:02',
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', '2',
        thumbnailPath
      ];
      await this.runFFmpeg(args);
      return fs.existsSync(thumbnailPath);
    } catch (err) {
      console.warn('[!] Lỗi tạo thumbnail:', err.message);
      return false;
    }
  }
}

module.exports = new FFmpegMergerService();
