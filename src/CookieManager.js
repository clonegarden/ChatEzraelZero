const crypto = require('crypto');
const UserRecognition = require('./UserRecognition');

const COOKIE_NAME = 'ezrael_profile';
const SECRET_KEY = process.env.COOKIE_SECRET || 'chave_muito_secreta';

function sign(data) {
  return crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');
}

function encodeCookie(obj) {
  const json = JSON.stringify(obj);
  const signature = sign(json);
  const payload = Buffer.from(json).toString('base64');
  return `${payload}.${signature}`;
}

function decodeCookie(cookie) {
  if (!cookie) return null;
  const [payload, signature] = cookie.split('.');
  if (!payload || !signature) return null;

  const json = Buffer.from(payload, 'base64').toString();
  if (sign(json) !== signature) return null;
  return JSON.parse(json);
}

function extractModalLogic(message) {
  const seeds = ['□', '◇', '⊕', '¬', '→', '↯', '☯', '⚖', '✂', '∴'];
  const keywords = message.toLowerCase().match(/\b\w+\b/g) || [];
  const hash = crypto.createHash('md5').update(message).digest('hex');
  const index = parseInt(hash.slice(0, 2), 16);
  const symbol = seeds[index % seeds.length];
  const keyword = keywords[index % keywords.length] || 'x';
  return `${symbol}${keyword.charAt(0).toUpperCase()}`;
}

function inferTemperamento(text) {
  if (/calmo|tranquilo|paz|paciência/.test(text)) return 'Fleumático';
  if (/raiva|impulsivo|fúria|firme/.test(text)) return 'Colérico';
  if (/triste|profundo|escuro|isolado/.test(text)) return 'Melancólico';
  if (/animado|feliz|riso|leve|engraçado/.test(text)) return 'Sanguíneo';
  return '';
}

function updateProfileCookie(req, res, messageContent = '') {
  // 🔄 INTEGRAÇÃO USER RECOGNITION (ANTES da lógica de inferência)
  const existing = decodeCookie(req.cookies[COOKIE_NAME]) || {};

  // Identificar se é usuário recorrente
  const isRecurrent = UserRecognition.identifyRecurrentUser(existing, req, messageContent);
  const isNewUser = !isRecurrent;

  // Atualizar informações de recorrência
  let updatedProfile = UserRecognition.updateRecurrenceProfile(
    isRecurrent || {}, 
    req, 
    isNewUser
  );

  // ... CONTINUA com a lógica de inferência existente (nome, idade, etc.) ...
  if (messageContent) {
    const nameMatch = messageContent.match(/(?:me chamo|meu nome é|sou (?:o|a) )([A-Za-zÀ-ÿ]+)/i);
    if (nameMatch && !updatedProfile.nome) {
      updatedProfile.nome = nameMatch[1];
    }

    const ageMatch = messageContent.match(/(?:tenho|estou com) (\d{1,2}) anos/i);
    if (ageMatch && !updatedProfile.idade) {
      updatedProfile.idade = parseInt(ageMatch[1]);
    }

    // 🔁 Atualiza lógica modal
    const modalLogic = extractModalLogic(messageContent);
    updatedProfile.modal_trace = Array.from(
      new Set([...(existing.modal_trace || []), modalLogic])
    ).slice(-10);

    // 🔮 Atualiza temperamento
    const temp = inferTemperamento(messageContent);
    if (temp && !updatedProfile.temperamento) {
      updatedProfile.temperamento = temp;
    }

    // ⚙️ Traços inferidos (exemplo simples)
    const traits = updatedProfile.traits || [];
    if (/autista|neurodivergente/.test(messageContent) && !traits.includes('neurodivergente')) {
      traits.push('neurodivergente');
    }
    updatedProfile.traits = Array.from(new Set(traits));
  }

  // 🔄 Adicionar confiança ao perfil
  updatedProfile.confidence = UserRecognition.calculateConfidence(updatedProfile);

  // Construir objeto de perfil final
  const profile = {
    user_id: updatedProfile.user_id || crypto.randomUUID(),
    nome: updatedProfile.nome || '',
    genero: updatedProfile.genero || '',
    idade: updatedProfile.idade || '',
    estado_civil: updatedProfile.estado_civil || '',
    temperamento: updatedProfile.temperamento || '',
    ips: Array.from(new Set([req.ip, ...(updatedProfile.ips || [])])).slice(0, 5),
    modal_trace: updatedProfile.modal_trace || [],
    traits: updatedProfile.traits || [],
    confidence: updatedProfile.confidence || 0,
    visitCount: updatedProfile.visitCount || 1,
    firstSeen: updatedProfile.firstSeen || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    fingerprints: updatedProfile.fingerprints || []
  };

  const cookie = encodeCookie(profile);
  res.cookie(COOKIE_NAME, cookie, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'None',
    secure: true
  });

  return profile;
}

module.exports = {
  updateProfileCookie,
  decodeCookie,
  COOKIE_NAME
};