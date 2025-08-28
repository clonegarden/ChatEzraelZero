// UserRecognition.js
const crypto = require('crypto');

class UserRecognition {
  constructor() {
    this.IP_PREFIX_LENGTH = 7; // Para comparar /24 (IPv4)
  }

  /**
   * Gera uma fingerprint do navegador
   * @param {Object} req - Objeto de requisição do Express
   * @returns {string} Fingerprint SHA-256
   */
  generateBrowserFingerprint(req) {
    const headers = req.headers;
    const components = [
      headers['user-agent'],
      headers['accept-language'],
      headers['sec-ch-ua-platform'],
      headers['sec-ch-ua'],
    ].filter(Boolean).join('|');

    return crypto.createHash('sha256').update(components).digest('hex');
  }

  /**
   * Identifica usuários recorrentes
   * @param {Object} existingProfile - Perfil existente do cookie
   * @param {Object} req - Objeto de requisição do Express
   * @param {string} userInput - Entrada do usuário (opcional)
   * @returns {Object} Perfil atualizado ou null
   */
  identifyRecurrentUser(existingProfile, req, userInput = '') {
    if (!existingProfile) return null;

    const currentIP = req.ip;
    const currentFingerprint = this.generateBrowserFingerprint(req);

    // 1. Correspondência exata de fingerprint
    if (existingProfile.fingerprints?.includes(currentFingerprint)) {
      return existingProfile;
    }

    // 2. Correspondência de prefixo IP (/24 para IPv4)
    const isSimilarIP = existingProfile.ips?.some(ip => 
      ip.substring(0, this.IP_PREFIX_LENGTH) === currentIP.substring(0, this.IP_PREFIX_LENGTH)
    );

    if (isSimilarIP) {
      return existingProfile;
    }

    // 3. Correspondência de padrão modal (se houver input)
    if (userInput) {
      const currentModal = this.extractModalLogic(userInput);
      if (existingProfile.modal_trace?.includes(currentModal)) {
        return existingProfile;
      }
    }

    return null;
  }

  /**
   * Atualiza informações de recorrência no perfil
   * @param {Object} profile - Perfil existente
   * @param {Object} req - Objeto de requisição do Express
   * @param {boolean} isNew - Se é um novo usuário
   * @returns {Object} Perfil atualizado
   */
  updateRecurrenceProfile(profile, req, isNew = false) {
    const updatedProfile = {...profile};

    // Atualizar contador de visitas
    updatedProfile.visitCount = (profile.visitCount || 0) + 1;
    updatedProfile.lastSeen = new Date().toISOString();

    // Adicionar fingerprint atual
    const fingerprint = this.generateBrowserFingerprint(req);
    updatedProfile.fingerprints = [
      ...new Set([...(profile.fingerprints || []), fingerprint])
    ].slice(0, 5); // Manter apenas 5 fingerprints

    // Adicionar IP atual
    updatedProfile.ips = [
      ...new Set([req.ip, ...(profile.ips || [])])
    ].slice(0, 10); // Manter últimos 10 IPs

    // Registrar primeira visita se for novo
    if (isNew) {
      updatedProfile.firstSeen = new Date().toISOString();
    }

    return updatedProfile;
  }

  /**
   * Extrai lógica modal do texto (mesma função do CookieManager)
   * @param {string} message - Texto de entrada
   * @returns {string} Símbolo combinado
   */
  extractModalLogic(message) {
    const seeds = ['□', '◇', '⊕', '¬', '→', '↯', '☯', '⚖', '✂', '∴'];
    const keywords = message.toLowerCase().match(/\b\w+\b/g) || [];
    const hash = crypto.createHash('md5').update(message).digest('hex');
    const index = parseInt(hash.slice(0, 2), 16);
    const symbol = seeds[index % seeds.length];
    const keyword = keywords[index % keywords.length] || 'x';
    return `${symbol}${keyword.charAt(0).toUpperCase()}`;
  }

  /**
   * Calcula confiança na identificação
   * @param {Object} profile - Perfil do usuário
   * @returns {number} Pontuação de confiança (0-100)
   */
  calculateConfidence(profile) {
    let confidence = 0;

    // Fatores de confiança:
    if (profile.fingerprints?.length > 1) confidence += 30;
    if (profile.ips?.length > 2) confidence += 20;
    if (profile.visitCount > 3) confidence += 25;
    if (profile.nome) confidence += 15;
    if (profile.temperamento) confidence += 10;

    return Math.min(confidence, 100);
  }
}

// Exportar como singleton
module.exports = new UserRecognition();