/**
 * GEMINI ULTRA 20S - LOCAL BRIDGE & STITCHER
 * ==============================================================================
 * Chức năng:
 * 1. Chạy trên máy tính cá nhân của bạn (port 4567)
 * 2. Nhận 2 clip 10s tạm thời từ trình duyệt Gemini Ultra
 * 3. Dùng FFmpeg của máy bạn để ghép thành 1 video 20s chuẩn điện ảnh (Crossfade)
 * 4. Tải DUY NHẤT 1 file video 20s hoàn thiện lên https://gem.nexiq.win
 * 5. TỰ ĐỘNG XÓA SẠCH TOÀN BỘ file tạm trên máy tính (0 byte rác đọng lại trên ổ cứng)
 * ==============================================================================
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');

const PORT = 4567;
const SERVER_URL = 'https://gem.nexiq.win';
const TEMP_DIR = path.join(__dirname, '..', 'temp_stitch');

// Đảm bảo thư mục tạm tồn tại
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Kiểm tra FFmpeg trên máy tính
function getFfmpegPath() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch (e) {
    // Thử đường dẫn phổ biến trên Windows nếu có
    const winPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
    if (fs.existsSync(winPath)) return winPath;
    throw new Error('Không tìm thấy FFmpeg trên máy tính của bạn! Vui lòng cài đặt FFmpeg.');
  }
}

const FFMPEG_BIN = getFfmpegPath();

/**
 * Thực thi lệnh FFmpeg an toàn
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_BIN, args, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`FFmpeg lỗi: ${stderr || error.message}`));
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Ghép 2 clip 10s thành video 20s
 */
async function stitchClipsLocally(clip1Path, clip2Path, outputPath) {
  console.log('\n[*] [1/3] Đang tiến hành ghép 2 clip 10s với hiệu ứng Crossfade điện ảnh...');
  
  // Cách 1: Crossfade 1s tại giây thứ 9 (offset=9, duration=1) -> video thành phẩm 19-20s
  try {
    const argsCrossfade = [
      '-y',
      '-i', clip1Path,
      '-i', clip2Path,
      '-filter_complex', '[0:v][1:v]xfade=transition=fade:duration=1:offset=9[v]',
      '-map', '[v]',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      outputPath
    ];
    await runFFmpeg(argsCrossfade);
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000) {
      console.log('[+] Ghép Crossfade thành công!');
      return true;
    }
  } catch (err) {
    console.warn('[!] Crossfade không tương thích codec, chuyển sang chế độ Concat:', err.message);
  }

  // Cách 2: Ghép nối Concat tiêu chuẩn nếu cách 1 lỗi
  console.log('[*] Đang áp dụng ghép nối Concat tiêu chuẩn...');
  const listFile = path.join(TEMP_DIR, `list_${Date.now()}.txt`);
  try {
    const listContent = `file '${clip1Path.replace(/\\/g, '/')}'\nfile '${clip2Path.replace(/\\/g, '/')}'`;
    fs.writeFileSync(listFile, listContent, 'utf-8');

    const argsConcat = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      outputPath
    ];
    await runFFmpeg(argsConcat);
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000;
  } finally {
    if (fs.existsSync(listFile)) {
      try { fs.unlinkSync(listFile); } catch (e) {}
    }
  }
}

/**
 * Tải file 20s lên Server và xóa sạch rác trên máy
 */
async function uploadToServerAndCleanup({ outputPath, tempFiles, prompt, email }) {
  try {
    console.log(`[*] [2/3] Đang tải DUY NHẤT file video 20s lên server ${SERVER_URL}...`);
    const fileBuffer = fs.readFileSync(outputPath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });

    const formData = new FormData();
    formData.append('video', blob, 'video_20s.mp4');
    formData.append('prompt', prompt);
    formData.append('email', email);

    const uploadRes = await fetch(`${SERVER_URL}/api/videos/upload-finished`, {
      method: 'POST',
      body: formData
    });

    const data = await uploadRes.json();
    if (!data.success) {
      throw new Error(data.message || 'Lỗi từ máy chủ khi lưu video.');
    }

    console.log(`[+] Đã tải lên server thành công! Link xem: ${data.videoUrl}`);
    return data;
  } finally {
    // [3/3] TỰ ĐỘNG XÓA SẠCH TOÀN BỘ FILE TẠM TRÊN MÁY TÍNH
    console.log('\n🧹 [3/3] Đang dọn dẹp sạch sẽ ổ cứng máy tính của bạn...');
    for (const file of [...tempFiles, outputPath]) {
      if (file && fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`   - Đã xóa vĩnh viễn: ${path.basename(file)}`);
        } catch (e) {
          console.warn(`   - Không thể xóa: ${path.basename(file)} (${e.message})`);
        }
      }
    }
    console.log('✅ HOÀN TẤT! Máy tính của bạn không còn bất kỳ file rác nào (0 byte thừa).\n');
  }
}

// Khởi tạo Express Server cho Local Bridge
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const upload = multer({ dest: TEMP_DIR });

// Trạng thái kiểm tra hoạt động
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    message: 'Gemini Ultra Local Stitcher Bridge is active and ready!',
    ffmpeg: FFMPEG_BIN,
    serverUrl: SERVER_URL
  });
});

// Nhận 2 clip từ Trình duyệt -> Ghép tại máy -> Đẩy lên Server -> Xóa sạch máy
app.post('/stitch-and-upload', upload.fields([{ name: 'clip1', maxCount: 1 }, { name: 'clip2', maxCount: 1 }]), async (req, res) => {
  const files = req.files;
  const tempFiles = [];

  try {
    if (!files || !files['clip1'] || !files['clip2']) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu file clip1 hoặc clip2 từ trình duyệt.'
      });
    }

    const clip1Path = files['clip1'][0].path;
    const clip2Path = files['clip2'][0].path;
    tempFiles.push(clip1Path, clip2Path);

    const prompt = (req.body.prompt || 'Gemini Ultra 20s Video').trim();
    const email = (req.body.email || 'khanhle1688@gmail.com').trim();

    console.log(`\n============================================================`);
    console.log(`🎬 YÊU CẦU MỚI TỪ GEMINI ULTRA`);
    console.log(`   - Kịch bản: "${prompt}"`);
    console.log(`   - Email nhận: ${email}`);
    console.log(`   - Clip 1: ${Math.round(files['clip1'][0].size / 1024)} KB`);
    console.log(`   - Clip 2: ${Math.round(files['clip2'][0].size / 1024)} KB`);
    console.log(`============================================================`);

    const finalFilename = `temp_final_20s_${Date.now()}.mp4`;
    const outputPath = path.join(TEMP_DIR, finalFilename);

    // Ghép tại máy tính cá nhân
    await stitchClipsLocally(clip1Path, clip2Path, outputPath);

    // Đẩy lên Server và xóa sạch file tạm trên máy
    const serverResult = await uploadToServerAndCleanup({
      outputPath,
      tempFiles,
      prompt,
      email
    });

    res.json({
      success: true,
      message: 'Ghép video 20s tại máy và tải lên server thành công! Đã dọn dẹp sạch ổ cứng.',
      video: serverResult.video,
      videoUrl: serverResult.videoUrl,
      webUrl: serverResult.webUrl
    });

  } catch (err) {
    console.error('[X] Lỗi xử lý tại máy tính:', err);
    // Vẫn dọn dẹp nếu có lỗi
    for (const f of tempFiles) {
      if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {}
    }
    res.status(500).json({ success: false, message: 'Lỗi ghép video tại máy: ' + err.message });
  }
});

// Khởi chạy server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`
==============================================================================
🎬 GEMINI ULTRA 20S - LOCAL STITCHER & AUTO CLEANER
==============================================================================
[✓] Trạng thái: Đang hoạt động tại http://127.0.0.1:${PORT}
[✓] Bộ xử lý Video (FFmpeg): ${FFMPEG_BIN}
[✓] Máy chủ đồng bộ: ${SERVER_URL}

👉 CÁCH HOẠT ĐỘNG:
1. Mở trang https://gemini.google.com/ trên Chrome (đang đăng nhập Ultra).
2. Bấm nút "🎬 Tạo Video 20s Ultra" ở góc dưới bên phải màn hình.
3. Nhập 1 Prompt ý tưởng bất kỳ và bấm Bắt đầu.
4. Trình duyệt tự tạo 2 clip 10s -> Gửi vào máy tính của bạn ghép 20s ->
   Tải DUY NHẤT video 20s lên web -> TỰ ĐỘNG XÓA SẠCH file tạm trên máy tính!
==============================================================================
`);
});
