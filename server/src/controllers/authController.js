import * as authService from '../services/authService.js';
import { clearRefreshTokenCookie, setRefreshTokenCookie } from '../utils/tokens.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    const result = await authService.login({
      email,
      password,
      userAgent,
      ipAddress,
    });

    setRefreshTokenCookie(res, result.rawRefreshToken);

    return res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    const result = await authService.refresh({
      rawRefreshToken,
      userAgent,
      ipAddress,
    });

    setRefreshTokenCookie(res, result.rawRefreshToken);

    return res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    clearRefreshTokenCookie(res);
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    await authService.logout({ rawRefreshToken });
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req, res, next) {
  try {
    await authService.logoutAll({ userId: req.user.id });
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      message: 'Logged out from all devices successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    const result = await authService.changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword,
      userAgent,
      ipAddress,
    });

    setRefreshTokenCookie(res, result.rawRefreshToken);

    return res.status(200).json({
      message: 'Password changed successfully',
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

