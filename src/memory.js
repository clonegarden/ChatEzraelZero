// src/memory.js
let conversationHistory = [];

function getContext() {
  return conversationHistory;
}

function appendUserMessage(message) {
  conversationHistory.push({ role: 'user', content: message });
}

function appendAssistantMessage(message) {
  conversationHistory.push({ role: 'assistant', content: message });
}

function resetHistory() {
  conversationHistory = [];
}

module.exports = {
  getContext,
  appendUserMessage,
  appendAssistantMessage,
  resetHistory
};