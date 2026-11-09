package com.rezochatvoice.exceo

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Kirim gambar di chat room.
 *
 * Gambar dikecilkan dulu di HP (maks 1080 px, JPEG), lalu diunggah ke
 * Supabase Storage pada bucket publik "chatimg". Tidak perlu server
 * tambahan dan tidak memakai kuota Firestore.
 *
 * Bucket dan izinnya dibuat lewat supabase/room-image.sql.
 */
object RoomImages {
    private const val BASE = "https://fdemjdqagxkhgqkmfvwk.supabase.co"
    // Server REZO sendiri: gambar disimpan di sini karena Supabase menolak
    // unggahan (402: layanan project dibatasi).
    private const val VPS = "https://43-156-99-4.sslip.io"
    // Kunci publishable, sama seperti yang dipakai SupaRepo (aman ada di app).
    private const val KEY = "sb_publishable_4PxD2LedOsBgIJyHLkM47A_bImSQI2W"
    private const val BUCKET = "chatimg"
    private const val MAX_DIM = 1080
    private const val MAX_BYTES = 2_000_000

    /** Hasil: (url publik, pesan galat). Salah satu selalu null. */
    suspend fun upload(ctx: android.content.Context, uri: android.net.Uri): Pair<String?, String?> =
        withContext(Dispatchers.IO) {
            try {
                val uid = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
                    ?: return@withContext null to "Belum login"
                val raw = try {
                    ctx.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                } catch (e: Exception) {
                    null
                } ?: return@withContext null to "Gambar tidak bisa dibaca"

                val bmp = BitmapFactory.decodeByteArray(raw, 0, raw.size)
                    ?: return@withContext null to "Format gambar tidak didukung"

                val biggest = maxOf(bmp.width, bmp.height)
                val kecil = if (biggest > MAX_DIM) {
                    val s = MAX_DIM.toFloat() / biggest
                    Bitmap.createScaledBitmap(
                        bmp,
                        (bmp.width * s).toInt().coerceAtLeast(1),
                        (bmp.height * s).toInt().coerceAtLeast(1),
                        true,
                    )
                } else {
                    bmp
                }

                var bytes = jpeg(kecil, 80)
                if (bytes.size > MAX_BYTES) bytes = jpeg(kecil, 60)
                if (bytes.size > MAX_BYTES) return@withContext null to "Gambar masih terlalu besar, coba gambar lain"

                // 1) Server sendiri: cepat dan tanpa batas kuota.
                try {
                    val token = com.google.firebase.auth.FirebaseAuth.getInstance()
                        .currentUser?.getIdToken(false)?.await()?.token
                    if (!token.isNullOrBlank()) {
                        val q = "/chatimg?t=" + java.net.URLEncoder.encode(token, "UTF-8") + "&ext=jpg"
                        val c1 = (URL(VPS + q).openConnection() as HttpURLConnection).apply {
                            requestMethod = "POST"
                            connectTimeout = 15000
                            readTimeout = 60000
                            doOutput = true
                            setRequestProperty("Content-Type", "image/jpeg")
                        }
                        c1.outputStream.use { it.write(bytes) }
                        if (c1.responseCode in 200..299) {
                            val teks = c1.inputStream.bufferedReader().use { it.readText() }
                            val u = org.json.JSONObject(teks).optString("url")
                            if (u.startsWith("http")) return@withContext u to null
                        }
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    // Server sendiri belum bisa: lanjut ke Supabase di bawah.
                }
                val path = "$uid/${System.currentTimeMillis()}.jpg"
                val conn = (URL("$BASE/storage/v1/object/$BUCKET/$path").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15000
                    readTimeout = 60000
                    doOutput = true
                    setRequestProperty("apikey", KEY)
                    setRequestProperty("Authorization", "Bearer $KEY")
                    setRequestProperty("Content-Type", "image/jpeg")
                }
                conn.outputStream.use { it.write(bytes) }
                val code = conn.responseCode
                if (code !in 200..299) {
                    val body = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                    return@withContext null to "Upload gagal ($code) ${body.take(100)}"
                }
                "$BASE/storage/v1/object/public/$BUCKET/$path" to null
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                null to (e.message ?: "Upload gagal")
            }
        }

    private fun jpeg(bmp: Bitmap, quality: Int): ByteArray {
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, out)
        return out.toByteArray()
    }
}
