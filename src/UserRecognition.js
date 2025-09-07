// UserRecognition.js
const crypto = require('crypto');
const Database = require('@replit/database');
const db = new Database();
const config = require('./recognitionConfig');

class UserRecognition {
  constructor() {
    this.IP_PREFIX_LENGTH = config.IP_MATCH_PREFIX || 7; // Para comparar /24 (IPv4)
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
   * Busca perfil de usuário por fingerprint ou IP
   * @param {Object} req - Objeto de requisição do Express
   * @returns {Object|null} Perfil encontrado ou null
   */
  async findUserByFingerprint(req) {
    const currentFingerprint = this.generateBrowserFingerprint(req);
    const currentIP = req.ip;

    try {
      // Buscar por fingerprint exata
      const userByFingerprint = await db.get(`fingerprint:${currentFingerprint}`);
      if (userByFingerprint) {
        const userId = userByFingerprint.userId;
        return await db.get(`user:${userId}`);
      }

      // Buscar por IP similar (prefixo)
      const ipPrefix = currentIP.substring(0, this.IP_PREFIX_LENGTH);
      const userByIP = await db.get(`ip_prefix:${ipPrefix}`);
      if (userByIP) {
        const userId = userByIP.userId;
        return await db.get(`user:${userId}`);
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  /**
   * Identifica usuários recorrentes com busca em database
   * @param {Object} existingProfile - Perfil existente do cookie
   * @param {Object} req - Objeto de requisição do Express
   * @param {string} userInput - Entrada do usuário (opcional)
   * @returns {Object} Perfil atualizado ou null
   */
  async identifyRecurrentUser(existingProfile, req, userInput = '') {
    // Primeiro, tentar identificar através do database
    const dbProfile = await this.findUserByFingerprint(req);
    if (dbProfile) {
      // Atualizar o perfil do database com dados atuais
      return await this.updateRecurrenceProfile(dbProfile, req, false);
    }

    // Se não encontrou no database, usar lógica existente do cookie
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
   * Atualiza informações de recorrência no perfil e salva no database
   * @param {Object} profile - Perfil existente
   * @param {Object} req - Objeto de requisição do Express
   * @param {boolean} isNew - Se é um novo usuário
   * @returns {Object} Perfil atualizado
   */
  async updateRecurrenceProfile(profile, req, isNew = false) {
    const updatedProfile = {...profile};

    // Atualizar contador de visitas
    updatedProfile.visitCount = (profile.visitCount || 0) + 1;
    updatedProfile.lastSeen = new Date().toISOString();

    // Adicionar fingerprint atual
    const fingerprint = this.generateBrowserFingerprint(req);
    updatedProfile.fingerprints = [
      ...new Set([...(profile.fingerprints || []), fingerprint])
    ].slice(0, config.MAX_FINGERPRINTS || 5); // Manter apenas N fingerprints

    // Adicionar IP atual
    updatedProfile.ips = [
      ...new Set([req.ip, ...(profile.ips || [])])
    ].slice(0, config.MAX_IPS || 10); // Manter últimos N IPs

    // Registrar primeira visita se for novo
    if (isNew) {
      updatedProfile.firstSeen = new Date().toISOString();
      updatedProfile.userId = updatedProfile.userId || this.generateUserId();
    }

    // Salvar no database
    await this.saveUserProfile(updatedProfile, req);

    return updatedProfile;
  }

  /**
   * Gera um ID único para o usuário
   * @returns {string} ID único baseado em timestamp e random
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Salva o perfil do usuário no database
   * @param {Object} profile - Perfil do usuário
   * @param {Object} req - Objeto de requisição do Express
   */
  async saveUserProfile(profile, req) {
    try {
      const userId = profile.userId;
      
      // Salvar perfil principal
      await db.set(`user:${userId}`, profile);

      // Indexar por fingerprints
      for (const fingerprint of profile.fingerprints || []) {
        await db.set(`fingerprint:${fingerprint}`, { userId });
      }

      // Indexar por prefixos de IP
      for (const ip of profile.ips || []) {
        const ipPrefix = ip.substring(0, this.IP_PREFIX_LENGTH);
        await db.set(`ip_prefix:${ipPrefix}`, { userId });
      }

      // Indexar por nome de usuário se disponível
      if (profile.nome) {
        await db.set(`username:${profile.nome.toLowerCase()}`, { userId });
      }

    } catch (error) {
      console.error('Erro ao salvar perfil do usuário:', error);
    }
  }

  /**
   * Busca usuário por nome
   * @param {string} username - Nome do usuário
   * @returns {Object|null} Perfil encontrado ou null
   */
  async findUserByName(username) {
    try {
      const userRef = await db.get(`username:${username.toLowerCase()}`);
      if (userRef) {
        return await db.get(`user:${userRef.userId}`);
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar usuário por nome:', error);
      return null;
    }
  }

  /**
   * Salva padrão comportamental do usuário
   * @param {string} userId - ID do usuário
   * @param {string} pattern - Padrão identificado
   */
  async saveBehavioralPattern(userId, pattern) {
    try {
      const key = `behavior:${userId}`;
      const existing = await db.get(key) || [];
      const updated = [...new Set([...existing, pattern])].slice(-20); // Manter últimos 20 padrões
      await db.set(key, updated);
    } catch (error) {
      console.error('Erro ao salvar padrão comportamental:', error);
    }
  }

  /**
   * Busca padrões comportamentais do usuário
   * @param {string} userId - ID do usuário
   * @returns {Array} Lista de padrões
   */
  async getBehavioralPatterns(userId) {
    try {
      return await db.get(`behavior:${userId}`) || [];
    } catch (error) {
      console.error('Erro ao buscar padrões comportamentais:', error);
      return [];
    }
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
   * Calcula confiança na identificação usando configuração
   * @param {Object} profile - Perfil do usuário
   * @returns {number} Pontuação de confiança (0-100)
   */
  calculateConfidence(profile) {
    let confidence = 0;
    const weights = config.CONFIDENCE_WEIGHTS;

    // Fatores de confiança baseados na configuração:
    if (profile.fingerprints?.length > 1) confidence += weights.fingerprints;
    if (profile.ips?.length > 2) confidence += weights.ips;
    if (profile.visitCount > 3) confidence += weights.visits;
    if (profile.nome) confidence += weights.name;
    if (profile.temperamento) confidence += weights.temperament;

    return Math.min(confidence, 100);
  }

  /**
   * Cria um novo perfil de usuário
   * @param {Object} req - Objeto de requisição do Express
   * @param {Object} initialData - Dados iniciais do perfil
   * @returns {Object} Novo perfil criado
   */
  async createNewUserProfile(req, initialData = {}) {
    const fingerprint = this.generateBrowserFingerprint(req);
    const userId = this.generateUserId();
    
    const profile = {
      userId,
      fingerprints: [fingerprint],
      ips: [req.ip],
      visitCount: 1,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      modal_trace: [],
      ...initialData
    };

    await this.saveUserProfile(profile, req);
    return profile;
  }

  /**
   * Mescla perfis de usuário (quando identificamos que são o mesmo usuário)
   * @param {Object} profile1 - Primeiro perfil
   * @param {Object} profile2 - Segundo perfil
   * @returns {Object} Perfil mesclado
   */
  async mergeUserProfiles(profile1, profile2) {
    const merged = {
      userId: profile1.userId, // Manter o ID mais antigo
      fingerprints: [...new Set([...(profile1.fingerprints || []), ...(profile2.fingerprints || [])])].slice(0, config.MAX_FINGERPRINTS),
      ips: [...new Set([...(profile1.ips || []), ...(profile2.ips || [])])].slice(0, config.MAX_IPS),
      visitCount: (profile1.visitCount || 0) + (profile2.visitCount || 0),
      firstSeen: profile1.firstSeen < profile2.firstSeen ? profile1.firstSeen : profile2.firstSeen,
      lastSeen: profile1.lastSeen > profile2.lastSeen ? profile1.lastSeen : profile2.lastSeen,
      modal_trace: [...new Set([...(profile1.modal_trace || []), ...(profile2.modal_trace || [])])],
      nome: profile1.nome || profile2.nome,
      temperamento: profile1.temperamento || profile2.temperamento
    };

    // Salvar perfil mesclado e remover o duplicado
    await this.saveUserProfile(merged, { ip: merged.ips[0] });
    await this.deleteUserProfile(profile2.userId);

    return merged;
  }

  /**
   * Remove perfil de usuário do database
   * @param {string} userId - ID do usuário a ser removido
   */
  async deleteUserProfile(userId) {
    try {
      const profile = await db.get(`user:${userId}`);
      if (profile) {
        // Remover índices
        for (const fingerprint of profile.fingerprints || []) {
          await db.delete(`fingerprint:${fingerprint}`);
        }
        for (const ip of profile.ips || []) {
          const ipPrefix = ip.substring(0, this.IP_PREFIX_LENGTH);
          await db.delete(`ip_prefix:${ipPrefix}`);
        }
        if (profile.nome) {
          await db.delete(`username:${profile.nome.toLowerCase()}`);
        }
        
        // Remover perfil principal
        await db.delete(`user:${userId}`);
        await db.delete(`behavior:${userId}`);
      }
    } catch (error) {
      console.error('Erro ao deletar perfil do usuário:', error);
    }
  }
}

// Exportar como singleton
module.exports = new UserRecognition();