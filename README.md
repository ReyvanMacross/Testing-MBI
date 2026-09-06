# Platform MBI — Diskominfo Kota Bandung

Halaman login berbasis Next.js App Router, TypeScript, dan CSS Modules. Desain mengikuti [Figma Login Page](https://www.figma.com/design/ZHjyXSP7KDT64CsjnpT7Pw/Project-Diskominfo?node-id=230-1391) dan referensi PNG di folder `design/login page` pada workspace desain.

## Menjalankan project

Dari folder project, jalankan:

```powershell
npm.cmd run dev
```

Buka http://localhost:3000/login. Alamat `/` otomatis mengarah ke `/login`.

Di shell selain PowerShell, perintah `npm run dev` juga dapat digunakan. Untuk instalasi baru, jalankan `npm.cmd ci` terlebih dahulu dengan Node.js LTS.

## Cakupan tahap tampilan

- Layout desktop 50:50, form maksimal 420 px, font Inter, dan tombol utama `#134B9E`.
- Panel kiri memakai aset placeholder asli dari Figma, disimpan di `public/images/login-panel.png`.
- Pada layar sampai 900 px, panel kiri disembunyikan dan form dipusatkan.
- Tombol mata menampilkan/menyembunyikan kata sandi tanpa mengubah nilainya.
- `Ingat saya` mengubah state checkbox saja; belum membuat sesi atau menyimpan kredensial.
- Form mewajibkan kedua kolom terisi dan menolak nama pengguna yang hanya berisi spasi.
- Submit dengan kolom valid menampilkan simulasi error sesuai desain. Tidak ada permintaan login ke server.
- `/login?state=error` menampilkan state error secara langsung untuk review visual.
- Tautan bantuan membuka dialog petunjuk kontak internal. Tujuan kontak dan alur reset menunggu informasi berikutnya.

Database, autentikasi, sesi, role, dan dashboard belum diintegrasikan.

## Pemeriksaan

```powershell
npm.cmd run lint
npm.cmd run build
```
