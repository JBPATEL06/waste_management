import * as userService from '../services/userService.js';

export async function getMe(req, res, next) {
  try {
    const user = await userService.getMe(req.user.id);
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const user = await userService.updateMe(req.user.id, req.body);
    return res.status(200).json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const result = await userService.listUsers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const result = await userService.createUser({
      ...req.body,
      adminId: req.user.id,
    });
    return res.status(201).json({
      message: 'User created successfully',
      user: result.user,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user.id);
    return res.status(200).json({
      message: 'User updated successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await userService.resetPassword(req.params.id, req.user.id);
    return res.status(200).json({
      message: 'Temporary password generated successfully',
      temporaryPassword: result.temporaryPassword,
    });
  } catch (err) {
    next(err);
  }
}

export async function deactivateUser(req, res, next) {
  try {
    const user = await userService.deactivateUser(req.params.id, req.user.id);
    return res.status(200).json({
      message: 'User deactivated successfully and all active sessions were revoked',
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function activateUser(req, res, next) {
  try {
    const user = await userService.activateUser(req.params.id, req.user.id);
    return res.status(200).json({
      message: 'User activated successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
}

