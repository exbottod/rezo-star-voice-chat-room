/**
 * Pembungkus Node untuk dompet REZO.
 *
 * Kode dompet tetap satu sumber: workers/wallet/src/index.js (dipakai juga di
 * Cloudflare). Berkas ini hanya menjalankan fungsi fetch yang sama di atas
 * HTTP Node, jadi tidak ada logika uang yang diduplikasi.
 */
import http from "node:http";
import worker from "./index.js";

const env = {
  // Database: SQLite lokal di dalam folder kerja (tanpa layanan luar).
  // Gateway WhatsApp OTP yang berjalan di mesin ini.
  WA_OTP_URL: process.env.WA_OTP_URL || "http://127.0.0.1:8099",
  WA_OTP_SECRET: process.env.WA_OTP_SECRET || "",
  // Resend: kunci email hanya ada di server, tidak pernah ikut ke APK.
  RESEND_KEY: process.env.RESEND_KEY || "",
  RESEND_DARI: process.env.RESEND_DARI || "",
};
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
// Permintaan dompet kecil, tapi unggah aset lewat /aset-upload membawa file
// gambar dalam base64, jadi batasnya dibuat jauh lebih longgar (bisa diatur
// lewat env BATAS_ISI_MB).
const BATAS_ISI = Math.max(1, Number(process.env.BATAS_ISI_MB || 12)) * 1024 * 1024;

function bacaIsi(req) {
  return new Promise((resolve, reject) => {
    const potongan = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > BATAS_ISI) {
        reject(new Error("Isi permintaan terlalu besar"));
        req.destroy();
        return;
      }
      potongan.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(potongan)));
    req.on("error", reject);
  });
}


// ---- Unduhan APK dialirkan langsung dari disk (bukan dimuat 70 MB ke memori).
// Mendukung Range, jadi unduhan yang terputus bisa dilanjutkan dan tidak
// menghasilkan berkas terpotong ("Kesalahan parse").
const fs = await import("node:fs");
const pathMod = await import("node:path");
const APK_DIR = "/opt/rezo-api/apk";
const APK_NAMA = { universal: "REZO-STAR-universal.apk", arm64: "REZO-STAR-arm64.apk", armv7: "REZO-STAR-armv7.apk" };

function layaniApk(req, res) {
  const u = new URL(req.url, "http://x");
  const m = u.pathname.match(/^\/unduh\/([A-Za-z0-9_.-]+)$/i);
  if (!m) return false;
  const berkas = APK_NAMA[m[1].toLowerCase()] || m[1];
  if (!/^REZO-STAR-[A-Za-z0-9_.-]+\.apk$/.test(berkas)) return false;
  const lokasi = pathMod.join(APK_DIR, berkas);
  let st;
  try { st = fs.statSync(lokasi); } catch { res.writeHead(404, { "content-type": "text/plain" }); res.end("Berkas belum tersedia"); return true; }
  const kepala = {
    "content-type": "application/vnd.android.package-archive",
    "content-disposition": `attachment; filename="${berkas}"`,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  };
  let awal = 0, akhir = st.size - 1, status = 200;
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (r && (r[1] !== "" || r[2] !== "")) {
    if (r[1] === "") { awal = Math.max(0, st.size - Number(r[2])); }
    else { awal = Number(r[1]); if (r[2] !== "") akhir = Math.min(akhir, Number(r[2])); }
    if (awal > akhir || awal >= st.size) { res.writeHead(416, { "content-range": `bytes */${st.size}` }); res.end(); return true; }
    status = 206;
    kepala["content-range"] = `bytes ${awal}-${akhir}/${st.size}`;
  }
  kepala["content-length"] = String(akhir - awal + 1);
  res.writeHead(status, kepala);
  if (req.method === "HEAD") { res.end(); return true; }
  const aliran = fs.createReadStream(lokasi, { start: awal, end: akhir });
  aliran.on("error", () => res.destroy());
  res.on("close", () => aliran.destroy());
  aliran.pipe(res);
  return true;
}

// ---- Game slot (Zeus Treasures) dilayani langsung dari disk.
const SLOT_DIR = process.env.SLOT_DIR || "/opt/rezo-api/slot";
const JENIS = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4",
  ".json": "application/json", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// Halaman Greedy Rezo disajikan dari disk juga, supaya perbaikan tampilan bisa
// langsung berlaku tanpa memasang ulang APK.
const GREEDY_DIR = process.env.GREEDY_DIR || "/opt/rezo-api/greedy-play";

function layaniSlot(req, res) {
  return layaniBerkas(req, res, "slot", SLOT_DIR, ["info", "settle"]);
}

function layaniGreedyPlay(req, res) {
  return layaniBerkas(req, res, "greedy-play", GREEDY_DIR, []);
}

function layaniBerkas(req, res, prefiks, akar, lewati) {
  const u = new URL(req.url, "http://x");
  if (!new RegExp("^/" + prefiks + "(/|$)", "i").test(u.pathname)) return false;
  let rel;
  try { rel = decodeURIComponent(u.pathname.replace(new RegExp("^/" + prefiks, "i"), "")); } catch { rel = ""; }
  const DIR = akar;
  const SLOT_DIR = akar;
  rel = pathMod.normalize(rel || "/");
  // Dua alamat ini milik dompet (bukan berkas game), jadi diteruskan ke kode dompet.
  const polos = rel.replace(/^[\\/]+/, "").replace(/[\\/]+$/, "").toLowerCase();
  if (lewati.includes(polos)) return false;
  if (rel.endsWith("/") || rel.endsWith("\\")) rel += "index.html";
  const lokasi = pathMod.join(SLOT_DIR, rel);
  if (!lokasi.startsWith(SLOT_DIR)) { res.writeHead(403); res.end("Terlarang"); return true; }
  let st;
  try { st = fs.statSync(lokasi); } catch { res.writeHead(404, { "content-type": "text/plain" }); res.end("Tidak ada"); return true; }
  if (st.isDirectory()) { res.writeHead(404); res.end("Tidak ada"); return true; }
  const ext = pathMod.extname(lokasi).toLowerCase();
  const gambar = ["/sprites/", "/sounds/", "/css/"].some((x) => rel.includes(x));
  const kepala = {
    "content-type": JENIS[ext] || "application/octet-stream",
    "accept-ranges": "bytes",
    "access-control-allow-origin": "*",
    "cache-control": gambar ? "public, max-age=604800" : "no-store",
  };
  let awal = 0, akhir = st.size - 1, status = 200;
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (r && (r[1] !== "" || r[2] !== "")) {
    if (r[1] === "") awal = Math.max(0, st.size - Number(r[2]));
    else { awal = Number(r[1]); if (r[2] !== "") akhir = Math.min(akhir, Number(r[2])); }
    if (awal > akhir || awal >= st.size) { res.writeHead(416, { "content-range": `bytes */${st.size}` }); res.end(); return true; }
    status = 206;
    kepala["content-range"] = `bytes ${awal}-${akhir}/${st.size}`;
  }
  kepala["content-length"] = String(akhir - awal + 1);
  res.writeHead(status, kepala);
  if (req.method === "HEAD") { res.end(); return true; }
  const aliran = fs.createReadStream(lokasi, { start: awal, end: akhir });
  aliran.on("error", () => res.destroy());
  res.on("close", () => aliran.destroy());
  aliran.pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const mulai = Date.now();
  try {
    if ((req.method === "GET" || req.method === "HEAD") && layaniApk(req, res)) return;
    if ((req.method === "GET" || req.method === "HEAD") && layaniSlot(req, res)) return;
    if ((req.method === "GET" || req.method === "HEAD") && layaniGreedyPlay(req, res)) return;
    const isi = req.method === "GET" || req.method === "HEAD" ? undefined : await bacaIsi(req);
    const alamat = `http://${req.headers.host || HOST + ":" + PORT}${req.url}`;
    const permintaan = new Request(alamat, {
      method: req.method,
      headers: req.headers,
      body: isi && isi.length ? isi : undefined,
    });
    const jawaban = await worker.fetch(permintaan, env, { waitUntil() {} });
    res.writeHead(jawaban.status, Object.fromEntries(jawaban.headers));
    const badan = Buffer.from(await jawaban.arrayBuffer());
    res.end(badan);
    if (process.env.LOG !== "0") {
      console.log(`${req.method} ${req.url} ${jawaban.status} ${Date.now() - mulai}ms`);
    }
  } catch (e) {
    console.error(`${req.method} ${req.url} gagal: ${e?.message ?? e}`);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: 0, e: "Server dompet sibuk" }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`dompet REZO jalan di http://${HOST}:${PORT}`);
});
