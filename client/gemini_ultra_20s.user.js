// ==UserScript==
// @name         Gemini Ultra 20s Auto Creator & Server Bridge
// @namespace    https://gem.nexiq.win/
// @version      2.3
// @description  Tự động tạo 2 clip 10s trên Gemini Ultra, ghép 20s tại máy bằng FFmpeg, đẩy lên server và tự động xóa sạch file rác (Chuẩn TrustedTypes cho Google)
// @author       Gemini Ultra Studio
// @match        *://gemini.google.com/*
// @include      *://gemini.google.com/*
// @run-at       document-idle
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
  let isLocalBridgeOnline = false;

  console.log('[Gemini Ultra 20s] Script khoi chay tren gemini.google.com...');

  // Helper tao DOM an toan 100% (Khong dung innerHTML de tranh bi chan boi Google TrustedTypes)
  function createEl(tag, styles = {}, text = '', attrs = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(styles)) {
      el.style.setProperty(k, v, 'important');
    }
    if (text) el.textContent = text;
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) {
        el[k] = v;
      } else {
        el.setAttribute(k, v);
      }
    }
    return el;
  }

  function setupUI() {
    if (!document.body) return;
    if (document.getElementById('gemini-ultra-float-btn')) return;

    // 1. Tao nut bam noi bat (Floating Button)
    const floatBtn = createEl('div', {
      'position': 'fixed',
      'bottom': '30px',
      'right': '30px',
      'z-index': '2147483647',
      'display': 'flex',
      'align-items': 'center',
      'gap': '10px',
      'cursor': 'pointer',
      'background': 'linear-gradient(135deg, #6366f1, #a855f7)',
      'color': '#ffffff',
      'padding': '14px 22px',
      'border-radius': '50px',
      'box-shadow': '0 10px 35px rgba(99, 102, 241, 0.7)',
      'font-family': 'Google Sans, Roboto, sans-serif',
      'font-weight': '700',
      'font-size': '15px',
      'border': '2px solid rgba(255,255,255,0.4)',
      'transition': 'all 0.2s ease',
      'user-select': 'none'
    });
    floatBtn.id = 'gemini-ultra-float-btn';

    const iconSpan = createEl('span', { 'font-size': '20px' }, '🎬');
    const textSpan = createEl('span', {}, 'Tạo Video 20s Ultra');
    floatBtn.appendChild(iconSpan);
    floatBtn.appendChild(textSpan);

    floatBtn.onmouseover = () => { floatBtn.style.setProperty('transform', 'scale(1.06)', 'important'); };
    floatBtn.onmouseout = () => { floatBtn.style.setProperty('transform', 'scale(1)', 'important'); };

    document.body.appendChild(floatBtn);

    // 2. Tao Modal dieu khien (DOM Thuan 100%)
    const modal = createEl('div', {
      'position': 'fixed',
      'inset': '0',
      'background': 'rgba(0,0,0,0.75)',
      'backdrop-filter': 'blur(8px)',
      'z-index': '2147483647',
      'display': 'none',
      'align-items': 'center',
      'justify-content:': 'center',
      'font-family': 'Google Sans, Roboto, sans-serif'
    });
    modal.id = 'gemini-ultra-modal';

    const modalBox = createEl('div', {
      'position': 'fixed',
      'top': '50%',
      'left': '50%',
      'transform': 'translate(-50%, -50%)',
      'background': '#18191c',
      'border': '1px solid rgba(255,255,255,0.15)',
      'border-radius': '16px',
      'width': '460px',
      'max-width': '90vw',
      'padding': '24px',
      'color': '#fff',
      'box-shadow': '0 25px 60px rgba(0,0,0,0.9)',
      'box-sizing': 'border-box'
    });

    // Header Modal
    const headerRow = createEl('div', {
      'display': 'flex',
      'justify-content': 'space-between',
      'align-items': 'center',
      'margin-bottom': '14px'
    });
    const title = createEl('h3', { 'margin': '0', 'font-size': '17px' }, '⚡ Gemini Ultra 20s Auto Creator');
    const closeBtn = createEl('button', {
      'background': 'transparent',
      'border': 'none',
      'color': '#aaa',
      'font-size': '24px',
      'cursor': 'pointer',
      'line-height': '1'
    }, '×');
    closeBtn.onclick = () => { modal.style.setProperty('display', 'none', 'important'); };
    headerRow.appendChild(title);
    headerRow.appendChild(closeBtn);
    modalBox.appendChild(headerRow);

    // Description
    const desc = createEl('p', {
      'font-size': '13px',
      'color': '#aaa',
      'margin-bottom': '16px',
      'line-height': '1.5'
    }, 'Tự động dùng gói Gemini Ultra tạo 2 cảnh (mỗi cảnh 10s), ghép thành video 20s mượt mà và lưu lên gem.nexiq.win!');
    modalBox.appendChild(desc);

    // Label 1
    const lbl1 = createEl('label', {
      'display': 'block',
      'font-size': '12px',
      'font-weight': 'bold',
      'color': '#c7d2fe',
      'margin-bottom': '6px'
    }, '1. Nhập ý tưởng Video (1 Prompt duy nhất):');
    modalBox.appendChild(lbl1);

    // Textarea prompt
    const promptInput = createEl('textarea', {
      'width': '100%',
      'box-sizing': 'border-box',
      'background': '#222429',
      'border': '1px solid #444',
      'border-radius': '8px',
      'color': '#fff',
      'padding': '10px',
      'margin-bottom': '14px',
      'font-size': '13px',
      'font-family': 'inherit',
      'resize': 'vertical'
    }, '', { 'rows': '3', 'placeholder': 'VD: Một phi thuyền vũ trụ bay qua vành đai sao Thổ rồi đáp xuống bề mặt hành tinh phát sáng kỳ ảo...' });
    promptInput.id = 'gu-prompt-input';
    modalBox.appendChild(promptInput);

    // Label 2
    const lbl2 = createEl('label', {
      'display': 'block',
      'font-size': '12px',
      'font-weight': 'bold',
      'color': '#c7d2fe',
      'margin-bottom': '6px'
    }, '2. Email nhận video trên gem.nexiq.win:');
    modalBox.appendChild(lbl2);

    // Input email
    const emailInput = createEl('input', {
      'width': '100%',
      'box-sizing': 'border-box',
      'background': '#222429',
      'border': '1px solid #444',
      'border-radius': '8px',
      'color': '#fff',
      'padding': '8px 10px',
      'margin-bottom': '14px',
      'font-size': '13px'
    }, '', { 'type': 'email', 'value': 'khanhle1688@gmail.com' });
    emailInput.id = 'gu-email-input';
    modalBox.appendChild(emailInput);

    // Mode Badge
    const modeBadge = createEl('div', {
      'font-size': '12px',
      'margin-bottom': '14px',
      'padding': '8px 12px',
      'background': 'rgba(16, 185, 129, 0.15)',
      'border': '1px solid rgba(16, 185, 129, 0.3)',
      'border-radius': '6px',
      'color': '#34d399'
    });
    modeBadge.id = 'gu-mode-badge';
    const modeText = createEl('span', {}, 'Đang kiểm tra kết nối bộ ghép máy tính...');
    modeText.id = 'gu-mode-text';
    modeBadge.appendChild(modeText);
    modalBox.appendChild(modeBadge);

    // Status Box
    const statusBox = createEl('div', {
      'display': 'none',
      'background': 'rgba(99, 102, 241, 0.15)',
      'border': '1px solid rgba(99, 102, 241, 0.3)',
      'border-radius': '8px',
      'padding': '12px',
      'margin-bottom': '16px',
      'font-size': '13px',
      'color': '#cbd5e1',
      'line-height': '1.4'
    });
    statusBox.id = 'gu-status-box';
    const statusText = createEl('div', {}, 'Đang chuẩn bị...');
    statusText.id = 'gu-status-text';
    statusBox.appendChild(statusText);
    modalBox.appendChild(statusBox);

    // Start Button
    const startBtn = createEl('button', {
      'width': '100%',
      'background': 'linear-gradient(135deg, #6366f1, #a855f7)',
      'color': '#fff',
      'border': 'none',
      'padding': '13px',
      'border-radius': '8px',
      'font-size': '14px',
      'font-weight': 'bold',
      'cursor': 'pointer',
      'transition': 'opacity 0.2s'
    }, '🚀 BẮT ĐẦU TẠO VIDEO 20S (2x10s)');
    startBtn.id = 'gu-start-btn';
    startBtn.onclick = handleStartCreation;
    modalBox.appendChild(startBtn);

    modal.appendChild(modalBox);
    document.body.appendChild(modal);

    // Click nut mo modal
    floatBtn.onclick = () => {
      modal.style.setProperty('display', 'block', 'important');
      checkLocalBridge();
    };

    console.log('[Gemini Ultra 20s] Da them nut noi vao document.body thanh cong!');
  }

  async function checkLocalBridge() {
    const modeText = document.getElementById('gu-mode-text');
    if (!modeText) return;
    try {
      const res = await fetch(`${LOCAL_BRIDGE_URL}/health`, { signal: AbortSignal.timeout(1500) });
      const data = await res.json();
      if (data && data.status === 'online') {
        isLocalBridgeOnline = true;
        modeText.textContent = '🖥️ Bộ ghép máy tính: SẴN SÀNG (Ghép tại máy, dọn sạch ổ cứng)';
        return;
      }
    } catch (e) {
      isLocalBridgeOnline = false;
      modeText.textContent = '🌐 Bộ ghép máy tính: Chưa bật (Sẽ ghép trực tiếp trên Server)';
    }
  }

  function setStatus(text, color = '#cbd5e1', linkUrl = null) {
    const box = document.getElementById('gu-status-box');
    const txt = document.getElementById('gu-status-text');
    if (box && txt) {
      box.style.setProperty('display', 'block', 'important');
      txt.textContent = text;
      txt.style.color = color;
      if (linkUrl) {
        const a = createEl('a', {
          'display': 'inline-block',
          'margin-top': '10px',
          'background': '#10b981',
          'color': '#ffffff',
          'padding': '8px 16px',
          'border-radius': '6px',
          'text-decoration': 'none',
          'font-weight': 'bold'
        }, '👉 Bấm vào đây để xem Video trên Web', { 'href': linkUrl, 'target': '_blank' });
        txt.appendChild(document.createElement('br'));
        txt.appendChild(a);
      }
    }
  }

  // Ham nhap va gui prompt vao o chat Gemini
  async function submitPromptToGemini(text) {
    const editor = document.querySelector('div.ql-editor') ||
                   document.querySelector('rich-textarea') ||
                   document.querySelector('div[contenteditable="true"]') ||
                   document.querySelector('textarea');

    if (!editor) throw new Error('Không tìm thấy ô nhập tin nhắn của Gemini! Hãy mở một cuộc trò chuyện mới.');

    editor.focus();
    if (editor.tagName.toLowerCase() === 'textarea') {
      editor.value = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      editor.textContent = text;
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

  // Ham cho video blob
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

  // Xu ly bat dau
  async function handleStartCreation() {
    const promptInput = document.getElementById('gu-prompt-input');
    const emailInput = document.getElementById('gu-email-input');
    const rawPrompt = promptInput ? promptInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : 'khanhle1688@gmail.com';

    if (!rawPrompt) {
      alert('Vui lòng nhập ý tưởng video!');
      return;
    }

    const startBtn = document.getElementById('gu-start-btn');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = '⏳ Đang tự động xử lý...';
    }

    try {
      await checkLocalBridge();

      const p1 = `Tạo video 10s: Cảnh 1 mở đầu, ${rawPrompt}, góc quay toàn cảnh điện ảnh sắc nét 4K 60fps, camera tracking mượt mà.`;
      const p2 = `Tạo video 10s: Cảnh 2 tiếp nối liền mạch cảnh 1 của ${rawPrompt}, cao trào diễn tiến hành động, ánh sáng điện ảnh rực rỡ, camera lùi xa.`;

      // Cảnh 1
      setStatus(`⏳ [Bước 1/3] Đang yêu cầu Gemini Ultra tạo Cảnh 1 (10s)...`);
      await submitPromptToGemini(p1);

      setStatus(`⏳ [Bước 1/3] Đang chờ Cảnh 1 render xong (khoảng 1-2 phút)...`);
      const clip1Blob = await waitForVideoBlob(4);
      setStatus(`✅ Đã nhận được Cảnh 1 (10s)! Đang chuẩn bị tạo Cảnh 2...`, '#34d399');

      await new Promise(r => setTimeout(r, 4000));

      // Cảnh 2
      setStatus(`⏳ [Bước 2/3] Đang yêu cầu Gemini Ultra tạo Cảnh 2 (10s)...`);
      await submitPromptToGemini(p2);

      setStatus(`⏳ [Bước 2/3] Đang chờ Cảnh 2 render xong...`);
      const clip2Blob = await waitForVideoBlob(4);
      setStatus(`✅ Đã nhận được Cảnh 2 (10s)! Đang tiến hành ghép...`, '#34d399');

      // Ghép video
      const formData = new FormData();
      formData.append('clip1', clip1Blob, 'clip1.mp4');
      formData.append('clip2', clip2Blob, 'clip2.mp4');
      formData.append('prompt', rawPrompt);
      formData.append('email', email);

      let uploadRes;
      if (isLocalBridgeOnline) {
        setStatus(`⚙️ [Bước 3/3] Đang chuyển vào máy tính: Ghép nối 20s bằng FFmpeg, đẩy lên server và tự động xóa sạch rác...`);
        uploadRes = await fetch(`${LOCAL_BRIDGE_URL}/stitch-and-upload`, {
          method: 'POST',
          body: formData
        });
      } else {
        setStatus(`🌐 [Bước 3/3] Đang gửi 2 clip lên server gem.nexiq.win để ghép mượt bằng FFmpeg...`);
        uploadRes = await fetch(`${SERVER_URL}/api/videos/upload-and-stitch`, {
          method: 'POST',
          body: formData
        });
      }

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Lỗi xử lý ghép video.');
      }

      const cleanNote = isLocalBridgeOnline ? ' (Đã dọn dẹp sạch ổ cứng máy tính!)' : '';
      setStatus(`🎉 THÀNH CÔNG RỰC RỠ! Video 20s hoàn chỉnh đã có mặt trên server!${cleanNote}`, '#34d399', SERVER_URL);

    } catch (err) {
      setStatus(`❌ Lỗi: ${err.message}`, '#f87171');
    } finally {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = '🚀 BẮT ĐẦU TẠO VIDEO 20S (2x10s)';
      }
    }
  }

  // Tu dong chay va bam giu nut tren giao dien Gemini SPA
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUI);
  } else {
    setupUI();
  }

  setInterval(setupUI, 1000);

})();
