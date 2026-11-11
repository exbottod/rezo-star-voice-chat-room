package com.rezochatvoice.exceo

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.viewinterop.AndroidView
import android.graphics.Color as AColor
import android.webkit.WebView
import android.webkit.WebViewClient
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

/**
 * Greedy King milik REZO.
 *
 * Halaman game (HTML + JS) ada di aset app, jadi tidak bergantung penyedia luar.
 * Daftar chip diambil dari panel developer (tab Bet Game) lewat BetCfg, dan
 * saldo memakai dompet REZO yang sama.
 */
@Composable
fun GreedyKingScreen(
    myUid: String,
    myName: String,
    onClose: () -> Unit,
) {
    val ctx = LocalContext.current
    var html by remember { mutableStateOf<String?>(null) }
    var galat by remember { mutableStateOf("") }
    val chipsBawaan = listOf(100L, 500L, 1000L, 5000L, 50000L)

    LaunchedEffect(myUid) {
        try {
            val chips = try {
                BetCfg.load("greedyking", chipsBawaan)
            } catch (e: Exception) {
                chipsBawaan
            }
            val token = FirebaseAuth.getInstance().currentUser
                ?.getIdToken(false)?.await()?.token ?: throw IllegalStateException("Sesi tidak ditemukan")
            val aset = ctx.assets.open("greedy/index.html").bufferedReader().use { it.readText() }
            val nama = org.json.JSONObject.quote(myName.ifBlank { "Player" })
            val chipsJson = chips.joinToString(",", "[", "]")
            html = aset
                .replace("__REZO_API__", GREEDY_API)
                .replace("__REZO_TOKEN__", token)
                .replace("__REZO_CHIPS__", chipsJson)
                .replace("__REZO_UID__", myUid)
                .replace("__REZO_NAME__", nama.removeSurrounding("\""))
        } catch (e: Exception) {
            galat = e.message ?: "Game tidak bisa dibuka"
        }
    }

    BackHandler(enabled = true) { onClose() }

    Box(Modifier.fillMaxSize()) {
        val isi = html
        if (isi != null) {
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
                        settings.builtInZoomControls = false
                        settings.displayZoomControls = false
                        settings.allowFileAccess = true
                        settings.allowFileAccessFromFileURLs = true
                        settings.allowUniversalAccessFromFileURLs = true
                        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        webViewClient = WebViewClient()
                        // Dimuat dari berkas cache, bukan loadDataWithBaseURL: cara itu
                        // membuat halaman besar kadang tampil kosong di WebView.
                        val berkas = java.io.File(c.cacheDir, "greedy-king.html")
                        berkas.writeText(isi)
                        loadUrl("file://" + berkas.absolutePath)
                    }
                },
            )
        } else {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                if (galat.isBlank()) {
                    CircularProgressIndicator(color = Color(0xFFF5C542))
                } else {
                    androidx.compose.material3.Text(galat, color = Color(0xFFFFC46B))
                }
            }
        }
    }
}

private const val GREEDY_API = "https://43-156-99-4.sslip.io/greedy"
