
const users = [
  { username: 'user1', password: 'password1' },
  { username: 'user2', password: 'password2' },
];

function authenticate(username, password) {
  return users.find(user => user.username === username && user.password === password);
}

function isLoggedIn(req) {
  return req.cookies.loggedInUser ? true : false;
}

module.exports = { authenticate, isLoggedIn };
