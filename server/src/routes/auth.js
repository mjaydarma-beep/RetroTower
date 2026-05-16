import { Router } from 'express';
import {
  createSessionToken,
  getOperatorCredentials,
  validateLogin,
  verifySessionToken,
} from '../services/auth.js';
import { parseCookieHeader } from '../middleware/operatorAuth.js';

export const authRouter = Router();

const COOKIE_OPTS = 'Path=/; HttpOnly; SameSite=Lax';

authRouter.post('/login', (req, res) => {
  const username = String(req.body.username ?? '').trim();
  const password = String(req.body.password ?? '');

  if (!validateLogin(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = createSessionToken(username);
  const maxAge = Number(process.env.SESSION_HOURS || 12) * 60 * 60;
  res.setHeader('Set-Cookie', `scs_token=${token}; Max-Age=${maxAge}; ${COOKIE_OPTS}`);
  res.json({ ok: true, username });
});

authRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `scs_token=; Max-Age=0; ${COOKIE_OPTS}`);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const username = verifySessionToken(cookies.scs_token);
  if (!username) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json({ username });
});

authRouter.get('/config', (_req, res) => {
  res.json({ loginRequired: true, usernameHint: getOperatorCredentials().username });
});
