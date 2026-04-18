// const OpenAI = require('openai');
// const ChatHistory = require('../models/ChatHistory');

// // Initialize OpenAI client
// // Make sure to add OPENAI_API_KEY in your .env file
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// /**
//  * POST /api/ai/ask
//  * Main endpoint to ask legal questions to AI
//  */
// exports.askLegalQuestion = async (req, res) => {
//   try {
//     console.log('🤖 AI Question received:', req.body);
//     console.log('👤 User:', req.user ? req.user._id : 'No user found');
//     console.log('🔑 Headers:', req.headers.authorization ? 'Token present' : 'No token');
    
//    const { message, language = 'english', sessionId } = req.body;

// if (!message || message.trim() === '') {
//   return res.status(400).json({
//     success: false,
//     message: 'Message is required'
//   });
// }

// const question = message;

//     // TEMPORARY: If req.user is undefined, use a fallback
//     // This is for testing - remove in production
//     if (!req.user || !req.user._id) {
//       console.log('⚠️ No authenticated user found');
//       return res.status(401).json({
//         success: false,
//         message: 'Authentication required. Please login again.'
//       });
//     }
    
//     const userId = req.user._id;
//     console.log('🆔 Using userId:', userId);

//     // Check if OpenAI API key is configured
//     if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
//       console.log('⚠️ OpenAI API key not configured - using mock response');
      
//       // Return a mock response for testing
//       const mockResponse = language === 'hindi'
//         ? `यह एक डेमो उत्तर है। OpenAI API कुंजी कॉन्फ़िगर नहीं की गई है।\n\n` +
//           `आपके प्रश्न का उत्तर: "${question}"\n\n` +
//           `कृपया backend/.env फ़ाइल में अपनी OpenAI API कुंजी जोड़ें।\n\n` +
//           `⚠️ यह पेशेवर कानूनी सलाह नहीं है।`
//         : `This is a demo response. OpenAI API key is not configured.\n\n` +
//           `Your question was: "${question}"\n\n` +
//           `To enable real AI responses:\n` +
//           `1. Get an API key from: https://platform.openai.com/api-keys\n` +
//           `2. Add it to backend/.env file:\n` +
//           `   OPENAI_API_KEY=sk-your-actual-key-here\n\n` +
//           `⚠️ This is NOT professional legal advice. Always consult a qualified advocate.`;
      
//       // Save mock response to chat history
//       let chatSession;
//       try {
//         if (sessionId) {
//           chatSession = await ChatHistory.findOneAndUpdate(
//             { _id: sessionId, userId: userId },
//             {
//               $push: {
//                 messages: [
//                   { role: 'user', content: question },
//                   { role: 'assistant', content: mockResponse }
//                 ]
//               },
//               updatedAt: Date.now()
//             },
//             { new: true }
//           );
//         } else {
//           chatSession = await ChatHistory.create({
//             userId: userId,
//             sessionName: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
//             messages: [
//               { role: 'user', content: question },
//               { role: 'assistant', content: mockResponse }
//             ]
//           });
//         }
//       } catch (dbError) {
//         console.log('⚠️ Could not save chat history:', dbError.message);
//       }

//       return res.json({
//         success: true,
//         data: {
//           response: "Server working ✅",
//           sessionId: "test123"
//         }
//       });
//     }

//     // System prompt for Indian Legal Assistant
//     const systemPrompt = language === 'hindi' 
//       ? `आप एक भारतीय कानूनी सहायक हैं। आपको भारतीय कानून की जानकारी है। 
//          सरल हिंदी में उत्तर दें। 
//          हमेशा यह बताएं कि यह पेशेवर कानूनी सलाह नहीं है।
//          उदाहरण दें और समझाने का प्रयास करें।`
//       : `You are an Indian Legal AI Assistant. You have knowledge of Indian laws including:
//          - Indian Penal Code (IPC)
//          - Constitution of India
//          - Criminal Procedure Code (CrPC)
//          - Civil Procedure Code (CPC)
//          - Family Law
//          - Property Law
//          - Labor Law
//          - Tax Law
//          - Corporate Law
         
//          Guidelines:
//          - Give simple, easy-to-understand answers in ${language}
//          - Provide relevant legal sections when applicable
//          - Give practical examples
//          - Always include disclaimer: "This is NOT professional legal advice. Consult a qualified advocate for specific cases."
//          - If unsure, suggest consulting a lawyer
//          - Keep responses concise but informative
//          - Be helpful and professional`;

//     // Build messages array with conversation history
//     let messages = [
//       {
//         role: 'system',
//         content: systemPrompt
//       }
//     ];

//     // If sessionId provided, load conversation history
//     if (sessionId) {
//       const chatSession = await ChatHistory.findOne({
//         _id: sessionId,
//         userId: userId
//       }).sort({ createdAt: -1 });

//       if (chatSession) {
//         // Add last 10 messages for context
//         const recentMessages = chatSession.messages.slice(-10);
//         messages = messages.concat(recentMessages.map(msg => ({
//           role: msg.role,
//           content: msg.content
//         })));
//       }
//     }

//     // Add user's question
//     messages.push({
//       role: 'user',
//       content: question
//     });

//     console.log('🤖 Sending request to OpenAI...');

//     // Call OpenAI API
//     let aiResponse;
//     try {
//       const response = await openai.chat.completions.create({
//         model: 'gpt-3.5-turbo', // You can use 'gpt-4' for better responses
//         messages: messages,
//         max_tokens: 1000,
//         temperature: 0.7, // Creative but accurate
//         presence_penalty: 0.5,
//         frequency_penalty: 0.5
//       });

//       aiResponse = response.choices[0].message.content;
//       console.log('✅ AI response received');
//     } catch (openaiError) {
//       console.error('❌ OpenAI API Error:', openaiError.message);
//       throw new Error(`OpenAI API failed: ${openaiError.message}`);
//     }

//     // Save to chat history (non-blocking - don't fail if this fails)
//     let chatSession;
//     try {
//       if (sessionId) {
//         // Update existing session
//         chatSession = await ChatHistory.findOneAndUpdate(
//           { _id: sessionId, userId: userId },
//           {
//             $push: {
//               messages: [
//                 { role: 'user', content: question },
//                 { role: 'assistant', content: aiResponse }
//               ]
//             },
//             updatedAt: Date.now()
//           },
//           { new: true }
//         );
//       } else {
//         // Create new session
//         chatSession = await ChatHistory.create({
//           userId: userId,
//           sessionName: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
//           messages: [
//             { role: 'user', content: question },
//             { role: 'assistant', content: aiResponse }
//           ]
//         });
//       }
//       console.log('💾 Chat history saved successfully');
//     } catch (dbError) {
//       console.error('⚠️ Could not save chat history:', dbError.message);
//       // Don't fail the request if chat history save fails
//       chatSession = null;
//     }

//     res.status(200).json({
//       success: true,
//       data: {
//         response: aiResponse,
//         sessionId: chatSession._id,
//         timestamp: new Date()
//       }
//     });

//   } catch (error) {
//     console.error('❌ Error in AI Legal Assistant:', error);
//     console.error('❌ Error stack:', error.stack);
    
//     // Handle specific OpenAI errors
//     if (error.status) {
//       console.error('❌ OpenAI API Error:', error.message);
//       return res.status(500).json({
//         success: false,
//         message: 'AI service temporarily unavailable. Please try again later.',
//         error: error.message
//       });
//     }

//     // Handle database errors
//     if (error.name === 'ValidationError' || error.name === 'CastError') {
//       console.error('❌ Database validation error:', error.message);
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid data provided',
//         error: error.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Failed to get AI response',
//       error: error.message
//     });
//   }
// };

// /**
//  * GET /api/ai/history
//  * Get chat history for current user
//  */
// exports.getChatHistory = async (req, res) => {
//   try {
//     const { page = 1, limit = 20 } = req.query;
//     const skip = (page - 1) * limit;

//     const chatSessions = await ChatHistory.find({
//       userId: req.user._id
//     })
//     .sort({ updatedAt: -1 })
//     .skip(skip)
//     .limit(parseInt(limit))
//     .select('sessionName createdAt updatedAt messages');

//     const total = await ChatHistory.countDocuments({
//       userId: req.user._id
//     });

//     res.status(200).json({
//       success: true,
//       data: {
//         sessions: chatSessions,
//         pagination: {
//           current: parseInt(page),
//           total: Math.ceil(total / limit),
//           count: total
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Error fetching chat history:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch chat history'
//     });
//   }
// };

// /**
//  * GET /api/ai/history/:sessionId
//  * Get specific chat session messages
//  */
// exports.getSessionMessages = async (req, res) => {
//   try {
//     const { sessionId } = req.params;

//     const chatSession = await ChatHistory.findOne({
//       _id: sessionId,
//       userId: req.user._id
//     });

//     if (!chatSession) {
//       return res.status(404).json({
//         success: false,
//         message: 'Chat session not found'
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: chatSession
//     });

//   } catch (error) {
//     console.error('Error fetching session messages:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch session messages'
//     });
//   }
// };

// /**
//  * DELETE /api/ai/history/:sessionId
//  * Delete a chat session
//  */
// exports.deleteChatSession = async (req, res) => {
//   try {
//     const { sessionId } = req.params;

//     const deleted = await ChatHistory.findOneAndDelete({
//       _id: sessionId,
//       userId: req.user._id
//     });

//     if (!deleted) {
//       return res.status(404).json({
//         success: false,
//         message: 'Chat session not found'
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Chat session deleted successfully'
//     });

//   } catch (error) {
//     console.error('Error deleting chat session:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to delete chat session'
//     });
//   }
// };












const { GoogleGenAI } = require("@google/genai");
const ChatHistory = require('../models/ChatHistory');

// Initialize Gemini
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/ai/ask
 * Main endpoint to ask legal questions to AI
 */
exports.askLegalQuestion = async (req, res) => {
  try {
    console.log('🤖 AI Question received:', req.body);

    console.log("🔑 KEY:", process.env.GEMINI_API_KEY);

    const { message, language = 'english', sessionId } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login again.'
      });
    }

    const userId = req.user._id;

    // Check Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key not configured'
      });
    }

    const question = message;

    // System Prompt
    const systemPrompt = language === 'hindi'
      ? `आप एक भारतीय कानूनी सहायक हैं। सरल हिंदी में उत्तर दें और हमेशा यह बताएं कि यह पेशेवर कानूनी सलाह नहीं है।`
      : `You are an Indian Legal AI Assistant.
         Answer in simple language.
         Mention IPC sections when relevant.
         Always add: "This is NOT professional legal advice."`;

    // Build conversation
    let messages = [];

    if (sessionId) {
      const chatSession = await ChatHistory.findOne({
        _id: sessionId,
        userId: userId
      });

      if (chatSession) {
        messages = chatSession.messages.slice(-10);
      }
    }

    messages.push({
      role: 'user',
      content: question
    });

    // Convert to Gemini prompt
    const finalPrompt = `
${systemPrompt}

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join("\n")}

Answer:
`;

    // Call Gemini API
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: finalPrompt
    });

    const aiResponse = response.text;

    // Save chat
    let chatSession;
    if (sessionId) {
      chatSession = await ChatHistory.findOneAndUpdate(
        { _id: sessionId, userId: userId },
        {
          $push: {
            messages: [
              { role: 'user', content: question },
              { role: 'assistant', content: aiResponse }
            ]
          },
          updatedAt: Date.now()
        },
        { new: true }
      );
    } else {
      chatSession = await ChatHistory.create({
        userId: userId,
        sessionName: question.substring(0, 50),
        messages: [
          { role: 'user', content: question },
          { role: 'assistant', content: aiResponse }
        ]
      });
    }

    res.status(200).json({
      success: true,
      data: {
        response: aiResponse,
        sessionId: chatSession._id
      }
    });

  } catch (error) {
    console.error('❌ Gemini Error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get AI response',
      error: error.message
    });
  }
};

/**
 * GET /api/ai/history
 */
exports.getChatHistory = async (req, res) => {
  try {
    const chatSessions = await ChatHistory.find({
      userId: req.user._id
    }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: chatSessions
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat history'
    });
  }
};

/**
 * GET /api/ai/history/:sessionId
 */
exports.getSessionMessages = async (req, res) => {
  try {
    const chatSession = await ChatHistory.findOne({
      _id: req.params.sessionId,
      userId: req.user._id
    });

    if (!chatSession) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      data: chatSession
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

/**
 * DELETE /api/ai/history/:sessionId
 */
exports.deleteChatSession = async (req, res) => {
  try {
    await ChatHistory.findOneAndDelete({
      _id: req.params.sessionId,
      userId: req.user._id
    });

    res.json({
      success: true,
      message: 'Chat deleted'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Delete failed'
    });
  }
};

