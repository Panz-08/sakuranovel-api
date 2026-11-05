'use strict';

class AppError extends Error {
  /**
   * @param {string} message pesan aman untuk ditampilkan ke client
   * @param {number} status HTTP status
   * @param {string} code kode error singkat
   * @param {boolean} retryable apakah request yang sama layak dicoba ulang
   */
  constructor(message, status = 500, code = 'INTERNAL', retryable = false) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const notFound = (message = 'Data tidak ditemukan') =>
  new AppError(message, 404, 'NOT_FOUND');
const badRequest = (message) => new AppError(message, 400, 'BAD_REQUEST');

module.exports = { AppError, notFound, badRequest };
