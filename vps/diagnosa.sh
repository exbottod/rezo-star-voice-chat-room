echo "@@@ BATAS DI FILE VPS"
grep -n "10000000000000" /opt/rezo-api/index.js | head -4
echo "@@@ SISA BATAS LAMA (harus kosong)"
grep -n "100000000000)" /opt/rezo-api/index.js | head -4
echo "@@@ STATUS LAYANAN"
systemctl is-active rezo-api
echo "@@@ UJI JALUR PANEL (harus menolak karena sesi kosong, bukan karena batas)"
curl -s -m 8 -X POST http://127.0.0.1:8080/panel -H "Content-Type: application/json" -d '{"a":"send_coin","t":"x","p":{"to":"abc123","coins":9999999999999}}' | head -c 200; echo
