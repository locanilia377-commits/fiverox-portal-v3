
'use strict';

const MVP = (() => {
  const storageKey = 'fiverox-v3.processes.1';
  const actorList = {
    guest: ['Гость', 'Публичная витрина', 'home'],
    client: ['Клиент / ученик', 'Демо-профиль', 'client'],
    second: ['Второй клиент', 'Демо-профиль 2', 'client'],
    candidate: ['Кандидат в партнёры', 'Демо-заявка', 'mvp-partner'],
    distributor: ['Эксклюзивный дистрибьютор', 'Демо-партнёр', 'dealer'],
    official: ['Официальный дистрибьютор', 'Демо-партнёр', 'dealer'],
    dealer: ['Дилер', 'Демо-партнёр', 'dealer'],
    drop: ['Партнёр по дропшиппингу', 'Демо-партнёр', 'mvp-drop'],
    asc: ['Авторизованный АСЦ', 'Демо-центр А', 'mvp-crm'],
    ascCertified: ['Сертифицированный АСЦ', 'Демо-центр Б', 'mvp-crm'],
    ascBrand: ['Фирменный АСЦ', 'Демо-центр В', 'mvp-crm'],
    teacher: ['Преподаватель', 'Учебное направление', 'mvp-teacher'],
    organizer: ['Организатор', 'Демо-мероприятие', 'mvp-eventdesk'],
    operator: ['Сотрудник FIVEROX', 'Операционный отдел', 'admin'],
    reviewer: ['Модератор FIVEROX', 'Отдел модерации', 'mvp-moderation'],
  };
  const rights = {
    customer: ['client', 'second'],
    learner: ['client', 'second', 'dealer', 'official', 'distributor', 'asc', 'ascCertified', 'ascBrand', 'drop', 'teacher', 'organizer', 'operator', 'reviewer'],
    partner: ['dealer', 'official', 'distributor', 'drop'],
    center: ['asc', 'ascCertified', 'ascBrand'],
    staff: ['operator'],
    moderator: ['operator', 'reviewer'],
    candidate: ['candidate'],
    teacher: ['teacher', 'operator'],
    organizer: ['organizer', 'operator'],
  };
  const fresh = () => ({
    actor: 'guest', now: Date.parse('2026-11-20T17:30:00+03:00'), count: 100,
    profile: {name: 'Демо-пользователь', ways: ['Email'], preferences: ['В портале'], marketing: false},
    security: {}, settings: {}, products: {}, records: {}, notices: [], log: [],
  });
  let data = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && actorList[saved.actor] && Number.isFinite(saved.now) && saved.records) data = saved;
  } catch { /* The demo also works without local persistence. */ }
  const gates = new Map();
  const actions = new Map();
  const forms = new Map();
  const jobs = [];
  const expiryJobs = [];
  const demoCode = '111111';

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* In-memory session. */ }
  }
  function check(condition, message) {
    if (!condition) throw new Error(message);
  }
  function allow(key) {
    if (!key) return true;
    if (Array.isArray(key)) return key.some(allow);
    return key === data.actor || Boolean(rights[key]?.includes(data.actor));
  }
  function add(id, code, title, group, gate, page) {
    define(id, code, title, group, page);
    if (gate) gates.set(id, gate);
  }
  function override(id, gate, page) {
    const route = routes[id];
    check(route, 'Маршрут не найден: ' + id);
    if (page) route.render = page;
    if (gate) gates.set(id, gate);
  }
  function params() {
    return new URLSearchParams(location.hash.split('?')[1] || '');
  }
  function route(id, values = {}) {
    const query = new URLSearchParams(values).toString();
    return id + (query ? '?' + query : '');
  }
  function switchTo(id) {
    const hash = '#/' + id;
    if (location.hash === hash) render();
    else location.hash = hash;
  }
  function registry(name, seed = []) {
    if (!Object.hasOwn(data.records, name)) data.records[name] = structuredClone(seed);
    return data.records[name];
  }
  function find(name, id, seed) {
    const item = registry(name, seed).find(r => r.id === id);
    check(item, 'Запись не найдена.');
    return item;
  }
  function create(name, prefix, props) {
    const item = {...props, id: prefix + '-' + ++data.count};
    registry(name).unshift(item);
    return item;
  }
  function change(entry, from, to) {
    check(from.includes(entry.status), 'На текущем этапе это действие недоступно.');
    entry.status = to;
  }
  function text(value) { return esc(String(value ?? '')); }
  function caption(value) { return badge(text(value)); }
  function action(label, command, id = '', kind = 'secondary') {
    return `<button type="button" class="btn ${kind}" data-mvp-action="${text(command)}" data-id="${text(id)}">${text(label)}</button>`;
  }
  function pack(...buttons) { return `<div class="actions">${buttons.join('')}</div>`; }
  function card(title, children) { return `<section class="card"><h2>${text(title)}</h2>${children}</section>`; }
  function note(message) { return `<div class="callout">${text(message)}</div>`; }
  function block(...cards) { return `<div class="grid two">${cards.join('')}</div>`; }
  function list(items) { return `<ul>${items.map(x => '<li>' + text(x) + '</li>').join('')}</ul>`; }
  function wrapForm(handler, id, fields, label, back = '') {
    return `<form class="card" data-mvp-form="${text(handler)}" data-id="${text(id)}"><div class="grid two">${fields}</div><p role="alert" data-mvp-error hidden></p><div class="form-bottom">${back ? link('Назад', back, 'secondary') : ''}<button type="submit" class="btn primary">${text(label)}</button></div></form>`;
  }
  function input(label, name, value = '', type = 'text', required = true, hint = '') {
    return field(text(label), name, value, type, text(hint), required);
  }
  function dropdown(label, name, options, selected) {
    return `<label class="field">${text(label)}<select name="${text(name)}">${options.map(option => {
      const [value, title] = Array.isArray(option) ? option : [option, option];
      return `<option value="${text(value)}"${value === selected ? ' selected' : ''}>${text(title)}</option>`;
    }).join('')}</select></label>`;
  }
  function upload(label, name) {
    return `<label class="field">${text(label)}<input name="${text(name)}" type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.docx,.txt"></label>`;
  }
  function showDate(value) {
    return value ? new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow',
    }).format(value) : '—';
  }
  function dateOnly(value) {
    return value ? new Intl.DateTimeFormat('ru-RU', {dateStyle: 'short', timeZone: 'Europe/Moscow'}).format(value) : '—';
  }
  function record(title, detail, section = '') {
    data.log.unshift({at: data.now, actor: data.actor, title, detail, section});
  }
  function notify(to, title, detail, channels = []) {
    data.notices.unshift({
      id: 'N-' + ++data.count, to: to.flat(), title, detail, at: data.now, read: [],
      delivery: Object.fromEntries(channels.map(channel => [channel, 'Ожидает отправки'])),
    });
  }
  function task(command, allowed, run) { actions.set(command, {allowed, run}); }
  function form(handler, allowed, run) { forms.set(handler, {allowed, run}); }
  function onExpire(callback) { expiryJobs.push(callback); }
  function onInstall(callback) { jobs.push(callback); }
  function setActor(actor) {
    check(Object.hasOwn(actorList,actor), 'Выберите роль из списка.');
    data.actor = actor;
    persist();
  }
  function pageActor() { return actorList[data.actor]; }
  function owner() { return rights.customer.includes(data.actor) ? data.actor : 'client'; }
  function labels(items) { return items.map(key => actorList[key]?.[0] || key).join(', '); }

  function loginLink(id, actor = '') {
    return link('Выбрать роль', route('roles', {next: id, actor}), 'primary');
  }
  function run(handler, id, values, error) {
    const before = structuredClone(data);
    try {
      check(handler && allow(handler.allowed), 'Действие недоступно для этой роли.');
      const next = handler.run(id, values);
      for (const checkExpiry of expiryJobs) checkExpiry();
      persist();
      if (next) switchTo(next);
      else render();
    } catch (err) {
      data = before;
      if (error) { error.textContent = err.message; error.hidden = false; }
      else toast(err.message);
    }
  }

  function setupRender() {
    const oldRender = render;
    window.removeEventListener('hashchange', oldRender);
    render = function renderWithDemoAccess() {
      const id = location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
      const target = routes[id];
      const gate = gates.get(id);
      if (target && gate && !allow(gate)) {
        routes[id] = {...target, group: 'Публичный портал', render: () =>
          head('Доступ к кабинету', 'В этом сценарии доступ зависит от роли и организации.',
            loginLink(id)) + note('Текущая роль: ' + pageActor()[0] + '.')
        };
        try { oldRender(); } finally { routes[id] = target; }
        return;
      }
      oldRender();
    };
    window.addEventListener('hashchange', render);
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-mvp-action]');
      if (!target) return;
      event.preventDefault();
      run(actions.get(target.dataset.mvpAction), target.dataset.id);
    });
    document.addEventListener('submit', event => {
      const target = event.target.closest('[data-mvp-form]');
      if (!target) return;
      event.preventDefault();
      run(forms.get(target.dataset.mvpForm), target.dataset.id, new FormData(target),
        target.querySelector('[data-mvp-error]'));
    });
  }

  function rolesPage() {
    const next = params().get('next');
    return head('Личный кабинет', 'Выберите роль для кликабельного сценария.',
      link('Все бизнес-процессы', 'mvp-processes', 'secondary')) +
      note('Текущий кабинет: ' + pageActor().slice(0, 2).join(' · ')) +
      block(...Object.entries(actorList).map(([id, [title, description]]) =>
        card(title, `<p>${text(description)}</p>` + pack(
          id === 'guest' ? action('Продолжить как гость', 'guest', '', 'primary')
            : link('Открыть кабинет', route('mvp-login', {actor: id, ...(next ? {next} : {})}), 'primary')
        ))));
  }
  function loginPage() {
    const actor = params().get('actor') || 'client';
    const details = actorList[actor];
    if (!details || actor === 'guest') return rolesPage();
    const next = params().get('next') || details[2];
    const privileged = ['operator', 'reviewer', ...rights.partner, ...rights.center].includes(actor);
    return head('Демонстрационный вход', details[0] + ' · ' + details[1], link('Сменить роль', 'roles', 'secondary')) +
      wrapForm('login', actor,
        dropdown('Способ входа', 'method', ['Email', 'Телефон', 'Внешний сервис'], 'Email') +
        input('Имя', 'name', data.profile.name) +
        input('Телефон', 'phone', 'Демо контакт', 'tel', true, 'Если внешний сервис не передал телефон, заполните поле') +
        input('Email', 'email', 'demo@example.invalid', 'email') +
        input('Код подтверждения', 'code', demoCode, 'text', true, 'Код для демонстрации: 111111') +
        (privileged ? input('Дополнительный код', 'factor', demoCode, 'text') : '') +
        `<input type="hidden" name="next" value="${text(next)}">`, 'Подтвердить и войти', 'roles') +
      note('В демоверсии используется условное подтверждение. Номера, письма и коды не отправляются.');
  }
  function accountPage() {
    return head('Единый аккаунт', pageActor()[0] + ' · ' + pageActor()[1], link('Сменить кабинет', 'roles', 'secondary')) +
      block(card('Способы входа', table(['Способ', 'Действие'], data.profile.ways.map(way =>
        [text(way), action('Отключить', 'unlink', way)])) + wrapForm('link-account', '',
          dropdown('Привязать способ', 'method', ['Email', 'Телефон', 'Внешний сервис']) +
          input('Код владельца', 'code', demoCode) +
          dropdown('Совпавший адрес другого аккаунта', 'conflict', [['no', 'Нет'], ['yes', 'Да']]), 'Подтвердить владельца')),
        card('Доступ и уведомления', wrapForm('preferences', '',
          dropdown('Внешний канал', 'channel', ['В портале', 'Email', 'Push', 'Telegram', 'MAX', 'VK']) +
          dropdown('Согласие на рекламные сообщения', 'marketing', [['no', 'Нет'], ['yes', 'Да']], data.profile.marketing ? 'yes' : 'no'),
          'Сохранить') + pack(link('Уведомления', 'mvp-notices', 'secondary'),
          action('Завершить сеанс на устройстве', 'guest'))));
  }
  function noticePage() {
    const visible = data.notices.filter(n => n.to.some(allow));
    return head('Уведомления', pageActor()[0] + ' · ' + pageActor()[1]) +
      (visible.length ? visible.map(n => card(n.title, `<p>${text(n.detail)}</p><p class="muted">${showDate(n.at)}</p>` +
        (Object.keys(n.delivery).length ? table(['Канал', 'Доставка'], Object.entries(n.delivery).map(([k, v]) => [text(k), text(v)])) : '') +
        pack(action(n.read.includes(data.actor) ? 'Прочитано' : 'Отметить прочитанным', 'notice-read', n.id),
          allow('staff') && Object.values(n.delivery).includes('Ошибка') ? action('Повторить отправку', 'notice-retry', n.id) : '',
          allow('staff') && Object.values(n.delivery).includes('Ожидает отправки') ? action('Смоделировать сбой доставки', 'notice-fail', n.id) : ''))).join('')
        : note('Здесь появятся события ваших сценариев.'));
  }
  function launch(id) {
    const item = scenarios.find(s => s.id === id);
    check(item && routes[item.route.split('?')[0]], 'Сценарий недоступен.');
    setActor(item.actor);
    return item.route;
  }
  const scenarios = [];
  function describe(title, actor, destination, codes, steps) {
    scenarios.push({id: String(scenarios.length + 1), title, actor, route: destination, codes, steps});
  }
  function scenarioPage() {
    return head('Бизнес-процессы FIVEROX', 'Кликабельный MVP по ТЗ от 12 ноября 2026 года.',
      link('Кабинеты', 'roles', 'secondary')) +
      note('Сценарий открывается с указанной ролью. Записи, статусы и уведомления сохраняются в этом браузере. Используйте демоданные.') +
      block(...scenarios.map(s => card(s.title,
        `<p class="muted">${text(s.codes)} · ${text(actorList[s.actor][0])}</p>` + list(s.steps) +
        pack(action('Начать сценарий', 'scenario', s.id, 'primary')))));
  }
  function opsPage() {
    return head('Настройки и журнал', 'Демо-операции FIVEROX', link('Обзор FIVEROX', 'admin', 'secondary')) +
      block(card('Контроль времени', note('Текущее время демо: ' + showDate(data.now) + ' МСК.') +
        pack(action('+30 минут', 'time', '30'), action('+2 часа', 'time', '120'), action('+1 день', 'time', '1440'),
          action('+21 день', 'time', '30240'))),
        card('Восстановление и каналы', pack(action('Сохранить контрольную копию', 'backup'),
          action('Проверить восстановление', 'restore'), link('Режимы приложений', 'mvp-channels', 'secondary')) +
          `<p>${text(data.settings.backupResult || 'Контрольное восстановление сравнивает роли, записи и журнал копии.')}</p>`)) +
      card('Журнал действий', table(['Дата', 'Роль', 'Действие', 'Основание'], data.log.slice(0, 40).map(x =>
        [showDate(x.at), text(actorList[x.actor]?.[0]), text(x.title), text(x.detail)])));
  }
  function channelPage() {
    return head('Каналы и единый аккаунт', 'Веб, Android, iPhone и мини-приложения используют один профиль в демо.') +
      table(['Канал', 'Сценарии', 'Открыть режим'], [
        ['Веб', 'Общий профиль и все доступные роли', action('Веб', 'view', 'desktop')],
        ['Android', 'Мобильный режим', action('Android', 'view', 'mobile')],
        ['iPhone', 'Мобильный режим', action('iPhone', 'view', 'mobile')],
        ...['telegram', 'max', 'vk'].map(mode => [mode.toUpperCase(), 'Режим мини-приложения', action('Открыть', 'view', mode)]),
      ]) + pack(link('Мой аккаунт', 'mvp-account', 'secondary'), link('Карта процессов', 'mvp-processes', 'secondary'));
  }

  function install() {
    add('mvp-processes', 'MVP01', 'Бизнес-процессы FIVEROX', 'Кабинеты', null, scenarioPage);
    add('mvp-login', 'MVP02', 'Демонстрационный вход', 'Кабинеты', null, loginPage);
    add('mvp-account', 'MVP03', 'Единый аккаунт', 'Кабинеты', ['learner','candidate'], accountPage);
    add('mvp-notices', 'MVP04', 'Уведомления', 'Кабинеты', null, noticePage);
    add('mvp-ops', 'MVP05', 'Настройки и журнал', 'Администратор', 'staff', opsPage);
    add('mvp-channels', 'MVP06', 'Каналы и единый аккаунт', 'Кабинеты', null, channelPage);
    override('roles', null, rolesPage);
    const oldMap = routes.screens.render;
    override('screens', null, () => pack(link('Бизнес-процессы по ТЗ', 'mvp-processes', 'primary')) + oldMap());
    for (const items of Object.values(menus)) {
      items.push(['Уведомления', 'mvp-notices'], ['Единый аккаунт', 'mvp-account']);
    }
    menus.admin.push(['Настройки и журнал', 'mvp-ops']);
    describe('Вход, кабинеты и права', 'guest', 'roles', 'AT-01–04 · AT-17', [
      'Откройте публичный каталог и запросите кабинет партнёра.',
      'Пройдите демонстрационный вход и дополнительную проверку администратора.',
      'Проверьте переключение категорий и ограничения доступа.',
    ]);
    describe('Уведомления, восстановление и платформы', 'operator', 'mvp-ops', 'AT-34–36', [
      'Проверьте журнал и повтор неудачной доставки.',
      'Создайте копию и проверьте восстановление в демо.',
      'Переключите устройства и каналы с тем же профилем.',
    ]);
    task('scenario', null, launch);
    task('guest', null, () => {setActor('guest'); return 'home';});
    task('time', 'staff', minutes => {data.now += Number(minutes) * 60000; return 'mvp-ops';});
    task('view', null, mode => { updateView(mode); });
    task('backup', 'staff', () => {
      const copy = JSON.stringify({actor: data.actor, records: data.records, log: data.log, notices: data.notices});
      data.settings.backup = copy;
      data.settings.backupResult = 'Контрольная копия демо сохранена.';
    });
    task('restore', 'staff', () => {
      check(data.settings.backup, 'Сначала сохраните контрольную копию.');
      const copy = JSON.parse(data.settings.backup);
      check(actorList[copy.actor] && copy.records && Array.isArray(copy.log), 'Копия не прошла проверку.');
      data.settings.backupResult = 'Контрольная копия открыта: ' + Object.keys(copy.records).length +
        ' реестров, ' + copy.log.length + ' записей журнала. Роль: ' + actorList[copy.actor][0] + '.';
      record('Контрольное восстановление', data.settings.backupResult);
    });
    task('notice-read', null, id => {
      const n = data.notices.find(item => item.id === id && item.to.some(allow));
      check(n, 'Уведомление недоступно.');
      if (!n.read.includes(data.actor)) n.read.push(data.actor);
    });
    task('notice-fail', 'staff', id => {
      const n = data.notices.find(item => item.id === id);
      check(n, 'Уведомление не найдено.');
      for (const channel of Object.keys(n.delivery)) if (n.delivery[channel] === 'Ожидает отправки') n.delivery[channel] = 'Ошибка';
      record('Сбой внешней доставки', n.id + ' · исходная операция сохранена');
    });
    task('notice-retry', 'staff', id => {
      const n = data.notices.find(item => item.id === id);
      check(n, 'Уведомление не найдено.');
      for (const channel of Object.keys(n.delivery)) if (n.delivery[channel] === 'Ошибка') n.delivery[channel] = 'Доставлено';
      record('Повтор доставки', n.id);
    });
    form('login', null, (id, values) => {
      check(values.get('code') === demoCode, 'Код подтверждения не совпадает.');
      const privileged = ['operator', 'reviewer', ...rights.partner, ...rights.center].includes(id);
      check(!privileged || values.get('factor') === demoCode, 'Нужно подтвердить дополнительный фактор.');
      check(values.get('name') && values.get('email'), 'Заполните имя и email.');
      check(values.get('phone'), 'Укажите телефон для регистрации.');
      data.profile.name = String(values.get('name'));
      setActor(id);
      record('Демонстрационный вход', actorList[id][0]);
      const next = String(values.get('next') || '').replace(/^#\/?/, '');
      return routes[next.split('?')[0]] && allow(gates.get(next.split('?')[0])) ? next : actorList[id][2];
    });
    form('link-account', null, (_, v) => {
      check(v.get('conflict') === 'no', 'Другой аккаунт найден. Объединение требует отдельной проверки владельца.');
      check(v.get('code') === demoCode, 'Подтвердите владение.');
      if (!data.profile.ways.includes(v.get('method'))) data.profile.ways.push(v.get('method'));
      record('Привязка входа', String(v.get('method')));
    });
    task('unlink', null, method => {
      check(data.profile.ways.length > 1, 'Оставьте хотя бы один способ входа.');
      data.profile.ways = data.profile.ways.filter(way => way !== method);
      record('Отключение входа', method);
    });
    form('preferences', null, (_, v) => {
      data.profile.preferences = ['В портале', v.get('channel')].filter((x, index, all) => all.indexOf(x) === index);
      data.profile.marketing = v.get('marketing') === 'yes';
    });
    for (const job of jobs) job();
    setupRender();
    const referral = params().get('ref');
    if (referral && !data.settings.firstReferral && data.actor === 'guest') {
      data.settings.firstReferral = referral.slice(0, 50);
      persist();
    }
    render();
  }
  return {
    get data() { return data; }, actors: actorList, rights, add, override, allow, action, pack, card,
    note, block, list, text, caption, wrapForm, input, dropdown, upload, params, route, registry,
    find, create, change, showDate, dateOnly, record, notify, task, form, onExpire, onInstall,
    install, describe, check, owner, labels, pageActor, setActor, switchTo, persist, gate: id => gates.get(id),
  };
})();

