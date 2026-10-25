(function () {
    const api = window.ruangKomik;
    const loginForm = document.getElementById('login-form');
    const dashboard = document.getElementById('dashboard');
    const status = document.getElementById('admin-status');
    const list = document.getElementById('comic-list');
    const editDialog = document.getElementById('comic-edit-dialog');
    const editForm = document.getElementById('comic-edit-form');
    const say = (message, bad = false) => { status.textContent = message; status.dataset.error = bad ? 'true' : 'false'; };
    if (!api.ready) {
        loginForm.hidden = true;
        say('Supabase belum dikonfigurasi. Isi URL project dan publishable key di supabase-config.js.', true);
        return;
    }
    const db = api.client;
    const bucket = db.storage.from('comic-images');

    async function refreshSession() {
        const { data } = await db.auth.getSession();
        const loggedIn = Boolean(data.session);
        loginForm.hidden = loggedIn;
        dashboard.hidden = !loggedIn;
        if (loggedIn) await loadComics();
    }
    async function loadComics() {
        list.innerHTML = '<p>Memuat komik…</p>';
        const { data, error } = await db.from('comics').select('id,title,slug,description,category,cover_path,is_published,created_at').order('created_at', { ascending: false });
        if (error) { say(error.message, true); return; }
        list.innerHTML = data.length ? data.map(comic => `<article class="admin-item"><div class="admin-item-info"><img src="${api.escape(api.imageUrl(comic.cover_path))}" alt="Sampul ${api.escape(comic.title)}" loading="lazy"><div><h3>${api.escape(comic.title)}</h3><p>/${api.escape(comic.slug)} · ${comic.is_published ? 'Terbit' : 'Arsip'}</p></div></div><div class="admin-actions"><button type="button" data-action="edit" data-id="${comic.id}">Edit</button><button type="button" data-action="toggle" data-id="${comic.id}" data-published="${comic.is_published}">${comic.is_published ? 'Arsipkan' : 'Terbitkan'}</button><button type="button" data-action="delete" data-id="${comic.id}" data-title="${api.escape(comic.title)}" class="admin-danger">Hapus</button></div></article>`).join('') : '<p>Belum ada komik di database.</p>';
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
    list.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button || button.dataset.action !== 'edit') return;
        const { data: comic, error } = await db.from('comics').select('id,title,slug,description,category,cover_path').eq('id', button.dataset.id).single();
        if (error) { say(error.message, true); return; }
        for (const field of ['id', 'title', 'slug', 'description', 'category']) editForm.elements[field].value = comic[field] || '';
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
                description: String(fields.get('description') || '').trim()
            };
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
            const { data: comic, error: insertError } = await db.from('comics').insert({ slug, title: String(fields.get('title')).trim(), description: String(fields.get('description') || '').trim(), category: String(fields.get('category') || '').trim(), cover_path: coverPath, is_published: false }).select('id').single();
            if (insertError) throw insertError;
            createdComicId = comic.id;
            const records = [];
            for (let i = 0; i < pages.length; i++) records.push({ comic_id: comic.id, page_number: i + 1, image_path: await upload(pages[i], `page-${String(i + 1).padStart(3, '0')}.${pages[i].name.split('.').pop().toLowerCase()}`), alt_text: `${String(fields.get('title')).trim()}, halaman ${i + 1}` });
            const { error: pagesError } = await db.from('comic_pages').insert(records);
            if (pagesError) throw pagesError;
            if (fields.get('published')) {
                const { error } = await db.from('comics').update({ is_published: true }).eq('id', comic.id);
                if (error) throw error;
            }
            form.reset(); say('Komik berhasil disimpan.'); await loadComics();
        } catch (error) {
            if (createdComicId) await db.from('comics').delete().eq('id', createdComicId);
            if (paths.length) await bucket.remove(paths);
            say(`Gagal menyimpan komik: ${error.message}`, true);
        }
    });
    list.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button || button.dataset.action === 'edit') return;
        const { action, id } = button.dataset;
        if (action === 'toggle') {
            const { error } = await db.from('comics').update({ is_published: button.dataset.published !== 'true' }).eq('id', id).select('id').single();
            if (error) say(error.message, true); else { say('Status komik diperbarui.'); await loadComics(); }
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
