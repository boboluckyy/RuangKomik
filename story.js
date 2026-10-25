(async function () {
    const root = document.getElementById('story-content');
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug || !window.ruangKomik.ready) {
        root.innerHTML = '<section class="story-intro"><h1>Komik tidak tersedia</h1><p>Pastikan konfigurasi Supabase sudah diisi dan tautan komik masih berlaku.</p></section><div class="bottom-nav"><a class="back" href="komik.html#galeri">Kembali ke galeri</a></div>';
        return;
    }
    const { client, escape, imageUrl } = window.ruangKomik;
    const { data: comic, error } = await client.from('comics').select('id,title,description,category,comic_pages(page_number,image_path,alt_text)').eq('slug', slug).eq('is_published', true).maybeSingle();
    if (error || !comic) {
        root.innerHTML = '<section class="story-intro"><h1>Komik tidak ditemukan</h1><p>Komik ini mungkin belum diterbitkan.</p></section><div class="bottom-nav"><a class="back" href="komik.html#galeri">Kembali ke galeri</a></div>';
        return;
    }
    const pages = (comic.comic_pages || []).sort((a, b) => a.page_number - b.page_number);
    document.title = `${comic.title} — Ruang Komik`;
    root.innerHTML = `<section class="story-intro"><span class="eyebrow"><span class="eyebrow-dot"></span>${escape(comic.category || 'Cerita pilihan')}</span><h1>${escape(comic.title)}</h1><p>${escape(comic.description)}</p></section>${pages.map(page => `<figure class="comic-frame"><img src="${escape(imageUrl(page.image_path))}" alt="${escape(page.alt_text || `${comic.title}, halaman ${page.page_number}`)}" loading="lazy"></figure>`).join('')}<div class="bottom-nav"><a class="back" href="komik.html#galeri">← Jelajahi semua komik</a></div>`;
}());
