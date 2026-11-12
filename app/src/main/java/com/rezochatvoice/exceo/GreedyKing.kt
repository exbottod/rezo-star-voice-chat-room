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
    var alamat by remember { mutableStateOf(GREEDY_BAWAAN) }
    // Pegangan WebView dipakai untuk mematikan game (termasuk suaranya) saat
    // layar ditutup.
    val wvPegang = remember { mutableStateOf<WebView?>(null) }

    LaunchedEffect(myUid) {
        val daftar = try { BetCfg.load("greedyking", listOf(100L, 500L, 1000L, 5000L, 50000L)) }
        catch (e: Exception) { listOf(100L, 500L, 1000L, 5000L, 50000L) }
        chips = daftar.joinToString(",", "[", "]")
        token = try {
            FirebaseAuth.getInstance().currentUser?.getIdToken(false)?.await()?.token.orEmpty()
        } catch (e: Exception) { "" }
        alamat = try { alamatGreedy() } catch (e: Exception) { GREEDY_BAWAAN }
        siap = true
    }

    BackHandler(enabled = true) { onClose() }

    androidx.compose.runtime.DisposableEffect(Unit) {
        onDispose {
            try {
                wvPegang.value?.apply {
                    stopLoading()
                    loadUrl("about:blank")
                    destroy()
                }
            } catch (e: Exception) { }
            wvPegang.value = null
        }
    }

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
                        // Halaman internet dipakai lagi sebagai cadangan: perbaikan
                        // game di sana langsung terpakai tanpa APK baru.
                        if (jatuhKeJaringan[0]) return
                        jatuhKeJaringan[0] = true
                        wv?.loadUrl(denganToken(GREEDY_BAWAAN, token, myUid, namaAman))
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
                                // Permintaan ke server dompet dikerjakan app, bukan
                                // WebView. Di sebagian HP permintaan dari halaman
                                // lokal tidak pernah sampai, sehingga game berhenti
                                // di "Loading your profile".
                                // Versi tidak menunggu: permintaan dikerjakan di
                                // latar, hasilnya dikirim balik ke halaman. Kalau
                                // ditunggu, animasi loading berhenti karena thread
                                // halaman ikut terhenti.
                                @JavascriptInterface fun mintaAsync(id: String, metode: String, jalur: String, isi: String) {
                                    val wvAktif = wvPegang.value
                                    Thread {
                                        val hasil = mintaDompet(metode, jalur, isi, token)
                                        try {
                                            val kutip = org.json.JSONObject.quote(hasil)
                                            wvAktif?.post {
                                                wvAktif.evaluateJavascript("window.__gkBalas&&window.__gkBalas('$id',$kutip)", null)
                                            }
                                        } catch (e: Exception) { }
                                    }.start()
                                }
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
                                // Segarkan token di halaman supaya tombol coba lagi
                                // memakai sesi yang benar.
                                val tAman = token.replace("'", "")
                                view.evaluateJavascript(
                                    "window.__GREEDY_TOKEN__='" + tAman + "';" +
                                        "if(window.__GREEDY_TOKEN__){var b=document.querySelector('button');}",
                                    null,
                                )
                                pindahKeAsetKalauKosong(view, url) {
                                    if (url?.contains("appassets") == true) pakaiJaringan() else pakaiAset()
                                }
                            }
                        }
                        webViewClient = pengawas
                        wv = this
                        // Setelah halaman selesai dimuat: paksa tinggi layar dengan
                        // piksel nyata, lalu ukur hasilnya. Kalau game tetap tidak
                        // terlihat, angka ukurannya ditampilkan di layar supaya
                        // penyebabnya bisa dibaca langsung dari HP.
                        Handler(Looper.getMainLooper()).postDelayed({
                            this.evaluateJavascript(SKRIP_UKUR, null)
                        }, 6000)
                        Handler(Looper.getMainLooper()).postDelayed({
                            this.evaluateJavascript(SKRIP_UKUR, null)
                        }, 13000)
                        wvPegang.value = this
                        // Token ikut di alamat: jembatan JS kadang terlambat siap
                        // sehingga halaman memulai permainan tanpa token.
                        loadUrl(denganToken(alamat, token, myUid, namaAman))
                    }
                },
            )
        }
    }
}

/** Tambahkan token, uid, dan nama ke alamat halaman game. */
private fun denganToken(alamat: String, token: String, uid: String, nama: String): String {
    if (token.isBlank()) return alamat
    val pemisah = if (alamat.contains("?")) "&" else "?"
    val t = java.net.URLEncoder.encode(token, "UTF-8")
    val u = java.net.URLEncoder.encode(uid, "UTF-8")
    val n = java.net.URLEncoder.encode(nama, "UTF-8")
    return alamat + pemisah + "t=" + t + "&u=" + u + "&n=" + n
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
            // Halaman disajikan dari server dompet sendiri, jadi alamat halaman
            // dan alamat API sama persis. Permintaan data tidak melewati jalur
            // antar-situs yang sering gagal di WebView.
            lanjut.resume(GREEDY_SERVER)
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


/**
 * Skrip yang dijalankan di dalam halaman game.
 *
 * 1. Memaksa tinggi layar memakai piksel nyata, karena 100dvh tidak dikenali
 *    sebagian WebView sehingga seluruh isi game tingginya nol dan yang terlihat
 *    hanya latar kuning.
 * 2. Mengukur hasilnya. Kalau game tetap tidak terlihat, ukuran tersebut
 *    ditampilkan di layar dalam kotak hitam agar bisa difoto.
 */
private const val SKRIP_UKUR = """
(function () {
  try {
    var d = document.documentElement, b = document.body;
    var r = document.getElementById("root");
    var vh = window.innerHeight || d.clientHeight || 0;
    if (vh > 100) d.style.setProperty("--gk-h", vh + "px");
    var st = document.getElementById("gkPaksa");
    if (!st) {
      st = document.createElement("style");
      st.id = "gkPaksa";
      st.textContent = "html,body,#root{height:100vh!important;min-height:100vh!important}" +
        ".h-dvh{height:100vh!important}.min-h-dvh{min-height:100vh!important}" +
        ".aspect-square{position:relative}";
      document.head.appendChild(st);
    }
    setTimeout(function () {
      var rr = r ? r.getBoundingClientRect() : null;
      var dots = document.querySelector(".bg-dots");
      var dd = dots ? dots.getBoundingClientRect() : null;
      var im = [].slice.call(document.querySelectorAll("img"));
      var rusak = im.filter(function (i) { return !(i.complete && i.naturalWidth > 0); });
      var ketinggian = rr ? Math.round(rr.height) : -1;
      var perluLapor = ketinggian < 300 || (im.length > 0 && rusak.length === im.length);
      if (!perluLapor) return;
      var baris = [
        "LAYAR: " + window.innerWidth + "x" + window.innerHeight,
        "ROOT: " + (rr ? Math.round(rr.width) + "x" + ketinggian : "tidak ada"),
        "KOTAK GAME: " + (dd ? Math.round(dd.width) + "x" + Math.round(dd.height) : "tidak ada"),
        "GAMBAR: " + (im.length - rusak.length) + "/" + im.length + " termuat",
        "dvh didukung: " + CSS.supports("height", "100dvh") +
          " | aspect-ratio: " + CSS.supports("aspect-ratio", "1/1"),
        "LATAR: " + getComputedStyle(b).backgroundColor,
        "CSS masuk: " + (document.styleSheets.length > 0),
        "ALAMAT: " + location.href.slice(0, 52),
        "TEKS: " + ((r && r.innerText) || "").replace(/\s+/g, " ").slice(0, 40)
      ];
      var p = document.getElementById("gkUkur");
      if (!p) { p = document.createElement("div"); p.id = "gkUkur"; document.body.appendChild(p); }
      p.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#000;" +
        "color:#7CFC00;font:11px monospace;line-height:1.5;padding:8px;white-space:pre-wrap;" +
        "border-bottom:2px solid #7CFC00";
      p.textContent = baris.join("\n");
    }, 1200);
  } catch (e) {
    try {
      var q = document.createElement("div");
      q.style.cssText = "position:fixed;left:0;top:0;right:0;z-index:2147483647;background:#7a1020;" +
        "color:#fff;font:12px monospace;padding:8px;white-space:pre-wrap";
      q.textContent = "SKRIP UKUR GAGAL: " + e + " | ALAMAT: " + location.href.slice(0, 60);
      document.body.appendChild(q);
    } catch (e2) { }
  }
})();
"""


/**
 * Permintaan HTTP dari dalam game, dikerjakan app.
 *
 * Halaman game berada di alamat lokal (appassets). Di beberapa HP, permintaan
 * dari halaman seperti itu ke server dompet tidak pernah selesai. Dengan
 * mengerjakannya di app, permintaan memakai jalur yang sama dengan aplikasi
 * biasa, jadi tetap jalan. Hasilnya dikembalikan sebagai teks JSON.
 */
private fun mintaDompet(metode: String, jalur: String, isi: String, token: String): String {
    val dasar = "https://43-156-99-4.sslip.io"
    val url = if (jalur.startsWith("http")) jalur else dasar + jalur
    return try {
        val c = java.net.URL(url).openConnection() as java.net.HttpURLConnection
        c.requestMethod = if (metode.isBlank()) "GET" else metode.uppercase()
        c.connectTimeout = 15000
        c.readTimeout = 15000
        if (token.isNotBlank()) c.setRequestProperty("Authorization", "Bearer $token")
        c.setRequestProperty("Accept", "application/json")
        if (metode.uppercase() != "GET" && isi.isNotBlank()) {
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(isi.toByteArray(Charsets.UTF_8)) }
        }
        val kode = c.responseCode
        val teks = (if (kode in 200..299) c.inputStream else c.errorStream)
            ?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (teks.isBlank()) """{"ok":0,"error":"Server menjawab kosong ($kode)"}""" else teks
    } catch (e: Exception) {
        """{"ok":0,"error":"${(e.message ?: "jaringan gagal").replace("\"", "'")}"}"""
    }
}

private const val GREEDY_API = "https://43-156-99-4.sslip.io/greedy"
private const val GREEDY_BAWAAN = "https://exbottod.github.io/rezo-star-voice-chat-room/greedy/"
private const val GREEDY_LOKAL = "https://appassets.androidplatform.net/assets/greedy/index.html"
private const val GREEDY_SERVER = "https://43-156-99-4.sslip.io/greedy-play/index.html"
