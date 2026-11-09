#!/usr/bin/env bash
# Pasang kunci Resend di server REZO. Kunci tidak disimpan di aplikasi.
# Pakai: sudo bash vps/pasang-resend.sh
set -e
[ "$(id -u)" = "0" ] || { echo "Jalankan dengan sudo"; exit 1; }

printf "Tempel API key Resend (diawali re_): "
read -r KEY
case "$KEY" in
  re_*) ;;
  *) echo "Kunci tidak sah, harus diawali re_"; exit 1 ;;
esac

printf "Email pengirim (Enter = onboarding@resend.dev): "
read -r DARI
DARI=${DARI:-onboarding@resend.dev}

mkdir -p /etc/systemd/system/rezo-api.service.d
cat > /etc/systemd/system/rezo-api.service.d/resend.conf <<CONF
[Service]
Environment=RESEND_KEY=$KEY
Environment=RESEND_DARI=$DARI
CONF

systemctl daemon-reload
systemctl restart rezo-api
sleep 4
echo -n "status : "; systemctl is-active rezo-api
echo -n "health : "; curl -s --max-time 10 http://127.0.0.1:8080/health || echo "(gagal)"
echo
echo "Uji kirim ke $DARI :"
curl -s --max-time 20 -X POST http://127.0.0.1:8080/email/uji \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d "{\"ke\":\"$DARI\"}" || true
echo
