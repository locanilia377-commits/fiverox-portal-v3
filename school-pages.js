(() => {
  const schoolOrigin = 'https://fiverox-portal-v3.gerasimigorevitch.chatgpt.site/';
  const schoolRoutes = [
    'learn', 'learn-programs', 'learn-lesson', 'learn-certificates', 'learn-certificate',
    'dealer-learning', 'asc-learning', 'admin-learning', 'client-learning',
  ];

  function schoolLink(hash, label) {
    const url = new URL(hash, schoolOrigin);
    return '<a class="btn primary" href="' + esc(url.href) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
  }

  function programCards() {
    return '<div class="grid two learn-programs">' + learnTracks.map(track => {
      const route = 'learn-lesson?track=' + encodeURIComponent(track.id) + '&lesson=0';
      return '<article class="card"><p class="eyebrow">' + esc(track.audience) + '</p><h2>' +
        esc(track.title) + '</h2><p>' + esc(track.short) + '</p><ul>' +
        track.lessons.map(lesson => '<li>' + esc(lesson.title) + '</li>').join('') +
        '</ul><div class="actions">' + link('Посмотреть первый урок', route, 'secondary') + '</div></article>';
    }).join('') + '</div>';
  }

  function previewLesson(track) {
    const lesson = track.lessons[0];
    return '<article class="card learn-lesson"><p class="eyebrow">ПЕРВЫЙ УРОК</p><h2>' +
      esc(lesson.title) + '</h2><p class="learn-lead">' + esc(lesson.goal) +
      '</p><h3>Ключевые принципы</h3><ol class="learn-points">' +
      lesson.points.map(point => '<li>' + esc(point) + '</li>').join('') +
      '</ol><div class="learn-task"><p>' + esc(lesson.task) + '</p></div></article>';
  }

  function renderSchoolPreview() {
    const route = current;
    const track = learnTrack();
    const original = schoolLink(window.location.hash, 'Открыть учебный кабинет');
    const note = '<p class="learn-note">Учебный прогресс, проверки знаний и сертификаты доступны в учебном кабинете FIVEROX School.</p>';
    if (route === 'learn-lesson' && ['0', null].includes(learnQuery().get('lesson'))) {
      return head('Первый урок', track.title, link('Все программы', 'learn-programs', 'secondary')) +
        previewLesson(track) + '<div class="actions">' + original + '</div>' + note;
    }
    if (route === 'learn-certificates' || route === 'learn-certificate' || route === 'learn-lesson') {
      const title = route === 'learn-lesson' ? 'Учебный модуль' : 'Сертификаты';
      return head(title, 'FIVEROX School', original) + note + link('Все программы', 'learn-programs', 'secondary');
    }
    return head('FIVEROX School', 'Программы для сотрудников, мастеров и партнёров.', original) +
      programCards() + note;
  }

  document.addEventListener('DOMContentLoaded', () => {
    for (const route of schoolRoutes) routes[route].render = renderSchoolPreview;
    if (schoolRoutes.includes(current)) render();
  });
})();
