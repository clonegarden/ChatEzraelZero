
const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');
const messages = [];

function renderMessage(text, from) {
  const div = document.createElement('div');
  div.className = `msg ${from}`;
  div.innerText = text;
  chatbox.appendChild(div);
  chatbox.scrollTop = chatbox.scrollHeight;
}

async function enviar() {
  const userText = input.value.trim();
  if (!userText) return;
  input.value = '';
  renderMessage(userText, 'user');

  messages.push({ role: 'user', content: userText });

  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const data = await res.json();
  const botText = data.reply;
  messages.push({ role: 'assistant', content: botText });
  renderMessage(botText, 'bot');
}
