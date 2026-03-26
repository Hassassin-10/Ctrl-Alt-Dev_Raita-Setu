import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const getSystemPrompt = (lang: string) => {
  if (lang === 'Kannada') {
    return `ನೀವು ರೈತ ಸೇತು AI ಕೃಷಿ ಸಹಾಯಕ. ನೀವು ಭಾರತೀಯ ರೈತರಿಗೆ ಕನ್ನಡದಲ್ಲಿ ಸಹಾಯ ಮಾಡುತ್ತೀರಿ. ಯಾವಾಗಲೂ ಕನ್ನಡದಲ್ಲಿ ಮಾತ್ರ ಉತ್ತರ ನೀಡಿ. ಸರಳ, ಪ್ರಾಯೋಗಿಕ ಸಲಹೆ ನೀಡಿ. ಗರಿಷ್ಠ 2-3 ವಾಕ್ಯಗಳಲ್ಲಿ ಉತ್ತರಿಸಿ.`;
  } else if (lang === 'Hindi') {
    return `आप किसान सेतु AI कृषि सहायक हैं। आप भारतीय किसानों की हिंदी में सहायता करते हैं। हमेशा हिंदी में ही उत्तर दें। सरल, व्यावहारिक सलाह दें। अधिकतम 2-3 वाक्यों में उत्तर दें।`;
  }
  return `You are Raitha Setu AI Farm Assistant. You help Indian farmers in English. Always reply in English only. Give simple, practical advice. Answer in max 2-3 sentences.`;
};

const MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

// Text-based farm advice in selected language
export const getFarmAdvice = async (userPrompt: string, userContext?: any) => {
  const lang = userContext?.language || 'English';
  const sysPrompt = getSystemPrompt(lang);

  if (!API_KEY) return "API key missing.";

  const contextInfo = `Role: ${userContext?.role || 'Farmer'}, City: ${userContext?.city || 'Karnataka'}`;

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `${sysPrompt}\n${contextInfo}\n\nClient Query: ${userPrompt}`;
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      console.warn(`[Gemini] ${modelName} failed:`, error.message);
      if (error.message.includes("429") || error.message.includes("404") || error.message.includes("quota")) continue;
      return "Service currently unavailable.";
    }
  }
  return "Service limit reached.";
};

// Audio-based farm advice
export const getFarmAdviceFromAudio = async (audioBase64: string, userContext?: any) => {
  const lang = userContext?.language || 'English';
  const sysPrompt = getSystemPrompt(lang);
  if (!API_KEY) return "API key missing.";

  for (const modelName of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `${sysPrompt}\nReply to the voice prompt in ${lang}:`;
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: "audio/m4a", data: audioBase64 } }
      ]);
      return result.response.text();
    } catch (error: any) {
      console.warn(`[Gemini Audio] ${modelName} failed:`, error.message);
      if (error.message.includes("429") || error.message.includes("404") || error.message.includes("quota")) continue;
      return "Mic input failed.";
    }
  }
  return "Audio service unavailable.";
};

// Vision-based farm advice
export const getFarmAdviceFromImage = async (base64Image: string, userPrompt?: string, userContext?: any) => {
  const lang = userContext?.language || 'English';
  const sysPrompt = getSystemPrompt(lang);
  if (!API_KEY) return "API key missing.";

  for (const modelName of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `
        ${sysPrompt}
        Look at this image and identify in ${lang}:
        1. Plant/leaf type and its current condition?
        2. Any visible pest or disease issues?
        3. Recommended fertilizer/pesticide?
        User question: ${userPrompt || 'What should I do?'}
      `.trim();

      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
      ]);
      return result.response.text();
    } catch (error: any) {
      console.warn(`[Gemini Vision] ${modelName} failed:`, error.message);
      if (error.message.includes("429") || error.message.includes("404") || error.message.includes("quota")) continue;
      return "Vision fails.";
    }
  }
  return "AI vision unavailable.";
};
