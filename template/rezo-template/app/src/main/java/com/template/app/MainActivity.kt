package com.template.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Star
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Palet warna dasar. Ganti sesuai selera.
private val HijauTua = Color(0xFF00574F)
private val HijauMuda = Color(0xFF00C2A8)
private val Latar = Color(0xFF05201D)
private val Emas = Color(0xFFFFC107)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                var masuk by remember { mutableStateOf(false) }
                if (masuk) AppShell() else LayarMasuk { masuk = true }
            }
        }
    }
}

/** Layar masuk kosong: tombolnya hanya membuka aplikasi. Hubungkan sendiri ke auth-mu. */
@Composable
private fun LayarMasuk(onMasuk: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Latar),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(
                Modifier
                    .background(HijauMuda, RoundedCornerShape(28.dp))
                    .padding(horizontal = 32.dp, vertical = 22.dp),
            ) {
                Text("LOGO", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 28.sp)
            }
            Text(
                "Nama Aplikasi",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
            )
            Text(
                "Ruangan suara, game, dan hadiah.\nSemua tempat isi awal kosong.",
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                fontSize = 14.sp,
            )
            Button(
                onClick = onMasuk,
                colors = ButtonDefaults.buttonColors(containerColor = HijauMuda),
                shape = RoundedCornerShape(50),
            ) {
                Text("Masuk", color = Color(0xFF00332E), fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Kerangka utama: empat tab kosong siap diisi. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppShell() {
    var tab by remember { mutableIntStateOf(0) }
    val judul = listOf("Beranda", "Game", "Peringkat", "Profil")
    val ikon = listOf(Icons.Filled.Home, Icons.Filled.SportsEsports, Icons.Filled.Star, Icons.Filled.Person)

    Scaffold(
        containerColor = Latar,
        topBar = {
            TopAppBar(
                title = { Text(judul[tab], color = Color.White, fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = HijauTua),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = HijauTua) {
                judul.forEachIndexed { i, nama ->
                    NavigationBarItem(
                        selected = tab == i,
                        onClick = { tab = i },
                        icon = { Icon(ikon[i], contentDescription = nama, tint = if (tab == i) Emas else Color.White.copy(alpha = 0.6f)) },
                        label = { Text(nama, fontSize = 11.sp, color = if (tab == i) Emas else Color.White.copy(alpha = 0.6f)) },
                    )
                }
            }
        },
    ) { pad ->
        Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.Center) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(judul[tab], color = Emas, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                Text(
                    "Isi layar ini masih kosong.\nTinggal ganti Composable di MainActivity.kt.",
                    color = Color.White.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                    fontSize = 13.sp,
                )
                Row(Modifier.fillMaxWidth().padding(horizontal = 40.dp), horizontalArrangement = Arrangement.Center) {
                    Text("contoh konten", color = Color.White.copy(alpha = 0.35f), fontSize = 12.sp)
                }
            }
        }
    }
}
