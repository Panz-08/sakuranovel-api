# SakuraNovel API

API metadata novel dan daftar chapter dari [Sakuranovel](https://sakuranovel.id), siap dipakai di Vercel.

**Creator: panz-08**

> Tidak berafiliasi dengan Sakuranovel. Semua data dan hak cipta tetap milik sumber,
> penulis, dan penerjemah.

> API ini memakai REST API WordPress publik milik Sakuranovel (`/wp-json/wp/v2/...`).
> Tidak ada FlareSolverr, browser headless, proxy rotasi, atau trik bypass Cloudflare.
> Kalau sumber memblokir IP, API akan mengembalikan error `UPSTREAM_BLOCKED` dengan jelas.

## Penting: batasan konten

API ini **tidak menyalin teks chapter lengkap**. Yang disediakan:

- judul novel
- daftar chapter
- URL chapter asli
- excerpt singkat (maksimal 320 karakter) untuk chapter tertentu
- statistik dan pencarian

Teks lengkap tetap dibaca di situs sumber. Ini menjaga hak cipta penulis/penerjemah dan
membuat API lebih aman dipakai publik. Kalau butuh teks penuh, minta izin dan API resmi
dari pengelola Sakuranovel.

## Kenapa cocok untuk Vercel?

- Hanya memakai `fetch` bawaan Node dan satu dependency (`express`).
- Tidak butuh Chromium, Docker, atau service tambahan.
- Response diberi `Cache-Control`/`CDN-Cache-Control` supaya cache Vercel bekerja.
- Ada cache in-memory kecil dan rate limit per instance.
- Semua request ke sumber memakai endpoint JSON yang memang publik.

Kalau Cloudflare suatu saat menantang endpoint JSON tersebut, tidak ada jaminan API bisa
mengambil data. Solusinya bukan bypass, tapi meminta akses/izin ke pengelola atau memakai
sumber data resmi.

## Jalankan lokal

```bash
npm install
npm start
# http://localhost:3000
```

Tes:

```bash
npm test
```

## Deploy ke Vercel

1. Push folder ini ke repository GitHub.
2. Buka [vercel.com/new](https://vercel.com/new), import repository.
3. Framework preset: **Other / Express**.
4. Build command dan output directory: biarkan kosong.
5. Deploy.

Tidak ada environment variable yang wajib. `server.js` mengekspor Express app, jadi Vercel
menjalankannya sebagai function. `vercel.json` menaikkan `maxDuration` menjadi 30 detik.

Kalau ingin mengatur batas cache/rate limit, tambahkan environment variable dari
`.env.example` di dashboard Vercel.

## Endpoint

Semua response sukses:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "source": "Sakuranovel",
    "sourceUrl": "https://sakuranovel.id",
    "creator": "panz-08",
    "generatedAt": "2026-11-05T00:00:00.000Z",
    "cached": false
  }
}
```

Response error:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Data tidak ditemukan"
  },
  "meta": {
    "source": "Sakuranovel",
    "sourceUrl": "https://sakuranovel.id",
    "creator": "panz-08"
  }
}
```

### Daftar endpoint

| Method | Path | Keterangan |
|--------|------|------------|
| `GET` | `/` | Dokumentasi JSON |
| `GET` | `/health` | Health check lokal |
| `GET` | `/health?upstream=1` | Cek koneksi ke sumber |
| `GET` | `/api/novels` | Daftar novel |
| `GET` | `/api/novels/:idOrSlug` | Detail novel + chapter pertama/terbaru |
| `GET` | `/api/novels/:idOrSlug/chapters` | Daftar chapter |
| `GET` | `/api/chapters/:id` | Metadata chapter + excerpt singkat |
| `GET` | `/api/latest` | Chapter terbaru dari semua novel |
| `GET` | `/api/search?q=` | Cari novel berdasarkan judul |
| `GET` | `/api/genres` | Tag/genre populer |
| `GET` | `/api/stats` | Jumlah novel dan chapter |
| `GET` | `/api/source` | Info sumber |

### Parameter

`GET /api/novels`

| Parameter | Default | Keterangan |
|-----------|---------|------------|
| `page` | `1` | Halaman |
| `limit` | `20` | Maksimal `100` |
| `q` / `search` | - | Cari judul |
| `sort` | `popular` | `popular`, `newest`, `title` |

`GET /api/novels/:idOrSlug/chapters`

| Parameter | Default | Keterangan |
|-----------|---------|------------|
| `page` | `1` | Halaman |
| `limit` | `50` | Maksimal `100` |
| `order` | `desc` | `asc` atau `desc` berdasarkan tanggal |

`GET /api/search?q=...`

| Parameter | Default | Keterangan |
|-----------|---------|------------|
| `q` | wajib | Kata kunci judul novel |
| `page` | `1` | Halaman |
| `limit` | `20` | Maksimal `50` |

Pencarian chapter global tidak disediakan karena endpoint pencarian publik Sakuranovel hanya
mengindeks seri/novel. Untuk mencari chapter, ambil daftar chapter novel lalu filter di sisi
client.

`GET /api/latest` dan `GET /api/genres` juga menerima `page`/`limit` sesuai kebutuhan.

## Contoh

```bash
# daftar novel populer
curl "http://localhost:3000/api/novels?limit=5&sort=popular"

# cari novel
curl "http://localhost:3000/api/search?q=academy"

# detail novel
curl "http://localhost:3000/api/novels/the-victim-of-the-academy"

# daftar chapter (terbaru dulu)
curl "http://localhost:3000/api/novels/the-victim-of-the-academy/chapters?limit=10&order=desc"

# metadata satu chapter
curl "http://localhost:3000/api/chapters/421269"

# chapter terbaru semua novel
curl "http://localhost:3000/api/latest?limit=10"

# cek sumber
curl "http://localhost:3000/health?upstream=1"
```

Contoh potongan response chapter:

```json
{
  "success": true,
  "data": {
    "id": 421269,
    "title": "The Villain Who Invests in a Witch to Survive Chapter 301 Bahasa Indonesia",
    "chapterNumber": 301,
    "url": "https://sakuranovel.id/.../",
    "series": {
      "id": 1906,
      "slug": "the-villain-who-invests-in-a-witch-to-survive",
      "title": "The Villain Who Invests in a Witch to Survive"
    },
    "contentAvailable": false,
    "readAt": "https://sakuranovel.id/.../"
  }
}
```

## Environment variable

| Nama | Default | Keterangan |
|------|---------|------------|
| `PORT` | `3000` | Hanya untuk lokal |
| `SAKURANOVEL_BASE_URL` | `https://sakuranovel.id` | Jangan diubah tanpa alasan |
| `CACHE_TTL_SECONDS` | `300` | TTL cache in-memory |
| `CACHE_MAX_ENTRIES` | `500` | Jumlah entri cache |
| `RATE_LIMIT_PER_MINUTE` | `120` | Per IP, per instance |
| `UPSTREAM_TIMEOUT_MS` | `12000` | Timeout request ke sumber |
| `USER_AGENT` | `SakuraNovelAPI/1.0 ...` | Sebaiknya ganti dengan kontak/repo kamu |

## Struktur

```text
server.js              entry point lokal + Vercel
src/app.js             dokumentasi, health, CORS, rate limit, error handler
src/routes/api.js      endpoint API
src/sakura.js          client WordPress REST API + cache + normalisasi
src/config.js          konfigurasi environment
src/lib/               cache, error, rate limit, util
test/                  unit test dan test route tanpa network
```

## Catatan produksi

- Cache in-memory dan rate limit hanya berlaku per instance serverless, bukan global.
  Untuk pembatasan serius, gunakan Vercel Firewall atau Redis (Upstash).
- Response maksimal Vercel dan `maxDuration` tetap berlaku. API ini tidak mengirim gambar
  atau teks chapter, jadi payload-nya kecil.
- Kalau endpoint sumber berubah, sesuaikan `SERIES_FIELDS`, `CHAPTER_LIST_FIELDS`, atau
  pemetaan di `src/sakura.js`.
- Hormati `robots.txt`, ketentuan situs, dan hak cipta. Cantumkan sumber saat memakai data.

## Lisensi

MIT — kode boleh dipakai dan dimodifikasi. Data tetap milik sumbernya masing-masing.
