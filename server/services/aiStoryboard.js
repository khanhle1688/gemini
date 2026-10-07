const config = require('../config');

class AIStoryboardService {
  /**
   * Phân tích 1 master prompt thành 2 phân cảnh 10s (Tổng 20s)
   */
  async splitInto2Scenes(masterPrompt, model = 'veo-2') {
    // Nếu có API key của Google Gemini
    if (config.GEMINI_API_KEY) {
      try {
        return await this.callGeminiAPI(masterPrompt);
      } catch (err) {
        console.warn('[!] Không thể gọi Gemini API, chuyển sang Bộ não Phân cảnh Nội bộ:', err.message);
      }
    }

    // Bộ não Phân cảnh Kịch bản Điện ảnh Nội bộ (Không cần API key ngoài)
    return this.fallbackStoryboard(masterPrompt);
  }

  /**
   * Tạo 2 phân cảnh điện ảnh 10s thông minh từ master prompt
   */
  fallbackStoryboard(prompt, model = 'gemini-3.5-flash-lite') {
    const cleanPrompt = prompt.trim();

    // Rút trích các từ khóa thị giác chính
    // Nếu prompt dài hoặc là một câu chuyện, chuyển đổi thành bối cảnh thị giác điện ảnh
    const visualSubject = cleanPrompt
      .replace(/["“”]/g, '')
      .slice(0, 120);

    const scene1Prompt = `cinematic film still, opening scene of ${visualSubject}, atmospheric volumetric lighting, cinematic color grading, photorealistic, 4k ultra-detailed, 8k resolution, Arri Alexa`;
    const scene2Prompt = `cinematic film still, continuing dramatic climax of ${visualSubject}, dramatic shadows, smooth camera perspective, hyper-realistic details, cinematic photography`;

    return {
      masterPrompt: cleanPrompt,
      model,
      mode: '2x10s',
      totalDuration: 20,
      scenes: [
        {
          sceneIndex: 1,
          timeRange: '0-10s',
          duration: 10,
          title: 'Phân cảnh 1: Mở đầu & Diễn tiến',
          prompt: scene1Prompt,
          displayPrompt: `Cảnh 1 (0-10s): Thiết lập không gian mở đầu cho "${visualSubject.slice(0, 60)}..."`,
        },
        {
          sceneIndex: 2,
          timeRange: '10-20s',
          duration: 10,
          title: 'Phân cảnh 2: Cao trào & Kết thúc',
          prompt: scene2Prompt,
          displayPrompt: `Cảnh 2 (10-20s): Diễn tiến cao trào tiếp nối cho "${visualSubject.slice(0, 60)}..."`,
        },
      ],
    };
  }

  /**
   * Nâng cấp Prompt bằng 1-Click (AI Prompt Enhancer)
   */
  enhancePrompt(prompt) {
    const p = prompt.trim();
    if (!p) return '';

    const cinematicKeywords = [
      'photorealistic 4K HDR',
      'cinematic lighting',
      'volumetric smoke and light rays',
      'Arri Alexa 65 camera style',
      'smooth 60fps motion',
      'shallow depth of field with beautiful bokeh',
      'hyper-detailed textures',
    ];

    const enhanced = `${p}, ${cinematicKeywords.join(', ')}`;
    return enhanced;
  }

  /**
   * Gọi trực tiếp Google Gemini API nếu người dùng cấu hình GEMINI_API_KEY
   */
  async callGeminiAPI(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
    
    const systemInstruction = `Bạn là một đạo diễn phim chuyên nghiệp. Hãy nhận 1 prompt và phân tách thành đúng 2 phân cảnh video 10 giây (Scene 1: 0-10s và Scene 2: 10-20s) sao cho 2 phân cảnh liền mạch như một thước phim điện ảnh 20 giây hoàn chỉnh. Trả về đúng định dạng JSON:
    {
      "scene1": "mô tả chi tiết phân cảnh 1 từ 0-10s...",
      "scene2": "mô tả chi tiết phân cảnh 2 từ 10-20s nối tiếp..."
    }`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\nPrompt người dùng: "${prompt}"` }] }
        ],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Không nhận được phản hồi từ Gemini API');

    const parsed = JSON.parse(text);
    return {
      masterPrompt: prompt,
      mode: '2x10s',
      totalDuration: 20,
      scenes: [
        {
          sceneIndex: 1,
          timeRange: '0-10s',
          duration: 10,
          title: 'Mở đầu & Diễn tiến',
          prompt: parsed.scene1 || prompt,
        },
        {
          sceneIndex: 2,
          timeRange: '10-20s',
          duration: 10,
          title: 'Cao trào & Kết thúc',
          prompt: parsed.scene2 || prompt,
        },
      ],
    };
  }
}

module.exports = new AIStoryboardService();
