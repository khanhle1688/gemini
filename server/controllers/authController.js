const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');

// Tự động tạo 1 tài khoản mặc định demo nếu database chưa có ai
(async () => {
  if (db.users.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);
    db.createUser({
      id: uuidv4(),
      name: 'Người Sáng Tạo',
      email: 'demo@gemini.ai',
      password: hash,
      createdAt: new Date().toISOString(),
    });
    console.log('[*] Đã tạo tài khoản demo: demo@gemini.ai / 123456');
  }
})();

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã được đăng ký.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = db.createUser({
      id: uuidv4(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });

    const token = jwt.sign({ id: newUser.id }, config.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const token = jwt.sign({ id: user.id }, config.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Thiếu mã xác thực Google Credential.' });
    }

    // Xác thực token với máy chủ Google
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`;
    const response = await fetch(googleVerifyUrl);
    const payload = await response.json();

    if (!payload || payload.error || !payload.email) {
      return res.status(401).json({
        success: false,
        message: 'Token Google không hợp lệ hoặc đã hết hạn: ' + (payload.error_description || payload.error || '')
      });
    }

    const { email, name, picture, sub: googleId } = payload;

    // Tìm hoặc tạo người dùng trong database
    let user = db.findUserByEmail(email);
    if (!user) {
      user = db.createUser({
        id: uuidv4(),
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        avatar: picture || '',
        googleId,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
      });
      console.log(`[+] Đã tạo tài khoản Google mới: ${email}`);
    } else {
      // Cập nhật thông tin avatar hoặc googleId nếu có thay đổi
      db.updateUser ? db.updateUser(user.id, { avatar: picture, googleId }) : (user.avatar = picture);
    }

    const token = jwt.sign({ id: user.id }, config.JWT_SECRET, { expiresIn: '14d' });

// Đăng nhập nhanh 1-Chạm bằng Gmail (Không cần Google Cloud Console)
exports.quickGoogleLogin = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đúng định dạng địa chỉ Gmail.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const name = cleanEmail.split('@')[0];
    // Avatar phong cách Google Material Design
    const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`;

    let user = db.findUserByEmail(cleanEmail);
    if (!user) {
      user = db.createUser({
        id: uuidv4(),
        name: name,
        email: cleanEmail,
        avatar: avatarUrl,
        authProvider: 'gmail-quick',
        createdAt: new Date().toISOString(),
      });
      console.log(`[+] Đã tạo tài khoản Gmail 1-Click: ${cleanEmail}`);
    }

    const token = jwt.sign({ id: user.id }, config.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      message: 'Đăng nhập Gmail thành công!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || avatarUrl
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.me = (req, res) => {
  res.json({ success: true, user: req.user });
};
