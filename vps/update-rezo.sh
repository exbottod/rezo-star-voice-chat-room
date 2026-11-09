#!/usr/bin/env bash
# Pasang versi terbaru kode REZO ke VPS lalu jalankan ulang.
# Pakai: sudo bash vps/update-rezo.sh
set -e
[ "$(id -u)" = "0" ] || { echo "Jalankan dengan sudo"; exit 1; }

SRC=/tmp/rezo-src
DIR=/opt/rezo-api
[ -d "$SRC/.git" ] || { echo "Repo belum ada di $SRC"; exit 1; }

cd "$SRC"
git pull -q

install -o rezo -g rezo -m 644 workers/wallet/src/index.js "$DIR/index.js"
install -o rezo -g rezo -m 644 vps/server.js "$DIR/server.js"

# Bersihkan sisa pengaturan Turso; database sekarang SQLite lokal.
if [ -f /etc/rezo/api.env ] && grep -q '^TURSO' /etc/rezo/api.env; then
  cp /etc/rezo/api.env /etc/rezo/api.env.bak
  sed -i '/^TURSO_/d' /etc/rezo/api.env
  echo "env    : baris TURSO dihapus (cadangan: /etc/rezo/api.env.bak)"
fi

systemctl restart rezo-api
sleep 4

echo -n "status : "; systemctl is-active rezo-api
echo -n "health : "; curl -s --max-time 10 http://127.0.0.1:8080/health || echo "(gagal)"
echo
if [ -f /etc/systemd/system/rezo-api.service.d/resend.conf ]; then
  echo "email  : kunci Resend sudah terpasang"
else
  echo "email  : kunci Resend belum ada (jalankan vps/pasang-resend.sh)"
fi
