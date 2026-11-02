# Desain Rumah PRO

Aplikasi desain denah rumah 2D dan visualisasi 3D dengan lantai terpisah, ukuran dinding, kontrol pintu/jendela, katalog perabot, dan ekspor gambar, PDF, DXF, serta JSON. Tata letak menyesuaikan ponsel, tablet, dan desktop. Kanvas denah mendukung geser dinding terpilih, zoom cubit dua jari, dan label luas otomatis pada bidang tertutup termasuk bentuk dengan sudut tidak siku. Perencana keramik dapat mengambil ruangan tersimpan atau bidang tertutup yang dideteksi otomatis dari dinding, mengatur offset hingga ±120 cm, dan memperbesar simulasi pola dengan tampilan awal pas-bingkai. Setiap lantai menyimpan denah, pintu, jendela, ruangan, dan perabotnya sendiri. Lantai dapat ditambah, disalin, diganti nama, dan dihapus. Pada layar sentuh, buat dinding dengan menggeser jari dari titik awal ke titik akhir atau mengetuk dua titik berturut-turut. Berkas `logo.png` digunakan sebagai ikon aplikasi.

Gambar denah dapat diunggah atau difoto langsung untuk dijadikan alas transparan dan ditrace manual. Lebar alas dapat diatur berdasarkan ukuran nyata. Scan otomatis menggunakan Gemini, menampilkan hasil dinding/ruangan untuk ditinjau sebelum diterapkan, dan memerlukan API server serta `GEMINI_API_KEY`.

- **Nama aplikasi:** Desain Rumah PRO
- **App ID Android:** `com.riohsm.desainrumahpro`

## Menjalankan aplikasi web

**Prasyarat:** Node.js 20.19+ atau 22.12+.

```bash
npm install
npm run dev
```

`npm run dev` menjalankan Vite dan API scan lokal. Salin `.env.example` menjadi `.env`, lalu isi `GEMINI_API_KEY` hanya di server untuk mengaktifkan scan AI. Tanpa API key, unggah foto dan tracing manual tetap dapat digunakan.

Untuk menjalankan versi produksi web setelah build, gunakan `npm run start`. Deploy server ini dengan `GEMINI_API_KEY` di environment hosting dan HTTPS. Untuk APK yang memakai scan AI, isi `VITE_PLAN_API_URL` di `.env` dengan URL HTTPS server tersebut sebelum menjalankan `npm run android:sync`. Jangan menaruh API key Gemini di variabel `VITE_*` atau di dalam APK.

Pemeriksaan TypeScript dan build produksi:

```bash
npm run lint
npm run build
```

## Membuat APK Android

**Prasyarat build lokal:** Windows, Node.js, JDK 17 atau lebih baru, serta Android SDK Platform 35 dan Build Tools 35.0.0. Android Studio dapat memasang SDK tersebut. Atur `JAVA_HOME` ke JDK dan `ANDROID_HOME` ke lokasi Android SDK, lalu buka ulang terminal.

1. Pasang dependensi: `npm install`
2. Buat APK debug beserta ikon dan sinkronisasi Android: `npm run android:apk`

Folder `android/` dan Gradle Wrapper sudah disertakan. Jalankan `npm run android:add` hanya jika folder `android/` belum tersedia.

APK debug tersedia di `android/app/build/outputs/apk/debug/app-debug.apk`. Untuk membuka proyek di Android Studio, jalankan `npm run android:open`; untuk APK rilis, pilih **Build > Generate Signed Bundle / APK** dan tandatangani dengan keystore milik Anda. Perubahan App ID membuat Android mengenali aplikasi ini sebagai aplikasi baru, bukan pembaruan untuk instalasi dengan ID lama.

Setelah mengubah kode web, jalankan `npm run android:sync` lagi sebelum membangun APK. Skrip `npm run android:icons` membuat ulang ikon peluncur Android berdasarkan `logo.png`. Di APK, ekspor PNG, PDF, DXF, dan JSON menulis file ke penyimpanan sementara aplikasi lalu membuka menu berbagi Android; pilih aplikasi tujuan seperti Files/Drive untuk menyimpan. Ekspor PDF dibuat langsung dari denah sehingga tidak memerlukan dialog cetak browser. Di web, gambar, DXF, dan JSON diunduh melalui browser, sedangkan PDF menggunakan dialog cetak. Ekspor DXF berisi layer `WALLS`, `ROOMS`, `DOORS`, `WINDOWS`, `FURNITURE`, dan `DIMENSIONS`; file DXF hanya mengekspor lantai yang sedang aktif. Snapshot 3D juga tersedia melalui menu berbagi di Android.

### Build APK otomatis di GitHub

Workflow `.github/workflows/android-apk.yml` membangun APK debug saat perubahan dikirim ke branch `main`/`master`, atau secara manual melalui tab **Actions > Build Android APK > Run workflow**. Setelah berhasil, unduh artifact `desain-rumah-pro-debug-apk` dari ringkasan workflow. Cara ini tidak membutuhkan Java atau Android SDK terpasang di komputer lokal, tetapi proyek harus diunggah ke repositori GitHub terlebih dahulu.
