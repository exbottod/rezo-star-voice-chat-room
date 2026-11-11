package com.rezochatvoice.exceo

import android.annotation.SuppressLint
import android.graphics.Color as AColor
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await
import java.net.URLEncoder

/**
 * Slot Zeus Treasures milik REZO.
 *
 * Gambar game besar (63 MB) tidak ikut ke dalam APK, jadi halamannya diambil
 * dari server VPS sendiri. Taruhan dan kemenangan memakai saldo dompet Rezo
 * yang sama dengan Greedy King.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun SlotGameScreen(onClose: () -> Unit) {
    var alamat by remember { mutableStateOf("") }
    var galat by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        val token = try {
            FirebaseAuth.getInstance().currentUser?.getIdToken(false)?.await()?.token.orEmpty()
        } catch (e: Exception) {
            ""
        }
        if (token.isBlank()) {
            galat = "Sesi login tidak ditemukan. Keluar lalu masuk lagi, kemudian buka game ini."
        } else {
            alamat = "$SLOT_BASE?t=" + URLEncoder.encode(token, "UTF-8")
        }
    }

    BackHandler(enabled = true) { onClose() }

    Box(Modifier.fillMaxSize().background(Color(0xFF07131F))) {
        WebDiagBar(alamat.ifBlank { null })
        if (galat.isNotBlank()) {
            Column(
                Modifier.fillMaxSize().padding(22.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("Slot belum bisa dibuka", color = Color.White, fontSize = 18.sp)
                Text(galat, color = Color(0xFFFFCDD2), fontSize = 13.sp)
            }
        } else if (alamat.isNotBlank()) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { c ->
                    WebView(c).apply {
                        setBackgroundColor(AColor.parseColor("#07131F"))
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = true
                        settings.allowFileAccess = false
                        @Suppress("DEPRECATION")
                        settings.allowFileAccessFromFileURLs = false
                        @Suppress("DEPRECATION")
                        settings.allowUniversalAccessFromFileURLs = false
                        settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                        webViewClient = WebViewClient()
                        loadUrl(alamat)
                    }
                },
                update = { wv -> if (wv.url != alamat) wv.loadUrl(alamat) },
            )
        }
    }
}

private const val SLOT_BASE = "https://43-156-99-4.sslip.io/slot/"
