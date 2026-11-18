(() => {
  const schoolOrigin = 'https://fiverox-portal-v3.gerasimigorevitch.chatgpt.site/';
  const schoolRoutes = new Set([
    'learn', 'learn-programs', 'learn-lesson', 'learn-certificates', 'learn-certificate',
    'dealer-learning', 'asc-learning', 'admin-learning', 'client-learning',
  ]);

  function openSchool() {
    const route = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    if (schoolRoutes.has(route)) {
      window.location.replace(new URL(window.location.hash, schoolOrigin).href);
    }
  }

  window.addEventListener('hashchange', openSchool);
  openSchool();
})();
