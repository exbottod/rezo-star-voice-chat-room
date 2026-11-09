package com.rezochatvoice.exceo

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.widget.Toast
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Halaman Agensi.
 *
 * Host memasukkan kode undangan untuk bergabung. Pemilik agensi melihat kode
 * agensinya, jumlah host, komisi bulan berjalan, dan mengajukan pencairan.
 * Semua angka dihitung server; layar ini hanya menampilkan jawaban server.
 */
private fun fmtKoinAgency(n: Long): String = when {
    n >= 1_000_000_000_000L -> String.format("%.2fT", n / 1_000_000_000_000.0)
    n >= 1_000_000_000L -> String.format("%.2fB", n / 1_000_000_000.0)
    n >= 1_000_000L -> String.format("%.2fM", n / 1_000_000.0)
    n >= 1_000L -> String.format("%.1fK", n / 1_000.0)
    else -> n.toString()
}

@Composable
fun AgencyScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var memuat by remember { mutableStateOf(true) }
    var galat by remember { mutableStateOf("") }
    var agensi by remember { mutableStateOf<JSONObject?>(null) }
    var host by remember { mutableStateOf(0) }
    var komisi by remember { mutableStateOf(0L) }
    var sebagaiHost by remember { mutableStateOf<JSONObject?>(null) }
    var kode by remember { mutableStateOf("") }
    var sibuk by remember { mutableStateOf(false) }

    suspend fun muat() {
        val r = SupaRepo.panelCall("agency_info")
        if (r.optInt("ok") == 1) {
            agensi = r.optJSONObject("agency")
            host = r.optJSONArray("host")?.length() ?: 0
            komisi = r.optLong("komisiBulan", 0L)
            sebagaiHost = r.optJSONObject("sebagaiHost")
            galat = ""
        } else {
            galat = r.optString("e", "Gagal memuat data agensi")
        }
        memuat = false
    }

    LaunchedEffect(Unit) { muat() }

    Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF0E5F5A), Color(0xFF052F2C))))) {
        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("\u2039", color = Color.White, fontSize = 34.sp, modifier = Modifier.clickable { onBack() })
            Spacer(Modifier.padding(start = 8.dp))
            Text("Agensi", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (memuat) {
                Text("Memuat...", color = Color.White)
                return@Column
            }
            if (galat.isNotBlank()) {
                Text(galat, color = Color(0xFFFFB4A9), fontSize = 14.sp)
            }

            val a = agensi
            if (a != null) {
                Kotak {
                    Text("Agensi saya", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Text(a.optString("nama", "-"), color = Color(0xFFE0F7F3), fontSize = 15.sp)
                    Text("Kode undangan: " + a.optString("kode", "-"), color = Color(0xFFFFC107), fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Text("Rate komisi: " + a.optInt("rate", 0) + "% dari nilai gift host", color = Color(0xFFB8E6DF), fontSize = 13.sp)
                    Text("Host aktif: $host", color = Color(0xFFB8E6DF), fontSize = 13.sp)
                    Text("Komisi bulan ini: " + fmtKoinAgency(komisi), color = Color.White, fontSize = 14.sp)
                    Text("Saldo siap cair: " + fmtKoinAgency(a.optLong("saldo", 0L)), color = Color.White, fontSize = 14.sp)
                    Spacer(Modifier.height(10.dp))
                    Tombol("Ajukan pencairan", sibuk) {
                        sibuk = true
                        scope.launch {
                            val r = SupaRepo.panelCall("agency_request")
                            Toast.makeText(ctx, if (r.optInt("ok") == 1) "Pengajuan dikirim, tunggu persetujuan developer" else r.optString("e", "Gagal"), Toast.LENGTH_LONG).show()
                            sibuk = false
                            muat()
                        }
                    }
                }
            } else {
                val hostInfo = sebagaiHost
                val pesanGabung: String = if (hostInfo != null) {
                    "Kamu host di " + hostInfo.optString("nama", "-") +
                        " (rate " + hostInfo.optInt("rate", 0) + "%). Pindah agensi bisa setelah 30 hari."
                } else {
                    "Masukkan kode undangan dari pemilik agensi."
                }
                Kotak {
                    Text("Gabung agensi", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text(pesanGabung, color = Color(0xFFB8E6DF), fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = kode,
                        onValueChange = { kode = it.uppercase().take(8) },
                        label = { Text("Kode agensi") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(10.dp))
                    Tombol("Gabung", sibuk) {
                        if (kode.isBlank()) {
                            Toast.makeText(ctx, "Isi kode agensi dulu", Toast.LENGTH_SHORT).show()
                            return@Tombol
                        }
                        sibuk = true
                        scope.launch {
                            val r = SupaRepo.panelCall("agency_join", JSONObject().put("kode", kode.trim()))
                            Toast.makeText(ctx, if (r.optInt("ok") == 1) "Bergabung ke agensi" else r.optString("e", "Gagal"), Toast.LENGTH_LONG).show()
                            sibuk = false
                            muat()
                        }
                    }
                }
            }
            Text(
                "Komisi dihitung otomatis dari gift yang diterima host, langsung di server.",
                color = Color(0xFF8FC9C1), fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun Kotak(isi: @Composable () -> Unit) {
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF0B7C74)).padding(14.dp),
    ) {
        Column { isi() }
    }
}

@Composable
private fun Tombol(label: String, sibuk: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(50))
            .background(if (sibuk) Color(0xFF2A5F5A) else Color(0xFFFFC107))
            .clickable(enabled = !sibuk) { onClick() }
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(if (sibuk) "Memproses..." else label, color = Color(0xFF10302C), fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}
