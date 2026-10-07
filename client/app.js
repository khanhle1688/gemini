/**
 * Gemini Video 20s Studio - Frontend Application
 */

const API_BASE = window.location.origin;

// State
let currentUser = null;
let currentToken = localStorage.getItem('gv20s_token') || null;
let selectedRatio = '16:9';
let activePollingInterval = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const authModal = document.getElementById('auth-modal');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const btnCloseModal = document.getElementById('btn-close-modal');
const authError = document.getElementById('auth-error');
const btnQuickDemo = document.getElementById('btn-quick-demo');

const promptInput = document.getElementById('prompt-input');
const charCount = document.getElementById('char-count');
const btnEnhance = document.getElementById('btn-enhance');
const modelSelect = document.getElementById('model-select');
const ratioBtns = document.querySelectorAll('.btn-ratio');
const btnGenerate = document.getElementById('btn-generate');

const progressSection = document.getElementById('progress-section');
const progressStatusText = document.getElementById('progress-status-text');
const progressPercent = document.getElementById('progress-percent');
const progressBarFill = document.getElementById('progress-bar-fill');
const sceneText1 = document.getElementById('scene-text-1');
const sceneText2 = document.getElementById('scene-text-2');

const resultSection = document.getElementById('result-section');
const resultPromptTitle = document.getElementById('result-prompt-title');
const mainVideoPlayer = document.getElementById('main-video-player');
const btnDownloadVideo = document.getElementById('btn-download-video');
const btnCopyLink = document.getElementById('btn-copy-link');

const galleryGrid = document.getElementById('gallery-grid');
const btnRefreshGallery = document.getElementById('btn-refresh-gallery');

// --- Khởi tạo ứng dụng ---
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  if (currentToken) {
    await checkCurrentUser();
  } else {
    renderAuthNav();
  }
  loadGallery();
});

// --- Auth Functions ---
async function checkCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      renderAuthNav();
      loadGallery();
    } else {
      logout();
    }
  } catch (err) {
    logout();
  }
}

function renderAuthNav() {
  if (currentUser) {
    const avatarHtml = currentUser.avatar 
      ? `<img src="${currentUser.avatar}" alt="${currentUser.name}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #6366f1;">`
      : `<div class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>`;

    authSection.innerHTML = `
      <div class="user-profile">
        ${avatarHtml}
        <div>
          <div style="font-size: 0.85rem; font-weight: 700;">${currentUser.name}</div>
          <button class="btn-logout" id="btn-logout">Đăng xuất</button>
        </div>
      </div>
    `;
    document.getElementById('btn-logout').addEventListener('click', logout);
  } else {
    authSection.innerHTML = `
      <button class="btn-nav-auth" id="btn-open-login">Đăng Nhập / Đăng Ký</button>
    `;
    document.getElementById('btn-open-login').addEventListener('click', () => openAuthModal('login'));
  }
}

// Xử lý phản hồi đăng nhập từ Google (Google Identity Services)
async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) return;

  try {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('gv20s_token', currentToken);
    closeAuthModal();
    renderAuthNav();
    loadGallery();
  } catch (err) {
    authError.textContent = 'Lỗi Google Sign-In: ' + err.message;
    authError.classList.remove('hidden');
  }
}

function openAuthModal(tab = 'login') {
  authError.classList.add('hidden');
  authModal.classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  authModal.classList.add('hidden');
}

function switchAuthTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

function logout() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem('gv20s_token');
  renderAuthNav();
  galleryGrid.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; grid-column: 1/-1; text-align: center;">Vui lòng đăng nhập để xem lịch sử video trên server.</p>';
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Khởi tạo Google Identity Services
  initGoogleAuth();

  // Modal tabs
  tabLogin.addEventListener('click', () => switchAuthTab('login'));
  tabRegister.addEventListener('click', () => switchAuthTab('register'));
  btnCloseModal.addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
  });

  // Login Submit
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      currentToken = data.token;
      currentUser = data.user;
      localStorage.setItem('gv20s_token', currentToken);
      closeAuthModal();
      renderAuthNav();
      loadGallery();
    } catch (err) {
      authError.textContent = err.message;
      authError.classList.remove('hidden');
    }
  });

  // Quick Demo Login
  btnQuickDemo.addEventListener('click', () => {
    document.getElementById('login-email').value = 'demo@gemini.ai';
    document.getElementById('login-password').value = '123456';
    formLogin.dispatchEvent(new Event('submit'));
  });

  // Register Submit
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      currentToken = data.token;
      currentUser = data.user;
      localStorage.setItem('gv20s_token', currentToken);
      closeAuthModal();
      renderAuthNav();
      loadGallery();
    } catch (err) {
      authError.textContent = err.message;
      authError.classList.remove('hidden');
    }
  });

  // Prompt Character Count
  promptInput.addEventListener('input', () => {
    charCount.textContent = `${promptInput.value.length} ký tự`;
  });

  // Aspect Ratio Toggle
  ratioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ratioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRatio = btn.getAttribute('data-ratio');
    });
  });

  // Enhance Prompt (AI Enhancer)
  btnEnhance.addEventListener('click', async () => {
    const raw = promptInput.value.trim();
    if (!raw) {
      alert('Vui lòng nhập một ý tưởng ngắn trước khi nâng cấp.');
      return;
    }
    if (!currentToken) {
      openAuthModal('login');
      return;
    }

    btnEnhance.disabled = true;
    btnEnhance.textContent = '⏳ Đang phân tích phong cách điện ảnh...';
    try {
      const res = await fetch(`${API_BASE}/api/videos/enhance-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ prompt: raw })
      });
      const data = await res.json();
      if (data.success && data.enhancedPrompt) {
        promptInput.value = data.enhancedPrompt;
        charCount.textContent = `${promptInput.value.length} ký tự`;
      }
    } catch (err) {
      console.error(err);
    } finally {
      btnEnhance.disabled = false;
      btnEnhance.innerHTML = '<span>✨ Nâng cấp Prompt (AI Enhancer)</span>';
    }
  });

  // Generate 20s Video Button
  btnGenerate.addEventListener('click', startVideoGeneration);

  // Refresh Gallery
  btnRefreshGallery.addEventListener('click', loadGallery);

  // Copy Link Button
  btnCopyLink.addEventListener('click', () => {
    const videoSrc = mainVideoPlayer.src;
    if (videoSrc) {
      navigator.clipboard.writeText(videoSrc);
      const originalText = btnCopyLink.innerHTML;
      btnCopyLink.innerHTML = '<span>✅ Đã sao chép link server!</span>';
      setTimeout(() => {
        btnCopyLink.innerHTML = originalText;
      }, 2500);
    }
  });
}

// --- Video Generation Pipeline ---
async function startVideoGeneration() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    alert('Vui lòng nhập mô tả ý tưởng cho video 20s.');
    promptInput.focus();
    return;
  }

  if (!currentToken) {
    openAuthModal('login');
    return;
  }

  const model = modelSelect.value;
  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span>⏳ Đang khởi tạo luồng tự động...</span>';

  // Hiện khu vực tiến trình
  progressSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  updateProgress(5, 'Đang gửi yêu cầu và khởi tạo hàng đợi...');
  sceneText1.textContent = 'Đang chờ phân tích kịch bản...';
  sceneText2.textContent = 'Đang chờ phân tích kịch bản...';

  try {
    const res = await fetch(`${API_BASE}/api/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({
        prompt,
        model,
        aspectRatio: selectedRatio
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const videoId = data.video.id;
    startPolling(videoId);

  } catch (err) {
    alert('Lỗi tạo video: ' + err.message);
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = '<span>🚀 BẮT ĐẦU TẠO VIDEO 20S HOÀN CHỈNH</span>';
    progressSection.classList.add('hidden');
  }
}

function updateProgress(percent, text) {
  progressPercent.textContent = `${percent}%`;
  progressBarFill.style.width = `${percent}%`;
  progressStatusText.textContent = text;
}

function startPolling(videoId) {
  if (activePollingInterval) clearInterval(activePollingInterval);

  activePollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/status/${videoId}`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (!data.success || !data.video) return;

      const video = data.video;
      updateProgress(video.progress, video.statusText || 'Đang xử lý...');

      if (video.scene1Prompt) sceneText1.textContent = video.scene1Prompt;
      if (video.scene2Prompt) sceneText2.textContent = video.scene2Prompt;

      if (video.status === 'completed') {
        clearInterval(activePollingInterval);
        activePollingInterval = null;
        onVideoComplete(video);
      } else if (video.status === 'failed') {
        clearInterval(activePollingInterval);
        activePollingInterval = null;
        alert(`Tạo video thất bại: ${video.error || 'Lỗi không xác định'}`);
        btnGenerate.disabled = false;
        btnGenerate.innerHTML = '<span>🚀 BẮT ĐẦU TẠO VIDEO 20S HOÀN CHỈNH</span>';
        progressSection.classList.add('hidden');
      }
    } catch (err) {
      console.warn('Lỗi kiểm tra trạng thái video:', err);
    }
  }, 1200);
}

function onVideoComplete(video) {
  btnGenerate.disabled = false;
  btnGenerate.innerHTML = '<span>🚀 BẮT ĐẦU TẠO VIDEO 20S HOÀN CHỈNH</span>';
  progressSection.classList.add('hidden');

  resultPromptTitle.textContent = `"${video.prompt}"`;
  const absoluteUrl = `${API_BASE}${video.videoUrl}`;
  mainVideoPlayer.src = absoluteUrl;
  btnDownloadVideo.href = absoluteUrl;
  btnDownloadVideo.setAttribute('download', `Gemini_20s_${video.id}.mp4`);

  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth' });

  loadGallery();
}

// --- Gallery Management ---
async function loadGallery() {
  if (!currentToken) {
    galleryGrid.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; grid-column: 1/-1; text-align: center;">Vui lòng đăng nhập để xem các video đã tạo trên server.</p>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/videos/my`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (!data.success || !data.videos) return;

    if (data.videos.length === 0) {
      galleryGrid.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; grid-column: 1/-1; text-align: center;">Chưa có video nào. Hãy nhập prompt ở trên để tạo video 20s đầu tiên của bạn!</p>';
      return;
    }

    galleryGrid.innerHTML = data.videos.map(v => {
      const isCompleted = v.status === 'completed';
      const videoSrc = v.videoUrl ? `${API_BASE}${v.videoUrl}` : '';
      const thumbSrc = v.thumbnailUrl ? `${API_BASE}${v.thumbnailUrl}` : '';

      return `
        <div class="gallery-card">
          <div class="gallery-card-thumb">
            ${isCompleted ? `
              <video src="${videoSrc}" poster="${thumbSrc}" preload="metadata" muted onmouseover="this.play()" onmouseout="this.pause()"></video>
              <span class="gallery-duration-badge">⏱️ 20s</span>
            ` : `
              <div style="color: #f59e0b; font-size: 0.85rem; padding: 20px; text-align: center;">
                ⏳ ${v.statusText || 'Đang xử lý...'}
              </div>
            `}
          </div>

          <div class="gallery-card-body">
            <div class="gallery-card-prompt" title="${v.prompt}">${v.prompt}</div>
            
            <div class="gallery-card-footer">
              <span>${new Date(v.createdAt).toLocaleDateString('vi-VN')}</span>
              <div class="gallery-actions">
                ${isCompleted ? `
                  <a href="${videoSrc}" download="Gemini_20s_${v.id}.mp4" class="btn-card-action" title="Tải về">⬇️</a>
                  <button class="btn-card-action" onclick="copyVideoUrl('${videoSrc}')" title="Sao chép link">🔗</button>
                ` : ''}
                <button class="btn-card-action delete" onclick="deleteVideoItem('${v.id}')" title="Xóa">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Lỗi tải danh sách video:', err);
  }
}

window.copyVideoUrl = function(url) {
  navigator.clipboard.writeText(url);
  alert('Đã sao chép link video trên server vào bộ nhớ tạm!');
};

window.deleteVideoItem = async function(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa video này khỏi server không?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/videos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();
    if (data.success) {
      loadGallery();
    } else {
      alert('Không thể xóa: ' + data.message);
    }
  } catch (err) {
    alert('Lỗi: ' + err.message);
  }
};

// Khởi tạo Google Identity Services
async function initGoogleAuth() {
  const btnGoogle = document.getElementById('btn-google-login');
  const googleContainer = document.getElementById('google-btn-container');

  try {
    const res = await fetch(`${API_BASE}/api/auth/google-client-id`);
    const data = await res.json();
    const clientId = data.clientId;

    if (clientId && window.google && window.google.accounts) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
      });

      // Render nút chính thức của Google
      googleContainer.innerHTML = '';
      google.accounts.id.renderButton(googleContainer, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 320
      });
    } else if (btnGoogle) {
      // Khi chưa cấu hình GOOGLE_CLIENT_ID trong .env
      btnGoogle.addEventListener('click', () => {
        if (!clientId) {
          alert('Để bật Google Sign-in: Bạn chỉ cần thêm GOOGLE_CLIENT_ID vào file .env trên server (tạo miễn phí tại console.cloud.google.com). Trong lúc này bạn có thể dùng tài khoản demo hoặc đăng ký trực tiếp.');
        } else if (window.google && window.google.accounts) {
          google.accounts.id.prompt();
        }
      });
    }
  } catch (err) {
    console.warn('Google Auth Init:', err);
  }
}

