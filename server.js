'use strict';

/**
 * Entry point.
 *
 * Lokal : `npm start` -> server listen di PORT.
 * Vercel: app diekspor dan dijalankan sebagai Vercel Function (tanpa listen).
 */
const express = require('express');
const { configureApp } = require('./src/app');

const app = express();
configureApp(app);

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`\n  SakuraNovel API aktif`);
    console.log(`  Docs   : http://localhost:${port}/`);
    console.log(`  Health : http://localhost:${port}/health\n`);
  });
}

module.exports = app;
