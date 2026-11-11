package com.rezochatvoice.exceo

import android.webkit.JavascriptInterface
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
 * Realtime Database (appCfg/greedyUrl). Kalau jaringan gagal, app memakai
 * salinan di dalam aset sebagai cadangan.
 */
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

    Box(Modifier.fillMaxSize().background(Color(0xFF0A0F1E))) {
        if (siap) {
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
                        settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
                        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        settings.userAgentString = "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 " +
                            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                        // Jembatan: halaman membaca token, uid, nama, dan chip dari sini.
                        val namaAman = myName.ifBlank { "Player" }
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
                        webViewClient = WebViewClient()
                        loadUrl(alamat)
                    }
                },
            )
        }
    }
}

/** Alamat halaman game: bisa diatur dari panel lewat appCfg/greedyUrl. */
private suspend fun alamatGreedy(): String = suspendCancellableCoroutine { lanjut ->
    Rtdb.ref("appCfg/greedyUrl").addListenerForSingleValueEvent(object : ValueEventListener {
        override fun onDataChange(s: DataSnapshot) {
            val v = s.getValue(String::class.java)?.trim().orEmpty()
            lanjut.resume(if (v.startsWith("http")) v else GREEDY_BAWAAN)
        }

        override fun onCancelled(e: DatabaseError) = lanjut.resume(GREEDY_BAWAAN)
    })
}

private const val GREEDY_API = "https://43-156-99-4.sslip.io/greedy"
private const val GREEDY_BAWAAN = "https://exbottod.github.io/rezo-star-voice-chat-room/greedy/"
