
const chatContainer = document.getElementById('chat-container');
const input = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const statusBar = document.getElementById('status-bar');

let conversationHistory = []; // Aqui guardamos o histórico da sessão no frontend

// URL do backend local
const backendURL = 'http://localhost:3000';

function showStatus(message, type = 'info') {
  statusBar.textContent = message;
  statusBar.className = 'visible ' + type;
  statusBar.style.display = 'block';
}

function hideStatus() {
  statusBar.className = '';
  statusBar.style.display = 'none';
}

function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + sender;
  msgDiv.textContent = text;
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function checkBackendStatus() {
  showStatus('Ezrael Noetiko: verificando backend...', 'info');
  try {
    const response = await fetch(backendURL, { method: 'HEAD' });
    if (!response.ok) throw new Error('Backend não respondeu.');

    showStatus('Backend online.', 'info');
    setTimeout(hideStatus, 2000);
    return true;
  } catch (e) {
    showStatus('⚠️ Backend offline ou inacessível. Verifique se o servidor está rodando.', 'error');
    return false;
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  input.value = '';
  showStatus('Enviando mensagem...', 'info');

  // Adiciona a mensagem do usuário ao histórico local
  conversationHistory.push({ role: 'user', content: text });

  try {
    const response = await fetch(backendURL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });

    if (!response.ok) throw new Error('Resposta inválida do backend.');

    const data = await response.json();

    // Adiciona a resposta ao histórico local
    conversationHistory.push({ role: 'assistant', content: data.reply });

    appendMessage(data.reply, 'bot');
    hideStatus();
  } catch (error) {
    showStatus('Erro ao enviar mensagem: ' + error.message, 'error');
  }
}

sendButton.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

window.addEventListener('load', async () => {
  await checkBackendStatus();
});
