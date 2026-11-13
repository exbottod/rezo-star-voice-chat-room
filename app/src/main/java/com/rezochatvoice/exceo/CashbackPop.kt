package com.rezochatvoice.exceo

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Animasi cashback gaya kartu (menggantikan pecahan angka yang berserakan).
 *
 * Alurnya sama dengan pratinjau 2,6 detik:
 *   0,00s kartu gift masuk dari bawah  ("Mahkota Raja  -500 koin")
 *   0,45s badge CASHBACK +N muncul pop, koin menyebar dari tengah
 *   0,55s saldo di kanan atas berjalan ke saldo akhir
 *   0,90s baris hijau "+bonus koin ke <penerima>" muncul
 *   2,20s semua memudar
 *
 * Sumber data tetap node yang sudah ada: giftFly/{roomId}, dikirim GiftFx dan
 * GiftCombo setelah undian cashback dari server.
 */
private const val POP_MS = 2600

/** false = pecahan angka SVGA yang lama tidak diputar lagi (diganti kartu ini). */
const val CB_LEGACY_PARTS = false

data class CbPop(
    val key: String,
    val from: String,
    val toName: String,
    val gname: String,
    val price: Long,
    val cb: Long,
    val recv: Long,
    val mult: Int,
    val jp: Boolean,
    val ts: Long,
)

private fun easeOutBack(x: Float, s: Float = 1.7f): Float {
    val p = x - 1f
    return 1f + (s + 1f) * p * p * p + s * p * p
}

@Composable
fun CashbackPopOverlay(roomId: String, myUid: String) {
    var pop by remember { mutableStateOf<CbPop?>(null) }
    var bal by remember { mutableStateOf(-1L) }
    var startBal by remember { mutableStateOf(-1L) }
    val lastKey = remember { arrayOfNulls<String>(1) }

    // Saldo sendiri untuk angka di kanan atas (hanya tampilan, bukan transaksi).
    DisposableEffect(myUid) {
        if (myUid.isBlank()) {
            onDispose { }
        } else {
            val reg = try {
                WalletRepo.observe(myUid) { w -> bal = w.coins }
            } catch (e: Exception) {
                null
            }
            onDispose {
                try { reg?.remove() } catch (e: Exception) { }
            }
        }
    }

    DisposableEffect(roomId) {
        var init = true
        val reg = Rtdb.listen(Rtdb.ref("giftFly/$roomId").limitToLast(1)) { snap ->
            val c = snap.children.lastOrNull() ?: return@listen
            val k = c.key ?: return@listen
            val ts = c.child("ts").getValue(Long::class.java) ?: 0L
            if (init) {
                init = false
                // Baru masuk room: gift lama (lebih dari 6 detik) tidak diputar.
                if (ts > System.currentTimeMillis() - 6000L) return@listen
            }
            if (k == lastKey[0]) return@listen
            lastKey[0] = k
            val cb = c.child("cb").getValue(Long::class.java) ?: 0L
            if (cb <= 0L) return@listen
            val price = c.child("price").getValue(Long::class.java) ?: 0L
            // Saldo sebelum transaksi = saldo sekarang + harga gift - cashback.
            startBal = if (bal >= 0L) (bal + price - cb).coerceAtLeast(0L) else -1L
            pop = CbPop(
                key = k,
                from = c.child("from").getValue(String::class.java) ?: "",
                toName = c.child("toName").getValue(String::class.java) ?: "",
                gname = c.child("gname").getValue(String::class.java)
                    ?: (c.child("gift").getValue(String::class.java) ?: ""),
                price = price,
                cb = cb,
                recv = c.child("recv").getValue(Long::class.java) ?: 0L,
                mult = (c.child("mult").getValue(Long::class.java) ?: 0L).toInt(),
                jp = c.child("jp").getValue(Boolean::class.java) ?: false,
                ts = ts,
            )
        }
        onDispose { try { reg.remove() } catch (e: Exception) { } }
    }

    val cur = pop
    if (cur != null) {
        key(cur.key) {
            CashbackPopOnce(cur, startBal, bal) {
                if (pop?.key == cur.key) pop = null
            }
        }
    }
}

@Composable
private fun CashbackPopOnce(p: CbPop, startBal: Long, endBal: Long, onDone: () -> Unit) {
    val t = remember(p.key) { Animatable(0f) }
    LaunchedEffect(p.key) {
        t.animateTo(1f, tween(POP_MS, easing = LinearEasing))
        delay(80L)
        onDone()
    }

    Box(Modifier.fillMaxSize()) {
        // ---------- 1. Kartu gift masuk dari bawah, lalu pergi ----------
        Box(
            Modifier
                .align(Alignment.Center)
                .offset {
                    val s = t.value * (POP_MS / 1000f)
                    val app = (s / 0.30f).coerceIn(0f, 1f)
                    IntOffset(0, (-108).dp.roundToPx() + (((1f - app) * (1f - app)) * 130f).roundToInt())
                }
                .graphicsLayer {
                    val s = t.value * (POP_MS / 1000f)
                    alpha = when {
                        s > 1.90f -> 0f
                        s > 1.55f -> ((1.90f - s) / 0.35f).coerceIn(0f, 1f)
                        else -> 1f
                    }
                }
                .width(252.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xF23A2050))
                .border(1.5.dp, Color(0xFFFFC43C), RoundedCornerShape(20.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .width(42.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFFFC43C))
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("🎁", fontSize = 18.sp)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        p.gname.ifBlank { p.from.ifBlank { tr("Gift") } },
                        color = Color(0xFFFFF0C8),
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                    )
                    Text(
                        tr("-${fmtNum(p.price)} koin"),
                        color = Color(0xFFFF9E9E),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                    )
                }
            }
        }

        // ---------- 2. Koin menyebar dari tengah ----------
        Canvas(Modifier.fillMaxSize()) {
            val s = t.value * (POP_MS / 1000f)
            if (s > 0.42f) {
                val k = s - 0.42f
                val life = (1f - k / 1.70f).coerceIn(0f, 1f)
                if (life > 0f) {
                    val cx = size.width / 2f
                    val cy = size.height * 0.52f
                    for (i in 0 until 14) {
                        val ang = (i * (2.0 * PI / 14.0)) + 0.35
                        val spd = 95f + ((i * 53) % 135)
                        val x = cx + cos(ang).toFloat() * spd * k
                        val y = cy + sin(ang).toFloat() * spd * k + 330f * k * k
                        val r = 8f + ((i * 7) % 7)
                        drawCircle(Color(0xFFFFC43C).copy(alpha = life), r, Offset(x, y))
                        drawCircle(
                            Color(0xFFFFEBA0).copy(alpha = life * 0.85f),
                            r * 0.45f,
                            Offset(x, y - r * 0.25f),
                        )
                    }
                }
            }
        }

        // ---------- 3. Badge CASHBACK ----------
        Box(
            Modifier
                .align(Alignment.Center)
                .offset { IntOffset(0, 24.dp.roundToPx()) }
                .graphicsLayer {
                    val s = t.value * (POP_MS / 1000f)
                    val app = ((s - 0.45f) / 0.32f).coerceIn(0f, 1f)
                    val sc = easeOutBack(app)
                    scaleX = sc
                    scaleY = sc
                    alpha = when {
                        s < 0.45f -> 0f
                        s > 2.15f -> 0f
                        s > 1.80f -> ((2.15f - s) / 0.35f).coerceIn(0f, 1f)
                        else -> 1f
                    }
                }
                .clip(RoundedCornerShape(28.dp))
                .background(Color(0xEE1E1036))
                .border(2.dp, Color(0xFFFFC43C), RoundedCornerShape(28.dp))
                .padding(horizontal = 22.dp, vertical = 12.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Text(
                        if (p.jp) tr("JACKPOT CASHBACK") else tr("CASHBACK"),
                        color = Color(0xFFFFF0C0),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    if (p.mult > 0) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            tr("x${p.mult}"),
                            color = Color(0xFF8CF0BE),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        "+${fmtNum(p.cb)}",
                        color = Color(0xFFFFC43C),
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                    )
                    Text(
                        tr(" koin"),
                        color = Color(0xFFFFEBA0),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 5.dp),
                    )
                }
            }
        }

        // ---------- 4. Baris hijau untuk penerima ----------
        Box(
            Modifier
                .align(Alignment.Center)
                .offset {
                    val s = t.value * (POP_MS / 1000f)
                    val up = ((s - 0.90f) / 0.35f).coerceIn(0f, 1f)
                    IntOffset(0, 132.dp.roundToPx() + ((1f - up) * 26f).roundToInt())
                }
                .graphicsLayer {
                    val s = t.value * (POP_MS / 1000f)
                    alpha = when {
                        s < 0.90f -> 0f
                        s > 2.25f -> 0f
                        s > 1.95f -> ((2.25f - s) / 0.30f).coerceIn(0f, 1f)
                        else -> 1f
                    }
                }
                .clip(RoundedCornerShape(14.dp))
                .background(Color(0xE6163A2C))
                .border(1.5.dp, Color(0xFF8CF0BE), RoundedCornerShape(14.dp))
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            val nama = p.toName.ifBlank { tr("penerima") }
            val isi = if (p.recv > 0L) tr("+${fmtNum(p.recv)} koin ke $nama") else tr("ke $nama")
            Text(isi, color = Color(0xFFA5FFCD), fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        }

        // ---------- 5. Saldo berjalan di kanan atas ----------
        BalanceChip(t, startBal, endBal)
    }
}

/** Angka saldo yang berjalan dari saldo sebelum ke saldo sesudah transaksi. */
@Composable
private fun BalanceChip(t: Animatable<Float>, start: Long, end: Long) {
    if (start < 0L || end < 0L) return
    val s = t.value * (POP_MS / 1000f)
    if (s < 0.45f) return
    val p = ((s - 0.55f) / 0.90f).coerceIn(0f, 1f)
    val e = 1f - (1f - p) * (1f - p)
    val nilai = start + ((end - start) * e).toLong()
    Box(
        Modifier
            .align(Alignment.TopEnd)
            .padding(top = 84.dp, end = 14.dp)
            .graphicsLayer { alpha = if (s > 2.20f) ((2.45f - s) / 0.25f).coerceIn(0f, 1f) else 1f }
            .clip(RoundedCornerShape(50))
            .background(Color(0xE62A1450))
            .border(1.5.dp, Color(0xFFFFC43C), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("🪙", fontSize = 12.sp)
            Spacer(Modifier.width(6.dp))
            Text(fmtNum(nilai), color = Color(0xFFFFEBA0), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}
