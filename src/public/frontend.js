const chatContainer = document.getElementById('chat-container');
const input = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const statusBar = document.getElementById('status-bar');

// Gerenciamento de sessão
let sessionId = localStorage.getItem('sessionId') || 'sess-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('sessionId', sessionId);

let conversationHistory = JSON.parse(localStorage.getItem(sessionId)) || [];
let chatHistories = JSON.parse(localStorage.getItem('chatHistories')) || {};
let currentChatId = sessionId;


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
  document.querySelector('.app-layout').style.display = 'none';
  setupAuthEventListeners();
}

function showChatScreen() {
  document.getElementById('login-container').style.display = 'none';
  document.querySelector('.app-layout').style.display = 'flex';
  
  // Update user profile in sidebar
  updateUserProfile();
  
  // Load chat history
  loadChatHistories();
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
  // Save current conversation before logout
  saveChatHistory();
  
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

  // Add logout button functionality
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  // Add sidebar functionality
  setupSidebarEventListeners();
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
  
  // Auto-save to chat histories
  saveChatHistory();

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
    
    // Auto-save updated conversation
    saveChatHistory();

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

// Sidebar functionality
function setupSidebarEventListeners() {
  // New chat button
  const newChatBtn = document.getElementById('new-chat-btn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', createNewChat);
  }

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }
}

function updateUserProfile() {
  const loggedInUser = localStorage.getItem('loggedInUser');
  if (loggedInUser) {
    const userNameElement = document.getElementById('user-name');
    const userAvatarElement = document.getElementById('user-avatar');
    
    if (userNameElement) {
      userNameElement.textContent = loggedInUser;
    }
    
    if (userAvatarElement) {
      userAvatarElement.textContent = loggedInUser.charAt(0).toUpperCase();
    }
  }
}

function createNewChat() {
  // Save current conversation
  saveChatHistory();
  
  // Create new session
  sessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  currentChatId = sessionId;
  localStorage.setItem('sessionId', sessionId);
  
  // Clear current conversation
  conversationHistory = [];
  
  // Clear chat container
  chatContainer.innerHTML = '<div class="message bot">Olá! Eu sou o Ezrael Noetiko, seu assistente IA místico. Como posso ajudar você hoje?</div>';
  
  // Refresh chat history sidebar
  loadChatHistories();
  
  showStatus('Nova conversa iniciada', 'success');
  setTimeout(hideStatus, 2000);
}

function saveChatHistory() {
  if (conversationHistory.length > 0) {
    const firstUserMessage = conversationHistory.find(msg => msg.role === 'user');
    const title = firstUserMessage ? firstUserMessage.content.substring(0, 50) + '...' : 'Nova conversa';
    
    chatHistories[currentChatId] = {
      id: currentChatId,
      title: title,
      messages: [...conversationHistory],
      lastMessage: conversationHistory[conversationHistory.length - 1]?.content || '',
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('pt-BR')
    };
    
    localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
    localStorage.setItem(currentChatId, JSON.stringify(conversationHistory));
  }
}

function loadChatHistories() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;
  
  chatHistories = JSON.parse(localStorage.getItem('chatHistories')) || {};
  
  // Sort by timestamp (newest first)
  const sortedHistories = Object.values(chatHistories).sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  historyList.innerHTML = '';
  
  if (sortedHistories.length === 0) {
    historyList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma conversa anterior</div>';
    return;
  }
  
  sortedHistories.forEach(chat => {
    const historyItem = document.createElement('div');
    historyItem.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
    historyItem.onclick = () => loadChat(chat.id);
    
    historyItem.innerHTML = `
      <div class="history-title">${chat.title}</div>
      <div class="history-preview">${chat.lastMessage.substring(0, 60)}...</div>
      <div class="history-date">${chat.date}</div>
    `;
    
    historyList.appendChild(historyItem);
  });
}

function loadChat(chatId) {
  // Save current conversation
  saveChatHistory();
  
  // Load selected conversation
  currentChatId = chatId;
  sessionId = chatId;
  localStorage.setItem('sessionId', chatId);
  
  const savedConversation = JSON.parse(localStorage.getItem(chatId)) || [];
  conversationHistory = savedConversation;
  
  // Render conversation
  renderHistory();
  
  // Update active state in sidebar
  loadChatHistories();
  
  showStatus('Conversa carregada', 'success');
  setTimeout(hideStatus, 2000);
}