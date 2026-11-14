/* ============================================================
   Bahasa panel Viza: Indonesia, English, Arabic, Chinese.
   Cara kerja: setiap teks yang PERSIS sama dengan kamus diganti.
   Nama user, ID, harga, dan tautan tidak ikut berubah karena tidak
   ada di kamus. Pilihan bahasa disimpan di perangkat.
   ============================================================ */
const KAMUS = {
"en": {
"Pakai tautan": "Use a link",
"Unggah dari perangkat": "Upload from device",
"Pilih berkas dari perangkat": "Choose a file from device",
"Gambar tidak bisa dimuat. Periksa tautan atau berkasnya.": "Image cannot load. Check the link or file.",
"Video tidak bisa dimuat.": "Video cannot load.",
"Format tidak dikenali untuk pratinjau": "Format not recognised for preview",
"SVGA ▶": "SVGA ▶",
"FILE": "FILE",
"Gagal memuat data.": "Failed to load data.",
"Gift aktif": "Active gifts",
"User diblokir": "Blocked users",
"Versi APK tercatat": "Recorded APK version",
"Aktivitas admin terakhir": "Recent admin activity",
"ADMIN": "ADMIN",
"Belum ada aktivitas tercatat.": "No activity recorded yet.",
"Room terbaru": "Recent rooms",
"Lihat semua": "See all",
"ROOM": "ROOM",
"PEMILIK": "OWNER",
"Daftar user": "User list",
"Semua": "All",
"Tidak ada user yang cocok.": "No matching users.",
"USER": "USER",
"diblokir": "blocked",
"Total room": "Total rooms",
"Terbuka": "Open",
"Terkunci": "Locked",
"Room party": "Party rooms",
"sematkan room paling atas dan beri tag official": "pin a room to the top and tag it official",
"PESERTA": "MEMBERS",
"ATURAN": "RULE",
"disematkan": "pinned",
"biasa": "normal",
"official": "official",
"Belum ada room party di Realtime Database.": "No party rooms in Realtime Database yet.",
"ID ROOM": "ROOM ID",
"Tutup room": "Close room",
"Katalog gift": "Gift catalog",
"dibaca aplikasi dari koleksi gifts": "read by the app from the gifts collection",
"GIFT": "GIFT",
"MEDIA": "MEDIA",
"TAMBAHAN": "EXTRAS",
"Belum ada gift. Tekan Tambah gift di kanan atas.": "No gifts yet. Press Add gift at the top right.",
"Jackpot rate": "Jackpot rate",
"Jackpot multiplier": "Jackpot multiplier",
"Cashback rate": "Cashback rate",
"Harga dasar cashback": "Cashback base price",
"special": "special",
"rocket": "rocket",
"cashback": "cashback",
"Banner beranda": "Home banners",
"koleksi banners": "banners collection",
"URUTAN": "ORDER",
"Belum ada banner.": "No banners yet.",
"Frame profil": "Profile frames",
"koleksi frames": "frames collection",
"FRAME": "FRAME",
"Belum ada frame di koleksi frames.": "No frames in the frames collection.",
"Tautan saat diketuk": "Link when tapped",
"Kirim panel ke user": "Send panel to user",
"Kirim panel manager": "Send manager panel",
"Kirim panel admin": "Send admin panel",
"Cabut panel user ini": "Revoke this user's panel",
"Tambah ke stok": "Add to stock",
"Muat stok staf ini": "Load this staff's stock",
"Set stok": "Set stock",
"Nolkan stok": "Zero the stock",
"Daftar staf": "Staff list",
"Seller coin": "Coin sellers",
"yang muncul di tab Saya sebagai Panel Seller": "shown on the Me tab as Panel Seller",
"Tombol": "Button",
"di kanan atas tetap bisa dicoba.": "at the top right can still be used.",
"SELLER": "SELLER",
"TOKO": "SHOP",
"WHATSAPP": "WHATSAPP",
"STOK COIN": "COIN STOCK",
"Belum ada seller terdaftar di dompet.": "No sellers registered on the wallet yet.",
"Akses panel developer": "Developer panel access",
"Tambah staf panel": "Add panel staff",
"Belum ada staf panel.": "No panel staff yet.",
"memuat…": "loading…",
"Potong stok": "Deduct stock",
"Kirim coin, VIP, dan reset": "Send coins, VIP and reset",
"server dompet Viza dan Rezo memakai jalur yang sama": "the Viza and Rezo wallets use the same route",
"Kirim VIP": "Send VIP",
"Reset coin semua user": "Reset coins for all users",
"Reset diamond semua user": "Reset diamonds for all users",
"Reset aset My Item semua user": "Reset My Item assets for all users",
"Cek topup manual": "Check manual top-ups",
"Hapus akun user": "Delete the user account",
"Reset nama jadi Unknown": "Reset name to Unknown",
"Reset foto profil": "Reset profile photo",
"Kirim item ke user": "Send item to user",
"langsung masuk ke tas user, tanpa beli di Store": "goes straight into the user's bag, no Store purchase",
"Belum ada item, buat di Aset & VIP": "No items yet, create them in Assets & VIP",
"Gelembung": "Bubble",
"Frame avatar": "Avatar frame",
"Berkas": "Files",
"Ukuran": "Size",
"Disimpan di": "Stored in",
"Alamat": "Address",
"Aset VIP 1-9": "VIP assets 1-9",
"TIER": "TIER",
"TAUTAN": "LINK",
"Belum ada aset VIP. Tekan + Aset VIP.": "No VIP assets yet. Press + VIP asset.",
"Item toko, frame, efek, dan ID unik": "Store items, frames, effects and unique IDs",
"vipConfig · dijual di Store atau dikirim ke akun": "vipConfig · sold in the Store or sent to an account",
"HARI": "DAYS",
"ID UNIK": "UNIQUE ID",
"KUNCI AKUN": "ACCOUNT LOCK",
"JUAL": "SALE",
"kiriman": "sent",
"dijual": "on sale",
"Belum ada item toko.": "No store items yet.",
"Kartu VIP": "VIP cards",
"ada di slot": "in the slot",
"koleksi games": "games collection",
"ALAMAT": "ADDRESS",
"KEY": "KEY",
"Belum ada game terpasang.": "No games installed yet.",
"Buka menu Pasang game untuk menambahkan.": "Open the Install game menu to add one.",
"Pasang game baru": "Install a new game",
"tempel alamat dan key production": "paste the address and production key",
"Key production": "Production key",
"Sudah terpasang": "Already installed",
"Belum ada game.": "No games yet.",
"Atur nilai bet": "Set bet values",
"berlaku untuk game dompet": "applies to wallet games",
"Simpan pengaturan bet": "Save bet settings",
"Pengaturan tersimpan": "Settings saved",
"MIN": "MIN",
"MAKS": "MAX",
"CHIP": "CHIP",
"ID DOKUMEN": "DOCUMENT ID",
"ISI": "CONTENT",
"Koleksi kosong atau belum ada.": "Collection empty or missing.",
"Background layar belakang tab": "Tab background screens",
"berlaku untuk semua user begitu dipasang": "applies to all users once set",
"TAB": "TAB",
"KETERANGAN": "DESCRIPTION",
"SAAT INI": "CURRENT",
"Atur": "Set",
"Gradien 2 warna": "Two-colour gradient",
"Akun Customer Service": "Customer Service account",
"Total": "Total",
"Disematkan": "Pinned",
"tampil di chat, Pengumuman Resmi, di aplikasi": "shown in chat and Official announcements in the app",
"FOTO": "PHOTO",
"disembunyikan": "hidden",
"Belum ada pengumuman. Tekan + Pengumuman di kanan atas.": "No announcements yet. Press + Announcement at the top right.",
"setiap aksi dari panel dicatat": "every panel action is recorded",
"Belum ada catatan.": "No records yet.",
"Daftarkan admin panel": "Register a panel admin",
"Moderator": "Moderator",
"Owner": "Owner",
"Admin terdaftar": "Registered admins",
"dicabut": "revoked",
"Hanya email di daftar ini yang bisa membuka panel.": "Only emails on this list can open the panel.",
"Nama user di aplikasi": "User name in the app",
"minimal 6 karakter, atau kosongkan untuk otomatis": "at least 6 characters, or leave empty to auto-generate",
"kosongkan untuk manager": "leave empty for manager",
"kosongkan kalau akun sudah ada": "leave empty if the account already exists",
"frame_gold, medal_1": "frame_gold, medal_1",
"mis. panel_coin_add": "e.g. panel_coin_add",
"mis. 923146051900": "e.g. 923146051900",
"mis. Lencana Sultan": "e.g. Sultan Badge",
"Frame Neon": "Neon Frame",
"mis. 1000": "e.g. 1000",
"Greedy King": "Greedy King",
"tempel key dari penyedia game": "paste the key from the game provider",
"zeus, greedy, fruitsparty…": "zeus, greedy, fruitsparty…",
"100,500,1000": "100,500,1000",
"koleksi lain…": "other collections…",
"mis. Pembaruan aplikasi": "e.g. App update",
"nama@email.com": "name@email.com",

"Ganti bahasa": "Change language",
"Simpan perubahan": "Save changes",
"ubah": "edit",
"Menyimpan…": "Saving…",
"Menghapus…": "Deleting…",
"Dihapus": "Deleted",
"Terhapus. Slotnya siap diisi ulang": "Deleted. The slot is ready for a new upload",
"Jual lagi": "Sell again",
"Tarik dari Store": "Pull from Store",
"Dashboard": "Dashboard",
"User": "Users",
"Room": "Rooms",
"Gift": "Gifts",
"Frame & banner": "Frames & banners",
"Frame &amp; banner": "Frames & banners",
"Aset & VIP": "Assets & VIP",
"Aset &amp; VIP": "Assets & VIP",
"Katalog game": "Game catalog",
"Pasang game": "Install game",
"Bet game": "Game bets",
"Database": "Database",
"Log admin": "Admin log",
"Pengaturan": "Settings",
"Staf & seller": "Staff & sellers",
"Staf &amp; seller": "Staff & sellers",
"Coin & reset": "Coins & reset",
"Coin &amp; reset": "Coins & reset",
"Kirim ke user": "Send to user",
"Customer Service": "Customer Service",
"Pengumuman resmi": "Official announcements",
"Aset di VPS": "Assets on VPS",
"Background tab": "Tab backgrounds",
"HOME": "HOME",
"KELOLA": "MANAGE",
"GAME": "GAME",
"DATA": "DATA",
"CONFIG": "CONFIG",
"Viza Panel": "Viza Panel",
"Panel developer Viza Chat": "Viza Chat developer panel",
"Masuk": "Sign in",
"Masuk dengan Google": "Sign in with Google",
"atau": "or",
"Email": "Email",
"Password": "Password",
"Hanya akun yang terdaftar yang bisa membuka panel ini.": "Only registered accounts can open this panel.",
"Emoji": "Emoji",
"Hapus": "Delete",
"Edit": "Edit",
"Salin": "Copy",
"Simpan": "Save",
"Batal": "Cancel",
"Aktif": "Active",
"aktif": "active",
"nonaktif": "inactive",
"Memuat…": "Loading…",
"Aksi": "Action",
"AKSI": "ACTION",
"Nama": "Name",
"NAMA": "NAME",
"EMAIL": "EMAIL",
"Peran": "Role",
"PERAN": "ROLE",
"Status": "Status",
"STATUS": "STATUS",
"Waktu": "Time",
"WAKTU": "TIME",
"Rincian": "Details",
"RINCIAN": "DETAILS",
"Pratinjau": "Preview",
"PRATINJAU": "PREVIEW",
"Slot": "Slot",
"SLOT": "SLOT",
"Jenis": "Type",
"JENIS": "TYPE",
"Tautan": "Link",
"Harga": "Price",
"HARGA": "PRICE",
"Hari": "Days",
"Judul": "Title",
"JUDUL": "TITLE",
"Gambar": "Image",
"GAMBAR": "IMAGE",
"Urutan": "Order",
"Durasi (hari)": "Duration (days)",
"Aktifkan": "Enable",
"Tampilkan": "Show",
"Tampil di aplikasi": "Show in app",
"Cabut": "Revoke",
"Blokir": "Block",
"Buka blokir": "Unblock",
"Diblokir": "Blocked",
"terkunci": "locked",
"terbuka": "open",
"lihat": "view",
"tampil": "shown",
"Tambah seller": "Add seller",
"Tambah user": "Add user",
"Tambah user Viza": "Add Viza user",
"Tambah gift": "Add gift",
"Tambah banner": "Add banner",
"Tambah stok": "Add stock",
"Stok": "Stock",
"Stok panel": "Panel stock",
"Stok coin staf": "Staff coin stock",
"Hapus dokumen": "Delete document",
"Jalankan": "Run",
"Muat ulang": "Reload",
"Cari nama atau UID…": "Search name or UID…",
"Klik untuk memperbesar": "Tap to enlarge",
"Nama tampilan": "Display name",
"Nama item": "Item name",
"Nama game": "Game name",
"Nama frame": "Frame name",
"Nama lencana": "Badge name",
"Nama gift": "Gift name",
"Nama toko": "Shop name",
"Nama admin": "Admin name",
"Nama dan email wajib diisi": "Name and email are required",
"Subjudul": "Subtitle",
"Isi pengumuman (teks)": "Announcement text",
"Sematkan di atas": "Pin to top",
"Pengumuman": "Announcement",
"Isi dokumen (JSON)": "Document content (JSON)",
"Mode": "Mode",
"Gelap": "Dark",
"Terang": "Light",
"Kotak": "Square",
"Warna atas (hex)": "Top colour (hex)",
"Warna bawah (hex)": "Bottom colour (hex)",
"Daftarkan admin": "Register admin",
"Pilih item": "Choose item",
"Pilih item dulu": "Choose an item first",
"Isi ID user dulu": "Enter a user ID first",
"ID user tidak ditemukan": "User ID not found",
"Pilih berkas atau isi tautan": "Choose a file or paste a link",
"ID unik": "Unique ID",
"Kunci akun": "Account lock",
"Jual": "Sale",
"Tier": "Tier",
"Tier VIP": "VIP tier",
"Jenis item": "Item type",
"Jenis media": "Media type",
"Harga (koin)": "Price (coins)",
"Harga di Store (koin, opsional)": "Store price (coins, optional)",
"Tampilkan juga di Store": "Also show in Store",
"Dijual di Store": "Sold in Store",
"Berlaku (hari)": "Valid (days)",
"Durasi untuk user (hari)": "Duration for user (days)",
"Jumlah coin": "Coin amount",
"Jumlah coin / diamond": "Coins / diamonds",
"Stok coin awal (opsional)": "Initial coin stock (optional)",
"Stok coin untuk kirim coin ke user": "Coin stock for sending coins to users",
"Item yang boleh dikirim (ID item, pisah koma)": "Items allowed to send (item IDs, comma separated)",
"Jabatan di APK (bukan akses panel)": "Position in APK (not panel access)",
"Boleh masuk panel": "Can sign in to panel",
"Email untuk login": "Email for sign in",
"Email untuk login panel": "Panel sign-in email",
"Email login": "Sign-in email",
"Password (opsional, dibuatkan akun login)": "Password (optional, creates a login account)",
"Password minimal 6 karakter": "Password must be at least 6 characters",
"Nomer HP / WhatsApp": "Phone / WhatsApp",
"Manager dari admin (khusus admin, isi ID manager)": "Manager under admin (admin only, enter manager ID)",
"ID staf (angka)": "Staff ID (number)",
"ID staf penerima stok (angka)": "Receiver staff ID (number)",
"ID user (angka)": "User ID (number)",
"ID user penerima": "Receiver user ID",
"UID atau ID angka user": "UID or numeric user ID",
"ID user yang dijadikan Customer Service": "User ID to make Customer Service",
"Bet minimum": "Minimum bet",
"Bet maksimum": "Maximum bet",
"Pilihan chip": "Chip options",
"Penanda": "Marker",
"Game terpasang": "Installed games",
"Game": "Game",
"Belum ada berkas": "No files yet",
"Belum ada room.": "No rooms yet.",
"User terdaftar": "Registered users",
"Kartu profil VIP (latar kartu)": "VIP profile card (card background)",
"Efek masuk": "Entry effect",
"Banner": "Banner",
"Lencana": "Badge",
"Medali": "Medal",
"Panel": "Panel",
"Detail user": "User details",
"Blokir user": "Block user",
"Hapus room": "Delete room",
"Hapus gift": "Delete gift",
"Hapus banner": "Delete banner",
"Tutup dan hapus room ini? Tindakan ini langsung terasa di aplikasi.": "Close and delete this room? This takes effect immediately in the app.",
"Hapus gift ini dari katalog?": "Delete this gift from the catalog?",
"Hapus banner ini?": "Delete this banner?",
"Room dihapus": "Room deleted",
"Gift dihapus": "Gift deleted",
"Gift disimpan": "Gift saved",
"Banner dihapus": "Banner deleted",
"Nama gift wajib diisi": "Gift name is required",
"Akun dibuat": "Account created",
"Aktifkan CS": "Enable CS",
"Cabut CS": "Revoke CS",
"Tulis pengumuman di sini": "Write the announcement here",
"Unknown": "Unknown",
"Tersimpan": "Saved",
"Tidak ada data": "No data",
"ya": "yes",
"tidak": "no",
"Kabur": "Dismiss",
"Keluar": "Sign out",
"Bahasa": "Language",
"Pilih bahasa": "Choose language"
},
"ar": {

"Ganti bahasa": "تغيير اللغة",
"Simpan perubahan": "حفظ التغييرات",
"ubah": "تعديل",
"Menyimpan…": "جارٍ الحفظ…",
"Menghapus…": "جارٍ الحذف…",
"Dihapus": "تم الحذف",
"Terhapus. Slotnya siap diisi ulang": "تم الحذف. الخانة جاهزة لرفع جديد",
"Jual lagi": "إعادة البيع",
"Tarik dari Store": "سحب من المتجر",
"Dashboard": "لوحة التحكم",
"User": "المستخدمون",
"Room": "الغرف",
"Gift": "الهدايا",
"Frame & banner": "الإطارات واللافتات",
"Frame &amp; banner": "الإطارات واللافتات",
"Aset & VIP": "الأصول وVIP",
"Aset &amp; VIP": "الأصول وVIP",
"Katalog game": "كتالوج الألعاب",
"Pasang game": "تثبيت لعبة",
"Bet game": "رهانات الألعاب",
"Database": "قاعدة البيانات",
"Log admin": "سجل الإدارة",
"Pengaturan": "الإعدادات",
"Staf & seller": "الموظفون والبائعون",
"Staf &amp; seller": "الموظفون والبائعون",
"Coin & reset": "العملات والتصفير",
"Coin &amp; reset": "العملات والتصفير",
"Kirim ke user": "إرسال إلى مستخدم",
"Customer Service": "خدمة العملاء",
"Pengumuman resmi": "الإعلانات الرسمية",
"Aset di VPS": "الأصول على VPS",
"Background tab": "خلفيات التبويبات",
"HOME": "الرئيسية",
"KELOLA": "الإدارة",
"GAME": "الألعاب",
"DATA": "البيانات",
"CONFIG": "الإعدادات",
"Viza Panel": "لوحة Viza",
"Panel developer Viza Chat": "لوحة مطوّر Viza Chat",
"Masuk": "تسجيل الدخول",
"Masuk dengan Google": "الدخول بحساب Google",
"atau": "أو",
"Email": "البريد الإلكتروني",
"Password": "كلمة المرور",
"Hanya akun yang terdaftar yang bisa membuka panel ini.": "الحسابات المسجلة فقط يمكنها فتح هذه اللوحة.",
"Emoji": "رمز تعبيري",
"Hapus": "حذف",
"Edit": "تعديل",
"Salin": "نسخ",
"Simpan": "حفظ",
"Batal": "إلغاء",
"Aktif": "مفعّل",
"aktif": "مفعّل",
"nonaktif": "معطّل",
"Memuat…": "جارٍ التحميل…",
"Aksi": "إجراء",
"AKSI": "إجراء",
"Nama": "الاسم",
"NAMA": "الاسم",
"EMAIL": "البريد",
"Peran": "الدور",
"PERAN": "الدور",
"Status": "الحالة",
"STATUS": "الحالة",
"Waktu": "الوقت",
"WAKTU": "الوقت",
"Rincian": "التفاصيل",
"RINCIAN": "التفاصيل",
"Pratinjau": "معاينة",
"PRATINJAU": "معاينة",
"Slot": "الخانة",
"SLOT": "الخانة",
"Jenis": "النوع",
"JENIS": "النوع",
"Tautan": "الرابط",
"Harga": "السعر",
"HARGA": "السعر",
"Hari": "الأيام",
"Judul": "العنوان",
"JUDUL": "العنوان",
"Gambar": "الصورة",
"GAMBAR": "الصورة",
"Urutan": "الترتيب",
"Durasi (hari)": "المدة (أيام)",
"Aktifkan": "تفعيل",
"Tampilkan": "عرض",
"Tampil di aplikasi": "إظهار في التطبيق",
"Cabut": "سحب",
"Blokir": "حجب",
"Buka blokir": "إلغاء الحجب",
"Diblokir": "محجوب",
"terkunci": "مقفل",
"terbuka": "مفتوح",
"lihat": "عرض",
"tampil": "ظاهر",
"Tambah seller": "إضافة بائع",
"Tambah user": "إضافة مستخدم",
"Tambah user Viza": "إضافة مستخدم Viza",
"Tambah gift": "إضافة هدية",
"Tambah banner": "إضافة لافتة",
"Tambah stok": "إضافة رصيد",
"Stok": "الرصيد",
"Stok panel": "رصيد اللوحة",
"Stok coin staf": "رصيد عملات الموظف",
"Hapus dokumen": "حذف المستند",
"Jalankan": "تشغيل",
"Muat ulang": "إعادة التحميل",
"Cari nama atau UID…": "ابحث بالاسم أو UID…",
"Klik untuk memperbesar": "اضغط للتكبير",
"Nama tampilan": "الاسم المعروض",
"Nama item": "اسم العنصر",
"Nama game": "اسم اللعبة",
"Nama frame": "اسم الإطار",
"Nama lencana": "اسم الشارة",
"Nama gift": "اسم الهدية",
"Nama toko": "اسم المتجر",
"Nama admin": "اسم المشرف",
"Nama dan email wajib diisi": "الاسم والبريد مطلوبان",
"Subjudul": "العنوان الفرعي",
"Isi pengumuman (teks)": "نص الإعلان",
"Sematkan di atas": "تثبيت في الأعلى",
"Pengumuman": "إعلان",
"Isi dokumen (JSON)": "محتوى المستند (JSON)",
"Mode": "الوضع",
"Gelap": "داكن",
"Terang": "فاتح",
"Kotak": "مربع",
"Warna atas (hex)": "اللون الأعلى (hex)",
"Warna bawah (hex)": "اللون الأسفل (hex)",
"Daftarkan admin": "تسجيل مشرف",
"Pilih item": "اختر عنصرًا",
"Pilih item dulu": "اختر عنصرًا أولًا",
"Isi ID user dulu": "أدخل معرّف المستخدم أولًا",
"ID user tidak ditemukan": "معرّف المستخدم غير موجود",
"Pilih berkas atau isi tautan": "اختر ملفًا أو الصق رابطًا",
"ID unik": "معرّف فريد",
"Kunci akun": "قفل الحساب",
"Jual": "البيع",
"Tier": "المستوى",
"Tier VIP": "مستوى VIP",
"Jenis item": "نوع العنصر",
"Jenis media": "نوع الوسائط",
"Harga (koin)": "السعر (عملات)",
"Harga di Store (koin, opsional)": "سعر المتجر (عملات، اختياري)",
"Tampilkan juga di Store": "إظهار في المتجر أيضًا",
"Dijual di Store": "معروض في المتجر",
"Berlaku (hari)": "الصلاحية (أيام)",
"Durasi untuk user (hari)": "المدة للمستخدم (أيام)",
"Jumlah coin": "عدد العملات",
"Jumlah coin / diamond": "العملات / الألماس",
"Stok coin awal (opsional)": "رصيد العملات الابتدائي (اختياري)",
"Stok coin untuk kirim coin ke user": "رصيد العملات لإرسالها للمستخدمين",
"Item yang boleh dikirim (ID item, pisah koma)": "العناصر المسموح إرسالها (معرّفات مفصولة بفواصل)",
"Jabatan di APK (bukan akses panel)": "المنصب في التطبيق (ليس صلاحية اللوحة)",
"Boleh masuk panel": "يمكنه دخول اللوحة",
"Email untuk login": "بريد الدخول",
"Email untuk login panel": "بريد دخول اللوحة",
"Email login": "بريد الدخول",
"Password (opsional, dibuatkan akun login)": "كلمة المرور (اختياري، ينشئ حساب دخول)",
"Password minimal 6 karakter": "كلمة المرور 6 أحرف على الأقل",
"Nomer HP / WhatsApp": "الهاتف / واتساب",
"Manager dari admin (khusus admin, isi ID manager)": "مدير تحت مشرف (للمشرف فقط، أدخل معرّف المدير)",
"ID staf (angka)": "معرّف الموظف (رقم)",
"ID staf penerima stok (angka)": "معرّف الموظف المستلم (رقم)",
"ID user (angka)": "معرّف المستخدم (رقم)",
"ID user penerima": "معرّف المستخدم المستلم",
"UID atau ID angka user": "UID أو معرّف رقمي",
"ID user yang dijadikan Customer Service": "معرّف المستخدم لخدمة العملاء",
"Bet minimum": "أدنى رهان",
"Bet maksimum": "أعلى رهان",
"Pilihan chip": "خيارات الرقائق",
"Penanda": "علامة",
"Game terpasang": "الألعاب المثبتة",
"Game": "لعبة",
"Belum ada berkas": "لا ملفات بعد",
"Belum ada room.": "لا غرف بعد.",
"User terdaftar": "المستخدمون المسجلون",
"Kartu profil VIP (latar kartu)": "بطاقة ملف VIP (خلفية البطاقة)",
"Efek masuk": "تأثير الدخول",
"Banner": "لافتة",
"Lencana": "شارة",
"Medali": "ميدالية",
"Panel": "لوحة",
"Detail user": "تفاصيل المستخدم",
"Blokir user": "حجب المستخدم",
"Hapus room": "حذف الغرفة",
"Hapus gift": "حذف الهدية",
"Hapus banner": "حذف اللافتة",
"Tutup dan hapus room ini? Tindakan ini langsung terasa di aplikasi.": "إغلاق وحذف هذه الغرفة؟ يظهر الأثر فورًا في التطبيق.",
"Hapus gift ini dari katalog?": "حذف هذه الهدية من الكتالوج؟",
"Hapus banner ini?": "حذف هذه اللافتة؟",
"Room dihapus": "تم حذف الغرفة",
"Gift dihapus": "تم حذف الهدية",
"Gift disimpan": "تم حفظ الهدية",
"Banner dihapus": "تم حذف اللافتة",
"Nama gift wajib diisi": "اسم الهدية مطلوب",
"Akun dibuat": "تم إنشاء الحساب",
"Aktifkan CS": "تفعيل خدمة العملاء",
"Cabut CS": "سحب خدمة العملاء",
"Tulis pengumuman di sini": "اكتب الإعلان هنا",
"Unknown": "غير معروف",
"Tersimpan": "تم الحفظ",
"Tidak ada data": "لا بيانات",
"ya": "نعم",
"tidak": "لا",
"Kabur": "إغلاق",
"Keluar": "خروج",
"Bahasa": "اللغة",
"Pilih bahasa": "اختر اللغة"
},
"zh": {

"Ganti bahasa": "切换语言",
"Simpan perubahan": "保存更改",
"ubah": "编辑",
"Menyimpan…": "正在保存…",
"Menghapus…": "正在删除…",
"Dihapus": "已删除",
"Terhapus. Slotnya siap diisi ulang": "已删除。位置可以重新上传",
"Jual lagi": "重新上架",
"Tarik dari Store": "从商店下架",
"Dashboard": "仪表盘",
"User": "用户",
"Room": "房间",
"Gift": "礼物",
"Frame & banner": "头像框与横幅",
"Frame &amp; banner": "头像框与横幅",
"Aset & VIP": "资产与VIP",
"Aset &amp; VIP": "资产与VIP",
"Katalog game": "游戏目录",
"Pasang game": "安装游戏",
"Bet game": "游戏下注",
"Database": "数据库",
"Log admin": "管理员日志",
"Pengaturan": "设置",
"Staf & seller": "员工与卖家",
"Staf &amp; seller": "员工与卖家",
"Coin & reset": "金币与重置",
"Coin &amp; reset": "金币与重置",
"Kirim ke user": "发送给用户",
"Customer Service": "客服",
"Pengumuman resmi": "官方公告",
"Aset di VPS": "VPS 资产",
"Background tab": "标签背景",
"HOME": "首页",
"KELOLA": "管理",
"GAME": "游戏",
"DATA": "数据",
"CONFIG": "配置",
"Viza Panel": "Viza 面板",
"Panel developer Viza Chat": "Viza Chat 开发者面板",
"Masuk": "登录",
"Masuk dengan Google": "使用 Google 登录",
"atau": "或",
"Email": "邮箱",
"Password": "密码",
"Hanya akun yang terdaftar yang bisa membuka panel ini.": "只有已注册的账户才能打开此面板。",
"Emoji": "表情",
"Hapus": "删除",
"Edit": "编辑",
"Salin": "复制",
"Simpan": "保存",
"Batal": "取消",
"Aktif": "启用",
"aktif": "启用",
"nonaktif": "停用",
"Memuat…": "加载中…",
"Aksi": "操作",
"AKSI": "操作",
"Nama": "名称",
"NAMA": "名称",
"EMAIL": "邮箱",
"Peran": "角色",
"PERAN": "角色",
"Status": "状态",
"STATUS": "状态",
"Waktu": "时间",
"WAKTU": "时间",
"Rincian": "详情",
"RINCIAN": "详情",
"Pratinjau": "预览",
"PRATINJAU": "预览",
"Slot": "位置",
"SLOT": "位置",
"Jenis": "类型",
"JENIS": "类型",
"Tautan": "链接",
"Harga": "价格",
"HARGA": "价格",
"Hari": "天数",
"Judul": "标题",
"JUDUL": "标题",
"Gambar": "图片",
"GAMBAR": "图片",
"Urutan": "顺序",
"Durasi (hari)": "时长（天）",
"Aktifkan": "启用",
"Tampilkan": "显示",
"Tampil di aplikasi": "在应用中显示",
"Cabut": "撤销",
"Blokir": "封禁",
"Buka blokir": "解除封禁",
"Diblokir": "已封禁",
"terkunci": "已锁定",
"terbuka": "开放",
"lihat": "查看",
"tampil": "显示",
"Tambah seller": "添加卖家",
"Tambah user": "添加用户",
"Tambah user Viza": "添加 Viza 用户",
"Tambah gift": "添加礼物",
"Tambah banner": "添加横幅",
"Tambah stok": "添加库存",
"Stok": "库存",
"Stok panel": "面板库存",
"Stok coin staf": "员工金币库存",
"Hapus dokumen": "删除文档",
"Jalankan": "运行",
"Muat ulang": "重新加载",
"Cari nama atau UID…": "搜索名称或 UID…",
"Klik untuk memperbesar": "点击放大",
"Nama tampilan": "显示名称",
"Nama item": "项目名称",
"Nama game": "游戏名称",
"Nama frame": "头像框名称",
"Nama lencana": "徽章名称",
"Nama gift": "礼物名称",
"Nama toko": "店铺名称",
"Nama admin": "管理员名称",
"Nama dan email wajib diisi": "名称和邮箱为必填项",
"Subjudul": "副标题",
"Isi pengumuman (teks)": "公告内容",
"Sematkan di atas": "置顶",
"Pengumuman": "公告",
"Isi dokumen (JSON)": "文档内容（JSON）",
"Mode": "模式",
"Gelap": "深色",
"Terang": "浅色",
"Kotak": "方形",
"Warna atas (hex)": "顶部颜色（hex）",
"Warna bawah (hex)": "底部颜色（hex）",
"Daftarkan admin": "注册管理员",
"Pilih item": "选择项目",
"Pilih item dulu": "请先选择项目",
"Isi ID user dulu": "请先输入用户 ID",
"ID user tidak ditemukan": "未找到用户 ID",
"Pilih berkas atau isi tautan": "选择文件或填写链接",
"ID unik": "唯一 ID",
"Kunci akun": "绑定账户",
"Jual": "售卖",
"Tier": "等级",
"Tier VIP": "VIP 等级",
"Jenis item": "项目类型",
"Jenis media": "媒体类型",
"Harga (koin)": "价格（金币）",
"Harga di Store (koin, opsional)": "商店价格（金币，可选）",
"Tampilkan juga di Store": "同时在商店显示",
"Dijual di Store": "在商店售卖",
"Berlaku (hari)": "有效期（天）",
"Durasi untuk user (hari)": "用户时长（天）",
"Jumlah coin": "金币数量",
"Jumlah coin / diamond": "金币 / 钻石",
"Stok coin awal (opsional)": "初始金币库存（可选）",
"Stok coin untuk kirim coin ke user": "给用户发送金币的库存",
"Item yang boleh dikirim (ID item, pisah koma)": "允许发送的项目（ID 用逗号分隔）",
"Jabatan di APK (bukan akses panel)": "应用内职位（不是面板权限）",
"Boleh masuk panel": "可登录面板",
"Email untuk login": "登录邮箱",
"Email untuk login panel": "面板登录邮箱",
"Email login": "登录邮箱",
"Password (opsional, dibuatkan akun login)": "密码（可选，将创建登录账户）",
"Password minimal 6 karakter": "密码至少 6 个字符",
"Nomer HP / WhatsApp": "电话 / WhatsApp",
"Manager dari admin (khusus admin, isi ID manager)": "管理员下的经理（仅管理员，填写经理 ID）",
"ID staf (angka)": "员工 ID（数字）",
"ID staf penerima stok (angka)": "接收库存的员工 ID（数字）",
"ID user (angka)": "用户 ID（数字）",
"ID user penerima": "接收用户 ID",
"UID atau ID angka user": "UID 或数字用户 ID",
"ID user yang dijadikan Customer Service": "设为客服的用户 ID",
"Bet minimum": "最低下注",
"Bet maksimum": "最高下注",
"Pilihan chip": "筹码选项",
"Penanda": "标记",
"Game terpasang": "已安装游戏",
"Game": "游戏",
"Belum ada berkas": "还没有文件",
"Belum ada room.": "还没有房间。",
"User terdaftar": "已注册用户",
"Kartu profil VIP (latar kartu)": "VIP 个人卡（卡片背景）",
"Efek masuk": "入场特效",
"Banner": "横幅",
"Lencana": "徽章",
"Medali": "奖牌",
"Panel": "面板",
"Detail user": "用户详情",
"Blokir user": "封禁用户",
"Hapus room": "删除房间",
"Hapus gift": "删除礼物",
"Hapus banner": "删除横幅",
"Tutup dan hapus room ini? Tindakan ini langsung terasa di aplikasi.": "关闭并删除此房间？应用中会立即生效。",
"Hapus gift ini dari katalog?": "从目录中删除此礼物？",
"Hapus banner ini?": "删除此横幅？",
"Room dihapus": "房间已删除",
"Gift dihapus": "礼物已删除",
"Gift disimpan": "礼物已保存",
"Banner dihapus": "横幅已删除",
"Nama gift wajib diisi": "礼物名称为必填项",
"Akun dibuat": "账户已创建",
"Aktifkan CS": "启用客服",
"Cabut CS": "撤销客服",
"Tulis pengumuman di sini": "在此填写公告",
"Unknown": "未知",
"Tersimpan": "已保存",
"Tidak ada data": "暂无数据",
"ya": "是",
"tidak": "否",
"Kabur": "关闭",
"Keluar": "退出",
"Bahasa": "语言",
"Pilih bahasa": "选择语言"
}
};

/* Indonesia adalah teks asli panel, jadi tidak punya kamus sendiri. */
const DAFTAR_BAHASA = ["id", "en", "ar", "zh"];
const NAMA_BAHASA = { id: "Indonesia", en: "English", ar: "العربية", zh: "中文" };
const KUNCI_SIMPAN = "viza-bahasa";
let bahasa = "id";
try { bahasa = localStorage.getItem(KUNCI_SIMPAN) || localStorage.getItem("rezo-bahasa") || "id"; } catch (e) { /* mode privat */ }
if (!DAFTAR_BAHASA.includes(bahasa)) bahasa = "id";

const terjemah = (teks) => {
  if (bahasa === "id") return null;
  const t = String(teks).trim();
  if (!t) return null;
  const pas = (b) => {
    const peta = PETA_NORMAL[b] || {};
    const n = normal(t);
    return Object.prototype.hasOwnProperty.call(peta, n) ? peta[n] : null;
  };
  // Remah judul "Dashboard / Cek in harian": terjemahkan bagian sesudah garis miring.
  const remah = t.match(/^Dashboard \/ (.+)$/);
  if (remah) {
    const ekor = String(remah[1]).trim();
    const cari = (b) => {
      const peta = PETA_NORMAL[b] || {};
      return Object.prototype.hasOwnProperty.call(peta, normal(ekor)) ? peta[normal(ekor)] : null;
    };
    const ekorTerj = cari(bahasa) || (bahasa !== "en" ? cari("en") : null);
    if (ekorTerj) return "Dashboard / " + ekorTerj;
  }
  const utama = pas(bahasa);
  if (utama) return utama;
  // Bahasa Arab dan China belum lengkap: pakai padanan Inggris daripada
  // membiarkan teks Indonesia.
  if (bahasa !== "en") {
    const ing = pas("en");
    if (ing) return ing;
  }
  // Pola juga dipakai untuk Arab/China supaya tidak ada teks Indonesia tersisa.
  for (const [cocok, ganti] of POLA) {
    const m = t.match(cocok);
    if (!m) continue;
    let hasil = ganti;
    m.slice(1).forEach((bagian, i) => {
      const isi = bagian && terjemahKata(bagian);
      hasil = hasil.split("$" + (i + 1)).join(isi || bagian || "");
    });
    return hasil;
  }
  // Lapis terakhir: teks campuran yang tidak ada di kamus mana pun.
  if (!/[@:\/]{2}|@|https?:/.test(t)) {
    const kata = terjemahKata(t);
    if (kata) return kata;
  }
  return null;
};


/* ====== Tambahan kamus (halaman Cek in harian dan teks yang dulu terlewat) ====== */
const TAMBAHAN = {
"en": {
"dicabut ✅": "revoked ✅",
"tidak ditemukan": "not found",
"· akun login dibuat": "· login account created",
"AKTIF": "ACTIVE",
"Admin dihapus": "Admin removed",
"Akses diaktifkan": "Access enabled",
"Akses dicabut": "Access revoked",
"Akses dihapus": "Access removed",
"Aktifkan admin": "Enable admin",
"Alamat disalin": "Address copied",
"Aset VIP disimpan": "VIP asset saved",
"Atur bet": "Set bet",
"Atur hadiah cek in harian hari 1 sampai 7 yang tampil di aplikasi": "Set the daily check-in rewards for days 1 to 7 shown in the app",
"Atur nilai bet tiap game": "Set the bet value for each game",
"BELUM DIATUR": "NOT SET",
"Banner beranda dan bingkai profil": "Home banner and profile frame",
"Banner disimpan": "Banner saved",
"Banner masuk": "Entry banner",
"Belum ada berkas yang dipilih": "No file chosen yet",
"Belum ada staf. Kirim panel ke user di atas.": "No staff yet. Send the panel to a user above.",
"Belum login": "Not signed in",
"Berkas dihapus": "File deleted",
"Berkas tidak bisa dibaca": "File cannot be read",
"Bilah bawah": "Bottom bar",
"Buat & kirim ke user": "Create & send to user",
"Buka menu": "Open menu",
"Cabut Customer Service? Chat CS tidak akan sampai ke akun mana pun.": "Revoke Customer Service? CS chats will reach no account.",
"Cabut admin": "Revoke admin",
"Cabut panel": "Revoke panel",
"Cabut panel user ini?": "Revoke this user's panel?",
"Cek in harian": "Daily check-in",
"Cek in harian tersimpan": "Daily check-in saved",
"Customer Service dicabut": "Customer Service revoked",
"Daftar room aktif dan tombol tutup room": "Active rooms with close-room buttons",
"Daftarkan admin panel dan atur aksesnya": "Register panel admins and manage their access",
"Dokumen dihapus": "Document deleted",
"Dokumen disimpan": "Document saved",
"Domain panel ini belum diizinkan di Firebase Authentication.": "This panel domain is not yet allowed in Firebase Authentication.",
"Edit aset VIP": "Edit VIP asset",
"Edit banner": "Edit banner",
"Edit frame": "Edit frame",
"Edit gift": "Edit gift",
"Edit item": "Edit item",
"Edit item toko": "Edit store item",
"Edit pengumuman": "Edit announcement",
"Edit seller": "Edit seller",
"Edit staf": "Edit staff",
"Efek masuk room": "Room entry effect",
"Email atau password salah.": "Wrong email or password.",
"Frame dihapus": "Frame deleted",
"Frame disimpan": "Frame saved",
"Gagal masuk.": "Sign-in failed.",
"Game dihapus": "Game deleted",
"Game yang sudah terpasang": "Installed games",
"Gelar": "Title",
"Gelembung chat": "Chat bubble",
"Hapus admin": "Remove admin",
"Hapus akses web panel untuk akun ini?": "Remove web panel access for this account?",
"Hapus berkas ini dari VPS?": "Delete this file from the VPS?",
"Hapus frame ini?": "Delete this frame?",
"Hapus game": "Delete game",
"Hapus game ini dari daftar?": "Delete this game from the list?",
"Hapus pengaturan bet ini?": "Delete this bet setting?",
"Hapus pengumuman": "Delete announcement",
"Hapus seller": "Remove seller",
"Hapus seller ini dari daftar dompet?": "Remove this seller from the wallet list?",
"Hapus staf panel": "Remove panel staff",
"Isi email dan password dulu.": "Fill in email and password first.",
"Isi jumlah coin": "Enter the coin amount",
"Item dijual lagi di Store": "Item sold in the Store again",
"Item disimpan": "Item saved",
"Item ditarik dari Store": "Item pulled from the Store",
"Item terkirim": "Item sent",
"JSON tidak valid": "Invalid JSON",
"Jaringan terputus saat mengunggah": "Connection lost while uploading",
"Jual item di Store": "Sell item in the Store",
"Katalog gift yang tampil di aplikasi": "Gift catalogue shown in the app",
"Kelola gift": "Manage gifts",
"Kelola room": "Manage rooms",
"Kelola user": "Manage users",
"Kirim item": "Send item",
"Kirim lencana": "Send badge",
"Lencana dibuat dan dikirim": "Badge created and sent",
"Lepas official": "Remove official tag",
"Lepas semat": "Unpin",
"Lepas semat room": "Unpin room",
"Membuka Google…": "Opening Google…",
"Memeriksa…": "Checking…",
"Memproses…": "Processing…",
"Memuat stok…": "Loading stock…",
"Mengirim…": "Sending…",
"Menjalankan…": "Running…",
"Nama dan alamat game wajib diisi": "Game name and address are required",
"Nama diganti menjadi Unknown.": "Name changed to Unknown.",
"Nama game wajib diisi": "Game name is required",
"Nama item wajib diisi": "Item name is required",
"Nama lencana wajib diisi": "Badge name is required",
"Nolkan stok coin staf ini?": "Reset this staff member's coin stock to zero?",
"Nonaktifkan": "Deactivate",
"Pengaturan bet disimpan": "Bet setting saved",
"Pengguna tanpa nama": "Unnamed user",
"Pengumuman baru": "New announcement",
"Pengumuman dihapus": "Announcement deleted",
"Pengumuman disimpan": "Announcement saved",
"Periksa koneksi lalu muat ulang.": "Check your connection and reload.",
"Perintah dijalankan": "Command executed",
"Pilih berkas atau isi tautan dulu": "Choose a file or enter a link first",
"Pilih gambar atau isi tautan dulu": "Choose an image or enter a link first",
"Popup diblokir browser. Izinkan popup lalu coba lagi.": "Popup blocked by the browser. Allow popups and try again.",
"Progres": "Progress",
"Reset foto": "Reset photo",
"Reset nama": "Reset name",
"Riwayat aksi yang dilakukan admin": "History of actions taken by admins",
"Room disematkan paling atas": "Room pinned to the top",
"Seller dihapus": "Seller removed",
"Seller disimpan": "Seller saved",
"Semat dilepas": "Pin removed",
"Sematkan": "Pin",
"Sematkan room": "Pin room",
"Sembunyikan": "Hide",
"Sembunyikan yang sudah dicabut": "Hide revoked ones",
"Semua staf sudah dicabut.": "All staff revoked.",
"Simpan aset VIP": "Save VIP asset",
"Staf disimpan": "Staff saved",
"Status seller diubah": "Seller status changed",
"Stok coin seller": "Seller coin stock",
"Stok disimpan": "Stock saved",
"Stok item staf": "Staff item stock",
"Stok seller": "Seller stock",
"Stok seller diperbarui": "Seller stock updated",
"Stok staf ini masih kosong.": "This staff member's stock is still empty.",
"Tab Family": "Family tab",
"Tab Moment": "Moment tab",
"Tab Party": "Party tab",
"Tab Saya": "My tab",
"Tag official": "Official tag",
"Tag official dilepas": "Official tag removed",
"Tag official dipasang": "Official tag added",
"Tambah aset VIP": "Add VIP asset",
"Tambah frame": "Add frame",
"Tambah game baru dengan alamat dan key production": "Add a new game with its address and production key",
"Tambah item toko": "Add store item",
"Tambah staf": "Add staff",
"Tambah staf dan seller yang boleh masuk panel": "Add staff and sellers allowed into the panel",
"Tampilkan yang sudah dicabut": "Show revoked ones",
"Tarik item dari Store": "Pull item from the Store",
"Tautan disalin": "Link copied",
"Terlalu banyak percobaan. Tunggu beberapa menit.": "Too many attempts. Wait a few minutes.",
"Toko Coin Contoh": "Sample Coin Shop",
"Ubah dokumen": "Edit document",
"diblokir admin panel": "blocked by admin panel",
"latar menu tab di bagian bawah": "bottom tab bar background",
"layar belakang Family": "Family screen background",
"layar belakang Moment": "Moment screen background",
"layar belakang beranda Party": "Party home background",
"layar belakang daftar chat": "chat list background",
"layar belakang profil Saya": "My profile background",
"mis. frame-fox": "e.g. frame-fox",
"minimal 6 karakter": "at least 6 characters",
"semua user": "all users",
"tidak ada": "none",
"tidak ada jawaban": "no answer",
"tidak diizinkan rules": "not allowed by the rules",
"tidak diketahui": "unknown",
"tag aktif": "active",
"tag blokir": "block",
"DICABUT": "REVOKED",
"Manager": "Manager",
"Avatar": "Avatar",
"Pra": "Pre",
"Siap": "Ready",
"Viza Panel siap · project": "Viza Panel ready · project",
"Jabatan": "Position",
"Julukan": "Nickname",
"Mawar": "Rose",
"ID": "ID",
"Coin": "Coin",
"Item": "Item",
"Hadiah": "Reward",
"Tutup": "Close",
"Kirim": "Send",
"Ubah": "Edit",
"Cari": "Search",
"Tanggal": "Date",
"Catatan": "Note"
}
};

Object.keys(TAMBAHAN).forEach((b) => {
  KAMUS[b] = Object.assign({}, KAMUS[b] || {}, TAMBAHAN[b]);
});
/* Tambahan kedua: sisa teks panel yang belum punya padanan. */
Object.assign(KAMUS.en, {
  "VPS berkas": "VPS files",
  "VPS database": "VPS database",
  "Hapus aset vipConfig": "Delete vipConfig asset",
  "pemutar SVGA gagal dimuat": "SVGA player failed to load",
  "mengunggah 0%": "uploading 0%",
  "selesai diunggah": "upload finished",
  "pesan info": "info message",
  "milik user ini?": "belonging to this user?",
  "lepas semat ": "unpin ",
  "dikirim ke ID ": "sent to ID ",
  "Hadiah hari ": "Day ",
  "Kirim panel ": "Send panel ",
  "Panel ID ": "Panel ID ",
  "Stok coin ID ": "Coin stock ID ",
  "Stok panel ": "Panel stock ",
  "User dengan ID ": "User with ID ",
  "Customer Service aktif untuk ID ": "Customer Service active for ID ",
  "Item masuk ke stok ID ": "Item added to stock ID ",
  "Foto profil diganti ke foto bawaan ": "Profile photo reset to the default ",
  "Background · ": "Background · ",
  "Cabut panel ": "Revoke panel ",
  "· stok ": "· stock ",
  "· akun login dibuat": "· login account created"
});


/* Teks yang mengandung angka atau nama tidak bisa dicocokkan persis,
   jadi diterjemahkan lewat pola. */
const POLA = [
  [/^Hadiah hari (\d+)$/, "Day $1 reward"],
  [/^Hari (\d+)$/, "Day $1"],
  [/^Lencana (.+)$/, "Badge $1"],
  [/^Stok coin ID (.+)$/, "Coin stock ID $1"],
  [/^Stok coin (.+)$/, "Coin stock $1"],
  [/^Stok panel (.+)$/, "Panel stock $1"],
  [/^Panel ID (.+)$/, "Panel ID $1"],
  [/^Kirim panel (.+)$/, "Send panel $1"],
  [/^Item masuk ke stok ID (.+)$/, "Item added to stock ID $1"],
  [/^Customer Service aktif untuk ID (.+)$/, "Customer Service active for ID $1"],
  [/^dikirim ke ID (.+)$/, "sent to ID $1"],
  [/^User dengan ID (.+)$/, "User with ID $1"],
  [/^Foto profil diganti ke foto bawaan (.+)$/, "Profile photo reset to the default $1"],
  [/^Wallet (.+)$/, "Wallet $1"],
  [/^Background (.+)$/, "Background $1"],
  [/^Cabut panel (.+)\?$/, "Revoke panel for $1?"],
  [/^· stok (.+)$/, "· stock $1"],
  [/^· akun login: (.+)$/, "· login account: $1"]
];

/* Cari padanan: kamus bahasa aktif, lalu kamus Inggris sebagai cadangan,
   lalu pola. Huruf besar-kecil dan spasi berlebih diabaikan. */
const normal = (t) => String(t).replace(/\s+/g, " ").trim().toLowerCase();
const PETA_NORMAL = {};
Object.keys(KAMUS).forEach((b) => {
  PETA_NORMAL[b] = {};
  Object.keys(KAMUS[b]).forEach((k) => { PETA_NORMAL[b][normal(k)] = KAMUS[b][k]; });
});


/* ====== Tambahan ketiga: kalimat sisa + penerjemah per kata ====== */
Object.assign(KAMUS.en, {
  "Admin terdaftar. Dia bisa langsung masuk dengan email dan password itu.": "Admin registered. They can sign in right away with that email and password.",
  "Langsung hilang dari aplikasi.": "Removed from the app immediately.",
  "Belum ada pengaturan bet": "No bet settings yet",
  "Gagal memuat daftar seller": "Failed to load the seller list",
  "Gagal memuat roomsPub": "Failed to load roomsPub",
  "Game terdaftar:": "Registered games:",
  "tanpa judul": "untitled",
  "tanpa nama": "unnamed",
  "Diaktifkan": "Enabled",
  "dipasang": "installed",
  "gagal": "failed",
  "tersimpan": "saved",
  "koin": "coins",
  "sekarang": "now",
  "terkirim, berlaku": "sent, valid",
  "hari.": "days.",
  "· stok": "· stock",
  "· akun login:": "· login account:",
  "✅ (muncul di tab Saya)": "✅ (appears on the My tab)",
  "foto yang dibaca profil publik,": "the photo the public profile reads,",
  "stok coin ditambahkan": "coin stock added",
  "main yang dibaca aplikasi": "main one read by the app",
  "Masuk sebagai": "Signed in as",
  "Tambahkan": "Add",
  "Hapus semua": "Delete all",
  "Salin tautan": "Copy link",
  "Unggah": "Upload",
  "Pilih": "Choose",
  "Kirim ke": "Send to",
  "Ubah peran": "Change role",
  "Belum ada data.": "No data yet.",
  "Tidak ada": "None",
  "Selesai": "Done",
  "Berhasil": "Success",
  "Periksa lagi": "Check again",
  "Masa aktif": "Duration",
  "Berlaku": "Valid",
  "Selesai pada": "Ends on",
  "Tidak aktif": "Inactive",
  "Ya": "Yes",
  "Tidak": "No",
  "Buka": "Open",
  "Kembali": "Back",
  "Lanjut": "Continue",
  "Pilih semua": "Select all",
  "Hapus pilihan": "Delete selection",
  "Kirim ulang": "Resend",
  "Atur ulang": "Reset",
  "Nama lengkap": "Full name",
  "Nomor WhatsApp": "WhatsApp number",
  "Jumlah": "Amount",
  "Harga jual": "Selling price",
  "Peran panel": "Panel role",
  "Jabatan di APK": "Position in the APK",
  "Tidak ada jabatan": "No position",
  "Coin awal": "Starting coins",
  "Stok item": "Item stock",
  "Stok coin": "Coin stock",
  "Reset stok": "Reset stock",
  "Status akun": "Account status",
  "Terakhir masuk": "Last sign-in",
  "Dibuat": "Created",
  "Diperbarui": "Updated",
  "Pemilik": "Owner",
  "Pengelola": "Manager",
  "Penjual": "Seller",
  "Staf": "Staff",
  "Latar": "Background",
  "Katalog": "Catalogue",
  "Riwayat": "History",
  "Akun": "Account",
  "Keluar dari panel": "Sign out of the panel",
  "Masuk ke panel": "Sign in to the panel",
  "Alamat email": "Email address",
  "Kata sandi": "Password",
  "Lupa kata sandi?": "Forgot password?",
  "Belum punya akun?": "No account yet?",
  "Nyala": "On",
  "Mati": "Off",
  "Disembunyikan": "Hidden",
  "Di sembunyikan": "Hidden",
  "Semua user": "All users",
  "Tanpa batas": "Unlimited",
  "Tidak terbatas": "Unlimited",
  "Hadiah hari ke": "Reward for day",
  "Hari ke": "Day",
  "Coin per hari": "Coins per day",
  "Item per hari": "Item per day",
  "VIP per hari": "VIP per day",
  "Masa VIP": "VIP duration",
  "Masa item": "Item duration",
  "Target hari": "Target days",
  "Hitungan hari": "Day count"
});

/* Kamus kata: dipakai saat sebuah teks mengandung nama atau angka sehingga
   tidak pernah cocok persis. Kata yang tidak dikenal (nama orang, ID) dibiarkan. */
const KATA = {"dan": "and","atau": "or","yang": "that","ini": "this","itu": "that","sudah": "already","belum": "not yet","akan": "will","ke": "to","dari": "from","di": "in","untuk": "for","dengan": "with","tidak": "not","semua": "all","lagi": "again","baru": "new","bisa": "can","ada": "available","juga": "also","saja": "only","hari": "day","jam": "hour","menit": "minute","koin": "coins","coin": "coin","user": "user","pengguna": "user","panel": "panel","stok": "stock","game": "game","hapus": "delete","kirim": "send","simpan": "save","tambah": "add","edit": "edit","atur": "set","aktif": "active","nonaktif": "inactive","cabut": "revoke","blokir": "block","pasang": "install","lihat": "view","cari": "search","muat": "load","gagal": "failed","berhasil": "successful","tersimpan": "saved","disimpan": "saved","dihapus": "deleted","diubah": "changed","diaktifkan": "enabled","dinonaktifkan": "disabled","dicabut": "revoked","dipasang": "installed","dikirim": "sent","dibuat": "created","diperbarui": "updated","dibaca": "read","dirubah": "changed","nama": "name","alamat": "address","email": "email","sandi": "password","nomor": "number","jumlah": "amount","harga": "price","masa": "duration","berlaku": "valid","sampai": "until","mulai": "start","akhir": "end","status": "status","peran": "role","jabatan": "position","akun": "account","login": "login","masuk": "sign in","keluar": "sign out","daftar": "list","riwayat": "history","log": "log","data": "data","dokumen": "document","berkas": "file","gambar": "image","video": "video","tautan": "link","ukuran": "size","jenis": "type","urutan": "order","slot": "slot","target": "target","hadiah": "reward","minggu": "week","bulan": "month","tahun": "year","kali": "times","sekali": "once","selesai": "finished","proses": "process","memproses": "processing","memuat": "loading","mengirim": "sending","menjalankan": "running","memeriksa": "checking","membuka": "opening","menunggu": "waiting","pilih": "choose","isi": "enter","kosong": "empty","penuh": "full","benar": "correct","salah": "wrong","wajib": "required","opsional": "optional","lama": "old","kecil": "small","besar": "large","utama": "main","kedua": "second","pertama": "first","terakhir": "last","selanjutnya": "next","sebelumnya": "previous","atas": "top","bawah": "bottom","kiri": "left","kanan": "right","depan": "front","belakang": "background","tengah": "center","terang": "light","gelap": "dark","warna": "colour","tulisan": "text","teks": "text","pesan": "message","info": "info","catatan": "note","keterangan": "description","kunci": "key","nilai": "value","hasil": "result","total": "total","persen": "percent","progres": "progress","antre": "queue","antrian": "queue","room": "room","ruang": "room","gift": "gift","bingkai": "frame","lencana": "badge","medali": "medal","banner": "banner","efek": "effect","gelembung": "bubble","kartu": "card","aset": "asset","toko": "store","katalog": "catalogue","pengumuman": "announcement","latar": "background","tab": "tab","seller": "seller","staf": "staff","pemilik": "owner","pengelola": "manager","penjual": "seller","admin": "admin","developer": "developer","pelanggan": "customer","layanan": "service","bantuan": "help","pengaturan": "settings","sistem": "system","server": "server","jaringan": "network","koneksi": "connection","domain": "domain","izin": "permission","akses": "access","password": "password","kode": "code","api": "api","proyek": "project","basis": "base","koleksi": "collection","tabel": "table","tombol": "button","menu": "menu","halaman": "page","judul": "title","subjudul": "subtitle","baris": "row","kolom": "column","pilihan": "option","opsi": "option","tanggal": "date","waktu": "time","durasi": "duration","detik": "second","selamanya": "forever","buka": "open","tutup": "close","batal": "cancel","salin": "copy","tempel": "paste","unduh": "download","unggah": "upload","perbarui": "update","segarkan": "refresh","reset": "reset","bersihkan": "clear","kosongkan": "empty","tampilkan": "show","sembunyikan": "hide","aktifkan": "enable","nonaktifkan": "disable","izinkan": "allow","tolak": "decline","setujui": "approve","verifikasi": "verify","terima": "receive","beli": "buy","jual": "sell","bayar": "pay","topup": "top up","tarik": "pull","kurangi": "reduce","ubah": "change","ganti": "replace","pindah": "move","cetak": "print","coba": "try","periksa": "check","pastikan": "make sure","gunakan": "use","pakai": "use","butuh": "need","perlu": "need","harus": "must","dapat": "can","mau": "want","ingin": "want","suka": "like","boleh": "may","mudah": "easy","sulit": "hard","cepat": "fast","lambat": "slow","banyak": "many","sedikit": "few","kurang": "less","lebih": "more","sama": "same","berbeda": "different","penting": "important","aman": "safe","bahaya": "danger","bagus": "good","jelek": "bad","kualitas": "quality","contoh": "example","misal": "e.g.","lain": "other","lainnya": "others","tersebut": "the","secara": "by","tanpa": "without","antara": "between","setiap": "every","masing": "each","beberapa": "several","sebuah": "a","para": "the","anda": "you","kamu": "you","kami": "we","kita": "we","mereka": "they","dia": "they","saya": "I","apakah": "is","bagaimana": "how","kapan": "when","dimana": "where","mengapa": "why","berapa": "how many","siapa": "who","mana": "which","sedang": "currently","masih": "still","pernah": "ever","hanya": "only","pula": "too","bahkan": "even","sangat": "very","sekitar": "about","kira": "about","paling": "most","terlalu": "too","hampir": "almost"};


/* Frasa pendek yang sering menempel pada nama/angka, dirapikan lebih dulu
   supaya susunan katanya enak dibaca. */
const GANTI_FRASA = [
  [/\bke user ini\b/gi, "to this user"],
  [/\buntuk user ini\b/gi, "for this user"],
  [/\buntuk akun ini\b/gi, "for this account"],
  [/\bdi aplikasi\b/gi, "in the app"],
  [/\bke aplikasi\b/gi, "to the app"],
  [/\bdari aplikasi\b/gi, "from the app"],
  [/\bsudah disimpan\b/gi, "saved"],
  [/\bsudah dikirim\b/gi, "sent"],
  [/\bbelum ada\b/gi, "no"],
  [/\bsemua user\b/gi, "all users"],
  [/\bdi tab\b/gi, "on the tab"],
  [/\bhari ini\b/gi, "today"],
  [/\bjam lalu\b/gi, "hours ago"],
  [/\bhari lalu\b/gi, "days ago"],
  [/\bmenit lalu\b/gi, "minutes ago"],
  [/\bpengumuman resmi\b/gi, "official announcements"],
  [/\bseller baru\b/gi, "new seller"],
  [/\bstaf baru\b/gi, "new staff"],
  [/\bgame baru\b/gi, "new game"],
  [/\buser baru\b/gi, "new user"],
  [/\bakun baru\b/gi, "new account"],
  [/\blencana baru\b/gi, "new badge"],
  [/\broom baru\b/gi, "new room"],
  [/\bgift baru\b/gi, "new gift"],
  [/\bframe baru\b/gi, "new frame"],
  [/\bitem baru\b/gi, "new item"],
  [/\btab Party\b/gi, "Party tab"],
  [/\btab Moment\b/gi, "Moment tab"],
  [/\btab Family\b/gi, "Family tab"],
  [/\bcek in harian\b/gi, "daily check-in"],
  [/\bstok coin\b/gi, "coin stock"],
  [/\bjumlah coin\b/gi, "coin amount"],
  [/\bakun login\b/gi, "sign-in account"]
];

Object.assign(KATA, {"to": "to", "the": "the", "this": "this", "that": "that", "for": "for", "in": "in", "of": "of", "and": "and", "or": "or", "is": "is", "are": "are", "not": "not", "all": "all", "new": "new", "saved": "saved", "sent": "sent", "no": "no", "today": "today", "official": "official", "announcement": "announcement", "announcements": "announcements", "user": "user", "users": "users", "stock": "stock", "coin": "coin", "coins": "coins", "panel": "panel", "send": "send", "delete": "delete", "edit": "edit", "save": "save", "add": "add", "set": "set", "day": "day", "days": "days", "reward": "reward", "active": "active", "revoked": "revoked", "enabled": "enabled", "failed": "failed", "none": "none", "copy": "copy", "upload": "upload", "download": "download", "search": "search", "view": "view", "open": "open", "close": "close", "cancel": "cancel", "back": "back", "continue": "continue", "yes": "yes", "block": "block", "unblock": "unblock", "revoke": "revoke", "install": "install", "pin": "pin", "unpin": "unpin", "hide": "hide", "show": "show", "enable": "enable", "disable": "disable", "reset": "reset", "role": "role", "position": "position", "account": "account", "amount": "amount", "price": "price", "duration": "duration", "status": "status", "name": "name", "email": "email", "password": "password", "number": "number", "link": "link", "file": "file", "image": "image", "video": "video", "size": "size", "type": "type", "order": "order", "target": "target", "owner": "owner", "manager": "manager", "seller": "seller", "staff": "staff", "admin": "admin", "badge": "badge", "frame": "frame", "gift": "gift", "games": "games", "rooms": "rooms", "room": "room", "store": "store", "background": "background", "settings": "settings", "history": "history", "log": "log", "data": "data", "document": "document", "customer": "customer", "service": "service", "access": "access", "permission": "permission", "code": "code", "key": "key", "value": "value", "result": "result", "total": "total", "progress": "progress", "date": "date", "time": "time", "since": "since", "until": "until", "with": "with", "without": "without", "from": "from", "by": "by", "only": "only", "more": "more", "less": "less", "again": "again", "still": "still", "already": "already"}, {"manager": "manager", "seller": "seller", "owner": "owner", "staff": "staff", "admin2": "admin", "vip": "VIP", "id": "ID", "cs": "CS", "party": "Party", "moment": "Moment", "family": "Family", "svga": "SVGA", "webp": "WebP", "apk": "APK", "firebase": "Firebase", "rtdb": "RTDB", "vps": "VPS", "whatsapp": "WhatsApp", "google": "Google", "facebook": "Facebook", "telegram": "Telegram", "ios": "iOS", "android": "Android", "apk2": "APK", "play": "Play", "store2": "Store", "langsung": "directly", "terdaftar": "registered", "resmi": "official", "awal": "initial", "baru": "new", "aktif2": "active", "kembali": "back", "belum": "not yet", "lagi2": "more", "total2": "total", "terakhir2": "last", "pertama2": "first", "kedua2": "second", "semua3": "all", "sendiri": "only", "otomatis": "automatically", "manual": "manual", "khusus": "special", "umum": "general", "pribadi": "private", "tetap": "still", "saja2": "only", "juga3": "also", "punya": "has", "milik": "owned by", "sesuai": "according to", "berdasarkan": "based on", "melalui": "through", "selama": "during", "sejak": "since", "hingga": "until", "kecuali": "except", "termasuk": "including", "misalnya": "for example", "yaitu": "which is", "adalah": "is", "telah": "already", "sedang2": "currently", "akan2": "will", "bisa2": "can", "dapat2": "can", "mungkin": "maybe", "pasti": "sure", "cukup": "enough", "hanya2": "only", "sangat3": "very", "terlalu2": "too", "lagi3": "again", "dulu": "previously", "nanti": "later", "segera": "soon", "kini": "now", "tadi": "just now", "besok": "tomorrow", "kemarin": "yesterday", "terbaru": "latest", "lama2": "old", "lengkap": "complete", "ringkas": "brief", "detail": "detail", "panjang": "long", "pendek": "short", "tinggi": "high", "rendah": "low", "mahal": "expensive", "murah": "cheap", "gratis": "free", "bayar2": "pay", "terima2": "accept", "tolak2": "decline", "setuju": "agree", "yakin": "sure", "ragu": "unsure", "mohon": "please", "terima3": "thanks", "maaf": "sorry", "selamat": "congrats", "semoga": "hopefully", "silahkan": "please", "mari": "let's", "jangan": "do not", "harap": "please", "ulangi": "repeat", "lanjutkan": "continue", "hentikan": "stop", "mulai2": "start", "selesaikan": "finish", "pindai": "scan", "unggah2": "upload", "unduh2": "download", "pasang2": "install", "lepas": "detach", "sematkan": "pin", "semat": "pin", "lepas2": "unpin", "official2": "official", "tag": "tag", "tags": "tags"});

function terjemahKata(t) {
  const besarAwal = /^[A-Z\u00C0-\u00DE]/.test(t);
  let teks = t;
  for (const [cocok, ganti] of GANTI_FRASA) teks = teks.replace(cocok, ganti);
  t = teks;
  const bagian = t.split(/(\s+)/);
  let total = 0, kena = 0;
  const hasil = bagian.map((b) => {
    if (/^\s+$/.test(b) || !b) return b;
    const m = b.match(/^([^\p{L}]*)(\p{L}+)([^\p{L}]*)$/u);
    if (!m) return b;
    total++;
    const g = KATA[m[2].toLowerCase()];
    if (g) { kena++; return m[1] + g + m[3]; }
    return b;
  });
  // Butuh minimal dua kata dan 60% dikenal, supaya nama user/ID tidak ikut diubah.
  const banyakBagian = t.split(/\s+/).filter(Boolean).length;
  // Satu kata dikenal masih boleh kalau teks aslinya memuat angka atau nama
  // (mis. "100000 sudah disimpan" -> "100000 saved").
  const cukupKata = total >= 2 || (total >= 1 && banyakBagian >= 2);
  if (!cukupKata || kena / total < 0.6) return null;
  let jadi = hasil.join("");
  // Pertahankan huruf besar di awal kalimat.
  if (besarAwal && /^[a-z]/.test(jadi)) jadi = jadi[0].toUpperCase() + jadi.slice(1);
  return jadi;
}

/* Indeks kamus disusun ulang di sini supaya semua tambahan di atas ikut terbaca. */
Object.keys(KAMUS).forEach((b) => {
  PETA_NORMAL[b] = {};
  Object.keys(KAMUS[b]).forEach((k) => { PETA_NORMAL[b][normal(k)] = KAMUS[b][k]; });
});

/* Teks di dalam elemen ini tidak pernah diterjemahkan: kolom isian,
   blok kode, dan apa pun yang ditandai data-jangan-terjemah. */
const LEWATI = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT"]);
/* Teks asli atribut disimpan per elemen, bukan di data-*, karena nama
   seperti data-asli-aria-label bukan nama properti dataset yang sah. */
const asliAtribut = new WeakMap();
const boleh = (el) => {
  if (!el) return false;
  if (LEWATI.has(el.tagName)) return false;
  if (el.closest && el.closest("[data-jangan-terjemah], .kodekecil, code, pre")) return false;
  return true;
};

function terjemahTeks(akar) {
  if (!akar) return;
  const jalan = document.createTreeWalker(akar, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return boleh(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const daftar = [];
  while (jalan.nextNode()) daftar.push(jalan.currentNode);
  for (const n of daftar) {
    if (n.__asli === undefined) n.__asli = n.nodeValue;
    const t = terjemah(n.__asli);
    const tujuan = t ? n.__asli.replace(n.__asli.trim(), t) : n.__asli;
    // Hanya menulis kalau berubah, supaya pemantau perubahan tidak
    // memicu dirinya sendiri tanpa henti.
    if (n.nodeValue !== tujuan) n.nodeValue = tujuan;
  }
  if (!akar.querySelectorAll) return;
  akar.querySelectorAll("[placeholder], [title], [data-l], [aria-label]").forEach((el) => {
    let simpan = asliAtribut.get(el);
    if (!simpan) { simpan = {}; asliAtribut.set(el, simpan); }
    for (const at of ["placeholder", "title", "data-l", "aria-label"]) {
      const nilai = el.getAttribute(at);
      if (!nilai) continue;
      if (simpan[at] === undefined) simpan[at] = nilai;
      const t = terjemah(simpan[at]);
      const tujuan = t || simpan[at];
      if (el.getAttribute(at) !== tujuan) el.setAttribute(at, tujuan);
    }
  });
}

function terapkanBahasa(keSeluruh) {
  const html = document.documentElement;
  html.lang = bahasa;
  html.dir = bahasa === "ar" ? "rtl" : "ltr";
  document.body.classList.toggle("bahasaArab", bahasa === "ar");
  terjemahTeks(keSeluruh === false ? document.getElementById("isiHal") : document.body);
  if (keSeluruh !== false) terjemahTeks(document.getElementById("isiHal"));
  document.querySelectorAll("[data-pilih-bahasa]").forEach((el) => {
    if (el.value !== bahasa) el.value = bahasa;
  });
  const tombol = document.getElementById("tombolBahasa");
  if (tombol) tombol.title = bahasa === "id" ? "Ganti bahasa" : "Language: " + NAMA_BAHASA[bahasa];
}

function setBahasa(kode) {
  if (!DAFTAR_BAHASA.includes(kode)) return;
  bahasa = kode;
  try { localStorage.setItem(KUNCI_SIMPAN, kode); } catch (e) { /* mode privat */ }
  terapkanBahasa(true);
  const p = document.querySelector("[data-pilih-bahasa]");
  if (p) p.value = kode;
  const menu = document.getElementById("menuBahasa");
  if (menu) menu.hidden = true;
  document.dispatchEvent(new CustomEvent("bahasaBerganti", { detail: { bahasa: kode } }));
}

function bahasaSekarang() { return bahasa; }

/* Panel menggambar ulang halaman terus-menerus, jadi setiap perubahan
   langsung diterjemahkan lagi tanpa perlu mengubah kode halaman. */
function pantauPerubahan() {
  let antre = false;
  const jalan = () => {
    antre = false;
    const isi = document.getElementById("isiHal");
    terjemahTeks(isi || document.body);
    terjemahTeks(document.querySelector(".topbar"));
    terjemahTeks(document.getElementById("toast"));
  };
  new MutationObserver(() => {
    if (antre) return;
    antre = true;
    const tunda = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (f) => setTimeout(f, 16);
    tunda(jalan);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

/* Menu globe di bar atas. */
function pasangMenuBahasa() {
  if (document.getElementById("kotakBahasa")) return;
  const bar = document.querySelector(".kananTopbar") || document.querySelector(".topbar");
  if (!bar) return;

  const kotak = document.createElement("div");
  kotak.id = "kotakBahasa";
  kotak.className = "kotakBahasa";
  kotak.innerHTML = `
    <button id="tombolBahasa" class="tombolBahasa" title="Ganti bahasa" aria-label="Language">🌎</button>
    <div id="menuBahasa" class="menuBahasa" hidden>
      ${Object.entries(NAMA_BAHASA).map(([kode, nama]) => `
        <button class="pilihBahasa" data-bahasa="${kode}">
          <span class="kodeBahasa">${kode.toUpperCase()}</span>
          <span>${nama}</span>
        </button>`).join("")}
    </div>`;
  // Diletakkan di baris tombol atas, paling kiri, supaya selalu terlihat.
  if (bar.id === "aksiTopbar") bar.parentElement.insertBefore(kotak, bar);
  else bar.insertBefore(kotak, bar.firstChild);

  const tombol = kotak.querySelector("#tombolBahasa");
  const menu = kotak.querySelector("#menuBahasa");
  tombol.onclick = (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    kotak.querySelectorAll(".pilihBahasa").forEach((b) => {
      b.classList.toggle("terpilih", b.dataset.bahasa === bahasa);
    });
  };
  kotak.querySelectorAll(".pilihBahasa").forEach((b) => {
    b.onclick = () => setBahasa(b.dataset.bahasa);
  });
  document.addEventListener("click", (e) => {
    if (!kotak.contains(e.target)) menu.hidden = true;
  });
}

function mulaiBahasa() {
  pasangMenuBahasa();
  terapkanBahasa(true);
  pantauPerubahan();
  document.addEventListener("bahasaBerganti", () => terapkanBahasa(true));
}

window.vizaBahasa = { setBahasa, bahasaSekarang, terapkanBahasa, mulaiBahasa };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mulaiBahasa, { once: true });
} else {
  mulaiBahasa();
}
