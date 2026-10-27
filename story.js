(async function () {
    const root = document.getElementById('story-content');
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    if (!slug || !window.ruangKomik.ready) {
        root.innerHTML = '<section class="story-intro"><h1>Komik tidak tersedia</h1><p>Pastikan konfigurasi Supabase sudah diisi dan tautan komik masih berlaku.</p></section><div class="bottom-nav"><a class="back" href="komik.html#galeri">Kembali ke galeri</a></div>';
        return;
    }

    const { client, escape, imageUrl } = window.ruangKomik;
    const { data: comic, error } = await client.from('comics')
        .select('id,title,description,category,cover_path,comic_pages(page_number,image_path,alt_text)')
        .eq('slug', slug).eq('is_published', true).maybeSingle();
    if (error || !comic) {
        root.innerHTML = '<section class="story-intro"><h1>Komik tidak ditemukan</h1><p>Komik ini mungkin belum diterbitkan.</p></section><div class="bottom-nav"><a class="back" href="komik.html#galeri">Kembali ke galeri</a></div>';
        return;
    }

    const pages = (comic.comic_pages || []).sort((a, b) => a.page_number - b.page_number);
    const defaultDescription = 'Baca komik dan cerita pilihan di Ruang Komik.';
    const pageTitle = `${comic.title} — Ruang Komik`;
    const pageDescription = comic.description?.trim() || defaultDescription;
    const coverUrl = imageUrl(comic.cover_path);
    const canonicalUrl = new URL('story.html', location.href);
    canonicalUrl.searchParams.set('slug', comic.slug);
    document.title = pageTitle;
    setMeta('name', 'description', pageDescription);
    setMeta('property', 'og:title', pageTitle);
    setMeta('property', 'og:description', pageDescription);
    setMeta('property', 'og:url', canonicalUrl.href);
    if (coverUrl) setMeta('property', 'og:image', coverUrl);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.append(canonical);
    }
    canonical.href = canonicalUrl.href;

    root.innerHTML = `<section class="story-intro"><span class="eyebrow"><span class="eyebrow-dot"></span>${escape(comic.category || 'Cerita pilihan')}</span><h1>${escape(comic.title)}</h1><p>${escape(comic.description)}</p><div class="story-tools"><button class="button button-primary" id="share-comic" type="button">Bagikan komik</button><span id="share-status" class="story-action-status" role="status" aria-live="polite"></span><details class="comic-report-popover"><summary class="comic-report-trigger">Laporkan masalah</summary><div class="comic-report-popover-panel"></div></details></div></section>${pages.map(page => `<figure class="comic-frame" data-page="${page.page_number}"><img src="${escape(imageUrl(page.image_path))}" alt="${escape(page.alt_text || `${comic.title}, halaman ${page.page_number}`)}" loading="lazy"></figure>`).join('')}${pages.length > 1 ? '<nav class="comic-page-navigation" id="comic-page-navigation" aria-label="Navigasi halaman komik"><button class="admin-secondary" id="previous-page" type="button">Halaman sebelumnya</button><span id="current-page" aria-live="polite"></span><button class="admin-secondary" id="next-page" type="button">Halaman berikutnya</button></nav>' : ''}<section class="comic-report" aria-labelledby="comic-report-title"><h2 id="comic-report-title">Laporkan masalah</h2><p>Beritahu Admin jika ada gambar rusak, halaman hilang, atau urutan yang keliru.</p><form id="comic-report-form"><label for="report-issue">Jenis masalah</label><select id="report-issue" name="issue_type" required><option value="image_broken">Gambar rusak</option><option value="missing_page">Halaman hilang</option><option value="page_order">Urutan halaman salah</option><option value="other">Masalah lainnya</option></select><label for="report-message">Keterangan (10–1200 karakter)</label><textarea id="report-message" name="message" minlength="10" maxlength="1200" rows="4" required></textarea><button class="button button-primary" type="submit">Kirim laporan</button></form><p id="report-status" class="story-action-status" role="status" aria-live="polite"></p></section><div class="bottom-nav"><a class="back" href="komik.html#galeri">← Jelajahi semua komik</a></div>`;

    const reportPopoverPanel = root.querySelector(".comic-report-popover-panel");
    const reportSection = root.querySelector(".comic-report");
    if (reportPopoverPanel && reportSection) reportPopoverPanel.append(reportSection);

    const readingHistory = window.ruangKomikReadingHistory;
    const requestedPage = Number(params.get('page'));
    const startPage = pages.some(page => page.page_number === requestedPage)
        ? requestedPage
        : pages[0]?.page_number ?? null;
    const historyComic = { id: comic.id, slug, title: comic.title, coverUrl };
    if (readingHistory) readingHistory.record(historyComic, startPage, true);

    const frames = [...root.querySelectorAll('.comic-frame[data-page]')];
    let currentIndex = Math.max(0, frames.findIndex(frame => Number(frame.dataset.page) === startPage));
    const resumeFrame = frames[currentIndex];
    if (resumeFrame && requestedPage === startPage && startPage !== pages[0]?.page_number) {
        resumeFrame.scrollIntoView({ block: 'start' });
    }
    const currentPage = document.getElementById('current-page');
    const previousPage = document.getElementById('previous-page');
    const nextPage = document.getElementById('next-page');
    function setCurrentIndex(index) {
        if (!frames.length) return;
        currentIndex = Math.max(0, Math.min(index, frames.length - 1));
        const pageNumber = Number(frames[currentIndex].dataset.page);
        if (currentPage) currentPage.textContent = `Halaman ${currentIndex + 1} dari ${frames.length}`;
        if (previousPage) previousPage.disabled = currentIndex === 0;
        if (nextPage) nextPage.disabled = currentIndex === frames.length - 1;
        if (readingHistory) readingHistory.record(historyComic, pageNumber);
    }
    setCurrentIndex(currentIndex);

    if (previousPage && nextPage) {
        previousPage.addEventListener('click', () => frames[Math.max(0, currentIndex - 1)].scrollIntoView({ behavior: 'smooth', block: 'start' }));
        nextPage.addEventListener('click', () => frames[Math.min(frames.length - 1, currentIndex + 1)].scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    if (frames.length) {
        let scheduled = false;
        function updateVisiblePage() {
            scheduled = false;
            const viewportCenter = window.innerHeight / 2;
            let closestIndex = 0;
            let closestDistance = Infinity;
            frames.forEach((frame, index) => {
                const rect = frame.getBoundingClientRect();
                const distance = rect.top <= viewportCenter && rect.bottom >= viewportCenter
                    ? 0
                    : Math.min(Math.abs(rect.top - viewportCenter), Math.abs(rect.bottom - viewportCenter));
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = index;
                }
            });
            setCurrentIndex(closestIndex);
        }
        function schedulePageUpdate() {
            if (scheduled) return;
            scheduled = true;
            window.requestAnimationFrame(updateVisiblePage);
        }
        window.addEventListener('scroll', schedulePageUpdate, { passive: true });
        window.addEventListener('resize', schedulePageUpdate);
        frames.forEach(frame => frame.querySelector('img')?.addEventListener('load', schedulePageUpdate));
        schedulePageUpdate();
    }

    const readCounterKey = `ruang-komik-counted-${comic.id}`;
    let shouldCountRead = pages.length > 0;
    if (shouldCountRead) {
        try {
            shouldCountRead = sessionStorage.getItem(readCounterKey) === null;
            if (shouldCountRead) sessionStorage.setItem(readCounterKey, 'pending');
        } catch (_) {
            // If session storage is unavailable, count this successful page open once.
        }
    }
    if (shouldCountRead) {
        try {
            void Promise.resolve(client.rpc('record_comic_read', { p_comic_id: comic.id })).then(({ error: countError }) => {
                try {
                    if (countError) sessionStorage.removeItem(readCounterKey);
                    else sessionStorage.setItem(readCounterKey, '1');
                } catch (_) { /* Keep the database count independent of browser storage. */ }
            }).catch(() => {
                try { sessionStorage.removeItem(readCounterKey); } catch (_) { /* Storage may be unavailable. */ }
            });
        } catch (_) { /* Popularity is optional until its migration is applied. */ }
    }

    document.getElementById('share-comic').addEventListener('click', async () => {
        const shareStatus = document.getElementById('share-status');
        const shareData = { title: pageTitle, text: pageDescription, url: canonicalUrl.href };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                shareStatus.textContent = 'Tautan komik berhasil dibagikan.';
                return;
            } catch (shareError) {
                if (shareError.name === 'AbortError') return;
            }
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(canonicalUrl.href);
            } else {
                const copyField = document.createElement('textarea');
                copyField.value = canonicalUrl.href;
                copyField.setAttribute('readonly', '');
                copyField.style.position = 'fixed';
                copyField.style.opacity = '0';
                document.body.append(copyField);
                copyField.select();
                const copied = document.execCommand('copy');
                copyField.remove();
                if (!copied) throw new Error('copy failed');
            }
            shareStatus.textContent = 'Tautan komik berhasil disalin.';
        } catch (_) {
            shareStatus.textContent = 'Tautan tidak dapat disalin di browser ini.';
        }
    });

    const reportForm = document.getElementById('comic-report-form');
    reportForm.addEventListener('submit', async event => {
        event.preventDefault();
        const reportStatus = document.getElementById('report-status');
        const fields = new FormData(reportForm);
        const message = String(fields.get('message') || '').trim();
        if (message.length < 10 || message.length > 1200) {
            reportStatus.textContent = 'Keterangan harus terdiri dari 10–1200 karakter.';
            return;
        }
        reportForm.querySelector('button[type="submit"]').disabled = true;
        reportStatus.textContent = 'Mengirim laporan…';
        try {
            const { error: reportError } = await client.from('comic_reports').insert({
                comic_id: comic.id,
                issue_type: fields.get('issue_type'),
                message
            });
            if (reportError) throw reportError;
            reportForm.reset();
            reportStatus.textContent = 'Laporan berhasil dikirim ke Admin.';
        } catch (_) {
            reportStatus.textContent = 'Laporan gagal disimpan. Pastikan migration fitur laporan sudah diterapkan, lalu coba lagi.';
        } finally {
            reportForm.querySelector('button[type="submit"]').disabled = false;
        }
    });

    const backToTop = document.getElementById('back-to-top');
    function updateBackToTop() { backToTop.hidden = window.scrollY < 500; }
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    updateBackToTop();
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    function setMeta(attribute, key, value) {
        let element = document.querySelector(`meta[${attribute}="${key}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attribute, key);
            document.head.append(element);
        }
        element.content = value;
    }
}());
