#!/usr/bin/env bash
# Perbarui kode dompet di VPS lalu jalankan ulang layanannya.
# Pakai: bash <(curl -fsSL https://raw.githubusercontent.com/exbottod/rezo-star-voice-chat-room/main/vps/update.sh)
set -euo pipefail
DIR="${DIR:-/opt/rezo-api}"
RAW="${REPO_RAW:-https://raw.githubusercontent.com/exbottod/rezo-star-voice-chat-room/main}"
[ "$(id -u)" = "0" ] || { echo "Jalankan sebagai root"; exit 1; }
echo "Mengunduh kode dompet terbaru..."
# Semua berkas yang diimpor index.js harus ikut diunduh, kalau tidak layanan
# gagal start karena modul hilang.
curl -fsSL "$RAW/workers/wallet/src/index.js" -o "$DIR/index.js"
curl -fsSL "$RAW/vps/server.js" -o "$DIR/server.js"
# APK terbaru untuk halaman unduh sendiri (tautan GitHub membuka app GitHub
# di HP pengguna, jadi mereka mendarat di layar login).
mkdir -p "$DIR/apk"
GH="${GH_APK:-https://github.com/exbottod/rezo-star-voice-chat-room/releases/download/terbaru}"
for f in REZO-STAR-universal.apk REZO-STAR-arm64.apk REZO-STAR-armv7.apk; do
  if curl -fsSL --max-time 240 "$GH/$f" -o "$DIR/apk/$f"; then
    echo "APK siap: $f ($(du -h "$DIR/apk/$f" | cut -f1))"
  else
    echo "APK gagal diunduh: $f"
  fi
done
curl -fsSL "https://exbottod.github.io/rezo-star-voice-chat-room/build-info.json" \
  | sed -n 's/.*"versi" *: *"\([^"]*\)".*/\1/p' > "$DIR/apk/versi.txt" || true

# ---- Game slot Zeus Treasures ----
# Gambar game besar diambil dari sumber aslinya, lalu bagian yang menghubungkan
# ke dompet REZO diambil dari repo ini.
SLOT="$DIR/slot"
if [ ! -f "$SLOT/index.html" ] || [ "${SLOT_SEGAR:-0}" = "1" ]; then
  echo "Menyiapkan game slot..."
  [ -d "$SLOT" ] && find "$SLOT" -mindepth 1 -delete
  [ -d "$DIR/slot-unduh" ] && find "$DIR/slot-unduh" -mindepth 1 -delete
  mkdir -p "$SLOT" "$DIR/slot-unduh"
  if curl -fsSL --max-time 420 "https://github.com/marksantiago290/Slot-Machine-HTML5/archive/refs/heads/main.zip" -o "$DIR/slot-unduh/slot.zip"; then
    if command -v unzip >/dev/null 2>&1; then
      unzip -q "$DIR/slot-unduh/slot.zip" -d "$DIR/slot-unduh"
    else
      python3 -m zipfile -e "$DIR/slot-unduh/slot.zip" "$DIR/slot-unduh"
    fi
    cp -r "$DIR/slot-unduh/Slot-Machine-HTML5-main/game/." "$SLOT/" || true
    curl -fsSL "$RAW/slot-patch/index.html" -o "$SLOT/index.html"
    curl -fsSL "$RAW/slot-patch/js/rezo_hook.js" -o "$SLOT/js/rezo_hook.js"
    find "$DIR/slot-unduh" -mindepth 1 -delete
    echo "Game slot siap: $(du -sh "$SLOT" | cut -f1)"
  else
    echo "Game slot gagal diunduh, dilewati"
  fi
fi

# Dua berkas sambungan dompet selalu diperbarui supaya perubahan taruhan dari
# panel langsung terpakai tanpa mengunduh ulang seluruh game.
if [ -f "$SLOT/index.html" ]; then
  curl -fsSL "$RAW/slot-patch/index.html" -o "$SLOT/index.html" || true
  curl -fsSL "$RAW/slot-patch/js/rezo_hook.js" -o "$SLOT/js/rezo_hook.js" || true
  echo "Sambungan dompet slot diperbarui"
fi


# ---- Halaman Greedy Rezo ----
# Disajikan dari server yang sama dengan dompet, supaya permintaan dari halaman
# game tidak lagi lewat jalur antar-situs yang sering gagal di WebView.
GREEDY="$DIR/greedy-play"
mkdir -p "$GREEDY/assets/images"
if curl -fsSL "$RAW/docs/greedy/index.html" -o "$GREEDY/index.html"; then
  for f in $(grep -o 'assets/index-[A-Za-z0-9]*\.\(js\|css\)' "$GREEDY/index.html" | sort -u); do
    mkdir -p "$GREEDY/$(dirname "$f")"
    curl -fsSL "$RAW/docs/greedy/$f" -o "$GREEDY/$f" || echo "Gagal unduh $f"
  done
  for g in cabbage carrot corn drumstick hotdog pizza salad skewer steak tomato icon; do
    curl -fsSL "$RAW/docs/greedy/assets/images/$g.png" -o "$GREEDY/assets/images/$g.png" || true
  done
  echo "Halaman Greedy siap: $(du -sh "$GREEDY" | cut -f1)"
else
  echo "Halaman Greedy gagal diunduh, dilewati"
fi

# ---- Viza: dompet dan panel di server yang sama ----
# Dipakai supaya perubahan panel Viza bisa langsung tayang tanpa menunggu
# unggahan ke GitHub Pages.
if [ -d /opt/viza-api ] && [ -f /opt/viza-api/index.js ]; then
  RAW_V=https://raw.githubusercontent.com/exbottod/rezo-star-voice-chat-room/main/vps/viza
  cp /opt/viza-api/index.js "/opt/viza-api/index.js.bak-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
  # Berkas sementara harus berakhiran .mjs: Node menolak memeriksa ekstensi lain.
  SEMENTARA=/opt/viza-api/.index-baru-$$.mjs
  if curl -fsSL "$RAW_V/index.js?cb=$(date +%s)" -o "$SEMENTARA"; then
    if GALAT=$(node --check "$SEMENTARA" 2>&1); then
      mv "$SEMENTARA" /opt/viza-api/index.js
      echo "Viza: kode dompet diperbarui"
    else
      echo "Viza: kode baru tidak sah -> $(echo "$GALAT" | head -3 | tr '\n' ' ')"
      rm -f "$SEMENTARA"
    fi
  else
    echo "Viza: unduh kode dompet gagal"
  fi
  mkdir -p /opt/viza-api/panel
  for f in index.html app.js i18n.js styles.css manifest.webmanifest favicon.ico sw.js; do
    curl -fsSL "$RAW_V/panel/$f?cb=$(date +%s)" -o "/opt/viza-api/panel/$f" || echo "Viza: gagal unduh $f"
  done
  # Panel yang dipakai Caddy ada di folder lain lagi: /opt/viza-panel/admin.
  if [ -d /opt/viza-panel/admin ]; then
    RAW_P=https://raw.githubusercontent.com/exbottod/viza-chat-voice-room/main/docs/panel/admin
    for f in index.html app.js i18n.js styles.css manifest.webmanifest favicon.ico sw.js; do
      curl -fsSL "$RAW_P/$f?cb=$(date +%s)" -o "/opt/viza-panel/admin/$f" || echo "Panel: gagal unduh $f"
    done
    echo "Panel Viza diperbarui di /opt/viza-panel/admin"
  fi
  systemctl restart viza-dompet >/dev/null 2>&1 || true
  for i in $(seq 1 15); do
    sleep 1
    curl -s --max-time 3 "https://viza.43-156-99-4.sslip.io/health" | grep -q '"ok":1' && break
  done
  echo -n "Viza health: "; curl -s --max-time 8 "https://viza.43-156-99-4.sslip.io/health"; echo
  echo -n "Viza panel: "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 "https://viza.43-156-99-4.sslip.io/panel/"
fi

node --check "$DIR/index.js" || { echo "Sintaks index.js salah, layanan tidak direstart"; exit 1; }
systemctl restart rezo-api
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  if curl -fsS --max-time 5 http://127.0.0.1:8080/health >/dev/null 2>&1; then break; fi
done
echo -n "status layanan : "; systemctl is-active rezo-api || true
echo -n "cek lokal      : "; curl -s --max-time 8 http://127.0.0.1:8080/health || echo "(gagal)"
echo
if ! curl -fsS --max-time 8 http://127.0.0.1:8080/health >/dev/null 2>&1; then
  echo "Layanan tidak sehat, potongan log terakhir:"
  journalctl -u rezo-api -n 30 --no-pager || true
  exit 1
fi
echo "Selesai. Versi dompet di VPS sudah yang terbaru."
