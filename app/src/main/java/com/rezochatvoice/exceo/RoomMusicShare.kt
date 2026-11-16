package com.rezochatvoice.exceo

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Musik room yang terdengar oleh SEMUA orang di room, dengan kualitas file asli.
 *
 * Cara kerja:
 * 1. Lagu diunggah ke Supabase Storage (sekali per berkas, tautannya diingat),
 *    lalu tautan + posisi + waktu mulai disiarkan ke Realtime Database (roomMusic/{roomId}).
 * 2. Setiap HP di room mengunduh lagu itu ke cache lalu memutarnya sendiri
 *    dengan volume penuh dan atribut audio musik (bukan panggilan).
 * 3. Posisi dihitung dari jam server Firebase, bukan jam HP masing-masing,
 *    jadi semua HP berada di detik yang sama. Setiap 4 detik posisi dicek dan
 *    digeser kalau melenceng lebih dari 1,5 detik (mencegah suara bertumpuk/bergema).
 *
 * Penting: suara musik TIDAK dikirim lewat speaker pemutar lalu ditangkap mic.
 * Jalur itu yang membuat musik di HP lain terdengar pelan, gepeng dan tidak jelas.
 */
object RoomMusicShare {
    private const val BASE = "https://fdemjdqagxkhgqkmfvwk.supabase.co"
    // Kunci publishable, sama seperti RoomImages/SupaRepo.
    private const val KEY = "sb_publishable_4PxD2LedOsBgIJyHLkM47A_bImSQI2W"
    private const val BUCKET = "chatimg"
    private const val PREFS_TAUTAN = "tautan_musik"
    private const val CACHE_DIR = "roommusic"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var appCtx: Context? = null
    private var player: MediaPlayer? = null
    private var urlSekarang = ""
    private var judulSekarang = ""
    private var siap = false
    private var roomId = ""
    @Volatile private var reg: Reg? = null

    // Keadaan terakhir yang disiarkan room, dipakai untuk penyelarasan posisi.
    @Volatile private var mainTerakhir = false
    @Volatile private var posTerakhir = 0L
    @Volatile private var atTerakhir = 0L
    @Volatile private var pemilik = ""
    @Volatile private var sedangMuat = false

    private var sinkronJob: Job? = null
    private var muatJob: Job? = null

    private var volumeLokal = 80
    @Volatile private var volumeKirimTerakhir = 0L

    /** Tautan lagu -> berkas yang sudah ada di HP ini, supaya tidak diunduh dua kali. */
    private val berkasLokalUrl = java.util.concurrent.ConcurrentHashMap<String, String>()

    /** Daftarkan berkas lagu milik HP ini (yang baru diunggah) untuk tautan tersebut. */
    fun pakaiBerkasLokal(url: String, file: File) {
        try {
            if (url.isNotBlank() && file.exists() && file.length() > 4096) {
                berkasLokalUrl[url] = file.absolutePath
            }
        } catch (e: Exception) { }
    }

    /** Posisi musik saat ini (ms). */
    fun posisiMs(): Int {
        val p = player ?: return 0
        return try { p.currentPosition } catch (e: Exception) { 0 }
    }

    fun durasiMs(): Int = try { player?.duration ?: -1 } catch (e: Exception) { -1 }

    /** true kalau room sedang punya lagu (tautan sudah diterima HP ini). */
    fun adaLagu(): Boolean = urlSekarang.isNotBlank()

    /** true kalau lagu room sudah diterima HP ini tapi belum siap dibunyikan. */
    fun sibuk(): Boolean = sedangMuat

    /** true kalau lagu sudah siap dan sedang berbunyi di HP ini. */
    fun aktif(): Boolean = try { siap && player?.isPlaying == true } catch (e: Exception) { false }

    /** Volume pemutar bersama (0..100), ikut disiarkan supaya semua HP sama. */
    fun setVolume(v: Int) {
        volumeLokal = v.coerceIn(0, 100)
        terapkanVolume()
        val room = roomId
        if (room.isBlank() || urlSekarang.isBlank()) return
        val now = System.currentTimeMillis()
        if (now - volumeKirimTerakhir < 900L) return
        volumeKirimTerakhir = now
        val vol = volumeLokal
        scope.launch { siarkanVolume(room, vol) }
    }

    private fun terapkanVolume() {
        val f = volumeLokal / 100f
        try { player?.setVolume(f, f) } catch (e: Exception) { }
    }

    /** Geser posisi lagu bersama; semua HP ikut pindah ke posisi ini. */
    suspend fun geser(room: String, url: String, judul: String, main: Boolean, pos: Long) {
        try { if (main) player?.seekTo(pos.toInt()) } catch (e: Exception) { }
        siarkan(room, url, judul, main, pos)
    }

    /** Unggah satu file lagu ke Supabase Storage, hasilnya tautan publik. */
    suspend fun unggah(file: File, onProgress: (Int) -> Unit = {}): Pair<String?, String?> {
        return try {
            val uid = FirebaseAuth.getInstance().currentUser?.uid
                ?: return null to "Belum login"
            // Berkas yang sama tidak perlu diunggah ulang: tautan lama dipakai lagi.
            tautanTersimpan(file)?.let { return it to null }
            if (!file.exists()) return null to "Berkas lagu tidak ditemukan"
            val bytes = file.readBytes()
            if (bytes.size > 25_000_000) return null to "Lagu terlalu besar (maks 25 MB)"
            val bersih = file.name.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            val path = "$uid/musik_${System.currentTimeMillis()}_$bersih"
            val conn = (URL("$BASE/storage/v1/object/$BUCKET/$path").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 180000
                doOutput = true
                setRequestProperty("apikey", KEY)
                setRequestProperty("Authorization", "Bearer $KEY")
                setRequestProperty("Content-Type", "application/octet-stream")
            }
            try {
                conn.outputStream.use { out ->
                    var off = 0
                    val buf = 32 * 1024
                    while (off < bytes.size) {
                        val n = minOf(buf, bytes.size - off)
                        out.write(bytes, off, n)
                        off += n
                        // Jangan terlalu sering memperbarui tampilan.
                        if (off == bytes.size || off % (512 * 1024) < buf) {
                            try { onProgress((off * 100) / bytes.size) } catch (e: Exception) { }
                        }
                    }
                    out.flush()
                }
                val code = conn.responseCode
                if (code !in 200..299) {
                    val body = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                    return null to "Unggah gagal ($code) ${body.take(80)}"
                }
            } finally {
                try { conn.disconnect() } catch (e: Exception) { }
            }
            val url = "$BASE/storage/v1/object/public/$BUCKET/$path"
            simpanTautan(file, url)
            url to null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null to (e.message ?: "Unggah gagal")
        }
    }

    /** Simpan keadaan musik room supaya semua HP mengikuti. */
    suspend fun siarkan(room: String, url: String, judul: String, main: Boolean, pos: Long) {
        if (room.isBlank()) return
        try {
            Rtdb.startClockSync()
            Rtdb.ref("roomMusic/$room").updateChildren(
                hashMapOf<String, Any?>(
                    "url" to url,
                    "title" to judul,
                    "playing" to main,
                    "pos" to pos,
                    // Jam server, bukan jam HP pemutar: semua HP menghitung dari acuan yang sama.
                    "at" to Rtdb.serverNow(),
                    "vol" to volumeLokal,
                    "by" to (FirebaseAuth.getInstance().currentUser?.uid ?: ""),
                ),
            ).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) { }
    }

    private suspend fun siarkanVolume(room: String, vol: Int) {
        try {
            Rtdb.ref("roomMusic/$room/vol").setValue(vol).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) { }
    }

    suspend fun hentikan(room: String) {
        if (room.isBlank()) return
        try { Rtdb.ref("roomMusic/$room").removeValue().await() } catch (e: Exception) { }
    }

    /** Mulai mengikuti musik room. Dipanggil sekali saat masuk room. */
    fun observe(room: String, ctx: Context? = null) {
        if (ctx != null) appCtx = ctx.applicationContext
        if (room.isBlank()) return
        Rtdb.startClockSync()
        if (room == roomId && reg != null) return
        lepas()
        roomId = room
        try {
            reg = Rtdb.listen(Rtdb.ref("roomMusic/$room")) { s ->
                val url = s.child("url").getValue(String::class.java).orEmpty()
                val judul = s.child("title").getValue(String::class.java).orEmpty()
                val main = s.child("playing").getValue(Boolean::class.java) ?: false
                val pos = s.child("pos").getValue(Long::class.java) ?: 0L
                val at = s.child("at").getValue(Long::class.java) ?: 0L
                val vol = s.child("vol").getValue(Long::class.java)?.toInt() ?: 80
                val by = s.child("by").getValue(String::class.java).orEmpty()
                terapkan(url, judul, main, pos, at, vol, by)
            }
        } catch (e: Exception) { }
        mulaiSinkron()
    }

    fun lepas() {
        try { reg?.remove() } catch (e: Exception) { }
        reg = null
        roomId = ""
        try { sinkronJob?.cancel() } catch (e: Exception) { }
        sinkronJob = null
        lepasPemutar()
        urlSekarang = ""
        judulSekarang = ""
    }

    private fun lepasPemutar() {
        try { muatJob?.cancel() } catch (e: Exception) { }
        muatJob = null
        sedangMuat = false
        siap = false
        try { player?.reset() } catch (e: Exception) { }
        try { player?.release() } catch (e: Exception) { }
        player = null
    }

    /** Posisi yang seharusnya berbunyi sekarang, dari jam server. */
    private fun targetMs(pos: Long, at: Long): Int {
        if (at <= 0L) return pos.toInt()
        val lewat = (Rtdb.serverNow() - at).coerceAtLeast(0L)
        return (pos + lewat).toInt()
    }

    /** Terapkan keadaan dari database ke pemutar HP ini. */
    private fun terapkan(url: String, judul: String, main: Boolean, pos: Long, at: Long, vol: Int, by: String) {
        mainTerakhir = main
        posTerakhir = pos
        atTerakhir = at
        pemilik = by
        val v = vol.coerceIn(0, 100)
        if (v != volumeLokal) {
            volumeLokal = v
            terapkanVolume()
        }
        if (url.isBlank()) {
            lepasPemutar()
            urlSekarang = ""
            judulSekarang = ""
            return
        }
        if (url != urlSekarang) {
            lepasPemutar()
            urlSekarang = url
            judulSekarang = judul
            siapkan(url)
            return
        }
        judulSekarang = judul
        val p = player ?: return
        if (!siap) return
        try {
            if (main) {
                if (!p.isPlaying) {
                    p.seekTo(targetMs(pos, at))
                    p.start()
                }
            } else if (p.isPlaying) {
                p.pause()
                p.seekTo(targetMs(pos, at))
            }
        } catch (e: Exception) { }
    }

    /** Unduh lagu ke cache dulu, baru diputar. Streaming langsung sering tersendat. */
    private fun siapkan(url: String) {
        muatJob?.cancel()
        sedangMuat = true
        muatJob = scope.launch {
            val berkas = berkasLokal(url)
            if (berkas == null) {
                sedangMuat = false
                // Coba sekali lagi; jaringan seluler sering putus sebentar.
                delay(1500)
                val ulang = berkasLokal(url)
                denganUtama(url, ulang)
                return@launch
            }
            denganUtama(url, berkas)
        }
    }

    private suspend fun denganUtama(url: String, berkas: File?) {
        withContext(Dispatchers.Main) {
            if (urlSekarang != url) return@withContext
            sedangMuat = false
            if (berkas == null) return@withContext
            mulaiPemutar(berkas)
        }
    }

    private fun mulaiPemutar(berkas: File) {
        // Pemutar lama dilepas di sini (tanpa membatalkan tugas unduh yang sedang jalan).
        siap = false
        try { player?.reset() } catch (e: Exception) { }
        try { player?.release() } catch (e: Exception) { }
        player = null
        try {
            val mp = MediaPlayer()
            // Atribut musik: supaya keluar lewat speaker media dengan kualitas penuh,
            // bukan jalur panggilan yang membuat suara kecil dan gepeng.
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            mp.setDataSource(berkas.absolutePath)
            mp.setOnPreparedListener { p ->
                siap = true
                terapkanVolume()
                try {
                    p.seekTo(targetMs(posTerakhir, atTerakhir))
                    if (mainTerakhir) p.start()
                } catch (e: Exception) { }
            }
            mp.setOnCompletionListener { p ->
                // Lagu habis. Hanya HP pemutar (DJ) yang boleh mengubah keadaan room,
                // supaya HP lain tidak saling menimpa dan musik tidak berhenti sendiri.
                try { if (p.isPlaying) p.pause() } catch (e: Exception) { }
                val url = urlSekarang
                val judul = judulSekarang
                val room = roomId
                val akuPemutar = pemilik.isNotEmpty() &&
                    pemilik == FirebaseAuth.getInstance().currentUser?.uid
                if (!akuPemutar) {
                    mainTerakhir = false
                    return@setOnCompletionListener
                }
                scope.launch {
                    if (room.isNotBlank() && url.isNotBlank()) siarkan(room, url, judul, false, 0L)
                    denganContextUtama { MusicEngine.lanjutOtomatis() }
                }
            }
            mp.prepareAsync()
            player = mp
        } catch (e: Exception) {
            try { player?.release() } catch (e2: Exception) { }
            player = null
            siap = false
        }
    }

    private suspend fun denganContextUtama(blok: () -> Unit) {
        withContext(Dispatchers.Main) { try { blok() } catch (e: Exception) { } }
    }

    /** Setiap 4 detik cek apakah posisi HP ini masih sejalan dengan room. */
    private fun mulaiSinkron() {
        try { sinkronJob?.cancel() } catch (e: Exception) { }
        sinkronJob = scope.launch {
            while (true) {
                delay(4000)
                if (!siap || !mainTerakhir) continue
                val p = player ?: continue
                try {
                    val target = targetMs(posTerakhir, atTerakhir)
                    val beda = p.currentPosition - target
                    if (beda < -1500 || beda > 1500) p.seekTo(target)
                } catch (e: Exception) { }
            }
        }
    }

    // ---------- Cache berkas & tautan ----------

    private fun hashUrl(url: String): String =
        Integer.toHexString(url.hashCode()) + "_" + url.length

    private suspend fun berkasLokal(url: String): File? {
        // Berkas yang sudah diputar/diunggah dari HP ini langsung dipakai.
        berkasLokalUrl[url]?.let { path ->
            val f = File(path)
            if (f.exists() && f.length() > 4096) return f
        }
        val ctx = appCtx ?: return null
        val dir = File(ctx.cacheDir, CACHE_DIR)
        try { dir.mkdirs() } catch (e: Exception) { }
        val f = File(dir, "lagu_${hashUrl(url)}.bin")
        if (f.exists() && f.length() > 4096) return f
        val tmp = File(dir, f.name + ".part")
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15000
                readTimeout = 120000
            }
            if (conn.responseCode !in 200..299) {
                try { tmp.delete() } catch (e: Exception) { }
                return null
            }
            conn.inputStream.use { input ->
                tmp.outputStream().use { out -> input.copyTo(out, 64 * 1024) }
            }
            if (tmp.length() <= 4096) {
                try { tmp.delete() } catch (e: Exception) { }
                return null
            }
            try { if (f.exists()) f.delete() } catch (e: Exception) { }
            if (!tmp.renameTo(f)) {
                try { tmp.delete() } catch (e: Exception) { }
                return null
            }
            bersihkanCache(dir, f)
            f
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            try { tmp.delete() } catch (e2: Exception) { }
            null
        } finally {
            try { conn?.disconnect() } catch (e: Exception) { }
        }
    }

    /** Sisakan beberapa lagu terakhir saja supaya cache tidak membengkak. */
    private fun bersihkanCache(dir: File, kecuali: File) {
        try {
            val semua = dir.listFiles()?.filter { it.isFile && it.name.startsWith("lagu_") }
                ?.sortedByDescending { it.lastModified() } ?: return
            semua.drop(4).forEach { if (it.absolutePath != kecuali.absolutePath) it.delete() }
        } catch (e: Exception) { }
    }

    private fun kunciBerkas(file: File): String =
        "${file.name}_${file.length()}_${file.lastModified()}"

    private fun tautanTersimpan(file: File): String? {
        val ctx = appCtx ?: return null
        return try {
            ctx.getSharedPreferences(PREFS_TAUTAN, Context.MODE_PRIVATE)
                .getString(kunciBerkas(file), null)
        } catch (e: Exception) {
            null
        }
    }

    private fun simpanTautan(file: File, url: String) {
        val ctx = appCtx ?: return
        try {
            ctx.getSharedPreferences(PREFS_TAUTAN, Context.MODE_PRIVATE)
                .edit().putString(kunciBerkas(file), url).apply()
        } catch (e: Exception) { }
    }
}
