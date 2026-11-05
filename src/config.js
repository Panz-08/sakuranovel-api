'use strict';

const trimSlash = (value) => String(value || '').replace(/\/+$/, '');

const BASE_URL = trimSlash(process.env.SAKURANOVEL_BASE_URL || 'https://sakuranovel.id');
const API_PREFIX = '/wp-json/wp/v2';

const numberFromEnv = (name, fallback, min = 1) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
};

module.exports = {
  BASE_URL,
  API_PREFIX,
  SOURCE_NAME: 'Sakuranovel',
  CREATOR: 'panz-08',
  CACHE_TTL_SECONDS: numberFromEnv('CACHE_TTL_SECONDS', 300, 0),
  CACHE_MAX_ENTRIES: numberFromEnv('CACHE_MAX_ENTRIES', 500, 1),
  RATE_LIMIT_PER_MINUTE: numberFromEnv('RATE_LIMIT_PER_MINUTE', 120, 1),
  UPSTREAM_TIMEOUT_MS: numberFromEnv('UPSTREAM_TIMEOUT_MS', 12000, 1000),
  USER_AGENT:
    process.env.USER_AGENT ||
    'SakuraNovelAPI/1.0 (metadata-only; creator: panz-08)',
  EXCERPT_MAX_LENGTH: 320,
};
