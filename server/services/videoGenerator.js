const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');
const config = require('../config');

class VideoGeneratorService {
  constructor() {
    this.ffmpegPath = config.FFMPEG_PATH;
  }

  /**
   * Tải file từ URL về ổ cứng qua Node.js stream
   */
  downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const client = url.startsWith('https') ? https : http;

      const request = client.get(url, { timeout: 25000 }, (response) => {
        // Xử lý chuyển hướng nếu có (301/302)
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          return this.downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(dest); } catch (e) {}
          return reject(new Error(`Tải ảnh thất bại với mã lỗi HTTP: ${response.statusCode}`));
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(dest));
        });
      });

      request.on('error', (err) => {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      });

      request.on('timeout', () => {
        request.destroy();
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(new Error('Hết thời gian chờ khi tải ảnh AI (Timeout).'));
      });
    });
  }

  /**
   * Sinh một đoạn clip 10s cho phân cảnh tương ứng
   */
  async generateScene(scene, aspectRatio = '16:9', outputPath) {
    if (!fs.existsSync(config.TEMP_DIR)) {
      fs.mkdirSync(config.TEMP_DIR, { recursive: true });
    }

    const isPortrait = aspectRatio === '9:16';
    const width = isPortrait ? 720 : 1280;
    const height = isPortrait ? 1280 : 720;
    const duration = scene.duration || 10;

    // 1. Tải hình ảnh AI thực tế được sinh từ chính Prompt của người dùng
    const tempImage = outputPath.replace('.mp4', '_ai.jpg');
    let hasAIImage = false;

    try {
      console.log(`[*] Đang sinh hình ảnh AI thực tế cho Cảnh ${scene.sceneIndex}...`);
      const cleanPrompt = encodeURIComponent(scene.prompt);
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

      await this.downloadFile(imageUrl, tempImage);
      if (fs.existsSync(tempImage) && fs.statSync(tempImage).size > 5000) {
        hasAIImage = true;
        console.log(`[+] Tải ảnh AI thành công (${Math.round(fs.statSync(tempImage).size / 1024)} KB) cho Cảnh ${scene.sceneIndex}`);
      }
    } catch (err) {
      console.warn(`[!] Không thể tải ảnh AI qua mạng: ${err.message}, chuyển sang render dự phòng.`);
    }

    // 2. Chuyển đổi thành video chuyển động điện ảnh 10s bằng FFmpeg
    return new Promise((resolve, reject) => {
      let args = [];

      if (hasAIImage) {
        // Hiệu ứng Ken Burns camera chuyển động mượt mà (Cảnh 1 zoom vào, Cảnh 2 pan/zoom ra)
        const zoomExpr = scene.sceneIndex === 1
          ? "min(zoom+0.0012,1.35)"
          : "max(1.35-0.0012*on,1.0)";
        
        const xExpr = scene.sceneIndex === 1
          ? "iw/2-(iw/zoom/2)"
          : "(iw-iw/zoom)*(on/300)";

        const filterComplex = `[0:v]scale=8000:-1,zoompan=z='${zoomExpr}':d=300:x='${xExpr}':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=30,format=yuv420p[vout]`;

        args = [
          '-y',
          '-loop', '1',
          '-i', tempImage,
          '-f', 'lavfi',
          '-i', 'anullsrc=r=44100:cl=stereo',
          '-filter_complex', filterComplex,
          '-map', '[vout]',
          '-map', '1:a',
          '-t', `${duration}`,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          outputPath
        ];
      } else {
        // Fallback khẩn cấp nếu mất kết nối mạng
        args = [
          '-y',
          '-f', 'lavfi',
          '-i', `color=c=${scene.sceneIndex === 1 ? '0x0f2027' : '0x200122'}:s=${width}x${height}:d=${duration}:r=30`,
          '-f', 'lavfi',
          '-i', 'anullsrc=r=44100:cl=stereo',
          '-t', `${duration}`,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          outputPath
        ];
      }

      execFile(this.ffmpegPath, args, (err) => {
        // Dọn dẹp ảnh tạm
        if (fs.existsSync(tempImage)) {
          try { fs.unlinkSync(tempImage); } catch (e) {}
        }

        if (err) {
          console.error(`[X] Lỗi FFmpeg render video cảnh ${scene.sceneIndex}:`, err.message);
          return reject(err);
        }
        resolve(outputPath);
      });
    });
  }
}

module.exports = new VideoGeneratorService();
