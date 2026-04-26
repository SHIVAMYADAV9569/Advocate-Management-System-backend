const axios = require('axios');
const https = require('https');
const path = require('path');
const fs = require('fs');

// System prompt for legal assistant
const SYSTEM_PROMPT = `You are an AI Legal Assistant for an Advocate Management System. You specialize in Indian law and legal procedures.

Your capabilities:
1. Answer legal questions in both English and Hinglish
2. Explain legal concepts, procedures, and rights
3. Provide guidance on legal documentation
4. Help understand case-related queries
5. Analyze legal images (documents, certificates, etc.)

Guidelines:
- Always respond in the same language the user uses (English or Hinglish)
- Provide accurate, helpful legal information
- If unsure, acknowledge limitations and suggest consulting a lawyer
- Keep responses clear and concise
- For image analysis, describe what you see and provide relevant legal insights
- Be professional but friendly

Important: You provide legal information, not legal advice. Always recommend consulting with a qualified advocate for specific legal matters.`;

// Text-based chat
exports.chatWithAI = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation string with history
    let prompt = SYSTEM_PROMPT + '\n\n';
    
    // Add conversation history
    conversationHistory.slice(-10).forEach(msg => {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
    
    prompt += `User: ${message}\nAssistant:`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Axios request forcing IPv4 to resolve Windows Node fetch issues
    const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }]
    }, {
        httpsAgent: new https.Agent({ family: 4 }),
        headers: { 'Content-Type': 'application/json' }
    });

    const text = response.data.candidates[0].content.parts[0].text;

    res.json({
      success: true,
      response: text,
    });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      error: 'Failed to process your request',
      details: error.message 
    });
  }
};

// Image analysis with text question
exports.analyzeImage = async (req, res) => {
  try {
    const { question } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Build prompt with system instruction
    const prompt = `${SYSTEM_PROMPT}\n\nUser: ${question}\nAssistant:`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Axios request with image data
    const response = await axios.post(url, {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Image
                    }
                }
            ]
        }]
    }, {
        httpsAgent: new https.Agent({ family: 4 }),
        headers: { 'Content-Type': 'application/json' }
    });

    const text = response.data.candidates[0].content.parts[0].text;

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      response: text,
    });
  } catch (error) {
    console.error('Image Analysis Error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      error: 'Failed to analyze image',
      details: error.message 
    });
  }
};

// Voice-to-text helper (frontend will handle speech recognition)
// This endpoint processes the transcribed text
exports.voiceChat = async (req, res) => {
  try {
    const { transcribedText, conversationHistory = [] } = req.body;

    if (!transcribedText) {
      return res.status(400).json({ error: 'Transcribed text is required' });
    }

    // Build conversation string with history
    let prompt = SYSTEM_PROMPT + '\n\n';
    
    // Add conversation history
    conversationHistory.slice(-10).forEach(msg => {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
    
    prompt += `User: ${transcribedText}\nAssistant:`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Axios request forcing IPv4 to resolve Windows Node fetch issues
    const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }]
    }, {
        httpsAgent: new https.Agent({ family: 4 }),
        headers: { 'Content-Type': 'application/json' }
    });

    const text = response.data.candidates[0].content.parts[0].text;

    res.json({
      success: true,
      response: text,
    });
  } catch (error) {
    console.error('Voice Chat Error:', error);
    res.status(500).json({ 
      error: 'Failed to process voice request',
      details: error.message 
    });
  }
};
