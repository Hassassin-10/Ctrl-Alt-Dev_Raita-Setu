const express = require('express');
const router = express.Router();

// POST /api/schemes/ask → Ask Gemini AI about a scheme
router.post('/ask', async (req, res) => {
  try {
    const { schemeName, farmerProfile } = req.body;

    if (!schemeName) {
      return res.status(400).json({ error: 'schemeName is required' });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are Raitha Setu AI, a helpful assistant for Indian farmers.
    Explain the government scheme "${schemeName}" in 3 short bullet points.
    Farmer Profile: ${farmerProfile ? JSON.stringify(farmerProfile) : 'Small-scale Indian farmer'}.
    Keep language very simple and encouraging.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/\*/g, '');

    res.json({ explanation: text });
  } catch (error) {
    if (error.status === 429 || error.message.includes('429')) {
      return res.json({ explanation: `Raitha Setu AI is currently busy. Briefly: This scheme provides financial support to small farmers and encourages sustainable practices. Please try again in 5 minutes for a full guide.` });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schemes/list → Return AI-generated list of schemes
router.get('/list', async (req, res) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `Return a JSON array of 5 real Indian agricultural government schemes.
    Format: [{ "title": "Name", "desc": "One sentence benefit", "eligible": true/false }]
    Only return the JSON array, no extra text.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI response was not valid JSON');

    res.json(JSON.parse(match[0]));
  } catch (error) {
    if (error.status === 429 || error.message.includes('429')) {
       return res.json([
         { title: "PM-KISAN", desc: "Get ₹6,000 yearly in your bank account.", eligible: true },
         { title: "KCC Loan", desc: "Low interest farming loans.", eligible: true }
       ]);
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
