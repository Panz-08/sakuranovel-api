'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { configureApp } = require('../src/app');
const { mulberry32, pickIndex } = require('../src/sakura');

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

test('mulberry32 deterministik dan berada di rentang 0..1', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const values = [a(), a(), a(), a()];
  assert.deepEqual(values, [b(), b(), b(), b()]);
  values.forEach((value) => assert.ok(value >= 0 && value < 1));
});

test('pickIndex menangani batas dan nilai acak ekstrem', () => {
  assert.equal(pickIndex(0), -1);
  assert.equal(pickIndex(-1), -1);
  assert.equal(pickIndex(5, () => 0), 0);
  assert.equal(pickIndex(5, () => 0.999999), 4);
  assert.equal(pickIndex(5, () => 1), 4);
  assert.equal(pickIndex(5, () => -1), 0);
  assert.equal(pickIndex(5, () => Number.NaN), 0);
});

test('endpoint novel acak memvalidasi seed dan limit tanpa menyentuh upstream', async () => {
  await withServer(async (base) => {
    const badSeed = await fetch(`${base}/api/novels/random?seed=abc`);
    assert.equal(badSeed.status, 400);
    assert.equal((await badSeed.json()).error.code, 'BAD_REQUEST');

    const tooBig = await fetch(`${base}/api/novels/random?seed=99999999999`);
    assert.equal(tooBig.status, 400);

    const badLimit = await fetch(`${base}/api/novels/random?limit=999`);
    assert.equal(badLimit.status, 400);
  });
});
