'use strict';

const { RATE_LIMIT_PER_MINUTE } = require('../config');

/**
 * Rate limit per IP, per instance fungsi.
 * Di serverless batas ini tidak global; untuk produksi serius gunakan
 * Vercel Firewall / Upstash Redis.
 */
function rateLimit({ windowMs = 60_000, max = RATE_LIMIT_PER_MINUTE } = {}) {
  const hits = new Map();

  const timer = setInterval(() => hits.clear(), windowMs);
  if (typeof timer.unref === 'function') timer.unref();

  return function limiter(req, res, next) {
    if (req.method === 'OPTIONS') return next();

    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const count = (hits.get(key) || 0) + 1;
    hits.set(key, count);

    if (count > max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'Terlalu banyak request. Coba lagi sebentar.',
        },
      });
    }

    return next();
  };
}

module.exports = { rateLimit };
