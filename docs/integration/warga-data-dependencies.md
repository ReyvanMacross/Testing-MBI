# Ketergantungan Data Warga MBI

Seluruh modul operasional MBI memakai `warga` sebagai identitas penerima layanan. Data staging harus sintetis, memiliki wilayah yang valid, dan mempunyai penetapan desil sebelum workflow lintas instansi dijalankan.

| Modul | Kebutuhan data warga | Hubungan utama |
| --- | --- | --- |
| Diskominfo | Langsung | Agregasi, peta desil, dan pemantauan lintas OPD membaca `warga`, `penetapan_desil`, dan wilayah. |
| Dinsos | Langsung | Registri warga, asesmen, kasus, penentuan jalur, dan referral dimulai dari `warga`. |
| Kecamatan | Langsung | Master warga, verifikasi lapangan, usulan, dan pengiriman referral memerlukan warga dalam wilayah kerja aktor. |
| Disnaker | Melalui referral | Intervensi ketenagakerjaan selalu menelusuri penerima dari `referral_mbi.warga_id`. |
| Diskop UKM | Melalui referral | Program dan pendampingan usaha selalu menelusuri penerima dari referral. |
| Disdik | Melalui referral | Bantuan pendidikan, progres, dan realisasi selalu terkait warga penerima referral. |
| DP3A | Melalui referral | Penanganan kasus, progres, dan realisasi selalu terkait korban/warga pada referral. |
| Disdagin | Melalui referral | Profil usaha, fasilitasi pasar, agenda, progres, dan laporan omzet selalu menelusuri warga dari `referral_mbi.warga_id`. |

`npm run staging:seed-warga` membuat atau memperbarui 24 warga prototype secara idempoten. Semua identitasnya sintetis, tersebar pada Desil 1-5 dan kelurahan di Kecamatan Sukajadi, serta tidak dihapus oleh cleanup fixture E2E. `npm run staging:audit-warga` memverifikasi jumlah, wilayah, desil, dan status verifikasinya.
