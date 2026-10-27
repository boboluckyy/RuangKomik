(function () {
    const storageKey = 'ruang-komik-theme';
    let theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

    function applyTheme(nextTheme, persist = false) {
        theme = nextTheme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            const dark = theme === 'dark';
            button.textContent = dark ? 'Mode terang' : 'Mode gelap';
            button.setAttribute('aria-label', dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
            button.setAttribute('aria-pressed', String(dark));
        });
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) themeColor.content = theme === 'dark' ? '#151a17' : '#f8f7f4';
        if (persist) {
            try {
                localStorage.setItem(storageKey, theme);
            } catch (_) {
                // The selected theme still applies for this page if storage is unavailable.
            }
        }
    }

    applyTheme(theme);
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-theme-toggle]').forEach(button => {
            button.addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark', true));
        });
    });
}());
