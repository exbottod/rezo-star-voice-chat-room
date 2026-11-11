package com.rezochatvoice.exceo

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import android.graphics.Color as AColor
import android.webkit.WebView
import android.webkit.WebViewClient
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await
import java.io.File

/**
 * Greedy King milik REZO.
 *
 * Berkas game (index.html, bundle.js, style.css) ada di aset app, lalu disalin
 * ke folder cache dengan token & saldo pemain disisipkan, dan dibuka lewat
 * file:// dari cache. Cara ini paling stabil di WebView Android.
 */
@Composable
fun GreedyKingScreen(
    myUid: String,
    myName: String,
    onClose: () -> Unit,
) {
    val ctx = LocalContext.current
    var folder by remember { mutableStateOf<File?>(null) }
    var catatan by remember { mutableStateOf("Menyiapkan game...") }
    var galat by remember { mutableStateOf("") }
    val chipsBawaan = listOf(100L, 500L, 1000L, 5000L, 50000L)

    LaunchedEffect(myUid) {
        try {
            val chips = try { BetCfg.load("greedyking", chipsBawaan) } catch (e: Exception) { chipsBawaan }
            catatan = "Chip: " + chips.joinToString(",")
            val token = FirebaseAuth.getInstance().currentUser
                ?.getIdToken(false)?.await()?.token ?: throw IllegalStateException("Sesi tidak ditemukan")
            val dir = File(ctx.cacheDir, "greedy").apply { mkdirs() }
            ctx.assets.open("greedy/index.html").bufferedReader().use { t ->
                val isi = t.readText()
                    .replace("__REZO_API__", GREEDY_API)
                    .replace("__REZO_TOKEN__", token)
                    .replace("__REZO_CHIPS__", chips.joinToString(",", "[", "]"))
                    .replace("__REZO_UID__", myUid)
                    .replace("__REZO_NAME__", myName.ifBlank { "Player" }.replace("\"", ""))
                File(dir, "index.html").writeText(isi)
            }
            listOf("bundle.js", "style.css").forEach { n ->
                ctx.assets.open("greedy/$n").use { masuk ->
                    File(dir, n).outputStream().use { keluar -> masuk.copyTo(keluar) }
                }
            }
            catatan = "Siap: " + File(dir, "index.html").length() + " bita"
            folder = dir
        } catch (e: Exception) {
            galat = e.message ?: "Game tidak bisa dibuka"
        }
    }

    BackHandler(enabled = true) { onClose() }

    Box(Modifier.fillMaxSize().background(Color(0xFF0A0F1E))) {
        val dir = folder
        if (dir != null && galat.isBlank()) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { c ->
                    WebView(c).apply {
                        setBackgroundColor(AColor.parseColor("#0A0F1E"))
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        settings.setSupportZoom(false)
                        settings.allowFileAccess = true
                        settings.allowFileAccessFromFileURLs = true
                        settings.allowUniversalAccessFromFileURLs = true
                        settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
                        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView, url: String) {
                                catatan = "Halaman terbuka"
                                view.evaluateJavascript("window.__GK_SALAH__ || ''") { hasil ->
                                    val t = hasil?.replace("\"", "")?.trim().orEmpty()
                                    if (t.isNotBlank() && t != "null") catatan = "Galat JS: $t"
                                }
                            }

                            override fun onReceivedError(
                                view: WebView,
                                request: android.webkit.WebResourceRequest,
                                error: android.webkit.WebResourceError,
                            ) {
                                catatan = "Gagal muat: " + error.description
                            }
                        }
                        loadUrl("file://" + File(dir, "index.html").absolutePath)
                    }
                },
            )
        }
        // Keterangan kecil di pojok: kalau game kosong, tulisan ini menunjukkan
        // di tahap mana ia berhenti.
        Text(
            if (galat.isNotBlank()) "Galat: $galat" else catatan,
            color = Color(0xFF8FA6C8), fontSize = 9.sp,
            modifier = Modifier.align(Alignment.TopCenter).padding(top = 4.dp),
        )
    }
}

private const val GREEDY_API = "https://43-156-99-4.sslip.io/greedy"
