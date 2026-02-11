import bcrypt from 'bcrypt';
import createHttpError from 'http-errors';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import path from 'node:path';
import handlebars from 'handlebars';

import { User } from '../models/user.js';
import { Session } from '../models/session.js';
import { createSession, setSessionCookies } from '../services/auth.js';
import { sendEmail } from '../utils/sendMail.js';

export const registerUser = async (req, res, next) => {
try {
const { email, password } = req.body;

const existing = await User.findOne({ email });
if (existing) throw createHttpError(400, 'Email in use');

const hashedPassword = await bcrypt.hash(password, 10);

const user = await User.create({ email, password: hashedPassword });

const session = await createSession(user._id);
setSessionCookies(res, session);

res.status(201).json(user);
} catch (err) {
next(err);
}
};

export const loginUser = async (req, res, next) => {
try {
const { email, password } = req.body;

const user = await User.findOne({ email });
if (!user) throw createHttpError(401, 'Invalid credentials');

const isValid = await bcrypt.compare(password, user.password);
if (!isValid) throw createHttpError(401, 'Invalid credentials');

await Session.deleteMany({ userId: user._id });

const session = await createSession(user._id);
setSessionCookies(res, session);

res.status(200).json(user);
} catch (err) {
next(err);
}
};

export const refreshUserSession = async (req, res, next) => {
try {
const { sessionId, refreshToken } = req.cookies;

const session = await Session.findOne({ _id: sessionId, refreshToken });
if (!session) throw createHttpError(401, 'Session not found');

if (new Date(session.refreshTokenValidUntil).getTime() < Date.now()) {
throw createHttpError(401, 'Session token expired');
}

await Session.deleteOne({ _id: session._id });

const newSession = await createSession(session.userId);
setSessionCookies(res, newSession);

res.status(200).json({ message: 'Session refreshed' });
} catch (err) {
next(err);
}
};

export const logoutUser = async (req, res, next) => {
try {
const { sessionId } = req.cookies;

if (sessionId) {
await Session.deleteOne({ _id: sessionId });
}

res.clearCookie('sessionId', { httpOnly: true, secure: true, sameSite: 'none' });
res.clearCookie('accessToken', { httpOnly: true, secure: true, sameSite: 'none' });
res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'none' });

res.status(204).send();
} catch (err) {
next(err);
}
};

export const requestResetEmail = async (req, res, next) => {
try {
const { email } = req.body;

const user = await User.findOne({ email });

if (!user) {
return res.status(200).json({ message: 'Password reset email sent successfully' });
}

const token = jwt.sign(
{ sub: user._id.toString(), email: user.email },
process.env.JWT_SECRET,
{ expiresIn: '15m' }
);

const templatePath = path.resolve('src', 'templates', 'reset-password-email.html');
const templateSource = await fs.readFile(templatePath, 'utf-8');
const template = handlebars.compile(templateSource);

const link = `${process.env.FRONTEND_DOMAIN}/reset-password?token=${token}`;
const html = template({ name: user.username ?? user.email, link });

try {
  await sendEmail({
  from: process.env.SMTP_FROM,
to: user.email,
subject: 'Reset your password',
html,
});
} catch {
throw createHttpError(500, 'Failed to send the email, please try again later.');
}

res.status(200).json({ message: 'Password reset email sent successfully' });
} catch (err) {
next(err);
}
};

export const resetPassword = async (req, res, next) => {
try {
const { token, password } = req.body;

let payload;
try {
payload = jwt.verify(token, process.env.JWT_SECRET);
} catch {
throw createHttpError(401, 'Invalid or expired token');
}

const user = await User.findOne({ _id: payload.sub, email: payload.email });
if (!user) throw createHttpError(404, 'User not found');

const hashedPassword = await bcrypt.hash(password, 10);

user.password = hashedPassword;
await user.save();

res.status(200).json({ message: 'Password reset successfully' });
} catch (err) {
next(err);
}
};
