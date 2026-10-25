# Integrasi Supabase Ruang Komik

## Konfigurasi browser

Edit `supabase-config.js` dengan **Project URL** dan **publishable key** (atau legacy `anon` key) dari Supabase Dashboard → Project Settings → API Keys. Nilai tersebut memang dipakai di browser. Jangan masukkan `service_role` atau secret key.

Situs ini adalah frontend statis, jadi `supabase-config.js` perlu tersedia saat deploy. Jangan mengunggah file konfigurasi yang berisi secret key.

## Membaca komik

Galeri hanya menampilkan baris `comics` yang `is_published = true`. Sampul dan halaman membaca file dari bucket publik `comic-images`. Kartu komik membuka `story.html?slug=...`; halaman ini menampilkan halaman berdasarkan `page_number`. Jika belum ada komik terbit, galeri menampilkan pesan kosong dan komik dapat ditambahkan dari halaman Admin. Cerita Kampus dan Cerita Vaksin lama sudah dilepas dari koleksi; URL lama mengarahkan kembali ke galeri.

## Admin

Buka `admin.html`, lalu masuk memakai akun Supabase Auth yang UUID-nya sudah tercatat sebagai Admin. Halaman Admin hanya menggunakan autentikasi pengguna dan kebijakan RLS yang tersedia. Admin dapat mengunggah sampul dan beberapa halaman (urutkan nama file sesuai urutan sebelum memilih), membuat draf atau langsung menerbitkan, mengubah status terbit, dan menghapus komik.

Ukuran maksimal tiap gambar 10 MB; format yang diterima JPEG, PNG, dan WebP, mengikuti konfigurasi bucket. Pastikan hosting menggunakan HTTPS untuk autentikasi.

Tidak ada migration yang perlu dijalankan untuk integrasi frontend ini.
