(function () {
    const storageKey = 'ruang-komik-reading-history-v1';
    const maxEntries = 50;
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    function safeCoverUrl(value) {
        if (typeof value !== 'string' || value.length > 2048) return null;
        try {
            const url = new URL(value, location.href);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
            if (!/^https?:\/\//i.test(value) && url.origin !== location.origin) return null;
            return url.href;
        } catch (_) {
            return null;
        }
    }

    function normalizeEntry(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        if (typeof value.slug !== 'string' || !slugPattern.test(value.slug)) return null;
        if (typeof value.title !== 'string' || !value.title.trim()) return null;
        const date = new Date(value.lastReadAt);
        if (!Number.isFinite(date.getTime())) return null;
        const lastPage = Number.isSafeInteger(value.lastPage) && value.lastPage > 0 ? value.lastPage : null;
        return {
            id: typeof value.id === 'string' && value.id.length <= 80 ? value.id : null,
            slug: value.slug,
            title: value.title.trim().slice(0, 200),
            coverUrl: safeCoverUrl(value.coverUrl),
            lastReadAt: date.toISOString(),
            lastPage
        };
    }

    function read() {
        let raw;
        try {
            raw = localStorage.getItem(storageKey);
        } catch (_) {
            return [];
        }
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                localStorage.removeItem(storageKey);
                return [];
            }
            const seen = new Set();
            return parsed.map(normalizeEntry).filter(entry => {
                if (!entry || seen.has(entry.slug)) return false;
                seen.add(entry.slug);
                return true;
            })
                .sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt))
                .slice(0, maxEntries);
        } catch (_) {
            try { localStorage.removeItem(storageKey); } catch (_) { /* Storage may be unavailable. */ }
            return [];
        }
    }

    function write(entries) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, maxEntries)));
            return true;
        } catch (_) {
            return false;
        }
    }

    function record(comic, pageNumber, force = false) {
        if (!comic || typeof comic.slug !== 'string' || !slugPattern.test(comic.slug)) return false;
        if (typeof comic.title !== 'string' || !comic.title.trim()) return false;
        const entries = read();
        const previous = entries.find(entry => entry.slug === comic.slug);
        const lastPage = Number.isSafeInteger(pageNumber) && pageNumber > 0
            ? pageNumber
            : pageNumber === null ? null : previous?.lastPage ?? null;
        if (!force && previous && previous.lastPage === lastPage) return true;

        const entry = {
            id: typeof comic.id === 'string' ? comic.id : previous?.id ?? null,
            slug: comic.slug,
            title: comic.title.trim().slice(0, 200),
            coverUrl: safeCoverUrl(comic.coverUrl) || previous?.coverUrl || null,
            lastReadAt: new Date().toISOString(),
            lastPage
        };
        return write([entry, ...entries.filter(item => item.slug !== comic.slug)]);
    }

    function remove(slug) {
        return write(read().filter(entry => entry.slug !== slug));
    }

    function clear() {
        return write([]);
    }

    window.ruangKomikReadingHistory = { maxEntries, read, record, remove, clear };
}());
