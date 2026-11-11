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
