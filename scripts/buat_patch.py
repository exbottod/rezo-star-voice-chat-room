#!/usr/bin/env python3
"""Pembuat file selisih (patch) untuk pembaruan APK kecil.

Membandingkan APK versi lama dengan APK versi baru, lalu menulis file
"hanya bagian yang berubah" (format BSDIFF40). Aplikasi mengunduh file ini,
menempelkannya ke APK lama di HP, dan hasilnya menjadi APK baru yang utuh.

Pemakaian:
  python3 scripts/buat_patch.py --lama lama.apk --baru baru.apk \
      --kunci arm64 --keluaran patch-arm64.bin \
      --versi-lama 1.0.821 --versi-baru 1.0.822 --json docs/patch-info.json

Kalau --lama tidak ada (rilis pertama), skrip tetap menulis manifest tanpa
entri patch untuk kunci tersebut.
"""
import argparse
import hashlib
import json
import os
import sys


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for blok in iter(lambda: f.read(1 << 20), b""):
            h.update(blok)
    return h.hexdigest()


MAKS_PASANGAN = 5


def muat_manifest(path):
    """Baca manifest lama; bentuk lama (satu pasangan) diubah ke bentuk daftar."""
    if not os.path.exists(path):
        return []
    try:
        info = json.load(open(path))
    except Exception:
        return []
    daftar = info.get("patch")
    if isinstance(daftar, list):
        return daftar
    dari = info.get("versi_lama") or ""
    ke = info.get("versi_baru") or ""
    if not dari or not ke or dari == ke:
        return []
    pasangan = {"dari": dari, "ke": ke}
    for kunci in ("arm64", "armv7", "universal"):
        entri = info.get(kunci)
        if isinstance(entri, dict) and entri.get("file"):
            pasangan[kunci] = entri
    return [pasangan]


def rapikan(versi):
    """Samakan nama versi ke bentuk pendek yang dilaporkan aplikasi.

    Berkas dasar dari workflow lama masih bernama "1.0.1026", sedangkan app
    melaporkan versi terpasang sebagai "1.1.26". Kalau nama itu dibiarkan,
    entri patch berlabel "dari 1.0.1026" tidak pernah cocok dengan versi yang
    dilaporkan HP, jadi dialog patch tidak muncul. Di sini nama panjang
    diubah ke bentuk pendek supaya cocok.
    """
    bagian = str(versi).strip().split(".")
    if len(bagian) == 3 and all(x.isdigit() for x in bagian):
        mayor, minor, patch = int(bagian[0]), int(bagian[1]), int(bagian[2])
        if patch >= 1000:
            minor += patch // 1000
            patch %= 1000
            return "%d.%d.%d" % (mayor, minor, patch)
    return str(versi).strip()


def nomor(versi):
    """Nilai urut versi, sama persis dengan app (AppUpdate.build).

    "1.0.1019" -> 1001019 dan "1.1.22" -> 1001022, jadi versi pendek yang baru
    dianggap LEBIH BARU. Dulu hanya angka terakhir yang dibandingkan, sehingga
    1.0.1019 dianggap di atas 1.1.22 dan versi_baru di manifest tidak pernah
    naik ke bentuk pendek.
    """
    try:
        b = [int(x) for x in str(versi).strip().split(".")]
    except Exception:
        return 0
    mayor = b[0] if len(b) > 0 else 0
    minor = b[1] if len(b) > 1 else 0
    patch = b[2] if len(b) > 2 else 0
    if patch >= 1000:
        minor += patch // 1000
        patch %= 1000
    return (mayor * 1000 + minor) * 1000 + patch


def tulis_manifest(path, daftar):
    """Tulis manifest: daftar pasangan + salinan pasangan terbaru untuk app lama."""
    daftar = sorted(daftar, key=lambda e: nomor(e.get("ke", "")), reverse=True)[:MAKS_PASANGAN]
    info = {"versi_baru": daftar[0]["ke"] if daftar else "", "patch": daftar}
    if daftar:
        baru = daftar[0]
        info["versi_lama"] = baru.get("dari", "")
        for kunci in ("arm64", "armv7", "universal"):
            if baru.get(kunci):
                info[kunci] = baru[kunci]
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(info, f, indent=2, ensure_ascii=False)
    print("Manifest ditulis:", path, "(%d pasangan)" % len(daftar))



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lama", required=True)
    ap.add_argument("--baru", required=True)
    ap.add_argument("--kunci", required=True, help="arm64 / armv7 / universal")
    ap.add_argument("--keluaran", required=True)
    ap.add_argument("--versi-lama", default="")
    ap.add_argument("--versi-baru", default="")
    ap.add_argument("--json", default="docs/patch-info.json")
    args = ap.parse_args()

    daftar = muat_manifest(args.json)
    # Hanya entri kunci INI yang dibuang. Dulu seluruh pasangan dibuang, jadi
    # saat armv7 diproses setelah arm64, entri arm64 hilang dari manifest dan
    # HP arm64 tidak pernah mendapat update kecil (harus unduh APK penuh).
    for e in daftar:
        if e.get("dari") == args.versi_lama and e.get("ke") == args.versi_baru:
            e.pop(args.kunci, None)
    daftar = [e for e in daftar if any(k in e for k in ("arm64", "armv7", "universal"))]

    args.versi_lama = rapikan(args.versi_lama) if args.versi_lama else ""
    args.versi_baru = rapikan(args.versi_baru) if args.versi_baru else ""
    if args.versi_lama and args.versi_lama == args.versi_baru:
        print("Versi lama sama dengan versi baru, patch dilewati.")
        tulis_manifest(args.json, daftar)
        return 0

    if not (os.path.exists(args.lama) and os.path.exists(args.baru)):
        print("APK lama/baru tidak lengkap, patch dilewati untuk", args.kunci)
        tulis_manifest(args.json, daftar)
        return 0

    import bsdiff4

    lama = open(args.lama, "rb").read()
    baru = open(args.baru, "rb").read()
    if lama == baru:
        print("APK identik, tidak perlu patch.")
        tulis_manifest(args.json, daftar)
        return 0

    patch = bsdiff4.diff(lama, baru)
    with open(args.keluaran, "wb") as f:
        f.write(patch)
    # Uji dulu: hasil gabungan harus sama persis dengan APK baru.
    if bsdiff4.patch(lama, patch) != baru:
        print("PERINGATAN: uji gabung patch gagal untuk", args.kunci)
        tulis_manifest(args.json, daftar)
        return 0

    pasangan = next(
        (e for e in daftar if e.get("dari") == args.versi_lama and e.get("ke") == args.versi_baru),
        None,
    )
    if pasangan is None:
        pasangan = {"dari": args.versi_lama, "ke": args.versi_baru}
        daftar.append(pasangan)
    pasangan[args.kunci] = {
        "file": os.path.basename(args.keluaran),
        "ukuran": len(patch),
        "sha256": sha256(args.baru),
        "apk_ukuran": len(baru),
    }
    print("%s: patch %.2f MB (APK %.1f MB)" % (args.kunci, len(patch) / 1048576, len(baru) / 1048576))

    # Buang pasangan yang sudah tidak punya satu pun entri kunci.
    daftar = [e for e in daftar if any(k in e for k in ("arm64", "armv7", "universal"))]
    tulis_manifest(args.json, daftar)
    return 0


if __name__ == "__main__":
    sys.exit(main())
