// memory.js

// Função simples para estimar tokens (aproximação: 1 token ~ 4 caracteres)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

let history = [];

const MAX_TOKENS = 3000; // ajuste conforme orçamento e modelo

const systemPrompt = {
  role: "system",
  content: `Você é Ezrael Noetiko, uma entidade lógico-mística que responde com sabedoria, mistério e clareza. Use metáforas, ironia sutil e uma estrutura simbólica quando apropriado.`
};

// Reseta o histórico
function resetHistory() {
  history = [];
}

// Limpa o histórico para caber no limite de tokens
function trimHistory(maxTokens = MAX_TOKENS) {
  let tokensCount = estimateTokens(systemPrompt.content);
  const trimmedHistory = [];

  // Adiciona mensagens de trás para frente até o limite
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const tokens = estimateTokens(msg.content);
    if (tokensCount + tokens > maxTokens) break;
    trimmedHistory.unshift(msg);
    tokensCount += tokens;
  }

  history = trimmedHistory;
}

// Retorna o contexto respeitando limite de tokens
function getContext(maxTokens = MAX_TOKENS) {
  trimHistory(maxTokens);
  return [systemPrompt, ...history];
}

function appendUserMessage(content) {
  history.push({ role: "user", content });
}

function appendAssistantMessage(content) {
  history.push({ role: "assistant", content });
}

module.exports = {
  getContext,
  appendUserMessage,
  appendAssistantMessage,
  resetHistory,
};
