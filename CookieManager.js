// middleware/cookieManager.js 
const crypto = require('crypto'); 
const COOKIE_NAME = 'ezrael_profile'; 
const SECRET_KEY = process.env.COOKIE_SECRET || 'chave_muito_secreta';

function sign(data) { return crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex'); }

function encodeCookie(obj) { const json = JSON.stringify(obj); const signature = sign(json); const payload = Buffer.from(json).toString('base64'); return `${payload}.${signature}`; }

function decodeCookie(cookie) { if (!cookie) return null; const [payload, signature] = cookie.split('.'); const json = Buffer.from(payload, 'base64').toString(); if (sign(json) !== signature) return null; return JSON.parse(json); }

function updateProfileCookie(req, res) { const ip = req.ip; const existing = decodeCookie(req.cookies[COOKIE_NAME]) || {};

const profile = { user_id: existing.user_id || crypto.randomUUID(), nome: existing.nome || "", genero: existing.genero || "", idade: existing.idade || "", estado_civil: existing.estado_civil || "", temperamento: existing.temperamento || "", ips: Array.from(new Set([ip, ...(existing.ips || [])])).slice(0, 5), modal_trace: (existing.modal_trace || []).slice(-10), traits: existing.traits || [], };

const cookie = encodeCookie(profile); res.cookie(COOKIE_NAME, cookie, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); return profile; }

module.exports = { updateProfileCookie, decodeCookie, COOKIE_NAME };

