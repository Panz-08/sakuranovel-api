'use strict';

const express = require('express');
const { BASE_URL, SOURCE_NAME, CREATOR } = require('../config');
const { badRequest } = require('../lib/errors');
const {
  cleanSearch,
  parsePage,
  parseLimit,
  parseOrder,
} = require('../lib/util');
const {
  listNovels,
  getNovelDetail,
  listChapters,
  getChapter,
  getLatestChapters,
  searchNovels,
  listGenres,
  getStats,
  randomNovel,
} = require('../sakura');

const router = express.Router();

const SOURCE_META = {
  source: SOURCE_NAME,
  sourceUrl: BASE_URL,
  creator: CREATOR,
};

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function sourceMeta() {
  return { ...SOURCE_META };
}

function sendData(res, data, meta = {}, { maxAge = 300, status = 200 } = {}) {
  const revalidate = Math.max(maxAge, 60);
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${revalidate}`,
  );
  res.setHeader(
    'CDN-Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=${revalidate}`,
  );
  res.setHeader('X-Data-Source', SOURCE_NAME);
  res.setHeader('X-API-Creator', CREATOR);

  return res.status(status).json({
    success: true,
    data,
    meta: {
      ...sourceMeta(),
      generatedAt: new Date().toISOString(),
      ...meta,
    },
  });
}

function cacheMeta(result, extra = {}) {
  return {
    cached: Boolean(result.cached),
    cacheAgeSeconds: result.ageMs ? Math.floor(result.ageMs / 1000) : 0,
    ...extra,
  };
}

function setPaginationLinks(req, res, pagination) {
  if (!pagination) return;

  const pageUrl = (page) => {
    const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
    url.searchParams.set('page', String(page));
    return url.href;
  };

  const links = {};
  if (pagination.hasPrev) links.prev = pageUrl(pagination.page - 1);
  if (pagination.hasNext) links.next = pageUrl(pagination.page + 1);
  if (pagination.totalPages) {
    links.first = pageUrl(1);
    links.last = pageUrl(pagination.totalPages);
  }

  if (Object.keys(links).length) res.links(links);
}

function parseSort(value) {
  const sort = String(value || 'popular').toLowerCase();
  if (!['popular', 'newest', 'title'].includes(sort)) {
    throw badRequest('sort harus "popular", "newest", atau "title"');
  }
  return sort;
}

router.get(
  '/novels',
  asyncRoute(async (req, res) => {
    const page = parsePage(req.query.page, 1);
    const limit = parseLimit(req.query.limit, 20, 100);
    const search = cleanSearch(req.query.q ?? req.query.search ?? '');
    const sort = parseSort(req.query.sort);

    const result = await listNovels({ page, limit, search, sort });
    const { cached, ageMs, ...data } = result;

    setPaginationLinks(req, res, data.pagination);
    return sendData(res, data, cacheMeta(result, { query: search || null, sort }), {
      maxAge: 300,
    });
  }),
);

function parseSeed(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{1,10}$/.test(text)) {
    throw badRequest('seed harus berupa angka bulat 0 sampai 4294967295');
  }
  const seed = Number(text);
  if (!Number.isSafeInteger(seed) || seed > 4294967295) {
    throw badRequest('seed harus berupa angka bulat 0 sampai 4294967295');
  }
  return seed;
}

router.get(
  '/novels/random',
  asyncRoute(async (req, res) => {
    const limit = parseLimit(req.query.limit, 20, 50);
    const seed = parseSeed(req.query.seed);
    const result = await randomNovel({ limit, seed });
    const { cached, ageMs, item, ...rest } = result;

    return sendData(
      res,
      item,
      cacheMeta(result, {
        random: {
          seed: rest.seed,
          page: rest.page,
          total: rest.total,
          totalPages: rest.totalPages,
        },
      }),
      { maxAge: 0 },
    );
  }),
);

router.get(
  '/novels/:idOrSlug/chapters',
  asyncRoute(async (req, res) => {
    const page = parsePage(req.query.page, 1);
    const limit = parseLimit(req.query.limit, 50, 100);
    const order = parseOrder(req.query.order, 'desc');

    const result = await listChapters(req.params.idOrSlug, { page, limit, order });
    const { cached, ageMs, ...data } = result;

    setPaginationLinks(req, res, data.pagination);
    return sendData(res, data, cacheMeta(result, { order }), { maxAge: 120 });
  }),
);

router.get(
  '/novels/:idOrSlug',
  asyncRoute(async (req, res) => {
    const result = await getNovelDetail(req.params.idOrSlug);
    const { cached, ageMs, ...data } = result;

    return sendData(res, data, cacheMeta(result), { maxAge: 180 });
  }),
);

router.get(
  '/chapters/:id',
  asyncRoute(async (req, res) => {
    const result = await getChapter(req.params.id);
    const { cached, ageMs, item } = result;

    return sendData(res, item, cacheMeta(result), { maxAge: 600 });
  }),
);

router.get(
  '/latest',
  asyncRoute(async (req, res) => {
    const page = parsePage(req.query.page, 1);
    const limit = parseLimit(req.query.limit, 20, 100);

    const result = await getLatestChapters({ page, limit });
    const { cached, ageMs, ...data } = result;

    setPaginationLinks(req, res, data.pagination);
    return sendData(res, data, cacheMeta(result), { maxAge: 60 });
  }),
);

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const query = cleanSearch(req.query.q ?? req.query.search ?? '');
    if (!query) throw badRequest('Parameter q wajib diisi');
    if (req.query.type && String(req.query.type).toLowerCase() !== 'novel') {
      throw badRequest('Pencarian hanya mendukung type "novel"');
    }

    const page = parsePage(req.query.page, 1);
    const limit = parseLimit(req.query.limit, 20, 50);

    const result = await searchNovels(query, { page, limit });
    const { cached, ageMs, ...data } = result;

    setPaginationLinks(req, res, data.pagination);
    return sendData(res, data, cacheMeta(result, { query }), { maxAge: 120 });
  }),
);

router.get(
  '/genres',
  asyncRoute(async (req, res) => {
    const limit = parseLimit(req.query.limit, 50, 100);
    const result = await listGenres({ limit });
    const { cached, ageMs, ...data } = result;

    return sendData(res, data, cacheMeta(result), { maxAge: 3600 });
  }),
);

router.get(
  '/stats',
  asyncRoute(async (req, res) => {
    const result = await getStats();
    const { cached, ageMs, ...data } = result;
    return sendData(res, data, cacheMeta(result), { maxAge: 300 });
  }),
);

router.get(
  '/source',
  asyncRoute(async (req, res) => {
    return sendData(
      res,
      {
        name: SOURCE_NAME,
        url: BASE_URL,
        api: `${BASE_URL}/wp-json/wp/v2`,
        creator: CREATOR,
        note:
          'API ini hanya menyediakan metadata, daftar chapter, dan excerpt singkat. ' +
          'Teks chapter lengkap tetap dibaca di situs sumber.',
      },
      {},
      { maxAge: 3600 },
    );
  }),
);

router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint tidak ditemukan',
    },
  });
});

module.exports = router;
