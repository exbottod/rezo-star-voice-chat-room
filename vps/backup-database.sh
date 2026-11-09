#!/usr/bin/env bash
# Backup harian database SQLite REZO (tanpa biaya, tanpa layanan luar).
# Pakai: sudo bash vps/backup-database.sh
set -e
[ "$(id -u)" = "0" ] || { echo "Jalankan dengan sudo"; exit 1; }
DIR=/opt/rezo-api
BK=$DIR/backup
NODE=$(command -v node)

mkdir -p "$BK"
chown rezo:rezo "$BK"

cat > "$DIR/backup-db.sh" <<'SKRIP'
#!/usr/bin/env bash
set -e
DIR=/opt/rezo-api
BK=$DIR/backup
HARI=$(date +%F-%H%M)
NODE=__NODE__
mkdir -p "$BK"
"$NODE" --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';
const d = new DatabaseSync(process.argv[1]);
d.exec(\"VACUUM INTO '\" + process.argv[2] + \"'\");
d.close();
" "$DIR/data/rezo.db" "$BK/rezo-$HARI.db"
# Simpan 7 salinan terakhir saja.
ls -1t "$BK"/rezo-*.db 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "$(date '+%F %H:%M') backup: rezo-$HARI.db ($(du -h "$BK/rezo-$HARI.db" | cut -f1))"
SKRIP
sed -i "s|__NODE__|$NODE|" "$DIR/backup-db.sh"
chmod +x "$DIR/backup-db.sh"

cat > /etc/systemd/system/rezo-backup.service <<'CONF'
[Unit]
Description=Backup database REZO

[Service]
Type=oneshot
ExecStart=/opt/rezo-api/backup-db.sh
CONF

cat > /etc/systemd/system/rezo-backup.timer <<'CONF'
[Unit]
Description=Backup database REZO tiap hari

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
CONF

systemctl daemon-reload
systemctl enable --now rezo-backup.timer >/dev/null 2>&1
echo "Menjalankan backup pertama..."
/opt/rezo-api/backup-db.sh
echo
echo -n "timer  : "; systemctl is-active rezo-backup.timer
echo -n "jadwal : "; systemctl list-timers rezo-backup.timer --no-pager | sed -n 2p | awk '{print $1, $2, $3}'
echo -n "berkas : "; ls -1 "$BK" | tail -3 | tr '\n' ' '
echo
