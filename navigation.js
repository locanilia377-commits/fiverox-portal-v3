'use strict';

document.body.dataset.prototypeTools = new URLSearchParams(location.search).get('preview') === '1';

function portalHeader(role) {
  const active = (ids) => ids.some(id => current === id || current.startsWith(id + '-'));
  const navLink = (label, route, selected) => `<a href="#/${route}" class="${selected ? 'active' : ''}"${current === route ? ' aria-current="page"' : ''}>${label}</a>`;
  const dropdown = (label, selected, items) => `<details class="site-dropdown${selected ? ' active' : ''}"><summary>${label}<span aria-hidden="true">⌄</span></summary><div class="site-dropdown-panel">${items.map(([name, route, description]) => `<a href="#/${route}"${current === route ? ' aria-current="page"' : ''}><strong>${name}</strong><span>${description}</span></a>`).join('')}</div></details>`;
  const schoolActive = current.startsWith('learn') || (current === 'home' && location.hash.includes('section=school'));
  return `<a class="wordmark" href="#/home" aria-label="FIVEROX — главная"><span class="frx-logotype"><img src="assets/fiverox-light.png" alt="FIVEROX"></span></a>
    <button class="menu-toggle" data-action="menu" aria-label="Открыть меню" aria-controls="site-nav" aria-expanded="false">Меню<span aria-hidden="true">☰</span></button>
    <nav id="site-nav" aria-label="Основная навигация">
      ${navLink('Бренды', 'brands', active(['brands', 'brand']))}
      ${navLink('Магазин', 'catalog', active(['catalog', 'product', 'cart', 'checkout']))}
      ${navLink('Найти центр', 'centers', active(['centers', 'center', 'booking']))}
      ${navLink('Гарантия 360', 'guarantee', current === 'guarantee')}
      <a href="#/home?section=school" data-school-link class="${schoolActive ? 'active' : ''}">FIVEROX School</a>
      ${dropdown('Партнёрам', active(['partners', 'partner-funds']), [
        ['Дилерам и дистрибьюторам', 'partners-dealer', 'Условия поставок и развитие продаж'],
        ['Сервисным центрам', 'partners-service', 'Материалы, стандарты и поддержка центра']
      ])}
      ${dropdown('Акции', active(['offers', 'loyalty']), [
        ['Акции для розницы', 'offers-retail', 'Подарки и предложения для покупателей'],
        ['Акции для сервисных центров', 'offers-service', 'Оснащение и партнёрская поддержка'],
        ['Бонусы и рекомендации', 'loyalty', 'Выгода за покупки и приглашения']
      ])}
    </nav>
    <a href="#/roles" class="head-action" aria-label="${menus[role] ? 'Сменить кабинет' : 'Личный кабинет'}"${current === 'roles' ? ' aria-current="page"' : ''}><span class="account-long">${menus[role] ? 'Сменить кабинет' : 'Личный кабинет'}</span><span class="account-short" aria-hidden="true">${menus[role] ? 'Кабинеты' : 'Кабинет'}</span></a>`;
}

document.addEventListener('toggle', event => {
  const opened = event.target;
  if (!opened.matches?.('.site-dropdown') || !opened.open) return;
  document.querySelectorAll('.site-dropdown[open]').forEach(item => { if (item !== opened) item.open = false; });
}, true);

document.addEventListener('click', event => {
  document.querySelectorAll('.site-dropdown[open]').forEach(item => {
    if (!item.contains(event.target)) item.open = false;
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const dropdown = document.querySelector('.site-dropdown[open]');
  if (dropdown) {
    dropdown.open = false;
    dropdown.querySelector('summary').focus();
    return;
  }
  const nav = document.getElementById('site-nav');
  if (nav?.classList.contains('open')) {
    nav.classList.remove('open');
    const button = document.querySelector('.menu-toggle');
    button?.setAttribute('aria-expanded', 'false');
    button?.focus();
  }
});
