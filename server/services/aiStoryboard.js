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
  fallbackStoryboard(prompt) {
    const cleanPrompt = prompt.trim();

    const scene1 = `Phân cảnh 1 (0-10s): Góc quay điện ảnh mở đầu, thiết lập bối cảnh hoành tráng cho ${cleanPrompt}. Camera chuyển động tracking mượt mà từ toàn cảnh vào cận cảnh, ánh sáng ấn tượng, chi tiết chân thực sắc nét 4K 60fps.`;
    
    const scene2 = `Phân cảnh 2 (10-20s): Tiếp nối liền mạch phân cảnh 1 của ${cleanPrompt}, cao trào diễn tiến hành động mạnh mẽ, hiệu ứng ánh sáng rực rỡ và chuyển động uyển chuyển. Camera từ từ lùi ra xa (pull-back shot) tạo cảm xúc điện ảnh trọn vẹn.`;

    return {
      masterPrompt: cleanPrompt,
      mode: '2x10s',
      totalDuration: 20,
      scenes: [
        {
          sceneIndex: 1,
          timeRange: '0-10s',
          duration: 10,
          title: 'Mở đầu & Diễn tiến',
          prompt: scene1,
        },
        {
          sceneIndex: 2,
          timeRange: '10-20s',
          duration: 10,
          title: 'Cao trào & Kết thúc',
          prompt: scene2,
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
