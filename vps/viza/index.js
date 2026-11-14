/**
 * Dompet REZO: SQLite lokal di VPS (juga jalan di Cloudflare).
 *
 * Menggantikan smart-processor Supabase. Bentuk jawabannya sama persis
 * ({"ok":1,"w":{...}} atau {"ok":0,"e":"..."}), jadi aplikasi tidak perlu
 * diubah selain alamat server.
 *
 * Semua operasi uang memakai satu transaksi SQLite (BEGIN IMMEDIATE) dan
 * penanda permintaan, jadi permintaan yang terkirim dua kali tidak
 * memotong coin dua kali.
 */

const PROJ = "my-app-e7f8c";
// Project Firebase lain yang dipercaya (aplikasi white-label Viza memakai project sendiri).
const PROJ_LAIN = [];
const PROJ_SAH = [PROJ, ...PROJ_LAIN];

// ---------- Game Greedy King (satu berkas dengan dompet supaya update VPS
// hanya perlu mengunduh index.js) ----------
/**
 * Game Greedy King milik REZO.
 *
 * Semua uang memakai dompet yang sama (tabel wallets), jadi tidak ada saldo
 * terpisah. Hasil putaran ditentukan nomor putaran (SHA-256), bukan pemanggil,
 * supaya adil untuk semua pemain.
 */

const ROUND_MS = 40000;
const BET_MS = 30000;

const DISHES = [
  { id: "hotdog", group: "meat", odds: 10 },
  { id: "skewer", group: "meat", odds: 15 },
  { id: "drumstick", group: "meat", odds: 25 },
  { id: "steak", group: "meat", odds: 45 },
  { id: "tomato", group: "veg", odds: 5 },
  { id: "corn", group: "veg", odds: 5 },
  { id: "cabbage", group: "veg", odds: 5 },
  { id: "carrot", group: "veg", odds: 5 },
];
const GROUP_ODDS = { veg: 1.25, meat: 4.37 };
const POTS = new Set([...DISHES.map((d) => d.id), "veg", "meat"]);
const WEIGHTS = [
  ["carrot", 19], ["cabbage", 19], ["corn", 19], ["tomato", 19],
  ["hotdog", 9], ["skewer", 6], ["drumstick", 4], ["steak", 2],
  ["salad", 0.4], ["pizza", 0.15],
];
const SALT = "greedy-king-v1-7f3a91c2";
const MAKS_BET = 1000000000000;

const roundOf = (ms) => Math.floor(ms / ROUND_MS);
const sedangPasang = (ms) => ms % ROUND_MS < BET_MS;

function pickResult(r) {
  const total = WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [id, w] of WEIGHTS) {
    if (x < w) return id;
    x -= w;
  }
  return "carrot";
}

async function resultFor(round) {
  const data = new TextEncoder().encode(`${SALT}:${round}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return pickResult(new DataView(buf).getUint32(0) / 2 ** 32);
}

function payout(bets, result) {
  const b = (p) => Number(bets[p] ?? 0);
  let win = 0;
  const pay = (group, all) => {
    for (const d of DISHES) if (d.group === group && (all || d.id === result)) win += b(d.id) * d.odds;
    win += b(group) * GROUP_ODDS[group];
  };
  if (result === "salad") pay("veg", true);
  else if (result === "pizza") pay("meat", true);
  else {
    const dish = DISHES.find((d) => d.id === result);
    if (dish) pay(dish.group, false);
  }
  return Math.floor(win);
}

/** Jalur: /greedy/api/... */
async function greedyPlay(req, env, h) {
  const { pipe, pipeTrx, json, gagal, T, I, uidDariToken } = h;
  const url = new URL(req.url);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  // Token aplikasi (Firebase) atau token pendek Wave, supaya permainan dan
  // pengujian bisa memakai keduanya.
  let uid = token ? await uidDariToken(token) : "";
  if (!uid && token) {
    try { uid = await waveUidDariToken(env, token); } catch (e) { uid = ""; }
  }
  if (!uid) return json({ ok: 0, error: "Sesi tidak sah" }, 401);

  const siap = async () => {
    await pipe(env, [
      { sql: `create table if not exists greedy_bet (
          uid text not null, nama text not null default '', round integer not null,
          pot text not null, amount integer not null default 0, at integer not null default 0,
          primary key (uid, round, pot))` },
      { sql: `create table if not exists greedy_settle (
          round integer primary key, result text not null, at integer not null default 0)` },
      { sql: `create table if not exists greedy_menang (
          uid text not null, nama text not null default '', round integer not null,
          win integer not null default 0, at integer not null default 0)` },
    ]);
  };

  const saldo = async () => {
    const r = await pipe(env, [{ sql: "select coins from wallets where uid = ?", args: [T(uid)] }]);
    return Math.max(0, Math.trunc(Number(r[0].rows[0]?.coins ?? 0)));
  };

  // ---- daftar pemenang ----
  if (url.pathname.endsWith("/top-winners") || url.pathname.endsWith("/round-winners")) {
    await siap();
    const batas = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 8)));
    if (url.pathname.endsWith("/round-winners")) {
      const round = Math.trunc(Number(url.searchParams.get("round") || 0));
      const r = await pipe(env, [
        { sql: `select uid id, nama display_name, win from greedy_menang
                where round = ? order by win desc limit ?`, args: [I(round), I(batas)] },
      ]);
      return json(r[0].rows.map((x) => ({ id: x.id, display_name: x.display_name, win: Number(x.win) })));
    }
    const sejak = Number(new Date(url.searchParams.get("since") || 0)) || 0;
    const r = await pipe(env, [
      { sql: `select uid id, nama display_name, sum(win) win from greedy_menang
              where at >= ? group by uid order by win desc limit ?`, args: [I(sejak), I(batas)] },
    ]);
    return json(r[0].rows.map((x) => ({ id: x.id, display_name: x.display_name, win: Number(x.win) })));
  }

  if (req.method !== "POST") return gagal("Gunakan POST");
  const b = await req.json().catch(() => ({}));
  const aksi = String(b.action || "");
  const sekarang = Date.now();
  const roundKini = roundOf(sekarang);

  if (aksi === "init") {
    await siap();
    const nama = String(b.name || b.nama || "Player").slice(0, 24);
    const riwayat = await pipe(env, [
      { sql: `select s.round, s.result from greedy_settle s
              where exists (select 1 from greedy_bet g where g.round = s.round and g.uid = ?)
              order by s.round desc limit 10`, args: [T(uid)] },
    ]);
    return json({
      serverNow: sekarang,
      name: nama,
      coins: await saldo(),
      history: riwayat[0].rows.map((x) => ({ round: Number(x.round), result: x.result })),
    });
  }

  if (aksi === "bet") {
    await siap();
    const pot = String(b.pot || "");
    const amount = Math.trunc(Number(b.amount || 0));
    if (!POTS.has(pot)) return gagal("Pilihan taruhan tidak dikenal");
    if (!(amount > 0)) return gagal("Jumlah taruhan tidak valid");
    if (amount > MAKS_BET) return gagal("Taruhan melebihi batas");
    if (!sedangPasang(sekarang)) return gagal("Waktu taruhan sudah tutup");
    const round = roundOf(sekarang);
    const nama = String(b.name || b.nama || "Player").slice(0, 24);

    const r = await pipeTrx(env, [
      { sql: "begin immediate" },
      { sql: "insert or ignore into wallets (uid) values (?)", args: [T(uid)] },
      {
        sql: `update wallets set coins = coins - ?, updated_at = ? where uid = ? and coins >= ?`,
        args: [I(amount), I(sekarang), T(uid), I(amount)],
      },
      {
        sql: `insert into greedy_bet (uid, nama, round, pot, amount, at)
              select ?, ?, ?, ?, ?, ? where changes() > 0
              on conflict (uid, round, pot) do update set amount = amount + excluded.amount, nama = excluded.nama`,
        args: [T(uid), T(nama), I(round), T(pot), I(amount), I(sekarang)],
      },
      { sql: "select coins from wallets where uid = ?", args: [T(uid)] },
      { sql: "commit" },
    ]);
    const sisa = Number(r[4].rows[0]?.coins ?? 0);
    if (Number(r[2].affected ?? 0) <= 0) return gagal("Coin tidak cukup");
    return json({ ok: 1, coins: sisa, round });
  }

  if (aksi === "settle") {
    await siap();
    const round = Math.trunc(Number(b.round || 0));
    if (!(round > 0)) return gagal("Nomor putaran tidak valid");
    if (round >= roundKini) return gagal("Putaran belum selesai");

    const ada = await pipe(env, [
      { sql: "select result from greedy_settle where round = ?", args: [I(round)] },
    ]);
    let hasil = ada[0].rows[0]?.result;

    if (!hasil) {
      hasil = await resultFor(round);
      const bets = await pipe(env, [
        { sql: "select uid, nama, pot, sum(amount) amount from greedy_bet where round = ? group by uid, pot",
          args: [I(round)] },
      ]);
      const per = new Map();
      for (const row of bets[0].rows) {
        const u = String(row.uid);
        if (!per.has(u)) per.set(u, { nama: String(row.nama || "Player"), bets: {} });
        per.get(u).bets[String(row.pot)] = Number(row.amount);
      }
      const stmt = [
        { sql: "begin immediate" },
        { sql: "insert or ignore into greedy_settle (round, result, at) values (?, ?, ?)",
          args: [I(round), T(hasil), I(sekarang)] },
      ];
      let pertama = true;
      for (const [u, v] of per) {
        const win = payout(v.bets, hasil);
        if (!(win > 0)) continue;
        stmt.push({
          sql: `update wallets set coins = coins + ?, updated_at = ? where uid = ?
                ${pertama ? "and changes() > 0" : "and changes() > 0"}`,
          args: [I(win), I(sekarang), T(u)],
        });
        stmt.push({
          sql: `insert into greedy_menang (uid, nama, round, win, at)
                select ?, ?, ?, ?, ? where changes() > 0`,
          args: [T(u), T(v.nama), I(round), I(win), I(sekarang)],
        });
        pertama = false;
      }
      stmt.push({ sql: "commit" });
      try {
        await pipeTrx(env, stmt);
      } catch (e) {
        // Putaran bisa saja sudah diselesaikan permintaan lain; pakai hasil tersimpan.
        const ulang = await pipe(env, [
          { sql: "select result from greedy_settle where round = ?", args: [I(round)] },
        ]);
        hasil = ulang[0].rows[0]?.result || hasil;
      }
    }

    const milik = await pipe(env, [
      { sql: "select sum(amount) bet from greedy_bet where uid = ? and round = ?", args: [T(uid), I(round)] },
      { sql: "select sum(win) win from greedy_menang where uid = ? and round = ?", args: [T(uid), I(round)] },
    ]);
    return json({
      ok: 1,
      round,
      result: hasil,
      bet: Number(milik[0].rows[0]?.bet ?? 0),
      win: Number(milik[1].rows[0]?.win ?? 0),
      coins: await saldo(),
    });
  }

  return gagal("Aksi tidak dikenal");
}
 // project Firebase (aud token)

// ---------- Akses database (SQLite lokal) ----------
const T = (v) => ({ type: "text", value: String(v) });
const I = (v) => ({ type: "integer", value: String(Math.trunc(Number(v) || 0)) });

let siapLog = false;
async function logGalat(env, uid, aksi, pesan) {
  try {
    if (!siapLog) {
      await pipe(env, [{ sql: "create table if not exists wallet_galat (uid text, aksi text, pesan text, at integer)" }]);
      siapLog = true;
    }
    await pipe(env, [{ sql: "insert into wallet_galat (uid, aksi, pesan, at) values (?,?,?,?)",
      args: [T(String(uid || "")), T(String(aksi || "")), T(String(pesan || "").slice(0, 200)), T(Date.now())] }]);
  } catch { /* logging tidak boleh mengganggu transaksi */ }
}

// ---------- Database ----------
// Database tinggal di VPS sendiri sebagai SQLite: tanpa kuota, tanpa layanan
// luar, dan tetap jalan walau internet VPS putus. Satu-satunya syarat adalah
// Node di server mendukung modul bawaan node:sqlite (Node 22.13 ke atas).
const DB_DIR = "/opt/viza-api/data";
const DB_FILE = DB_DIR + "/viza.db";
let dbSiap = null;
let dbGalat = "";

async function bukaDbLokal() {
  const fs = await import("node:fs");
  fs.mkdirSync(DB_DIR, { recursive: true });
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA busy_timeout=8000");
  db.exec("PRAGMA synchronous=NORMAL");
  return db;
}

/** Turunkan stok yang sudah terlanjur melewati batas, sekali saat database dibuka. */
function rapikanStokBesar(db) {
  try {
    const a = db.prepare("update coin_seller set stock = ? where stock > ?").run(MAKS_STOK, MAKS_STOK);
    const b = db.prepare("update panel_staf set coins = ? where coins > ?").run(MAKS_STOK, MAKS_STOK);
    const n = Number(a.changes ?? 0) + Number(b.changes ?? 0);
    if (n > 0) console.log("rapikan stok: " + n + " baris diturunkan ke batas " + MAKS_STOK);
  } catch (e) { /* tabel belum ada di instalasi baru: aman diabaikan */ }
}

/**
 * Tabel inti dompet. Dompet Rezo sudah punya tabel ini sejak dulu, tapi dompet
 * Viza dipasang di SQLite kosong, sehingga beli di Store, topup, dan game gagal
 * dengan "no such table: wallets". Dibuat di sini supaya SEMUA rute aman, bukan
 * hanya rute panel. Aman dijalankan berulang di database lama.
 */
function siapkanTabelInti(db) {
  db.exec(`create table if not exists wallets (
    uid text primary key,
    coins integer not null default 0,
    diamonds integer not null default 0,
    exp integer not null default 0,
    vip integer not null default 0,
    vip_until integer not null default 0,
    lv_claimed integer not null default 0,
    inv text not null default '{}',
    equip text not null default '{}',
    updated_at integer not null default 0
  )`);
  db.exec(`create table if not exists money_tx (uid text, kind text, item_id text, amount integer, room_id text, created_at integer)`);
  db.exec(`create table if not exists props (id text primary key, uid text, vip integer, days integer, src text, ts integer, used integer)`);
  db.exec(`create table if not exists gift_req (req_id text primary key, uid text, at integer)`);
  db.exec(`create table if not exists vip_req (req_id text primary key, uid text, at integer)`);
  db.exec(`create table if not exists topup_req (req_id text primary key, uid text, at integer)`);
  db.exec(`create table if not exists exchange_req (req_id text primary key, uid text, at integer)`);
  // Kalau tabel sudah ada tapi kekurangan kolom, tambahkan satu per satu.
  const ada = new Set(db.prepare("pragma table_info(wallets)").all().map((k) => k.name));
  const wajib = {
    coins: "integer not null default 0",
    diamonds: "integer not null default 0",
    exp: "integer not null default 0",
    vip: "integer not null default 0",
    vip_until: "integer not null default 0",
    lv_claimed: "integer not null default 0",
    inv: "text not null default '{}'",
    equip: "text not null default '{}'",
    updated_at: "integer not null default 0",
  };
  for (const [nama, def] of Object.entries(wajib)) {
    if (!ada.has(nama)) db.exec(`alter table wallets add column ${nama} ${def}`);
  }
}

async function dbLokal(env) {
  if (!dbSiap) {
    dbSiap = (async () => {
      const db = await bukaDbLokal();
      siapkanTabelInti(db);
      rapikanStokBesar(db);
      return db;
    })().catch((e) => { dbSiap = null; dbGalat = String(e?.message ?? e); throw e; });
  }
  return dbSiap;
}

/** Batas stok seller dan stok coin staf: 1 kuadriliun, jauh di bawah batas aman JS. */
const MAKS_STOK = 1000000000000000;
/** Batas angka bulat yang masih persis di JavaScript (2^53 - 1). */
const ANGKA_AMAN = Number.MAX_SAFE_INTEGER;
function amankanBaris(r) {
  const o = {};
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (typeof v === "bigint") {
      if (v > BigInt(ANGKA_AMAN)) o[k] = ANGKA_AMAN;
      else if (v < -BigInt(ANGKA_AMAN)) o[k] = -ANGKA_AMAN;
      else o[k] = Number(v);
    } else {
      o[k] = v;
    }
  }
  return o;
}

/** Jalankan sekumpulan statement di SQLite lokal, urut seperti pipeline. */
function pipeDi(db, stmts) {
  const out = [];
  let err = "";
  for (const s of stmts) {
    if (err) { out.push({ rows: [], affected: 0 }); continue; }
    const sql = String(s.sql ?? "");
    const args = (s.args ?? []).map((a) =>
      a && typeof a === "object" && "type" in a
        ? (a.type === "integer" ? Number(a.value) : a.type === "float" ? Number(a.value) : a.value)
        : a,
    );
    try {
      const st = db.prepare(sql);
      if (/^\s*(select|with|pragma|explain)/i.test(sql)) {
        // Bilangan bulat di atas 2^53 tidak bisa dibaca sebagai angka JavaScript
        // biasa: node:sqlite melempar galat "Value is too large to be represented
        // as a JavaScript number", dan satu baris besar saja membuat SELURUH daftar
        // (seller, staf) gagal tampil. Jadi dibaca sebagai BigInt lalu diubah:
        // angka aman tetap number, angka raksasa dibatasi ke batas aman.
        st.setReadBigInts(true);
        out.push({ rows: st.all(...args).map(amankanBaris), affected: 0 });
      } else {
        const r = st.run(...args);
        out.push({ rows: [], affected: Number(r.changes ?? 0) });
      }
    } catch (e) {
      if (!err) err = String(e?.message ?? e);
      out.push({ rows: [], affected: 0 });
    }
  }
  if (err) throw new Error(err);
  return out;
}


// ---------- Pembuatan tabel yang belum ada ----------
// Dompet Rezo sudah punya tabel-tabel ini dari dulu, sedangkan dompet Viza
// dipasang baru di SQLite kosong. Tanpa blok ini setiap aksi panel berakhir
// "server error" karena tabelnya tidak ada. Dibuat sekali per proses.
let tabelSiap = false;
async function siapTabel(env) {
  if (tabelSiap) return;
  await pipe(env, [
    { sql: "create table if not exists panel_staf (uid text not null, role text not null, manager text, active integer not null default 1, created_at integer not null default 0, coins integer not null default 0, primary key (uid, role))" },
    { sql: "create table if not exists panel_stock (owner_uid text not null, item_id text not null, kind text, name text, days integer not null default 0, created_at integer not null default 0, primary key (owner_uid, item_id))" },
    { sql: "create table if not exists panel_ban (uid text primary key, oleh text, manager text, reason text, at integer)" },
    { sql: "create table if not exists panel_log (id text primary key, oleh text, aksi text, target text, jumlah integer, at integer)" },
    { sql: "create table if not exists pay_info (id integer primary key, dana text, nama text, gopay text, qris text, updated_at integer)" },
    { sql: "create table if not exists topup_manual (id text primary key, uid text, coins integer, amount integer, payer text, method text, status text, created_at integer)" },
    { sql: "create table if not exists money_tx (uid text, kind text, item_id text, amount integer, room_id text, created_at integer)" },
    { sql: "create table if not exists exchange_req (req_id text primary key, uid text, at integer)" },
    { sql: "create table if not exists gift_req (req_id text primary key, uid text, at integer)" },
    { sql: "create table if not exists vip_req (req_id text primary key, uid text, at integer)" },
    { sql: "create table if not exists topup_req (req_id text primary key, uid text, at integer)" },
    { sql: "create table if not exists hive_order (order_id text primary key, uid text, kind text, amount integer, round_id text, game text, at integer)" },
    { sql: "create table if not exists wave_players (uid text primary key, name text, avatar text, updated_at integer)" },
  ]);
  tabelSiap = true;
}

async function pipe(env, stmts) {
  let db;
  try {
    db = await dbLokal(env);
  } catch (e) {
    throw new Error("Database lokal tidak bisa dibuka: " + String(e?.message ?? e));
  }
  return pipeDi(db, stmts);
}


/**
 * Jalankan transaksi (begin ... commit) dengan percobaan ulang.
 * Kalau "begin immediate" bentrok karena database sedang sibuk, statement
 * berikutnya berjalan tanpa transaksi dan "commit" gagal dengan pesan
 * "cannot commit - no transaction is active". Pesan itu menyesatkan, jadi
 * di sini: bersihkan sisa transaksi, tunggu sebentar, lalu ulangi.
 */
async function pipeTrx(env, stmts, percobaan = 4) {
  let galatTerakhir = null;
  for (let i = 0; i < percobaan; i++) {
    try {
      return await pipe(env, stmts);
    } catch (e) {
      galatTerakhir = e;
      const pesan = String(e?.message ?? e);
      try { await pipe(env, [{ sql: "rollback" }]); } catch (e2) { /* tidak ada transaksi aktif */ }
      const bisaUlang = /no transaction is active|database is locked|busy|SQLITE_BUSY|cannot start a transaction/i.test(pesan);
      if (!bisaUlang) throw e;
      await new Promise((r) => setTimeout(r, 150 * (i + 1) + Math.floor(Math.random() * 120)));
    }
  }
  const asli = String(galatTerakhir?.message ?? galatTerakhir);
  if (/no transaction is active/i.test(asli)) {
    throw new Error("Server sedang sibuk, coba lagi sebentar");
  }
  throw galatTerakhir;
}

// ---------- Verifikasi token login Firebase ----------
let jwks = { keys: [], at: 0 };

// Kunci publik Firebase. Kalau Google lambat atau menolak, kunci lama tetap
// dipakai - lebih baik verifikasi dengan kunci lama daripada semua user
// mendadak dianggap "Sesi tidak sah" dan dompetnya tampil 0.
async function ambilJwks() {
  const now = Date.now();
  if (jwks.keys.length && now - jwks.at < 6 * 3600_000) return jwks;
  try {
    const r = await fetch(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) throw new Error("jwks http " + r.status);
    const j = await r.json();
    const keys = j.keys ?? [];
    if (!keys.length) throw new Error("jwks kosong");
    jwks = { keys, at: now };
  } catch (e) {
    jwks = { keys: jwks.keys, at: now - 6 * 3600_000 + 60_000 };
  }
  return jwks;
}

async function kunci(kid) {
  let k = await ambilJwks();
  let found = k.keys.find((x) => x.kid === kid) ?? null;
  if (!found) {
    // Kunci bisa berganti: paksa ambil sekali lagi sebelum menolak token.
    jwks = { keys: [], at: 0 };
    k = await ambilJwks();
    found = k.keys.find((x) => x.kid === kid) ?? null;
  }
  return found;
}

function b64d(s) {
  const n = s.replace(/-/g, "+").replace(/_/g, "/");
  const p = n + "=".repeat((4 - (n.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}

/** Kembalikan {uid, email} kalau token sah, null kalau tidak. */
function klaimUid(token) {
  try {
    const c = String(token || "").split(".")[1];
    if (!c) return "";
    const body = JSON.parse(new TextDecoder().decode(b64d(c)));
    return String(body.sub ?? body.user_id ?? "");
  } catch { return ""; }
}

let sesiAlasan = "";
// Token LiveKit buatan sendiri (HS256), tanpa paket tambahan.
async function jwtLiveKit(klaim, rahasia) {
  const b64u = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
  const kepala = b64u({ alg: "HS256", typ: "JWT" });
  const isi = b64u(klaim);
  const data = kepala + "." + isi;
  const enc = new TextEncoder();
  const kunci = await globalThis.crypto.subtle.importKey("raw", enc.encode(rahasia), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await globalThis.crypto.subtle.sign("HMAC", kunci, enc.encode(data));
  return data + "." + Buffer.from(sig).toString("base64url");
}

async function sesiDariToken(token) {
  try {
    const [h, c, s] = token.split(".");
    if (!h || !c || !s) { sesiAlasan = "token tidak lengkap"; return null; }
    const head = JSON.parse(new TextDecoder().decode(b64d(h)));
    const jwk = await kunci(head.kid);
    if (!jwk) { sesiAlasan = "kunci kid tidak ada: " + String(head.kid); return null; }
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64d(s),
      new TextEncoder().encode(`${h}.${c}`),
    );
    if (!ok) { sesiAlasan = "tanda tangan tidak cocok"; return null; }
    const body = JSON.parse(new TextDecoder().decode(b64d(c)));
    const now = Math.floor(Date.now() / 1000);
    if (!PROJ_SAH.includes(String(body.aud))) { sesiAlasan = "aud beda: " + String(body.aud); return null; }
    if (String(body.iss) !== `https://securetoken.google.com/${String(body.aud)}`) { sesiAlasan = "iss beda"; return null; }
    if (Number(body.exp ?? 0) <= now) { sesiAlasan = "token kadaluarsa"; return null; }
    const uid = String(body.sub ?? body.user_id ?? "");
    if (!uid) return null;
    return { uid, email: String(body.email ?? "") };
  } catch (e) {
    sesiAlasan = "galat verifikasi: " + String(e?.message ?? e);
    return null;
  }
}

/** uid saja, dipakai jalur dompet. */
const uidDariToken = async (token) => (await sesiDariToken(token))?.uid ?? null;

// ---------- Bentuk jawaban ----------
const ok = (w) => json({ ok: 1, w: w ?? null });
const gagal = (e) => json({ ok: 0, e });
// Panel developer (exbottod.github.io) memanggil dari browser, jadi wajib ada header CORS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, accept, x-user-id, x-display-name",
  "Access-Control-Max-Age": "86400",
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const KOLOM =
  "uid, coins, diamonds, exp, vip, vip_until, lv_claimed, inv, equip";

function rapikan(r) {
  if (!r) return null;
  let inv = {}, eq = {};
  try { inv = JSON.parse(r.inv || "{}"); } catch { /* biarkan kosong */ }
  try { eq = JSON.parse(r.equip || "{}"); } catch { /* biarkan kosong */ }
  return {
    uid: r.uid,
    coins: r.coins ?? 0,
    diamonds: r.diamonds ?? 0,
    exp: r.exp ?? 0,
    vip: r.vip ?? 0,
    vipUntil: r.vip_until ?? 0,
    lvClaimed: r.lv_claimed ?? 0,
    inv,
    equip: eq,
  };
}

const saldo = (env, uid) =>
  pipe(env, [{ sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] }]);

async function pastikan(env, uid) {
  const r = await saldo(env, uid);
  if (r[0].rows.length) return rapikan(r[0].rows[0]);
  await pipe(env, [
    { sql: "insert or ignore into wallets (uid) values (?)", args: [T(uid)] },
  ]);
  const r2 = await saldo(env, uid);
  return rapikan(r2[0].rows[0]);
}


// ---------- Coin seller ----------
// Penjual coin resmi: didaftarkan developer, punya stok sendiri, dan muncul di
// halaman seller pada Dompet. Stok hanya bisa diisi developer.
let siapSel = false;
async function siapSeller(env) {
  if (siapSel) return;
  await pipe(env, [
    { sql: `create table if not exists coin_seller (
        uid text primary key,
        store text not null default '',
        wa text not null default '',
        wa_link text not null default '',
        photo text not null default '',
        stock integer not null default 0,
        active integer not null default 1,
        urut integer not null default 0,
        created_at integer not null default (unixepoch() * 1000),
        updated_at integer not null default (unixepoch() * 1000))` },
    { sql: `create table if not exists seller_tx (
        id integer primary key autoincrement,
        seller text not null,
        buyer text not null,
        coins integer not null default 0,
        note text not null default '',
        req text not null default '',
        created_at integer not null default (unixepoch() * 1000))` },
    { sql: `create unique index if not exists seller_tx_req on seller_tx(req)` },
    { sql: `create table if not exists seller_req (req text primary key, at integer not null default 0)` },
  ]);
  siapSel = true;
}

// ---------- Agensi ----------
// Agensi mengumpulkan host. Setiap gift yang diterima host dicatat sebagian
// kecil (rate agensi) sebagai komisi agensi. Perhitungan dilakukan di server,
// bukan di aplikasi, supaya tidak bisa dipalsukan dari HP.
let siapAg = false;
async function siapAgency(env) {
  if (siapAg) return;
  await pipe(env, [
    { sql: `create table if not exists agency (
        id text primary key,
        nama text not null default '',
        owner_uid text not null default '',
        kode text not null default '',
        rate integer not null default 10,
        aktif integer not null default 1,
        saldo integer not null default 0,
        created_at integer not null default (unixepoch() * 1000))` },
    { sql: `create unique index if not exists agency_kode on agency(kode)` },
    { sql: `create table if not exists agency_host (
        host_uid text primary key,
        agency_id text not null,
        aktif integer not null default 1,
        sejak integer not null default (unixepoch() * 1000))` },
    { sql: `create table if not exists agency_earn (
        agency_id text not null,
        bulan text not null,
        coins integer not null default 0,
        primary key (agency_id, bulan))` },
    { sql: `create table if not exists agency_req (
        id integer primary key autoincrement,
        agency_id text not null,
        coins integer not null default 0,
        status text not null default 'menunggu',
        at integer not null default (unixepoch() * 1000),
        oleh text not null default '')` },
  ]);
  siapAg = true;
}

/** Bulan berjalan sebagai teks "2026-11" untuk mengelompokkan komisi. */
function bulanIni(t = Date.now()) {
  const d = new Date(t);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

/** Kode undangan agensi: 6 huruf/angka besar, mudah dibaca ulang. */
function kodeAgensi() {
  const abjad = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += abjad[Math.floor(Math.random() * abjad.length)];
  return s;
}

/**
 * Catat komisi agensi untuk satu penerima gift. Gagal mencatat TIDAK boleh
 * menggagalkan gift, jadi semua galat ditelan di sini.
 */
async function catatKomisiAgency(env, hostUid, nilaiCoin, now) {
  try {
    const nilai = Math.trunc(Number(nilaiCoin) || 0);
    if (nilai <= 0) return;
    await siapAgency(env);
    const r = await pipe(env, [
      {
        sql: `select h.agency_id, a.rate from agency_host h
              join agency a on a.id = h.agency_id
              where h.host_uid = ? and h.aktif = 1 and a.aktif = 1`,
        args: [T(hostUid)],
      },
    ]);
    const row = r[0].rows[0];
    if (!row) return;
    const rate = Math.max(0, Math.min(100, Number(row.rate) || 0));
    const komisi = Math.floor((nilai * rate) / 100);
    if (komisi <= 0) return;
    const bulan = bulanIni(now);
    await pipeTrx(env, [
      { sql: "begin immediate" },
      {
        sql: `insert into agency_earn (agency_id, bulan, coins) values (?, ?, ?)
              on conflict (agency_id, bulan) do update set coins = coins + excluded.coins`,
        args: [T(row.agency_id), T(bulan), I(komisi)],
      },
      { sql: "update agency set saldo = saldo + ? where id = ?", args: [I(komisi), T(row.agency_id)] },
      { sql: "commit" },
    ]);
  } catch (e) { /* komisi opsional: jangan ganggu gift */ }
}

const KOLOM_SELLER = `s.uid, s.store, s.wa, s.wa_link, s.stock, s.urut, s.active,
  coalesce(nullif(s.photo, ''), (select avatar from wave_players w where w.uid = s.uid), '') as photo`;

async function daftarSeller(env, hanyaAktif) {
  await siapSeller(env);
  const batas = Date.now() - 3 * 24 * 3600 * 1000;
  const r = await pipe(env, [
    {
      sql: `select ${KOLOM_SELLER},
                   (select count(*) from seller_tx t
                     where t.seller = s.uid and t.created_at >= ?) as pesanan
            from coin_seller s
            ${hanyaAktif ? "where s.active = 1" : ""}
            order by s.urut desc, s.created_at asc limit 200`,
      args: [I(batas)],
    },
  ]);
  return r[0].rows;
}

async function satuSeller(env, uid) {
  await siapSeller(env);
  const batas = Date.now() - 3 * 24 * 3600 * 1000;
  const r = await pipe(env, [
    {
      sql: `select ${KOLOM_SELLER},
                   (select count(*) from seller_tx t
                     where t.seller = s.uid and t.created_at >= ?) as pesanan
            from coin_seller s where s.uid = ?`,
      args: [I(batas), T(uid)],
    },
  ]);
  return r[0].rows[0] ?? null;
}

/** Seller mengirim coin ke user. Stok seller berkurang, saldo user bertambah. */
async function sellerKirim(env, uid, p) {
  await siapSeller(env);
  const to = String(p.to ?? "").trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(to)) return gagal("User ID tujuan tidak valid");
  if (/^[0-9]+$/.test(to)) return gagal("Pakai UID akun, bukan ID angka");
  if (to === uid) return gagal("Tidak bisa mengirim ke diri sendiri");
  const coins = Math.trunc(Number(p.coins ?? 0));
  if (!(coins > 0)) return gagal("Jumlah coin tidak valid");
  if (coins > 10000000000000) return gagal("Jumlah coin terlalu besar");
  const req = String(p.req ?? `s-${uid}-${Date.now()}`);
  const note = String(p.note ?? "").slice(0, 120);
  const now = Date.now();

  const r = await pipe(env, [
    { sql: "begin immediate" },
    { sql: "insert or ignore into wallets (uid) values (?)", args: [T(to)] },
    {
      sql: `update coin_seller set stock = stock - ?, updated_at = ?
            where uid = ? and active = 1 and stock >= ?
              and not exists (select 1 from seller_req where req = ?)`,
      args: [I(coins), I(now), T(uid), I(coins), T(req)],
    },
    { sql: "insert into seller_req (req, at) select ?, ? where changes() > 0", args: [T(req), I(now)] },
    {
      sql: `insert into seller_tx (seller, buyer, coins, note, req, created_at)
            select ?, ?, ?, ?, ?, ? where changes() > 0`,
      args: [T(uid), T(to), I(coins), T(note), T(req), I(now)],
    },
    {
      sql: `update wallets set coins = coins + ?, updated_at = ? where uid = ? and changes() > 0`,
      args: [I(coins), I(now), T(to)],
    },
    {
      sql: `insert into money_tx (uid, kind, amount, created_at)
            select ?, 'seller_in', ?, ? where changes() > 0`,
      args: [T(to), I(coins), I(now)],
    },
    { sql: "select stock from coin_seller where uid = ?", args: [T(uid)] },
    { sql: "select coins from wallets where uid = ?", args: [T(to)] },
    { sql: "commit" },
  ]);
  const sisa = Number(r[7].rows[0]?.stock ?? 0);
  const saldoBaru = Number(r[8].rows[0]?.coins ?? 0);
  if (Number(r[4].affected ?? 0) > 0) {
    return json({ ok: 1, stok: sisa, coins: saldoBaru, terkirim: coins });
  }
  const cek = await pipe(env, [{ sql: "select 1 as ada from seller_req where req = ?", args: [T(req)] }]);
  if (cek[0].rows.length) return json({ ok: 1, stok: sisa, coins: saldoBaru, terkirim: 0, ulang: 1 });
  const s2 = await satuSeller(env, uid);
  if (!s2 || !Number(s2.active)) return gagal("Akun ini bukan coin seller aktif");
  return gagal(`Stok coin habis. Sisa ${Number(s2.stock ?? 0).toLocaleString("id-ID")} coin.`);
}

/** Endpoint /seller: halaman seller di Dompet dan panel seller di Profil. */
async function sellerApi(env, sesi, body) {
  const uid = sesi.uid;
  const p = body.p ?? {};
  const a = String(body.a ?? p.a ?? "");
  if (a === "list") {
    const rows = await daftarSeller(env, true);
    return json({ ok: 1, seller: rows });
  }
  if (a === "me") {
    const foto = String(p.photo ?? "").trim();
    const nama = String(p.nama ?? "").trim();
    if (foto || nama) {
      try {
        await pipe(env, [
          {
            sql: `update coin_seller set
                    photo = case when ? <> '' then ? else photo end,
                    store = case when ? <> '' then ? else store end,
                    updated_at = ?
                  where uid = ?`,
            args: [T(foto), T(foto), T(nama), T(nama), I(Date.now()), T(uid)],
          },
        ]);
      } catch { /* foto gagal disimpan tidak boleh menghalangi panel */ }
    }
    const me = await satuSeller(env, uid);
    if (!me) return json({ ok: 0, e: "Bukan coin seller", seller: null });
    return json({ ok: 1, seller: me });
  }
  if (a === "send") return await sellerKirim(env, uid, p);
  if (a === "hist") {
    await siapSeller(env);
    const r = await pipe(env, [
      {
        sql: `select buyer, coins, note, created_at from seller_tx
              where seller = ? order by created_at desc limit 50`,
        args: [T(uid)],
      },
    ]);
    return json({ ok: 1, riwayat: r[0].rows });
  }
  return gagal(`aksi seller ${a} tidak dikenal`);
}

// ---------- Aksi dompet ----------
async function kirimGift(env, uid, p) {
  await pastikan(env, uid);
  const price = Math.trunc(Number(p.price ?? 0));
  if (price <= 0) return gagal("Gift tidak valid");
  const req = String(p.req ?? `g-${uid}-${Date.now()}`);
  const now = Date.now();
  const item = p.itemId != null ? String(p.itemId) : null;
  const room = p.roomId != null ? String(p.roomId) : null;

  // Satu transaksi: potong coin, tambah diamond dan exp (bonus VIP),
  // lalu catat. Penanda req membuat pengulangan tidak memotong dua kali.
  const r = await pipeTrx(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set
              coins      = coins - ?,
              diamonds   = diamonds + ?,
              exp        = exp + (? * (case when vip between 1 and 9 and vip_until > ?
                                            then 100 + 5 * vip else 100 end)) / 100,
              updated_at = ?
            where uid = ? and coins >= ?
              and not exists (select 1 from gift_req where req_id = ?)`,
      args: [I(price), I(price), I(price), I(now), I(now), T(uid), I(price), T(req)],
    },
    {
      sql: "insert into gift_req (req_id, uid, at) select ?, ?, ? where changes() > 0",
      args: [T(req), T(uid), I(now)],
    },
    {
      sql: `insert into money_tx (uid, kind, item_id, amount, room_id, created_at)
            select ?, 'gift', ?, ?, ?, ? where changes() > 0`,
      args: [T(uid), item, I(price), room, I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);

  const berubah = r[1].affected > 0;
  const w = rapikan(r[4].rows[0]);
  if (berubah) {
    // PENERIMA: aplikasi mengirim daftar uid penerima (p.to) dan nilai per
    // penerima (p.each). Dulu daftar itu diabaikan, jadi diamond hanya masuk
    // ke pengirim dan penerima tidak pernah menerima apa pun (halaman Tukar
    // Berlian mereka tetap 0, terutama setelah akun direset). Sekarang setiap
    // penerima dicatat sendiri, tetap aman diulang lewat penanda req.
    await kreditPenerima(env, uid, p, price, item, room, now, req);
    return ok(w);
  }
  // Tidak berubah: bisa karena coin kurang atau permintaan sudah diproses.
  const cek = await pipeTrx(env, [
    { sql: "select 1 as ada from gift_req where req_id = ?", args: [T(req)] },
  ]);
  if (cek[0].rows.length) return ok(w); // sudah pernah diproses: aman
  return gagal("Coin tidak cukup. Tekan Topup");
}

/**
 * Tambahkan diamond ke setiap penerima gift. Nilai per penerima diambil dari
 * p.each (harga gift x jumlah ketukan); kalau tidak dikirim, dibagi rata.
 * Satu penerima gagal tidak menggagalkan penerima lain maupun pengirim.
 */
async function kreditPenerima(env, uid, p, price, item, room, now, req) {
  const daftar = Array.isArray(p.to) ? p.to.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  const unik = [...new Set(daftar)].filter((u) => u && u !== uid);
  if (!unik.length) return;
  let each = Math.trunc(Number(p.each ?? 0));
  if (!(each > 0)) each = Math.floor(price / unik.length);
  if (!(each > 0)) return;
  for (const r of unik) {
    try {
      await pastikan(env, r);
      const tanda = `${req}:to:${r}`;
      await pipeTrx(env, [
        { sql: "begin immediate" },
        {
          sql: `update wallets set
                  diamonds   = diamonds + ?,
                  exp        = exp + (? * (case when vip between 1 and 9 and vip_until > ?
                                                then 100 + 5 * vip else 100 end)) / 100,
                  updated_at = ?
                where uid = ?
                  and not exists (select 1 from gift_req where req_id = ?)`,
          args: [I(each), I(each), I(now), I(now), T(r), T(tanda)],
        },
        {
          sql: "insert into gift_req (req_id, uid, at) select ?, ?, ? where changes() > 0",
          args: [T(tanda), T(r), I(now)],
        },
        {
          sql: `insert into money_tx (uid, kind, item_id, amount, room_id, created_at)
                select ?, 'gift_in', ?, ?, ?, ? where changes() > 0`,
          args: [T(r), item, I(each), room, I(now)],
        },
        { sql: "commit" },
      ]);
      // Komisi agensi dihitung dari nilai gift yang diterima host.
      await catatKomisiAgency(env, r, each, now);
    } catch (e) {
      try { await pipe(env, [{ sql: "rollback" }]); } catch (e2) { /* tidak ada transaksi aktif */ }
    }
  }
  // Segarkan profil penerima supaya angka berlian di layar Tukar langsung naik.
  try {
    const pendengar = env.GIFT_PUSH;
    if (typeof pendengar === "function") await pendengar(unik);
  } catch (e) { /* opsional */ }
}

async function topup(env, uid, p) {
  await pastikan(env, uid);
  const coins = Math.trunc(Number(p.coins ?? 0));
  if (coins <= 0) return gagal("Jumlah tidak valid");
  const req = String(p.req ?? `t-${uid}-${Date.now()}`);
  const now = Date.now();
  const r = await pipe(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set coins = coins + ?, updated_at = ?
            where uid = ? and not exists (select 1 from topup_req where req_id = ?)`,
      args: [I(coins), I(now), T(uid), T(req)],
    },
    {
      sql: "insert into topup_req (req_id, uid, at) select ?, ?, ? where changes() > 0",
      args: [T(req), T(uid), I(now)],
    },
    {
      sql: `insert into money_tx (uid, kind, amount, created_at)
            select ?, 'topup', ?, ? where changes() > 0`,
      args: [T(uid), I(coins), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);
  return r[1].affected > 0 ? ok(rapikan(r[4].rows[0])) : ok(rapikan(r[4].rows[0]));
}

/** Hadiah cek in harian: sekali per tanggal, tidak bisa dobel. */
async function klaimSignin(env, uid, p) {
  const coins = Math.trunc(Number(p.coins ?? 0));
  const date = String(p.date ?? "").slice(0, 10);
  if (!(coins > 0) || coins > 500000000) return gagal("Jumlah hadiah cek in tidak valid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return gagal("Tanggal cek in tidak valid");
  await pastikan(env, uid);
  const req = `signin-${uid}-${date}`;
  const now = Date.now();
  const r = await pipe(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set coins = coins + ?, updated_at = ?
            where uid = ? and not exists (select 1 from topup_req where req_id = ?)`,
      args: [I(coins), I(now), T(uid), T(req)],
    },
    {
      sql: "insert into topup_req (req_id, uid, at) select ?, ?, ? where changes() > 0",
      args: [T(req), T(uid), I(now)],
    },
    {
      sql: `insert into money_tx (uid, kind, amount, created_at)
            select ?, 'signin', ?, ? where changes() > 0`,
      args: [T(uid), I(coins), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);
  return ok(rapikan(r[4].rows[0]));
}

async function tukar(env, uid, p) {
  await pastikan(env, uid);
  const d = Math.trunc(Number(p.diamonds ?? 0));
  if (d <= 0) return gagal("Jumlah tidak valid");
  const req = String(p.req ?? `x-${uid}-${Date.now()}`);
  const now = Date.now();
  const gain = Math.floor(d / 2);
  const r = await pipe(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set diamonds = diamonds - ?, coins = coins + ?, updated_at = ?
            where uid = ? and diamonds >= ?
              and not exists (select 1 from exchange_req where req_id = ?)`,
      args: [I(d), I(gain), I(now), T(uid), I(d), T(req)],
    },
    {
      sql: "insert into exchange_req (req_id, uid, at) select ?, ?, ? where changes() > 0",
      args: [T(req), T(uid), I(now)],
    },
    {
      sql: `insert into money_tx (uid, kind, amount, created_at)
            select ?, 'tukar', ?, ? where changes() > 0`,
      args: [T(uid), I(gain), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);
  if (r[1].affected > 0) return ok(rapikan(r[4].rows[0]));
  const cek = await pipe(env, [
    { sql: "select 1 as ada from exchange_req where req_id = ?", args: [T(req)] },
  ]);
  if (cek[0].rows.length) return ok(rapikan(r[4].rows[0]));
  return gagal("Diamond tidak cukup");
}

/** Bet/win dari game Hive. kind 1 = bet (potong), 2 = win (tambah). */
async function hiveUang(env, uid, p) {
  await pastikan(env, uid);
  const kind = Math.trunc(Number(p.kind ?? 0));
  const amount = Math.trunc(Number(p.amount ?? 0));
  const oid = String(p.orderId ?? "");
  if (!oid || amount <= 0) return gagal("order tidak valid");
  const delta = kind === 1 ? -amount : amount;
  const now = Date.now();
  const r = await pipe(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set coins = coins + ?, updated_at = ?
            where uid = ? and (? > 0 or coins >= ?)
              and not exists (select 1 from hive_order where order_id = ?)`,
      args: [I(delta), I(now), T(uid), I(delta), I(amount), T(oid)],
    },
    {
      sql: `insert into hive_order (order_id, uid, kind, amount, round_id, game, at)
            select ?, ?, ?, ?, ?, ?, ? where changes() > 0`,
      args: [T(oid), T(uid), I(kind), I(amount), T(String(p.roundId ?? "")), T(String(p.game ?? "")), I(now)],
    },
    {
      sql: `insert into money_tx (uid, kind, amount, created_at)
            select ?, ?, ?, ? where changes() > 0`,
      args: [T(uid), kind === 1 ? T("hive_bet") : T("hive_win"), I(delta), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);
  if (r[1].affected > 0) return ok(rapikan(r[4].rows[0]));
  const cek = await pipe(env, [
    { sql: "select 1 as ada from hive_order where order_id = ?", args: [T(oid)] },
  ]);
  if (cek[0].rows.length) return ok(rapikan(r[4].rows[0])); // sudah diproses
  return gagal("Coin tidak cukup");
}


// ---------- Level dan item ----------
const expLevel = (n) => (n <= 1 ? 0 : Math.round((3932550000 * Math.pow(n / 39, 2.5)) / 10000) * 10000);

function levelDariExp(exp) {
  let l = 1;
  while (l < 250 && exp >= expLevel(l + 1)) l++;
  return l;
}

let HARGA_VIP = [0, 500000, 1500000, 3000000, 6000000, 12000000, 25000000, 50000000, 100000000, 250000000];
// Harga VIP bisa diubah dari panel developer. Disimpan di berkas sendiri supaya
// tidak perlu build APK baru; app membaca angkanya dari /vip-harga.
const HARGA_VIP_FILE = "/opt/viza-api/harga-vip.json";
async function hargaVipKini() {
  try {
    const fsp = await import("node:fs/promises");
    const t = await fsp.readFile(HARGA_VIP_FILE, "utf8");
    const a = JSON.parse(t);
    if (Array.isArray(a) && a.length === 10) HARGA_VIP = a.map((x) => Number(x) || 0);
  } catch (e) { /* berkas belum ada: pakai bawaan */ }
  return HARGA_VIP;
}
async function hargaVipSimpan(a) {
  HARGA_VIP = [0, ...a.map((x) => Math.round(Number(x) || 0))];
  const fsp = await import("node:fs/promises");
  await fsp.writeFile(HARGA_VIP_FILE, JSON.stringify(HARGA_VIP), "utf8");
  return HARGA_VIP;
}
const BULAN = 30 * 86400000;
const AWALAN_VIP = ["vipt_", "vipf_", "vipb_", "vipe_", "vipbn_"];

/** Beli VIP: coin dipotong, item VIP 1..tier masuk My Item, level naik kalau lebih tinggi. */
async function beliVip(env, uid, p) {
  const tier = Math.trunc(Number(p.tier ?? 0));
  if (!(tier >= 1 && tier <= 9)) return gagal("Level VIP tidak valid");
  await hargaVipKini();
  const harga = HARGA_VIP[tier];
  const now = Date.now();
  const req = String(p.req ?? `v-${uid}-${tier}-${now}`);
  const w0 = await pastikan(env, uid);
  if (w0.coins < harga) return gagal("Coin tidak cukup. Tekan Topup");

  const aktif = w0.vip >= 1 && w0.vip <= 9 && w0.vipUntil > now;
  const lama = Number(w0.inv?.[`vipt_${tier}`] ?? 0);
  const vuntil = (lama > now ? lama : now) + BULAN;

  const inv = { ...w0.inv };
  for (let i = 1; i <= tier; i++) for (const a of AWALAN_VIP) inv[`${a}${i}`] = vuntil;

  const eq = { ...w0.equip };
  let vip = w0.vip, vipUntil = w0.vipUntil;
  if (tier > w0.vip || !aktif) { vip = tier; vipUntil = vuntil; }
  else if (tier === w0.vip) { vipUntil = vuntil; }
  if (tier >= w0.vip || !aktif) {
    eq.frame = `vipf_${tier}`;
    if (!eq.bubble || /^vipb_/.test(eq.bubble)) eq.bubble = `vipb_${tier}`;
    if (!eq.entry || /^vipe_/.test(eq.entry)) eq.entry = `vipe_${tier}`;
    if (!eq.banner || /^vipbn_/.test(eq.banner)) eq.banner = `vipbn_${tier}`;
  }

  const r = await pipeTrx(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set coins = coins - ?, vip = ?, vip_until = ?, inv = ?, equip = ?, updated_at = ?
            where uid = ? and coins >= ? and not exists (select 1 from vip_req where req_id = ?)`,
      args: [I(harga), I(vip), I(vipUntil), T(JSON.stringify(inv)), T(JSON.stringify(eq)), I(now), T(uid), I(harga), T(req)],
    },
    { sql: "insert into vip_req (req_id, uid, at) select ?, ?, ? where changes() > 0", args: [T(req), T(uid), I(now)] },
    {
      sql: `insert into money_tx (uid, kind, item_id, amount, created_at)
            select ?, 'buy_vip', ?, ?, ? where changes() > 0`,
      args: [T(uid), T("vip" + tier), I(harga), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);
  return ok(rapikan(r[4].rows[0]));
}

/** Beli item store: masa aktif ditambah dari sisa yang masih ada. */
async function beliItem(env, uid, p) {
  const id = String(p.itemId ?? "");
  const harga = Math.trunc(Number(p.price ?? 0));
  const hari = Math.trunc(Number(p.days ?? 0));
  if (!id) return gagal("Item tidak valid");
  if (hari <= 0) return gagal("Masa aktif item tidak valid");
  const now = Date.now();
  const w0 = await pastikan(env, uid);
  if (w0.coins < harga) return gagal("Coin tidak cukup. Tekan Topup");
  const lama = Number(w0.inv?.[id] ?? 0);
  const akhir = Math.max(now, lama) + hari * 86400000;
  const inv = { ...w0.inv, [id]: akhir };
  const r = await pipeTrx(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set coins = coins - ?, inv = ?, updated_at = ?
            where uid = ? and coins >= ?`,
      args: [I(harga), T(JSON.stringify(inv)), I(now), T(uid), I(harga)],
    },
    {
      sql: `insert into money_tx (uid, kind, item_id, amount, created_at)
            select ?, 'buy_item', ?, ?, ? where changes() > 0`,
      args: [T(uid), T(id), I(harga), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);
  return ok(rapikan(r[3].rows[0]));
}

/** Pasang atau lepas item: id kosong berarti lepas. */
async function pasangItem(env, uid, p) {
  const slot = String(p.slot ?? "");
  const id = String(p.itemId ?? p.id ?? "");
  if (!slot) return gagal("Slot tidak valid");
  const now = Date.now();
  const w0 = await pastikan(env, uid);
  const eq = { ...w0.equip, [slot]: id };
  const r = await pipe(env, [
    {
      sql: "update wallets set equip = ?, updated_at = ? where uid = ?",
      args: [T(JSON.stringify(eq)), I(now), T(uid)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
  ]);
  return ok(rapikan(r[1].rows[0]));
}

/** Klaim hadiah level: tiap level baru memberi 243.000 x level. */
async function klaimLevel(env, uid) {
  const now = Date.now();
  const w0 = await pastikan(env, uid);
  const lvl = levelDariExp(w0.exp);
  if (lvl <= w0.lvClaimed) return gagal("Belum ada hadiah level untuk diklaim");
  let gain = 0;
  for (let l = w0.lvClaimed + 1; l <= lvl; l++) gain += l * 243000;
  // Dijaga oleh lv_claimed lama, jadi dua permintaan bersamaan tidak dua kali cair.
  const r = await pipe(env, [
    { sql: "begin immediate" },
    {
      sql: `update wallets set coins = coins + ?, lv_claimed = ?, updated_at = ?
            where uid = ? and lv_claimed = ?`,
      args: [I(gain), I(lvl), I(now), T(uid), I(w0.lvClaimed)],
    },
    {
      sql: `insert into money_tx (uid, kind, amount, created_at)
            select ?, 'claim_level', ?, ? where changes() > 0`,
      args: [T(uid), I(gain), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
    { sql: "commit" },
  ]);
  const w = rapikan(r[3].rows[0]);
  if (r[1].affected > 0) return ok(w);
  return gagal("Hadiah level sudah diklaim");
}

/** Lengkapi item VIP yang belum masuk My Item untuk VIP yang aktif. */
async function backfillVip(env, uid) {
  const now = Date.now();
  const w0 = await pastikan(env, uid);
  if (!(w0.vip >= 1 && w0.vip <= 9 && w0.vipUntil > now)) return ok(w0);
  const inv = { ...w0.inv };
  for (let i = 1; i <= w0.vip; i++)
    for (const a of AWALAN_VIP) {
      const k = `${a}${i}`;
      if (Number(inv[k] ?? 0) < w0.vipUntil) inv[k] = w0.vipUntil;
    }
  const r = await pipe(env, [
    { sql: "update wallets set inv = ?, updated_at = ? where uid = ?", args: [T(JSON.stringify(inv)), I(now), T(uid)] },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
  ]);
  return ok(rapikan(r[1].rows[0]));
}

/** Siapkan profil pemain untuk game (nama dan avatar dipakai Hive). */
async function wavePrepare(env, uid, p) {
  const nama = String(p.name ?? "").trim();
  const avatar = String(p.avatar ?? "");
  const now = Date.now();
  await pastikan(env, uid);
  const r = await pipe(env, [
    {
      sql: `insert into wave_players (uid, name, avatar, updated_at) values (?, ?, ?, ?)
            on conflict (uid) do update set
              name   = case when excluded.name <> '' then excluded.name else wave_players.name end,
              avatar = case when excluded.avatar <> '' then excluded.avatar else wave_players.avatar end,
              updated_at = excluded.updated_at`,
      args: [T(uid), T(nama || "Player"), T(avatar), I(now)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
  ]);
  return ok(rapikan(r[1].rows[0]));
}

// ---------- Pengaturan dari Realtime Database (tanpa build aplikasi) ----------
const RTDB = "https://my-app-e7f8c-default-rtdb.asia-southeast1.firebasedatabase.app";
const ADMIN_EMAIL = "bangexx01@gmail.com";
// Email admin yang boleh memakai panel developer (Rezo dan Viza).
const ADMIN_SEMUA = [ADMIN_EMAIL];
const adalahAdmin = (s) => !!s && ADMIN_SEMUA.includes(String(s.email || "").toLowerCase());
const cache = new Map();

async function cfgRtdb(path) {
  const now = Date.now();
  const lama = cache.get(path);
  if (lama && now - lama.at < 60_000) return lama.data;
  try {
    const r = await fetch(`${RTDB}/${path}.json`);
    if (!r.ok) throw new Error("cfg " + r.status);
    const d = await r.json();
    const data = d && typeof d === "object" ? d : {};
    cache.set(path, { at: now, data });
    return data;
  } catch {
    return lama?.data ?? {};
  }
}

// ---------- Hadiah: coin, VIP, item VIP ----------
async function beriCoin(env, uid, coins, kind, itemId) {
  const n = Math.trunc(Number(coins) || 0);
  if (n <= 0) return 0;
  const now = Date.now();
  await pastikan(env, uid);
  await pipe(env, [
    { sql: "begin immediate" },
    { sql: "update wallets set coins = coins + ?, updated_at = ? where uid = ?", args: [I(n), I(now), T(uid)] },
    {
      sql: `insert into money_tx (uid, kind, item_id, amount, created_at) values (?, ?, ?, ?, ?)`,
      args: [T(uid), T(kind), itemId == null ? null : T(String(itemId)), I(n), I(now)],
    },
    { sql: "commit" },
  ]);
  return n;
}

async function beriVip(env, uid, tier, days) {
  const t = Math.trunc(Number(tier) || 0);
  if (!(t >= 1 && t <= 9) || days <= 0) return null;
  const now = Date.now();
  const w0 = await pastikan(env, uid);
  const aktif = w0.vip >= 1 && w0.vip <= 9 && w0.vipUntil > now;
  const vuntil = (aktif ? w0.vipUntil : now) + Math.trunc(Number(days)) * 86400000;
  const inv = { ...w0.inv };
  for (let i = 1; i <= t; i++) for (const a of AWALAN_VIP) inv[`${a}${i}`] = vuntil;
  const vip = Math.max(w0.vip, t);
  const r = await pipe(env, [
    {
      sql: "update wallets set vip = ?, vip_until = ?, inv = ?, updated_at = ? where uid = ?",
      args: [I(vip), I(vip >= w0.vip ? vuntil : w0.vipUntil), T(JSON.stringify(inv)), I(now), T(uid)],
    },
    { sql: `select ${KOLOM} from wallets where uid = ?`, args: [T(uid)] },
  ]);
  return rapikan(r[1].rows[0]);
}

// ---------- Roket ----------
const slotHadiah = (node, days) => {
  if (!node || typeof node !== "object") return null;
  const coins = Math.max(0, Math.floor(Number(node.coins ?? 0)));
  const vip = Math.max(0, Math.min(9, Math.floor(Number(node.vip ?? 0))));
  if (coins <= 0 && vip <= 0) return null;
  return { coins, vip, days: vip > 0 ? days : 0 };
};

function undiLevel(cfg, lv, days) {
  const node = cfg["lv" + lv];
  if (!node || typeof node !== "object") return null;
  const isi = ["r1", "r2", "r3", "r4", "r5", "r6"]
    .map((k) => slotHadiah(node[k] ?? node[k.replace("r", "p")], days))
    .filter(Boolean);
  if (!isi.length) return null;
  return isi[Math.floor(Math.random() * isi.length)];
}

function undiAny(cfg, levels, days) {
  for (const lv of levels) {
    const p = undiLevel(cfg, lv, days);
    if (p) return p;
  }
  return null;
}

/** Klaim hadiah roket: peluncur, penonton, atau papan peringkat. */
// ---------- Kartu hadiah (Props) ----------
/** Tabel kartu hadiah roket. Dibuat otomatis kalau belum ada. */
async function tabelProps(env) {
  await pipe(env, [{
    sql: "create table if not exists props (id text primary key, uid text, vip integer, days integer, src text, ts integer, used integer)",
  }]);
}
/** Simpan kartu VIP ke tas pengguna, belum aktif sampai ditekan sendiri. */
async function simpanProp(env, uid, vip, days, src) {
  await tabelProps(env);
  const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const now = Date.now();
  await pipe(env, [{
    sql: "insert into props (id, uid, vip, days, src, ts, used) values (?, ?, ?, ?, ?, ?, 0)",
    args: [T(id), T(uid), I(vip), I(days), T(src || "rocket"), I(now)],
  }]);
  return { id: id, vip: Math.trunc(vip), days: Math.trunc(days), src: src || "rocket", ts: now };
}
/** Daftar kartu yang belum dipakai. */
async function daftarProp(env, uid) {
  await tabelProps(env);
  const r = await pipe(env, [{
    sql: "select id, vip, days, src, ts from props where uid = ? and used = 0 order by ts desc limit 100",
    args: [T(uid)],
  }]);
  return r[0].rows;
}
/** Pakai kartu: masa aktif VIP dimulai saat ini. */
async function pakaiProp(env, uid, id) {
  await tabelProps(env);
  const r = await pipe(env, [{
    sql: "select id, vip, days from props where id = ? and uid = ? and used = 0",
    args: [T(id), T(uid)],
  }]);
  const row = r[0].rows[0];
  if (!row) return gagal("Kartu tidak ditemukan atau sudah dipakai");
  const w = await beriVip(env, uid, Number(row.vip), Number(row.days));
  await pipe(env, [{ sql: "update props set used = 1 where id = ?", args: [T(id)] }]);
  return ok(w);
}

async function klaimRoket(env, uid, p) {
  const mode = String(p.mode ?? "launch");
  const cfg = await cfgRtdb("pub/_rocketCfg");
  let hadiah = null;
  if (mode === "rank") {
    const rank = Math.floor(Number(p.rank ?? 99));
    const key = rank >= 1 && rank <= 4 ? "t" + rank : "t4";
    hadiah = slotHadiah((cfg.rank ?? {})[key], 30);
    if (!hadiah) {
      if (rank === 1) hadiah = { coins: 100000000, vip: 9, days: 30 };
      else if (rank === 2) hadiah = { coins: 50000000, vip: 8, days: 30 };
      else if (rank === 3) hadiah = { coins: 10000000, vip: 5, days: 30 };
      else hadiah = { coins: 10000000, vip: 0, days: 0 };
    }
  } else if (mode === "lucky") {
    hadiah = undiAny(cfg, [1, 2, 3], 7) ?? { coins: 500000, vip: 0, days: 0 };
  } else {
    const lv = Math.max(1, Math.min(5, Math.floor(Number(p.lv ?? 5))));
    hadiah = undiLevel(cfg, lv, 30) ?? undiAny(cfg, [5, 4, 3, 2, 1], 30) ?? { coins: 10000000, vip: 0, days: 0 };
  }
  await beriCoin(env, uid, hadiah.coins, "rocket", null);
  // Kartu VIP tidak langsung aktif: disimpan ke Props supaya pengguna sendiri
  // yang memilih kapan memakainya. Coin tetap masuk otomatis.
  let kartu = null;
  if (hadiah.vip > 0 && hadiah.days > 0) {
    if (p.hold) kartu = await simpanProp(env, uid, hadiah.vip, hadiah.days, "rocket");
    else await beriVip(env, uid, hadiah.vip, hadiah.days);
  }
  const w = await pastikan(env, uid);
  return json({ ok: 1, coins: hadiah.coins, vip: hadiah.vip, days: hadiah.days, card: kartu, w, img: "", eff: "", badge: "" });
}

// ---------- Cashback gift ----------
const CB_LADDER = [10000, 9000, 8000, 6000, 4000, 3000, 2000, 1000, 888, 666, 500, 400, 300, 200, 100, 88, 66, 50, 30, 20, 10];

/** Bulatkan ke 2 angka penting (mis. 200.000.000 tetap, 173.456 -> 170.000). */
function bulat2(v) {
  if (!(v > 0)) return 0;
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / p) * p;
}

/**
 * Pecah total cashback menjadi beberapa angka yang JUMLAHNYA TEPAT sama dengan
 * total (mis. 100.000 x 10.000 = 1.000.000.000). Maksimal 5 pecahan supaya
 * animasinya ringan. Bagian terakhir menutup selisih pembulatan.
 */
function pecahCashback(total) {
  const n = Math.floor(total);
  if (!(n > 0)) return [];
  if (n <= 50000) {
    // Total kecil tetap memakai angka cantik yang tersedia di aplikasi.
    const out = [];
    let sisa = n, jaga = 0;
    while (sisa >= 10 && out.length < 5 && jaga++ < 16) {
      const v = CB_LADDER.find((x) => x <= sisa);
      if (!v) break;
      out.push(v);
      sisa -= v;
    }
    if (sisa > 0 && out.length) out[out.length - 1] += sisa;
    return out;
  }
  const jumlah = n >= 100000000 ? 3 : 5;
  const out = [];
  let sisa = n;
  for (let i = 0; i < jumlah - 1; i++) {
    const v = Math.max(10, bulat2(Math.floor(sisa / (jumlah - i))));
    out.push(v);
    sisa -= v;
  }
  out.push(sisa);
  return out.filter((v) => v > 0);
}

function undiBaris(rows) {
  const total = rows.reduce((a, b) => a + b.w, 0);
  if (total <= 0) return rows[rows.length - 1];
  let x = Math.random() * total;
  for (const r of rows) {
    x -= r.w;
    if (x <= 0) return r;
  }
  return rows[rows.length - 1];
}

function barisTier(cfg, value) {
  let best = [], minBest = -1;
  for (const k of ["t1", "t2", "t3", "t4"]) {
    const node = cfg[k];
    if (!node || typeof node !== "object") continue;
    const min = Math.floor(Number(node.min ?? 0));
    const rows = (Array.isArray(node.rows) ? node.rows : [])
      .map((r) => ({ v: Math.max(0, Math.floor(Number(r?.v ?? 0))), w: Math.max(0, Number(r?.w ?? 0)) }))
      .filter((r) => r.w > 0);
    if (!rows.length) continue;
    if (value >= min && min >= minBest) { best = rows; minBest = min; }
  }
  return best.length ? best : [{ v: 0, w: 100 }];
}

/** Undian cashback: pengirim dapat pengali, penerima dapat persen bonus. */
// Nilai cadangan kalau pengaturan panel tidak terbaca (mis. aturan database
// menolak akses tanpa login). Tanpa ini pengali jadi 0 dan pecahan cashback
// tidak pernah muncul di layar.
const CB_DEFAULT = {
  on: true,
  t1: { min: 0, rows: [{ v: 1, w: 60 }, { v: 2, w: 25 }, { v: 3, w: 10 }, { v: 5, w: 5 }] },
  recvPct: 5,
  jpMin: 1000,
};

async function cashbackGift(env, uid, p) {
  let cfg = await cfgRtdb("pub/_cashbackCfg");
  const adaTier = ["t1", "t2", "t3", "t4"].some((k) => cfg && typeof cfg[k] === "object" && cfg[k]);
  if (!adaTier) cfg = CB_DEFAULT;
  if (cfg.on === false) return json({ ok: 1, amount: 0, off: 1 });
  const price = Math.max(0, Math.floor(Number(p.price ?? 0)));
  const count = Math.max(1, Math.min(999, Math.floor(Number(p.count ?? 1))));
  const nilai = price * count;
  if (nilai <= 0) return gagal("Nilai gift tidak valid");

  const baris = undiBaris(barisTier(cfg, nilai));
  const mult = Math.max(0, Math.min(500, Math.floor(baris.v)));
  // Total cashback = harga gift x pengali dari panel, TANPA dipotong.
  // Pecahan hanya untuk animasi (aset angka maksimal 10.000), jadi isinya
  // potongan dari total dan jumlah akhirnya tetap total penuh.
  const target = Math.max(0, nilai * mult);
  const parts = pecahCashback(target);
  const amount = target;

  const paid = await beriCoin(env, uid, amount, "cashback", null);
  const pct = Math.max(0, Math.min(100, Number(cfg.recvPct ?? 5)));
  const to = String(p.to ?? "").trim();
  const bonus = to ? Math.floor((nilai * pct) / 100) : 0;
  const recv = bonus > 0 && to !== uid ? await beriCoin(env, to, bonus, "cashback_recv", null) : 0;
  const jpMin = Math.max(0, Math.floor(Number(cfg.jpMin ?? 1000)));
  return json({ ok: 1, amount: paid, mult, parts: parts.slice(0, 5), pecahan: parts[0] ?? baris.v,
    recv, jp: paid >= jpMin ? 1 : 0, asset: "" });
}

// ---------- Topup manual DANA ----------
async function infoBayar(env) {
  const r = await pipe(env, [{ sql: "select dana, nama, gopay, qris from pay_info where id = 1" }]);
  const d = r[0].rows[0] ?? {};
  return { dana: d.dana ?? "", name: d.nama ?? "", gopay: d.gopay ?? "", qris: d.qris ?? "" };
}

// Harga ditentukan server dari paket, bukan dari app, supaya tidak bisa dimurahkan.
const PAKET_TOPUP = { 1000000: 6000, 3000000: 18000, 10000000: 58000, 30000000: 170000 };

async function topupManualBuat(env, uid, p) {
  const id = String(p.id ?? `TM${Date.now()}${Math.floor(Math.random() * 1000)}`);
  const coins = Math.trunc(Number(String(p.coins ?? "").replace(/[^0-9]/g, "")));
  const amount = PAKET_TOPUP[coins];
  const payer = String(p.payer ?? "").trim().slice(0, 60);
  const method = String(p.method ?? "dana").trim() || "dana";
  if (!amount) return gagal("Paket coin tidak dikenal");
  if (payer.length < 3) return gagal("Nama pengirim terlalu pendek");
  const r = await pipe(env, [
    { sql: "select count(*) as n from topup_manual where uid = ? and status = 'pending'", args: [T(uid)] },
  ]);
  if (Number(r[0].rows[0]?.n ?? 0) >= 3) return gagal("Masih ada pengajuan yang menunggu persetujuan");
  await pipe(env, [
    {
      sql: `insert into topup_manual (id, uid, coins, amount, payer, method, status, created_at)
            values (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      args: [T(id), T(uid), I(coins), I(amount), T(payer), T(method), I(Date.now())],
    },
  ]);
  return json({ ok: 1, order: id, id, status: "pending" });
}

async function topupManualRiwayat(env, uid) {
  const r = await pipe(env, [
    {
      sql: `select id, coins, amount, payer, method, status, created_at
            from topup_manual where uid = ? order by created_at desc limit 20`,
      args: [T(uid)],
    },
  ]);
  return json({ ok: 1, list: r[0].rows });
}

// ---------- Panel admin ----------
// ================= PANEL MANAGER & ADMIN =================
// Hak staf disimpan di database supaya bisa dicabut kapan saja dari panel
// developer, dan semua aksi saldo tetap dihitung server.

async function peranStaf(env, uid) {
  if (!uid) return [];
  const r = await pipe(env, [
    { sql: "select uid, role, manager, active, coins from panel_staf where uid = ? order by role desc", args: [T(uid)] },
  ]);
  return r[0].rows
    .filter((x) => Number(x.active) === 1)
    .map((x) => ({
      uid: String(x.uid),
      role: String(x.role),
      manager: String(x.manager ?? ""),
      coins: Math.max(0, Number(x.coins ?? 0)),
    }));
}

// Satu akun bisa punya dua panel sekaligus (manager dan admin).
// Kalau peran tidak disebut, pakai manager lebih dulu, lalu admin.
async function stafDari(env, uid, peran) {
  const semua = await peranStaf(env, uid);
  if (!semua.length) return null;
  if (peran) return semua.find((x) => x.role === peran) ?? null;
  return semua.find((x) => x.role === "manager") ?? semua.find((x) => x.role === "admin") ?? null;
}

async function stokStaf(env, uid) {
  const r = await pipe(env, [
    {
      sql: `select item_id as id, kind, name, days from panel_stock
            where owner_uid = ? order by created_at desc limit 300`,
      args: [T(uid)],
    },
  ]);
  return r[0].rows.map((x) => ({ id: String(x.id), kind: String(x.kind ?? ""), name: String(x.name ?? ""), days: Number(x.days ?? 7) }));
}

/**
 * Unggah aset (gambar frame, lencana, banner) ke repo lewat server ini.
 *
 * Kenapa lewat server: HP yang mengunggah langsung ke api.github.com sering
 * menggantung di jaringan seluler, sampai batas waktu habis. Server ini
 * berada jauh lebih dekat ke HP dan meneruskan ke GitHub dengan koneksi
 * pusat data, jadi unggahan selesai dalam hitungan detik. Hasil akhirnya
 * tetap tautan CDN GitHub (jsDelivr), bukan penyimpanan lain.
 */
const ASET_REPO = "exbottod/viza-chat-voice-room";
const VPS_ASET = "https://viza.43-156-99-4.sslip.io/berkas";
const ASET_CABANG = "main";
/* Penyimpanan aset di VPS. Unggah jadi cepat karena tidak menunggu
   commit ke GitHub; file dilayani langsung lewat /aset/<nama>. */
const ASET_DIR = "/opt/viza-api/aset";

// ---------- Tautan unduhan APK ----------
const APK_ASLI = "https://github.com/exbottod/rezo-star-voice-chat-room/releases/latest/download/REZO-STAR.apk";
const APK_KEY = "rezo-vn4WOFqxwIWA5c0t";
const HALAMAN_504 = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>504 Gateway Time-out</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
background:#f7f7f7;color:#303030;display:flex;min-height:100vh;align-items:center;justify-content:center}
.kotak{text-align:center;padding:24px}
h1{font-size:44px;font-weight:600;margin:0 0 8px}
h2{font-size:22px;font-weight:600;margin:0 0 12px}
p{font-size:15px;color:#666;margin:0}
</style></head><body><div class="kotak">
<h1>504</h1><h2>Gateway Time-out</h2>
<p>The server didn't respond in time.</p>
</div></body></html>`;

/** Simpan/layani file langsung dari disk VPS. Jauh lebih cepat daripada
 *  database dan tidak butuh tabel apa pun. Di lingkungan tanpa disk (Cloudflare)
 *  import fs gagal, jadi pemanggil otomatis lanjut ke cara lain. */
async function asetFs() {
  return await import("node:fs/promises");
}

async function asetSimpanDisk(berkas, b64) {
  const fs = await asetFs();
  await fs.mkdir(ASET_DIR, { recursive: true });
  await fs.writeFile(ASET_DIR + "/" + berkas, Buffer.from(b64, "base64"));
}

async function asetBacaDisk(berkas) {
  const fs = await asetFs();
  return await fs.readFile(ASET_DIR + "/" + berkas);
}

let asetTabelSiap = null;
function asetPastikan(env) {
  if (!asetTabelSiap) {
    asetTabelSiap = pipe(env, [
      { sql: `create table if not exists aset_file (
                nama text primary key,
                mime text,
                b64  text not null,
                created integer
              )`, args: [] },
    ]).catch((e) => { asetTabelSiap = null; throw e; });
  }
  return asetTabelSiap;
}

function mimeDariExt(ext) {
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "svga") return "application/octet-stream";
  return "application/octet-stream";
}

async function asetUpload(env, b) {
  const b64 = String(b.b64 || "").replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
  if (!b64) throw new Error("Isi file kosong");
  if (b64.length > 15 * 1024 * 1024) throw new Error("File terlalu besar (maks sekitar 11 MB)");
  const ext = (String(b.ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png").slice(0, 5);
  const nama = (String(b.name || "aset").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "aset");
  const berkas = nama + "_" + Date.now().toString(36) + "." + ext;

  // 1) Jalur utama: simpan di VPS. Cepat dan tidak bergantung GitHub.
  let galatVps = "";
  // 0) Paling cepat: tulis ke disk VPS.
  try {
    await asetSimpanDisk(berkas, b64);
    return json({ ok: 1, url: VPS_ASET + "/" + berkas, path: berkas, simpan: "disk" });
  } catch (eDisk) { /* tanpa disk, lanjut ke database */ }
  try {
    await asetPastikan(env);
    await pipe(env, [
      {
        sql: "insert into aset_file (nama, mime, b64, created) values (?, ?, ?, ?)",
        args: [berkas, mimeDariExt(ext), b64, Date.now()],
      },
    ]);
    return json({ ok: 1, url: VPS_ASET + "/" + berkas, path: berkas, simpan: "vps" });
  } catch (e) {
    galatVps = String(e?.message ?? e);
  }

  const gh = String(b.gh || "").trim();
  if (!gh) throw new Error("Penyimpanan VPS gagal (" + galatVps + ") dan token GitHub belum diisi");
  const path = "docs/aset/" + berkas;
  const r = await fetch("https://api.github.com/repos/" + ASET_REPO + "/contents/" + path, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + gh,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "rezo-panel",
    },
    body: JSON.stringify({ message: "aset: " + nama, content: b64, branch: ASET_CABANG }),
  });
  const out = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) {
    throw new Error("Token GitHub ditolak atau tidak punya izin Contents: Read and write");
  }
  if (!r.ok) throw new Error("GitHub: " + ((out && out.message) || r.status));
  return json({ ok: 1, url: "https://cdn.jsdelivr.net/gh/" + ASET_REPO + "@" + ASET_CABANG + "/" + path, path: path });
}

async function asetDaftar(env) {
  const hasil = new Map();
  try {
    const fs = await asetFs();
    const nama = await fs.readdir(ASET_DIR);
    for (const n of nama) {
      try {
        const st = await fs.stat(ASET_DIR + "/" + n);
        if (!st.isFile()) continue;
        hasil.set(n, { nama: n, ukuran: Number(st.size), at: Number(st.mtimeMs) || 0, simpan: "disk", url: VPS_ASET + "/" + n });
      } catch (e) { /* berkas lewat, abaikan */ }
    }
  } catch (e) { /* tanpa disk: lanjut baca dari database */ }
  try {
    await asetPastikan(env);
    const r = await pipe(env, [
      { sql: "select nama, mime, created, length(b64) as n from aset_file order by created desc limit 300" },
    ]);
    for (const row of r[0].rows) {
      if (hasil.has(row.nama)) continue;
      hasil.set(row.nama, { nama: row.nama, ukuran: Number(row.n) || 0, at: Number(row.created) || 0, simpan: "vps", url: VPS_ASET + "/" + row.nama });
    }
  } catch (e) { /* tabel belum ada: cukup dari disk */ }
  return [...hasil.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 300);
}

async function asetHapus(env, nama) {
  let ada = false;
  try {
    const fs = await asetFs();
    await fs.unlink(ASET_DIR + "/" + nama);
    ada = true;
  } catch (e) { /* mungkin hanya ada di database */ }
  try {
    await asetPastikan(env);
    const r = await pipe(env, [{ sql: "delete from aset_file where nama = ?", args: [T(nama)] }]);
    if (Number(r[0]?.rows?.length ?? 0) || true) ada = true;
  } catch (e) { /* tabel belum ada */ }
  if (!ada) throw new Error("Berkas tidak ditemukan");
  return true;
}

async function panel(env, body) {
  const sesi = await sesiDariToken(body.t ?? "");
  if (!sesi) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
  const uid = sesi.uid;
  const p = body.p ?? {};
  const aksi = String(body.a ?? p.a ?? p.op ?? "");
  const dev = adalahAdmin(sesi);

  if (aksi === "cek_galat") {
    if (!dev) return json({ ok: 0, e: "Hanya admin" }, 403);
    const r = await pipe(env, [{ sql: "select uid, aksi, pesan, at from wallet_galat order by at desc limit 30" }]);
    return json({ ok: 1, baris: r[0].rows });
  }

  if (aksi === "me") {
    const semua = await peranStaf(env, uid);
    if (!semua.length) return json({ ok: 0, e: "Bukan staf", role: "" });
    const stok = await stokStaf(env, uid);
    const panels = semua.map((x) => ({
      role: x.role,
      manager: x.manager,
      coins: x.coins,
      stok,
    }));
    const utama = panels.find((x) => x.role === "manager") ?? panels[0];
    // role/coins di level atas dipertahankan untuk APK lama.
    return json({ ok: 1, role: utama.role, manager: utama.manager, coins: utama.coins, stok, panels });
  }

  // ---- Agensi: dipakai pemilik agensi dan host dari dalam aplikasi ----
  if (aksi === "agency_info") {
    await siapAgency(env);
    const bulan = bulanIni();
    const milik = await pipe(env, [
      {
        sql: `select id, nama, kode, rate, aktif, saldo from agency where owner_uid = ? order by created_at limit 1`,
        args: [T(uid)],
      },
    ]);
    const ag = milik[0].rows[0] || null;
    const sbgHost = await pipe(env, [
      {
        sql: `select h.agency_id, h.sejak, a.nama, a.rate from agency_host h
              join agency a on a.id = h.agency_id
              where h.host_uid = ? and h.aktif = 1 and a.aktif = 1`,
        args: [T(uid)],
      },
    ]);
    let host = [];
    let komisiBulan = 0;
    if (ag) {
      const h = await pipe(env, [
        {
          sql: `select h.host_uid, h.sejak from agency_host h
                where h.agency_id = ? and h.aktif = 1 order by h.sejak desc limit 200`,
          args: [T(ag.id)],
        },
      ]);
      host = h[0].rows;
      const e = await pipe(env, [
        { sql: "select coins from agency_earn where agency_id = ? and bulan = ?", args: [T(ag.id), T(bulan)] },
      ]);
      komisiBulan = Number(e[0].rows[0]?.coins ?? 0);
    }
    return json({ ok: 1, bulan, agency: ag, komisiBulan, host, sebagaiHost: sbgHost[0].rows[0] || null });
  }

  if (aksi === "agency_join") {
    await siapAgency(env);
    const kode = String(p.kode ?? "").trim().toUpperCase();
    if (!kode) return gagal("Kode agensi kosong");
    const ag = await pipe(env, [
      { sql: "select id, nama, rate, aktif from agency where kode = ?", args: [T(kode)] },
    ]);
    const row = ag[0].rows[0];
    if (!row || !row.aktif) return gagal("Kode agensi tidak ditemukan");
    const kini = await pipe(env, [
      { sql: "select agency_id, aktif, sejak from agency_host where host_uid = ?", args: [T(uid)] },
    ]);
    const lama = kini[0].rows[0];
    // Pindah agensi baru boleh setelah 30 hari, supaya agensi tidak saling rebut host.
    if (lama && lama.aktif && lama.agency_id !== row.id) {
      const hari = Math.floor((Date.now() - Number(lama.sejak ?? 0)) / 86400000);
      if (hari < 30) return gagal("Baru bisa pindah agensi setelah 30 hari (sekarang " + hari + " hari)");
    }
    await pipe(env, [
      {
        sql: `insert into agency_host (host_uid, agency_id, aktif, sejak) values (?, ?, 1, ?)
              on conflict (host_uid) do update set agency_id = excluded.agency_id, aktif = 1, sejak = excluded.sejak`,
        args: [T(uid), T(row.id), I(Date.now())],
      },
    ]);
    return json({ ok: 1, agency: { id: row.id, nama: row.nama, rate: row.rate } });
  }

  if (aksi === "agency_request") {
    await siapAgency(env);
    const ag = await pipe(env, [
      { sql: "select id, saldo from agency where owner_uid = ? and aktif = 1", args: [T(uid)] },
    ]);
    const row = ag[0].rows[0];
    if (!row) return gagal("Kamu bukan pemilik agensi");
    const minta = Math.trunc(Number(p.coins ?? row.saldo));
    if (!(minta > 0)) return gagal("Tidak ada komisi untuk dicairkan");
    if (minta > Number(row.saldo ?? 0)) return gagal("Saldo komisi tidak cukup");
    await pipe(env, [
      {
        sql: "insert into agency_req (agency_id, coins, status, at) values (?, ?, 'menunggu', ?)",
        args: [T(row.id), I(minta), I(Date.now())],
      },
    ]);
    return json({ ok: 1, minta });
  }

  if (aksi === "ban_check") {
    const r = await pipe(env, [
      { sql: "select reason, oleh from panel_ban where uid = ?", args: [T(uid)] },
    ]);
    const row = r[0].rows[0];
    return json({ ok: 1, banned: !!row, reason: row ? String(row.reason ?? "") : "" });
  }

  const semuaPeran = await peranStaf(env, uid);
  const diminta = String(p.sebagai ?? "").trim();
  const staf = diminta
    ? semuaPeran.find((x) => x.role === diminta) ?? null
    : semuaPeran.find((x) => x.role === "manager") ?? semuaPeran[0] ?? null;
  if (!staf && !dev) return json({ ok: 0, e: "Hanya manager atau admin" }, 403);
  const peran = dev ? "dev" : staf.role;
  const target = String(p.to ?? p.uid ?? "").trim();
  const butuhTarget = () => {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(target)) return "ID user tidak valid";
    // ID angka (mis. 100129) BUKAN uid Firebase. Kalau diterima, coin masuk ke
    // dompet palsu dan penerima asli tidak dapat apa pun.
    if (/^\d+$/.test(target)) return "Kirim memakai UID akun, bukan ID angka. Update aplikasi ke versi terbaru.";
    return "";
  };

  if (aksi === "send_coin") {
    if (peran !== "manager" && peran !== "dev") return json({ ok: 0, e: "Hanya manager" }, 403);
    const salah = butuhTarget();
    if (salah) return gagal(salah);
    const coins = Math.trunc(Number(p.coins ?? 0));
    if (!(coins > 0) || coins > 10000000000000) return gagal("Jumlah coin tidak valid");
    // Pemilik akun yang juga developer tetap memakai jalur manager di panel manager,
    // supaya stok coin benar-benar berkurang sesuai jumlah yang dikirim.
    const pakaiStok = staf && staf.role === "manager";
    if (pakaiStok) {
      const sisa = staf.coins;
      if (coins > sisa) {
        return gagal(`Stok coin panel habis. Sisa ${sisa.toLocaleString("id-ID")} coin, minta tambah ke developer.`);
      }
      const potong = await pipe(env, [
        { sql: "update panel_staf set coins = coins - ? where uid = ? and role = 'manager' and coins >= ?", args: [I(coins), T(uid), I(coins)] },
        { sql: "select changes() as n" },
      ]);
      const terpotong = Number(potong[1].rows[0].n);
      if (!terpotong) {
        const s2 = await stafDari(env, uid);
        return gagal(`Stok coin panel habis. Sisa ${Number(s2?.coins ?? 0).toLocaleString("id-ID")} coin.`);
      }
      try {
        await beriCoin(env, target, coins, "panel_coin", null);
      } catch (e) {
        await pipe(env, [
          { sql: "update panel_staf set coins = coins + ? where uid = ? and role = 'manager'", args: [I(coins), T(uid)] },
        ]).catch(() => {});
        throw e;
      }
      const w1 = await pastikan(env, target);
      await pipe(env, [
        { sql: "insert into panel_log (id, oleh, aksi, target, jumlah, at) values (?, ?, 'send_coin', ?, ?, ?)",
          args: [T(`${uid}-${Date.now()}`), T(uid), T(target), I(coins), I(Date.now())] },
      ]).catch(() => {});
      const s3 = await stafDari(env, uid);
      return json({ ok: 1, coins: w1.coins, sisaStok: Number(s3?.coins ?? 0) });
    }
    await beriCoin(env, target, coins, "panel_coin", null);
    const w = await pastikan(env, target);
    await pipe(env, [
      { sql: "insert into panel_log (id, oleh, aksi, target, jumlah, at) values (?, ?, 'send_coin', ?, ?, ?)",
        args: [T(`${uid}-${Date.now()}`), T(uid), T(target), I(coins), I(Date.now())] },
    ]).catch(() => {});
    return json({ ok: 1, coins: w.coins });
  }

  if (aksi === "send_vip") {
    const tier = Math.trunc(Number(p.tier ?? 0));
    const days = Math.trunc(Number(p.days ?? 30));
    if (!(tier >= 1 && tier <= 9)) return gagal("VIP harus 1 sampai 9");
    if (!(days > 0) || days > 3650) return gagal("Durasi VIP tidak valid");
    const salah = butuhTarget();
    if (salah) return gagal(salah);
    await beriVip(env, target, tier, days);
    return json({ ok: 1, vip: tier, days });
  }

  if (aksi === "send_item") {
    const itemId = String(p.itemId ?? "").trim();
    const salah = butuhTarget();
    if (salah) return gagal(salah);
    const stok = await stokStaf(env, uid);
    const ada = stok.find((x) => x.id === itemId);
    if (!ada && !dev) return gagal("Item ini tidak ada di stok panel Anda");
    const hari = Math.trunc(Number(p.days ?? ada?.days ?? 7));
    if (!(hari > 0) || hari > 3650) return gagal("Durasi item tidak valid");
    const w0 = await pastikan(env, target);
    const lama = Number(w0.inv?.[itemId] ?? 0);
    const akhir = Math.max(Date.now(), lama) + hari * 86400000;
    const inv = { ...w0.inv, [itemId]: akhir };
    // Kalau panel mengirim slot (mis. "uid" atau "badge"), item langsung dipakai
    // oleh akun itu tanpa perlu dibeli dulu: ini dipakai item Unique ID custom.
    const slotPakai = String(p.equip ?? "").trim();
    const eqBaru = { ...w0.equip, ...(slotPakai ? { [slotPakai]: itemId } : {}) };
    const langkah = [
      { sql: "update wallets set inv = ?, updated_at = ? where uid = ?", args: [T(JSON.stringify(inv)), I(Date.now()), T(target)] },
    ];
    if (slotPakai) {
      langkah.push({ sql: "update wallets set equip = ?, updated_at = ? where uid = ?", args: [T(JSON.stringify(eqBaru)), I(Date.now()), T(target)] });
    }
    await pipe(env, langkah);
    return json({ ok: 1, itemId, days: hari, equip: slotPakai || null });
  }

  if (aksi === "ban") {
    const salah = butuhTarget();
    if (salah) return gagal(salah);
    if (target === uid) return gagal("Tidak bisa banned diri sendiri");
    const korbanList = await peranStaf(env, target);
    const korban = korbanList.find((x) => x.role === "manager") ?? korbanList[0] ?? null;
    if (peran === "admin") {
      // Admin hanya boleh mengurus user biasa di bawah manajernya.
      if (!staf.manager) return gagal("Admin ini belum punya manager");
      if (korban) return gagal("Admin tidak bisa banned sesama staf atau manager");
    }
    if (korban && korban.role === "manager" && peran !== "dev") return gagal("Hanya developer yang bisa banned manager");
    await pipe(env, [
      {
        sql: `insert into panel_ban (uid, oleh, manager, reason, at) values (?, ?, ?, ?, ?)
              on conflict (uid) do update set oleh = excluded.oleh, manager = excluded.manager,
                reason = excluded.reason, at = excluded.at`,
        args: [T(target), T(uid), T(staf?.manager ?? ""), T(String(p.reason ?? "").slice(0, 140)), I(Date.now())],
      },
    ]);
    return json({ ok: 1, banned: target });
  }

  if (aksi === "unban") {
    const salah = butuhTarget();
    if (salah) return gagal(salah);
    await pipe(env, [{ sql: "delete from panel_ban where uid = ?", args: [T(target)] }]);
    return json({ ok: 1, unbanned: target });
  }

  if (aksi === "bans") {
    const r = await pipe(env, [
      { sql: "select uid, oleh, reason, at from panel_ban order by at desc limit 100" },
    ]);
    return json({ ok: 1, list: r[0].rows });
  }

  return json({ ok: 0, e: "Aksi panel tidak dikenal: " + aksi });
}


/**
 * Hapus akun login Firebase Auth.
 *
 * Butuh kunci service account di variabel lingkungan FIREBASE_SA_JSON
 * (isi berkas JSON dari Firebase Console > Project settings > Service accounts).
 * Tanpa kunci itu, akun login tidak bisa dihapus dari server.
 */
let saCache = { kunci: "", token: "", exp: 0 };

async function tokenLayanan(env) {
  let mentah = String(env.FIREBASE_SA_JSON || "").trim();
  if (!mentah) {
    // Cara kedua: berkas di server, tanpa mengubah systemd.
    try {
      const fs = await import("node:fs/promises");
      mentah = String(await fs.readFile("/opt/viza-api/firebase-sa.json", "utf8")).trim();
    } catch (e) { mentah = ""; }
  }
  if (!mentah) return "";
  if (saCache.kunci === mentah && saCache.token && Date.now() < saCache.exp - 60000) return saCache.token;
  let sa;
  try { sa = JSON.parse(mentah); } catch (e) { return ""; }
  if (!sa.client_email || !sa.private_key) return "";
  const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const kepala = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", kid: sa.private_key_id || undefined }));
  const kini = Math.floor(Date.now() / 1000);
  const isi = b64u(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase",
    aud: "https://oauth2.googleapis.com/token",
    iat: kini,
    exp: kini + 3600,
  }));
  const data = kepala + "." + isi;
  const kunci = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const ttd = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kunci, new TextEncoder().encode(data));
  const jwt = data + "." + b64u(new Uint8Array(ttd));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(jwt),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) return "";
  saCache = { kunci: mentah, token: j.access_token, exp: Date.now() + (Number(j.expires_in || 3600) * 1000) };
  return j.access_token;
}

async function hapusAkunAuth(env, uid) {
  const token = await tokenLayanan(env);
  if (!token) return { ok: 0, alasan: "Kunci layanan belum dipasang" };
  const proyek = String(env.FIREBASE_PROJECT || "my-app-e7f8c").trim();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${proyek}/accounts:delete`, {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.ok) return { ok: 1 };
  const pesan = String(j?.error?.message || "");
  // Akun yang memang sudah tidak ada dianggap berhasil.
  if (pesan.includes("USER_NOT_FOUND") || pesan.includes("EMAIL_NOT_FOUND")) return { ok: 1 };
  return { ok: 0, alasan: pesan || ("HTTP " + r.status) };
}


/** Panel developer disajikan dari server ini: /opt/viza-api/panel. */
async function panelBerkas(jalur) {
  let fs, path;
  try {
    fs = await import("node:fs/promises");
    path = await import("node:path");
  } catch (e) {
    return new Response("Tidak tersedia", { status: 404 });
  }
  const nama = (jalur.replace(/^\/panel\/?/, "") || "index.html").replace(/\.\./g, "").replace(/^\/+/, "");
  const lokasi = path.join("/opt/viza-api/panel", nama);
  const ext = (nama.split(".").pop() || "").toLowerCase();
  const mime = {
    html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8", json: "application/json",
    webmanifest: "application/manifest+json", ico: "image/x-icon",
    png: "image/png", svg: "image/svg+xml", webp: "image/webp",
  }[ext] || "application/octet-stream";
  try {
    const isi = await fs.readFile(lokasi);
    return new Response(isi, { status: 200, headers: { "content-type": mime, "cache-control": "no-cache" } });
  } catch (e) {
    return new Response("Berkas panel tidak ada: " + nama, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

async function admin(env, body) {
  const sesi = await sesiDariToken(body.t ?? "");
  if (!sesi) return json({ ok: 0, e: "Token tidak valid" }, 401);
  if (!adalahAdmin(sesi)) return json({ ok: 0, e: "Hanya admin" }, 403);
  const p = body.p ?? {};
  const op = String(p.op ?? "");
  const target = String(p.uid ?? "");

  // ---- Harga VIP (diubah dari panel developer) ----
  if (op === "vip_harga_get") {
    await hargaVipKini();
    return json({ ok: 1, harga: HARGA_VIP.slice(1) });
  }
  if (op === "vip_harga_set") {
    const a = Array.isArray(p.harga) ? p.harga.map(Number) : null;
    if (!a || a.length !== 9 || a.some((x) => !Number.isFinite(x) || x < 0)) {
      return gagal("Harga VIP tidak sah: isi 9 angka");
    }
    try { await hargaVipSimpan(a); }
    catch (e) { return gagal("Gagal menyimpan: " + String(e?.message ?? e)); }
    return json({ ok: 1, harga: HARGA_VIP.slice(1) });
  }

  // ---- Coin seller: pendaftaran (khusus developer) ----
  if (op === "seller_list") {
    return json({ ok: 1, seller: await daftarSeller(env, false) });
  }
  if (op === "seller_save") {
    const who = String(p.uid ?? "").trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(who)) return gagal("UID tidak valid");
    if (/^[0-9]+$/.test(who)) return gagal("Pakai UID akun, bukan ID angka");
    const store = String(p.store ?? "").trim().slice(0, 60);
    const wa = String(p.wa ?? "").trim().slice(0, 32);
    const link = String(p.link ?? "").trim().slice(0, 300);
    const aktif = p.active === undefined ? 1 : (Number(p.active) ? 1 : 0);
    if (!store) return gagal("Nama toko wajib diisi");
    if (!wa) return gagal("Nomor WhatsApp wajib diisi");
    await siapSeller(env);
    const now = Date.now();
    await pipe(env, [
      {
        sql: `insert into coin_seller (uid, store, wa, wa_link, active, updated_at)
              values (?, ?, ?, ?, ?, ?)
              on conflict (uid) do update set
                store = excluded.store, wa = excluded.wa,
                wa_link = excluded.wa_link, active = excluded.active,
                updated_at = excluded.updated_at`,
        args: [T(who), T(store), T(wa), T(link), I(aktif), I(now)],
      },
    ]);
    return json({ ok: 1, seller: await satuSeller(env, who) });
  }
  if (op === "seller_set_active") {
    const who = String(p.uid ?? "").trim();
    if (!who) return gagal("UID kosong");
    await siapSeller(env);
    const aktif = Number(p.active) ? 1 : 0;
    const r = await pipe(env, [
      { sql: "update coin_seller set active = ?, updated_at = ? where uid = ?", args: [I(aktif), I(Date.now()), T(who)] },
    ]);
    if (!r[0].affected) return gagal("Seller belum terdaftar");
    return json({ ok: 1, seller: await satuSeller(env, who) });
  }
  if (op === "seller_del") {
    const who = String(p.uid ?? "").trim();
    if (!who) return gagal("UID kosong");
    await siapSeller(env);
    await pipe(env, [{ sql: "delete from coin_seller where uid = ?", args: [T(who)] }]);
    return json({ ok: 1, uid: who });
  }
  // ---- Stok coin seller (tab terpisah, khusus developer) ----
  if (op === "seller_stock") {
    const who = String(p.uid ?? "").trim();
    if (!who) return gagal("UID kosong");
    await siapSeller(env);
    const ada = await pipe(env, [{ sql: "select stock from coin_seller where uid = ?", args: [T(who)] }]);
    if (!ada[0].rows.length) return gagal("Seller belum terdaftar");
    const mode = String(p.mode ?? "add");
    const n = Math.trunc(Number(p.coins ?? 0));
    if (!Number.isFinite(n) || n === 0) return gagal("Jumlah coin tidak valid");
    const now = Date.now();
    if (mode === "set") {
      if (n < 0) return gagal("Stok tidak boleh negatif");
      if (n > MAKS_STOK) return gagal("Stok maksimal " + MAKS_STOK.toLocaleString("id-ID") + " coin");
      await pipe(env, [
        { sql: "update coin_seller set stock = ?, updated_at = ? where uid = ?", args: [I(n), I(now), T(who)] },
      ]);
    } else {
      // Penambahan dibatasi MAKS_STOK: dulu stok bisa terus membengkak sampai
      // melewati batas angka JavaScript, lalu seluruh daftar seller gagal dibaca.
      await pipe(env, [
        {
          sql: `update coin_seller set stock = min(?, case when stock + ? < 0 then 0 else stock + ? end),
                  updated_at = ? where uid = ?`,
          args: [I(MAKS_STOK), I(n), I(n), I(now), T(who)],
        },
      ]);
    }
    return json({ ok: 1, seller: await satuSeller(env, who) });
  }

  // ---- Agensi (khusus developer) ----
  if (op === "agency_list") {
    await siapAgency(env);
    const bulan = bulanIni();
    const r = await pipe(env, [
      {
        sql: `select a.id, a.nama, a.owner_uid, a.kode, a.rate, a.aktif, a.saldo,
                     (select count(*) from agency_host h where h.agency_id = a.id and h.aktif = 1) as host,
                     coalesce((select e.coins from agency_earn e where e.agency_id = a.id and e.bulan = ?), 0) as bulan_ini
              from agency a order by a.created_at desc limit 200`,
        args: [T(bulan)],
      },
    ]);
    return json({ ok: 1, bulan, agency: r[0].rows });
  }
  if (op === "agency_save") {
    await siapAgency(env);
    const nama = String(p.nama ?? "").trim().slice(0, 60);
    const owner = String(p.ownerUid ?? p.owner ?? "").trim();
    const rate = Math.max(0, Math.min(100, Math.trunc(Number(p.rate ?? 10))));
    const aktif = p.aktif === undefined ? 1 : (Number(p.aktif) ? 1 : 0);
    if (!nama) return gagal("Nama agensi wajib diisi");
    if (owner && !/^[A-Za-z0-9_-]{6,64}$/.test(owner)) return gagal("UID pemilik tidak valid");
    const id = String(p.id ?? "").trim() || ("ag-" + Date.now().toString(36));
    const ada = await pipe(env, [{ sql: "select id, kode from agency where id = ?", args: [T(id)] }]);
    const kode = ada[0].rows[0]?.kode || kodeAgensi();
    await pipe(env, [
      {
        sql: `insert into agency (id, nama, owner_uid, kode, rate, aktif) values (?, ?, ?, ?, ?, ?)
              on conflict (id) do update set
                nama = excluded.nama, owner_uid = excluded.owner_uid,
                rate = excluded.rate, aktif = excluded.aktif`,
        args: [T(id), T(nama), T(owner), T(kode), I(rate), I(aktif)],
      },
    ]);
    const r = await pipe(env, [
      { sql: "select id, nama, owner_uid, kode, rate, aktif, saldo from agency where id = ?", args: [T(id)] },
    ]);
    return json({ ok: 1, agency: r[0].rows[0] });
  }
  if (op === "agency_del") {
    await siapAgency(env);
    const id = String(p.id ?? "").trim();
    if (!id) return gagal("ID agensi kosong");
    await pipe(env, [
      { sql: "update agency_host set aktif = 0 where agency_id = ?", args: [T(id)] },
      { sql: "delete from agency where id = ?", args: [T(id)] },
    ]);
    return json({ ok: 1, id });
  }
  if (op === "agency_hosts") {
    await siapAgency(env);
    const id = String(p.id ?? "").trim();
    const r = await pipe(env, [
      {
        sql: `select h.host_uid, h.sejak, h.aktif,
                     coalesce((select sum(t.amount) from money_tx t
                               where t.uid = h.host_uid and t.kind = 'gift_in'), 0) as total_gift
              from agency_host h where h.agency_id = ? order by h.sejak desc limit 300`,
        args: [T(id)],
      },
    ]);
    return json({ ok: 1, host: r[0].rows });
  }
  if (op === "agency_attach" || op === "agency_detach") {
    await siapAgency(env);
    const who = String(p.uid ?? "").trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(who)) return gagal("UID host tidak valid");
    if (op === "agency_detach") {
      await pipe(env, [{ sql: "update agency_host set aktif = 0 where host_uid = ?", args: [T(who)] }]);
      return json({ ok: 1, uid: who, agency: null });
    }
    const id = String(p.id ?? "").trim();
    const ada = await pipe(env, [{ sql: "select id from agency where id = ?", args: [T(id)] }]);
    if (!ada[0].rows.length) return gagal("Agensi tidak ditemukan");
    await pipe(env, [
      {
        sql: `insert into agency_host (host_uid, agency_id, aktif, sejak) values (?, ?, 1, ?)
              on conflict (host_uid) do update set agency_id = excluded.agency_id, aktif = 1`,
        args: [T(who), T(id), I(Date.now())],
      },
    ]);
    return json({ ok: 1, uid: who, agency: id });
  }
  if (op === "agency_req_list") {
    await siapAgency(env);
    const r = await pipe(env, [
      {
        sql: `select q.id, q.agency_id, q.coins, q.status, q.at, a.nama
              from agency_req q left join agency a on a.id = q.agency_id
              order by q.at desc limit 100`,
      },
    ]);
    return json({ ok: 1, req: r[0].rows });
  }
  if (op === "agency_req_done") {
    await siapAgency(env);
    const id = Math.trunc(Number(p.reqId ?? 0));
    const r = await pipe(env, [{ sql: "select id, agency_id, coins, status from agency_req where id = ?", args: [I(id)] }]);
    const row = r[0].rows[0];
    if (!row) return gagal("Pengajuan tidak ditemukan");
    if (row.status !== "menunggu") return gagal("Pengajuan sudah diproses");
    await pipeTrx(env, [
      { sql: "begin immediate" },
      { sql: "update agency_req set status = 'dibayar', oleh = ? where id = ?", args: [T(String(p.oleh ?? "admin")), I(id)] },
      { sql: "update agency set saldo = max(0, saldo - ?) where id = ?", args: [I(row.coins), T(row.agency_id)] },
      { sql: "commit" },
    ]);
    return json({ ok: 1, id, status: "dibayar" });
  }

  // ---- Panel developer: atur panel manager/admin ----
  if (op === "panel_grant") {
    const who = String(p.uid ?? "").trim();
    const role = String(p.role ?? "").trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(who)) return gagal("UID tidak valid");
    if (role !== "manager" && role !== "admin") return gagal("Peran harus manager atau admin");
    const manager = role === "admin" ? String(p.manager ?? "").trim() : "";
    await pipe(env, [
      {
        sql: `insert into panel_staf (uid, role, manager, active, created_at) values (?, ?, ?, 1, ?)
              on conflict (uid, role) do update set manager = excluded.manager, active = 1`,
        args: [T(who), T(role), T(manager), I(Date.now())],
      },
    ]);
    return json({ ok: 1, uid: who, role, manager });
  }
  if (op === "panel_revoke") {
    const who = String(p.uid ?? "").trim();
    if (!who) return gagal("UID kosong");
    const role = String(p.role ?? "").trim();
    if (role === "manager" || role === "admin") {
      await pipe(env, [
        { sql: "update panel_staf set active = 0 where uid = ? and role = ?", args: [T(who), T(role)] },
      ]);
      return json({ ok: 1, uid: who, role });
    }
    await pipe(env, [{ sql: "update panel_staf set active = 0 where uid = ?", args: [T(who)] }]);
    return json({ ok: 1, uid: who, role: "" });
  }
  if (op === "panel_list") {
    const r = await pipe(env, [
      {
        sql: `select s.uid, s.role, s.manager, s.active, s.created_at, s.coins,
                     (select count(*) from panel_stock k where k.owner_uid = s.uid) as stok
              from panel_staf s order by s.created_at desc limit 300`,
      },
    ]);
    return json({ ok: 1, list: r[0].rows });
  }
  if (op === "panel_coin_add" || op === "panel_coin_set") {
    const who = String(p.uid ?? "").trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(who)) return gagal("UID tidak valid");
    const n = Math.trunc(Number(p.coins ?? 0));
    if (!Number.isFinite(n)) return gagal("Jumlah coin tidak valid");
    const role = String(p.role ?? "manager").trim() === "admin" ? "admin" : "manager";
    if (op === "panel_coin_add") {
      await pipe(env, [
        { sql: "update panel_staf set coins = min(?, max(0, coins + ?)) where uid = ? and role = ?", args: [I(MAKS_STOK), I(n), T(who), T(role)] },
      ]);
    } else {
      await pipe(env, [
        { sql: "update panel_staf set coins = ? where uid = ? and role = ?", args: [I(Math.min(MAKS_STOK, Math.max(0, n))), T(who), T(role)] },
      ]);
    }
    const r = await pipe(env, [
      { sql: "select coins from panel_staf where uid = ? and role = ?", args: [T(who), T(role)] },
    ]);
    return json({ ok: 1, uid: who, role, coins: Number(r[0].rows[0]?.coins ?? 0) });
  }
  if (op === "panel_stock_add") {
    const who = String(p.uid ?? "").trim();
    const itemId = String(p.itemId ?? p.item_id ?? "").trim();
    if (!who || !itemId) return gagal("UID dan item wajib diisi");
    await pipe(env, [
      {
        sql: `insert into panel_stock (owner_uid, item_id, kind, name, days, created_at) values (?, ?, ?, ?, ?, ?)
              on conflict (owner_uid, item_id) do update set kind = excluded.kind,
                name = excluded.name, days = excluded.days`,
        args: [T(who), T(itemId), T(String(p.kind ?? "")), T(String(p.name ?? "")), I(Math.trunc(Number(p.days ?? 7))), I(Date.now())],
      },
    ]);
    return json({ ok: 1, uid: who, itemId });
  }
  if (op === "panel_stock_del") {
    await pipe(env, [
      { sql: "delete from panel_stock where owner_uid = ? and item_id = ?", args: [T(String(p.uid ?? "")), T(String(p.itemId ?? ""))] },
    ]);
    return json({ ok: 1 });
  }
  if (op === "panel_stock_list") {
    const r = await pipe(env, [
      { sql: "select owner_uid, item_id, kind, name, days from panel_stock where owner_uid = ? order by created_at desc", args: [T(String(p.uid ?? ""))] },
    ]);
    return json({ ok: 1, list: r[0].rows });
  }
  if (op === "pay_get") return json({ ok: 1, pay: await infoBayar(env) });
  if (op === "pay_set") {
    await pipe(env, [
      {
        sql: `insert into pay_info (id, dana, nama, gopay, qris, updated_at) values (1, ?, ?, ?, ?, ?)
              on conflict (id) do update set dana = excluded.dana, nama = excluded.nama,
                gopay = excluded.gopay, qris = excluded.qris, updated_at = excluded.updated_at`,
        args: [T(p.dana ?? ""), T(p.name ?? ""), T(p.gopay ?? ""), T(p.qris ?? ""), I(Date.now())],
      },
    ]);
    return json({ ok: 1, pay: await infoBayar(env) });
  }
  if (op === "manual_pending" || op === "manual_all") {
    const semua = op === "manual_all";
    const r = await pipe(env, [
      {
        sql: `select id, uid, coins, amount, payer, method, status, created_at
              from topup_manual ${semua ? "" : "where status = 'pending'"}
              order by created_at desc limit ?`,
        args: [I(p.limit ?? 60)],
      },
    ]);
    return json({ ok: 1, list: r[0].rows });
  }
  if (op === "manual_decide") {
    const id = String(p.id ?? "");
    const setuju = p.ok === true || p.ok === "true";
    const cur = await pipe(env, [
      { sql: "select uid, coins, status from topup_manual where id = ?", args: [T(id)] },
    ]);
    const row = cur[0].rows[0];
    if (!row) return gagal("Pengajuan tidak ditemukan");
    if (row.status !== "pending") return gagal("Pengajuan sudah diproses");
    // Kunci baris dulu supaya klik ganda tidak menambah coin dua kali.
    const kunci = await pipe(env, [
      {
        sql: "update topup_manual set status = ?, decided_at = ? where id = ? and status = 'pending'",
        args: [T(setuju ? "ok" : "tolak"), I(Date.now()), T(id)],
      },
    ]);
    if (kunci[0].affected === 0) return gagal("Pengajuan sudah diproses");
    if (setuju) await beriCoin(env, String(row.uid), Number(row.coins), "topup", null);
    return json({ ok: 1, r: { id, uid: row.uid, coins: row.coins, status: setuju ? "ok" : "tolak" } });
  }
  if (op === "get") {
    const w = await pastikan(env, target);
    return json({ ok: 1, w });
  }
  if (op === "topup") {
    if (!target) return gagal("uid kosong");
    const coins = Math.trunc(Number(p.coins ?? 0));
    if (!(coins > 0)) return gagal("Jumlah coin tidak valid");
    await beriCoin(env, target, coins, "topup", null);
    return ok(await pastikan(env, target));
  }
  // Panel: kirim coin / exp, boleh minus untuk mengurangi.
  if (op === "add") {
    if (!target) return gagal("uid kosong");
    const coins = Math.trunc(Number(p.coins ?? 0));
    const exp = Math.trunc(Number(p.exp ?? 0));
    if (!coins && !exp) return gagal("Jumlah kosong");
    await pastikan(env, target);
    await pipe(env, [
      { sql: "begin immediate" },
      {
        sql: "update wallets set coins = max(0, coins + ?), exp = max(0, exp + ?), updated_at = ? where uid = ?",
        args: [I(coins), I(exp), I(Date.now()), T(target)],
      },
      { sql: "commit" },
    ]);
    return ok(await pastikan(env, target));
  }
  // Panel: reset coin (dan diamond kalau gem) untuk satu user / semua user.
  if (op === "reset" || op === "reset_all" || op === "reset_gem" || op === "reset_gem_all") {
    const gem = op.includes("gem");
    const semua = op.endsWith("_all");
    if (!semua && !target) return gagal("uid kosong");
    const kolom = gem ? "diamonds" : "coins";
    await pipe(env, [
      {
        sql: semua
          ? `update wallets set ${kolom} = 0, updated_at = ?`
          : `update wallets set ${kolom} = 0, updated_at = ? where uid = ?`,
        args: semua ? [I(Date.now())] : [I(Date.now()), T(target)],
      },
    ]);
    if (semua) return json({ ok: 1 });
    return ok(await pastikan(env, target));
  }

  // Panel: reset aset/level/VIP/coin satu user atau semua user (kecuali akun resmi).
  if (op === "reset_user" || op === "reset_all_assets") {
    const bagian = [];
    if (p.assets) bagian.push("aset");
    if (p.vip) bagian.push("vip");
    if (p.level) bagian.push("level");
    if (p.coins) bagian.push("coin");
    if (p.gems) bagian.push("diamond");
    if (!bagian.length) return gagal("Pilih dulu apa yang mau dibersihkan");
    const set = [];
    const args = [];
    if (p.coins) { set.push("coins = 0"); }
    if (p.gems) { set.push("diamonds = 0"); }
    if (p.vip) { set.push("vip = 0", "vip_until = 0"); }
    if (p.level) { set.push("exp = 0", "lv_claimed = 0"); }
    if (p.assets) { set.push("inv = '{}'", "equip = '{}'"); }
    set.push("updated_at = ?");
    const waktu = Date.now();
    if (op === "reset_user") {
      if (!target) return gagal("uid kosong");
      await pipe(env, [{ sql: `update wallets set ${set.join(", ")} where uid = ?`, args: [I(waktu), T(target)] }]);
      return json({ ok: 1, uid: target, bagian });
    }
    const lindungi = [];
    if (Array.isArray(p.kecuali)) p.kecuali.forEach((x) => { const t = String(x || "").trim(); if (t) lindungi.push(t); });
    const tanda = lindungi.map(() => "?").join(",");
    const sql = lindungi.length
      ? `update wallets set ${set.join(", ")} where uid not in (${tanda})`
      : `update wallets set ${set.join(", ")}`;
    await pipe(env, [{ sql, args: lindungi.length ? [I(waktu), ...lindungi.map(T)] : [I(waktu)] }]);
    return json({ ok: 1, bagian, kecuali: lindungi });
  }

  // Panel: hapus akun. Akun resmi/admin/owner tidak boleh ikut terhapus.
  if (op === "delete_user" || op === "delete_users") {
    const daftar = op === "delete_user" ? [target] : (Array.isArray(p.uids) ? p.uids.map(String) : []);
    const lindungi = new Set(ADMIN_SEMUA.map((x) => String(x).toLowerCase()));
    if (Array.isArray(p.kecuali)) p.kecuali.forEach((x) => lindungi.add(String(x)));
    const hasil = [];
    for (const u of daftar) {
      if (!u) continue;
      if (lindungi.has(u.toLowerCase())) { hasil.push({ uid: u, lewat: 1 }); continue; }
      await pipe(env, [
        { sql: "delete from money_tx where uid = ?", args: [T(u)] },
        { sql: "delete from topup_manual where uid = ?", args: [T(u)] },
        { sql: "delete from hive_order where uid = ?", args: [T(u)] },
        { sql: "delete from wallets where uid = ?", args: [T(u)] },
      ]);
      // Akun login Firebase ikut dihapus, bukan hanya data dompetnya.
      const auth = await hapusAkunAuth(env, u).catch((e) => ({ ok: 0, alasan: String(e?.message ?? e) }));
      hasil.push({ uid: u, hapus: 1, auth: auth.ok ? 1 : 0, auth_alasan: auth.alasan || "" });
    }
    return json({ ok: 1, hasil });
  }

  // Panel: atur VIP (tier 0 = cabut).
  if (op === "vip") {
    if (!target) return gagal("uid kosong");
    const tier = Math.trunc(Number(p.tier ?? 0));
    const until = Math.trunc(Number(p.until ?? 0));
    if (!(tier >= 0 && tier <= 9)) return gagal("VIP harus 0 sampai 9");
    await pastikan(env, target);
    await pipe(env, [
      { sql: "begin immediate" },
      {
        sql: "update wallets set vip = ?, vip_until = ?, updated_at = ? where uid = ?",
        args: [I(tier), I(tier === 0 ? 0 : until), I(Date.now()), T(target)],
      },
      { sql: "commit" },
    ]);
    return ok(await pastikan(env, target));
  }
  return gagal("Perintah panel tidak dikenal");
}


// ================= HIVE PLAY (game pihak ketiga) =================
// Hive memanggil 3 alamat ini setiap pemain membuka game. Keaslian permintaan
// dicek lewat signature md5(signature_nonce + app_key + timestamp), karena Hive
// tidak membawa token login Firebase.
//   /hive/get_sstoken     -> code     => ss_token
//   /hive/get_user_info   -> ss_token => profil + saldo
//   /hive/change_balance  -> taruhan/menang => saldo terbaru
// Tanpa ini game Hive mentok di "error2" karena tidak bisa membaca saldo.
const HIVE_APP_ID = "100198";
const HIVE_KEY = "eb09c56d97454d43ab2698ad548697ab";
const HIVE_CODE_SALT = "rezo-hive-2026";
const HIVE_MAX_SKEW = 300;
const HIVE_MAX_SAFE = 9007199254740991;

function hiveSafe(n) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v > HIVE_MAX_SAFE ? HIVE_MAX_SAFE : Math.trunc(v);
}

function md5hex(s) {
  const msg = new TextEncoder().encode(s);
  const len = msg.length;
  const words = [];
  for (let i = 0; i < len; i++) words[i >> 2] = (words[i >> 2] ?? 0) | (msg[i] << ((i % 4) * 8));
  words[len >> 2] = (words[len >> 2] ?? 0) | (0x80 << ((len % 4) * 8));
  const total = (((len + 8) >> 6) + 1) * 16;
  while (words.length < total) words.push(0);
  const bits = len * 8;
  words[total - 2] = bits & 0xffffffff;
  words[total - 1] = Math.floor(bits / 4294967296);

  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const rotl = (x, c) => ((x << c) | (x >>> (32 - c))) | 0;

  for (let off = 0; off < total * 4; off += 64) {
    const M = [];
    for (let j = 0; j < 16; j++) M[j] = words[(off >> 2) + j] | 0;
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F = 0, g = 0;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }

  const hex = (n) => {
    let out = "";
    for (let i = 0; i < 4; i++) out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    return out;
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}


const hiveOk = (data) =>
  json({ code: 0, message: "succeed", unique_id: "rezo_" + crypto.randomUUID(), data });
const hiveFail = (message, code = 500, data = null) =>
  json({ code, message, unique_id: "rezo_" + crypto.randomUUID(), data });

const b64urlEnc = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function hiveSsToken(uid) {
  return `${b64urlEnc(uid)}.${md5hex(uid + HIVE_KEY)}`;
}

function hiveReadToken(token) {
  const s = String(token ?? "");
  const i = s.lastIndexOf(".");
  if (i < 1) return null;
  const b = s.slice(0, i);
  const sig = s.slice(i + 1);
  let uid = "";
  try {
    const pad = b.length % 4 ? "=".repeat(4 - (b.length % 4)) : "";
    uid = atob(b.replace(/-/g, "+").replace(/_/g, "/") + pad);
  } catch {
    return null;
  }
  if (!uid) return null;
  return md5hex(uid + HIVE_KEY) === sig ? uid : null;
}

function hiveReadCode(code) {
  const s = String(code ?? "").trim();
  if (!s) return null;
  const parts = s.split(".");
  if (parts.length === 1) return parts[0];
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  if (!uid || !exp || !sig) return null;
  if (md5hex(`${uid}.${exp}.${HIVE_CODE_SALT}`) !== sig) return null;
  const expMs = Number(exp) * 1000;
  if (Number.isFinite(expMs) && expMs > 0 && Date.now() > expMs) return null;
  return uid;
}


/* ================= WAVEGAMES (userInfo / submitFlow) =================
   WaveGames memanggil Base URL akun REZO (worker ini):
     GET  /wave/game/userInfo   -> profil + saldo coin pemain
     POST /wave/game/submitFlow -> potong coin saat bet (type 1), tambah saat menang (type 2)
   Identitas pemain = token login Firebase yang dikirim app lewat URL game.
   Token boleh datang dari header Authorization, query ?token=, atau body. */
function waveToken(req, url, body) {
  const a = req.headers.get("authorization") || "";
  if (a.toLowerCase().startsWith("bearer ")) return a.slice(7).trim();
  for (const k of ["token", "userToken", "user_token", "ut", "t", "authToken"]) {
    const v = url.searchParams.get(k);
    if (v && v.trim()) return v.trim();
  }
  for (const k of ["token", "userToken", "user_token"]) {
    const v = body?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

let waveTokSiap = null;
function waveTokPastikan(env) {
  if (!waveTokSiap) {
    waveTokSiap = pipe(env, [
      { sql: `create table if not exists wave_tokens (
          token text primary key,
          uid text not null,
          exp integer not null,
          created integer not null
        )`, args: [] },
    ]).catch(() => {});
  }
  return waveTokSiap;
}

/**
 * Slot Zeus: hanya mengurus uang. Putaran dan hasil tetap dihitung game di
 * dalam APK, lalu selisihnya dicatat di sini. Kemenangan dibatasi agar satu
 * permintaan tidak bisa menguras dompet.
 */
async function slotPlay(req, env, h) {
  const { pipe, json, T, I, uidDariToken } = h;
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const SKALA = 100; // 1 uang game = 100 koin REZO
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  // Terima token aplikasi (Firebase) dan token pendek Wave, supaya permainan
  // dan pengujian bisa memakai keduanya.
  let uid = tok ? await uidDariToken(tok) : "";
  if (!uid && tok) {
    try { uid = await waveUidDariToken(env, tok); } catch (e) { uid = ""; }
  }
  if (!uid) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
  const saldoKoin = async () => {
    const r = await pipe(env, [{ sql: "select coins from wallets where uid = ?", args: [T(uid)] }]);
    return Math.max(0, Math.trunc(Number(r[0].rows[0]?.coins ?? 0)));
  };
  const url = new URL(req.url);
  if (url.pathname.toLowerCase().endsWith("/info")) {
    const koin = await saldoKoin();
    return json({ ok: 1, koin, saldo: Math.round((koin / SKALA) * 100) / 100 });
  }
  if (req.method !== "POST") return json({ ok: 0, e: "Gunakan POST" }, 405);
  const b = await req.json().catch(() => ({}));
  let bet = Math.max(0, Math.round(Number(b.bet || 0) * SKALA));
  let win = Math.max(0, Math.round(Number(b.win || 0) * SKALA));
  bet = Math.min(bet, 50000);
  win = Math.min(win, Math.max(1, bet) * 500);
  await pipe(env, [{ sql: "insert or ignore into wallets (uid) values (?)", args: [T(uid)] }]);
  const r = await pipe(env, [
    { sql: "update wallets set coins = max(0, coins - ? + ?) where uid = ?", args: [I(bet), I(win), T(uid)] },
  ]);
  const koin = await saldoKoin();
  return json({ ok: 1, koin, saldo: Math.round((koin / SKALA) * 100) / 100, bet, win });
}

async function waveTokenBaru(env, uid, ttlDetik) {
  await waveTokPastikan(env);
  const tok = "wg" + crypto.randomUUID().replace(/-/g, "").slice(0, 30);
  const exp = Date.now() + ttlDetik * 1000;
  await pipe(env, [
    { sql: "insert into wave_tokens (token, uid, exp, created) values (?, ?, ?, ?)",
      args: [T(tok), T(uid), T(exp), T(Date.now())] },
  ]);
  return { token: tok, exp };
}

// Terima dua bentuk token: JWT Firebase (dipakai app) atau token pendek milik kita.
async function waveUidDariToken(env, tok) {
  if (!tok) return null;
  if (tok.split(".").length === 3) return await uidDariToken(tok);
  await waveTokPastikan(env);
  const r = await pipe(env, [
    { sql: "select uid, exp from wave_tokens where token = ?", args: [T(tok)] },
  ]);
  const row = r[0].rows[0];
  if (!row) return null;
  if (Number(row.exp) < Date.now()) return null;
  return String(row.uid);
}

const waveJson = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

let waveLogSiap = null;
function waveLogPastikan(env) {
  if (!waveLogSiap) {
    waveLogSiap = pipe(env, [
      { sql: `create table if not exists wave_log (
          id integer primary key autoincrement,
          waktu integer not null,
          ep text,
          kode integer,
          alasan text,
          uid text,
          panjang_token integer,
          ua text,
          ip text,
          isi text
        )`, args: [] },
    ]).catch(() => {});
  }
  return waveLogSiap;
}

async function waveLog(env, r) {
  try {
    await waveLogPastikan(env);
    await pipe(env, [
      {
        sql: `insert into wave_log (waktu, ep, kode, alasan, uid, panjang_token, ua, ip, isi)
              values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          T(Date.now()), T(r.ep ?? ""), T(r.kode ?? 0), T(r.alasan ?? ""), T(r.uid ?? ""),
          T(r.panjang ?? 0), T(String(r.ua ?? "").slice(0, 160)), T(r.ip ?? ""), T(String(r.isi ?? "").slice(0, 300)),
        ],
      },
    ]);
  } catch (e) {}
}

// Foto profil HARUS berupa URL pendek. Game menaruh profilePicture di query
// socket, jadi base64 raksasa (puluhan ribu karakter) membuat URL ditolak server
// dan socket langsung putus (kode 1006) -> ronde tidak pernah mulai.
const waveFoto = (uid, a) => {
  const v = String(a ?? "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://43-156-99-4.sslip.io/avatar/${encodeURIComponent(String(uid))}`;
};

async function wavePlay(req, env) {
  const url = new URL(req.url);
  const ep = url.pathname.toLowerCase();
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type, token",
        "access-control-allow-methods": "GET, POST, OPTIONS",
      },
    });
  }
  let body = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));

  const tok = waveToken(req, url, body);
  let uidLog = "";
  const balas = async (o, status = 200) => {
    await waveLog(env, {
      ep, kode: status, alasan: o?.message ?? "", uid: uidLog,
      panjang: tok.length,
      ua: req.headers.get("user-agent"),
      ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "",
      isi: JSON.stringify({ method: req.method, body, hasil: o?.data ?? null }),
    });
    return waveJson(o, status);
  };
  if (!tok) return balas({ success: false, message: "Authorization token is required." }, 401);
  const uid = await waveUidDariToken(env, tok);
  if (!uid) return balas({ success: false, message: "Invalid or missing user information in the token." }, 233);
  uidLog = uid;

  if (ep.includes("userinfo")) {
    const pl = await hivePemain(env, uid);
    return balas({
      success: true,
      message: "User info fetched successfully",
      data: { id: uid, name: pl.name, balance: Number(pl.balance), profilePicture: waveFoto(uid, pl.avatar) },
    });
  }

  if (ep.includes("submitflow")) {
    const amount = Math.trunc(Number(body.betAmount ?? 0));
    const kind = Math.trunc(Number(body.type ?? 0));
    const tx = String(body.transactionId ?? body.transaction_id ?? body.txnId ?? "").trim()
      || `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!Number.isFinite(amount) || amount < 0 || (kind !== 1 && kind !== 2)) {
      return balas({ success: false, message: "Please Provide betAmount and type." }, 422);
    }
    if (amount === 0) {
      const pl = await hivePemain(env, uid);
      return balas({ success: true, message: "success", data: { id: uid, balance: Number(pl.balance), name: pl.name, profilePicture: waveFoto(uid, pl.avatar) } });
    }
    const resp = await hiveUang(env, uid, {
      kind,
      amount,
      orderId: `wave_${tx}`,
      roundId: String(body.roundId ?? body.round ?? ""),
      game: `wave:${String(body.gameName ?? body.gameId ?? "")}`,
    });
    const r = await resp.json().catch(() => null);
    if (!r || r.ok !== 1) {
      const pl = await hivePemain(env, uid);
      const msg = String(r?.e ?? "").toLowerCase().includes("tidak cukup") ? "Saldo coin tidak cukup" : "Transaksi ditolak";
      return balas({ success: false, message: msg, data: { id: uid, balance: Number(pl.balance) } }, 200);
    }
    const plAkhir = await hivePemain(env, uid);
    return balas({
      success: true,
      message: "success",
      data: {
        id: uid,
        balance: Number(r.w?.coins ?? r.coins ?? 0),
        name: plAkhir.name,
        profilePicture: waveFoto(uid, plAkhir.avatar),
      },
    });
  }

  return balas({ success: false, message: "Endpoint tidak dikenal" }, 404);
}

async function hivePemain(env, uid) {
  const r = await pipe(env, [
    { sql: "select name, avatar from wave_players where uid = ?", args: [T(uid)] },
  ]);
  const row = r[0].rows[0] ?? {};
  const w = await pastikan(env, uid);
  return {
    id: uid,
    name: String(row.name ?? "").trim() || "Player",
    avatar: String(row.avatar ?? ""),
    balance: Number(w?.coins ?? 0),
  };
}

/* ================= GAME REZO (HTML5 buatan sendiri) =================
   Game hanya menggambar. Hasil putaran, potong coin, dan kemenangan
   diputuskan di sini supaya tidak bisa diakali dari sisi HP.
   Pemain membuka game dengan ?code=uid.exp.md5(uid.exp.rezo-game-2026) */
const GAME_SALT = "rezo-game-2026";
const GAME_TARUHAN_MIN = 100;
const GAME_TARUHAN_MAX = 50000000;

// [kode, bobot, bayaran untuk 3/4/5 sama x taruhan]
const GAME_SIMBOL = [
  ["zeus", 1, [9.5, 38, 115]],
  ["mahkota", 2, [6.5, 29, 92]],
  ["petir", 4, [5, 19, 58]],
  ["kuil", 6, [4, 14, 38]],
  ["helm", 8, [3, 9.5, 29]],
  ["piala", 10, [2.4, 7, 24]],
  ["cincin", 13, [2, 6, 19]],
  ["permata", 16, [1.4, 4.8, 14]],
];
const GAME_BOBOT = GAME_SIMBOL.reduce((a, s) => a + s[1], 0);
const GAME_WILD = 1;

/** code bertanda tangan dari app: uid.exp.md5(uid.exp.salt) */
function gameUid(code) {
  const p = String(code || "").split(".");
  if (p.length !== 3) return null;
  const uid = p[0], exp = Number(p[1]);
  if (!uid || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  if (md5hex(uid + "." + p[1] + "." + GAME_SALT) !== p[2]) return null;
  return uid;
}

function gameAcak() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 4294967296;
}

function gameSimbol() {
  let r = gameAcak() * GAME_BOBOT;
  for (let i = 0; i < GAME_SIMBOL.length; i++) {
    r -= GAME_SIMBOL[i][1];
    if (r <= 0) return i;
  }
  return GAME_SIMBOL.length - 1;
}

/** Satu putaran 5x3: tiga baris ditambah dua diagonal. */
function gamePutaran() {
  const grid = [];
  for (let r = 0; r < 3; r++) {
    const baris = [];
    for (let c = 0; c < 5; c++) baris.push(gameSimbol());
    grid.push(baris);
  }
  const lines = [
    grid[0].slice(),
    grid[1].slice(),
    grid[2].slice(),
    [grid[0][0], grid[1][1], grid[2][2], grid[1][3], grid[0][4]],
    [grid[2][0], grid[1][1], grid[0][2], grid[1][3], grid[2][4]],
  ];
  const dapat = [];
  let kali = 0;
  lines.forEach((ln, idx) => {
    const dasar = ln[0];
    let n = 1;
    for (let c = 1; c < 5; c++) {
      if (ln[c] === dasar || ln[c] === GAME_WILD) n++;
      else break;
    }
    if (n < 3) return;
    const pay = GAME_SIMBOL[dasar][2][n - 3];
    if (pay > 0) {
      kali += pay;
      dapat.push({ line: idx, count: n, pay });
    }
  });
  return { grid, kali, lines: dapat };
}

async function gameState(env, uid) {
  const w = await pastikan(env, uid);
  const pl = await hivePemain(env, uid).catch(() => null);
  return ok({
    uid,
    coins: Number(w.coins),
    name: (pl && pl.name) || "Player",
    avatar: (pl && pl.avatar) || "",
    taruhanMin: GAME_TARUHAN_MIN,
  });
}

async function gameSpin(env, uid, p) {
  const bet = Math.trunc(Number(p.bet ?? 0));
  if (!Number.isFinite(bet) || bet < GAME_TARUHAN_MIN) return gagal("Taruhan minimal " + GAME_TARUHAN_MIN);
  if (bet > GAME_TARUHAN_MAX) return gagal("Taruhan terlalu besar");
  const now = Date.now();
  const put = gamePutaran();
  const menang = Math.floor(bet * put.kali);
  // Satu perintah: potong taruhan, tambah kemenangan, hanya kalau coin cukup.
  const r = await pipe(env, [
    {
      sql: "update wallets set coins = coins - ? + ?, updated_at = ? where uid = ? and coins >= ?",
      args: [I(bet), I(menang), I(now), T(uid), I(bet)],
    },
    { sql: "select changes() as c", args: [] },
  ]);
  if (Number(r[1]?.rows?.[0]?.c ?? 0) === 0) {
    const w0 = await pastikan(env, uid);
    return gagal("Coin tidak cukup. Saldo " + Number(w0.coins));
  }
  const catat = [
    { sql: "insert into money_tx (uid, kind, amount, created_at) values (?,?,?,?)",
      args: [T(uid), T("game_bet"), I(-bet), I(now)] },
  ];
  if (menang > 0) {
    catat.push({ sql: "insert into money_tx (uid, kind, amount, created_at) values (?,?,?,?)",
      args: [T(uid), T("game_win"), I(menang), I(now)] });
  }
  await pipe(env, catat).catch(() => {});
  const w = await pastikan(env, uid);
  return ok({
    uid, bet, kali: put.kali, win: menang, grid: put.grid,
    lines: put.lines, coins: Number(w.coins),
    simbol: GAME_SIMBOL.map((s) => s[0]),
  });
}

async function hivePlay(req, env) {
  const ep = new URL(req.url).pathname.toLowerCase();
  if (ep.includes("version")) {
    return json({ ok: 1, v: "hive-2026-11-03a", md5_abc: md5hex("abc") });
  }
  if (req.method !== "POST") return hiveFail("POST only", 405);
  let body = {};
  try { body = await req.json(); } catch { return hiveFail("body bukan JSON", 400); }

  const nonce = String(body.signature_nonce ?? "");
  const ts = Number(body.timestamp ?? 0);
  const sig = String(body.signature ?? "");
  if (!nonce || !ts || !sig) return hiveFail("signature tidak lengkap", 400);
  if (Math.abs(Date.now() / 1000 - ts) > HIVE_MAX_SKEW) return hiveFail("timestamp kadaluarsa", 400);
  if (md5hex(nonce + HIVE_KEY + ts) !== sig) return hiveFail("signature salah", 400);
  if (String(body.app_id ?? "") !== HIVE_APP_ID) return hiveFail("app_id tidak dikenal", 400);

  if (ep.includes("get_sstoken")) {
    const uid = hiveReadCode(body.code);
    if (!uid) return hiveFail("code tidak valid", 400);
    await pastikan(env, uid);
    return hiveOk({ ss_token: hiveSsToken(uid), expire_date: Date.now() + 365 * 24 * 3600 * 1000 });
  }

  if (ep.includes("get_user_info")) {
    const uid = hiveReadToken(body.ss_token);
    if (!uid) return hiveFail("ss_token tidak valid", 401);
    if (String(body.user_id ?? "") && String(body.user_id) !== uid) {
      return hiveFail("user_id tidak cocok", 401);
    }
    const pl = await hivePemain(env, uid);
    return hiveOk({
      user_id: uid,
      user_name: pl.name,
      user_avatar: pl.avatar,
      balance: hiveSafe(pl.balance),
      currency_balance: hiveSafe(pl.balance),
    });
  }

  if (ep.includes("change_balance")) {
    const uid = hiveReadToken(body.ss_token);
    if (!uid) return hiveFail("ss_token tidak valid", 401);
    const orderId = String(body.order_id ?? "");
    if (!orderId) return hiveFail("order_id kosong", 400);
    const diff = Math.trunc(Number(body.currency_diff ?? 0));
    if (!Number.isFinite(diff)) return hiveFail("currency_diff tidak valid", 400);
    if (diff === 0) {
      const pl = await hivePemain(env, uid);
      return hiveOk({ currency_balance: hiveSafe(pl.balance) });
    }
    const resp = await hiveUang(env, uid, {
      kind: diff < 0 ? 1 : 2,
      amount: Math.abs(diff),
      orderId: `hive_${orderId}`,
      roundId: String(body.game_round_id ?? body.room_id ?? ""),
      game: `hive:${String(body.game_id ?? "")}`,
    });
    // hiveUang mengembalikan Response, jadi hasilnya dibaca sebagai JSON dulu.
    const r = await resp.json().catch(() => null);
    if (!r || r.ok !== 1) {
      // Saldo kurang atau order bermasalah: laporkan angka saldo terbaru.
      const pl = await hivePemain(env, uid);
      return hiveFail(r?.e ?? "gagal memperbarui saldo", 500, { currency_balance: hiveSafe(pl.balance) });
    }
    return hiveOk({ currency_balance: hiveSafe(r.w?.coins ?? r.coins) });
  }

  return hiveFail("endpoint tidak dikenal", 404);
}

/**
 * Katalog game Hive lewat server kita sendiri. HP yang jaringannya memblokir
 * domain katalog Hive tetap bisa mengambil daftar lewat Worker, jadi game yang
 * dihapus/ditambah di console Hive selalu ikut tanpa update APK.
 */
async function hiveKatalog() {
  const ts = String(Date.now());
  const nonce = ts + String(1000 + Math.floor(Math.random() * 9000));
  const sig = md5hex(HIVE_APP_ID + HIVE_KEY + nonce + ts);
  const r = await fetch("https://api2023.duolepoker.com/v1/h5-game/third/game_info", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ appId: HIVE_APP_ID, timestamp: ts, nonce, signature: sig, env: "prod" }),
  });
  const t = await r.text();
  return new Response(t, {
    status: r.ok ? 200 : 502,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ---------- OTP lewat WhatsApp (gateway di VPS Helipod) ----------
// Login nomor tanpa biaya SMS: server membuat 6 angka, mengirimnya lewat
// WhatsApp, lalu app menukarnya dengan membuat/masuk akun email+password
// Firebase yang memakai nomor sebagai nama akun.
const OTP_MASA = 5 * 60 * 1000;      // kode berlaku 5 menit
const OTP_JEDA = 60 * 1000;          // jarak minimal antar kirim
const OTP_MAKS_KIRIM = 5;            // maksimal kirim per nomor per 15 menit
const OTP_MAKS_COBA = 5;             // maksimal salah kode

let siapTabelOtp = false;
async function pastikanTabelOtp(env) {
  if (siapTabelOtp) return;
  await pipe(env, [{
    sql: "create table if not exists otp (nomor text primary key, kode text, exp integer, kirim integer, coba integer, at integer)",
  }]);
  siapTabelOtp = true;
}

function nomorRapi(v) {
  let n = String(v ?? "").replace(/[^0-9]/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  return n;
}

async function kirimWa(env, nomor, pesan) {
  const url = String(env.WA_OTP_URL || "http://127.0.0.1:8099");
  const secret = String(env.WA_OTP_SECRET || "");
  if (!secret) throw new Error("WA_OTP_SECRET belum diisi di server");
  const r = await fetch(url.replace(/\/$/, "") + "/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-secret": secret },
    body: JSON.stringify({ nomor, pesan }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error("Gateway WhatsApp: " + String(j?.e || r.status));
  return true;
}

async function otpMinta(env, b) {
  const nomor = nomorRapi(b?.nomor);
  if (nomor.length < 9 || nomor.length > 15) return json({ ok: 0, e: "Nomor tidak valid" }, 400);
  await pastikanTabelOtp(env);
  const now = Date.now();
  const lama = (await pipe(env, [{ sql: "select kode, exp, kirim, coba, at from otp where nomor = ?", args: [T(nomor)] }]))[0]?.rows?.[0];
  if (lama) {
    const sejak = now - Number(lama.at || 0);
    if (sejak < OTP_JEDA) {
      return json({ ok: 0, e: "Tunggu " + Math.ceil((OTP_JEDA - sejak) / 1000) + " detik sebelum minta kode lagi", tunggu: Math.ceil((OTP_JEDA - sejak) / 1000) }, 429);
    }
    if (sejak < 15 * 60 * 1000 && Number(lama.kirim || 0) >= OTP_MAKS_KIRIM) {
      return json({ ok: 0, e: "Terlalu sering minta kode, coba lagi nanti" }, 429);
    }
  }
  const kirimKe = lama && now - Number(lama.at || 0) < 15 * 60 * 1000 ? Number(lama.kirim || 0) + 1 : 1;
  const kode = String(Math.floor(100000 + Math.random() * 900000));
  const exp = now + OTP_MASA;
  // Kode ditaruh dalam blok monospace: di WhatsApp tinggal diketuk untuk
  // menyalin, tidak perlu tekan-lama dan menyeret seleksi.
  const pesan =
    "Viza\n\nKode masuk Anda ada di pesan berikutnya. Berlaku 5 menit.\n" +
    "Jangan beri kode ini ke siapa pun, termasuk yang mengaku admin.";
  await kirimWa(env, nomor, pesan);
  // Pesan kedua hanya berisi angka: tekan-tahan lalu Salin, atau muncul
  // sebagai saran kode di keyboard banyak HP.
  await kirimWa(env, nomor, String(kode));
  await pipe(env, [{
    sql: "insert into otp (nomor, kode, exp, kirim, coba, at) values (?,?,?,?,0,?) on conflict(nomor) do update set kode=excluded.kode, exp=excluded.exp, kirim=excluded.kirim, coba=0, at=excluded.at",
    args: [T(nomor), T(kode), I(exp), I(kirimKe), I(now)],
  }]);
  return json({ ok: 1, kirim: kirimKe });
}

async function otpCek(env, b) {
  const nomor = nomorRapi(b?.nomor);
  const kode = String(b?.kode ?? "").replace(/[^0-9]/g, "");
  if (!nomor || kode.length !== 6) return json({ ok: 0, e: "Kode harus 6 angka" }, 400);
  await pastikanTabelOtp(env);
  const now = Date.now();
  const row = (await pipe(env, [{ sql: "select kode, exp, coba from otp where nomor = ?", args: [T(nomor)] }]))[0]?.rows?.[0];
  if (!row) return json({ ok: 0, e: "Minta kode dulu" }, 404);
  if (now > Number(row.exp || 0)) return json({ ok: 0, e: "Kode sudah kedaluwarsa" }, 410);
  if (Number(row.coba || 0) >= OTP_MAKS_COBA) return json({ ok: 0, e: "Terlalu banyak salah, minta kode baru" }, 429);
  if (String(row.kode) !== kode) {
    await pipe(env, [{ sql: "update otp set coba = coba + 1 where nomor = ?", args: [T(nomor)] }]);
    return json({ ok: 0, e: "Kode salah" }, 401);
  }
  await pipe(env, [{ sql: "delete from otp where nomor = ?", args: [T(nomor)] }]);
  return json({ ok: 1, nomor });
}


/** Unduhan APK: berkas disimpan di /opt/rezo-api/apk oleh skrip update VPS. */
async function unduhApk(jalur, env) {
  const DIR = "/opt/rezo-api/apk";
  const daftar = {
    "universal": "REZO-STAR-universal.apk",
    "arm64": "REZO-STAR-arm64.apk",
    "armv7": "REZO-STAR-armv7.apk",
  };
  const nama = jalur.replace(/^\/unduh\/?/i, "").replace(/[^A-Za-z0-9_.-]/g, "");
  let fs, path;
  try {
    fs = await import("node:fs/promises");
    path = await import("node:path");
  } catch (e) {
    return null; // bukan Node (mis. Cloudflare): biarkan ditangani jalur lain
  }
  if (!nama) {
    const versi = await fs.readFile(path.join(DIR, "versi.txt"), "utf8").catch(() => "");
    const baris = Object.entries(daftar).map(([k, f]) =>
      `<li><a href="/unduh/${k}">Unduh APK ${k}</a></li>`).join("");
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Unduh REZO</title>
<style>body{font-family:system-ui,sans-serif;background:#0a0f1e;color:#eef;margin:0;padding:28px}
h1{font-size:20px}ul{line-height:2.2;padding-left:18px}a{color:#f5c542}</style></head>
<body><h1>Unduh REZO Chat Voice</h1>
<p>Versi terbaru: <b>${versi.trim() || "-"}</b></p><ul>${baris}</ul>
<p style="color:#889">Pilih universal kalau tidak yakin dengan tipe HP.</p></body></html>`;
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  const berkas = daftar[nama] || nama;
  if (!/^REZO-STAR-[A-Za-z0-9_.-]+\.apk$/.test(berkas)) {
    return new Response("Berkas tidak dikenal", { status: 404 });
  }
  const lokasi = path.join(DIR, berkas);
  try {
    const st = await fs.stat(lokasi);
    const isi = await fs.readFile(lokasi);
    return new Response(isi, {
      status: 200,
      headers: {
        "content-type": "application/vnd.android.package-archive",
        "content-length": String(st.size),
        "content-disposition": `attachment; filename="${berkas}"`,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response("Berkas belum tersedia", { status: 404 });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    await siapTabel(env).catch(() => {});
    if (url.pathname === "/panel" && req.method === "GET") {
      return Response.redirect(url.origin + "/panel/", 308);
    }
    if (req.method === "GET" && url.pathname.startsWith("/panel/")) {
      return await panelBerkas(url.pathname);
    }
    if (url.pathname === "/panel") {
      const b = await req.json().catch(() => null);
      if (!b) return json({ ok: 0, e: "Body tidak valid" }, 400);
      return await panel(env, b);
    }
    if (url.pathname === "/seller") {
      const b = await req.json().catch(() => null);
      if (!b) return json({ ok: 0, e: "Body tidak valid" }, 400);
      const sesi = await sesiDariToken(b.t ?? "");
      if (!sesi) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
      try { return await sellerApi(env, sesi, b); }
      catch (e) { return gagal(String(e?.message ?? "Server seller sibuk")); }
    }
    if (
      url.pathname.toLowerCase().startsWith("/berkas/") ||
      url.pathname.toLowerCase().startsWith("/aset/")
    ) {
      const awalan = url.pathname.toLowerCase().startsWith("/berkas/") ? "/berkas/" : "/aset/";
      const nm = decodeURIComponent(url.pathname.slice(awalan.length));
      try {
        try {
          const buf = await asetBacaDisk(nm);
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": mimeDariExt((nm.split(".").pop() || "").toLowerCase()),
              "Cache-Control": "public, max-age=31536000, immutable",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (eDisk) { /* bukan di disk, lanjut ke database */ }
        try { await asetPastikan(env); } catch (e0) { /* tabel mungkin belum ada */ }
        const rA = await pipe(env, [
          { sql: "select mime, b64 from aset_file where nama = ?", args: [nm] },
        ]);
        const row = rA[0].rows[0];
        if (!row) return new Response("", { status: 404 });
        const bin = Uint8Array.from(atob(String(row.b64)), (c) => c.charCodeAt(0));
        return new Response(bin, {
          status: 200,
          headers: {
            "Content-Type": String(row.mime || "application/octet-stream"),
            // Nama file unik, jadi aman di-cache lama.
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        return new Response("aset tidak ditemukan: " + String(e?.message ?? e), { status: 404 });
      }
    }
    if (url.pathname.toLowerCase() === "/aset-upload") {
      // Jalur cepat: biner mentah (tanpa base64), parameter lewat query string.
      if (url.searchParams.get("raw") === "1") {
        const sesiR = await sesiDariToken(url.searchParams.get("t") ?? "");
        if (!sesiR) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
        if (!adalahAdmin(sesiR)) return json({ ok: 0, e: "Hanya admin" }, 403);
        try {
          const buf = Buffer.from(await req.arrayBuffer());
          return await asetUpload(env, {
            b64: buf.toString("base64"),
            name: url.searchParams.get("name") || "aset",
            ext: url.searchParams.get("ext") || "png",
            gh: url.searchParams.get("gh") || "",
          });
        } catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 502); }
      }
      const bA = await req.json().catch(() => null);
      if (!bA) return json({ ok: 0, e: "Body tidak valid" }, 400);
      const sesiA = await sesiDariToken(bA.t ?? "");
      if (!sesiA) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
      if (!adalahAdmin(sesiA)) return json({ ok: 0, e: "Hanya admin" }, 403);
      try { return await asetUpload(env, bA); }
      catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 502); }
    }
    if (url.pathname.toLowerCase() === "/aset-list") {
      const sesiL = await sesiDariToken(url.searchParams.get("t") ?? "");
      if (!sesiL) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
      if (!adalahAdmin(sesiL)) return json({ ok: 0, e: "Hanya admin" }, 403);
      try { return json({ ok: 1, list: await asetDaftar(env) }); }
      catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 502); }
    }
    if (url.pathname.toLowerCase() === "/aset-hapus") {
      const bH = await req.json().catch(() => null);
      if (!bH) return json({ ok: 0, e: "Body tidak valid" }, 400);
      const sesiH = await sesiDariToken(bH.t ?? "");
      if (!sesiH) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
      if (!adalahAdmin(sesiH)) return json({ ok: 0, e: "Hanya admin" }, 403);
      const nm = String(bH.nama ?? "").replace(/[^A-Za-z0-9._-]/g, "");
      if (!nm) return json({ ok: 0, e: "Nama berkas kosong" }, 400);
      try { await asetHapus(env, nm); return json({ ok: 1, nama: nm }); }
      catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 502); }
    }
    // Harga VIP terbaru untuk aplikasi (tanpa perlu build baru).
    if (url.pathname.toLowerCase() === "/vip-harga") {
      await hargaVipKini();
      return json({ ok: 1, harga: HARGA_VIP.slice(1) });
    }
    if (url.pathname.toLowerCase() === "/chatimg") {
      // Gambar chat room disimpan di VPS sendiri. Supabase menolak unggahan
      // (402: layanan project dibatasi), jadi tidak dipakai lagi.
      if (req.method !== "POST") return json({ ok: 0, e: "Pakai POST" }, 405);
      const sesiC = await sesiDariToken(url.searchParams.get("t") ?? "");
      if (!sesiC) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
      const extC = (url.searchParams.get("ext") || "jpg").toLowerCase().replace(/[^a-z]/g, "").slice(0, 4) || "jpg";
      if (!/^(jpg|jpeg|png|webp|gif)$/.test(extC)) return json({ ok: 0, e: "Format tidak didukung" }, 400);
      let bufC;
      try { bufC = Buffer.from(await req.arrayBuffer()); }
      catch (e) { return json({ ok: 0, e: "Isi tidak terbaca" }, 400); }
      if (!bufC.length) return json({ ok: 0, e: "Isi kosong" }, 400);
      if (bufC.length > 6 * 1024 * 1024) return json({ ok: 0, e: "Gambar lebih dari 6 MB" }, 413);
      const uidC = String(sesiC.uid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "umum";
      const namaC = "chat_" + uidC + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "." + extC;
      try {
        await asetSimpanDisk(namaC, bufC.toString("base64"));
        return json({ ok: 1, url: VPS_ASET + "/" + namaC });
      } catch (e) { return json({ ok: 0, e: "Gagal menyimpan: " + String(e?.message ?? e) }, 500); }
    }
/** Kirim email lewat Resend. Kunci disimpan di server, bukan di app. */
async function kirimEmail(env, ke, subjek, isiHtml, isiTeks, kunci) {
  const key = kunci || env.RESEND_KEY || env.RESEND_API_KEY || "";
  if (!key) throw new Error("RESEND_KEY belum diisi di server");
  const dari = env.RESEND_DARI || "REZO <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from: dari, to: [ke], subject: subjek, html: isiHtml, text: isiTeks || undefined }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Resend " + r.status + ": " + String(j?.message || j?.error || "").slice(0, 160));
  return j;
}

    if (url.pathname.toLowerCase() === "/email/uji") {
      // Uji kirim email. Hanya bisa dengan kunci Resend milik server sendiri.
      if (req.method !== "POST") return json({ ok: 0, e: "Pakai POST" }, 405);
      const keyU = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      const keyE = env.RESEND_KEY || env.RESEND_API_KEY || "";
      const pakai = keyE || keyU;
      if (!pakai) return json({ ok: 0, e: "Kunci Resend belum diisi" }, 401);
      if (keyE && keyU && keyE !== keyU) return json({ ok: 0, e: "Kunci tidak cocok" }, 401);
      let bU = {};
      try { bU = await req.json(); } catch (e) { bU = {}; }
      const keU = String(bU.ke || "").trim();
      if (!keU.includes("@")) return json({ ok: 0, e: "Alamat email tidak sah" }, 400);
      try {
        const hasil = await kirimEmail(
          env,
          keU,
          String(bU.subjek || "Uji email REZO"),
          "<p>Email dari server REZO berhasil terkirim. Sistem email sudah aktif.</p>",
          "Email dari server REZO berhasil terkirim.",
          pakai,
        );
        return json({ ok: 1, id: hasil?.id || "", sumber: keyE ? "server" : "kunci-uji" });
      } catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 500); }
    }
    if (url.pathname === "/admin") {
      const b = await req.json().catch(() => null);
      if (!b) return json({ ok: 0, e: "Body tidak valid" }, 400);
      return await admin(env, b);
    }
    if (url.pathname === "/hivecatalog") {
      try { return await hiveKatalog(); } catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 502); }
    }
    if (url.pathname.toLowerCase().startsWith("/g/")) {
      const epG = url.pathname.toLowerCase();
      const bG = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      const uidGame = gameUid(bG.code);
      if (!uidGame) return gagal("Sesi game tidak sah, buka ulang game dari app");
      await pastikan(env, uidGame);
      if (epG.includes("state")) return await gameState(env, uidGame);
      if (epG.includes("spin")) return await gameSpin(env, uidGame, bG);
      return gagal("Endpoint game tidak dikenal");
    }
    if (url.pathname.toLowerCase() === "/wavelog") {
      try {
        await waveLogPastikan(env);
        const r = await pipe(env, [
          { sql: "select waktu, ep, kode, alasan, uid, panjang_token, ua, ip, isi from wave_log order by id desc limit 40", args: [] },
        ]);
        return json({ ok: 1, w: r[0].rows });
      } catch (e) {
        return json({ ok: 0, e: String(e?.message ?? e) }, 500);
      }
    }
    if (url.pathname.toLowerCase().startsWith("/avatar/")) {
      const uidAv = decodeURIComponent(url.pathname.slice("/avatar/".length));
      try {
        const rAv = await pipe(env, [
          { sql: "select avatar from wave_players where uid = ?", args: [T(uidAv)] },
        ]);
        let av = String(rAv[0].rows[0]?.avatar ?? "").trim();
        if (!av) return new Response("", { status: 404 });
        if (/^https?:\/\//i.test(av)) return Response.redirect(av, 302);
        av = av.replace(/^data:image\/[a-z]+;base64,/i, "").replace(/\s+/g, "");
        const bin = Uint8Array.from(atob(av), (c) => c.charCodeAt(0));
        const jenis = bin[0] === 0x89 ? "image/png" : bin[0] === 0x47 ? "image/gif" : "image/jpeg";
        return new Response(bin, {
          status: 200,
          headers: {
            "Content-Type": jenis,
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        return new Response("", { status: 404 });
      }
    }
    if (url.pathname.toLowerCase() === "/wave/token") {
      const bTok = req.method === "POST" ? await req.json().catch(() => ({})) : {};
      const t = String(bTok.t ?? url.searchParams.get("t") ?? "");
      const k = String(bTok.k ?? url.searchParams.get("k") ?? "");
      const adminKey = String(env.WAVE_KEY ?? "rezo-wave-2026-admin");
      // 1) app minta token pendek dengan JWT Firebase-nya
      if (t) {
        const uidApp = await uidDariToken(t);
        if (!uidApp) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
        const tk = await waveTokenBaru(env, uidApp, 3 * 3600);
        return json({ ok: 1, w: tk });
      }
      // 2) pembuatan token uji (khusus admin)
      if (k === adminKey && bTok.uid) {
        const hari = Math.max(1, Math.min(90, Number(bTok.hari ?? 30)));
        const tk = await waveTokenBaru(env, String(bTok.uid), hari * 86400);
        return json({ ok: 1, w: tk });
      }
      return json({ ok: 0, e: "Permintaan token tidak sah" }, 400);
    }
    // Game Greedy King milik REZO (server sendiri, chip diatur dari panel).
    // Unduhan APK langsung dari server sendiri. Tautan GitHub membuka aplikasi
    // GitHub di HP pengguna, jadi pengguna mendarat di layar login.
    if (url.pathname === "/unduh" || url.pathname.toLowerCase().startsWith("/unduh/")) {
      const jawab = await unduhApk(url.pathname, env);
      if (jawab) return jawab;
    }

    // Game slot (Zeus Treasures) memakai saldo dompet yang sama.
    if (url.pathname.toLowerCase().startsWith("/slot/")) {
      const jawab = await slotPlay(req, env, { pipe, json, T, I, uidDariToken });
      const kepala = new Headers(jawab.headers);
      kepala.set("access-control-allow-origin", "*");
      kepala.set("access-control-allow-headers", "authorization, content-type");
      kepala.set("access-control-allow-methods", "GET, POST, OPTIONS");
      return new Response(jawab.body, { status: jawab.status, headers: kepala });
    }
    if (url.pathname.toLowerCase().startsWith("/greedy/")) {
      const asal = req.headers.get("origin") || "*";
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": asal,
            "access-control-allow-headers": "authorization, content-type",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-max-age": "86400",
          },
        });
      }
      const jawab = await greedyPlay(req, env, { pipe, pipeTrx, json, gagal, T, I, uidDariToken });
      const kepala = new Headers(jawab.headers);
      kepala.set("access-control-allow-origin", asal);
      kepala.set("vary", "origin");
      return new Response(jawab.body, { status: jawab.status, headers: kepala });
    }
    if (url.pathname.toLowerCase().startsWith("/wave/")) {
      return await wavePlay(req, env);
    }
    if (url.pathname.toLowerCase().startsWith("/hive/")) {
      return await hivePlay(req, env);
    }
    if (url.pathname === "/otp/minta") {
      const b = await req.json().catch(() => null);
      if (!b) return json({ ok: 0, e: "Body tidak valid" }, 400);
      try { return await otpMinta(env, b); }
      catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 502); }
    }
    if (url.pathname === "/otp/cek") {
      const b = await req.json().catch(() => null);
      if (!b) return json({ ok: 0, e: "Body tidak valid" }, 400);
      try { return await otpCek(env, b); }
      catch (e) { return json({ ok: 0, e: String(e?.message ?? e) }, 502); }
    }
    // Tautan unduhan APK. Tanpa kunci yang benar, pengunjung melihat halaman
    // "504 Gateway Time-out" - jadi tautan ini tidak bisa dibagikan ke orang lain.
    if (url.pathname.toLowerCase() === "/unduh/apk") {
      const kunci = url.searchParams.get("k") || "";
      if (kunci !== APK_KEY) {
        return new Response(HALAMAN_504, {
          status: 504,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }
      return new Response(null, { status: 302, headers: { location: APK_ASLI } });
    }
    // Token suara room: LiveKit milik sendiri di VPS. App mengirim token login
    // Firebase, server ini yang menandatangani token LiveKit berumur panjang
    // supaya mikrofon tidak mati saat dipakai di tengah room.
    if (url.pathname.toLowerCase() === "/lktoken") {
      // Cukup izinkan dari app sendiri dan panel.
      const kepalaLk = req.headers.get("authorization") || "";
      const idLk = kepalaLk.toLowerCase().startsWith("bearer ") ? kepalaLk.slice(7).trim() : "";
      const uidLk = idLk ? await uidDariToken(idLk) : null;
      if (!uidLk) return json({ ok: 0, e: "Sesi tidak sah" }, 401);
      const kunciLk = String(env.LIVEKIT_API_KEY || "");
      const rahasiaLk = String(env.LIVEKIT_API_SECRET || "");
      const alamatLk = String(env.LIVEKIT_URL || "");
      if (!kunciLk || !rahasiaLk || !alamatLk) {
        return json({ ok: 0, e: "LiveKit belum diatur di server" }, 503);
      }
      let isiLk = {};
      try { isiLk = await req.json(); } catch { isiLk = {}; }
      const roomLk = (String(isiLk.room || url.searchParams.get("room") || "umum").replace(/[^0-9A-Za-z_.:-]/g, "") || "umum").slice(0, 64);
      const namaLk = String(isiLk.name || "").slice(0, 40);
      const kiniLk = Math.floor(Date.now() / 1000);
      const klaimLk = {
        iss: kunciLk, sub: uidLk, iat: kiniLk, nbf: kiniLk - 5, exp: kiniLk + 21600,
        jti: uidLk + "-" + kiniLk,
        video: { room: roomLk, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
      };
      if (namaLk) klaimLk.name = namaLk;
      let tokenLk = "";
      try { tokenLk = await jwtLiveKit(klaimLk, rahasiaLk); }
      catch (e) { return json({ ok: 0, e: "Token suara gagal dibuat" }, 500); }
      return json({ ok: 1, token: tokenLk, url: alamatLk, exp: klaimLk.exp });
    }
    if (url.pathname === "/health") {
      // Sekaligus buktikan database masih bisa dibaca.
      try {
        await pipe(env, [{ sql: "select 1 as ok" }]);
        const modeDb = dbGalat ? "sqlite bermasalah: " + dbGalat : "sqlite-lokal";
        // Ringkasan data staf: hanya jumlah dan peran, tanpa UID atau nama.
        let staf = 0, stafAktif = 0, peran = [];
        try {
          const r = await pipe(env, [
            { sql: "select count(*) c, coalesce(sum(active), 0) a from panel_staf" },
            { sql: "select role, count(*) n from panel_staf group by role" },
          ]);
          staf = Number(r[0].rows[0]?.c ?? 0);
          stafAktif = Number(r[0].rows[0]?.a ?? 0);
          peran = r[1].rows.map((x) => String(x.role) + ":" + Number(x.n));
        } catch (e) { /* tabel belum ada */ }
        return json({ ok: 1, v: "viza-2026-11-13-mandiri", db: 1, proj: PROJ_SAH, simpan: modeDb, email: (env.RESEND_KEY || env.RESEND_API_KEY) ? 1 : 0, staf, stafAktif, peran, node: typeof process !== "undefined" ? process.version : "?" });
      } catch (e) {
        return json({ ok: 0, v: "viza-2026-11-13-mandiri", db: String(e?.message ?? e) }, 500);
      }
    }
    if (req.method !== "POST") return gagal("Gunakan POST");

    let b;
    try { b = await req.json(); } catch { return gagal("Isi permintaan tidak terbaca"); }

    const aksi = String(b.a ?? "");
    const p = b.p ?? {};
    // App mengirim nama bersnake_case; samakan supaya satu jalur.
    p.itemId ??= p.item_id;
    p.roomId ??= p.room_id;

    // Pemanggilan dari app wajib membawa token login Firebase.
    const uidToken = await uidDariToken(String(b.t ?? ""));
    if (!uidToken) {
      await logGalat(env, klaimUid(String(b.t ?? "")), aksi, "token ditolak: " + (sesiAlasan || "-"));
      return json({ ok: 0, e: "Sesi tidak sah" }, 401);
    }

    // uid hanya boleh dirinya sendiri, kecuali deep link lama yang kosong.
    const uid = String(p.uid ?? uidToken);
    if (uid !== uidToken) {
      await logGalat(env, uid, aksi, "uid app beda dengan token: " + uidToken);
      return json({ ok: 0, e: "Sesi tidak sah" }, 401);
    }

    try {
      switch (aksi) {
        case "get": {
          try {
            return ok(await pastikan(env, uid));
          } catch (e) {
            await logGalat(env, uid, "get", String(e?.message ?? e));
            throw e;
          }
        }
        case "migrate":
          return ok(await pastikan(env, uid));
        case "send_gift":
          return await kirimGift(env, uid, p);
        case "topup":
          return await topup(env, uid, p);
        case "signin_claim":
          return await klaimSignin(env, uid, p);
        case "exchange":
          return await tukar(env, uid, p);
        case "buy_vip":
          return await beliVip(env, uid, p);
        case "buy_item":
          return await beliItem(env, uid, p);
        case "equip":
          return await pasangItem(env, uid, p);
        case "claim_level":
          return await klaimLevel(env, uid);
        case "backfill":
          return await backfillVip(env, uid);
        case "wave_prepare":
          return await wavePrepare(env, uid, p);
        case "gift_cashback":
          return await cashbackGift(env, uid, p);
        case "prop_list":
          return ok(await daftarProp(env, uid));
        case "prop_use":
          return await pakaiProp(env, uid, String(p.id ?? ""));
        case "rocket_claim":
          return await klaimRoket(env, uid, p);
        case "pay_info":
          return json({ ok: 1, pay: await infoBayar(env) });
        case "manual_create":
          return await topupManualBuat(env, uid, p);
        case "topup_status": {
          const id = String(p.order ?? p.id ?? "");
          const r = await pipe(env, [
            { sql: "select status from topup_manual where id = ? and uid = ?", args: [T(id), T(uid)] },
          ]);
          const st = r[0].rows[0]?.status;
          if (!st) return json({ ok: 0, e: "Pesanan tidak ditemukan" });
          const map = { pending: "pending", ok: "paid", tolak: "rejected" };
          return json({ ok: 1, order: { id, status: map[st] ?? st } });
        }
        case "manual_history":
          return await topupManualRiwayat(env, uid);
        case "hive_uang":
          return await hiveUang(env, uid, p);
        default:
          return gagal(`aksi ${aksi} tidak dikenali`);
      }
    } catch (e) {
      return gagal(String(e?.message ?? "Server dompet sibuk"));
    }
  },
};
