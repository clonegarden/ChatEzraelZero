const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { OpenAI } = require('openai');
const memory = require('./memory');
const { updateProfileCookie, decodeCookie, COOKIE_NAME } = require('./CookieManager.js');
const { authenticate, isLoggedIn, registerUser } = require('./auth');
const path = require('path');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Storage } = require('@google-cloud/storage');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();

// Lista de domínios permitidos para CORS
const allowedOrigins = [
  "https://katoptron.institutomalleusdei.org",
  "http://katoptron.institutomalleusdei.org",
  "https://af9c2fa3-4afa-459b-a234-43ae76e5a06a-00-1h3txk2icdqf2.spock.replit.dev" // Substitua pelo seu domínio Replit real
];

//cors replit.dev
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.replit.dev')) {
      return callback(null, true);
    }
    callback(new Error(`CORS não permitido para a origem: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Configuração de CORS com verificação dinâmica
app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (ex: curl, postman) para testes locais
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS não permitido para a origem: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Limite para JSON grande, útil para áudio

// Inicializa motores IA
const aiClients = {
  openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  anthropic: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
};

// Configuração Google Cloud TTS e Storage
const ttsClient = new textToSpeech.TextToSpeechClient();
const storage = new Storage();

// Endpoint para checagem de saúde do serviço
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    planetaryHour: memory.getPlanetaryHour?.() || null,
    humorDominant: memory.getEmotionalState?.() || null,
    engines: Object.keys(aiClients),
    cookies: Object.keys(req.cookies)
  });
});

// Endpoint para resetar sessão
app.post('/reset', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
      await memory.saveSession(sessionId);
    }
    res.json({ status: 'Session reset' });
  } catch (err) {
    console.error('Erro no /reset:', err);
    res.status(500).json({ error: 'Erro ao resetar sessão' });
  }
});

// Rota principal do chat
app.post('/chat', async (req, res) => {
  if (!isLoggedIn(req)) {
    return res.status(403).json({ error: 'Acesso negado. Faça login primeiro.' });
  }
  try {
    // Obtém ou gera sessionId do cookie
    let sessionId = req.cookies.sessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      res.cookie('sessionId', sessionId, { 
        httpOnly: true, 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
        sameSite: 'none',
        secure: true
      });
      console.log(`🆕 Nova sessionId gerada: ${sessionId}`);
    }

    // Validação de entrada robusta
    const { messages, options = {} } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Corpo inválido: 'messages' é obrigatório e deve ser array não vazio." });
    }

    console.log('📥 Chat request:', {
      origin: req.headers.origin,
      sessionId,
      messages,
      options
    });


// Login endpoint
app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios' });
    }

    const user = authenticate(username, password);

    if (user) {
      res.cookie('loggedInUser', user.username, { 
        httpOnly: true, 
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        secure: false // Set to true in production with HTTPS
      });
      res.json({ success: true, message: 'Login realizado com sucesso', user });
    } else {
      res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// Registration endpoint
app.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios' });
    }

    const result = registerUser(username, password);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// Logout endpoint
app.post('/logout', (req, res) => {
  try {
    res.clearCookie('loggedInUser');
    res.clearCookie('sessionId');
    res.json({ success: true, message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

    // Extrai conteúdo da última mensagem do usuário
    const userInput = messages.slice(-1)[0]?.content || '';

    // Atualiza perfil e cookies
    const userProfile = updateProfileCookie(req, res, userInput);

    // Adiciona mensagem do usuário ao histórico da sessão
    await memory.appendMessage(sessionId, 'user', userInput);

    // Obtém contexto para IA com limite de tokens
    const context = await memory.getContext(sessionId, 6000, userProfile);

    // Escolhe motor de IA (openai por padrão)
    const engine = options.engine || 'openai';
    let aiResponse;

    // Gera resposta IA conforme motor
    switch (engine) {
      case 'openai':
        aiResponse = await generateOpenAIResponse(context);
        break;
      case 'anthropic':
        aiResponse = await generateAnthropicResponse(context);
        break;
      default:
        return res.status(400).json({ error: `Engine '${engine}' não suportada.` });
    }

    // Armazena resposta da IA no histórico
    await memory.appendMessage(sessionId, 'assistant', aiResponse);

    // Recupera configurações de voz da sessão
    const session = await memory.getSession(sessionId);
    const voiceSettings = session?.voice || 'google-default';

    // Gera áudio se solicitado
    let audioUrl = null;
    if (options.generateAudio) {
      audioUrl = await generateSpeech(aiResponse, voiceSettings);
    }

    // Resposta ao frontend
    res.json({ 
      reply: aiResponse,
      voiceSettings,
      audioUrl,
      sessionId
    });

  } catch (error) {
    console.error('💥 Erro no endpoint /chat:', error.message, error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Função para gerar resposta OpenAI
async function generateOpenAIResponse(messages) {
  const response = await aiClients.openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 1500
  });
  return response.choices[0].message.content;
}

// Função para gerar resposta Anthropic
async function generateAnthropicResponse(messages) {
  const anthropicMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));

  const response = await aiClients.anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 2000,
    messages: anthropicMessages,
    system: messages.find(m => m.role === 'system')?.content || ''
  });

  return response.content[0].text;
}

// Função para gerar áudio via Google TTS e upload no Storage
async function generateSpeech(text, voiceSettings) {
  try {
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'pt-BR',
        name: voiceSettings.includes('google') ? 
          voiceSettings.replace('google-', '') : 
          'pt-BR-Wavenet-A'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0
      }
    });

    const fileName = `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.mp3`;

    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    const file = bucket.file(fileName);

    await file.save(response.audioContent, {
      metadata: { contentType: 'audio/mpeg' }
    });

    await file.makePublic();

    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error) {
    console.error('Erro na geração de áudio:', error);
    return null;
  }
}

// Servir frontend estático (React, SPA ou HTML simples)
app.use(express.static(path.join(__dirname, 'public')));

// Redirecionar todas as rotas desconhecidas para index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializa servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
});
