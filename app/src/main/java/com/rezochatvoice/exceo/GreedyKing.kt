package com.rezochatvoice.exceo

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlin.coroutines.resume
import android.graphics.Color as AColor

/**
 * Greedy King milik REZO.
 *
 * Halaman game diambil dari internet (GitHub Pages), jadi perbaikan game bisa
 * langsung berlaku tanpa membangun APK baru. Alamatnya bisa diganti dari
 * Realtime Database (appCfg/greedyUrl).
 *
 * Penting: kalau halaman gagal dimuat (jaringan putus) atau halaman terbuka
 * tapi tidak menghasilkan apa pun (layar hitam), app otomatis pindah ke
 * salinan di dalam aset APK. Dulu app berhenti di layar hitam tanpa pesan.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GreedyKingScreen(
    myUid: String,
    myName: String,
    onClose: () -> Unit,
) {
    val ctx = LocalContext.current
    var siap by remember { mutableStateOf(false) }
    var token by remember { mutableStateOf("") }
    var chips by remember { mutableStateOf("[]") }
    var alamat by remember { mutableStateOf(GREEDY_LOKAL) }

    LaunchedEffect(myUid) {
        val daftar = try { BetCfg.load("greedyking", listOf(100L, 500L, 1000L, 5000L, 50000L)) }
        catch (e: Exception) { listOf(100L, 500L, 1000L, 5000L, 50000L) }
        chips = daftar.joinToString(",", "[", "]")
        token = try {
            FirebaseAuth.getInstance().currentUser?.getIdToken(false)?.await()?.token.orEmpty()
        } catch (e: Exception) { "" }
        alamat = try { alamatGreedy() } catch (e: Exception) { GREEDY_LOKAL }
        siap = true
    }

    BackHandler(enabled = true) { onClose() }

    Box(Modifier.fillMaxSize().background(Color(0xFF0A0F1E))) {
        WebDiagBar(alamat)
        if (siap) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { c ->
                    val namaAman = myName.ifBlank { "Player" }
                    val jatuhKeAset = booleanArrayOf(false)
                    val jatuhKeJaringan = booleanArrayOf(false)
                    var wv: WebView? = null

                    fun pakaiAset() {
                        if (jatuhKeAset[0]) return
                        jatuhKeAset[0] = true
                        wv?.loadUrl(GREEDY_LOKAL)
                    }

                    fun pakaiJaringan() {
                        // Sengaja tidak lagi memakai halaman internet: halaman
                        // itulah yang muncul sebagai layar kosong. Kalau salinan
                        // APK gagal, pesan galat dari halaman yang ditampilkan.
                        if (jatuhKeJaringan[0]) return
                        jatuhKeJaringan[0] = true
                    }

                    WebView(c).apply {
                        setBackgroundColor(AColor.parseColor("#0A0F1E"))
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        settings.setSupportZoom(false)
                        settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
                        settings.allowFileAccess = true
                        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        settings.userAgentString = "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 " +
                            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                        addJavascriptInterface(
                            object {
                                @JavascriptInterface fun api() = GREEDY_API
                                @JavascriptInterface fun token() = token
                                @JavascriptInterface fun uid() = myUid
                                @JavascriptInterface fun nama() = namaAman
                                @JavascriptInterface fun chips() = chips
                            },
                            "RezoBridge",
                        )
                        // Salinan di dalam APK disajikan lewat alamat https lokal.
                        // Kalau dibuka sebagai file://, skrip modul diblokir dan
                        // layar cuma jadi kuning kosong tanpa tulisan.
                        val pemuatAset = androidx.webkit.WebViewAssetLoader.Builder()
                            .addPathHandler("/assets/", androidx.webkit.WebViewAssetLoader.AssetsPathHandler(c))
                            .build()
                        // Jaring pengaman: kalau halaman kosong, pindah ke aset.
                        val pengawas = object : WebViewClient() {
                            override fun shouldInterceptRequest(
                                view: WebView,
                                request: android.webkit.WebResourceRequest,
                            ): android.webkit.WebResourceResponse? {
                                return try { pemuatAset.shouldInterceptRequest(request.url) } catch (e: Exception) { null }
                            }

                            override fun onReceivedError(
                                view: WebView,
                                request: WebResourceRequest,
                                error: WebResourceError,
                            ) {
                                if (request.isForMainFrame) pakaiAset()
                            }

                            override fun onPageFinished(view: WebView, url: String?) {
                                super.onPageFinished(view, url)
                                pindahKeAsetKalauKosong(view, url) {
                                    if (url?.contains("appassets") == true) pakaiJaringan() else pakaiAset()
                                }
                            }
                        }
                        webViewClient = pengawas
                        wv = this
                        loadUrl(alamat)
                    }
                },
            )
        }
    }
}

/**
 * Kalau setelah beberapa detik halaman tidak menampilkan apa pun, buka salinan
 * di aset. Ini yang membuat layar hitam tidak lagi mentok tanpa jalan keluar.
 */
private fun pindahKeAsetKalauKosong(view: WebView, url: String?, pindah: () -> Unit) {
    if (url?.startsWith("file://") == true) return
    val minta = "(function(){var r=document.getElementById('root');" +
        "var im=[].slice.call(document.querySelectorAll('#root img'));" +
        "var rusak=im.length>0&&im.filter(function(i){return i.complete&&i.naturalWidth>0}).length===0;" +
        "var adaIsi=(r&&r.children.length>0)||(document.body&&document.body.innerText.trim().length>0);" +
        "return (adaIsi&&!rusak)?'ada':'kosong';})()"
    listOf(3000L, 8000L, 15000L).forEach { jeda ->
        Handler(Looper.getMainLooper()).postDelayed({
            view.evaluateJavascript(minta) { hasil ->
                val bersih = hasil?.lowercase().orEmpty()
                val kosong = bersih.contains("kosong") && !bersih.contains("ada")
                if (kosong && jeda >= 15000L) {
                    // Sudah dua kali pindah alamat dan tetap kosong: beri tulisan
                    // supaya layar tidak lagi cuma kuning tanpa keterangan.
                    val alamatTampil = (url ?: "-").replace("'", "")
                    val skrip = "document.body.insertAdjacentHTML('beforeend','" +
                        "<div style=\"position:fixed;left:0;right:0;bottom:0;padding:14px;background:#7a1020;" +
                        "color:#fff;font:14px sans-serif;text-align:center\">Game belum bisa dimuat di HP ini. " +
                        "Tutup lalu buka lagi menu Greedy King. Alamat: " + alamatTampil + "</div>');"
                    view.evaluateJavascript(skrip, null)
                } else if (kosong) pindah()
            }
        }, jeda)
    }
}

/** Alamat halaman game: bisa diatur dari panel lewat appCfg/greedyUrl. */
private suspend fun alamatGreedy(): String = suspendCancellableCoroutine { lanjut ->
    Rtdb.ref("appCfg/greedyUrl").addListenerForSingleValueEvent(object : ValueEventListener {
        override fun onDataChange(s: DataSnapshot) {
            // Salinan di dalam APK dipakai lebih dulu: gambar makanan sudah ikut
            // di APK sehingga tidak bergantung pada internet.
            lanjut.resume(GREEDY_LOKAL)
        }

        override fun onCancelled(e: DatabaseError) = lanjut.resume(GREEDY_LOKAL)
    })
}

/**
 * Hanya terima alamat yang memang halaman game. Kalau yang tersimpan di panel
 * ternyata alamat API (misal berakhiran /greedy), halaman hanya menampilkan
 * JSON/kosong, jadi kita pakai alamat bawaan.
 */
private fun tampakSepertiHalaman(v: String): Boolean {
    if (!v.startsWith("http")) return false
    if (v.contains("/api/")) return false
    return v.endsWith("/") || v.endsWith(".html") || v.endsWith(".htm")
}

private const val GREEDY_API = "https://43-156-99-4.sslip.io/greedy"
private const val GREEDY_BAWAAN = "https://exbottod.github.io/rezo-star-voice-chat-room/greedy/"
private const val GREEDY_LOKAL = "https://appassets.androidplatform.net/assets/greedy/index.html"
