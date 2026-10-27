(function () {
    const storageKey = 'ruang-komik-reader-profile';
    const nav = document.querySelector('.topbar nav');
    if (!nav) return;

    const readProfile = () => {
        try {
            const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
            return {
                name: typeof value.name === 'string' ? value.name.slice(0, 32) : '',
                status: typeof value.status === 'string' ? value.status.slice(0, 60) : '',
                photo: typeof value.photo === 'string' && value.photo.startsWith('data:image/') ? value.photo : ''
            };
        } catch (_) { return { name: '', status: '', photo: '' }; }
    };

    nav.insertAdjacentHTML('beforeend', '<button class="reader-profile-trigger" id="reader-profile-trigger" type="button" aria-label="Buka profil" title="Profil" aria-haspopup="dialog" aria-controls="reader-profile-dialog"><span class="reader-profile-avatar" id="reader-profile-avatar" aria-hidden="true">?</span><span id="reader-profile-label">Profil</span></button>');
    document.body.insertAdjacentHTML('beforeend', `<dialog class="reader-profile-dialog" id="reader-profile-dialog" aria-labelledby="reader-profile-title"><form id="reader-profile-form"><div class="reader-profile-heading"><div><h2 id="reader-profile-title">Profil pembaca</h2><p>Atur nama, status, dan foto profilmu.</p></div><button class="reader-profile-close" type="button" aria-label="Tutup">×</button></div><div class="reader-profile-preview"><span class="reader-profile-avatar" id="reader-profile-preview-avatar" aria-hidden="true">?</span><div><strong id="reader-profile-preview-name">Pembaca</strong><p id="reader-profile-preview-status">Suka membaca komik</p></div></div><label for="reader-profile-name">Nama<input id="reader-profile-name" name="name" maxlength="32" placeholder="Nama panggilan"></label><label for="reader-profile-status">Status singkat<input id="reader-profile-status" name="status" maxlength="60" placeholder="Contoh: Lagi cari cerita seru"></label><label for="reader-profile-photo">Foto profil<input id="reader-profile-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="reader-profile-actions"><button class="reader-profile-reset" id="reader-profile-reset" type="button">Hapus profil</button><button class="button button-primary" type="submit">Simpan</button></div><p class="reader-profile-message" id="reader-profile-message" role="status" aria-live="polite"></p></form></dialog>`);

    const dialog = document.getElementById('reader-profile-dialog');
    const form = document.getElementById('reader-profile-form');
    const photoInput = document.getElementById('reader-profile-photo');
    const message = document.getElementById('reader-profile-message');
    let profile = readProfile();
    let pendingPhoto = profile.photo;

    function paint() {
        const name = profile.name || 'Pembaca';
        const status = profile.status || 'Suka membaca komik';
        const initials = [...name.trim()][0]?.toLocaleUpperCase('id-ID') || '?';
        document.getElementById('reader-profile-label').textContent = profile.name || 'Profil';
        [document.getElementById('reader-profile-avatar'), document.getElementById('reader-profile-preview-avatar')].forEach(avatar => {
            avatar.textContent = profile.photo ? '' : initials;
            avatar.style.backgroundImage = profile.photo ? `url("${profile.photo}")` : '';
            avatar.classList.toggle('has-photo', Boolean(profile.photo));
        });
        document.getElementById('reader-profile-preview-name').textContent = name;
        document.getElementById('reader-profile-preview-status').textContent = status;
    }

    document.getElementById('reader-profile-trigger').addEventListener('click', () => {
        form.elements.name.value = profile.name;
        form.elements.status.value = profile.status;
        pendingPhoto = profile.photo;
        photoInput.value = '';
        message.textContent = '';
        dialog.showModal();
    });
    document.querySelector('.reader-profile-close').addEventListener('click', () => dialog.close());
    photoInput.addEventListener('change', () => {
        const file = photoInput.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            message.textContent = 'Pilih foto JPEG, PNG, atau WebP maksimal 5 MB.';
            photoInput.value = '';
            return;
        }
        const image = new Image();
        image.onload = () => {
            const scale = Math.min(1, 256 / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            pendingPhoto = canvas.toDataURL('image/jpeg', 0.78);
            URL.revokeObjectURL(image.src);
            message.textContent = 'Foto siap disimpan.';
        };
        image.onerror = () => { message.textContent = 'Foto tidak dapat dibuka.'; };
        image.src = URL.createObjectURL(file);
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const next = { name: form.elements.name.value.trim(), status: form.elements.status.value.trim(), photo: pendingPhoto };
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            profile = next;
            paint();
            dialog.close();
        } catch (_) {
            message.textContent = 'Browser tidak memiliki ruang penyimpanan yang cukup. Coba foto yang lebih kecil.';
        }
    });
    document.getElementById('reader-profile-reset').addEventListener('click', () => {
        try { localStorage.removeItem(storageKey); } catch (_) { /* Storage may be unavailable. */ }
        profile = { name: '', status: '', photo: '' };
        pendingPhoto = '';
        paint();
        dialog.close();
    });
    paint();
})();
