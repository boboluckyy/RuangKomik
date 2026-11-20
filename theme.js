// The site uses a single, always-on dark theme.
document.documentElement.dataset.theme = 'light';
const themeColor = document.querySelector('meta[name="theme-color"]');
if (themeColor) themeColor.content = '#103B49';
