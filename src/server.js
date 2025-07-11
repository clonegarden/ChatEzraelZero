const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { getContext, appendUserMessage, appendAssistantMessage } = require('./memory');

const app = express();

app.use(cors({
  origin: ['https://katoptron.institutomalleusdei.org'], // ajuste conforme seu domínio real
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/chat', async (req, res) => {
  try {
    const userInput = req.body.content;

    appendUserMessage(userInput);              // ✅ Salva mensagem no histórico do backend
    const context = getContext();              // ✅ Recupera o histórico + system prompt

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: context,
    });

    const reply = completion.choices[0].message.content;

    appendAssistantMessage(reply);             // ✅ Salva a resposta também no histórico
    res.json({ reply });

  } catch (err) {
    console.error("Erro ao chamar OpenAI:", err?.response?.data || err.message || err);
    res.status(500).send("Erro ao chamar OpenAI.");
  }
});

app.use(express.static('chatezrael/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../chatezrael/public/index.html');
});

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
