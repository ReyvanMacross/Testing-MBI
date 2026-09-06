create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'LAPANGAN', 'INTERVENSI', 'WALIKOTA', 'Verifikator Dinsos',
      'Operator Lapangan', 'Admin Diskominfo', 'ADMIN',
      'Operator Kelurahan', 'Operator Kecamatan', 'SUPER_ADMIN'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'jalur_intervensi_enum') then
    create type public.jalur_intervensi_enum as enum (
      'PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR', 'KETENAGAKERJAAN'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'status_verifikasi_enum') then
    create type public.status_verifikasi_enum as enum (
      'PENDING', 'VERIFIED', 'REJECTED'
    );
  end if;
end $$;

create table if not exists public.master_opd (
  id uuid primary key default gen_random_uuid(),
  kode_opd varchar unique,
  nama_opd varchar not null
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  email varchar not null unique,
  nama_lengkap varchar not null,
  role public.app_role not null,
  opd_id uuid references public.master_opd(id),
  created_at timestamptz not null default now(),
  status varchar not null default 'AKTIF',
  wilayah varchar,
  instansi varchar,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  nip varchar unique,
  username varchar unique
);

create table if not exists public.warga (
  id uuid primary key default gen_random_uuid(),
  nik varchar unique,
  nomor_kk varchar,
  nama_lengkap varchar not null,
  tempat_lahir varchar,
  tanggal_lahir date,
  jenis_kelamin varchar,
  status_perkawinan varchar,
  nomor_hp varchar,
  email varchar,
  alamat_lengkap text,
  kelurahan varchar,
  kecamatan varchar,
  koordinat_lat numeric,
  koordinat_lng numeric,
  pendidikan_terakhir varchar,
  pekerjaan varchar,
  pendapatan numeric,
  jumlah_anggota_kk integer,
  status_rumah varchar,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.penetapan_desil (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null references public.warga(id) on delete cascade,
  desil_dtsen integer,
  status_dtsen varchar,
  status_pbi boolean,
  status_pkh boolean,
  status_sembako_bpnt boolean,
  tingkat_kerentanan varchar,
  skor_kemiskinan numeric,
  prioritas_intervensi varchar,
  created_at timestamptz not null default now()
);

create table if not exists public.integrasi_api (
  id uuid primary key default gen_random_uuid(),
  opd_id uuid references public.master_opd(id),
  layanan varchar not null,
  instansi varchar not null,
  latency varchar,
  status varchar not null default 'ONLINE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.log_aktivitas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  nama_pengguna varchar not null,
  role_pengguna varchar not null,
  aktivitas text not null,
  modul varchar not null,
  status varchar not null default 'BERHASIL',
  created_at timestamptz not null default now()
);

create table if not exists public.inkubasi_sosial (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  kepala_keluarga varchar, jumlah_tanggungan integer, anak_sekolah integer, lansia integer,
  disabilitas integer, ibu_hamil integer, balita integer, stunting boolean, pendapatan numeric,
  pengeluaran numeric, hutang numeric, aset text, kendaraan text, rekening_bank varchar,
  kepemilikan_nib varchar, riwayat_bantuan text, skill text[], sertifikasi text[],
  minat_kerja varchar, pengalaman_kerja text, pengalaman_usaha text, minat_wirausaha varchar,
  penyakit_kronis text, disabilitas_risiko text, phk boolean, korban_bencana boolean,
  korban_kekerasan boolean, created_at timestamptz not null default now()
);

create table if not exists public.verifikasi_validasi (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  status_verifikasi public.status_verifikasi_enum not null default 'PENDING', pelaksana_verivali text[],
  tanggal_verifikasi date, petugas_verifikasi varchar, foto_rumah_url text, foto_kk_url text,
  foto_ktp_url text, foto_kondisi_rumah_url text, hasil_survey text,
  created_at timestamptz not null default now()
);

create table if not exists public.penentuan_jalur (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  readiness_score numeric, output_jalur public.jalur_intervensi_enum, employability_score numeric,
  entrepreneurship_score numeric, family_support_score numeric, health_score numeric,
  education_score numeric, priority_score numeric, created_at timestamptz not null default now()
);

create table if not exists public.jalur_ketenagakerjaan (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  pelatihan varchar, sertifikasi varchar, kompetensi varchar, lowongan varchar, interview_status varchar,
  penempatan varchar, nama_perusahaan varchar, gaji numeric, tanggal_mulai date,
  created_at timestamptz not null default now()
);

create table if not exists public.jalur_wirausaha (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  jenis_usaha varchar, nib varchar, omzet numeric, bantuan_modal numeric, pendamping varchar,
  marketplace varchar, legalitas varchar, akses_kur boolean, status_usaha varchar,
  created_at timestamptz not null default now()
);

create table if not exists public.jalur_penguatan_dasar (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  status_sekolah varchar, ats boolean, beasiswa varchar, bantuan_pendidikan varchar, bpjs_status varchar,
  penyakit text, stunting boolean, anc_status varchar, imunisasi_status varchar, perlindungan_anak text,
  kekerasan text, pendampingan_p3a text, keluarga_berisiko boolean, kb_status varchar,
  pendampingan_keluarga text, created_at timestamptz not null default now()
);

create table if not exists public.intervensi_lanjutan (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  nama_program varchar, opd varchar, jenis_bantuan varchar, nilai_bantuan numeric, tanggal date,
  status varchar, outcome text, created_at timestamptz not null default now()
);

create table if not exists public.monitoring (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  monitoring_ke integer, tanggal date, pendapatan numeric, status_kerja varchar, status_usaha varchar,
  pendidikan varchar, kesehatan varchar, kondisi_rumah text, catatan text, foto_url text,
  pendapatan_sebelum numeric, pendapatan_sesudah numeric, status_mandiri boolean,
  lama_keluar_kemiskinan varchar, peningkatan_desil integer, outcome_score numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.reentry (
  id uuid primary key default gen_random_uuid(), warga_id uuid not null references public.warga(id) on delete cascade,
  penyebab_gagal text, phk boolean, usaha_tutup boolean, penyakit boolean, perceraian boolean,
  bencana boolean, rekomendasi_baru text, opd_tujuan varchar, program_baru varchar,
  created_at timestamptz not null default now()
);

create table if not exists public.rekomendasi_kebijakan (
  id uuid primary key default gen_random_uuid(), kode_rek varchar unique, pengusul varchar,
  tanggal_masuk date, kategori varchar, ditujukan_ke text[], temuan_utama text,
  rekomendasi text, lampiran_info text, status varchar, alasan_penolakan text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
