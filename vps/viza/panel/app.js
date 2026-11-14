import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, signOut, createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, limit, where, serverTimestamp, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase, ref as dRef, set as dSet, get as dGet, update as dUpdate, remove as dRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getStorage, ref as sRef, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* ================= konfigurasi ================= */
const firebaseConfig = {
  apiKey: "AIzaSyAAm1ylv5H4McTNvOut_0UdgiAFdxBBumI",
  authDomain: "my-app-e7f8c.firebaseapp.com",
  projectId: "my-app-e7f8c",
  storageBucket: "my-app-e7f8c.firebasestorage.app",
  messagingSenderId: "622104139221",
  appId: "1:622104139221:android:294ad10f9eed7350acd95c",
  databaseURL: "https://my-app-e7f8c-default-rtdb.asia-southeast1.firebasedatabase.app"
};
const PEMILIK = "bangexx01@gmail.com";   // akun owner panel

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app);
enableIndexedDbPersistence(db).catch(() => {});

/* ================= util ================= */
const $ = (id) => document.getElementById(id);
const el = (tag, isi, cls) => {
  const e = document.createElement(tag);
  if (isi !== undefined) e.textContent = isi;
  if (cls) e.className = cls;
  return e;
};
const aman = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rupiah = (n) => new Intl.NumberFormat("id-ID").format(Number(n) || 0);
const waktu = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return "—";
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
let jamToast;
function toast(pesan, gagal = false) {
  const t = $("toast");
  t.textContent = pesan;
  t.className = "toast tampil" + (gagal ? " gagal" : "");
  clearTimeout(jamToast);
  jamToast = setTimeout(() => (t.className = "toast"), 3600);
}
const kumpulan = (nama) => collection(db, nama);

/** Aset VIP & item toko: APK membaca RTDB vipCfg lebih dulu (Firestore hanya cadangan),
 *  jadi semua simpan/hapus harus menulis ke keduanya. Kunci RTDB tidak boleh memuat . # $ [ ] / */
const kunciVip = (id) => String(id).replace(/[.#$\[\]/]/g, "_");
async function simpanVip(id, data) {
  let galat = null;
  try { await setDoc(doc(db, "vipConfig", id), data, { merge: true }); } catch (e) { galat = e; }
  try { await dUpdate(dRef(rtdb, "vipCfg/" + kunciVip(id)), data); galat = null; } catch (e) { if (galat) throw e; }
}
/** Hapus aset dari SEMUA tempat: dokumen Firestore bernama sama, dokumen lain
 *  yang membawa id yang sama, dan semua node RTDB dengan key atau id tersebut.
 *  Sebelumnya hanya satu salinan yang terhapus, jadi barisnya muncul lagi. */
async function hapusVip(id, kunci) {
  const galat = [];
  // 1) Firestore: dokumen vipConfig/<id> dan dokumen lain yang field id-nya sama.
  try { await deleteDoc(doc(db, "vipConfig", id)); } catch (e) { galat.push("firestore: " + (e.code || e.message)); }
  try {
    const snap = await getDocs(query(kumpulan("vipConfig"), limit(500)));
    for (const d of snap.docs) {
      if (d.id !== id && (d.data() || {}).id !== id) continue;
      try { await deleteDoc(d.ref); } catch (e) { galat.push("firestore " + d.id); }
    }
  } catch (e) { /* tanpa izin baca: cukup langkah 1 */ }
  // 2) RTDB: semua node yang key atau field id-nya cocok.
  try {
    const sn = await dGet(dRef(rtdb, "vipCfg"));
    if (sn.exists()) {
      const sasaran = [];
      sn.forEach((c) => {
        const v = c.val() || {};
        if (c.key === id || c.key === (kunci || "") || c.key === kunciVip(id) || v.id === id) sasaran.push(c.key);
      });
      for (const k of sasaran) {
        try { await dRemove(dRef(rtdb, "vipCfg/" + k)); } catch (e) { galat.push("rtdb " + k); }
      }
    }
  } catch (e) { galat.push("rtdb: " + (e.message || e)); }
  if (galat.length) throw new Error(galat.slice(0, 2).join(" · "));
}
/** Jual atau tarik item dari Store tanpa menghapus berkasnya. */
async function setStoreVip(item, jual) {
  await simpanVip(item.id, { store: jual, updatedAt: Date.now() });
  if (item._kunci && item._kunci !== item.id) {
    try { await dUpdate(dRef(rtdb, "vipCfg/" + item._kunci), { store: jual, updatedAt: Date.now() }); } catch (e) { /* sudah ditulis di simpanVip */ }
  }
}
async function ambilSemuaVip(batas = 400) {
  // Satu aset bisa ada di Firestore (vipConfig/<id>) dan RTDB (vipCfg/<kunci>).
  // Digabung berdasarkan id aset supaya tidak tampil sebagai baris ganda.
  const peta = new Map();
  const simpan = (obj, kunci) => {
    const id = String(obj.id || kunci || "");
    if (!id) return;
    const lama = peta.get(id) || {};
    peta.set(id, { ...lama, ...obj, id, _kunci: kunci || lama._kunci || kunciVip(id) });
  };
  try { (await ambilSemua("vipConfig", batas)).forEach((d) => simpan(d, d.id)); } catch (e) { /* Firestore cadangan */ }
  try {
    const sn = await dGet(dRef(rtdb, "vipCfg"));
    if (sn.exists()) sn.forEach((c) => simpan(c.val() || {}, c.key));
  } catch (e) { /* RTDB gagal: tetap pakai Firestore */ }
  return [...peta.values()];
}

async function ambilSemua(nama, batas = 500) {
  const snap = await getDocs(query(kumpulan(nama), limit(batas)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function catatLog(aksi, rincian = "") {
  try {
    await setDoc(doc(kumpulan("adminLogs")), {
      admin: auth.currentUser?.email || "?",
      aksi, rincian, waktu: serverTimestamp()
    });
  } catch (e) { /* log gagal tidak menghentikan aksi */ }
}

/* ================= unggah berkas ================= */
const TIPE_BERKAS = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svga: "application/octet-stream", json: "application/json",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", ogg: "audio/ogg"
};
const TERIMA_BERKAS = ".png,.jpg,.jpeg,.webp,.gif,.svga,.json,.mp4,.webm,.mp3,.ogg";

/** Baca berkas jadi base64 tanpa awalan data URL. */
async function bacaB64(berkas) {
  const data = await new Promise((ok, gagal) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result || ""));
    fr.onerror = () => gagal(new Error("Berkas tidak bisa dibaca"));
    fr.readAsDataURL(berkas);
  });
  return data.replace(/^data:[^,]+,/, "");
}

async function unggahBerkas(berkas, folder, lapor) {
  const namaAman = String(berkas.name || "aset").replace(/[^a-zA-Z0-9._-]/g, "_");
  const ekstensi = namaAman.split(".").pop().toLowerCase();

  // 1) Jalur utama: simpan di VPS dompet Viza. Tidak perlu Firebase Storage.
  try {
    if (berkas.size > 8 * 1024 * 1024) throw new Error("Berkas lebih dari 8 MB, kecilkan dulu");
    if (lapor) lapor(0);
    const t = await auth.currentUser?.getIdToken();
    if (!t) throw new Error("Sesi login tidak ada, muat ulang panel");
    const dasar = folder + "-" + namaAman.replace(/\.[^.]+$/, "");
    // Kirim biner mentah: tidak membengkak seperti base64, dan persentasenya asli.
    const alamat = DOMPET_BASE + "/aset-upload?raw=1"
      + "&t=" + encodeURIComponent(t)
      + "&name=" + encodeURIComponent(dasar)
      + "&ext=" + encodeURIComponent(ekstensi);
    const j = await new Promise((selesai, gagal) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", alamat, true);
      xhr.setRequestHeader("Content-Type", berkas.type || TIPE_BERKAS[ekstensi] || "application/octet-stream");
      xhr.timeout = 180000;
      xhr.upload.onprogress = (e) => {
        if (!lapor) return;
        if (e.lengthComputable) lapor(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        else lapor(50);
      };
      xhr.onload = () => {
        let hasil = null;
        try { hasil = JSON.parse(xhr.responseText || "null"); } catch (e) { /* bukan JSON */ }
        if (hasil && hasil.ok && hasil.url) return selesai(hasil);
        gagal(new Error((hasil && hasil.e) || ("HTTP " + xhr.status)));
      };
      xhr.onerror = () => gagal(new Error("Jaringan terputus saat mengunggah"));
      xhr.ontimeout = () => gagal(new Error("Unggahan lebih dari 3 menit, coba lagi atau kecilkan berkas"));
      xhr.send(berkas);
    });
    if (lapor) lapor(100);
    return j.url;
  } catch (eVps) {
    if (lapor) lapor(0);
    window.__galatVps = String(eVps?.message || eVps);
  }

  // 2) Cadangan: Firebase Storage, hanya kalau VPS menolak.
  const jalur = `aset/${folder}/${Date.now()}-${namaAman}`;
  const rujukan = sRef(storage, jalur);
  const tugas = uploadBytesResumable(rujukan, berkas, {
    contentType: berkas.type || TIPE_BERKAS[ekstensi] || "application/octet-stream",
    cacheControl: "public,max-age=31536000"
  });
  await new Promise((selesai, gagal) => {
    tugas.on("state_changed",
      (s) => { if (lapor) lapor(Math.round((s.bytesTransferred / s.totalBytes) * 100)); },
      gagal, selesai);
  });
  return await getDownloadURL(rujukan);
}

/** Markah pemilih sumber: lewat tautan atau unggah berkas dari perangkat. */
function htmlSumber(id, urlAwal = "", terima = TERIMA_BERKAS) {
  return `
    <div data-sumber="${id}">
      <div class="tabSumber">
        <div class="pil on" data-mode="link">Pakai tautan</div>
        <div class="pil" data-mode="file">Unggah dari perangkat</div>
      </div>
      <div data-bagian="link" style="margin-top:8px">
        <div class="isian"><label>Tautan berkas (SVGA, WEBP, PNG, GIF, MP4)</label>
          <input id="${id}Url" value="${aman(urlAwal)}" placeholder="https://…/animasi.svga"></div>
      </div>
      <div data-bagian="file" style="margin-top:8px;display:none">
        <div class="isian"><label>Pilih berkas dari perangkat</label>
          <input id="${id}File" type="file" accept="${terima}">
          <div class="kemajuan" id="${id}Progres"></div></div>
      </div>
      <div class="kotakPratinjau">
        <div class="judulPratinjau">Pratinjau</div>
        <div class="layarPratinjau" id="${id}Pra"><span class="kosongPra">Belum ada berkas</span></div>
        <div class="infoPratinjau" id="${id}PraInfo"></div>
        <div class="alasPratinjau">
          <span data-alas="gelap" class="on">Gelap</span><span data-alas="terang">Terang</span><span data-alas="kotak">Kotak</span>
        </div>
      </div>
    </div>`;
}

/* ---------- pratinjau langsung ---------- */
let pemutarSvgaPromise;
function muatPemutarSvga() {
  if (window.SVGA) return Promise.resolve();
  if (!pemutarSvgaPromise) {
    pemutarSvgaPromise = new Promise((ok, gagal) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/svgaplayerweb@2.3.1/build/svga.min.js";
      s.onload = ok; s.onerror = () => gagal(new Error("pemutar SVGA gagal dimuat"));
      document.head.appendChild(s);
    });
  }
  return pemutarSvgaPromise;
}

function ukuranBerkas(b) {
  if (!b) return "";
  return b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB";
}

const tokenPra = {};
async function tampilkanPratinjau(id, sumber, namaBerkas = "", ukuran = 0, jenisPaksa = "") {
  const layar = document.getElementById(id + "Pra");
  const info = document.getElementById(id + "PraInfo");
  if (!layar) return;
  const token = (tokenPra[id] = (tokenPra[id] || 0) + 1);
  if (!sumber) {
    layar.innerHTML = '<span class="kosongPra">Belum ada berkas</span>';
    if (info) info.textContent = "";
    return;
  }
  const jenis = jenisPaksa || cabangBerkas(namaBerkas || sumber);
  layar.innerHTML = '<span class="kosongPra">Memuat…</span>';
  const infoDasar = [jenis.toUpperCase(), ukuranBerkas(ukuran)].filter(Boolean).join(" · ");
  if (info) info.textContent = infoDasar;

  if (jenis === "gambar") {
    const im = new Image();
    im.onload = () => {
      if (token !== tokenPra[id]) return;
      layar.innerHTML = ""; layar.appendChild(im);
      if (info) info.textContent = `${infoDasar} · ${im.naturalWidth}x${im.naturalHeight}`;
    };
    im.onerror = () => { if (token === tokenPra[id]) layar.innerHTML = '<span class="kosongPra gagalPra">Gambar tidak bisa dimuat. Periksa tautan atau berkasnya.</span>'; };
    im.src = sumber;
  } else if (jenis === "video") {
    const v = document.createElement("video");
    v.src = sumber; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true; v.controls = true;
    v.onloadedmetadata = () => { if (info && token === tokenPra[id]) info.textContent = `${infoDasar} · ${v.videoWidth}x${v.videoHeight} · ${v.duration.toFixed(1)} dtk`; };
    v.onerror = () => { if (token === tokenPra[id]) layar.innerHTML = '<span class="kosongPra gagalPra">Video tidak bisa dimuat.</span>'; };
    layar.innerHTML = ""; layar.appendChild(v);
  } else if (jenis === "svga") {
    try {
      await muatPemutarSvga();
      if (token !== tokenPra[id]) return;
      layar.innerHTML = '<div class="svgaKotak"></div>';
      const target = layar.querySelector(".svgaKotak");
      const pemutar = new window.SVGA.Player(target);
      const pemuat = new window.SVGA.Parser();
      pemuat.load(sumber, (data) => {
        if (token !== tokenPra[id]) return;
        pemutar.setVideoItem(data);
        pemutar.setContentMode("AspectFit");
        pemutar.startAnimation();
        const w = data.videoSize?.width, h = data.videoSize?.height;
        if (info) info.textContent = `${infoDasar}${w ? " · " + w + "x" + h : ""}${data.FPS ? " · " + data.FPS + " fps" : ""}`;
      }, () => {
        if (token === tokenPra[id]) layar.innerHTML = '<span class="kosongPra gagalPra">SVGA tidak bisa dibaca. Pastikan berkasnya benar atau server mengizinkan akses.</span>';
      });
    } catch (e) {
      layar.innerHTML = '<span class="kosongPra gagalPra">' + aman(e.message) + '</span>';
    }
  } else {
    layar.innerHTML = '<span class="kosongPra">Format tidak dikenali untuk pratinjau</span>';
  }
}

/** Pasang pendengar: dipanggil sekali setelah form tampil. */
function aktifkanPratinjau(id) {
  const url = document.getElementById(id + "Url");
  const file = document.getElementById(id + "File");
  let tunda;
  if (url) {
    const dariUrl = () => tampilkanPratinjau(id, url.value.trim());
    url.addEventListener("input", () => { clearTimeout(tunda); tunda = setTimeout(dariUrl, 450); });
    if (url.value.trim()) dariUrl();
  }
  if (file) {
    file.addEventListener("change", () => {
      const b = file.files?.[0];
      if (!b) return tampilkanPratinjau(id, "");
      const objek = URL.createObjectURL(b);
      tampilkanPratinjau(id, objek, b.name, b.size);
    });
  }
  const kotak = document.querySelector(`[data-sumber="${id}"]`);
  kotak?.querySelectorAll(".tabSumber .pil").forEach((p) => p.addEventListener("click", () => {
    if (p.dataset.mode === "file") {
      const b = file?.files?.[0];
      if (b) tampilkanPratinjau(id, URL.createObjectURL(b), b.name, b.size);
      else tampilkanPratinjau(id, "");
    } else {
      tampilkanPratinjau(id, url?.value.trim() || "");
    }
  }));
  kotak?.querySelectorAll(".alasPratinjau span").forEach((s) => s.addEventListener("click", () => {
    kotak.querySelectorAll(".alasPratinjau span").forEach((x) => x.classList.toggle("on", x === s));
    const layar = document.getElementById(id + "Pra");
    layar.dataset.alas = s.dataset.alas;
  }));
}

document.addEventListener("click", (e) => {
  const pil = e.target.closest(".tabSumber .pil");
  if (!pil) return;
  const kotak = pil.closest("[data-sumber]");
  kotak.querySelectorAll(".tabSumber .pil").forEach((p) => p.classList.toggle("on", p === pil));
  kotak.querySelectorAll("[data-bagian]").forEach((b) => {
    b.style.display = b.dataset.bagian === pil.dataset.mode ? "" : "none";
  });
});

/** Ambil URL akhir: tautan yang diketik atau hasil unggahan berkas. */
async function urlDariSumber(id, folder) {
  const kotak = document.querySelector(`[data-sumber="${id}"]`);
  const mode = kotak?.querySelector(".tabSumber .pil.on")?.dataset.mode || "link";
  if (mode === "link") return (document.getElementById(id + "Url")?.value || "").trim();
  const berkas = document.getElementById(id + "File")?.files?.[0];
  if (!berkas) throw new Error("Belum ada berkas yang dipilih");
  const progres = document.getElementById(id + "Progres");
  if (progres) progres.textContent = "mengunggah 0%";
  try {
    const url = await unggahBerkas(berkas, folder, (p) => { if (progres) progres.textContent = `mengunggah ${p}%`; });
    if (progres) progres.textContent = "selesai diunggah";
    return url;
  } catch (e) {
    if (progres) progres.textContent = e?.code === "storage/unauthorized"
      ? "ditolak: Storage belum aktif atau aturan Storage belum dipasang"
      : "gagal mengunggah: " + (window.__galatVps || e?.code || e?.message || "");
    throw e;
  }
}

const cabangBerkas = (url) => {
  const bersih = String(url || "").split("?")[0].toLowerCase();
  const ext = bersih.split(".").pop();
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "gambar";
  if (["mp4", "webm"].includes(ext)) return "video";
  if (ext === "svga") return "svga";
  return "lain";
};
const pratinjauAset = (url) => {
  const jenis = cabangBerkas(url);
  const klik = `data-lihatbesar="${aman(url)}" title="Klik untuk memperbesar" style="cursor:zoom-in"`;
  if (jenis === "gambar") return `<div class="pratinjau" ${klik}><img src="${aman(url)}" alt=""></div>`;
  if (jenis === "video") return `<div class="pratinjau" ${klik}><video src="${aman(url)}" muted></video></div>`;
  if (jenis === "svga") return `<div class="pratinjau" ${klik}>SVGA ▶</div>`;
  return `<div class="pratinjau" ${klik}>FILE</div>`;
};

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-lihatbesar]");
  if (!t) return;
  const url = t.dataset.lihatbesar;
  if (!url) return;
  modal("Pratinjau", `
    <div class="kotakPratinjau" data-sumber="besar" style="margin-top:0">
      <div class="layarPratinjau" id="besarPra" style="height:320px"></div>
      <div class="infoPratinjau" id="besarPraInfo"></div>
      <div class="alasPratinjau">
        <span data-alas="gelap" class="on">Gelap</span><span data-alas="terang">Terang</span><span data-alas="kotak">Kotak</span>
      </div>
    </div>`);
  tampilkanPratinjau("besar", url);
  document.querySelectorAll('[data-sumber="besar"] .alasPratinjau span').forEach((s) => s.addEventListener("click", () => {
    document.querySelectorAll('[data-sumber="besar"] .alasPratinjau span').forEach((x) => x.classList.toggle("on", x === s));
    $("besarPra").dataset.alas = s.dataset.alas;
  }));
});

/* ================= status sesi ================= */
let adminSaya = null;

async function cekAdmin(user) {
  if (!user) return null;
  const email = (user.email || "").toLowerCase();
  const peran = { email, nama: user.displayName || email.split("@")[0], peran: email === PEMILIK ? "owner" : "-", aktif: true };
  if (email === PEMILIK) return peran;
  try {
    const d = await getDoc(doc(db, "panelAdmins", email));
    if (d.exists() && d.data().aktif !== false) {
      return { ...peran, peran: d.data().peran || "admin", nama: d.data().nama || peran.nama };
    }
  } catch (e) {
    console.warn("panelAdmins tidak terbaca:", e.code);
  }
  return null;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("layarLogin").hidden = false;
    $("aplikasi").hidden = true;
    return;
  }
  adminSaya = await cekAdmin(user);
  if (!adminSaya) {
    $("pesanLogin").textContent = `Akun ${user.email} belum terdaftar sebagai admin panel. Minta owner mendaftarkan email ini di menu Pengaturan.`;
    await signOut(auth);
    return;
  }
  $("layarLogin").hidden = true;
  $("aplikasi").hidden = false;
  $("emailSaya").textContent = adminSaya.email;
  $("namaSaya").textContent = adminSaya.nama;
  $("peranSaya").textContent = adminSaya.peran;
  $("avaSaya").textContent = (adminSaya.nama || "A")[0].toUpperCase();
  bukaRute();
});

/* ================= login ================= */
/** Nama admin disimpan sebagai kunci panelNama agar bisa dipakai untuk login. */
function kunciNama(nama) {
  return String(nama || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
}
async function emailDariNama(nama) {
  const kunci = kunciNama(nama);
  if (!kunci) return "";
  try {
    const d = await getDoc(doc(db, "panelNama", kunci));
    return d.exists() ? String(d.get("email") || "") : "";
  } catch (e) { return ""; }
}


$("tombolMasuk").addEventListener("click", async () => {
  const isi = $("loginEmail").value.trim();
  const sandi = $("loginSandi").value;
  if (!isi || !sandi) return ($("pesanLogin").textContent = "Isi nama admin dan password dulu.");
  $("pesanLogin").className = "pesan info";
  $("pesanLogin").textContent = "Memeriksa…";
  // Boleh isi nama admin (seperti saat didaftarkan) atau email lengkap.
  let email = isi;
  if (!isi.includes("@")) {
    email = await emailDariNama(isi);
    if (!email) {
      $("pesanLogin").className = "pesan";
      $("pesanLogin").textContent = "Nama admin itu belum terdaftar. Pakai email, atau minta owner mendaftarkannya dulu.";
      return;
    }
  }
  try {
    await signInWithEmailAndPassword(auth, email, sandi);
  } catch (e) {
    $("pesanLogin").className = "pesan";
    $("pesanLogin").textContent = pesanAuth(e);
  }
});

/* Lupa sandi: kirim tautan reset ke email yang diisi. Berguna kalau akunnya
   sudah ada dari sebelumnya sehingga sandi baru tidak pernah terpasang. */
const lupaSandi = $("lupaSandi");
if (lupaSandi) lupaSandi.addEventListener("click", async () => {
  const isi = $("loginEmail").value.trim();
  if (!isi.includes("@")) {
    $("pesanLogin").className = "pesan";
    $("pesanLogin").textContent = "Isi email lengkap dulu untuk menerima tautan reset.";
    return;
  }
  $("pesanLogin").className = "pesan info";
  $("pesanLogin").textContent = "Mengirim tautan reset…";
  try {
    await sendPasswordResetEmail(auth, isi);
    $("pesanLogin").className = "pesan info";
    $("pesanLogin").textContent = "Tautan reset dikirim ke " + isi + ". Buka email itu, buat sandi baru, lalu masuk lagi.";
  } catch (e) {
    $("pesanLogin").className = "pesan";
    $("pesanLogin").textContent = pesanAuth(e);
  }
});

$("tombolGoogle").addEventListener("click", async () => {
  $("pesanLogin").className = "pesan info";
  $("pesanLogin").textContent = "Membuka Google…";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    $("pesanLogin").className = "pesan";
    $("pesanLogin").textContent = pesanAuth(e);
  }
});

$("loginSandi").addEventListener("keydown", (e) => { if (e.key === "Enter") $("tombolMasuk").click(); });

function pesanAuth(e) {
  const kode = e?.code || "";
  if (kode.includes("invalid-credential") || kode.includes("wrong-password") || kode.includes("user-not-found"))
    return "Email atau password salah.";
  if (kode.includes("unauthorized-domain")) return "Domain panel ini belum diizinkan di Firebase Authentication.";
  if (kode.includes("popup-blocked")) return "Popup diblokir browser. Izinkan popup lalu coba lagi.";
  if (kode.includes("too-many-requests")) return "Terlalu banyak percobaan. Tunggu beberapa menit.";
  return e?.message || "Gagal masuk.";
}

$("tombolKeluar").addEventListener("click", async () => {
  await signOut(auth);
  location.hash = "";
});

/* ================= rute ================= */
/** Harga VIP 1-9 bisa diubah di sini; aplikasi membacanya dari /vip-harga. */
async function gambarVip() {
  let harga = [];
  let galat = "";
  try { harga = (await walletAdmin({ op: "vip_harga_get" })).harga || []; }
  catch (e) { galat = e.message || String(e); }
  if (!Array.isArray(harga) || harga.length !== 9) {
    harga = [500000, 1500000, 3000000, 6000000, 12000000, 25000000, 50000000, 100000000, 250000000];
  }
  $("aksiTopbar").innerHTML = '<button class="tombolAtas" id="simpanVip">Simpan harga</button>';
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="catatan">Harga VIP 1 sampai 9 dalam coin. Setelah disimpan, aplikasi memakai harga baru tanpa build ulang.</div>
      ${galat ? `<div class="catatan">${aman(galat)}</div>` : ""}
      <div class="barisIsian">
        ${harga.map((h, i) => `<div class="isian"><label>VIP ${i + 1}</label><input id="vipHarga${i + 1}" type="number" min="0" step="1000" value="${Number(h) || 0}"></div>`).join("")}
      </div>
    </div>`;
  $("simpanVip").onclick = async () => {
    const isi = [];
    for (let i = 1; i <= 9; i++) isi.push(Number($("vipHarga" + i).value) || 0);
    try {
      await walletAdmin({ op: "vip_harga_set", harga: isi });
      alert("Harga VIP disimpan.");
      bukaRute();
    } catch (e) { alert("Gagal menyimpan: " + (e.message || e)); }
  };
}

const daftarHal = {
  dashboard: { judul: "Dashboard", crumb: "Dashboard", gambar: gambarDashboard },
  user: { judul: "Kelola user", crumb: "Dashboard / User", gambar: gambarUser },
  room: { judul: "Kelola room", crumb: "Dashboard / Room", gambar: gambarRoom },
  gift: { judul: "Kelola gift", crumb: "Dashboard / Gift", gambar: gambarGift },
  frame: { judul: "Frame & banner", crumb: "Dashboard / Frame & banner", gambar: gambarFrame },
  kirim: { judul: "Kirim ke user", crumb: "Dashboard / Kirim ke user", gambar: gambarKirim },
  staf: { judul: "Staf & seller", crumb: "Dashboard / Staf & seller", gambar: gambarStaf },
  wallet: { judul: "Coin, diamond & reset", crumb: "Dashboard / Coin, diamond & reset", gambar: gambarWallet },
  cekin: { judul: "Cek in harian", crumb: "Dashboard / Cek in harian", gambar: gambarCekIn },
  vipharga: { judul: "Harga VIP", crumb: "Dashboard / Harga VIP", gambar: gambarVip },
  aset: { judul: "Aset & VIP", crumb: "Dashboard / Aset & VIP", gambar: gambarAset },
  asetvps: { judul: "Aset di VPS", crumb: "Dashboard / Aset di VPS", gambar: gambarAsetVps },
  katalog: { judul: "Katalog game", crumb: "Dashboard / Game", gambar: gambarKatalog },
  pasang: { judul: "Pasang game", crumb: "Dashboard / Game", gambar: gambarPasang },
  bet: { judul: "Bet game", crumb: "Dashboard / Game", gambar: gambarBet },
  database: { judul: "Database", crumb: "Dashboard / Data", gambar: gambarDatabase },
  latar: { judul: "Background tab", crumb: "Dashboard / Background tab", gambar: gambarLatar },
  cs: { judul: "Customer Service", crumb: "Dashboard / Customer Service", gambar: gambarCs },
  pengumuman: { judul: "Pengumuman resmi", crumb: "Dashboard / Pengumuman resmi", gambar: gambarPengumuman },
  log: { judul: "Log admin", crumb: "Dashboard / Data", gambar: gambarLog },
  pengaturan: { judul: "Pengaturan", crumb: "Dashboard / Pengaturan", gambar: gambarPengaturan }
};

const keteranganHal = {
  dashboard: "Ringkasan user, room, gift, dan aktivitas admin",
  user: "Cari user, lihat detail, blokir atau buka blokir",
  room: "Daftar room aktif dan tombol tutup room",
  gift: "Katalog gift yang tampil di aplikasi",
  frame: "Banner beranda dan bingkai profil",
  kirim: "Kirim lencana, medali, frame, efek, banner, ID unik ke akun user",
  staf: "Tambah staf dan seller yang boleh masuk panel",
  cs: "Pilih akun yang menerima chat Customer Service, atau cabut",
  wallet: "Kirim coin, VIP, reset coin/diamond/exp, topup manual, reset nama dan foto",
  cekin: "Atur hadiah cek in harian hari 1 sampai 7 yang tampil di aplikasi",
  aset: "Kartu VIP, frame, efek masuk, gelembung chat, medali, ID unik",
  katalog: "Game yang sudah terpasang",
  pasang: "Tambah game baru dengan alamat dan key production",
  bet: "Atur nilai bet tiap game",
  database: "Lihat, ubah, dan hapus dokumen Firestore",
  log: "Riwayat aksi yang dilakukan admin",
  pengaturan: "Daftarkan admin panel dan atur aksesnya"
};

function bukaRute() {
  if ($("aplikasi").hidden) return;
  const nama = (location.hash.replace("#", "") || "dashboard").split("?")[0];
  // Pengaturan (mendaftarkan admin panel) hanya untuk Owner. Admin lain boleh
  // semua halaman lain, tapi tidak bisa membuat akun panel baru.
  const peranSaya = String(adminSaya?.peran || "");
  const menuPengaturan = document.querySelector('.menu[data-hal="pengaturan"]');
  if (menuPengaturan) menuPengaturan.hidden = peranSaya !== "owner";
  if (nama === "pengaturan" && peranSaya !== "owner") {
    $("judulHal").textContent = "Khusus owner";
    $("crumbHal").textContent = "Dashboard";
    document.querySelectorAll(".menu").forEach((m) => m.classList.toggle("aktif", m.dataset.hal === "dashboard"));
    $("isiHal").innerHTML = '<div class="kosong">Halaman Pengaturan hanya bisa dibuka Owner.</div>';
    return;
  }
  const hal = daftarHal[nama] || daftarHal.dashboard;
  document.querySelectorAll(".menu").forEach((m) => m.classList.toggle("aktif", m.dataset.hal === nama));
  $("judulHal").textContent = hal.judul;
  $("crumbHal").textContent = hal.crumb;
  const ket = document.getElementById("ketHal");
  if (ket) ket.textContent = keteranganHal[nama] || "";
  $("aksiTopbar").innerHTML = "";
  $("isiHal").innerHTML = '<div class="kosong">Memuat…</div>';
  Promise.resolve(hal.gambar()).catch((e) => {
    console.error(e);
    $("isiHal").innerHTML = `<div class="kosong">Gagal memuat data.<br><b>${aman(e.code || e.message)}</b><br><br>${
      String(e.code || "").includes("permission-denied")
        ? "Aturan Firestore belum mengizinkan koleksi ini. Tempel rules terbaru dari owner lalu Publish."
        : "Periksa koneksi lalu muat ulang."
    }</div>`;
  });
}
window.addEventListener("hashchange", () => { tutupMenu(); bukaRute(); });

/* menu geser (HP) */
const sidebar = document.querySelector(".sidebar");
const tiraiMenu = $("tiraiMenu");
function tutupMenu() {
  sidebar?.classList.remove("buka");
  tiraiMenu?.classList.remove("tampil");
}
$("tombolMenu").addEventListener("click", () => {
  const buka = sidebar.classList.toggle("buka");
  tiraiMenu.classList.toggle("tampil", buka);
});
tiraiMenu.addEventListener("click", tutupMenu);
document.querySelectorAll(".menu").forEach((m) => m.addEventListener("click", tutupMenu));

/* ================= dashboard ================= */
async function gambarDashboard() {
  const [users, rooms, gifts, banned, logs] = await Promise.all([
    ambilSemua("userIds", 500), ambilSemua("rooms", 500), ambilSemua("gifts", 100),
    ambilSemua("banned", 200).catch(() => []), ambilSemua("adminLogs", 50).catch(() => [])
  ]);
  const versi = await getDoc(doc(db, "settings", "versi")).then((d) => (d.exists() ? d.data().versi : "—")).catch(() => "—");

  $("isiHal").innerHTML = `
    <div class="kartu">
      <div class="stat"><b>${rupiah(users.length)}</b><span>User terdaftar</span></div>
      <div class="stat"><b>${rupiah(rooms.length)}</b><span>Room</span></div>
      <div class="stat"><b>${rupiah(gifts.length)}</b><span>Gift aktif</span></div>
      <div class="stat"><b>${rupiah(banned.length)}</b><span>User diblokir</span></div>
      <div class="stat"><b>${aman(versi)}</b><span>Versi APK tercatat</span></div>
    </div>
    <div class="panel">
      <div class="panelAtas"><h3>Aktivitas admin terakhir</h3><div class="filter"><div class="pil on">${logs.length} catatan</div></div></div>
      ${logs.length ? `<table><tr><th>WAKTU</th><th>ADMIN</th><th>AKSI</th><th>RINCIAN</th></tr>
        ${logs.sort((a, b) => (b.waktu?.seconds || 0) - (a.waktu?.seconds || 0)).slice(0, 12).map((l) => `
          <tr><td>${waktu(l.waktu)}</td><td>${aman(l.admin)}</td><td>${aman(l.aksi)}</td><td>${aman(l.rincian)}</td></tr>`).join("")}
        </table>` : '<div class="kosong">Belum ada aktivitas tercatat.</div>'}
    </div>
    <div class="panel">
      <div class="panelAtas"><h3>Room terbaru</h3><div class="filter"><div class="pil on"><a href="#room">Lihat semua</a></div></div></div>
      ${rooms.length ? `<table><tr><th>ROOM</th><th>PEMILIK</th><th>KUNCI</th></tr>
        ${rooms.slice(0, 8).map((r) => `<tr><td>${aman(r.name || r.title || r.id)}</td><td>${aman((r.ownerUid || "").slice(0, 10))}…</td>
        <td>${r.locked ? '<span class="tag blokir">terkunci</span>' : '<span class="tag aktif">terbuka</span>'}</td></tr>`).join("")}
        </table>` : '<div class="kosong">Belum ada room.</div>'}
    </div>`;
}

/* ================= user ================= */
let saringUser = "semua", cariUser = "";
async function gambarUser() {
  const [users, banned] = await Promise.all([
    ambilSemua("userIds", 500),
    ambilSemua("banned", 300).catch(() => [])
  ]);
  const diblokir = new Set(banned.map((b) => b.id));

  $("aksiTopbar").innerHTML = `<input id="cariUser" class="cari" placeholder="Cari nama atau UID…">
    <button class="tombolAtas" id="tambahUser">Tambah user</button>`;
  $("tambahUser").onclick = formTambahUser;
  $("cariUser").value = cariUser;
  $("cariUser").oninput = (e) => { cariUser = e.target.value.toLowerCase(); lukisTabelUser(users, diblokir); };

  $("isiHal").innerHTML = `
    <div class="kartu">
      <div class="stat"><b>${rupiah(users.length)}</b><span>User terdaftar</span></div>
      <div class="stat"><b>${rupiah(users.length - diblokir.size)}</b><span>Aktif</span></div>
      <div class="stat"><b>${rupiah(diblokir.size)}</b><span>Diblokir</span></div>
    </div>
    <div class="panel">
      <div class="panelAtas"><h3>Daftar user</h3>
        <div class="filter">
          <div class="pil on" data-saring="semua">Semua</div>
          <div class="pil" data-saring="aktif">Aktif</div>
          <div class="pil" data-saring="blokir">Diblokir</div>
        </div>
      </div>
      <div id="tabelUser"></div>
    </div>`;

  $("isiHal").querySelectorAll("[data-saring]").forEach((p) => {
    p.onclick = () => {
      saringUser = p.dataset.saring;
      $("isiHal").querySelectorAll("[data-saring]").forEach((x) => x.classList.toggle("on", x === p));
      lukisTabelUser(users, diblokir);
    };
  });
  lukisTabelUser(users, diblokir);
}

function lukisTabelUser(users, diblokir) {
  const kata = cariUser.trim();
  let baris = users.filter((u) => {
    const nama = (u.name || u.nama || "").toLowerCase();
    if (kata && !nama.includes(kata) && !u.id.toLowerCase().includes(kata)) return false;
    if (saringUser === "blokir") return diblokir.has(u.id) || diblokir.has(u.uid);
    if (saringUser === "aktif") return !diblokir.has(u.id) && !diblokir.has(u.uid);
    return true;
  });

  const kotak = $("tabelUser");
  if (!baris.length) {
    kotak.innerHTML = '<div class="kosong">Tidak ada user yang cocok.</div>';
    return;
  }
  kotak.innerHTML = `<table>
    <tr><th>USER</th><th>UID</th><th>STATUS</th><th>AKSI</th></tr>
    ${baris.slice(0, 120).map((u) => {
      const uid = u.uid || u.id;
      const blok = diblokir.has(u.id) || diblokir.has(uid);
      const nama = u.name || u.nama || "(tanpa nama)";
      const foto = u.avatar || u.photo || "";
      return `<tr>
        <td><div class="user"><div class="mini">${foto ? `<img src="${aman(foto)}" alt="">` : aman(nama[0] || "?")}</div>${aman(nama)}</div></td>
        <td>${aman(uid.slice(0, 14))}…</td>
        <td>${blok ? '<span class="tag blokir">diblokir</span>' : '<span class="tag aktif">aktif</span>'}</td>
        <td>
          <button class="aksi" data-lihat="${aman(uid)}">Detail</button> ·
          <button class="aksi" data-ban="${aman(uid)}" data-nama="${aman(nama)}">${blok ? "Buka blokir" : "Blokir"}</button> ·
          <button class="aksi" data-hapus="${aman(uid)}" data-nama="${aman(nama)}">Hapus</button>
        </td>
      </tr>`;
    }).join("")}
  </table><div class="kaki">${baris.length} user ditampilkan dari ${users.length} terdaftar</div>`;

  kotak.querySelectorAll("[data-lihat]").forEach((b) => (b.onclick = () => detailUser(b.dataset.lihat)));
  kotak.querySelectorAll("[data-ban]").forEach((b) => (b.onclick = () => blokirUser(b.dataset.ban, b.dataset.nama, diblokir)));
  kotak.querySelectorAll("[data-hapus]").forEach((b) => (b.onclick = () => hapusUser(b.dataset.hapus, b.dataset.nama)));
}

async function formTambahUser() {
  modal("Tambah user Viza", `
    <div class="isian"><label>Nama tampilan</label><input id="uNama" placeholder="Nama user di aplikasi"></div>
    <div class="isian" style="margin-top:10px"><label>Email untuk login</label><input id="uEmail" type="email" placeholder="user@email.com"></div>
    <div class="isian" style="margin-top:10px"><label>Password</label><input id="uSandi" placeholder="minimal 6 karakter, atau kosongkan untuk otomatis"></div>
    <div class="catatan">Akun ini langsung bisa dipakai login di aplikasi Viza. Di layar login APK, user memilih masuk dengan email lalu mengisi email dan password ini. Password hanya ditampilkan sekali di panel, jadi salin dulu sebelum ditutup.</div>`,
    async () => {
      const nama = $("uNama").value.trim();
      const email = $("uEmail").value.trim().toLowerCase();
      let sandi = $("uSandi").value.trim();
      if (!nama || !email) return toast("Nama dan email wajib diisi", true);
      if (!sandi) sandi = "vz" + Math.random().toString(36).slice(2, 10);
      if (sandi.length < 6) return toast("Password minimal 6 karakter", true);

      const appKedua = initializeApp(firebaseConfig, "userbaru-" + Date.now());
      const authKedua = getAuth(appKedua);
      let uid;
      try {
        const kredensial = await createUserWithEmailAndPassword(authKedua, email, sandi);
        uid = kredensial.user.uid;
        await updateProfile(kredensial.user, { displayName: nama }).catch(() => {});
        await signOut(authKedua);
        await deleteApp(appKedua);
      } catch (e) {
        deleteApp(appKedua).catch(() => {});
        throw e;
      }

      await setDoc(doc(db, "users", uid), {
        nickname: nama, name: nama, email, countryCode: "ID",
        dibuat: serverTimestamp(), dibuatOleh: auth.currentUser.email
      }, { merge: true });

      await setDoc(doc(db, "userIds", uid), {
        uid, name: nama, countryCode: "ID", dibuat: serverTimestamp()
      }, { merge: true });

      catatLog("Tambah user", `${nama} · ${email}`);
      gambarUser();

      modal("Akun dibuat", `
        <div class="isian"><label>Email login</label><input id="hasilEmail" value="${aman(email)}" readonly></div>
        <div class="isian" style="margin-top:10px"><label>Password</label><input id="hasilSandi" value="${aman(sandi)}" readonly></div>
        <div class="isian" style="margin-top:10px"><label>UID</label><input value="${aman(uid)}" readonly></div>
        <div class="catatan">Serahkan email dan password ini ke user. Di aplikasi Viza, pilih masuk dengan email lalu isi keduanya. Minta user mengganti password setelah masuk.</div>`);
    });
}

async function detailUser(uid) {
  modal(`Detail user`, '<div class="kosong">Memuat…</div>');
  try {
    const [profil, dompet, bannya] = await Promise.all([
      getDoc(doc(db, "users", uid)).catch(() => null),
      getDoc(doc(db, "wallets", uid)).catch(() => null),
      getDoc(doc(db, "banned", uid)).catch(() => null)
    ]);
    const isi = {
      profil: profil?.exists() ? profil.data() : null,
      dompet: dompet?.exists() ? dompet.data() : null,
      diblokir: bannya?.exists() ? bannya.data() : null
    };
    modal(`Detail user ${uid.slice(0, 12)}…`, `
      <div class="isian"><label>Profil (users/${aman(uid)})</label><textarea readonly>${aman(JSON.stringify(isi.profil, null, 2) || "—")}</textarea></div>
      <div class="isian" style="margin-top:10px"><label>Dompet (wallets/${aman(uid)})</label><textarea readonly>${aman(JSON.stringify(isi.dompet, null, 2) || "—")}</textarea></div>
      ${isi.diblokir ? `<div class="isian" style="margin-top:10px"><label>Blokir</label><textarea readonly>${aman(JSON.stringify(isi.diblokir, null, 2))}</textarea></div>` : ""}
      <div class="catatan">Data dibaca langsung dari Firestore. Untuk mengubah nilai, pakai menu Database.</div>`);
  } catch (e) {
    modal("Detail user", `<div class="kosong">${aman(e.message)}</div>`);
  }
}


/** Hapus user sepenuhnya: dompet, profil Firestore, dan akun login Firebase. */
async function hapusUser(uid, nama) {
  modal("Hapus user permanen", `
    <div class="isian"><label>User</label><input value="${aman(nama)} · ${aman(uid)}" readonly></div>
    <div class="isian" style="margin-top:10px"><label>Ketik nama user untuk memastikan</label><input id="konfirHapus" placeholder="${aman(nama)}"></div>
    <div class="catatan">Profil, dompet, dan akun login Firebase user ini dihapus. User tidak bisa masuk lagi dengan akun tersebut, dan datanya tidak bisa dikembalikan.
      Saldo coin yang tersisa ikut hilang. Kalau hanya ingin menghentikan sementara, pakai Blokir.</div>`,
    async () => {
      const teks = ($("konfirHapus")?.value || "").trim().toLowerCase();
      if (teks !== String(nama).trim().toLowerCase()) return toast("Nama belum sama", true);
      const tutup = $("modalTutup");
      try {
        // 1) dompet + akun login Firebase (lewat server)
        let authInfo = "";
        try {
          const r = await walletAdmin({ op: "delete_user", uid });
          const baris = (r.hasil || [])[0] || {};
          if (baris.lewat) { toast("Akun resmi tidak boleh dihapus", true); return; }
          authInfo = baris.auth ? "akun login terhapus" : ("akun login belum terhapus: " + (baris.auth_alasan || "kunci layanan belum dipasang"));
        } catch (e) {
          authInfo = "dompet gagal dihapus: " + (e.message || e);
        }

        // 2) dokumen Firestore
        await Promise.all([
          deleteDoc(doc(db, "users", uid)).catch(() => {}),
          deleteDoc(doc(db, "userIds", uid)).catch(() => {}),
          deleteDoc(doc(db, "wallets", uid)).catch(() => {}),
          deleteDoc(doc(db, "banned", uid)).catch(() => {})
        ]);

        catatLog("Hapus user", `${nama} · ${uid} · ${authInfo}`);
        if (tutup) tutup.click();
        toast("User dihapus · " + authInfo);
        gambarUser();
      } catch (e) {
        toast("Gagal menghapus: " + (e.message || e), true);
      }
    });
}

async function blokirUser(uid, nama, diblokir) {
  const sudah = diblokir.has(uid);
  if (!sudah && !confirm(`Blokir ${nama}? Dia tidak bisa memakai aplikasi sampai dibuka.`)) return;
  try {
    if (sudah) {
      await deleteDoc(doc(db, "banned", uid));
      toast(`${nama} dibuka blokirnya`);
      catatLog("Buka blokir", `${nama} · ${uid}`);
    } else {
      await setDoc(doc(db, "banned", uid), {
        uid, nama, alasan: "diblokir admin panel",
        oleh: auth.currentUser.email, waktu: serverTimestamp()
      });
      toast(`${nama} diblokir`);
      catatLog("Blokir user", `${nama} · ${uid}`);
    }
    gambarUser();
  } catch (e) {
    toast("Gagal: " + (e.code || e.message), true);
  }
}

/* ================= room ================= */
async function gambarRoom() {
  const rooms = await ambilSemua("rooms", 400).catch(() => []);
  // Room party dibaca aplikasi dari Realtime Database (roomsPub), bukan Firestore.
  let party = {}, official = {}, gagalParty = "";
  try {
    const snap = await dGet(dRef(rtdb, "roomsPub"));
    party = snap.exists() ? snap.val() : {};
  } catch (e) { gagalParty = e.message || String(e); }
  try {
    const snap = await dGet(dRef(rtdb, "officialRooms"));
    official = snap.exists() ? snap.val() : {};
  } catch (e) { }
  const daftarParty = Object.entries(party || {})
    .map(([id, r]) => ({ id, ...(r || {}) }))
    .sort((a, b) => (Number(b.pinned) || 0) - (Number(a.pinned) || 0) || (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

  $("aksiTopbar").innerHTML = "";
  $("isiHal").innerHTML = `
    <div class="kartu"><div class="stat"><b>${rupiah(rooms.length)}</b><span>Total room</span></div>
      <div class="stat"><b>${rupiah(rooms.filter((r) => !r.locked).length)}</b><span>Terbuka</span></div>
      <div class="stat"><b>${rupiah(rooms.filter((r) => r.locked).length)}</b><span>Terkunci</span></div>
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Room party</h3><div class="sub">sematkan room paling atas dan beri tag official</div></div>
      ${gagalParty ? `<div class="kosong">Gagal memuat roomsPub: ${aman(gagalParty)}</div>`
        : (daftarParty.length ? `<table><tr><th>ROOM</th><th>PEMILIK</th><th>PESERTA</th><th>ATURAN</th><th>AKSI</th></tr>
          ${daftarParty.map((r) => `<tr>
            <td>${r.official || official[r.id] ? '✅ ' : ''}${aman(r.name || "(tanpa nama)")}<div class="catatan" style="padding:0;margin-top:2px">${aman(String(r.id).slice(0, 14))}…</div></td>
            <td>${aman((r.ownerName || r.ownerUid || "—").toString().slice(0, 14))}</td>
            <td>${rupiah(r.members || 0)}</td>
            <td>${r.pinned ? '<span class="tag aktif">disematkan</span>' : '<span class="tag">biasa</span>'} ${official[r.id] ? '<span class="tag aktif">official</span>' : ''}</td>
            <td>
              <button class="aksi" data-semats="${aman(r.id)}" data-nilai="${r.pinned ? 0 : 1}">${r.pinned ? "Lepas semat" : "Sematkan"}</button> ·
              <button class="aksi" data-official="${aman(r.id)}" data-nilai="${official[r.id] ? 0 : 1}">${official[r.id] ? "Lepas official" : "Tag official"}</button>
            </td></tr>`).join("")}
          </table>` : '<div class="kosong">Belum ada room party di Realtime Database.</div>')}
      <div class="catatan" style="padding:0 14px 14px">Room yang disematkan tampil paling atas di daftar room aplikasi. Tag official memberi tanda resmi di foto room dan daftar room.</div>
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Daftar room (Firestore)</h3><div class="filter"><div class="pil on">rooms</div></div></div>
      ${rooms.length ? `<table><tr><th>NAMA</th><th>ID ROOM</th><th>PEMILIK</th><th>KUNCI</th><th>AKSI</th></tr>
        ${rooms.map((r) => `<tr>
          <td>${aman(r.name || r.title || "(tanpa nama)")}</td>
          <td>${aman(r.id.slice(0, 12))}…</td>
          <td>${aman((r.ownerUid || "—").slice(0, 12))}</td>
          <td>${r.locked ? '<span class="tag blokir">terkunci</span>' : '<span class="tag aktif">terbuka</span>'}</td>
          <td><button class="aksi" data-room="${aman(r.id)}">Tutup room</button></td></tr>`).join("")}
        </table>` : '<div class="kosong">Belum ada room.</div>'}
    </div>`;

  // Sematkan / lepas sematkan (roomsPub/{id}/pinned + pinnedAt)
  $("isiHal").querySelectorAll("[data-semats]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.semats, nilai = Number(b.dataset.nilai) === 1;
    try {
      await dSet(dRef(rtdb, `roomsPub/${id}/pinned`), nilai ? 1 : 0);
      await dSet(dRef(rtdb, `roomsPub/${id}/pinnedAt`), nilai ? Date.now() : 0);
      catatLog(nilai ? "Sematkan room" : "Lepas semat room", id);
      toast(nilai ? "Room disematkan paling atas" : "Semat dilepas");
      gambarRoom();
    } catch (e) { toast("Gagal: " + (e.message || "tidak diizinkan rules"), true); }
  }));

  // Tag official (officialRooms/{id})
  $("isiHal").querySelectorAll("[data-official]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.official, nilai = Number(b.dataset.nilai) === 1;
    try {
      await dSet(dRef(rtdb, `officialRooms/${id}`), nilai ? true : null);
      catatLog(nilai ? "Tag official" : "Lepas official", id);
      toast(nilai ? "Tag official dipasang" : "Tag official dilepas");
      gambarRoom();
    } catch (e) { toast("Gagal: " + (e.message || "tidak diizinkan rules"), true); }
  }));

  $("isiHal").querySelectorAll("[data-room]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Tutup dan hapus room ini? Tindakan ini langsung terasa di aplikasi.")) return;
    try {
      await deleteDoc(doc(db, "rooms", b.dataset.room));
      catatLog("Hapus room", b.dataset.room);
      toast("Room dihapus");
      gambarRoom();
    } catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  }));
}

/* ================= gift ================= */
const contohGift = { name: "", emoji: "🎁", price: 100, mediaUrl: "", mediaType: "", special: false, rocket: false, cashback: false, jpRate: 0, jpMult: 0, cbRate: 0, cbPrice: 0 };

async function gambarGift() {
  const gifts = await ambilSemua("gifts", 300);
  $("aksiTopbar").innerHTML = `<button class="tombolAtas" id="tambahGift">Tambah gift</button>`;
  $("tambahGift").onclick = () => formGift(null);
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Katalog gift</h3><div class="sub">dibaca aplikasi dari koleksi gifts</div>
        <div class="filter"><div class="pil on">${gifts.length} item</div></div></div>
      ${gifts.length ? `<table><tr><th>GIFT</th><th>HARGA</th><th>MEDIA</th><th>TAMBAHAN</th><th>AKSI</th></tr>
        ${gifts.map((g) => `<tr>
          <td><div class="user"><div class="mini">${aman(g.emoji || "🎁")}</div>${aman(g.name || g.id)}</div></td>
          <td>${rupiah(g.price)} koin</td>
          <td>${g.mediaUrl ? `<a class="aksi" href="${aman(g.mediaUrl)}" target="_blank" rel="noopener">${aman(g.mediaType || "tautan")}</a>` : "—"}</td>
          <td>${[g.special && "special", g.rocket && "rocket", g.cashback && "cashback"].filter(Boolean).map((t) => `<span class="tag aktif">${t}</span>`).join(" ") || "—"}</td>
          <td><button class="aksi" data-edit="${aman(g.id)}">Edit</button> · <button class="aksi" data-hapus="${aman(g.id)}">Hapus</button></td>
        </tr>`).join("")}</table>` : '<div class="kosong">Belum ada gift. Tekan Tambah gift di kanan atas.</div>'}
    </div>`;
  $("isiHal").querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => formGift(gifts.find((g) => g.id === b.dataset.edit))));
  $("isiHal").querySelectorAll("[data-hapus]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus gift ini dari katalog?")) return;
    try {
      await deleteDoc(doc(db, "gifts", b.dataset.hapus));
      catatLog("Hapus gift", b.dataset.hapus);
      toast("Gift dihapus");
      gambarGift();
    } catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  }));
}

function formGift(gift) {
  const g = { ...contohGift, ...(gift || {}) };
  modal(gift ? "Edit gift" : "Tambah gift", `
    <div class="grid2">
      <div class="isian"><label>Nama gift</label><input id="gNama" value="${aman(g.name)}" placeholder="Mawar"></div>
      <div class="isian"><label>Emoji</label><input id="gEmoji" value="${aman(g.emoji)}" placeholder="🌹"></div>
      <div class="isian"><label>Harga (koin)</label><input id="gHarga" type="number" value="${Number(g.price) || 0}"></div>
      <div class="isian"><label>Jenis media</label><select id="gJenis">
        ${["", "image", "video", "gif"].map((t) => `<option value="${t}" ${g.mediaType === t ? "selected" : ""}>${t || "(tanpa media)"}</option>`).join("")}
      </select></div>
    </div>
    <div style="margin-top:10px">${htmlSumber("g", g.mediaUrl)}</div>
    <div class="grid3" style="margin-top:10px">
      <div class="isian"><label>Jackpot rate</label><input id="gJp" type="number" value="${Number(g.jpRate) || 0}"></div>
      <div class="isian"><label>Jackpot multiplier</label><input id="gJpMult" type="number" value="${Number(g.jpMult) || 0}"></div>
      <div class="isian"><label>Cashback rate</label><input id="gCb" type="number" value="${Number(g.cbRate) || 0}"></div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div class="isian"><label>Harga dasar cashback</label><input id="gCbHarga" type="number" value="${Number(g.cbPrice) || 0}"></div>
      <div class="isian"><label>Penanda</label>
        <div style="display:flex;gap:12px;padding-top:6px;font-size:11px;color:#a4aebf">
          <label style="display:flex;gap:5px;align-items:center;margin:0"><input type="checkbox" id="gSpecial" ${g.special ? "checked" : ""} style="width:auto">special</label>
          <label style="display:flex;gap:5px;align-items:center;margin:0"><input type="checkbox" id="gRocket" ${g.rocket ? "checked" : ""} style="width:auto">rocket</label>
          <label style="display:flex;gap:5px;align-items:center;margin:0"><input type="checkbox" id="gCashback" ${g.cashback ? "checked" : ""} style="width:auto">cashback</label>
        </div>
      </div>
    </div>
    <div class="catatan">Nama dokumen: <b>${aman(gift?.id || "otomatis")}</b>. Perubahan langsung terbaca aplikasi saat katalog gift dimuat ulang.</div>`,
    async () => {
      const data = {
        name: $("gNama").value.trim(),
        emoji: $("gEmoji").value.trim() || "🎁",
        price: Number($("gHarga").value) || 0,
        mediaUrl: await urlDariSumber("g", "gift"),
        mediaType: $("gJenis").value,
        special: $("gSpecial").checked,
        rocket: $("gRocket").checked,
        cashback: $("gCashback").checked,
        jpRate: Number($("gJp").value) || 0,
        jpMult: Number($("gJpMult").value) || 0,
        cbRate: Number($("gCb").value) || 0,
        cbPrice: Number($("gCbHarga").value) || 0,
        diperbarui: serverTimestamp()
      };
      if (!data.name) return toast("Nama gift wajib diisi", true);
      await setDoc(doc(db, "gifts", gift?.id || `gift_${Date.now()}`), data, { merge: true });
      catatLog(gift ? "Edit gift" : "Tambah gift", data.name);
      toast("Gift disimpan");
      gambarGift();
    });
}

/* ================= frame & banner ================= */
async function gambarFrame() {
  const [banners, frames] = await Promise.all([
    ambilSemua("banners", 100).catch(() => []),
    ambilSemua("frames", 100).catch(() => [])
  ]);
  $("aksiTopbar").innerHTML = `<button class="tombolAtas" id="tambahBanner">Tambah banner</button>`;
  $("tambahBanner").onclick = () => formBanner(null);
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Banner beranda</h3><div class="sub">koleksi banners</div>
        <div class="filter"><div class="pil on">${banners.length} banner</div></div></div>
      ${banners.length ? `<table><tr><th>JUDUL</th><th>GAMBAR</th><th>URUTAN</th><th>STATUS</th><th>AKSI</th></tr>
        ${banners.map((b) => `<tr>
          <td>${aman(b.title || "(tanpa judul)")}<div style="font-size:10px;color:#6d778a">${aman(b.subtitle || "")}</div></td>
          <td>${b.imageUrl || b.imageB64 ? `<a class="aksi" href="${aman(b.imageUrl || "#")}" target="_blank" rel="noopener">lihat</a>` : "—"}</td>
          <td>${Number(b.order) || 0}</td>
          <td>${b.active === false ? '<span class="tag blokir">nonaktif</span>' : '<span class="tag aktif">tampil</span>'}</td>
          <td><button class="aksi" data-bedit="${aman(b.id)}">Edit</button> · <button class="aksi" data-bhapus="${aman(b.id)}">Hapus</button></td>
        </tr>`).join("")}</table>` : '<div class="kosong">Belum ada banner.</div>'}
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Frame profil</h3><div class="sub">koleksi frames</div>
        <div class="filter"><div class="pil" id="tambahFrame">+ Tambah frame</div></div></div>
      ${frames.length ? `<table><tr><th>FRAME</th><th>GAMBAR</th><th>HARGA</th><th>STATUS</th><th>AKSI</th></tr>
        ${frames.map((f) => `<tr>
          <td>${aman(f.name || f.id)}</td>
          <td>${f.imageUrl ? `<a class="aksi" href="${aman(f.imageUrl)}" target="_blank" rel="noopener">lihat</a>` : "—"}</td>
          <td>${rupiah(f.price)} koin</td>
          <td>${f.active === false ? '<span class="tag blokir">nonaktif</span>' : '<span class="tag aktif">aktif</span>'}</td>
          <td><button class="aksi" data-fedit="${aman(f.id)}">Edit</button> · <button class="aksi" data-fhapus="${aman(f.id)}">Hapus</button></td>
        </tr>`).join("")}</table>` : '<div class="kosong">Belum ada frame di koleksi frames.<br>Tambahkan, lalu aplikasi bisa memakainya setelah build berikutnya.</div>'}
      <div class="catatan" style="padding:0 14px 14px">File gambar tidak disimpan di panel. Unggah gambar ke hosting (Firebase Storage, GitHub, atau server VPS), lalu tempel tautannya di sini.</div>
    </div>`;

  $("tambahFrame").onclick = () => formFrame(null);
  $("isiHal").querySelectorAll("[data-bedit]").forEach((b) => (b.onclick = () => formBanner(banners.find((x) => x.id === b.dataset.bedit))));
  $("isiHal").querySelectorAll("[data-bhapus]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus banner ini?")) return;
    await deleteDoc(doc(db, "banners", b.dataset.bhapus)).then(() => { toast("Banner dihapus"); catatLog("Hapus banner", b.dataset.bhapus); gambarFrame(); })
      .catch((e) => toast("Gagal: " + (e.code || e.message), true));
  }));
  $("isiHal").querySelectorAll("[data-fedit]").forEach((b) => (b.onclick = () => formFrame(frames.find((x) => x.id === b.dataset.fedit))));
  $("isiHal").querySelectorAll("[data-fhapus]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus frame ini?")) return;
    await deleteDoc(doc(db, "frames", b.dataset.fhapus)).then(() => { toast("Frame dihapus"); gambarFrame(); })
      .catch((e) => toast("Gagal: " + (e.code || e.message), true));
  }));
}

function formBanner(b) {
  const d = b || { title: "", subtitle: "", imageUrl: "", link: "", order: 0, active: true };
  modal(b ? "Edit banner" : "Tambah banner", `
    <div class="isian"><label>Judul</label><input id="bJudul" value="${aman(d.title)}"></div>
    <div class="isian" style="margin-top:10px"><label>Subjudul</label><input id="bSub" value="${aman(d.subtitle)}"></div>
    <div style="margin-top:10px">${htmlSumber("b", d.imageUrl)}</div>
    <div class="grid2" style="margin-top:10px">
      <div class="isian"><label>Tautan saat diketuk</label><input id="bLink" value="${aman(d.link)}"></div>
      <div class="isian"><label>Urutan</label><input id="bOrder" type="number" value="${Number(d.order) || 0}"></div>
    </div>
    <div class="isian" style="margin-top:10px"><label>Tampilkan</label>
      <div class="saklar ${d.active !== false ? "on" : ""}" id="bAktif"></div></div>`,
    async () => {
      const gambarBanner = await urlDariSumber("b", "banner");
      await setDoc(doc(db, "banners", b?.id || `banner_${Date.now()}`), {
        title: $("bJudul").value.trim(), subtitle: $("bSub").value.trim(),
        imageUrl: gambarBanner, link: $("bLink").value.trim(),
        order: Number($("bOrder").value) || 0, active: $("bAktif").classList.contains("on"),
        diperbarui: serverTimestamp()
      }, { merge: true });
      catatLog(b ? "Edit banner" : "Tambah banner", $("bJudul").value);
      toast("Banner disimpan");
      gambarFrame();
    }, () => $("bAktif").classList.toggle("on"));
}

function formFrame(f) {
  const d = f || { name: "", imageUrl: "", price: 0, active: true };
  modal(f ? "Edit frame" : "Tambah frame", `
    <div class="isian"><label>Nama frame</label><input id="fNama" value="${aman(d.name)}" placeholder="SVIP 6"></div>
    <div style="margin-top:10px">${htmlSumber("f", d.imageUrl)}</div>
    <div class="grid2" style="margin-top:10px">
      <div class="isian"><label>Harga (koin)</label><input id="fHarga" type="number" value="${Number(d.price) || 0}"></div>
      <div class="isian"><label>Aktif</label><div class="saklar ${d.active !== false ? "on" : ""}" id="fAktif"></div></div>
    </div>`,
    async () => {
      const gambarFrame = await urlDariSumber("f", "frame");
      await setDoc(doc(db, "frames", f?.id || `frame_${Date.now()}`), {
        name: $("fNama").value.trim(), imageUrl: gambarFrame,
        price: Number($("fHarga").value) || 0, active: $("fAktif").classList.contains("on"),
        diperbarui: serverTimestamp()
      }, { merge: true });
      toast("Frame disimpan");
      gambarFrame();
    }, () => $("fAktif").classList.toggle("on"));
}

/* ================= staf & seller ================= */
const PERAN_PANEL = ["owner", "admin", "manager", "moderator", "staf", "seller"];
/* ================= Panel Staf (manager / admin di APK) — sama seperti Rezo ================= */
const fmtKoin = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e12) return (v / 1e12).toFixed(v % 1e12 ? 2 : 0) + " T";
  if (v >= 1e9) return (v / 1e9).toFixed(v % 1e9 ? 2 : 0) + " M";
  if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + " jt";
  return v.toLocaleString("id-ID");
};
const pstCacheProfil = new Map();
async function pstUid(dariId) {
  const mentah = String(dariId || "").trim();
  if (!mentah) throw new Error("Isi ID user dulu");
  const uid = await uidDariMasukan(mentah);
  if (!uid) throw new Error("ID " + mentah + " tidak ditemukan");
  return { uid, id: mentah };
}
async function pstProfil(uid) {
  if (pstCacheProfil.has(uid)) return pstCacheProfil.get(uid);
  let nama = "", id = "";
  try { const s = await dGet(dRef(rtdb, "pub/" + uid)); if (s.exists()) { nama = s.val().name || ""; id = s.val().userId || ""; } } catch (e) { }
  if (!nama) { try { const d = await getDoc(doc(db, "users", uid)); if (d.exists()) { nama = d.data().name || d.data().nickname || ""; id = id || d.data().userId || ""; } } catch (e) { } }
  const hasil = { nama, id };
  pstCacheProfil.set(uid, hasil);
  return hasil;
}
let pstItemCache = null;
async function pstItems() {
  if (pstItemCache) return pstItemCache;
  const semua = await ambilSemua("vipConfig", 500).catch(() => []);
  pstItemCache = semua.filter((d) => d.id && !d.meta && (d.slot === "frame" || d.slot === "entry"))
    .map((d) => ({ id: "sx_" + d.id, kind: d.slot, name: d.name || d.id, days: Number(d.days) || 30 }))
    .sort((a, b) => (a.kind === b.kind ? String(a.name).localeCompare(String(b.name)) : (a.kind === "frame" ? -1 : 1)));
  return pstItemCache;
}

async function gambarStaf() {
  const tampilSeller = window.__pstTampilCabut === true;
  let seller = null, galatSeller = "";
  try { seller = (await walletAdmin({ op: "seller_list" })).seller || []; } catch (e) { galatSeller = e.message || String(e); }
  const staf = await ambilSemua("panelAdmins", 200).catch(() => []);
  const items = await pstItems().catch(() => []);

  $("aksiTopbar").innerHTML = '<button class="tombolAtas" id="tambahSeller">Tambah seller</button>';
  $("tambahSeller").onclick = () => formSeller(null);

  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Kirim panel ke user</h3></div>
      <div style="padding:0 14px 14px">
        <div class="catatan" style="padding:0 0 10px">Panel muncul di tab Saya user itu. Manager: coin, VIP, frame/efek, blokir user, reset nama dan foto. Admin: VIP, frame/efek, blokir user biasa.</div>
        <div class="isian"><label>ID user (angka)</label><input id="pstId" inputmode="numeric"></div>
        <div class="isian" style="margin-top:10px"><label>Manager dari admin (khusus admin, isi ID manager)</label><input id="pstMgr" placeholder="kosongkan untuk manager"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="tombolUtama" id="pstManager">Kirim panel manager</button>
          <button class="tombol polos" id="pstAdmin">Kirim panel admin</button>
          <button class="tombol polos bahaya" id="pstCabut">Cabut panel user ini</button>
        </div>
        <div class="catatan" id="pstStatus" style="padding:8px 0 0"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Stok frame &amp; efek masuk</h3></div>
      <div style="padding:0 14px 14px">
        <div class="catatan" style="padding:0 0 10px">Item di sini yang bisa dikirim manager/admin ke user lewat panel di aplikasi.</div>
        <div class="isian"><label>ID staf penerima stok (angka)</label><input id="pstStokId" inputmode="numeric"></div>
        <div class="isian" style="margin-top:10px"><label>Pilih item</label><select id="pstItem">
          ${items.length ? items.map((x) => `<option value="${aman(x.id)}">${x.kind === "frame" ? "⭕" : "✨"} ${aman(x.name)}</option>`).join("") : '<option value="">Belum ada item frame/efek di Aset &amp; VIP</option>'}
        </select></div>
        <div class="isian" style="margin-top:10px"><label>Durasi untuk user (hari)</label><input id="pstHari" type="number" value="30"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="tombolUtama" id="pstTambahStok">Tambah ke stok</button>
          <button class="tombol polos" id="pstMuatStok">Muat stok staf ini</button>
        </div>
        <div id="pstStokDaftar" class="catatan" style="padding:10px 0 0"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Stok coin staf</h3></div>
      <div style="padding:0 14px 14px">
        <div class="catatan" style="padding:0 0 10px">Manager hanya bisa kirim coin dari stok ini. Kalau habis, manager tidak bisa kirim lagi sampai Anda tambah.</div>
        <div class="isian"><label>ID staf (angka)</label><input id="pstCoinId" inputmode="numeric"></div>
        <div class="isian" style="margin-top:10px"><label>Peran</label><select id="pstCoinPeran">
          <option value="manager">Manager (bisa kirim coin)</option><option value="admin">Admin</option></select></div>
        <div class="isian" style="margin-top:10px"><label>Jumlah coin (boleh angka besar, contoh 5000000000)</label><input id="pstCoinN" inputmode="numeric" value="1000000000"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="tombolUtama" id="pstCoinTambah">Tambah stok</button>
          <button class="tombol polos" id="pstCoinSet">Set stok</button>
          <button class="tombol polos bahaya" id="pstCoinNol">Nolkan stok</button>
        </div>
        <div class="catatan" id="pstCoinStatus" style="padding:8px 0 0"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Daftar staf</h3><button class="tombolAtas" id="pstToggle">${tampilSeller ? "Sembunyikan yang sudah dicabut" : "Tampilkan yang sudah dicabut"}</button></div>
      <div id="pstDaftar" style="padding:0 14px 14px">Memuat…</div>
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Seller coin</h3><div class="sub">yang muncul di tab Saya sebagai Panel Seller</div></div>
      ${galatSeller ? `<div class="kosong">Gagal memuat daftar seller: ${aman(galatSeller)}<br>Tombol <b>Tambah seller</b> di kanan atas tetap bisa dicoba.</div>`
        : (seller && seller.length ? `<table>
            <tr><th>SELLER</th><th>TOKO</th><th>WHATSAPP</th><th>STOK COIN</th><th>STATUS</th><th>AKSI</th></tr>
            ${seller.map((s) => `<tr>
              <td>${aman(s.name || s.uid)}</td><td>${aman(s.store || "-")}</td><td>${aman(s.wa || "-")}</td>
              <td>${fmtKoin(s.coins || 0)}</td>
              <td>${s.active ? '<span class="tag aktif">aktif</span>' : '<span class="tag blokir">nonaktif</span>'}</td>
              <td><button class="aksi" data-selstok="${aman(s.uid)}">Stok</button> ·
                  <button class="aksi" data-selaktif="${aman(s.uid)}" data-nilai="${s.active ? 0 : 1}">${s.active ? "Nonaktifkan" : "Aktifkan"}</button> ·
                  <button class="aksi" data-seledit="${aman(s.uid)}">Edit</button> ·
                  <button class="aksi" data-selhapus="${aman(s.uid)}">Hapus</button></td>
            </tr>`).join("")}</table>` : '<div class="kosong">Belum ada seller terdaftar di dompet.</div>')}
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Akses panel developer</h3><div class="sub">siapa yang boleh membuka web panel ini (bukan jabatan di aplikasi)</div>
        <button class="tombolAtas" id="tambahStaf">Tambah staf panel</button></div>
      ${staf.length ? `<table><tr><th>NAMA</th><th>EMAIL</th><th>PERAN</th><th>STATUS</th><th>AKSI</th></tr>
        ${staf.map((s) => `<tr><td>${aman(s.nama || s.name || s.id)}</td><td>${aman(s.email || s.id)}</td><td>${aman(s.role || "staf")}</td>
          <td>${s.aktif === false ? '<span class="tag blokir">nonaktif</span>' : '<span class="tag aktif">aktif</span>'}</td>
          <td><button class="aksi" data-sedit="${aman(s.id)}">Edit</button> · <button class="aksi" data-shapus="${aman(s.id)}">Hapus</button></td></tr>`).join("")}</table>`
        : '<div class="kosong">Belum ada staf panel.</div>'}
    </div>`;

  const say = (id, teks) => { const e = $(id); if (e) e.textContent = teks; };

  // ---- kirim / cabut panel (panel_grant, panel_revoke di server dompet) ----
  const kirim = async (peran) => {
    const tombol = peran === "manager" ? $("pstManager") : $("pstAdmin");
    tombol.disabled = true; say("pstStatus", "Memproses…");
    try {
      const u = await pstUid($("pstId").value);
      let manager = "";
      if (peran === "admin" && $("pstMgr").value.trim()) manager = (await pstUid($("pstMgr").value)).uid;
      await walletAdmin({ op: "panel_grant", uid: u.uid, role: peran, manager });
      // cermin per UID untuk APK yang membaca langsung dari Firestore
      await setDoc(doc(db, "stafApk", u.uid), { uid: u.uid, jabatanApk: peran, aktif: true, diperbarui: serverTimestamp() }, { merge: true }).catch(() => {});
      catatLog("Kirim panel " + peran, "ID " + u.id);
      say("pstStatus", "Panel " + peran + " dikirim ke ID " + u.id + " ✅ (muncul di tab Saya)");
      gambarStaf();
    } catch (e) { say("pstStatus", "Gagal: " + (e.message || e)); }
    tombol.disabled = false;
  };
  $("pstManager").onclick = () => kirim("manager");
  $("pstAdmin").onclick = () => kirim("admin");
  $("pstCabut").onclick = async () => {
    if (!confirm("Cabut panel user ini?")) return;
    try {
      const u = await pstUid($("pstId").value);
      await walletAdmin({ op: "panel_revoke", uid: u.uid });
      await deleteDoc(doc(db, "stafApk", u.uid)).catch(() => {});
      catatLog("Cabut panel", "ID " + u.id);
      say("pstStatus", "Panel ID " + u.id + " dicabut ✅");
      gambarStaf();
    } catch (e) { say("pstStatus", "Gagal: " + (e.message || e)); }
  };

  // ---- stok frame & efek ----
  const muatStok = async (uid) => {
    const kotak = $("pstStokDaftar"); kotak.textContent = "Memuat stok…";
    try {
      const r = await walletAdmin({ op: "panel_stock_list", uid });
      const daftar = r.list || [];
      if (!daftar.length) { kotak.textContent = "Stok staf ini masih kosong."; return; }
      kotak.innerHTML = daftar.map((x) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #232c3c">
        <span>${x.kind === "frame" ? "⭕" : "✨"} ${aman(x.name || x.item_id)} · ${aman(String(x.days))} hari</span>
        <button class="aksi" data-hapusitem="${aman(x.item_id)}">Hapus</button></div>`).join("");
      kotak.querySelectorAll("[data-hapusitem]").forEach((b) => (b.onclick = async () => {
        try { await walletAdmin({ op: "panel_stock_del", uid, itemId: b.dataset.hapusitem }); muatStok(uid); }
        catch (e) { toast("Gagal: " + e.message, true); }
      }));
    } catch (e) { kotak.textContent = "Gagal memuat stok: " + e.message; }
  };
  $("pstTambahStok").onclick = async () => {
    const tombol = $("pstTambahStok"); tombol.disabled = true;
    try {
      const u = await pstUid($("pstStokId").value);
      const id = $("pstItem").value; if (!id) throw new Error("Pilih item dulu");
      const it = items.find((x) => x.id === id) || { kind: "", name: id, days: 30 };
      const hari = parseInt($("pstHari").value, 10) || it.days;
      await walletAdmin({ op: "panel_stock_add", uid: u.uid, itemId: id, kind: it.kind, name: it.name, days: hari });
      catatLog("Stok item staf", "ID " + u.id + " · " + it.name);
      toast("Item masuk ke stok ID " + u.id);
      muatStok(u.uid);
    } catch (e) { toast("Gagal: " + (e.message || e), true); }
    tombol.disabled = false;
  };
  $("pstMuatStok").onclick = async () => { try { muatStok((await pstUid($("pstStokId").value)).uid); } catch (e) { toast(e.message, true); } };

  // ---- stok coin staf ----
  const coin = async (op, nol) => {
    try {
      const u = await pstUid($("pstCoinId").value);
      const n = nol ? 0 : Math.trunc(Number(String($("pstCoinN").value).replace(/[^0-9]/g, "")) || 0);
      const r = await walletAdmin({ op, uid: u.uid, coins: n, role: $("pstCoinPeran").value });
      say("pstCoinStatus", "Stok coin ID " + u.id + " sekarang " + fmtKoin(r.coins) + " coin");
      catatLog("Stok coin staf", "ID " + u.id + " · " + op);
      gambarStaf();
    } catch (e) { say("pstCoinStatus", "Gagal: " + (e.message || e)); }
  };
  $("pstCoinTambah").onclick = () => coin("panel_coin_add", false);
  $("pstCoinSet").onclick = () => coin("panel_coin_set", false);
  $("pstCoinNol").onclick = () => { if (confirm("Nolkan stok coin staf ini?")) coin("panel_coin_set", true); };

  // ---- daftar staf (panel_list) ----
  $("pstToggle").onclick = () => { window.__pstTampilCabut = !window.__pstTampilCabut; gambarStaf(); };
  (async () => {
    const kotak = $("pstDaftar");
    try {
      let r = null, galat = null;
      for (let c = 0; c < 3 && !r; c++) {
        try { r = await walletAdmin({ op: "panel_list" }); }
        catch (e) { galat = e; if (/Belum login|Hanya admin|Token tidak valid/i.test(String(e.message))) break; await new Promise((s) => setTimeout(s, 900 * (c + 1))); }
      }
      if (!r) throw galat || new Error("tidak ada jawaban");
      const semua = r.list || [];
      const tampil = semua.filter((x) => tampilSeller || x.active);
      if (!tampil.length) { kotak.textContent = semua.length ? "Semua staf sudah dicabut." : "Belum ada staf. Kirim panel ke user di atas."; return; }
      kotak.innerHTML = "";
      for (const x of tampil) {
        const baris = document.createElement("div");
        baris.style.cssText = "display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #232c3c";
        baris.innerHTML = `<div style="flex:1"><b class="pnama">memuat…</b><div class="catatan pinfo" style="padding:0"></div></div>
          <button class="aksi" data-stokstaf="${aman(x.uid)}">Stok</button> <button class="aksi" data-cabutstaf="${aman(x.uid)}" data-peran="${aman(x.role)}">Cabut</button>`;
        kotak.appendChild(baris);
        pstProfil(x.uid).then((pp) => {
          baris.querySelector(".pnama").textContent = (pp.nama || "Pengguna tanpa nama") + " · " + (x.role === "manager" ? "Manager" : "Admin");
          baris.querySelector(".pinfo").textContent = "ID " + (pp.id || "-") + (x.active ? "" : " · dicabut") + " · " + (x.stok || 0) + " item · coin " + fmtKoin(x.coins || 0);
        });
        baris.querySelector("[data-stokstaf]").onclick = () => { $("pstStokId").value = ""; muatStok(x.uid); window.scrollTo({ top: 0, behavior: "smooth" }); };
        baris.querySelector("[data-cabutstaf]").onclick = async () => {
          if (!confirm("Cabut panel " + x.role + " milik user ini?")) return;
          try { await walletAdmin({ op: "panel_revoke", uid: x.uid, role: x.role }); await deleteDoc(doc(db, "stafApk", x.uid)).catch(() => {}); toast("Panel " + x.role + " dicabut"); baris.remove(); }
          catch (e) { toast("Gagal: " + e.message, true); }
        };
      }
    } catch (e) { kotak.innerHTML = "Gagal memuat staf: " + aman(e.message || String(e)); }
  })();

  // ---- seller ----
  const daftarSeller = seller || [];
  $("isiHal").querySelectorAll("[data-seledit]").forEach((b) => (b.onclick = () => formSeller(daftarSeller.find((x) => String(x.uid) === b.dataset.seledit))));
  $("isiHal").querySelectorAll("[data-selstok]").forEach((b) => (b.onclick = () => formStokSeller(b.dataset.selstok)));
  $("isiHal").querySelectorAll("[data-selhapus]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus seller ini dari daftar dompet?")) return;
    try { await walletAdmin({ op: "seller_del", uid: b.dataset.selhapus }); catatLog("Hapus seller", b.dataset.selhapus); toast("Seller dihapus"); gambarStaf(); }
    catch (e) { toast("Gagal: " + e.message, true); }
  }));
  $("isiHal").querySelectorAll("[data-selaktif]").forEach((b) => (b.onclick = async () => {
    try { await walletAdmin({ op: "seller_set_active", uid: b.dataset.selaktif, active: Number(b.dataset.nilai) }); toast("Status seller diubah"); gambarStaf(); }
    catch (e) { toast("Gagal: " + e.message, true); }
  }));

  // ---- akses panel developer ----
  $("tambahStaf").onclick = () => formStaf(null);
  $("isiHal").querySelectorAll("[data-sedit]").forEach((b) => (b.onclick = () => formStaf(staf.find((x) => x.id === b.dataset.sedit))));
  $("isiHal").querySelectorAll("[data-shapus]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus akses web panel untuk akun ini?")) return;
    await deleteDoc(doc(db, "panelAdmins", b.dataset.shapus))
      .then(() => { catatLog("Hapus staf panel", b.dataset.shapus); toast("Akses dihapus"); gambarStaf(); })
      .catch((e) => toast("Gagal: " + (e.code || e.message), true));
  }));
}

/** Daftarkan atau ubah seller dompet (muncul di aplikasi). */
function formSeller(s) {
  const d = s || { uid: "", store: "", wa: "", link: "" };
  modal(s ? "Edit seller" : "Tambah seller", `
    <div class="isian"><label>ID user calon seller (ID angka, ID unik, atau UID)</label><input id="selUid" value="${aman(d.uid || "")}" ${s ? "readonly" : ""} placeholder="923146051900"></div>
    <div class="grid2" style="margin-top:10px">
      <div class="isian"><label>Nama toko</label><input id="selToko" value="${aman(d.store || "")}" placeholder="Toko Coin Contoh"></div>
      <div class="isian"><label>Nomer HP / WhatsApp</label><input id="selWa" value="${aman(d.wa || "")}" placeholder="6281234567890"></div>
    </div>
    <div class="isian" style="margin-top:10px"><label>Link WhatsApp (kosongkan untuk dibuat otomatis dari nomer)</label><input id="selLink" value="${aman(d.link || "")}" placeholder="https://wa.me/6281234567890"></div>
    ${s ? "" : '<div class="isian" style="margin-top:10px"><label>Stok coin awal (opsional)</label><input id="selStok" type="number" value="0"></div>'}
    <div class="catatan">Setelah disimpan, seller langsung tampil di daftar seller pada aplikasi dan di dompet. Stok coin awal dipotong dari saldo coin akun panelmu.</div>`,
    async () => {
      const masukan = $("selUid").value.trim();
      const uid = s ? d.uid : await uidDariMasukan(masukan);
      if (!uid) return toast("ID user tidak ditemukan", true);
      const nomer = $("selWa").value.replace(/[^0-9]/g, "");
      let link = $("selLink").value.trim();
      if (!link && nomer) link = "https://wa.me/" + (nomer.startsWith("0") ? "62" + nomer.slice(1) : nomer);
      await walletAdmin({
        op: "seller_save", uid,
        store: $("selToko").value.trim(),
        wa: nomer,
        link,
        active: 1
      });
      const stok = Number($("selStok")?.value || 0);
      if (stok > 0) await walletAdmin({ op: "seller_stock", uid, mode: "add", coins: stok });
      catatLog(s ? "Edit seller" : "Tambah seller", `${$("selToko").value.trim() || uid}${stok ? " · stok " + stok : ""}`);
      toast("Seller disimpan" + (stok ? ", stok coin ditambahkan" : ""));
      gambarStaf();
    });
}

/** Tambah atau potong stok coin seller. */
function formStokSeller(uid) {
  modal("Stok coin seller", `
    <div class="isian"><label>Jumlah coin</label><input id="stokNilai" type="number" value="100000"></div>
    <div class="filter" style="margin-top:12px">
      <div class="pil on" data-mode="add">Tambah stok</div>
      <div class="pil" data-mode="cut">Potong stok</div>
    </div>
    <div class="catatan">Menambah stok memotong saldo coin milik akun panelmu. Memotong stok mengembalikan coin ke saldo panel.</div>`,
    async () => {
      const mode = document.querySelector('[data-mode].on')?.dataset.mode || "add";
      const n = Math.abs(Number($("stokNilai").value) || 0);
      if (!n) return toast("Isi jumlah coin", true);
      await walletAdmin({ op: "seller_stock", uid, mode, coins: n });
      catatLog("Stok seller", `${mode} ${n} · ${uid}`);
      toast("Stok seller diperbarui");
      gambarStaf();
    },
    (e) => {
      const pil = e && e.target && e.target.closest("[data-mode]");
      if (pil) document.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === pil));
    });
}

function formStaf(d) {
  const s = d || { nama: "", email: "", role: "staf", aktif: true };
  modal(d ? "Edit staf" : "Tambah staf / seller", `
    <div class="grid2">
      <div class="isian"><label>Nama</label><input id="sNama" value="${aman(s.nama || s.name)}"></div>
      <div class="isian"><label>Email untuk login panel</label><input id="sEmail" value="${aman(s.email || (d ? d.id : ""))}" ${d ? "readonly" : ""}></div>
    </div>
    ${d ? "" : '<div class="isian" style="margin-top:10px"><label>Password (opsional, dibuatkan akun login)</label><input id="sSandi" placeholder="kosongkan kalau akun sudah ada"></div>'}
    <div class="grid2" style="margin-top:10px">
      <div class="isian"><label>Peran</label><select id="sPeran">
        ${PERAN_PANEL.map((p) => `<option value="${p}" ${(s.role || "staf") === p ? "selected" : ""}>${p}</option>`).join("")}
      </select></div>
      <div class="isian"><label>Boleh masuk panel</label><div class="saklar ${s.aktif !== false ? "on" : ""}" id="sAktif"></div></div>
    </div>
    <div class="isian" style="margin-top:10px"><label>Jabatan di APK (bukan akses panel)</label><select id="sJabatan">
      ${["tidak ada", "seller", "manager", "admin"].map((j) => `<option value="${j}" ${((s.jabatanApk || "tidak ada") === j) ? "selected" : ""}>${j}</option>`).join("")}
    </select></div>
    <div class="catatan">Jabatan di APK membuat menu Panel muncul di aplikasi: seller lihat daftar seller, manager bisa kirim coin, blokir user, reset nama/foto, dan kirim aset Store, admin sama seperti manager.</div>`,
    async () => {
      const nama = $("sNama").value.trim();
      const email = $("sEmail").value.trim().toLowerCase();
      const jabatan = ($("sJabatan")?.value || "tidak ada");
      if (!nama || !email) return toast("Nama dan email wajib diisi", true);
      const sandi = ($("sSandi")?.value || "").trim();
      let catatanAkun = "";
      if (sandi) {
        try {
          const app2 = getApps().find((x) => x.name === "panelKedua") || initializeApp(firebaseConfig, "panelKedua");
          await createUserWithEmailAndPassword(getAuth(app2), email, sandi);
          await signOut(getAuth(app2));
          catatanAkun = " · akun login dibuat";
        } catch (e) { catatanAkun = " · akun login: " + (e.code || e.message); }
      }
      const jabatanApk = ($("sJabatan")?.value || "tidak ada");
      await setDoc(doc(db, "panelAdmins", email), {
        nama, email, role: $("sPeran").value, jabatanApk,
        aktif: $("sAktif").classList.contains("on")
      }, { merge: true });
      catatLog(d ? "Edit staf" : "Tambah staf", `${nama} · ${$("sPeran").value}`);
      toast("Staf disimpan" + catatanAkun);
      gambarStaf();
    }, () => $("sAktif").classList.toggle("on"));
}

/** Stok yang dipakai menu Panel di APK: coin dan daftar item yang boleh dikirim. */
async function formStokPanel(email) {
  const id = String(email || "").toLowerCase();
  let sekarang = { coins: 0, aset: [] };
  try {
    const d = await getDoc(doc(db, "panelStok", id));
    if (d.exists()) sekarang = d.data() || sekarang;
  } catch (e) { }
  const asetTeks = (sekarang.aset || []).map((a) => (typeof a === "string" ? a : (a && a.id) || "")).filter(Boolean).join(", ");
  modal("Stok panel " + id, `
    <div class="isian"><label>Stok coin untuk kirim coin ke user</label>
      <input id="stCoin" value="${sekarang.coins || 0}" inputmode="numeric"></div>
    <div class="isian" style="margin-top:10px"><label>Item yang boleh dikirim (ID item, pisah koma)</label>
      <textarea id="stAset" rows="3" placeholder="frame_gold, medal_1">${aman(asetTeks)}</textarea></div>
    <div class="catatan">Menu Panel di APK membaca stok ini. Kalau stok coin 0, manager bebas kirim coin tanpa batas.</div>`,
    async () => {
      const coins = Number(($("stCoin").value || "0").replace(/[^0-9]/g, "")) || 0;
      const aset = ($("stAset").value || "").split(",").map((x) => x.trim()).filter(Boolean);
      await setDoc(doc(db, "panelStok", id), { coins, aset, email: id, diperbarui: serverTimestamp() }, { merge: true });
      catatLog("Stok panel", `${id} · ${coins} coin · ${aset.length} item`);
      toast("Stok disimpan");
      gambarStaf();
    });
}

/* ================= foto bawaan (sama dengan aset APK) ================= */
const FOTO_BAWAAN = {
  M: "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",
  F: "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"
};
async function genderUser(uid) {
  try {
    const s = await dGet(dRef(rtdb, `pub/${uid}/gender`));
    const g = s.exists() ? String(s.val() || "") : "";
    if (g) return g.trim().toUpperCase().startsWith("F") ? "F" : "M";
  } catch (e) {}
  try {
    const d = await getDoc(doc(db, "users", uid));
    const g = d.exists() ? String(d.data().gender || "") : "";
    if (g) return g.trim().toUpperCase().startsWith("F") ? "F" : "M";
  } catch (e) {}
  return "M";
}

/* ================= dompet: coin, diamond, reset ================= */
const DOMPET_ALAMAT = "https://viza.43-156-99-4.sslip.io/admin";
// Kalau panel dibuka dari server dompet sendiri, pakai jalur senama supaya bebas CORS.
const DOMPET_SEHOST = /^viza\.43-156-99-4\.sslip\.io$/i.test(location.hostname);
const WALLET_VPS = DOMPET_SEHOST ? location.origin + "/admin" : DOMPET_ALAMAT;
const WALLET_CAD = WALLET_VPS;
/** Alamat asas dompet, dipakai untuk unggah aset ke VPS. */
const DOMPET_BASE = DOMPET_SEHOST ? location.origin : "https://viza.43-156-99-4.sslip.io";
const WALLET_KEY = "sb_publishable_4PxD2LedOsBgIJyHLkM47A_bImSQI2W";
const OPS_TANPA_UID = ["reset_all", "reset_gem_all", "reset_all_assets", "delete_users", "manual_pending", "manual_all", "pay_get", "pay_set"];

async function walletAdmin(p) {
  const u = auth.currentUser;
  if (!u) throw new Error("Belum login");
  if (OPS_TANPA_UID.includes(p.op) && !p.uid) p = { ...p, uid: "-" };
  const t = await u.getIdToken();
  const kirim = (url) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: WALLET_KEY },
    body: JSON.stringify({ a: "admin", t, p })
  });
  let res = null, galat = "";
  try { res = await kirim(WALLET_VPS); } catch (e) { galat = "VPS(" + WALLET_VPS + "): " + (e.message || e); }
  if (!res || !res.ok) {
    try { const cad = await kirim(WALLET_CAD); if (cad.ok || !res) res = cad; }
    catch (e) { galat += (galat ? " | " : "") + "cadangan: " + (e.message || e); }
  }
  if (!res) throw new Error("Server tidak terjangkau (" + (galat || "jaringan") + ")");
  const out = await res.json().catch(() => ({}));
  if (!out.ok) throw new Error(out.e || ("HTTP " + res.status));
  return out;
}

async function gambarWallet() {
  $("aksiTopbar").innerHTML = "";
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Kirim coin, VIP, dan reset</h3><div class="sub">server dompet Viza dan Rezo memakai jalur yang sama</div></div>
      <div style="padding:0 14px 14px">
        <div class="grid3">
          <div class="isian"><label>ID user (angka, ID unik, atau UID)</label><input id="wUser" placeholder="923146051900"></div>
          <div class="isian"><label>Jumlah coin / diamond</label><input id="wJumlah" type="number" value="0"></div>
          <div class="isian"><label>VIP tier (1-9) dan hari</label>
            <div style="display:flex;gap:6px"><input id="wTier" type="number" value="1" style="width:60px"><input id="wHari" type="number" value="30"></div></div>
        </div>
        <div class="filter" style="margin-top:14px">
          <div class="pil on" data-op="add">Kirim coin</div>
          <div class="pil" data-op="vip">Kirim VIP</div>
          <div class="pil" data-op="reset">Reset coin (1 user)</div>
          <div class="pil" data-op="reset_all">Reset coin semua user</div>
          <div class="pil" data-op="reset_gem">Reset diamond (1 user)</div>
          <div class="pil" data-op="reset_gem_all">Reset diamond semua user</div>
          <div class="pil" data-op="reset_user">Reset exp / level (1 user)</div>
          <div class="pil" data-op="reset_all_assets">Reset aset My Item semua user</div>
          <div class="pil" data-op="manual_pending">Cek topup manual</div>
          <div class="pil" data-op="delete_user">Hapus akun user</div>
          <div class="pil" data-op="nama">Reset nama jadi Unknown</div>
          <div class="pil" data-op="foto">Reset foto profil</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
          <button class="tombolUtama" id="wJalan">Jalankan</button>
          <span class="catatan" id="wHasil" style="padding:0"></span>
        </div>
        <div class="isian" style="margin-top:16px"><label>Perintah lain (op dan parameter bebas)</label>
          <div style="display:flex;gap:6px"><input id="wOp" placeholder="mis. panel_coin_add" style="max-width:220px">
          <input id="wExtra" placeholder='{"coins":100}'></div></div>
        <div class="catatan" style="margin-top:12px">
          Reset nama menulis "Unknown" ke Realtime Database dan Firestore. Reset foto mengosongkan foto profil supaya aplikasi memakai foto bawaan sesuai jenis kelamin akun.
          Tombol dengan tulisan "semua user" langsung mengosongkan data massal, jadi pastikan dulu sebelum menekan.
        </div>
      </div>
    </div>`;

  let opTerpilih = "add";
  $("isiHal").querySelectorAll("[data-op]").forEach((p) => (p.onclick = () => {
    $("isiHal").querySelectorAll("[data-op]").forEach((x) => x.classList.toggle("on", x === p));
    opTerpilih = p.dataset.op;
  }));

  $("wJalan").onclick = async () => {
    const t = $("wJalan");
    const masukan = $("wUser").value.trim();
    t.disabled = true; t.textContent = "Menjalankan…";
    $("wHasil").textContent = "";
    try {
      const opManual = $("wOp").value.trim();
      let uid = masukan;
      if (masukan && !OPS_TANPA_UID.includes(opTerpilih)) {
        const cari = await uidDariMasukan(masukan);
        if (cari) uid = cari;
      }
      const jumlah = Number($("wJumlah").value) || 0;
      if (opManual) {
        const isi = $("wExtra").value.trim() ? JSON.parse($("wExtra").value) : {};
        const out = await walletAdmin({ op: opManual, uid: uid || "-", ...isi });
        $("wHasil").textContent = "Selesai: " + JSON.stringify(out).slice(0, 300);
        catatLog("Wallet op", opManual);
        return;
      }
      if (opTerpilih === "nama") {
        if (!uid) throw new Error("Isi ID user dulu");
        await dSet(dRef(rtdb, `pub/${uid}/name`), "Unknown");
        await setDoc(doc(db, "users", uid), { name: "Unknown", nickname: "Unknown" }, { merge: true });
        $("wHasil").textContent = "Nama diganti menjadi Unknown.";
        catatLog("Reset nama", uid);
        return;
      }
      if (opTerpilih === "foto") {
        if (!uid) throw new Error("Isi ID user dulu");
        const g = await genderUser(uid);
        const ikon = FOTO_BAWAAN[g] || FOTO_BAWAAN.M;
        let ok = 0;
        // 1) Realtime Database: "av" = foto yang dibaca profil publik, "photo" dikosongkan
        try {
          await dUpdate(dRef(rtdb, `pub/${uid}`), { av: ikon, photo: "" });
          ok++;
        } catch (e) { console.warn("RTDB foto:", e.code || e.message); }
        // 2) Cermin Firestore
        try {
          await setDoc(doc(db, "users", uid), { avatarB64: ikon, photoUrl: null, photo: "" }, { merge: true });
          ok++;
        } catch (e) { console.warn("Firestore foto:", e.code || e.message); }
        try {
          const ids = await getDocs(query(collection(db, "userIds"), where("uid", "==", uid), limit(5)));
          for (const d of ids.docs) await setDoc(doc(db, "userIds", d.id), { avatarB64: ikon, photoUrl: null }, { merge: true });
        } catch (e) { console.warn("userIds foto:", e.code || e.message); }
        if (!ok) throw new Error("Foto gagal ditulis, cek rules database");
        $("wHasil").textContent = "Foto profil diganti ke foto bawaan " + (g === "F" ? "cewek" : "cowok") + ".";
        catatLog("Reset foto", uid + " · " + g);
        return;
      }
      const p = { op: opTerpilih, uid };
      if (opTerpilih === "add") { p.coins = jumlah; }
      if (opTerpilih === "vip") { p.tier = Number($("wTier").value) || 1; p.days = Number($("wHari").value) || 30; }
      const out = await walletAdmin(p);
      $("wHasil").textContent = "Selesai: " + (out.coins !== undefined ? "saldo " + out.coins : JSON.stringify(out).slice(0, 240));
      catatLog("Wallet " + opTerpilih, uid || "semua user");
      toast("Perintah dijalankan");
    } catch (e) {
      toast("Gagal: " + (e.message || e.code || "tidak diketahui"), true);
    } finally {
      t.disabled = false; t.textContent = "Jalankan";
    }
  };
}

/* ================= kirim item ke user ================= */
/** Cari UID dari ID angka, ID unik, atau UID yang diketik admin. */
async function uidDariMasukan(masukan) {
  const teks = String(masukan || "").trim();
  if (!teks) return null;
  const bersih = teks.replace(/\s+/g, "");
  if (bersih.length > 20) return bersih;             // sudah berupa UID
  try {
    const d = await getDoc(doc(db, "userIds", bersih));
    if (d.exists() && d.data().uid) return d.data().uid;
  } catch (e) { }
  for (const medan of ["userId", "uid"]) {
    try {
      const s = await getDocs(query(collection(db, "userIds"), where(medan, "==", bersih), limit(1)));
      if (!s.empty) { const u = s.docs[0].data().uid; if (u) return u; }
    } catch (e) { }
  }
  try {
    const s = await getDocs(query(collection(db, "users"), where("userId", "==", bersih), limit(1)));
    if (!s.empty) return s.docs[0].id;
  } catch (e) { }
  return null;
}

async function gambarKirim() {
  const semua = await ambilSemua("vipConfig", 400).catch(() => []);
  const item = semua.filter((d) => d.id && d.slot && !d.meta)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  $("aksiTopbar").innerHTML = "";

  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Kirim item ke user</h3><div class="sub">langsung masuk ke tas user, tanpa beli di Store</div></div>
      <div style="padding:0 14px 14px">
        <div class="grid2">
          <div class="isian"><label>ID user (ID angka, ID unik, atau UID)</label><input id="kUser" placeholder="mis. 923146051900"></div>
          <div class="isian"><label>Durasi (hari)</label><input id="kHari" type="number" value="30"></div>
        </div>
        <div class="isian" style="margin-top:10px"><label>Item</label><select id="kItem">
          ${item.length ? item.map((d) => `<option value="${aman(d.id)}">${aman(d.name || d.id)} · ${aman(namaSlot(d.slot))}${Number(d.price) ? " · " + rupiah(d.price) + " koin" : ""}${d.customId ? " · ID " + aman(d.customId) : ""}</option>`).join("") : '<option value="">Belum ada item, buat di Aset & VIP</option>'}
        </select></div>
        <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
          <button class="tombolUtama" id="kirimSekarang">Kirim ke user</button>
          <span class="catatan" id="kHasil" style="padding:0"></span>
        </div>
        <div class="catatan" style="margin-top:12px">
          Lencana, medali, frame, efek masuk, banner, dan ID unik semuanya dikirim dari sini.
          Item yang dipilih harus sudah dibuat di halaman <b>Aset & VIP</b> supaya gambarnya ada di aplikasi.
          Item tercatat di tas user lewat Realtime Database, jadi langsung terlihat setelah aplikasi dibuka ulang.
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panelAtas"><h3>Buat &amp; kirim item baru (lencana, frame, medali)</h3><div class="sub">tidak perlu bikin dulu di Store atau Aset &amp; VIP</div></div>
      <div style="padding:0 14px 14px">
        <div class="grid2">
          <div class="isian"><label>Nama lencana</label><input id="lncNama" placeholder="mis. Lencana Sultan"></div>
          <div class="isian"><label>Jenis item</label><select id="lncSlot">
            <option value="badge" selected>Lencana</option>
            <option value="medal">Medali</option>
            <option value="frame">Frame</option>
            <option value="entry">Efek masuk</option>
            <option value="banner">Banner</option>
            <option value="uid">ID unik</option>
            <option value="bubble">Gelembung</option>
          </select></div>
        </div>
        <div class="filter" style="margin-top:8px">
          <div class="pil" data-jenis="badge">Lencana</div>
          <div class="pil" data-jenis="frame">Frame avatar</div>
          <div class="pil" data-jenis="medal">Medali</div>
          <div class="pil" data-jenis="entry">Efek masuk</div>
          <div class="pil" data-jenis="banner">Banner</div>
          <div class="pil" data-jenis="uid">ID unik</div>
        </div>
        <div class="grid2" style="margin-top:10px">
          <div class="isian"><label>Harga di Store (koin, opsional)</label><input id="lncHarga" type="number" placeholder="0"></div>
          <div class="isian"><label>Tampilkan juga di Store</label><div class="saklar" id="lncToko"></div></div>
        </div>
        <div style="margin-top:10px">${htmlSumber("lnc", "", ".png,.jpg,.jpeg,.webp,.gif,.svga,.mp4,.webm")}</div>
        <div class="grid2" style="margin-top:10px">
          <div class="isian"><label>ID user penerima</label><input id="lncUser" placeholder="mis. 923146051900"></div>
          <div class="isian"><label>Durasi (hari)</label><input id="lncHari" type="number" value="30"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
          <button class="tombolUtama" id="lncKirim">Buat &amp; kirim ke user</button>
          <span class="catatan" id="lncHasil" style="padding:0"></span>
        </div>
        <div class="catatan" style="margin-top:12px">Gambar boleh dari perangkat atau tautan (PNG, WEBP, GIF, MP4, SVGA). Pratinjau di atas menunjukkan tampilan aslinya. Item langsung dibuat, lalu masuk ke tas user sebagai lencana yang bisa dipakai.</div>
      </div>
    </div>`;

  aktifkanPratinjau("lnc");
  $("isiHal").querySelectorAll("[data-jenis]").forEach((pil) => (pil.onclick = () => {
    $("lncSlot").value = pil.dataset.jenis;
    $("isiHal").querySelectorAll("[data-jenis]").forEach((x) => x.classList.toggle("on", x === pil));
  }));
  $("lncToko").onclick = () => $("lncToko").classList.toggle("on");
  $("lncKirim").onclick = async () => {
    const tombol = $("lncKirim");
    const hasil = $("lncHasil");
    const nama = $("lncNama").value.trim();
    if (!nama) return toast("Nama lencana wajib diisi", true);
    tombol.disabled = true; tombol.textContent = "Memproses…";
    try {
      const url = await urlDariSumber("lnc", "lencana");
      if (!url) throw new Error("Pilih berkas atau isi tautan dulu");
      const uid = await uidDariMasukan($("lncUser").value);
      if (!uid) throw new Error("ID user tidak ditemukan");
      const slot = $("lncSlot").value;
      const hari = Number($("lncHari").value) || 30;
      const idItem = "lnc_" + Date.now().toString(36);
      await simpanVip("item_" + idItem, {
        id: idItem, slot, name: nama,
        price: Number($("lncHarga").value) || 0,
        days: hari, order: 0, kind: cabangBerkas(url), url,
        hasData: false, updatedAt: Date.now(), chunks: 0,
        store: $("lncToko").classList.contains("on"),
        dibuatOleh: (auth.currentUser && auth.currentUser.email) || "", dibuat: Date.now()
      });
      await dSet(dRef(rtdb, `pub/${uid}/svipInv/sx_${idItem}`), Date.now() + hari * 86400000);
      hasil.textContent = "Lencana " + nama + " terkirim, berlaku " + hari + " hari.";
      catatLog("Kirim lencana", nama + " ke " + $("lncUser").value.trim());
      toast("Lencana dibuat dan dikirim");
    } catch (e) {
      hasil.textContent = e.message || "Gagal";
      toast(e.message || "Gagal", true);
    } finally {
      tombol.disabled = false; tombol.textContent = "Buat & kirim ke user";
    }
  };

  $("kirimSekarang").onclick = async () => {
    const tombol = $("kirimSekarang");
    const idItem = $("kItem").value;
    if (!idItem) return toast("Pilih item dulu", true);
    const hari = Number($("kHari").value) || 30;
    tombol.disabled = true; tombol.textContent = "Mengirim…";
    try {
      const uid = await uidDariMasukan($("kUser").value);
      if (!uid) throw new Error("ID user tidak ditemukan");
      const sampai = Date.now() + hari * 86400000;
      await dSet(dRef(rtdb, `pub/${uid}/svipInv/sx_${idItem}`), sampai);
      const nama = item.find((x) => x.id === idItem)?.name || idItem;
      catatLog("Kirim item", `${nama} · ${hari} hari · ke ${uid}`);
      $("kHasil").textContent = `Terkirim: ${nama}, ${hari} hari.`;
      toast("Item terkirim");
    } catch (e) {
      $("kHasil").textContent = "";
      toast("Gagal: " + (e.message || e.code || "tidak diketahui"), true);
    } finally {
      tombol.disabled = false; tombol.textContent = "Kirim ke user";
    }
  };
}

/* ================= aset & VIP (sama seperti Rezo) ================= */
// Aplikasi membaca vipConfig dengan dua bentuk dokumen:
//  1. aset milik tier  : { n: 1..9, slot, kind, url, meta: true, hasData, updatedAt, chunks }
//  2. item toko/kiriman: { id, slot, name, price, days, order, kind, url, hasData, updatedAt,
//                          chunks, targetUid, customId, store }
const SLOT_ASET = [
  { k: "cardbg", n: "Kartu profil VIP (latar kartu)" },
  { k: "frame", n: "Bingkai avatar (frame)" },
  { k: "entry", n: "Efek masuk room" },
  { k: "bubble", n: "Gelembung chat" },
  { k: "title", n: "Gelar" },
  { k: "medal", n: "Medali" },
  { k: "badge", n: "Lencana (badge)" },
  { k: "banner", n: "Banner masuk" },
  { k: "uid", n: "Unique ID (gambar ID)" },
  { k: "avatar", n: "Avatar" }
];
const namaSlot = (k) => SLOT_ASET.find((s) => s.k === k)?.n || k || "—";
const jenisDariUrl = (url) => {
  const bersih = String(url || "").split("?")[0].toLowerCase();
  const ext = bersih.split(".").pop();
  if (ext === "svga") return "svga";
  if (["mp4", "webm"].includes(ext)) return "video";
  return "image";
};

/** Halaman daftar aset yang sudah tersimpan di VPS dompet. */
async function gambarAsetVps() {
  $("aksiTopbar").innerHTML = "";
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Aset di VPS</h3>
        <div class="sub">semua berkas hasil unggahan panel, disajikan langsung dari server Viza</div></div>
      <div style="padding:0 14px 14px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button class="tombolUtama" id="asetVpsMuat">Muat ulang</button>
        </div>
        <div id="asetVpsIsi" class="sub">Memuat…</div>
      </div>
    </div>`;

  const kecil = (f) => {
    const ext = String(f.nama).split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      return `<img src="${aman(f.url)}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:10px;background:#0d1117">`;
    }
    return `<code style="font-size:11px">${aman(ext)}</code>`;
  };

  const muat = async () => {
    const kotak = $("asetVpsIsi");
    kotak.className = "sub";
    kotak.textContent = "Memuat…";
    try {
      const t = await auth.currentUser?.getIdToken();
      const r = await fetch(DOMPET_BASE + "/aset-list?t=" + encodeURIComponent(t || ""), { method: "GET" });
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) throw new Error((j && j.e) || ("HTTP " + r.status));
      if (!j.list || !j.list.length) {
        kotak.innerHTML = 'Belum ada aset. Unggah dulu dari halaman <b>Frame &amp; banner</b>, <b>Aset &amp; VIP</b>, atau <b>Kirim ke user</b>.';
        return;
      }
      const total = j.list.reduce((n, f) => n + (Number(f.ukuran) || 0), 0);
      kotak.className = "";
      kotak.innerHTML = `
        <div class="sub" style="margin-bottom:8px">${j.list.length} berkas · ${(total / 1024 / 1024).toFixed(1)} MB</div>
        <table>
          <thead><tr><th>Berkas</th><th>Ukuran</th><th>Disimpan di</th><th>Alamat</th><th></th></tr></thead>
          <tbody>${j.list.map((f) => `<tr>
            <td>${kecil(f)}</td>
            <td>${Math.max(1, Math.round((Number(f.ukuran) || 0) / 1024))} KB</td>
            <td>${f.simpan === "disk" ? "VPS berkas" : "VPS database"}</td>
            <td><code style="font-size:11px;word-break:break-all">${aman(f.url)}</code></td>
            <td style="white-space:nowrap">
              <button class="tombolKecil" data-salin="${aman(f.url)}">Salin</button>
              <button class="tombolKecil" data-hapusaset="${aman(f.nama)}">Hapus</button>
            </td>
          </tr>`).join("")}</tbody>
        </table>`;
      kotak.querySelectorAll("[data-salin]").forEach((b) => b.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(b.dataset.salin); toast("Alamat disalin"); }
        catch (e) { toast(b.dataset.salin); }
      }));
      kotak.querySelectorAll("[data-hapusaset]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Hapus berkas ini dari VPS?")) return;
        try {
          const t2 = await auth.currentUser?.getIdToken();
          const r2 = await fetch(DOMPET_BASE + "/aset-hapus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ t: t2, nama: b.dataset.hapusaset })
          });
          const j2 = await r2.json().catch(() => null);
          if (!j2 || !j2.ok) throw new Error((j2 && j2.e) || ("HTTP " + r2.status));
          toast("Berkas dihapus");
          muat();
        } catch (e) { toast("Gagal menghapus: " + (e?.message || e), true); }
      }));
    } catch (e) {
      kotak.className = "sub";
      kotak.innerHTML = `Gagal memuat daftar aset: ${aman(e?.message || e)}`;
    }
  };

  $("asetVpsMuat").addEventListener("click", muat);
  await muat();
}

async function gambarAset() {
  const semua = await ambilSemuaVip(400).catch(() => []);
  const asetVip = semua.filter((d) => d.meta === true && Number(d.n) >= 1 && Number(d.n) <= 9);
  const itemToko = semua.filter((d) => d.id && d.slot && !d.meta);

  $("aksiTopbar").innerHTML = `
    <button class="tombolAtas" id="tambahAsetVip">+ Aset VIP</button>
    <button class="tombolAtas" id="tambahItem" style="margin-left:6px">+ Item toko</button>`;
  $("tambahAsetVip").onclick = () => formAsetVip(null);
  $("tambahItem").onclick = () => formItemToko(null);

  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Aset VIP 1-9</h3><div class="sub">vipConfig · meta=true · n dan slot</div>
        <div class="filter"><div class="pil on">${asetVip.length} aset</div></div></div>
      ${asetVip.length ? `<div class="gulirTabel"><table class="tabelKartu">
        <thead><tr><th>PRATINJAU</th><th>TIER</th><th>SLOT</th><th>JENIS</th><th>TAUTAN</th><th>AKSI</th></tr></thead>
        <tbody>${asetVip.sort((x, y) => (Number(x.n) - Number(y.n)) || namaSlot(x.slot).localeCompare(namaSlot(y.slot))).map((d) => `<tr>
          <td data-l="Pratinjau">${pratinjauAset(d.url)}</td>
          <td data-l="Tier" class="vip">VIP ${Number(d.n)}</td>
          <td data-l="Slot">${aman(namaSlot(d.slot))}</td>
          <td data-l="Jenis">${aman(d.kind || jenisDariUrl(d.url))}</td>
          <td data-l="Tautan"><span class="kodekecil" title="${aman(d.url)}">${aman(d.url)}</span></td>
          <td data-l="Aksi" data-aksi>
            <button class="tombolKecil" data-vedit="${aman(d.id)}">Edit</button>
            <button class="tombolKecil" data-salin="${aman(d.url)}">Salin</button>
            <button class="tombolKecil bahaya" data-vhapus="${aman(d.id)}" data-kunci="${aman(d._kunci || "")}">Hapus</button>
          </td>
        </tr>`).join("")}</tbody></table></div>` : '<div class="kosong">Belum ada aset VIP. Tekan + Aset VIP.</div>'}
    </div>

    <div class="panel">
      <div class="panelAtas"><h3>Item toko, frame, efek, dan ID unik</h3><div class="sub">vipConfig · dijual di Store atau dikirim ke akun</div>
        <div class="filter"><div class="pil on">${itemToko.length} item</div></div></div>
      ${itemToko.length ? `<div class="gulirTabel"><table class="tabelKartu">
        <thead><tr><th>PRATINJAU</th><th>NAMA</th><th>SLOT</th><th>HARGA</th><th>HARI</th><th>ID UNIK</th><th>KUNCI AKUN</th><th>JUAL</th><th>AKSI</th></tr></thead>
        <tbody>${itemToko.sort((x, y) => (Number(x.order) || 0) - (Number(y.order) || 0)).map((d) => `<tr>
          <td data-l="Pratinjau">${pratinjauAset(d.url)}</td>
          <td data-l="Nama"><b>${aman(d.name || d.id)}</b></td>
          <td data-l="Slot">${aman(namaSlot(d.slot))}</td>
          <td data-l="Harga">${Number(d.price) ? rupiah(d.price) + " koin" : "gratis"}</td>
          <td data-l="Hari">${Number(d.days) || 7}</td>
          <td data-l="ID unik">${d.customId ? aman(d.customId) : "—"}</td>
          <td data-l="Kunci akun">${d.targetUid ? aman(d.targetUid) : "—"}</td>
          <td data-l="Jual">${d.store === false ? '<span class="tag blokir">kiriman</span>' : '<span class="tag aktif">dijual</span>'}</td>
          <td data-l="Aksi" data-aksi>
            <button class="tombolKecil" data-iedit="${aman(d.id)}">Edit</button>
            <button class="tombolKecil" data-tarik="${aman(d.id)}">${d.store === false ? "Jual lagi" : "Tarik dari Store"}</button>
            <button class="tombolKecil" data-salin="${aman(d.url)}">Salin</button>
            <button class="tombolKecil bahaya" data-ihapus="${aman(d.id)}" data-kunci="${aman(d._kunci || "")}">Hapus</button>
          </td>
        </tr>`).join("")}</tbody></table></div>` : '<div class="kosong">Belum ada item toko.</div>'}
      <div class="catatan" style="padding:0 14px 14px">
        Item dengan ID unik memakai kolom customId, dan bisa dikunci ke satu akun lewat kolom kunci akun (UID atau ID angka user).
        Jenis berkas yang didukung: PNG, WEBP, GIF, MP4, dan animasi SVGA. Unggahan disimpan di Firebase Storage folder aset/&lt;slot&gt;.
      </div>
    </div>`;

  $("isiHal").querySelectorAll("[data-salin]").forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.salin); toast("Tautan disalin"); }
    catch (e) { toast(b.dataset.salin); }
  }));
  $("isiHal").querySelectorAll("[data-vedit]").forEach((b) => (b.onclick = () => formAsetVip(semua.find((x) => x.id === b.dataset.vedit))));
  $("isiHal").querySelectorAll("[data-iedit]").forEach((b) => (b.onclick = () => formItemToko(semua.find((x) => x.id === b.dataset.iedit))));
  const hapusAset = async (id, kunci, pesan, tombol) => {
    if (!confirm(pesan)) return;
    const baris = tombol?.closest("tr");
    if (tombol) { tombol.disabled = true; tombol.textContent = "Menghapus…"; }
    // Hilangkan barisnya lebih dulu supaya langsung terlihat, lalu cocokkan ulang
    // dengan isi server. Kalau gagal, gambarAset() memunculkannya kembali.
    baris?.remove();
    try {
      await hapusVip(id, kunci || undefined);
      catatLog("Hapus aset vipConfig", id);
      toast("Terhapus. Slotnya siap diisi ulang");
    } catch (e) {
      toast("Gagal menghapus: " + (e.code || e.message), true);
    }
    gambarAset();
  };
  $("isiHal").querySelectorAll("[data-vhapus]").forEach((b) => (b.onclick = () => hapusAset(
    b.dataset.vhapus, b.dataset.kunci,
    "Hapus aset VIP ini? Gambar untuk slot tersebut akan hilang dari aplikasi.", b)));
  $("isiHal").querySelectorAll("[data-ihapus]").forEach((b) => (b.onclick = () => hapusAset(
    b.dataset.ihapus, b.dataset.kunci,
    "Hapus item ini? Item hilang dari Store dan dari tas semua user yang memakainya.", b)));
  $("isiHal").querySelectorAll("[data-tarik]").forEach((b) => (b.onclick = async () => {
    const it = semua.find((x) => x.id === b.dataset.tarik);
    if (!it) return;
    const jual = it.store === false;
    b.disabled = true; b.textContent = "Menyimpan…";
    try {
      await setStoreVip(it, jual);
      catatLog(jual ? "Jual item di Store" : "Tarik item dari Store", it.name || it.id);
      toast(jual ? "Item dijual lagi di Store" : "Item ditarik dari Store");
      gambarAset();
    } catch (e) {
      b.disabled = false; b.textContent = jual ? "Jual lagi" : "Tarik dari Store";
      toast("Gagal: " + (e.code || e.message), true);
    }
  }));
}

function formAsetVip(aset) {
  const d = aset || { n: 1, slot: "frame", url: "" };
  modal(aset ? "Edit aset VIP" : "Tambah aset VIP", `
    <div class="grid2">
      <div class="isian"><label>Tier VIP</label><select id="vTier">
        ${Array.from({ length: 9 }, (_, i) => i + 1).map((n) => `<option value="${n}" ${Number(d.n) === n ? "selected" : ""}>VIP ${n}</option>`).join("")}
      </select></div>
      <div class="isian"><label>Slot</label><select id="vSlot">
        ${SLOT_ASET.map((s) => `<option value="${s.k}" ${d.slot === s.k ? "selected" : ""}>${s.n}</option>`).join("")}
      </select></div>
    </div>
    <div style="margin-top:12px">${htmlSumber("v", d.url)}</div>
    <div class="catatan"><b>Kartu VIP</b> ada di slot <b>Kartu profil VIP (latar kartu)</b>. Gambar atau animasi itu tampil di belakang nama dan medali pada semua sheet profil, otomatis sesuai tier VIP user. Ukuran yang cocok: lebar sekitar 3 banding tinggi 2, misalnya 900x600.<br>Berkas PNG, WEBP, GIF, MP4, atau SVGA. Hasil unggahan langsung dipakai aplikasi untuk tier dan slot ini.</div>`,
    async () => {
      const n = Number($("vTier").value);
      const slot = $("vSlot").value;
      const url = await urlDariSumber("v", `vip${n}`);
      if (!url) return toast("Pilih berkas atau isi tautan", true);
      await simpanVip(`vip_${n}_${slot}`, {
        id: `vip_${n}_${slot}`, n, slot, kind: jenisDariUrl(url), url, meta: true, hasData: false,
        updatedAt: Date.now(), chunks: 0
      });
      catatLog("Simpan aset VIP", `VIP ${n} · ${namaSlot(slot)}`);
      toast("Aset VIP disimpan");
      gambarAset();
    });
}

function formItemToko(item) {
  const d = item || { id: "", slot: "frame", name: "", price: 0, days: 7, order: 0, url: "", customId: "", targetUid: "", store: true };
  modal(item ? "Edit item" : "Tambah item toko", `
    <div class="grid2">
      <div class="isian"><label>Nama item</label><input id="iNama" value="${aman(d.name)}" placeholder="Frame Neon"></div>
      <div class="isian"><label>Slot</label><select id="iSlot">
        ${SLOT_ASET.map((s) => `<option value="${s.k}" ${d.slot === s.k ? "selected" : ""}>${s.n}</option>`).join("")}
      </select></div>
    </div>
    <div style="margin-top:12px">${htmlSumber("i", d.url)}</div>
    <div class="grid3" style="margin-top:10px">
      <div class="isian"><label>Harga (koin)</label><input id="iHarga" type="number" value="${Number(d.price) || 0}"></div>
      <div class="isian"><label>Berlaku (hari)</label><input id="iHari" type="number" value="${Number(d.days) || 7}"></div>
      <div class="isian"><label>Urutan</label><input id="iUrut" type="number" value="${Number(d.order) || 0}"></div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div class="isian"><label>ID unik (opsional)</label><input id="iCustom" value="${aman(d.customId)}" placeholder="mis. 1000"></div>
      <div class="isian"><label>Kunci ke akun (opsional)</label><input id="iTarget" value="${aman(d.targetUid)}" placeholder="UID atau ID angka user"></div>
    </div>
    <div class="isian" style="margin-top:10px"><label>Dijual di Store</label>
      <div class="saklar ${d.store !== false ? "on" : ""}" id="iToko"></div>
      <div class="catatan">Matikan kalau item ini hanya untuk dikirim ke akun tertentu lewat panel.</div></div>`,
    async () => {
      const nama = $("iNama").value.trim();
      if (!nama) return toast("Nama item wajib diisi", true);
      const url = await urlDariSumber("i", "item");
      if (!url) return toast("Pilih berkas atau isi tautan", true);
      const idItem = item?.id || (nama.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) + "_" + Date.now().toString().slice(-4));
      await simpanVip(`item_${idItem}`, {
        id: idItem, slot: $("iSlot").value, name: nama,
        price: Number($("iHarga").value) || 0,
        days: Number($("iHari").value) || 7,
        order: Number($("iUrut").value) || 0,
        kind: jenisDariUrl(url), url, hasData: false, updatedAt: Date.now(), chunks: 0,
        targetUid: $("iTarget").value.trim(), customId: $("iCustom").value.trim(),
        store: $("iToko").classList.contains("on")
      });
      catatLog(item ? "Edit item toko" : "Tambah item toko", nama);
      toast("Item disimpan");
      gambarAset();
    }, () => $("iToko").classList.toggle("on"));
}

/* ================= game ================= */
async function gambarKatalog() {
  const games = await ambilSemua("games", 200).catch(() => []);
  $("aksiTopbar").innerHTML = `<button class="tombolAtas" id="kePasang">Pasang game</button>`;
  $("kePasang").onclick = () => (location.hash = "#pasang");
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Game terpasang</h3><div class="sub">koleksi games</div>
        <div class="filter"><div class="pil on">${games.length} game</div></div></div>
      ${games.length ? `<table><tr><th>GAME</th><th>ALAMAT</th><th>KEY</th><th>STATUS</th><th>AKSI</th></tr>
        ${games.map((g) => `<tr>
          <td><div class="user"><div class="mini">${aman(g.emoji || "🎮")}</div>${aman(g.name || g.id)}</div></td>
          <td><a class="aksi" href="${aman(g.url)}" target="_blank" rel="noopener">buka</a></td>
          <td>${g.key ? aman(String(g.key).slice(0, 8)) + "…" : "—"}</td>
          <td>${g.active === false ? '<span class="tag blokir">nonaktif</span>' : '<span class="tag aktif">aktif</span>'}</td>
          <td><button class="aksi" data-ghapus="${aman(g.id)}">Hapus</button></td></tr>`).join("")}
        </table>` : '<div class="kosong">Belum ada game terpasang.<br>Buka menu Pasang game untuk menambahkan.</div>'}
      <div class="catatan" style="padding:0 14px 14px">Daftar ini dibaca aplikasi dari koleksi games. Supaya game baru muncul di HP user tanpa build ulang APK, aplikasi versi berikutnya perlu membaca koleksi ini.</div>
    </div>`;
  $("isiHal").querySelectorAll("[data-ghapus]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus game ini dari daftar?")) return;
    await deleteDoc(doc(db, "games", b.dataset.ghapus)).then(() => { toast("Game dihapus"); catatLog("Hapus game", b.dataset.ghapus); gambarKatalog(); })
      .catch((e) => toast("Gagal: " + (e.code || e.message), true));
  }));
}

async function gambarPasang() {
  const games = await ambilSemua("games", 200).catch(() => []);
  $("isiHal").innerHTML = `
    <div class="panel" style="max-width:620px">
      <div class="panelAtas"><h3>Pasang game baru</h3><div class="sub">tempel alamat dan key production</div></div>
      <div class="panelIsi">
        <div class="grid2">
          <div class="isian"><label>Nama game</label><input id="pNama" placeholder="Greedy King"></div>
          <div class="isian"><label>Emoji</label><input id="pEmoji" placeholder="🎰" value="🎮"></div>
        </div>
        <div class="isian" style="margin-top:10px"><label>Alamat game (URL)</label><input id="pUrl" placeholder="https://…/index.html"></div>
        <div class="isian" style="margin-top:10px"><label>Key production</label><input id="pKey" placeholder="tempel key dari penyedia game"></div>
        <div class="isian" style="margin-top:10px"><label>Jenis</label><select id="pJenis">
          <option value="web">Web game (buka di WebView)</option>
          <option value="wallet">Game dompet (pakai saldo koin)</option>
        </select></div>
        <button class="tombol" id="pSimpan" style="margin-top:14px">Pasang game</button>
        <div class="catatan">Game tersimpan di koleksi games dan langsung tampil di Katalog game. Aplikasi membaca daftar ini pada versi yang sudah mendukung.</div>
      </div>
    </div>
    <div class="panel">
      <div class="panelAtas"><h3>Sudah terpasang</h3><div class="filter"><div class="pil on">${games.length}</div></div></div>
      ${games.length ? `<table><tr><th>GAME</th><th>ALAMAT</th><th>JENIS</th></tr>
        ${games.map((g) => `<tr><td>${aman(g.emoji || "🎮")} ${aman(g.name || g.id)}</td>
        <td style="font-size:10.5px;color:#96a1b4">${aman(String(g.url || "").slice(0, 46))}</td><td>${aman(g.kind || "web")}</td></tr>`).join("")}
        </table>` : '<div class="kosong">Belum ada game.</div>'}
    </div>`;

  $("pSimpan").onclick = async () => {
    const nama = $("pNama").value.trim(), url = $("pUrl").value.trim(), key = $("pKey").value.trim();
    if (!nama || !url) return toast("Nama dan alamat game wajib diisi", true);
    try {
      await setDoc(doc(db, "games", `game_${Date.now()}`), {
        name: nama, url, key, emoji: $("pEmoji").value.trim() || "🎮",
        kind: $("pJenis").value, active: true, order: Date.now(),
        dibuat: serverTimestamp(), oleh: auth.currentUser.email
      });
      catatLog("Pasang game", `${nama} · ${url}`);
      toast("Game terpasang");
      gambarPasang();
    } catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  };
}

async function gambarBet() {
  const [konfig, games] = await Promise.all([
    ambilSemua("gameConfig", 100).catch(() => []),
    ambilSemua("games", 200).catch(() => [])
  ]);
  $("isiHal").innerHTML = `
    <div class="panel" style="max-width:620px">
      <div class="panelAtas"><h3>Atur nilai bet</h3><div class="sub">berlaku untuk game dompet</div></div>
      <div class="panelIsi">
        <div class="isian"><label>Game</label><input id="tGame" placeholder="zeus, greedy, fruitsparty…"></div>
        <div class="grid3" style="margin-top:10px">
          <div class="isian"><label>Bet minimum</label><input id="tMin" type="number" value="100"></div>
          <div class="isian"><label>Bet maksimum</label><input id="tMax" type="number" value="50000"></div>
          <div class="isian"><label>Pilihan chip</label><input id="tChip" placeholder="100,500,1000"></div>
        </div>
        <button class="tombol" id="tSimpan" style="margin-top:14px">Simpan pengaturan bet</button>
        <div class="catatan">Disimpan di koleksi gameConfig dengan nama dokumen = nama game.</div>
      </div>
    </div>
    <div class="panel">
      <div class="panelAtas"><h3>Pengaturan tersimpan</h3><div class="filter"><div class="pil on">${konfig.length}</div></div></div>
      ${konfig.length ? `<table><tr><th>GAME</th><th>MIN</th><th>MAKS</th><th>CHIP</th><th>AKSI</th></tr>
        ${konfig.map((k) => `<tr><td>${aman(k.id)}</td><td>${rupiah(k.minBet)}</td><td>${rupiah(k.maxBet)}</td>
        <td>${aman((k.chips || []).join(", "))}</td>
        <td><button class="aksi" data-hapusbet="${aman(k.id)}">Hapus</button></td></tr>`).join("")}</table>`
        : `<div class="kosong">Belum ada pengaturan bet.${games.length ? " Game terdaftar: " + games.map((g) => aman(g.name)).join(", ") : ""}</div>`}
    </div>`;
  $("tSimpan").onclick = async () => {
    const nama = $("tGame").value.trim().toLowerCase();
    if (!nama) return toast("Nama game wajib diisi", true);
    try {
      await setDoc(doc(db, "gameConfig", nama), {
        minBet: Number($("tMin").value) || 0,
        maxBet: Number($("tMax").value) || 0,
        chips: $("tChip").value.split(",").map((x) => Number(x.trim())).filter((x) => x > 0),
        diperbarui: serverTimestamp()
      }, { merge: true });
      catatLog("Atur bet", nama);
      toast("Pengaturan bet disimpan");
      gambarBet();
    } catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  };
  $("isiHal").querySelectorAll("[data-hapusbet]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus pengaturan bet ini?")) return;
    await deleteDoc(doc(db, "gameConfig", b.dataset.hapusbet)).then(() => { toast("Dihapus"); gambarBet(); })
      .catch((e) => toast("Gagal: " + (e.code || e.message), true));
  }));
}

/* ================= database ================= */
const koleksiUmum = ["userIds", "users", "wallets", "rooms", "gifts", "banners", "frames", "banned", "games", "gameConfig", "panelAdmins", "adminLogs", "vipConfig", "counters", "families", "moments", "chats"];
let koleksiPilih = "userIds";
async function gambarDatabase() {
  $("aksiTopbar").innerHTML = `
    <select id="pilihKoleksi" class="cari" style="width:190px">
      ${koleksiUmum.map((k) => `<option value="${k}" ${k === koleksiPilih ? "selected" : ""}>${k}</option>`).join("")}
    </select>
    <input id="koleksiManual" class="cari" style="width:150px" placeholder="koleksi lain…">
    <button class="tombolAtas" id="muatKoleksi">Muat</button>`;
  $("muatKoleksi").onclick = () => {
    const manual = $("koleksiManual").value.trim();
    koleksiPilih = manual || $("pilihKoleksi").value;
    gambarDatabase();
  };
  $("pilihKoleksi").onchange = () => { koleksiPilih = $("pilihKoleksi").value; gambarDatabase(); };

  const docs = await ambilSemua(koleksiPilih, 60);
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>${aman(koleksiPilih)}</h3><div class="sub">60 dokumen pertama</div>
        <div class="filter"><div class="pil on">${docs.length} dokumen</div></div></div>
      ${docs.length ? `<table><tr><th>ID DOKUMEN</th><th>ISI</th><th>AKSI</th></tr>
        ${docs.map((d) => {
          const salinan = { ...d }; delete salinan.id;
          const ringkas = JSON.stringify(salinan);
          return `<tr>
            <td style="font-family:ui-monospace,monospace;font-size:10.5px">${aman(d.id.slice(0, 22))}</td>
            <td style="font-size:10.5px;color:#96a1b4">${aman(ringkas.slice(0, 110))}${ringkas.length > 110 ? "…" : ""}</td>
            <td><button class="aksi" data-doc="${aman(d.id)}">Buka</button></td></tr>`;
        }).join("")}</table>` : '<div class="kosong">Koleksi kosong atau belum ada.</div>'}
    </div>`;
  $("isiHal").querySelectorAll("[data-doc]").forEach((b) => (b.onclick = () => bukaDokumen(koleksiPilih, b.dataset.doc, docs)));
}

function bukaDokumen(namaKoleksi, id, semua) {
  const asli = semua.find((x) => x.id === id) || {};
  const salinan = { ...asli }; delete salinan.id;
  modal(`${namaKoleksi}/${id}`, `
    <div class="isian"><label>Isi dokumen (JSON)</label><textarea id="docIsi" style="min-height:220px">${aman(JSON.stringify(salinan, null, 2))}</textarea></div>
    <div class="catatan">Ubah nilai lalu simpan. Untuk menghapus, tekan tombol Hapus dokumen.</div>`,
    async () => {
      let data;
      try { data = JSON.parse($("docIsi").value); } catch (e) { return toast("JSON tidak valid", true); }
      await setDoc(doc(db, namaKoleksi, id), data);
      catatLog("Ubah dokumen", `${namaKoleksi}/${id}`);
      toast("Dokumen disimpan");
      gambarDatabase();
    }, null, async () => {
      if (!confirm(`Hapus dokumen ${id} dari ${namaKoleksi}?`)) return;
      await deleteDoc(doc(db, namaKoleksi, id));
      catatLog("Hapus dokumen", `${namaKoleksi}/${id}`);
      toast("Dokumen dihapus");
      gambarDatabase();
    });
}

/* ================= log admin ================= */

/* ================= background tab ================= */
const TAB_LATAR = [
  { k: "party",  n: "Tab Party",  ket: "layar belakang beranda Party" },
  { k: "moment", n: "Tab Moment", ket: "layar belakang Moment" },
  { k: "family", n: "Tab Family", ket: "layar belakang Family" },
  { k: "pesan",  n: "Tab Chat / Pesan", ket: "layar belakang daftar chat" },
  { k: "saya",   n: "Tab Saya",   ket: "layar belakang profil Saya" },
  { k: "nav",    n: "Bilah bawah", ket: "latar menu tab di bagian bawah" }
];

async function bacaLatar() {
  const hasil = {};
  try {
    const d = await getDoc(doc(db, "vipConfig", "tabbg"));
    if (d.exists()) Object.assign(hasil, d.data());
  } catch (e) { console.warn("tabbg firestore:", e.code || e.message); }
  if (!Object.keys(hasil).length) {
    try {
      const s = await dGet(dRef(rtdb, "tabBg"));
      if (s.exists()) Object.assign(hasil, s.val());
    } catch (e) { console.warn("tabBg rtdb:", e.code || e.message); }
  }
  return hasil;
}

async function simpanLatar(tab, isi) {
  let ok = 0, galat = "";
  try { await setDoc(doc(db, "vipConfig", "tabbg"), { [tab]: isi }, { merge: true }); ok++; }
  catch (e) { galat = e.code || e.message; }
  try { await dSet(dRef(rtdb, "tabBg/" + tab), isi); ok++; }
  catch (e) { galat = galat || e.code || e.message; }
  if (!ok) throw new Error("Ditolak server: " + galat);
}

async function gambarLatar() {
  const data = await bacaLatar();
  $("aksiTopbar").innerHTML = "";
  const ringkas = (b) => !b || b.mode === "default" || !b.mode ? "bawaan (kerajaan)" : b.mode === "image" ? "gambar" : "gradien";
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Background layar belakang tab</h3><div class="sub">berlaku untuk semua user begitu dipasang</div></div>
      <table><tr><th>TAB</th><th>KETERANGAN</th><th>SAAT INI</th><th>AKSI</th></tr>
        ${TAB_LATAR.map((x) => {
          const b = data[x.k] || {};
          const mini = b.mode === "image" && b.url
            ? `<img src="${aman(b.url)}" style="width:34px;height:52px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:8px">`
            : b.mode === "gradient"
              ? `<span style="display:inline-block;width:34px;height:52px;border-radius:6px;vertical-align:middle;margin-right:8px;background:linear-gradient(${aman(b.c1 || "#1A0B2E")},${aman(b.c2 || "#0B0B0B")})"></span>` : "";
          return `<tr><td><b>${aman(x.n)}</b></td><td>${aman(x.ket)}</td><td>${mini}${aman(ringkas(b))}</td>
            <td><button class="aksi" data-latar="${x.k}">Atur</button></td></tr>`;
        }).join("")}
      </table>
      <div class="catatan" style="padding:0 14px 14px">Pilih Default untuk kembali ke tampilan kerajaan bawaan. Gambar bisa diunggah dari perangkat atau ditempel tautan. Aplikasi menyimpan cache 5 menit, jadi user melihatnya begitu aplikasi dibuka ulang.</div>
    </div>`;
  $("isiHal").querySelectorAll("[data-latar]").forEach((b) => (b.onclick = () => formLatar(b.dataset.latar, data[b.dataset.latar] || {})));
}

function formLatar(kunci, b) {
  const x = TAB_LATAR.find((y) => y.k === kunci);
  const mode = b.mode || "default";
  modal("Background · " + x.n, `
    <div class="isian"><label>Mode</label><select id="ltMode">
      <option value="default" ${mode === "default" ? "selected" : ""}>Default (kerajaan bawaan)</option>
      <option value="image" ${mode === "image" ? "selected" : ""}>Gambar (unggah atau tautan)</option>
      <option value="gradient" ${mode === "gradient" ? "selected" : ""}>Gradien 2 warna</option>
    </select></div>
    <div id="ltGambar" style="margin-top:10px;${mode === "image" ? "" : "display:none"}">
      <label style="font-size:12px;opacity:.7">Gambar latar (disarankan tinggi, mis. 1080x2400)</label>
      ${htmlSumber("lt", b.url || "", ".png,.jpg,.jpeg,.webp,.gif")}
    </div>
    <div id="ltGradien" class="grid2" style="margin-top:10px;${mode === "gradient" ? "" : "display:none"}">
      <div class="isian"><label>Warna atas (hex)</label><input id="ltC1" value="${aman(b.c1 || "#1A0B2E")}"></div>
      <div class="isian"><label>Warna bawah (hex)</label><input id="ltC2" value="${aman(b.c2 || "#0B0B0B")}"></div>
    </div>
    <div id="ltPra" style="margin-top:10px;height:150px;border-radius:12px;border:1px solid #2c3648"></div>`,
    async () => {
      const m = $("ltMode").value;
      const isi = { mode: m, url: "", c1: "", c2: "", ts: Date.now() };
      if (m === "image") {
        isi.url = (await urlDariSumber("lt", "latar")) || "";
        if (!isi.url) throw new Error("Pilih gambar atau isi tautan dulu");
      }
      if (m === "gradient") {
        isi.c1 = $("ltC1").value.trim(); isi.c2 = $("ltC2").value.trim();
        const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
        if (!hex.test(isi.c1) || !hex.test(isi.c2)) throw new Error("Warna harus format hex, mis. #1A0B2E");
      }
      await simpanLatar(kunci, isi);
      catatLog("Background tab", x.n + " · " + m);
      toast("Background " + x.n + " dipasang");
      gambarLatar();
    });
  const atur = () => {
    const m = $("ltMode").value;
    $("ltGambar").style.display = m === "image" ? "" : "none";
    $("ltGradien").style.display = m === "gradient" ? "" : "none";
    const pra = $("ltPra");
    if (m === "gradient") pra.style.background = `linear-gradient(${$("ltC1").value},${$("ltC2").value})`;
    else if (m === "image") {
      const u = (document.getElementById("ltUrl")?.value || "").trim();
      pra.style.background = u ? `center/cover no-repeat url("${u.replace(/"/g, "")}")` : "#111";
    } else pra.style.background = "linear-gradient(#2a1c4e,#0b0b0b)";
  };
  ["ltMode", "ltC1", "ltC2", "ltUrl"].forEach((id) => document.getElementById(id)?.addEventListener("input", atur));
  document.getElementById("ltMode").addEventListener("change", atur);
  atur();
}

/* ================= customer service ================= */
/* Akun CS disimpan di Realtime Database: _cs/{id,nama,uid,at}.
   APK membaca _cs/uid lebih dulu, jadi berpindah akun tanpa build baru. */
async function gambarCs() {
  $("aksiTopbar").innerHTML = "";
  let info = null;
  try { const s = await dGet(dRef(rtdb, "_cs")); info = s.val() || null; }
  catch (e) { toast("Gagal membaca data CS: " + (e.code || e.message), true); }

  const aktif = info && info.uid && info.aktif !== false ? info : null;
  const dimatikan = info && info.aktif === false;
  const sejak = aktif && aktif.at ? new Date(Number(aktif.at)).toLocaleString("id-ID") : "";

  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Akun Customer Service</h3>
        <div class="sub">semua pesan dari tombol Customer Service di tab Pesan masuk ke akun ini</div></div>
      <div style="padding:0 14px 14px">
        <div class="kartu" style="padding:14px;border-radius:14px;background:${aktif ? "rgba(46,160,67,.12)" : "rgba(255,255,255,.05)"}">
          <div style="font-size:13px;color:#9aa4b2">Status</div>
          <div style="font-size:17px;font-weight:700;margin-top:4px">${aktif ? "AKTIF" : (dimatikan ? "DICABUT" : "BELUM DIATUR")}</div>
          ${aktif ? `
            <div style="margin-top:10px;font-size:14px;line-height:1.7">
              Nama: <b>${aman(aktif.nama || "-")}</b><br>
              ID user: <b>${aman(String(aktif.id || "-"))}</b><br>
              UID: <span class="mono">${aman(String(aktif.uid))}</span>
              ${sejak ? `<br>Diaktifkan: ${aman(sejak)}` : ""}
            </div>` : `
            <div style="margin-top:8px;font-size:13px;color:#9aa4b2">
              Belum ada akun yang ditunjuk. Isi ID user di bawah lalu tekan Aktifkan CS.
            </div>`}
        </div>

        <div class="isian" style="margin-top:14px">
          <label>ID user yang dijadikan Customer Service</label>
          <input id="csId" placeholder="mis. 100005 (ID angka atau UID)" value="${aktif ? aman(String(aktif.id || "")) : ""}">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button id="csAktif" class="utama">Aktifkan CS</button>
          <button id="csCabut" class="polos">Cabut CS</button>
          <button id="csMuat" class="polos">Muat ulang</button>
        </div>
        <div class="ket" style="margin-top:12px">
          Aktifkan CS: chat Customer Service di aplikasi langsung tersambung ke akun itu, tanpa perlu build APK baru.
          Cabut CS: tombol Customer Service dimatikan dan pesan user tidak lagi masuk ke akun tersebut.
        </div>
      </div>
    </div>`;

  $("csMuat").onclick = () => gambarCs();
  $("csAktif").onclick = async () => {
    const teks = String($("csId").value || "").trim();
    if (!teks) return toast("Isi ID user dulu", true);
    const tombol = $("csAktif");
    tombol.disabled = true;
    try {
      const uid = await uidDariMasukan(teks);
      if (!uid) { tombol.disabled = false; return toast("User dengan ID " + teks + " tidak ditemukan", true); }
      let nama = "", idPakai = teks;
      try {
        const p = await getDoc(doc(db, "users", uid));
        if (p.exists()) {
          const d = p.data();
          nama = d.name || d.nickname || "";
          if (d.userId) idPakai = String(d.userId);
        }
      } catch (e) { }
      await dSet(dRef(rtdb, "_cs"), {
        uid, id: String(idPakai), nama, aktif: true, at: Date.now(),
        oleh: auth.currentUser?.email || "?"
      });
      try { await dSet(dRef(rtdb, "ids/i/" + idPakai + "/uid"), uid); } catch (e) { }
      catatLog("Aktifkan CS", "ID " + idPakai + (nama ? " · " + nama : ""));
      toast("Customer Service aktif untuk ID " + idPakai);
      gambarCs();
    } catch (e) {
      tombol.disabled = false;
      toast("Gagal: " + (e.code || e.message), true);
    }
  };
  $("csCabut").onclick = async () => {
    if (!confirm("Cabut Customer Service? Chat CS tidak akan sampai ke akun mana pun.")) return;
    try {
      await dSet(dRef(rtdb, "_cs"), {
        uid: null, id: aktif ? String(aktif.id || "") : "", nama: aktif ? (aktif.nama || "") : "",
        aktif: false, at: Date.now(), oleh: auth.currentUser?.email || "?"
      });
      catatLog("Cabut CS", aktif ? "ID " + (aktif.id || "") : "");
      toast("Customer Service dicabut");
      gambarCs();
    } catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  };
}

/* ================= pengumuman resmi ================= */
async function gambarPengumuman() {
  let daftar = [];
  try {
    const s = await dGet(dRef(rtdb, "pengumuman"));
    if (s.exists()) {
      const v = s.val();
      daftar = Object.keys(v).map((k) => ({ id: k, ...v[k] }))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.at || 0) - (a.at || 0));
    }
  } catch (e) { toast("Gagal membaca pengumuman: " + (e.code || e.message), true); }

  $("aksiTopbar").innerHTML = '<button class="tombolAtas" id="umBaru">+ Pengumuman</button>';
  $("umBaru").onclick = () => formPengumuman(null);

  const tgl = (ms) => ms ? new Date(ms).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  $("isiHal").innerHTML = `
    <div class="kartu">
      <div class="stat"><b>${rupiah(daftar.length)}</b><span>Total</span></div>
      <div class="stat"><b>${rupiah(daftar.filter((x) => x.active !== false).length)}</b><span>Tampil di aplikasi</span></div>
      <div class="stat"><b>${rupiah(daftar.filter((x) => x.pinned).length)}</b><span>Disematkan</span></div>
    </div>
    <div class="panel">
      <div class="panelAtas"><h3>Pengumuman resmi</h3><div class="sub">tampil di chat, Pengumuman Resmi, di aplikasi</div></div>
      ${daftar.length ? `<table><tr><th>FOTO</th><th>JUDUL</th><th>ISI</th><th>WAKTU</th><th>STATUS</th><th>AKSI</th></tr>
        ${daftar.map((x) => `<tr>
          <td>${x.img ? `<img src="${aman(x.img)}" style="width:54px;height:54px;object-fit:cover;border-radius:8px" loading="lazy">` : "—"}</td>
          <td>${x.pinned ? "📌 " : ""}${aman(x.title || "")}</td>
          <td>${aman((x.body || "").slice(0, 70))}${(x.body || "").length > 70 ? "…" : ""}</td>
          <td>${aman(tgl(x.at))}</td>
          <td>${x.active === false ? '<span class="tag blokir">disembunyikan</span>' : '<span class="tag aktif">tampil</span>'}</td>
          <td><button class="aksi" data-umedit="${aman(x.id)}">Edit</button> ·
              <button class="aksi" data-umpin="${aman(x.id)}">${x.pinned ? "Lepas semat" : "Sematkan"}</button> ·
              <button class="aksi" data-umtampil="${aman(x.id)}">${x.active === false ? "Tampilkan" : "Sembunyikan"}</button> ·
              <button class="aksi" data-umhapus="${aman(x.id)}">Hapus</button></td></tr>`).join("")}
        </table>` : '<div class="kosong">Belum ada pengumuman. Tekan + Pengumuman di kanan atas.</div>'}
      <div class="catatan" style="padding:0 14px 14px">Pengumuman yang disematkan tampil paling atas. Teks bisa dipakai saja, foto bisa dipakai saja, atau keduanya.</div>
    </div>`;

  const cari = (id) => daftar.find((x) => x.id === id);
  $("isiHal").querySelectorAll("[data-umedit]").forEach((b) => (b.onclick = () => formPengumuman(cari(b.dataset.umedit))));
  $("isiHal").querySelectorAll("[data-umpin]").forEach((b) => (b.onclick = async () => {
    const x = cari(b.dataset.umpin);
    try { await dUpdate(dRef(rtdb, "pengumuman/" + x.id), { pinned: !x.pinned }); catatLog("Pengumuman", (x.pinned ? "lepas semat " : "sematkan ") + (x.title || x.id)); gambarPengumuman(); }
    catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  }));
  $("isiHal").querySelectorAll("[data-umtampil]").forEach((b) => (b.onclick = async () => {
    const x = cari(b.dataset.umtampil);
    try { await dUpdate(dRef(rtdb, "pengumuman/" + x.id), { active: x.active === false }); gambarPengumuman(); }
    catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  }));
  $("isiHal").querySelectorAll("[data-umhapus]").forEach((b) => (b.onclick = async () => {
    const x = cari(b.dataset.umhapus);
    if (!confirm("Hapus pengumuman \"" + (x.title || x.id) + "\"? Langsung hilang dari aplikasi.")) return;
    try { await dRemove(dRef(rtdb, "pengumuman/" + x.id)); catatLog("Hapus pengumuman", x.title || x.id); toast("Pengumuman dihapus"); gambarPengumuman(); }
    catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  }));
}

function formPengumuman(d) {
  const x = d || {};
  modal(d ? "Edit pengumuman" : "Pengumuman baru", `
    <div class="isian"><label>Judul</label><input id="umJudul" value="${aman(x.title || "")}" placeholder="mis. Pembaruan aplikasi"></div>
    <div class="isian" style="margin-top:10px"><label>Isi pengumuman (teks)</label>
      <textarea id="umIsi" rows="6" style="width:100%;resize:vertical" placeholder="Tulis pengumuman di sini">${aman(x.body || "")}</textarea></div>
    <div style="margin-top:10px"><label style="font-size:12px;opacity:.7">Foto (opsional)</label>
      ${htmlSumber("um", x.img || "", ".png,.jpg,.jpeg,.webp,.gif")}</div>
    <div class="grid2" style="margin-top:10px">
      <div class="isian"><label>Sematkan di atas</label><div class="saklar ${x.pinned ? "on" : ""}" id="umPin"></div></div>
      <div class="isian"><label>Tampil di aplikasi</label><div class="saklar ${x.active !== false ? "on" : ""}" id="umAktif"></div></div>
    </div>`,
    async () => {
      const judul = $("umJudul").value.trim();
      const isi = $("umIsi").value.trim();
      let img = "";
      try { img = (await urlDariSumber("um", "pengumuman")) || ""; }
      catch (e) { return toast("Foto: " + (e.message || e.code), true); }
      if (!judul && !isi && !img) return toast("Isi judul, teks, atau foto dulu", true);
      const id = d ? d.id : "p" + Date.now().toString(36);
      const data = {
        title: judul || "Pengumuman", body: isi, img,
        at: d && d.at ? d.at : Date.now(),
        pinned: $("umPin").classList.contains("on"),
        active: $("umAktif").classList.contains("on"),
        oleh: (auth.currentUser && auth.currentUser.email) || ""
      };
      try {
        await dSet(dRef(rtdb, "pengumuman/" + id), data);
        catatLog(d ? "Edit pengumuman" : "Pengumuman baru", data.title);
        toast("Pengumuman disimpan");
        gambarPengumuman();
      } catch (e) { toast("Gagal menyimpan: " + (e.code || e.message), true); }
    },
    (s) => s.classList.toggle("on"));
}

async function gambarLog() {
  const logs = await ambilSemua("adminLogs", 200).catch(() => []);
  logs.sort((a, b) => (b.waktu?.seconds || 0) - (a.waktu?.seconds || 0));
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Log admin</h3><div class="sub">setiap aksi dari panel dicatat</div>
        <div class="filter"><div class="pil on">${logs.length} catatan</div></div></div>
      ${logs.length ? `<table><tr><th>WAKTU</th><th>ADMIN</th><th>AKSI</th><th>RINCIAN</th></tr>
        ${logs.map((l) => `<tr><td>${waktu(l.waktu)}</td><td>${aman(l.admin)}</td><td>${aman(l.aksi)}</td><td>${aman(l.rincian)}</td></tr>`).join("")}
        </table>` : '<div class="kosong">Belum ada catatan.</div>'}
    </div>`;
}

/* ================= pengaturan ================= */
async function gambarPengaturan() {
  const admins = await ambilSemua("panelAdmins", 100).catch(() => []);
  $("isiHal").innerHTML = `
    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div class="panel" style="width:400px;flex:none">
        <div class="panelAtas"><h3>Daftarkan admin panel</h3></div>
        <div class="panelIsi">
          <div class="isian"><label>Nama</label><input id="aNama" placeholder="Nama admin"></div>
          <div class="isian" style="margin-top:10px"><label>Email (opsional)</label><input id="aEmail" type="email" placeholder="nama@email.com"></div>
          <div class="isian" style="margin-top:10px"><label>Password</label><input id="aSandi" type="text" placeholder="minimal 6 karakter"></div>
          <div class="isian" style="margin-top:10px"><label>Peran</label><select id="aPeran">
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select></div>
          <button class="tombol" id="aSimpan" style="margin-top:14px;width:100%">Daftarkan admin</button>
          <div class="catatan">Password disimpan Firebase Authentication, bukan di panel. Setelah terdaftar, admin bisa masuk dengan email dan password itu.</div>
        </div>
      </div>

      <div class="panel" style="flex:1;min-width:320px">
        <div class="panelAtas"><h3>Admin terdaftar</h3><div class="filter"><div class="pil on">${admins.length + 1} akun</div></div></div>
        <table>
          <tr><th>NAMA</th><th>EMAIL</th><th>PERAN</th><th>STATUS</th><th>AKSI</th></tr>
          <tr><td>Bang Exxx</td><td>${aman(PEMILIK)}</td><td class="vip">owner</td><td><span class="tag aktif">aktif</span></td><td>—</td></tr>
          ${admins.map((a) => `<tr>
            <td>${aman(a.nama || a.id)}</td><td>${aman(a.id)}</td><td>${aman(a.peran || "admin")}</td>
            <td>${a.aktif === false ? '<span class="tag blokir">dicabut</span>' : '<span class="tag aktif">aktif</span>'}</td>
            <td><button class="aksi" data-toggle="${aman(a.id)}" data-aktif="${a.aktif !== false}">${a.aktif === false ? "Aktifkan" : "Cabut"}</button>
            · <button class="aksi" data-hapusadmin="${aman(a.id)}">Hapus</button></td>
          </tr>`).join("")}
        </table>
        <div class="kaki">Hanya email di daftar ini yang bisa membuka panel.</div>
      </div>
    </div>`;

  $("aSimpan").onclick = async () => {
    if (String((adminSaya && adminSaya.peran) || "") !== "owner") {
      return toast("Hanya Owner yang bisa mendaftarkan admin panel", true);
    }
    const nama = $("aNama").value.trim(), sandi = $("aSandi").value, peran = $("aPeran").value;
    let email = ($("aEmail").value || "").trim().toLowerCase();
    // Email tidak wajib. Kalau dikosongkan, panel membuat alamat login internal
    // dari nama admin, jadi owner cukup mengisi nama dan password.
    const emailInternal = !email;
    if (!nama || sandi.length < 6) return toast("Nama dan password minimal 6 karakter wajib diisi", true);
    try {
      const appKedua = initializeApp(firebaseConfig, "pendaftar-" + Date.now());
      const authKedua = getAuth(appKedua);
      // Buat akun login. Kalau email dikosongkan, alamat dibuat dari nama admin
      // (mis. boypanel@vizapanel.app) supaya password yang diketik langsung berlaku.
      let akunBaru = false;
      const dasar = kunciNama(nama) || "admin";
      const calon = emailInternal
        ? [1, 2, 3, 4, 5].map((n) => dasar + (n === 1 ? "" : n) + "@vizapanel.app")
        : [email];
      let galatTerakhir = null;
      for (const alamat of calon) {
        try {
          const kredensial = await createUserWithEmailAndPassword(authKedua, alamat, sandi);
          await updateProfile(kredensial.user, { displayName: nama }).catch(() => {});
          await signOut(authKedua);
          email = alamat;
          akunBaru = true;
          galatTerakhir = null;
          break;
        } catch (e) {
          galatTerakhir = e;
          const kode = String(e.code || "");
          if (kode !== "auth/email-already-in-use") break;
          if (!emailInternal) { await signOut(authKedua).catch(() => {}); break; }
        }
      }
      if (!akunBaru && galatTerakhir && String(galatTerakhir.code || "") !== "auth/email-already-in-use") throw galatTerakhir;
      await deleteApp(appKedua).catch(() => {});

      await setDoc(doc(db, "panelAdmins", email), {
        nama, peran, aktif: true, dibuat: serverTimestamp(), oleh: auth.currentUser.email
      });
      // Akun lama tidak bisa diberi sandi baru dari panel (Firebase menolak).
      // Jadi kirim tautan reset supaya dia bisa membuat sandi sendiri.
      let tautanTerkirim = false;
      if (!akunBaru && !emailInternal) {
        try {
          await sendPasswordResetEmail(auth, email);
          tautanTerkirim = true;
        } catch (e) { console.warn("reset gagal:", e.code); }
      }

      // Simpan nama agar admin bisa login memakai namanya, bukan email.
      // Kalau aturan Firestore panelNama belum dipublikasikan, jangan gagalkan
      // pendaftaran: admin tetap terdaftar dan bisa masuk memakai email.
      let namaTersimpan = true;
      try {
        await setDoc(doc(db, "panelNama", kunciNama(nama)), { nama, email, peran }, { merge: true });
      } catch (e) {
        namaTersimpan = false;
        console.warn("panelNama gagal:", e.code);
      }
      catatLog("Daftarkan admin", `${nama} · ${email} · ${peran}`);
      toast(
        (akunBaru ? "Admin terdaftar. Dia bisa langsung masuk dengan email dan password itu." : "Email itu sudah punya akun login. Akses panel ditambahkan; dia masuk dengan sandi lamanya atau reset sandi dulu.")
        + (namaTersimpan ? "" : " Catatan: login pakai nama belum aktif karena aturan Firestore panelNama belum dipublikasikan; untuk sekarang masuk pakai email.")
        + (tautanTerkirim ? " Karena akun loginnya sudah ada, tautan buat sandi baru sudah dikirim ke email itu." : ""),
        true,
      );
      gambarPengaturan();
    } catch (e) {
      toast("Gagal: " + pesanAuth(e), true);
    }
  };

  $("isiHal").querySelectorAll("[data-toggle]").forEach((b) => (b.onclick = async () => {
    const aktifBaru = b.dataset.aktif !== "true";
    const emailAdmin = b.dataset.toggle;
    await setDoc(doc(db, "panelAdmins", emailAdmin), { aktif: aktifBaru }, { merge: true })
      .then(async () => {
        // Nama untuk login ikut dicabut atau dipasang lagi supaya sama dengan aksesnya.
        try {
          const dd = await getDoc(doc(db, "panelAdmins", emailAdmin));
          const namaAdmin = dd.exists() ? String(dd.data().nama || "") : "";
          if (namaAdmin) {
            const kunci = kunciNama(namaAdmin);
            if (aktifBaru) await setDoc(doc(db, "panelNama", kunci), { nama: namaAdmin, email: emailAdmin }, { merge: true });
            else await deleteDoc(doc(db, "panelNama", kunci)).catch(() => {});
          }
        } catch (e) { console.warn("panelNama:", e.code); }
        toast(aktifBaru ? "Akses diaktifkan" : "Akses dicabut, dia tidak bisa masuk lagi");
        catatLog(aktifBaru ? "Aktifkan admin" : "Cabut admin", emailAdmin);
        gambarPengaturan();
      })
      .catch((e) => toast("Gagal: " + (e.code || e.message), true));
  }));
  $("isiHal").querySelectorAll("[data-hapusadmin]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus admin ini dari daftar panel? Akun Firebase-nya tetap ada, tapi tidak bisa membuka panel.")) return;
    const emailHapus = b.dataset.hapusadmin;
    try {
      // Ambil namanya dulu supaya pemetaan nama untuk login ikut dibersihkan.
      const dd = await getDoc(doc(db, "panelAdmins", emailHapus));
      const namaHapus = dd.exists() ? String(dd.data().nama || "") : "";
      await deleteDoc(doc(db, "panelAdmins", emailHapus));
      if (namaHapus) await deleteDoc(doc(db, "panelNama", kunciNama(namaHapus))).catch(() => {});
      toast("Admin dihapus, dia tidak bisa masuk lagi. Email yang sama boleh didaftarkan ulang kapan saja.");
      catatLog("Hapus admin", emailHapus);
      gambarPengaturan();
    } catch (e) { toast("Gagal: " + (e.code || e.message), true); }
  }));
}

/* ================= modal ================= */
function modal(judul, isiHtml, saatSimpan, saatToggle, saatHapus) {
  const tirai = el("div", undefined, "tirai");
  tirai.innerHTML = `
    <div class="modal">
      <div class="modalAtas"><h3>${aman(judul)}</h3><button id="modalTutup">✕</button></div>
      <div class="modalIsi">${isiHtml}</div>
      ${saatSimpan || saatHapus ? `<div class="modalKaki">
        ${saatHapus ? '<button class="tombol polos bahaya" id="modalHapus">Hapus dokumen</button>' : ""}
        <button class="tombol polos" id="modalBatal">Tutup</button>
        ${saatSimpan ? '<button class="tombol" id="modalSimpan">Simpan</button>' : ""}
      </div>` : ""}
    </div>`;
  document.body.appendChild(tirai);
  tirai.querySelectorAll("[data-sumber]").forEach((k) => aktifkanPratinjau(k.dataset.sumber));
  const tutup = () => tirai.remove();
  tirai.querySelector("#modalTutup").onclick = tutup;
  const batal = tirai.querySelector("#modalBatal");
  if (batal) batal.onclick = tutup;
  const simpan = tirai.querySelector("#modalSimpan");
  if (simpan) simpan.onclick = async () => {
    simpan.disabled = true;
    try { await saatSimpan(); tutup(); }
    catch (e) { toast("Gagal: " + (e.code || e.message), true); simpan.disabled = false; }
  };
  const hapus = tirai.querySelector("#modalHapus");
  if (hapus) hapus.onclick = async () => {
    hapus.disabled = true;
    try { await saatHapus(); tutup(); }
    catch (e) { toast("Gagal: " + (e.code || e.message), true); hapus.disabled = false; }
  };
  if (saatToggle) {
    tirai.querySelectorAll(".saklar").forEach((s) => (s.onclick = () => saatToggle(s)));
  }
  return tirai;
}

/* mulai */
bukaRute();
console.log("Viza Panel siap · project", firebaseConfig.projectId);

/* pasang sebagai aplikasi */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* ================= cek in harian ================= */
/* APK membaca RTDB signinCfg: { enabled, target, days/{1..7}{coins,item,itemDays,vip,vipDays} }.
   Jadi hadiah cek in bisa diubah dari sini tanpa membangun ulang APK. */
const BAWAAN_CEKIN = [
  { coins: 10_000_000, item: "", itemDays: 3, vip: 0, vipDays: 0 },
  { coins: 40_000_000, item: "", itemDays: 3, vip: 0, vipDays: 0 },
  { coins: 80_000_000, item: "", itemDays: 3, vip: 0, vipDays: 0 },
  { coins: 10_000_000, item: "", itemDays: 3, vip: 0, vipDays: 0 },
  { coins: 20_000_000, item: "", itemDays: 3, vip: 0, vipDays: 0 },
  { coins: 50_000_000, item: "", itemDays: 3, vip: 0, vipDays: 0 },
  { coins: 100_000_000, item: "", itemDays: 3, vip: 1, vipDays: 0 }
];

function hariCekIn(cfg) {
  const d = (cfg && cfg.days) || {};
  return BAWAAN_CEKIN.map((b, i) => {
    const x = d[String(i + 1)] || {};
    return {
      coins: Number(x.coins ?? b.coins),
      item: String(x.item ?? b.item ?? ""),
      itemDays: Number(x.itemDays ?? b.itemDays ?? 3),
      vip: Number(x.vip ?? b.vip ?? 0),
      vipDays: Number(x.vipDays ?? b.vipDays ?? 0)
    };
  });
}

async function bacaCekIn() {
  const s = await dGet(dRef(rtdb, "signinCfg"));
  return s.exists() ? (s.val() || {}) : {};
}

/* Daftar kunci aset di Store, untuk saran kolom item. */
async function kunciAsetStore() {
  try {
    const s = await dGet(dRef(rtdb, "vipCfg"));
    return s.exists() ? Object.keys(s.val() || {}) : [];
  } catch (e) { return []; }
}

async function gambarCekIn() {
  const cfg = await bacaCekIn();
  const hari = hariCekIn(cfg);
  const aktif = cfg.enabled === false ? false : true;
  const target = Number(cfg.target ?? 18);
  const kunci = await kunciAsetStore();
  const daftarKunci = kunci.map((k) => `<option value="${aman(k)}"></option>`).join("");
  $("aksiTopbar").innerHTML = "";
  $("isiHal").innerHTML = `
    <div class="panel">
      <div class="panelAtas"><h3>Cek in harian</h3><div class="sub">hadiah hari 1 sampai 7, dibaca aplikasi langsung dari database</div></div>
      <div style="padding:12px 14px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end">
        <div class="isian" style="min-width:170px;margin:0"><label>Cek in harian</label>
          <select id="ciAktif">
            <option value="1" ${aktif ? "selected" : ""}>Aktif</option>
            <option value="0" ${aktif ? "" : "selected"}>Nonaktif</option>
          </select>
        </div>
        <div class="isian" style="min-width:170px;margin:0"><label>Target hari (teks di aplikasi)</label>
          <input id="ciTarget" type="number" min="1" max="365" value="${target}">
        </div>
        <button class="utama" id="ciSimpanAtas">Simpan</button>
      </div>
      <table><tr><th>HARI</th><th>COIN</th><th>ITEM</th><th>VIP</th><th>AKSI</th></tr>
        ${hari.map((h, i) => `<tr>
          <td><b>Hari ${i + 1}</b></td>
          <td>${rupiah(h.coins)}</td>
          <td>${h.item ? aman(h.item) + (h.itemDays ? ` · ${h.itemDays} hari` : "") : "<span style='opacity:.6'>tidak ada</span>"}</td>
          <td>${h.vip ? `VIP ${h.vip}` + (h.vipDays ? ` · ${h.vipDays} hari` : "") : "<span style='opacity:.6'>tidak ada</span>"}</td>
          <td><button class="aksi" data-hari="${i + 1}">Edit</button></td>
        </tr>`).join("")}
      </table>
      <div class="catatan" style="padding:0 14px 14px">Coin dikirim langsung ke dompet user. Kolom item bisa diisi kunci aset Store (mis. frame atau badge) atau dibiarkan kosong. Perubahan berlaku begitu user membuka aplikasi lagi; status klaim tiap user tidak terpengaruh.</div>
      <datalist id="ciAset">${daftarKunci}</datalist>
    </div>`;
  $("ciSimpanAtas").onclick = async () => {
    try {
      await dUpdate(dRef(rtdb, "signinCfg"), {
        enabled: $("ciAktif").value === "1",
        target: Math.max(1, Math.trunc(Number($("ciTarget").value) || 18))
      });
      toast("Cek in harian tersimpan");
      gambarCekIn();
    } catch (e) { toast("Gagal menyimpan: " + (e.code || e.message), "gagal"); }
  };
  $("isiHal").querySelectorAll("[data-hari]").forEach((b) => {
    b.onclick = () => formCekIn(Number(b.dataset.hari), hari[Number(b.dataset.hari) - 1]);
  });
}

function formCekIn(nomor, h) {
  modal("Hadiah hari " + nomor, `
    <div class="isian"><label>Coin</label><input id="ciCoin" type="number" min="0" step="1000" value="${h.coins}"></div>
    <div class="isian"><label>Item Store (kunci aset, boleh kosong)</label>
      <input id="ciItem" list="ciAset2" value="${aman(h.item)}" placeholder="mis. frame-fox">
      <datalist id="ciAset2">${Array.from(document.querySelectorAll("#ciAset option")).map((o) => `<option value="${aman(o.value)}"></option>`).join("")}</datalist>
    </div>
    <div class="isian"><label>Masa item (hari)</label><input id="ciItemHari" type="number" min="0" value="${h.itemDays}"></div>
    <div class="isian"><label>VIP (0 = tidak ada)</label><input id="ciVip" type="number" min="0" max="9" value="${h.vip}"></div>
    <div class="isian"><label>Masa VIP (hari)</label><input id="ciVipHari" type="number" min="0" value="${h.vipDays}"></div>
  `, async () => {
    const isi = {
      coins: Math.max(0, Math.trunc(Number($("ciCoin").value) || 0)),
      item: $("ciItem").value.trim(),
      itemDays: Math.max(0, Math.trunc(Number($("ciItemHari").value) || 0)),
      vip: Math.min(9, Math.max(0, Math.trunc(Number($("ciVip").value) || 0))),
      vipDays: Math.max(0, Math.trunc(Number($("ciVipHari").value) || 0))
    };
    try {
      await dSet(dRef(rtdb, "signinCfg/days/" + nomor), isi);
      toast("Hari " + nomor + " tersimpan");
      gambarCekIn();
    } catch (e) { toast("Gagal menyimpan: " + (e.code || e.message), "gagal"); }
  });
}
