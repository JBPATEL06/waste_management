import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN,
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

export function generateRawRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

export function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function setRefreshTokenCookie(res, rawToken) {
  const maxAgeMs = config.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAMESITE.toLowerCase(),
    path: '/',
    maxAge: maxAgeMs,
    domain: config.COOKIE_DOMAIN && config.COOKIE_DOMAIN !== 'localhost' ? config.COOKIE_DOMAIN : undefined,
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAMESITE.toLowerCase(),
    path: '/',
    domain: config.COOKIE_DOMAIN && config.COOKIE_DOMAIN !== 'localhost' ? config.COOKIE_DOMAIN : undefined,
  });
}

