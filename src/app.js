'use strict';

const express = require('express');
const {
  BASE_URL,
  SOURCE_NAME,
  CREATOR,
  CACHE_TTL_SECONDS,
  CACHE_MAX_ENTRIES,
  RATE_LIMIT_PER_MINUTE,
} = require('./config');
const { AppError } = require('./lib/errors');
const { rateLimit } = require('./lib/rate-limit');
const apiRouter = require('./routes/api');
const { getStats } = require('./sakura');

function docs() {
  return {
    success: true,
    name: 'SakuraNovel API',
    version: require('../package.json').version,
    creator: CREATOR,
    description:
      'API metadata novel dan daftar chapter dari Sakuranovel. ' +
      'Memakai REST API WordPress publik milik sumber, bukan bypass Cloudflare.',
    source: {
      name: SOURCE_NAME,
      url: BASE_URL,
      api: `${BASE_URL}/wp-json/wp/v2`,
    },
    policy: {
      affiliation:
        'Tidak berafiliasi dengan Sakuranovel. Semua data dan hak cipta tetap milik sumber, penulis, dan penerjemah.',
      content:
        'Hanya metadata, daftar chapter, dan excerpt singkat. Teks chapter lengkap tidak disimpan atau diproksikan.',
      attribution: `Data dari ${SOURCE_NAME}. Hormati ketentuan sumber dan hak cipta penulis/penerjemah.`,
      cloudflare:
        'API ini tidak memakai FlareSolverr, browser headless, proxy rotasi, atau trik anti-bot. ' +
        'Jika sumber memblokir IP, API mengembalikan error UPSTREAM_BLOCKED.',
    },
    endpoints: [
      { method: 'GET', path: '/api/novels', description: 'Daftar novel' },
      { method: 'GET', path: '/api/novels/random?seed=123', description: 'Satu novel acak (seed opsional)' },
      { method: 'GET', path: '/api/novels/:idOrSlug', description: 'Detail novel + chapter pertama/terbaru' },
      { method: 'GET', path: '/api/novels/:idOrSlug/chapters', description: 'Daftar chapter' },
      { method: 'GET', path: '/api/chapters/:id', description: 'Metadata chapter + excerpt singkat' },
      { method: 'GET', path: '/api/latest', description: 'Chapter terbaru dari semua novel' },
      { method: 'GET', path: '/api/search?q=', description: 'Cari novel berdasarkan judul' },
      { method: 'GET', path: '/api/genres', description: 'Tag/genre populer' },
      { method: 'GET', path: '/api/stats', description: 'Jumlah novel dan chapter' },
      { method: 'GET', path: '/api/source', description: 'Info sumber' },
      { method: 'GET', path: '/health', description: 'Health check' },
    ],
    examples: {
      novels: '/api/novels?page=1&limit=20&sort=popular',
      random: '/api/novels/random?seed=42',
      search: '/api/search?q=academy',
      detail: '/api/novels/the-victim-of-the-academy',
      chapters: '/api/novels/the-victim-of-the-academy/chapters?page=1&limit=50&order=desc',
      latest: '/api/latest?page=1&limit=20',
      chapter: '/api/chapters/421269',
    },
    notes: {
      cache:
        'Cache in-memory hanya per instance serverless. Response juga diberi header CDN cache Vercel.',
      rateLimit: `${RATE_LIMIT_PER_MINUTE} request/menit per IP per instance.`,
    },
  };
}

function configureApp(app) {
  app.disable('x-powered-by');

  if (process.env.VERCEL || process.env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Link, X-Data-Source, X-API-Creator, X-Cache',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  });

  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.json(docs());
  });

  app.get('/api', (req, res) => {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.json(docs());
  });

  app.get('/health', async (req, res) => {
    const base = {
      success: true,
      status: 'ok',
      name: 'SakuraNovel API',
      version: require('../package.json').version,
      creator: CREATOR,
      runtime: {
        node: process.version,
        vercel: Boolean(process.env.VERCEL),
      },
      cache: {
        ttlSeconds: CACHE_TTL_SECONDS,
        maxEntries: CACHE_MAX_ENTRIES,
      },
      rateLimitPerMinute: RATE_LIMIT_PER_MINUTE,
    };

    if (String(req.query.upstream || '') !== '1') {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(base);
    }

    try {
      const stats = await getStats();
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        ...base,
        upstream: {
          ok: true,
          source: SOURCE_NAME,
          stats,
        },
      });
    } catch (error) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        success: false,
        status: 'degraded',
        error: {
          code: error.code || 'UPSTREAM_ERROR',
          message: error.message || 'Sumber tidak bisa diakses',
        },
        meta: {
          source: SOURCE_NAME,
          sourceUrl: BASE_URL,
          creator: CREATOR,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  });

  app.get('/favicon.ico', (req, res) => res.status(204).end());

  const limiter = rateLimit();
  app.use('/api', limiter);
  app.use('/api', apiRouter);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint tidak ditemukan. Lihat dokumentasi di /',
      },
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const known = err instanceof AppError;
    if (!known) {
      console.error('[ERROR]', req.method, req.originalUrl, err);
    }

    if (res.headersSent) return res.destroy();

    res.setHeader('Cache-Control', 'no-store');
    return res.status(known ? err.status : 500).json({
      success: false,
      error: {
        code: known ? err.code : 'INTERNAL',
        message: known ? err.message : 'Terjadi kesalahan internal server.',
        ...(known && err.retryable ? { retryable: true } : {}),
      },
      meta: {
        source: SOURCE_NAME,
        sourceUrl: BASE_URL,
        creator: CREATOR,
        generatedAt: new Date().toISOString(),
      },
    });
  });

  return app;
}

module.exports = { configureApp, docs };
