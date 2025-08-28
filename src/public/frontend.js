const chatContainer = document.getElementById('chat-container');
const input = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const statusBar = document.getElementById('status-bar');

// Gerenciamento de sessão
let sessionId = localStorage.getItem('sessionId') || 'sess-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('sessionId', sessionId);

let conversationHistory = JSON.parse(localStorage.getItem(sessionId)) || [];


// Simples animação JavaScript para efeito visual
function createMysticalEffect() {
  const container = document.querySelector('.container');

  setInterval(() => {
    const glow = document.createElement('div');
    glow.className = 'glow-effect';
    glow.style.left = `${Math.random() * 100}%`;
    container.appendChild(glow);

    setTimeout(() => container.removeChild(glow), 3000);
  }, 2000);
}

// Add animation effect on load
document.addEventListener('DOMContentLoaded', createMysticalEffect);

// URL do backend - mesma origem
const backendURL = window.location.origin;

function showLoginScreen() {
  document.getElementById('login-container').style.display = 'flex';
  document.querySelector('.container').style.display = 'none';
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function showChatScreen() {
  document.getElementById('login-container').style.display = 'none';
  document.querySelector('.container').style.display = 'block';
  renderHistory();
  checkBackendStatus();
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  const loggedInUser = localStorage.getItem('loggedInUser');
  if (!loggedInUser) {
    showLoginScreen();
  } else {
    showChatScreen();
  }

  sendButton.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});

function renderHistory() {
  chatContainer.innerHTML = '';
  conversationHistory.forEach(msg => {
    if (msg.role === 'user') appendMessage(msg.content, 'user');
    else if (msg.role === 'assistant') appendMessage(msg.content, 'bot');
  });
}

function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;

  // Suporte básico a formatação
  if (sender === 'bot') {
    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    msgDiv.innerHTML = formattedText;
  } else {
    msgDiv.textContent = text;
  }

  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  input.value = '';

  // Atualizar histórico local
  conversationHistory.push({ role: 'user', content: text });
  localStorage.setItem(sessionId, JSON.stringify(conversationHistory));

  showTypingIndicator();
  showStatus('Processando sua mensagem...', 'info');

  try {
    const response = await fetch(backendURL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        messages: conversationHistory,
        options: {
          personality: 'assistant',
          engine: 'openai'
        }
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro no servidor');
    }

    const data = await response.json();

    // Atualizar histórico com resposta
    conversationHistory.push({ 
      role: 'assistant', 
      content: data.reply
    });

    localStorage.setItem(sessionId, JSON.stringify(conversationHistory));

    hideTypingIndicator();
    appendMessage(data.reply, 'bot');

    // Feedback visual de sucesso
    showStatus('✓ Resposta recebida', 'success');
    setTimeout(hideStatus, 2000);

  } catch (error) {
    hideTypingIndicator();
    handleError(error);
  }
}

// Funções auxiliares
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.id = 'typing-indicator';
  typingDiv.className = 'message bot typing';
  typingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function showStatus(message, type = 'info') {
  statusBar.textContent = message;
  statusBar.className = `status-bar visible ${type}`;
}

function hideStatus() {
  statusBar.className = '';
}

function handleError(error) {
  console.error('Erro:', error);

  let errorMessage = error.message;

  if (error.name === 'AbortError') {
    errorMessage = 'Tempo de resposta excedido. Servidor ocupado?';
  } else if (error.message.includes('Failed to fetch')) {
    errorMessage = 'Falha na conexão com o servidor';
  }

  showStatus(`⚠️ ${errorMessage}`, 'error');

  // Tentar reconexão automática para erros de rede
  if (error.message.includes('Failed to fetch')) {
    setTimeout(checkBackendStatus, 5000);
  }
}

// Verificação de status do backend
async function checkBackendStatus() {
  showStatus('Verificando conexão com o servidor...', 'info');

  try {
    const response = await fetch(backendURL + '/health', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) throw new Error('Servidor offline');

    const data = await response.json();
    showStatus(`✔️ Conectado | Status: ${data.status}`, 'success');
    setTimeout(hideStatus, 3000);

  } catch (error) {
    showStatus('⚠️ Servidor offline. Tentando reconectar...', 'error');
    setTimeout(checkBackendStatus, 5000);
  }
}