package com.rezochatvoice.exceo

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.random.Random

/**
 * Kumpulan game REZO. Semua digambar langsung oleh aplikasi (Compose), tanpa
 * halaman web dan tanpa server game pihak ketiga, jadi jalan di Android 8 ke atas.
 * Coin dipotong/dibayar lewat wallet-api Supabase (SupaRepo.waveFlow).
 */

/**
 * Saklar global untuk game buatan REZO (Dragon Tiger, Teen Patti, Lucky 77, slot,
 * dan sejenisnya). Kalau dimatikan dari panel dev, Game Center hanya menampilkan
 * game pihak ketiga. Disimpan di Realtime Database: gameCfg/ownOff.
 */
object GameCfg {
    var ownOff by mutableStateOf(true)
        private set
    private var mulai = false

    fun start() {
        if (mulai) return
        mulai = true
        try {
            Rtdb.listen(Rtdb.ref("gameCfg")) { s ->
                ownOff = s.child("ownOff").getValue(Boolean::class.java) ?: true
            }
        } catch (e: Exception) { }
    }
}

private val GoldG = Color(0xFFF5C542)

private fun fmtG(n: Long): String {
    val s = n.toString()
    val out = StringBuilder()
    for ((i, c) in s.withIndex()) {
        if (i > 0 && (s.length - i) % 3 == 0) out.append('.')
        out.append(c)
    }
    return out.toString()
}

/** Halaman daftar game. */
@Composable
fun GamesHub(myUid: String, roomId: String, myName: String = "", myAvatarB64: String = "", onClose: () -> Unit) {
    var open by remember { mutableStateOf("") }
    var balance by remember { mutableStateOf(0L) }
    // Daftar game WaveGames diambil dari katalog, jadi game baru ikut tampil.
    var waveGames by remember { mutableStateOf<List<WaveGames.Game>>(emptyList()) }
    // true kalau daftar terbaru dari server berhasil diambil.
    var daftarDariServer by remember { mutableStateOf(false) }
    var muatUlang by remember { mutableStateOf(0) }
    val ctx = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(muatUlang) {
        val segar = try { WaveGames.catalog() } catch (e: Exception) { emptyList() }
        if (segar.isNotEmpty()) waveGames = segar
        daftarDariServer = segar.isNotEmpty()
    }

    LaunchedEffect(Unit) {
        GameCfg.start()
        // Nama + foto asli akun REZO supaya ranking game menampilkan pemain yang benar.
        SupaRepo.wavePrepare(myName.ifBlank { "Player" }.take(30), myAvatarB64)
        balance = SupaRepo.get(myUid).wallet?.coins ?: 0L
    }

    // Kotak "Game Rezo" membuka game Greedy Rezo sendiri (dompet VPS).
    // Game Wave tetap membuka halaman Wave-nya masing-masing, termasuk
    // Greedy King #80, supaya tidak ikut tertukar dengan game Rezo.
    val bukaGreedyRezo = open == "greedyking"
    val bukaSlotZeus = open == "slotzeus"
    val waveOpen: WaveGames.Game? = if (open.startsWith("wave:") && !bukaGreedyRezo) {
        val gid = open.removePrefix("wave:").toIntOrNull()
        waveGames.firstOrNull { it.id == gid }
    } else null

    if (waveOpen != null) {
        WavePlayScreen(uid = myUid, game = waveOpen, onClose = { open = "" })
        return
    }

    when {
        bukaSlotZeus -> SlotGameScreen(onClose = { open = "" })
        bukaGreedyRezo -> GreedyKingScreen(
            myUid = myUid,
            myName = myName.ifBlank { "Player" },
            onClose = { open = "" },
        )
        else -> Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            // Bottom sheet "Game Center": area atas tembus pandang, sheet coklat di bawah.
            Box(Modifier.fillMaxSize().clickable(
                indication = null,
                interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
            ) { onClose() }) {
                Column(
                    Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(0.90f)
                        .navigationBarsPadding()
                        .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                        .background(Brush.verticalGradient(listOf(Color(0xFF4A2F1B), Color(0xFF2B190E))))
                        .border(1.dp, Color(0xFF8A5A2B), RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                        .clickable(
                            indication = null,
                            interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                        ) { },
                ) {
                    // hiasan puncak sheet
                    Box(Modifier.fillMaxWidth().padding(top = 4.dp), contentAlignment = Alignment.Center) {
                        Text("◆", color = Color(0xFFE0553A), fontSize = 12.sp)
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("〰", color = Color(0xFFB08A5A), fontSize = 14.sp)
                        Spacer(Modifier.width(10.dp))
                        Text(tr("Game Center"), color = Color(0xFFF0DDBF), fontSize = 17.sp)
                        Spacer(Modifier.width(10.dp))
                        Text("〰", color = Color(0xFFB08A5A), fontSize = 14.sp)
                    }
                    // Kalau daftar dari server gagal, munculkan tombol muat ulang
                    // supaya game baru dari katalog WaveGames tetap bisa ditarik.
                    if (!daftarDariServer) {
                        Box(
                            Modifier.fillMaxWidth().padding(bottom = 6.dp)
                                .clickable { muatUlang++ },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                tr("Daftar game belum dari server · ketuk untuk muat ulang"),
                                color = Color(0xFFFFC46B), fontSize = 11.sp,
                            )
                        }
                    }

                    Column(
                        Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState())
                            .padding(horizontal = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        // ---- Game milik Rezo sendiri (dompet Rezo, bukan Wave)
                        GcSection("Game Rezo") {
                            GcRows(
                                listOf(
                                    GcItem("Greedy King", R.drawable.ic_game_cat, "greedyking"),
                                    GcItem("Slot Zeus", R.drawable.ic_game_zeus, "slotzeus"),
                                ),
                            ) { open = it }
                        }

                        // ---- Game WaveGames (katalog resmi Wave)
                        if (waveGames.isNotEmpty()) GcSection("Game Wave") {
                            // Semua game Wave tetap tampil, tidak ada yang dibuang.
                            GcRows(waveGames.map { g -> GcItem(g.name, 0, "wave:" + g.id, g.image) }) { open = it }
                        }

                        // ---- Daftar peringkat
                        Box(
                            Modifier.fillMaxWidth().height(70.dp).clip(RoundedCornerShape(14.dp))
                                .background(Brush.horizontalGradient(listOf(Color(0xFF9EE0E8), Color(0xFFB9A8F0), Color(0xFFA8E6C8)))),
                            contentAlignment = Alignment.CenterStart,
                        ) {
                            Text(
                                tr("Daftar peringkat"), color = Color.White.copy(alpha = 0.9f),
                                fontSize = 13.sp, modifier = Modifier.padding(start = 12.dp, bottom = 28.dp),
                            )
                            Row(Modifier.padding(start = 90.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                listOf("1", "2", "3").forEach { n ->
                                    Box(
                                        Modifier.size(38.dp).clip(androidx.compose.foundation.shape.CircleShape)
                                            .background(Color(0xFF2E7D32))
                                            .border(2.dp, Color(0xFFFFE082), androidx.compose.foundation.shape.CircleShape),
                                        contentAlignment = Alignment.Center,
                                    ) { Text(n, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
                                }
                            }
                        }
                        Spacer(Modifier.height(96.dp))
                    }
                }

                // ---- bilah bawah: game yang sedang dipakai
                Row(
                    Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp)
                        .clip(RoundedCornerShape(50))
                        .background(Color(0xFF4A2F1B))
                        .border(2.dp, Color(0xFFB07A3A), RoundedCornerShape(50))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    listOf(
                        GcItem("Greedy King", R.drawable.ic_game_cat, "greedyking"),
                    ).forEach { it2 ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.clickable { open = it2.key },
                        ) {
                            Image(
                                painterResource(it2.icon), contentDescription = it2.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(46.dp).clip(RoundedCornerShape(10.dp)),
                            )
                            Text(it2.name, color = Color(0xFFD9C3A0), fontSize = 10.sp)
                        }
                    }
                }
            }
        }
    }
}

private data class GcItem(val name: String, val icon: Int, val key: String, val iconUrl: String = "")

@Composable
private fun GcSection(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF5A3C27)).padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        Text(tr(title), color = Color(0xFFF0DDBF), fontSize = 15.sp)
        Spacer(Modifier.height(10.dp))
        content()
    }
}

@Composable
private fun GcRows(items: List<GcItem>, onPick: (String) -> Unit) {
    // Ukuran ikon dihitung dari lebar layar: baris tidak pernah meluap dan ikon
    // tidak ikut membesar di tablet (maksimal 74dp).
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val cols = if (maxWidth >= 480.dp) 5 else 4
        val gap = 10.dp
        val tile = (((maxWidth - gap * (cols - 1)) / cols).coerceAtMost(74.dp))
            .coerceAtLeast(48.dp)
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items.chunked(cols).forEach { chunk ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap)) {
                    chunk.forEach { g -> _GcTile(g, tile, onPick) }
                    repeat(cols - chunk.size) { Spacer(Modifier.width(tile)) }
                }
            }
        }
    }
}

@Composable
private fun _GcTile(g: GcItem, tile: Dp, onPick: (String) -> Unit) {
    Column(
        Modifier.width(tile).clickable { onPick(g.key) },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(tile).clip(RoundedCornerShape(16.dp))
                .border(2.dp, Color(0xFFE0B54A), RoundedCornerShape(16.dp)),
        ) {
            if (g.iconUrl.isNotBlank()) {
                coil.compose.AsyncImage(
                    model = g.iconUrl, contentDescription = g.name,
                    contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
                )
            } else {
                Image(
                    painterResource(g.icon), contentDescription = g.name,
                    contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(
            g.name, color = Color(0xFFF0DDBF), fontSize = 11.sp, maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun GameTile(title: String, sub: String, tint: Color, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .background(tint.copy(alpha = 0.75f))
            .border(1.dp, GoldG.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .clickable { onClick() }.padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(tr(title), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text(sub, color = Color(0xFFE0E0E0), fontSize = 12.sp)
        }
        Text(tr("Main ›"), color = GoldG, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

/** Slot 3 gulungan, dipakai untuk Lucky 77, Greedy King, dan Slot Buah. */
