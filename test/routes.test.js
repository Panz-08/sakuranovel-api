'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { configureApp } = require('../src/app');

async function withServer(run) {
  const app = configureApp(express());
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    await run(base);
  } finally {
    server.close();
  }
}

test('dokumentasi root dan /api tersedia', async () => {
  await withServer(async (base) => {
    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    const docs = await root.json();
    assert.equal(docs.success, true);
    assert.equal(docs.creator, 'panz-08');
    assert.ok(Array.isArray(docs.endpoints));

    const api = await fetch(`${base}/api`);
    assert.equal(api.status, 200);
    assert.equal((await api.json()).name, 'SakuraNovel API');
  });
});

test('health check lokal tidak memanggil upstream', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.cache.ttlSeconds, 300);
  });
});

test('validasi query berjalan sebelum request upstream', async () => {
  await withServer(async (base) => {
    const missingQuery = await fetch(`${base}/api/search`);
    assert.equal(missingQuery.status, 400);
    assert.equal((await missingQuery.json()).error.code, 'BAD_REQUEST');

    const badLimit = await fetch(`${base}/api/novels?limit=999`);
    assert.equal(badLimit.status, 400);

    const unknown = await fetch(`${base}/api/tidak-ada`);
    assert.equal(unknown.status, 404);
  });
});
