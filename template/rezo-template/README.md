# Rezo Template (kerangka kosong)

Kerangka aplikasi Android Jetpack Compose: layar masuk sederhana, bar bawah empat tab
(Beranda, Game, Peringkat, Profil), semuanya masih kosong dan siap diisi.

Tidak ada kunci, server, database, atau layanan pihak ketiga sama sekali.

## Isi

    app/src/main/java/com/template/app/MainActivity.kt   -> semua tampilan ada di sini
    app/src/main/res/values/themes.xml                   -> warna status bar
    app/build.gradle.kts                                 -> versi SDK dan dependency

## Cara buka

1. Buka Android Studio versi terbaru (Ladybug atau lebih baru).
2. Pilih File > Open, arahkan ke folder rezo-template.
3. Tunggu Gradle sync selesai (butuh internet untuk ambil dependency).
4. Tekan Run. Kalau build dari terminal, jalankan `gradle assembleDebug`.

## Mengisi tampilan

Semua UI ada di MainActivity.kt:

- LayarMasuk: ganti dengan layar login aslimu nanti.
- AppShell: kerangka tab. Ganti isi Box di dalamnya dengan layar per tab.

## Kalau nanti butuh backend

Jangan taruh kunci di dalam kode. Simpan di secrets.properties (sudah masuk .gitignore)
lalu baca lewat BuildConfig, dan untuk Firebase taruh google-services.json lokal saja.

## Sebelum dibagikan ke orang lain

Periksa ulang: tidak ada token, kunci API, alamat server pribadi, atau akun bawaan
di dalam kode. Template ini sudah bersih dari semua itu.
