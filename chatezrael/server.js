const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

app.post('/chat', async (req, res) => {
  const messages = req.body.messages;

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4o",
      messages,
    });
    res.json({ reply: completion.data.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao chamar OpenAI.");
  }
});

app.use(express.static('public'));

app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
