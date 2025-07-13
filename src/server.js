const express = require('express'); const cors = require('cors'); const cookieParser = require('cookie-parser'); const OpenAI = require('openai'); const { getContext, appendUserMessage, appendAssistantMessage, resetHistory } = require('./memory'); const { updateProfileCookie } = require('../CookieManager');

const app = express();

// 🌐 CORS liberado para desenvolvimento
app.use(cors({
  origin: true, // Permite qualquer origem durante desenvolvimento
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(cookieParser()); app.use(express.json());

// 🔐 OpenAI const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, });

// ✅ Ping route (verificação do backend) app.get('/ping', (req, res) => { res.status(200).send('pong'); });

// 🔄 Reset do histórico (opcional) app.post('/reset', (req, res) => { resetHistory(); console.log('🧹 Histórico resetado.'); res.json({ status: 'Histórico resetado com sucesso.' }); });

// 🤖 Rota principal do chat
app.post('/chat', async (req, res) => {
 try { console.log('📥 Requisição recebida:', req.body);

let userInput = '';

if (req.body.content) {
  userInput = req.body.content;
} else if (Array.isArray(req.body.messages)) {
  const lastUserMsg = req.body.messages.slice().reverse().find(m => m.role === 'user');
  userInput = lastUserMsg ? lastUserMsg.content : '';
}

if (!userInput || userInput.trim().length < 2) {
  console.warn('⚠️ Mensagem inválida:', userInput);
  return res.status(400).json({ error: 'Mensagem vazia ou malformada.' });
}

// ⬇️ Atualiza cookie do usuário
updateProfileCookie(req, res, userInput);

appendUserMessage(userInput);
const context = getContext();

const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: context,
});

const reply = completion.choices[0].message.content;
appendAssistantMessage(reply);

console.log('🤖 Resposta gerada com sucesso.');
res.json({ reply });

} catch (err) { console.error('💥 Erro ao chamar OpenAI:', err?.response?.data || err.message || err); res.status(500).json({ error: 'Erro ao processar resposta.' }); } });

// 🌍 Serve frontend local (opcional no Replit) app.use(express.static('chatezrael/public'));

app.get('/', (req, res) => { res.sendFile(__dirname + '/../chatezrael/public/index.html'); });

// 🚀 Start do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`🌍 Frontend disponível em: http://0.0.0.0:${PORT}`);
  console.log('✅ Backend funcionando - teste com /ping');
});