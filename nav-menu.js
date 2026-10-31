(function () {
    const nav = document.querySelector('.topbar nav');
    if (!nav) return;
    const isHomePage = document.body.classList.contains('home-page');
    const menuItems = isHomePage
        ? [...nav.querySelectorAll(':scope > a[href="komik.html"], :scope > a[data-open-gallery]')]
        : [...nav.children].filter(item =>
            !item.classList.contains('nav-search-wrap') &&
            !item.classList.contains('reader-profile-trigger')
        );
    if (!menuItems.length) return;

    const menu = document.createElement('div');
    menu.className = 'nav-menu-items';
    menu.id = 'primary-menu-items';
    menuItems.forEach(item => menu.append(item));

    const toggle = document.createElement('button');
    toggle.className = 'nav-menu-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Buka menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menu.id);
    toggle.innerHTML = '<span></span><span></span><span></span>';
    nav.prepend(toggle);
    nav.append(menu);

    function closeMenu() {
        menu.dataset.open = 'false';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Buka menu');
    }
    toggle.addEventListener('click', () => {
        const isOpen = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Tutup menu' : 'Buka menu');
        menu.dataset.open = String(isOpen);
    });
    menu.addEventListener('click', event => {
        if (event.target.closest('a, button')) closeMenu();
    });
    document.addEventListener('click', event => {
        if (!nav.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu();
    });
})();
