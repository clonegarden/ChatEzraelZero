const crypto = require('crypto');
const supabase = require('./db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function registerUser(username, password) {
  if (!username || username.length < 3) {
    return { success: false, message: 'Usuário deve ter pelo menos 3 caracteres' };
  }
  if (!password || password.length < 4) {
    return { success: false, message: 'Senha deve ter pelo menos 4 caracteres' };
  }

  const { error } = await supabase
    .from('ezrael_auth_users')
    .insert({
      id:       Date.now().toString(),
      username: username.trim(),
      password: hashPassword(password)
    });

  if (error) {
    if (error.code === '23505') return { success: false, message: 'Usuário já existe' };
    console.error('[auth] registerUser:', error.message);
    return { success: false, message: 'Erro interno do servidor' };
  }

  return {
    success: true,
    message: 'Usuário criado com sucesso',
    user: { username: username.trim() }
  };
}

async function authenticate(username, password) {
  const { data } = await supabase
    .from('ezrael_auth_users')
    .select('id, username')
    .eq('username', username)
    .eq('password', hashPassword(password))
    .maybeSingle();

  return data || null;
}

function isLoggedIn(req) {
  return !!req.cookies.loggedInUser;
}

module.exports = { authenticate, isLoggedIn, registerUser, hashPassword };
