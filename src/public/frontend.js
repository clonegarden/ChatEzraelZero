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
  setupAuthEventListeners();
}

function showChatScreen() {
  document.getElementById('login-container').style.display = 'none';
  document.querySelector('.container').style.display = 'block';
  renderHistory();
  checkBackendStatus();
}

function setupAuthEventListeners() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');

  // Switch between login and register forms
  switchToRegister.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    clearErrors();
  });

  switchToLogin.addEventListener('click', () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    clearErrors();
  });

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    await handleLogin(username, password);
  });

  // Handle register form submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    if (password !== confirmPassword) {
      showError('register-error', 'As senhas não coincidem');
      return;
    }
    
    await handleRegister(username, password);
  });
}

async function handleLogin(username, password) {
  try {
    const response = await fetch(backendURL + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      localStorage.setItem('loggedInUser', username);
      showChatScreen();
      clearErrors();
    } else {
      showError('auth-error', data.message || 'Erro ao fazer login');
    }
  } catch (error) {
    showError('auth-error', 'Erro de conexão com o servidor');
    console.error('Login error:', error);
  }
}

async function handleRegister(username, password) {
  try {
    const response = await fetch(backendURL + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Auto-login after successful registration
      await handleLogin(username, password);
    } else {
      showError('register-error', data.message || 'Erro ao criar conta');
    }
  } catch (error) {
    showError('register-error', 'Erro de conexão com o servidor');
    console.error('Register error:', error);
  }
}

function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

function clearErrors() {
  const errorElements = document.querySelectorAll('.error-message');
  errorElements.forEach(element => {
    element.style.display = 'none';
    element.textContent = '';
  });
}

function logout() {
  localStorage.removeItem('loggedInUser');
  localStorage.removeItem('sessionId');
  // Clear conversation history
  conversationHistory = [];
  showLoginScreen();
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