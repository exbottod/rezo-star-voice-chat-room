/**
 * Game Greedy King milik REZO.
 *
 * Semua uang memakai dompet yang sama (tabel wallets), jadi tidak ada saldo
 * terpisah. Hasil putaran ditentukan nomor putaran (SHA-256), bukan pemanggil,
 * supaya adil untuk semua pemain.
 */

export const ROUND_MS = 40000;
export const BET_MS = 30000;

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
export async function greedyPlay(req, env, h) {
  const { pipe, pipeTrx, json, gagal, T, I, uidDariToken } = h;
  const url = new URL(req.url);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const uid = token ? await uidDariToken(token) : "";
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
