/**
 * Rate limiter middleware configuration
 */

import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';

/**
 * Get configured rate limiter middleware
 * @returns {Function} Express middleware
 */
export function getRateLimiter() {
    return rateLimit({
        windowMs: 2 * 60 * 60 * 1000, // 2 hours
        limit: 2000, // Increased from 1000 to 2000 requests per window
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => requestIp.getClientIp(req)
    });
}

export default getRateLimiter;
