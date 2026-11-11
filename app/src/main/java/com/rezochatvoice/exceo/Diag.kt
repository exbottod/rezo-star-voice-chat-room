package com.rezochatvoice.exceo

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Label kecil di bawah layar game berisi versi Android System WebView dan
 * alamat halaman yang sedang dibuka. Kalau layar game kosong, label ini yang
 * memberi tahu penyebabnya tanpa perlu menebak.
 */
@Composable
fun WebDiagBar(alamat: String?) {
    val ctx = LocalContext.current
    val versi = remember {
        try {
            androidx.webkit.WebViewCompat.getCurrentWebViewPackage(ctx)?.let {
                "${it.packageName.substringAfterLast('.')} ${it.versionName}"
            } ?: "WebView tidak terdeteksi"
        } catch (e: Exception) {
            "WebView tidak terbaca"
        }
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomStart) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(Color(0xCC000000), RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp))
                .padding(horizontal = 10.dp, vertical = 5.dp),
        ) {
            Text(
                text = "$versi | ${(alamat ?: "-").take(70)}",
                color = Color(0xFFB9FFB0),
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace,
            )
        }
    }
}
