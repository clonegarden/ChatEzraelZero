
const crypto = require('crypto');

// In-memory user storage (in production, use a database)
const users = [
  { username: 'user1', password: 'password1', id: '1' },
  { username: 'user2', password: 'password2', id: '2' },
];

// Hash password for security
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Register a new user
function registerUser(username, password) {
  // Check if user already exists
  if (users.find(user => user.username === username)) {
    return { success: false, message: 'Usuário já existe' };
  }

  // Validate username and password
  if (!username || username.length < 3) {
    return { success: false, message: 'Usuário deve ter pelo menos 3 caracteres' };
  }

  if (!password || password.length < 4) {
    return { success: false, message: 'Senha deve ter pelo menos 4 caracteres' };
  }

  // Create new user
  const newUser = {
    id: Date.now().toString(),
    username: username.trim(),
    password: password, // In production, hash this: hashPassword(password)
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  
  return { 
    success: true, 
    message: 'Usuário criado com sucesso',
    user: { id: newUser.id, username: newUser.username }
  };
}

// Authenticate user
function authenticate(username, password) {
  const user = users.find(user => 
    user.username === username && user.password === password
  );
  
  if (user) {
    return { id: user.id, username: user.username };
  }
  
  return null;
}

// Check if user is logged in
function isLoggedIn(req) {
  return req.cookies.loggedInUser ? true : false;
}

// Get user by username
function getUserByUsername(username) {
  return users.find(user => user.username === username);
}

// Get all users (for admin purposes)
function getAllUsers() {
  return users.map(user => ({ id: user.id, username: user.username, createdAt: user.createdAt }));
}

module.exports = { 
  authenticate, 
  isLoggedIn, 
  registerUser,
  getUserByUsername,
  getAllUsers,
  hashPassword
};
