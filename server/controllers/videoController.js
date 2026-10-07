const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const aiStoryboard = require('../services/aiStoryboard');
const videoGenerator = require('../services/videoGenerator');
const ffmpegMerger = require('../services/ffmpegMerger');

/**
 * Xử lý tiến trình sinh video 20s ngầm trong nền
 */
async function processVideoJob(videoId, userId, prompt, model, aspectRatio) {
  try {
    // 1. Phân tích kịch bản thành 2 cảnh 10s
    db.updateVideo(videoId, { status: 'scripting', progress: 15, statusText: 'Đang dùng AI phân bổ kịch bản thành 2 phân cảnh 10s...' });
    const storyboard = await aiStoryboard.splitInto2Scenes(prompt, model);

    const scene1 = storyboard.scenes[0];
    const scene2 = storyboard.scenes[1];

    db.updateVideo(videoId, {
      scene1Prompt: scene1.prompt,
      scene2Prompt: scene2.prompt,
      status: 'generating_scene_1',
      progress: 35,
      statusText: 'Đang sinh video Phân cảnh 1 (0-10s)...'
    });

    const clip1Path = path.join(config.TEMP_DIR, `${videoId}_scene1.mp4`);
    const clip2Path = path.join(config.TEMP_DIR, `${videoId}_scene2.mp4`);

    // 2. Sinh Clip 1 (10s)
    await videoGenerator.generateScene(scene1, aspectRatio, clip1Path);

    db.updateVideo(videoId, {
      status: 'generating_scene_2',
      progress: 70,
      statusText: 'Đang sinh video Phân cảnh 2 (10-20s)...'
    });

    // 3. Sinh Clip 2 (10s)
    await videoGenerator.generateScene(scene2, aspectRatio, clip2Path);

    db.updateVideo(videoId, {
      status: 'stitching',
      progress: 85,
      statusText: 'Đang ghép nối 2 phân cảnh thành video 20s chuẩn điện ảnh...'
    });

    // 4. Ghép 2 clip thành video 20s
    const finalFilename = `gemini_20s_${videoId}.mp4`;
    const finalVideoPath = path.join(config.STORAGE_DIR, finalFilename);
    const thumbFilename = `thumb_${videoId}.jpg`;
    const finalThumbPath = path.join(config.STORAGE_DIR, thumbFilename);

    await ffmpegMerger.merge2Scenes([clip1Path, clip2Path], finalVideoPath, { useCrossfade: true });

    // 5. Tạo thumbnail
    db.updateVideo(videoId, { progress: 95, statusText: 'Đang hoàn tất lưu trữ trên server...' });
    await ffmpegMerger.generateThumbnail(finalVideoPath, finalThumbPath);

    // 6. Xóa các clip tạm
    try {
      if (fs.existsSync(clip1Path)) fs.unlinkSync(clip1Path);
      if (fs.existsSync(clip2Path)) fs.unlinkSync(clip2Path);
    } catch (e) {}

    // 7. Hoàn tất
    const videoUrl = `/storage/videos/${finalFilename}`;
    const thumbnailUrl = `/storage/videos/${thumbFilename}`;
    const stat = fs.existsSync(finalVideoPath) ? fs.statSync(finalVideoPath) : { size: 0 };

    db.updateVideo(videoId, {
      status: 'completed',
      progress: 100,
      statusText: 'Tạo video 20s thành công! Đã lưu trực tiếp trên Server.',
      videoUrl,
      thumbnailUrl,
      fileSize: Math.round((stat.size / (1024 * 1024)) * 100) / 100, // MB
      completedAt: new Date().toISOString()
    });

    console.log(`[+] Đã tạo xong video 20s cho User ${userId}: ${finalFilename}`);
  } catch (err) {
    console.error(`[X] Lỗi xử lý video ${videoId}:`, err);
    db.updateVideo(videoId, {
      status: 'failed',
      progress: 0,
      statusText: 'Đã xảy ra lỗi trong quá trình tạo video.',
      error: err.message
    });
  }
}

exports.createVideo = async (req, res) => {
  try {
    const { prompt, model = 'veo-2', aspectRatio = '16:9' } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập prompt mô tả video.' });
    }

    const videoId = uuidv4();
    const newVideo = db.createVideo({
      id: videoId,
      userId: req.user.id,
      prompt: prompt.trim(),
      model,
      aspectRatio,
      mode: '2x10s',
      duration: 20,
      status: 'pending',
      progress: 5,
      statusText: 'Khởi tạo hàng đợi tạo video 20s...',
      videoUrl: null,
      thumbnailUrl: null,
      createdAt: new Date().toISOString()
    });

    // Bắt đầu xử lý ngầm (Asynchronous Worker)
    processVideoJob(videoId, req.user.id, prompt.trim(), model, aspectRatio);

    res.status(201).json({
      success: true,
      message: 'Đã tiếp nhận yêu cầu! Video 20s đang được tạo tự động.',
      video: newVideo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVideoStatus = (req, res) => {
  const { id } = req.params;
  const video = db.findVideoById(id);
  if (!video) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy video.' });
  }
  res.json({ success: true, video });
};

exports.listMyVideos = (req, res) => {
  const videos = db.findVideosByUserId(req.user.id);
  res.json({ success: true, videos });
};

exports.deleteVideo = (req, res) => {
  const { id } = req.params;
  const video = db.findVideoById(id);
  if (!video) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy video.' });
  }
  if (video.userId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Không có quyền xóa video này.' });
  }

  // Xóa file vật lý
  if (video.videoUrl) {
    const filePath = path.join(config.STORAGE_DIR, path.basename(video.videoUrl));
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }

  db.deleteVideo(id);
  res.json({ success: true, message: 'Đã xóa video thành công.' });
};

exports.enhancePrompt = (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp prompt.' });
  }
  const enhanced = aiStoryboard.enhancePrompt(prompt);
  res.json({ success: true, enhancedPrompt: enhanced });
};

/**
 * Nhận 2 clip 10s trực tiếp từ trình duyệt Gemini Ultra, tự động ghép 20s và lưu lên Server
 */
exports.uploadAndStitch = async (req, res) => {
  try {
    const files = req.files;
    if (!files || !files['clip1'] || !files['clip2']) {
      return res.status(400).json({
        success: false,
        message: 'Cần cung cấp đủ 2 clip 10s (clip1 và clip2) để ghép thành video 20s.'
      });
    }

    const clip1 = files['clip1'][0];
    const clip2 = files['clip2'][0];
    const prompt = (req.body.prompt || 'Gemini Ultra 20s Video').trim();
    const email = (req.body.email || 'khanhle1688@gmail.com').trim().toLowerCase();

    // Tìm hoặc tạo người dùng tương ứng
    let user = db.findUserByEmail(email);
    if (!user) {
      user = db.createUser({
        id: uuidv4(),
        name: email.split('@')[0],
        email: email,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
        authProvider: 'gemini-ultra-browser',
        createdAt: new Date().toISOString(),
      });
    }

    const videoId = uuidv4();
    const finalFilename = `gemini_20s_${videoId}.mp4`;
    const finalVideoPath = path.join(config.STORAGE_DIR, finalFilename);
    const thumbFilename = `thumb_${videoId}.jpg`;
    const finalThumbPath = path.join(config.STORAGE_DIR, thumbFilename);

    console.log(`[*] Đang tiến hành ghép 2 clip 10s từ Gemini Ultra cho ${email}...`);
    // Ghép 2 clip với hiệu ứng chuyển cảnh Crossfade mượt mà
    await ffmpegMerger.merge2Scenes([clip1.path, clip2.path], finalVideoPath, { useCrossfade: true });

    // Tạo thumbnail
    await ffmpegMerger.generateThumbnail(finalVideoPath, finalThumbPath);

    // Xóa file upload tạm
    try {
      if (fs.existsSync(clip1.path)) fs.unlinkSync(clip1.path);
      if (fs.existsSync(clip2.path)) fs.unlinkSync(clip2.path);
    } catch (e) {}

    const videoUrl = `/storage/videos/${finalFilename}`;
    const thumbnailUrl = `/storage/videos/${thumbFilename}`;
    const stat = fs.existsSync(finalVideoPath) ? fs.statSync(finalVideoPath) : { size: 0 };

    const newVideo = db.createVideo({
      id: videoId,
      userId: user.id,
      prompt: prompt,
      model: 'gemini-ultra-web',
      aspectRatio: '16:9',
      mode: '2x10s',
      duration: 20,
      status: 'completed',
      progress: 100,
      statusText: 'Đã tạo xong từ tài khoản Gemini Ultra & ghép 20s thành công!',
      videoUrl,
      thumbnailUrl,
      fileSize: Math.round((stat.size / (1024 * 1024)) * 100) / 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });

    console.log(`[+] Đã tạo xong video 20s từ Ultra cho ${email}: ${finalFilename}`);

    res.json({
      success: true,
      message: 'Ghép nối 2 clip 10s từ Gemini Ultra thành video 20s thành công!',
      video: newVideo,
      videoUrl: `https://gem.nexiq.win${videoUrl}`,
      webUrl: 'https://gem.nexiq.win'
    });
  } catch (err) {
    console.error('[X] Lỗi upload và ghép video:', err);
    res.status(500).json({ success: false, message: 'Lỗi ghép video: ' + err.message });
  }
};

/**
 * Nhận 1 video 20s đã được ghép hoàn chỉnh từ máy tính cá nhân của người dùng
 */
exports.uploadFinishedVideo = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Không nhận được file video 20s.' });
    }

    const prompt = (req.body.prompt || 'Gemini Ultra 20s Video').trim();
    const email = (req.body.email || 'khanhle1688@gmail.com').trim().toLowerCase();

    // Tìm hoặc tạo người dùng
    let user = db.findUserByEmail(email);
    if (!user) {
      user = db.createUser({
        id: uuidv4(),
        name: email.split('@')[0],
        email: email,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
        authProvider: 'gemini-ultra-browser',
        createdAt: new Date().toISOString(),
      });
    }

    const videoId = uuidv4();
    const finalFilename = `gemini_20s_${videoId}.mp4`;
    const finalVideoPath = path.join(config.STORAGE_DIR, finalFilename);
    const thumbFilename = `thumb_${videoId}.jpg`;
    const finalThumbPath = path.join(config.STORAGE_DIR, thumbFilename);

    // Di chuyển file vào thư mục lưu trữ
    fs.renameSync(file.path, finalVideoPath);

    // Tạo thumbnail
    try {
      await ffmpegMerger.generateThumbnail(finalVideoPath, finalThumbPath);
    } catch (e) {
      console.warn('Lỗi tạo thumbnail trên server:', e);
    }

    const videoUrl = `/storage/videos/${finalFilename}`;
    const thumbnailUrl = `/storage/videos/${thumbFilename}`;
    const stat = fs.existsSync(finalVideoPath) ? fs.statSync(finalVideoPath) : { size: 0 };

    const newVideo = db.createVideo({
      id: videoId,
      userId: user.id,
      prompt: prompt,
      model: 'gemini-ultra-web',
      aspectRatio: '16:9',
      mode: '2x10s',
      duration: 20,
      status: 'completed',
      progress: 100,
      statusText: 'Đã tạo từ tài khoản Gemini Ultra, ghép 20s tại máy và lưu trữ thành công!',
      videoUrl,
      thumbnailUrl,
      fileSize: Math.round((stat.size / (1024 * 1024)) * 100) / 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });

    console.log(`[+] Đã nhận video 20s từ máy client cho ${email}: ${finalFilename} (${newVideo.fileSize} MB)`);

    res.json({
      success: true,
      message: 'Video 20s đã được tải lên và lưu trữ thành công trên server!',
      video: newVideo,
      videoUrl: `https://gem.nexiq.win${videoUrl}`,
      webUrl: 'https://gem.nexiq.win'
    });
  } catch (err) {
    console.error('[X] Lỗi upload video hoàn chỉnh:', err);
    res.status(500).json({ success: false, message: 'Lỗi upload video: ' + err.message });
  }
};

