const fs = require('fs');
const path = require('path');
const config = require('../config');

const usersFile = path.join(config.DATA_DIR, 'users.json');
const videosFile = path.join(config.DATA_DIR, 'videos.json');

// Khởi tạo thư mục data nếu chưa có
if (!fs.existsSync(config.DATA_DIR)) {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

function loadData(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content || '[]');
    }
  } catch (err) {
    console.error(`Lỗi đọc file database ${filePath}:`, err.message);
  }
  return [];
}

function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Lỗi lưu file database ${filePath}:`, err.message);
  }
}

class Database {
  constructor() {
    this.users = loadData(usersFile);
    this.videos = loadData(videosFile);
  }

  // --- Users ---
  findUserByEmail(email) {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id) {
    return this.users.find(u => u.id === id);
  }

  createUser(user) {
    this.users.push(user);
    saveData(usersFile, this.users);
    return user;
  }

  // --- Videos ---
  findVideoById(id) {
    return this.videos.find(v => v.id === id);
  }

  findVideosByUserId(userId) {
    return this.videos
      .filter(v => v.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createVideo(video) {
    this.videos.push(video);
    saveData(videosFile, this.videos);
    return video;
  }

  updateVideo(id, updates) {
    const idx = this.videos.findIndex(v => v.id === id);
    if (idx !== -1) {
      this.videos[idx] = { ...this.videos[idx], ...updates, updatedAt: new Date().toISOString() };
      saveData(videosFile, this.videos);
      return this.videos[idx];
    }
    return null;
  }

  deleteVideo(id) {
    const idx = this.videos.findIndex(v => v.id === id);
    if (idx !== -1) {
      const removed = this.videos.splice(idx, 1)[0];
      saveData(videosFile, this.videos);
      return removed;
    }
    return null;
  }
}

module.exports = new Database();
