(function () {
    const api = window.ruangKomik;
    const loginForm = document.getElementById('login-form');
    const dashboard = document.getElementById('dashboard');
    const status = document.getElementById('admin-status');
    const list = document.getElementById('comic-list');
    const statisticsStatus = document.getElementById('statistics-status');
    const statistics = document.getElementById('admin-stats');
    const recentStatus = document.getElementById('recent-comics-status');
    const recentList = document.getElementById('recent-comics-list');
    const reportsStatus = document.getElementById('reports-status');
    const reportsList = document.getElementById('reports-list');
    const musicStatus = document.getElementById('music-admin-status');
    const musicList = document.getElementById('music-track-list');
    const editDialog = document.getElementById('comic-edit-dialog');
    const editForm = document.getElementById('comic-edit-form');
    const say = (message, bad = false) => { status.textContent = message; status.dataset.error = bad ? 'true' : 'false'; };
    const publicationStatusOf = comic => ['draft', 'published', 'archived'].includes(comic.publication_status)
        ? comic.publication_status
        : comic.is_published ? 'published' : 'draft';
    const publicationLabel = value => ({ draft: 'Draf', published: 'Terbit', archived: 'Arsip' }[value] || 'Draf');
    let publicationSchemaAvailable = true;
    const missingFeatureColumns = error => error?.code === '42703' || /publication_status|is_featured/i.test(error?.message || '') && /column|schema cache|does not exist|could not find/i.test(error?.message || '');
    if (!api.ready) {
        loginForm.hidden = true;
        say('Supabase belum dikonfigurasi. Isi URL project dan publishable key di supabase-config.js.', true);
        return;
    }
    const db = api.client;
    const bucket = db.storage.from('comic-images');
    async function clearOtherFeaturedComics(comicId) {
        const { error } = await db.from('comics').update({ is_featured: false })
            .eq('is_featured', true).neq('id', comicId);
        if (error) throw error;
    }

    async function refreshSession() {
        const { data } = await db.auth.getSession();
        const loggedIn = Boolean(data.session);
        loginForm.hidden = loggedIn;
        dashboard.hidden = !loggedIn;
        if (loggedIn) { await loadComics(); await loadMusicTracks(); }
    }
    const musicBucket = db.storage.from('music-files');
    const musicPlaylistNames = { 'lofi-reading': 'Lo-fi Reading', 'piano-relax': 'Piano & Relax', 'chill-vibes': 'Chill Vibes' };
    async function loadMusicTracks() {
        musicStatus.textContent = 'Memuat daftar lagu…';
        try {
            const { data, error } = await db.from('music_tracks').select('id,title,artist,playlist_key,audio_path,cover_path').order('playlist_key').order('created_at');
            if (error) throw error;
            if (!data?.length) { musicStatus.textContent = 'Belum ada lagu. Tambahkan lagu melalui formulir ini.'; musicList.replaceChildren(); return; }
            musicStatus.textContent = `${data.length} lagu tersedia untuk pengunjung.`;
            musicList.innerHTML = data.map(track => `<article class="admin-item music-admin-item"><div class="admin-item-info"><img src="${track.cover_path ? api.escape(db.storage.from('music-files').getPublicUrl(track.cover_path).data.publicUrl) : ''}" alt="Cover ${api.escape(track.title)}" ${track.cover_path ? '' : 'hidden'}><div><h3>${api.escape(track.title)}</h3><p>${api.escape(track.artist || 'Ruang Komik')} · ${api.escape(musicPlaylistNames[track.playlist_key] || track.playlist_key)}</p></div></div><div class="admin-actions"><button type="button" class="admin-danger" data-music-delete="${api.escape(track.id)}" data-title="${api.escape(track.title)}">Hapus</button></div></article>`).join('');
        } catch (error) {
            musicStatus.textContent = /music_tracks|schema cache|does not exist/i.test(error.message || '')
                ? 'Terapkan migration music_player terlebih dahulu untuk mengelola lagu.'
                : 'Daftar lagu gagal dimuat. Periksa koneksi dan hak akses Admin.';
        }
    }
    async function loadComics() {
        statisticsStatus.textContent = 'Memuat statistik…';
        statistics.hidden = true;
        recentStatus.textContent = 'Memuat daftar komik terbaru…';
        recentList.replaceChildren();
        list.innerHTML = '<p>Memuat komik…</p>';
        reportsStatus.textContent = 'Memuat laporan…';
        try {
            let [comicsResult, pagesResult] = await Promise.all([
                db.from('comics').select('id,title,slug,description,category,cover_path,is_published,publication_status,is_featured,created_at').order('created_at', { ascending: false }),
                db.from('comic_pages').select('id', { count: 'exact', head: true })
            ]);
            if (comicsResult.error && missingFeatureColumns(comicsResult.error)) {
                publicationSchemaAvailable = false;
                comicsResult = await db.from('comics').select('id,title,slug,description,category,cover_path,is_published,created_at').order('created_at', { ascending: false });
            } else if (!comicsResult.error) {
                publicationSchemaAvailable = true;
            }
            if (comicsResult.error) throw comicsResult.error;

            const data = comicsResult.data || [];
            const publishedCount = data.filter(comic => publicationStatusOf(comic) === 'published').length;
            const draftCount = data.filter(comic => publicationStatusOf(comic) === 'draft').length;
            const archivedCount = data.filter(comic => publicationStatusOf(comic) === 'archived').length;
            document.getElementById('stat-total-comics').textContent = String(data.length);
            document.getElementById('stat-published-comics').textContent = String(publishedCount);
            document.getElementById('stat-draft-comics').textContent = String(draftCount);
            document.getElementById('stat-archived-comics').textContent = String(archivedCount);
            document.getElementById('stat-total-pages').textContent = pagesResult.error ? '—' : String(pagesResult.count ?? 0);
            statistics.hidden = false;
            const statisticsMessages = [];
            if (!publicationSchemaAvailable) statisticsMessages.push('Migration status publikasi belum diterapkan; komik non-terbit sementara ditampilkan sebagai draf.');
            if (pagesResult.error) statisticsMessages.push('Jumlah halaman gagal dimuat.');
            if (data.length === 0) statisticsMessages.push('Tidak ada komik yang dapat dibaca sesi ini; statistik komik menampilkan nol.');
            if (statisticsMessages.length === 0) statisticsMessages.push('Statistik dimuat dari data Supabase.');
            statisticsStatus.textContent = statisticsMessages.join(' ');
            if (pagesResult.error) say('Jumlah halaman komik gagal dimuat.', true);

            if (data.length === 0) {
                recentStatus.textContent = 'Tidak ada komik yang dapat dibaca sesi ini.';
                list.innerHTML = '<p>Tidak ada komik yang dapat dibaca sesi ini.</p>';
            } else {
                const recentComics = data.slice(0, 5);
                recentStatus.textContent = `Menampilkan ${recentComics.length} komik terbaru.`;
                recentList.innerHTML = recentComics.map(comic => {
                    const createdAt = new Date(comic.created_at);
                    const dateLabel = Number.isNaN(createdAt.getTime())
                        ? 'Tanggal tidak tersedia'
                        : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(createdAt);
                    const publicationStatus = publicationStatusOf(comic);
                    return `<article class="admin-recent-item"><div><h3>${api.escape(comic.title)}</h3><p>${api.escape(comic.category || 'Tanpa kategori')} · ${api.escape(dateLabel)}</p><span>/${api.escape(comic.slug)}</span></div><span class="admin-recent-status" data-status="${publicationStatus}">${publicationLabel(publicationStatus)}</span></article>`;
                }).join('');
                list.innerHTML = data.map(comic => {
                    const publicationStatus = publicationStatusOf(comic);
                    return `<article class="admin-item"><div class="admin-item-info"><img src="${api.escape(api.imageUrl(comic.cover_path))}" alt="Sampul ${api.escape(comic.title)}" loading="lazy"><div><h3>${api.escape(comic.title)}</h3><p>/${api.escape(comic.slug)} · ${publicationLabel(publicationStatus)}${comic.is_featured ? ' · Unggulan' : ''}</p></div></div><div class="admin-actions"><button type="button" data-action="edit" data-id="${comic.id}">Edit</button><button type="button" data-action="feature" data-id="${comic.id}" data-featured="${comic.is_featured}" ${!publicationSchemaAvailable || publicationStatus !== 'published' ? 'disabled' : ''}>${comic.is_featured ? 'Hapus unggulan' : 'Jadikan unggulan'}</button><button type="button" data-action="toggle" data-id="${comic.id}" data-status="${publicationStatus}" data-published="${comic.is_published}">${comic.is_published ? 'Arsipkan' : 'Terbitkan'}</button><button type="button" data-action="delete" data-id="${comic.id}" data-title="${api.escape(comic.title)}" class="admin-danger">Hapus</button></div></article>`;
                }).join('');
            }
            await loadReports();
        } catch (error) {
            statisticsStatus.textContent = 'Statistik gagal dimuat dari Supabase.';
            recentStatus.textContent = 'Daftar komik terbaru gagal dimuat.';
            list.innerHTML = '<p role="status">Daftar komik gagal dimuat. Periksa koneksi dan hak akses Admin.</p>';
            reportsStatus.textContent = 'Laporan tidak dapat dimuat karena data Admin gagal dimuat.';
            say(`Gagal memuat data Admin: ${error.message || 'terjadi kesalahan.'}`, true);
        }
    }

    async function loadReports() {
        reportsStatus.textContent = 'Memuat laporan…';
        reportsList.replaceChildren();
        try {
            const { data, error } = await db.from('comic_reports')
                .select('id,issue_type,message,status,created_at,comics(title,slug)')
                .order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            if (!data || data.length === 0) {
                reportsStatus.textContent = 'Belum ada laporan masalah komik.';
                return;
            }
            const issueLabels = { image_broken: 'Gambar rusak', missing_page: 'Halaman hilang', page_order: 'Urutan halaman salah', other: 'Masalah lainnya' };
            reportsStatus.textContent = `Menampilkan ${data.length} laporan terbaru.`;
            reportsList.innerHTML = data.map(report => {
                const date = new Date(report.created_at);
                const dateLabel = Number.isNaN(date.getTime()) ? 'Tanggal tidak tersedia' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
                return `<article class="admin-report-item"><h3>${api.escape(report.comics?.title || 'Komik tidak tersedia')}</h3><span class="admin-report-meta">${api.escape(issueLabels[report.issue_type] || 'Masalah lainnya')} · ${api.escape(report.status)} · ${api.escape(dateLabel)} · /${api.escape(report.comics?.slug || '')}</span><p>${api.escape(report.message)}</p></article>`;
            }).join('');
        } catch (_) {
            reportsStatus.textContent = 'Laporan gagal dimuat. Pastikan migration laporan sudah diterapkan.';
        }
    }
    loginForm.addEventListener('submit', async event => {
        event.preventDefault(); say('Memeriksa akun…');
        const fields = new FormData(loginForm);
        const password = String(fields.get('password') || '');
        const { error } = await db.auth.signInWithPassword({ email: fields.get('email'), password });
        if (error) {
            // Auth errors are safe to show after redaction; never display the submitted
            // password or configured public key, even if a provider echoes request data.
            let detail = String(error.message || 'Supabase Auth menolak permintaan login.');
            for (const secret of [password, window.RUANG_KOMIK_SUPABASE?.publishableKey]) {
                if (secret) detail = detail.split(secret).join('[disamarkan]');
            }
            const code = error.code || error.status;
            say(`Login gagal: ${detail}${code ? ` (kode: ${code})` : ''}`, true);
            return;
        }
        say('Berhasil masuk.'); await refreshSession();
    });
    document.getElementById('sign-out').addEventListener('click', async () => { await db.auth.signOut(); say('Anda sudah keluar.'); await refreshSession(); });
    document.getElementById('cancel-edit').addEventListener('click', () => editDialog.close());
    const editPublicationStatus = editForm.elements.publication_status;
    const editFeatured = editForm.elements.is_featured;
    function syncEditFeaturedControl() {
        const canFeature = publicationSchemaAvailable && editPublicationStatus.value === 'published';
        editFeatured.disabled = !canFeature;
        editPublicationStatus.disabled = !publicationSchemaAvailable;
        if (!canFeature) editFeatured.checked = false;
    }
    editPublicationStatus.addEventListener('change', syncEditFeaturedControl);
    list.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button || button.dataset.action !== 'edit') return;
        let { data: comic, error } = await db.from('comics').select('id,title,slug,description,category,cover_path,publication_status,is_featured').eq('id', button.dataset.id).single();
        if (error && missingFeatureColumns(error)) {
            publicationSchemaAvailable = false;
            ({ data: comic, error } = await db.from('comics').select('id,title,slug,description,category,cover_path,is_published').eq('id', button.dataset.id).single());
        }
        if (error) { say(error.message, true); return; }
        for (const field of ['id', 'title', 'slug', 'description', 'category']) editForm.elements[field].value = comic[field] || '';
        editPublicationStatus.value = publicationStatusOf(comic);
        editFeatured.checked = comic.is_featured === true;
        syncEditFeaturedControl();
        editForm.elements.oldCoverPath.value = comic.cover_path;
        editForm.elements.cover.value = '';
        editDialog.showModal();
    });
    editForm.addEventListener('submit', async event => {
        event.preventDefault();
        const fields = new FormData(editForm);
        const cover = fields.get('cover');
        if (cover.size && (!['image/jpeg', 'image/png', 'image/webp'].includes(cover.type) || cover.size > 10 * 1024 * 1024)) {
            say('Sampul harus JPEG, PNG, atau WebP dan maksimal 10 MB.', true); return;
        }
        const id = String(fields.get('id'));
        let newCoverPath = null;
        let cleanupWarning = null;
        try {
            if (cover.size) {
                const ext = cover.name.split('.').pop().toLowerCase();
                newCoverPath = `${crypto.randomUUID()}/cover.${ext}`;
                const { error } = await bucket.upload(newCoverPath, cover, { upsert: false, contentType: cover.type });
                if (error) throw error;
            }
            const update = {
                title: String(fields.get('title')).trim(),
                slug: String(fields.get('slug')).trim(),
                category: String(fields.get('category') || '').trim(),
                description: String(fields.get('description') || '').trim(),
                ...(publicationSchemaAvailable ? {
                    publication_status: String(fields.get('publication_status')),
                    is_featured: fields.get('publication_status') === 'published' && fields.get('is_featured') === 'on'
                } : {})
            };
            if (update.is_featured) await clearOtherFeaturedComics(id);
            if (newCoverPath) update.cover_path = newCoverPath;
            const { error } = await db.from('comics').update(update).eq('id', id).select('id').single();
            if (error) throw error;
            editDialog.close();
            if (newCoverPath) {
                const oldPath = bucketObjectPath(fields.get('oldCoverPath'));
                if (oldPath) {
                    const { error: cleanupError } = await bucket.remove([oldPath]);
                    if (cleanupError) cleanupWarning = `Komik diperbarui, tetapi sampul lama gagal dihapus: ${cleanupError.message}`;
                }
            }
            say(cleanupWarning || 'Komik berhasil diperbarui.', Boolean(cleanupWarning));
            await loadComics();
        } catch (error) {
            if (newCoverPath) await bucket.remove([newCoverPath]);
            say(`Gagal memperbarui komik: ${error.message}`, true);
        }
    });
    document.getElementById('comic-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        const cover = fields.get('cover');
        const pages = fields.getAll('pages').filter(file => file.size > 0);
        const publishOnSave = fields.get('published') === 'on';
        const featureOnSave = fields.get('featured') === 'on';
        if (featureOnSave && !publishOnSave) { say('Komik unggulan harus diterbitkan.', true); return; }
        if (featureOnSave && !publicationSchemaAvailable) { say('Migration fitur komik unggulan belum diterapkan.', true); return; }
        if (!cover.size || pages.length === 0) { say('Pilih satu sampul dan minimal satu halaman komik.', true); return; }
        if ([cover, ...pages].some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
            say('Setiap gambar harus JPEG, PNG, atau WebP dan maksimal 10 MB.', true); return;
        }
        const slug = String(fields.get('slug')).trim();
        const folder = `${crypto.randomUUID()}`;
        const paths = [];
        let createdComicId = null;
        say('Mengunggah gambar…');
        async function upload(file, name) {
            const path = `${folder}/${name}`;
            const { error } = await bucket.upload(path, file, { upsert: false, contentType: file.type });
            if (error) throw error;
            paths.push(path); return path;
        }
        try {
            const coverPath = await upload(cover, `cover.${cover.name.split('.').pop().toLowerCase()}`);
            const insertPayload = { slug, title: String(fields.get('title')).trim(), description: String(fields.get('description') || '').trim(), category: String(fields.get('category') || '').trim(), cover_path: coverPath, is_published: false };
            if (publicationSchemaAvailable) Object.assign(insertPayload, { publication_status: 'draft', is_featured: false });
            const { data: comic, error: insertError } = await db.from('comics').insert(insertPayload).select('id').single();
            if (insertError) throw insertError;
            createdComicId = comic.id;
            const records = [];
            for (let i = 0; i < pages.length; i++) records.push({ comic_id: comic.id, page_number: i + 1, image_path: await upload(pages[i], `page-${String(i + 1).padStart(3, '0')}.${pages[i].name.split('.').pop().toLowerCase()}`), alt_text: `${String(fields.get('title')).trim()}, halaman ${i + 1}` });
            const { error: pagesError } = await db.from('comic_pages').insert(records);
            if (pagesError) throw pagesError;
            if (publishOnSave) {
                const publishUpdate = publicationSchemaAvailable
                    ? { publication_status: 'published', is_featured: featureOnSave }
                    : { is_published: true };
                if (featureOnSave) await clearOtherFeaturedComics(comic.id);
                const { error } = await db.from('comics').update(publishUpdate).eq('id', comic.id);
                if (error) throw error;
            }
            form.reset(); say('Komik berhasil disimpan.'); await loadComics();
        } catch (error) {
            if (createdComicId) await db.from('comics').delete().eq('id', createdComicId);
            if (paths.length) await bucket.remove(paths);
            say(`Gagal menyimpan komik: ${error.message}`, true);
        }
    });
    document.getElementById('music-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        const audio = fields.get('audio');
        const cover = fields.get('cover');
        if (!audio.size || audio.type !== 'audio/mpeg' || audio.size > 50 * 1024 * 1024) { say('Pilih file MP3 yang valid dengan ukuran maksimal 50 MB.', true); return; }
        if (cover.size && (!['image/jpeg', 'image/png', 'image/webp'].includes(cover.type) || cover.size > 10 * 1024 * 1024)) { say('Cover harus JPEG, PNG, atau WebP dengan ukuran maksimal 10 MB.', true); return; }
        const folder = crypto.randomUUID();
        const audioPath = `${folder}/track.mp3`;
        let coverPath = null;
        say('Mengunggah lagu…');
        try {
            let result = await musicBucket.upload(audioPath, audio, { upsert: false, contentType: 'audio/mpeg' });
            if (result.error) throw result.error;
            if (cover.size) {
                coverPath = `${folder}/cover.${cover.name.split('.').pop().toLowerCase()}`;
                result = await musicBucket.upload(coverPath, cover, { upsert: false, contentType: cover.type });
                if (result.error) throw result.error;
            }
            const { error } = await db.from('music_tracks').insert({
                title: String(fields.get('title')).trim(), artist: String(fields.get('artist') || '').trim(),
                playlist_key: String(fields.get('playlist_key')), audio_path: audioPath, cover_path: coverPath
            });
            if (error) throw error;
            form.reset(); say('Lagu berhasil ditambahkan ke playlist.'); await loadMusicTracks();
        } catch (error) {
            await musicBucket.remove([audioPath, ...(coverPath ? [coverPath] : [])]);
            say(`Gagal menambahkan lagu: ${error.message || 'periksa migration dan hak akses Supabase.'}`, true);
        }
    });
    musicList.addEventListener('click', async event => {
        const button = event.target.closest('[data-music-delete]');
        if (!button) return;
        if (!window.confirm(`Hapus lagu “${button.dataset.title}” dan file audionya?`)) return;
        const { data: track, error: readError } = await db.from('music_tracks').select('audio_path,cover_path').eq('id', button.dataset.musicDelete).single();
        if (readError) { say(`Gagal membaca lagu: ${readError.message}`, true); return; }
        const { error } = await db.from('music_tracks').delete().eq('id', button.dataset.musicDelete);
        if (error) { say(`Gagal menghapus lagu: ${error.message}`, true); return; }
        const paths = [track.audio_path, track.cover_path].filter(Boolean);
        const { error: storageError } = await musicBucket.remove(paths);
        say(storageError ? `Data lagu terhapus, tetapi file audionya gagal dihapus: ${storageError.message}` : 'Lagu berhasil dihapus.', Boolean(storageError));
        await loadMusicTracks();
    });
    list.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button || button.dataset.action === 'edit') return;
        const { action, id } = button.dataset;
        if (action === 'toggle') {
            const nextStatus = button.dataset.status === 'published' ? 'archived' : 'published';
            const update = publicationSchemaAvailable
                ? { publication_status: nextStatus, is_featured: false }
                : { is_published: button.dataset.published !== 'true' };
            const { error } = await db.from('comics').update(update).eq('id', id).select('id').single();
            if (error) say(error.message, true); else { say('Status komik diperbarui.'); await loadComics(); }
        } else if (action === 'feature') {
            if (!publicationSchemaAvailable) { say('Migration fitur komik unggulan belum diterapkan.', true); return; }
            try {
                const shouldFeature = button.dataset.featured !== 'true';
                if (shouldFeature) await clearOtherFeaturedComics(id);
                const { error } = await db.from('comics').update({ is_featured: shouldFeature }).eq('id', id).select('id').single();
                if (error) throw error;
                say('Status unggulan komik diperbarui.'); await loadComics();
            } catch (error) { say(`Gagal memperbarui unggulan: ${error.message}`, true); }
        } else if (action === 'delete') {
            if (!window.confirm(`Hapus permanen "${button.dataset.title}" beserta semua halaman dan file gambarnya? Tindakan ini tidak dapat dibatalkan.`)) return;
            const { data: comic, error: readError } = await db.from('comics').select('cover_path,comic_pages(image_path)').eq('id', id).single();
            if (readError) { say(readError.message, true); return; }
            const paths = [...new Set([comic.cover_path, ...(comic.comic_pages || []).map(page => page.image_path)].map(bucketObjectPath).filter(Boolean))];
            const { error } = await db.from('comics').delete().eq('id', id).select('id').single();
            if (error) { say(error.message, true); return; }
            if (paths.length) {
                const { error: storageError } = await bucket.remove(paths);
                if (storageError) {
                    say(`Data komik dan halamannya terhapus, tetapi file gambar gagal dihapus dari bucket: ${storageError.message}`, true);
                    await loadComics(); return;
                }
            }
            say('Komik, halaman, dan file gambarnya berhasil dihapus.'); await loadComics();
        }
    });
    db.auth.onAuthStateChange(() => { void refreshSession(); });
    void refreshSession();

    function bucketObjectPath(path) {
        if (!path) return null;
        const marker = '/storage/v1/object/public/comic-images/';
        const index = path.indexOf(marker);
        if (index >= 0) return decodeURIComponent(path.slice(index + marker.length));
        return /^https?:\/\//i.test(path) ? null : path;
    }
}());
