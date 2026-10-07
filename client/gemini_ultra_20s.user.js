// ==UserScript==
// @name         Gemini Ultra 20s Auto Creator & Server Bridge
// @namespace    https://gem.nexiq.win/
// @version      2.1
// @description  Tự động tạo 2 clip 10s trên Gemini Ultra, ghép 20s tại máy bằng FFmpeg, đẩy lên server và tự động xóa sạch file rác
// @author       Gemini Ultra Studio
// @match        https://gemini.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      gem.nexiq.win
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function() {
  'use strict';

  const SERVER_URL = 'https://gem.nexiq.win';
  const LOCAL_BRIDGE_URL = 'http://127.0.0.1:4567';

  // Tạo nút kích hoạt nổi ở góc dưới bên phải màn hình Gemini
  const floatBtn = document.createElement('div');
  floatBtn.id = 'gemini-ultra-float-btn';
  floatBtn.innerHTML = `
    <div style="position: fixed; bottom: 25px; right: 25px; z-index: 999999; display: flex; align-items: center; gap: 10px; cursor: pointer; background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; padding: 12px 18px; border-radius: 50px; box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5); font-family: 'Google Sans', Roboto, sans-serif; font-weight: 700; font-size: 14px; border: 2px solid rgba(255,255,255,0.2); transition: transform 0.2s;">
      <span style="font-size: 20px;">🎬</span>
      <span>Tạo Video 20s Ultra</span>
    </div>
  `;
  document.body.appendChild(floatBtn);

  // Tạo Modal điều khiển
  const modal = document.createElement('div');
  modal.id = 'gemini-ultra-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); z-index: 1000000; display: flex; align-items: center; justify-content: center; font-family: 'Google Sans', Roboto, sans-serif;">
      <div style="background: #18191c; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; width: 460px; padding: 24px; color: #fff; box-shadow: 0 20px 40px rgba(0,0,0,0.8); position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 17px; display: flex; align-items: center; gap: 8px;">
            <span>⚡</span> Gemini Ultra 20s Auto Creator
          </h3>
          <button id="gu-close-btn" style="background: transparent; border: none; color: #999; font-size: 22px; cursor: pointer;">&times;</button>
        </div>

        <p style="font-size: 13px; color: #aaa; margin-bottom: 14px; line-height: 1.5;">
          Tự động dùng gói <b>Gemini Ultra</b> tạo 2 cảnh (mỗi cảnh 10s), ghép thành video <b>20s</b> mượt mà và lưu lên <b>gem.nexiq.win</b>!
        </p>

        <label style="font-size: 12px; font-weight: bold; color: #c7d2fe;">1. Nhập ý tưởng Video (1 Prompt duy nhất):</label>
        <textarea id="gu-prompt-input" rows="3" placeholder="VD: Một phi thuyền vũ trụ bay qua vành đai sao Thổ rồi đáp xuống bề mặt hành tinh phát sáng kỳ ảo..." style="width: 100%; box-sizing: border-box; background: #222429; border: 1px solid #444; border-radius: 8px; color: #fff; padding: 10px; margin: 6px 0 14px 0; font-size: 13px; font-family: inherit; resize: vertical;"></textarea>

        <label style="font-size: 12px; font-weight: bold; color: #c7d2fe;">2. Email nhận video trên gem.nexiq.win:</label>
        <input id="gu-email-input" type="email" value="khanhle1688@gmail.com" style="width: 100%; box-sizing: border-box; background: #222429; border: 1px solid #444; border-radius: 8px; color: #fff; padding: 8px 10px; margin: 6px 0 16px 0; font-size: 13px;">

        <div id="gu-mode-badge" style="font-size: 12px; margin-bottom: 12px; padding: 8px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; color: #34d399; display: flex; align-items: center; gap: 6px;">
          <span>🖥️</span> <span id="gu-mode-text">Kiểm tra kết nối bộ ghép máy tính...</span>
        </div>

        <div id="gu-status-box" style="display: none; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; color: #cbd5e1; line-height: 1.4;">
          <div id="gu-status-text">Đang chuẩn bị...</div>
        </div>

        <button id="gu-start-btn" style="width: 100%; background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>🚀</span> BẮT ĐẦU TẠO VIDEO 20S (2x10s)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Mở / Đóng Modal
  floatBtn.onclick = () => {
    modal.style.display = 'block';
    checkLocalBridge();
  };
  document.getElementById('gu-close-btn').onclick = () => { modal.style.display = 'none'; };

  let isLocalBridgeOnline = false;

  async function checkLocalBridge() {
    const modeText = document.getElementById('gu-mode-text');
    try {
      const res = await fetch(`${LOCAL_BRIDGE_URL}/health`, { signal: AbortSignal.timeout(1500) });
      const data = await res.json();
      if (data && data.status === 'online') {
        isLocalBridgeOnline = true;
        modeText.innerHTML = '<b>Bộ ghép máy tính: SẴN SÀNG</b> (Ghép tại máy, dọn sạch ổ cứng, tiết kiệm 100% dung lượng)';
        return;
      }
    } catch (e) {
      isLocalBridgeOnline = false;
      modeText.innerHTML = '<b>Bộ ghép máy tính: Chưa bật</b> (Sẽ ghép trực tiếp trên Server)';
    }
  }

  function setStatus(text, color = '#cbd5e1') {
    const box = document.getElementById('gu-status-box');
    const txt = document.getElementById('gu-status-text');
    box.style.display = 'block';
    txt.innerHTML = text;
    txt.style.color = color;
  }

  // Hàm gõ và gửi prompt vào khung chat Gemini
  async function submitPromptToGemini(text) {
    const editor = document.querySelector('div.ql-editor') ||
                   document.querySelector('rich-textarea') ||
                   document.querySelector('div[contenteditable="true"]') ||
                   document.querySelector('textarea');

    if (!editor) throw new Error('Không tìm thấy ô nhập tin nhắn của Gemini!');

    editor.focus();
    if (editor.tagName.toLowerCase() === 'textarea') {
      editor.value = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      editor.innerHTML = `<p>${text}</p>`;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await new Promise(r => setTimeout(r, 600));

    const sendBtn = document.querySelector('button[aria-label*="Send"]') ||
                    document.querySelector('button[aria-label*="Gửi"]') ||
                    document.querySelector('button.send-button');

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    }
  }

  // Hàm chờ video render xong và lấy file Blob
  async function waitForVideoBlob(timeoutMinutes = 4) {
    const startTime = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const initialVideos = Array.from(document.querySelectorAll('video'));

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 3000));

      const currentVideos = Array.from(document.querySelectorAll('video'));
      const newVideo = currentVideos.find(v => !initialVideos.includes(v) && v.src);

      if (newVideo && newVideo.src) {
        try {
          const res = await fetch(newVideo.src);
          const blob = await res.blob();
          if (blob && blob.size > 10000) {
            return blob;
          }
        } catch (e) {
          console.warn('Lỗi fetch blob:', e);
        }
      }
    }
    throw new Error('Hết thời gian chờ video từ Gemini Ultra!');
  }

  // Xử lý sự kiện bấm Bắt Đầu
  document.getElementById('gu-start-btn').onclick = async () => {
    const rawPrompt = document.getElementById('gu-prompt-input').value.trim();
    const email = document.getElementById('gu-email-input').value.trim();

    if (!rawPrompt) {
      alert('Vui lòng nhập ý tưởng video!');
      return;
    }

    const startBtn = document.getElementById('gu-start-btn');
    startBtn.disabled = true;
    startBtn.innerText = '⏳ Đang tự động xử lý...';

    try {
      await checkLocalBridge();

      // 1. Phân tách kịch bản thành 2 cảnh 10s
      const p1 = `Tạo video 10s: Cảnh 1 mở đầu, ${rawPrompt}, góc quay toàn cảnh điện ảnh sắc nét 4K 60fps, camera tracking mượt mà.`;
      const p2 = `Tạo video 10s: Cảnh 2 tiếp nối liền mạch cảnh 1 của ${rawPrompt}, cao trào diễn tiến hành động, ánh sáng điện ảnh rực rỡ, camera lùi xa.`;

      // 2. Chạy Cảnh 1 (0-10s)
      setStatus(`⏳ <b>[Bước 1/3]</b> Đang yêu cầu Gemini Ultra tạo <b>Cảnh 1 (10s)</b>...<br><small>${p1.slice(0, 60)}...</small>`);
      await submitPromptToGemini(p1);

      setStatus(`⏳ <b>[Bước 1/3]</b> Đang chờ Cảnh 1 render xong (khoảng 1-2 phút)...`);
      const clip1Blob = await waitForVideoBlob(4);
      setStatus(`✅ Đã nhận được Cảnh 1 (10s)! Đang chuẩn bị tạo Cảnh 2...`, '#34d399');

      await new Promise(r => setTimeout(r, 4000));

      // 3. Chạy Cảnh 2 (10-20s)
      setStatus(`⏳ <b>[Bước 2/3]</b> Đang yêu cầu Gemini Ultra tạo <b>Cảnh 2 (10s)</b>...<br><small>${p2.slice(0, 60)}...</small>`);
      await submitPromptToGemini(p2);

      setStatus(`⏳ <b>[Bước 2/3]</b> Đang chờ Cảnh 2 render xong...`);
      const clip2Blob = await waitForVideoBlob(4);
      setStatus(`✅ Đã nhận được Cảnh 2 (10s)! Đang tiến hành ghép...`, '#34d399');

      // 4. Ghép video và đẩy lên Server
      const formData = new FormData();
      formData.append('clip1', clip1Blob, 'clip1.mp4');
      formData.append('clip2', clip2Blob, 'clip2.mp4');
      formData.append('prompt', rawPrompt);
      formData.append('email', email);

      let uploadRes;
      if (isLocalBridgeOnline) {
        setStatus(`⚙️ <b>[Bước 3/3]</b> Đang chuyển vào máy tính: Ghép nối 20s bằng FFmpeg, đẩy lên server và <b>tự động xóa sạch rác trên máy</b>...`);
        uploadRes = await fetch(`${LOCAL_BRIDGE_URL}/stitch-and-upload`, {
          method: 'POST',
          body: formData
        });
      } else {
        setStatus(`🌐 <b>[Bước 3/3]</b> Đang gửi 2 clip lên server gem.nexiq.win để ghép mượt bằng FFmpeg...`);
        uploadRes = await fetch(`${SERVER_URL}/api/videos/upload-and-stitch`, {
          method: 'POST',
          body: formData
        });
      }

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Lỗi xử lý ghép video.');
      }

      const cleanNote = isLocalBridgeOnline ? '<br><small>🧹 Đã xóa sạch toàn bộ file tạm trên máy tính của bạn!</small>' : '';
      setStatus(`🎉 <b>THÀNH CÔNG RỰC RỠ!</b><br>Video 20s hoàn chỉnh đã có mặt trên server!${cleanNote}<br><br><a href="${SERVER_URL}" target="_blank" style="display: inline-block; background: #10b981; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">👉 Bấm vào đây để xem Video trên Web</a>`, '#34d399');

    } catch (err) {
      setStatus(`❌ <b>Lỗi:</b> ${err.message}`, '#f87171');
    } finally {
      startBtn.disabled = false;
      startBtn.innerText = '🚀 BẮT ĐẦU TẠO VIDEO 20S (2x10s)';
    }
  };
})();
