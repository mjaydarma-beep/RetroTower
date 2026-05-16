import crypto from 'crypto';

const SESSION_MS = Number(process.env.SESSION_HOURS || 12) * 60 * 60 * 1000;

export function getOperatorCredentials() {
  return {
    username: process.env.OPERATOR_USERNAME || 'operator',
    password: process.env.OPERATOR_PASSWORD || 'scs-operator',
  };
}

function sessionSecret() {
  return process.env.SESSION_SECRET || 'dev-change-session-secret-in-production';
}

export function createSessionToken(username) {
  const payload = { u: username, exp: Date.now() + SESSION_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.u || payload.exp < Date.now()) return null;
    return payload.u;
  } catch {
    return null;
  }
}

export function validateLogin(username, password) {
  const creds = getOperatorCredentials();
  return username === creds.username && password === creds.password;
}
