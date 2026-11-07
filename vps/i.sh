#!/usr/bin/env bash
# Pintasan: ambil bootstrap.sh lalu jalankan.
set -e
BASE="${BASE:-https://raw.githubusercontent.com/exbottod/rezo-star-voice-chat-room/main/vps}"
curl -fsSL "$BASE/bootstrap.sh" -o /tmp/bootstrap.sh
exec bash /tmp/bootstrap.sh
