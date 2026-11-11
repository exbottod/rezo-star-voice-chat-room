/**
 * Penghubung game slot (Zeus Treasures) dengan dompet REZO di VPS.
 *
 * Uang di dalam game memakai satuan game (0.05 - 0.5 per koin taruhan).
 * Saldo dompet memakai koin bulat, jadi 1 uang game = 100 koin REZO.
 * Semua perubahan saldo dikirim ke server; nilai yang ditampilkan game selalu
 * diambil dari jawaban server, bukan dari hitungan layar.
 */
(function () {
  var SKALA = 100;
  var API = window.__SLOT_API__ || "https://43-156-99-4.sslip.io";
  var token = "";

  try {
    var q = new URLSearchParams(location.search);
    token = q.get("t") || q.get("token") || "";
  } catch (e) {}
  if (!token && window.RezoBridge && window.RezoBridge.token) {
    try { token = window.RezoBridge.token() || ""; } catch (e) {}
  }

  function minta(metode, jalur, isi) {
    return new Promise(function (selesai, gagal) {
      try {
        var x = new XMLHttpRequest();
        x.open(metode, API + jalur, true);
        x.setRequestHeader("authorization", "Bearer " + token);
        if (isi) x.setRequestHeader("content-type", "application/json");
        x.timeout = 12000;
        x.onload = function () {
          try { selesai(JSON.parse(x.responseText)); } catch (e) { gagal(e); }
        };
        x.onerror = x.ontimeout = function () { gagal(new Error("jaringan")); };
        x.send(isi ? JSON.stringify(isi) : null);
      } catch (e) { gagal(e); }
    });
  }

  // Saldo awal diambil sebelum game dibuat, supaya angka di layar langsung benar.
  var saldoAwal = null;
  try {
    var s = new XMLHttpRequest();
    s.open("GET", API + "/slot/info", false);
    s.setRequestHeader("authorization", "Bearer " + token);
    s.timeout = 10000;
    s.send(null);
    var j = JSON.parse(s.responseText || "{}");
    if (j && j.ok && typeof j.saldo === "number") saldoAwal = j.saldo;
  } catch (e) {}
  window.__REZO_SALDO__ = saldoAwal;
  window.RezoSlot = {
    saldo: function () { return window.__REZO_SALDO__; },
    segarkan: function () {
      return minta("GET", "/slot/info").then(function (j) {
        if (j && j.ok) window.__REZO_SALDO__ = j.saldo;
        return window.__REZO_SALDO__;
      }).catch(function () { return window.__REZO_SALDO__; });
    },
  };

  function kirim(bet, win, oData, cb) {
    minta("POST", "/slot/settle", { bet: Number(bet) || 0, win: Number(win) || 0 })
      .then(function (j) {
        if (j && j.ok) {
          window.__REZO_SALDO__ = j.saldo;
          if (typeof TOTAL_MONEY !== "undefined") TOTAL_MONEY = j.saldo;
          oData.money = j.saldo;
        }
        cb(oData);
      })
      .catch(function () { cb(oData); });
  }

  // Spin: taruhan sudah dipotong game, hasil menang ditambahkan; server yang
  // menyimpan saldo akhir.
  if (typeof APIAttemptSpin === "function") {
    var spinAsli = APIAttemptSpin;
    window.APIAttemptSpin = function (iCurBet, iCoin, iNumBettingLines, oCallback, oCallbackOwner) {
      spinAsli.call(this, iCurBet, iCoin, iNumBettingLines, function (oData) {
        kirim(iCurBet, oData && oData.tot_win ? oData.tot_win : 0, oData, function (hasil) {
          oCallback.call(oCallbackOwner, hasil);
        });
      }, oCallbackOwner);
    };
  }

  // Bonus juga menambah saldo, jadi ikut dicatat.
  if (typeof apiAttemptBonus === "function") {
    var bonusAsli = apiAttemptBonus;
    window.apiAttemptBonus = function (iCoin, oCallback, oCallbackOwner) {
      bonusAsli.call(this, iCoin, function (oData) {
        kirim(0, oData && oData.bonus_win ? oData.bonus_win : 0, oData, function (hasil) {
          oCallback.call(oCallbackOwner, hasil);
        });
      }, oCallbackOwner);
    };
  }
})();
