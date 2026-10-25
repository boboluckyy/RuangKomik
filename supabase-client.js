(function () {
    const config = window.RUANG_KOMIK_SUPABASE || {};
    const ready = Boolean(config.url && config.publishableKey && window.supabase);
    const client = ready ? window.supabase.createClient(config.url, config.publishableKey) : null;
    window.ruangKomik = {
        ready,
        client,
        imageUrl(path) {
            if (!path) return '';
            if (/^https?:\/\//i.test(path)) return path;
            if (!client) return '';
            let objectPath = String(path).trim().replace(/^\/+/, '');
            objectPath = objectPath
                .replace(/^storage\/v1\/object\/(?:public|sign)\/comic-images\//i, '')
                .replace(/^public\/comic-images\//i, '')
                .replace(/^comic-images\//i, '');
            return client.storage.from('comic-images').getPublicUrl(objectPath).data.publicUrl;
        },
        escape(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        }
    };
}());
