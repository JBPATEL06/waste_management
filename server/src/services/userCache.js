import { query } from '../db/index.js';

// Cache structure: Map<userId, { id, name, email, role, isActive, mustChangePassword, cachedAt }>
const cache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

export async function getCachedUserStatus(userId) {
  const now = Date.now();
  const cached = cache.get(userId);

  if (cached && (now - cached.cachedAt) < CACHE_TTL_MS) {
    return cached;
  }

  const result = await query(
    `SELECT id, name, email, role, is_active, must_change_password 
     FROM users 
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    cache.delete(userId);
    return null;
  }

  const u = result.rows[0];
  const userObj = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.is_active,
    mustChangePassword: u.must_change_password,
    cachedAt: now,
  };

  cache.set(userId, userObj);
  return userObj;
}

export function invalidateUserCache(userId) {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}

