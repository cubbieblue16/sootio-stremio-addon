/**
 * Authentication middleware for admin routes
 */
import crypto from 'crypto';

/**
 * Simple admin authentication middleware
 * Checks for ADMIN_PASSWORD environment variable
 * Uses timing-safe comparison to prevent timing attacks
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Next middleware
 */
export function checkAdminAuth(req, res, next) {
    const password = req.headers['x-admin-password'];
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedPassword) {
        return res.status(501).send('Admin authentication not configured. Set ADMIN_PASSWORD environment variable.');
    }

    const passwordBuffer = Buffer.from(password || '');
    const expectedBuffer = Buffer.from(expectedPassword);
    if (passwordBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(passwordBuffer, expectedBuffer)) {
        return res.status(401).send('Unauthorized. Provide correct password via X-Admin-Password header.');
    }

    next();
}

export default checkAdminAuth;
