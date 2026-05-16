import { verifySessionToken } from '../services/auth.js';

export function parseCookieHeader(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export function requireOperator(req, res, next) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const username = verifySessionToken(cookies.scs_token);
  if (!username) {
    return res.status(401).json({ error: 'Login required' });
  }
  req.operator = username;
  next();
}
