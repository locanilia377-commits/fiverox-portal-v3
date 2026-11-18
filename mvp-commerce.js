
'use strict';

const MVPFinance = (() => {
  const M = MVP;
  const {add, override, card, block, note, pack, caption, action, text, input, dropdown, wrapForm, route, showDate} = M;
  const day = 86400000;
  const financeActors = ['customer', 'partner', 'staff'];
  const productActors = ['guest', 'customer', 'partner', 'center', 'staff'];
  const categories = [
    'Эксклюзивный дистрибьютор', 'Официальный дистрибьютор', 'Дилер', 'Авторизованный АСЦ',
    'Сертифицированный АСЦ', 'Фирменный АСЦ', 'Партнёр по дропшиппингу',
  ];
  const phases = {
    new: 'Новая', work: 'В обработке', clarify: 'Требуется уточнение', approved: 'Согласована',
    linked: 'Передана в 1С', done: 'Исполнена', canceled: 'Отменена',
  };
  const balances = {
    product: 'Товарные бонусы', school: 'Учебные бонусы', refWaiting: 'Реферальные бонусы',
    reference: 'Денежное вознаграждение по рефералам', drop: 'Вознаграждение дропшиппинга',
    mdf: 'MDF', retro: 'Ретробонус',
  };
  const requests = () => M.registry('orders');
  const ledger = () => M.registry('ledger', [
    {id:'LD-DEMO-1', program:'mdf', owner:'dealer', amount:12000, event:'manual-mdf', reason:'Демо начисление', at:M.data.now},
    {id:'LD-DEMO-2', program:'retro', owner:'dealer', amount:8000, event:'manual-retro', reason:'Демо начисление', at:M.data.now},
    {id:'LD-DEMO-3', program:'reference', owner:'client', amount:1200, event:'demo-ref', reason:'Конвертация демо начисления', at:M.data.now},
  ]);
  const supportRequests = () => M.registry('fundRequests');
  const partnerApps = () => M.registry('partnerApps', [{
    id:'PART-DEMO', owner:'candidate', org:'Демо-кандидат', category:'Дилер', status:'Подана', tasks:[],
    comms:[], contract:null,
  }]);
  const plans = () => M.registry('payouts');
  const toNumber = (value, min = 0, max = 100000000) => {
    const n = Number(value);
    M.check(String(value).trim() && Number.isFinite(n) && n >= min && n <= max, 'Проверьте значение суммы или количества.');
    return n;
  };
  function addEntry(program, owner, amount, event, reason, days) {
    if (ledger().some(x => x.program === program && x.owner === owner && x.event === event)) return;
    const expiry = days ? M.data.now + days * day : null;
    M.create('ledger', 'L', {program, owner, amount, event, reason, expiry, at:M.data.now});
  }
  function balance(program, owner) {
    if(program==='refWaiting')return M.registry('refEvents').filter(x=>x.owner===owner&&x.valid&&!x.converted).reduce((sum,x)=>sum+x.amount,0);
    return ledger().filter(x => x.program === program && x.owner === owner && (!x.expiry || x.expiry > M.data.now))
      .reduce((sum, x) => sum + x.amount, 0);
  }
  function spendPoints(owner,amount,reference,total) {
    const productPoints=Math.max(0,balance('product',owner));
    const schoolPoints=Math.max(0,balance('school',owner));
    M.check(Number.isFinite(amount)&&amount>0&&amount<=total*0.2&&amount<=productPoints+schoolPoints,
      'Сумма выше баланса или демо лимита 20%.');
    const productPart=Math.min(amount,productPoints);
    if(productPart)addEntry('product',owner,-productPart,'spend:'+reference,'Списание на заявку '+reference);
    if(amount>productPart)addEntry('school',owner,-(amount-productPart),'spend:'+reference,'Списание на заявку '+reference);
  }
  function priceInfo(product) {
    const updated = M.data.products[product.id];
    return {...product, sku:'FRX-' + product.id, price:updated?.price ?? product.price, available:updated?.qty};
  }
  function priceFor(product) {
    const partner = M.allow(['partner', 'center']);
    const adjustment = ({distributor:0.04, official:0.02, dealer:0, drop:0, asc:0.08, ascCertified:0.06, ascBrand:0.03})[M.data.actor] || 0;
    return partner ? Math.round(product.dealer * (1 + adjustment)) : product.price;
  }
  function toLine(productId, quantity) {
    const p = products.find(x => String(x.id) === String(productId));
    M.check(p && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 500, 'Укажите товар и целое количество.');
    const product = priceInfo(p);
    return {id:product.sku, name:product.name, brand:brandData[product.brand].name, quantity, rrp:product.price,
      price:priceFor(product), returned:0, unitsShipped:0};
  }
  function showLines(lines, trade) {
    const cols = ['Артикул / товар', 'Количество', 'РРЦ', ...(trade ? ['Цена партнёра', 'Разница'] : []), 'Сумма'];
    return table(cols, lines.map(l => [
      text(l.id + ' · ' + l.name), l.quantity, money(l.rrp),
      ...(trade ? [money(l.price), money((l.rrp - l.price) * l.quantity)] : []), money(l.price * l.quantity),
    ]));
  }
  function orderRoute(id) { return route('mvp-order', {id}); }
  function fetchOrder(id) {
    const list = requests().filter(x => M.allow('staff') || x.owner === M.data.actor || (x.owner === 'guest' && M.data.actor === 'client'));
    const item = id ? list.find(x => x.id === id) : list[0];
    M.check(item, 'Заявка недоступна для этой роли или организации.');
    return item;
  }
  function orderPage() {
    let o;
    try {o = fetchOrder(M.params().get('id'));} catch (err) {
      return head('Товарная заявка', err.message, link('Мои заявки', 'mvp-orders', 'secondary'));
    }
    const isStaff = M.allow('staff');
    const reserve = o.reserve || {};
    return head(text(o.id) + ' · Товарная заявка', 'Статус: ' + phases[o.status], link('Реестр заявок', 'mvp-orders', 'secondary')) +
      block(card('Состав заявки', showLines(o.lines, o.trade) +
        (o.trade ? note('Потенциальная разница в цене без учёта расходов.') : '') +
        (o.address ? '<p>' + text(o.address) + '</p>' : '') +
        (o.bonusUsed ? '<p>Списано бонусов: ' + text(o.bonusUsed) + '</p>' : '')),
      card('Резерв, оплата и отгрузка', table(['Резерв', 'Оплата', 'Отгрузка', 'Заказ 1С'], [[
        text(reserve.status || 'Отсутствует'), o.paid ? 'Подтверждена вне портала' : 'Ожидается', o.shipped ? 'Отгружено' : 'Ожидается', text(o.external || '—'),
      ]]) + (reserve.until ? note('Действует до ' + showDate(reserve.until) + ' МСК.') : '') +
        (o.documents ? '<p>' + text(o.documents) + '</p>' : '') +
        (o.drop ? note('Вознаграждение: ' + money(o.drop.amount) + ' · версия условий ' + o.drop.version + ' · ' + o.drop.status) : ''))) +
      (isStaff ? block(card('Действия FIVEROX', pack(
        o.status === 'new' ? action('Принять в работу', 'order-state', o.id + ':work', 'primary') : '',
        o.status === 'work' ? action('Запросить уточнение', 'order-state', o.id + ':clarify') : '',
        ['work','clarify'].includes(o.status) ? action('Согласовать', 'order-state', o.id + ':approved', 'primary') : '',
        ['new','work','clarify','approved'].includes(o.status) ? action('Отменить', 'order-state', o.id + ':canceled') : '') +
        (['approved','linked'].includes(o.status) ? wrapForm('reserve', o.id, input('Срок удержания, минут', 'minutes', 30, 'number') +
          dropdown('Модель учёта', 'source', ['Демо · ручной учёт','Демо · 1С']), reserve.status === 'Активен' ? 'Продлить резерв' : 'Подтвердить и резервировать') : '') +
        (reserve.status === 'Активен' ? pack(action('Освободить резерв', 'release-reserve', o.id)) : '') +
        (o.status === 'approved' ? wrapForm('order-link', o.id, input('Номер вручную созданного заказа в 1С', 'external', '1C-' + o.id), 'Связать с 1С') : '')),
      card('Входящие изменения из 1С', o.external ? wrapForm('order-sync', o.id,
        dropdown('Событие', 'kind', [['pay','Подтверждена внешняя оплата'],['ship','Отгрузка'],['unpay','Отмена факта оплаты'],['unship','Отмена отгрузки']]) +
        input('Номер входящего события', 'event', 'E-01') + input('Документ', 'document', 'Демо документ 1С', 'text', false), 'Смоделировать событие') +
        (o.shipped ? wrapForm('order-return', o.id, dropdown('Строка', 'line', o.lines.map(l => [l.id,l.name])) +
          input('Количество к возврату', 'quantity', 1, 'number'), 'Зафиксировать частичный возврат') : '') +
        (o.drop && o.paid && o.shipped ? pack(action('Проверить вознаграждение', 'drop-check', o.id)) : '')
        : note('Свяжите заявку с заказом, который сотрудник создал в 1С.'))) : '');
  }
  function orderList() {
    const list = requests().filter(x => M.allow('staff') || x.owner === M.data.actor || (x.owner === 'guest' && M.data.actor === 'client'));
    return head('Заявки на товары', M.pageActor()[0] + ' · ' + M.pageActor()[1], link('Новая заявка', 'mvp-order-new', 'primary')) +
      (list.length ? table(['Номер', 'Заявка', 'Резерв', 'Исполнение'], list.map(x => [
        link(text(x.id), orderRoute(x.id), 'secondary'), caption(phases[x.status]), text(x.reserve?.status || 'Отсутствует'),
        x.shipped ? 'Отгружено' : 'Ожидается',
      ])) : note('В этом кабинете пока нет заявок.'));
  }
  function checkout() {
    const lines = state.cart.map(x => toLine(x.id,x.qty));
    return head('Заявка на товар', 'FIVEROX проверит наличие, цену и способ исполнения.') +
      (lines.length ? block(wrapForm('order-new', 'cart', requestFields(false), 'Отправить заявку', 'cart'),
        card('Состав заявки', showLines(lines,M.allow(['partner','center'])) +
          note('Резерв появится после подтверждения сотрудником. Оплата проводится вне портала.')))
        : note('Добавьте материалы в корзину.') + pack(link('В каталог','catalog','primary')));
  }
  function requestFields(includeProduct, drop = false) {
    const points = balance('product', M.owner()) + balance('school', M.owner());
    return (includeProduct ? dropdown('Материал', 'product', products.map(p => [String(p.id),brandData[p.brand].name + ' · ' + p.name])) +
      input('Количество', 'quantity', 1, 'number') : '') +
      input(drop ? 'Клиент получатель' : 'Имя для связи', 'customer', 'Демо-клиент') +
      input('Контакт для связи', 'contact', 'Демо контакт') +
      dropdown('Получение', 'delivery', ['Самовывоз','Доставка']) +
      input('Адрес или пожелания', 'address', '', 'text', false) +
      (M.allow('customer') ? input('Использовать бонусы', 'bonus', 0, 'number', false, 'Доступно ' + Math.max(0,points) + '. Демо лимит 20% суммы.') : '');
  }
  function directOrder(drop = false) {
    return head(drop ? 'Дропшиппинг · покупка от имени партнёра' : 'Новая заявка на товар',
      drop ? 'FIVEROX определяет конечную цену и отгружает получателю.' : 'Условия цены фиксируются в заявке.',
      link('Мои заявки','mvp-orders','secondary')) +
      block(wrapForm('order-new', drop ? 'drop' : 'single', requestFields(true,drop), 'Отправить заявку'),
        card('Цены и наличие', showLines(products.map(p => toLine(p.id,1)),M.allow(['partner','center'])) +
          note(M.allow(['partner','center']) ? 'Разница между РРЦ и ценой партнёра указана без учёта расходов.' :
            'Публичные цены. Резерв и оплата подтверждаются отдельно.') +
          (M.data.settings.lastSync ? '<p>Обновление демо 1С: ' + showDate(M.data.settings.lastSync) + '</p>' : '')));
  }
  function partnerPage() {
    const staff = M.allow('staff');
    const isPartner = M.allow('partner');
    const apps = partnerApps().filter(x => staff || x.owner === M.data.actor);
    return head(isPartner ? 'Документы и материалы партнёра' : 'Подключение партнёров',
      staff ? 'Воронка, договор и выдача доступа.' : 'Заявка, вводные материалы и договор.',
      link('Сменить кабинет','roles','secondary')) +
      (staff || !isPartner ? wrapForm('partner-create', '', input('Организация', 'org', 'Демо-организация') +
        dropdown('Предполагаемая категория', 'category', categories), staff ? 'Создать заявку вручную' : 'Подать заявку') : '') +
      apps.map(p => card(p.id + ' · ' + p.org, '<p>' + text(p.category) + ' · ' + caption(p.status) + '</p>' +
        (p.status === 'Подана' ? '' : note('Вводные материалы: каталог, обучение, условия партнёрства.')) +
        (p.contract ? '<p>Договор: ' + text(p.contract) + ' · ' + text(p.sign || 'Ожидает подписания') + '</p>' : '') +
        (staff ? pack(p.status === 'Подана' ? action('Принять в работу','partner-review',p.id,'primary') : '',
          p.status === 'В работе' ? action('Одобрить кандидата','partner-approve',p.id) : '',
          p.status === 'Подписан · на проверке' ? action('Проверить договор и открыть кабинет','partner-verify',p.id,'primary') : '') +
          wrapForm('partner-staff', p.id, input('Ответственный', 'lead', p.lead || 'Демо-менеджер') +
            input('Задача', 'task','', 'text', false) + input('Коммуникация', 'communication','', 'text', false) +
            dropdown('Категория', 'category', categories, p.category) +
            dropdown('Подготовка договора', 'contractMode', [['template','Из шаблона'],['file','Загрузка'],['none','Оставить текущий']],'none') +
            M.upload('Файл договора', 'contractFile'), 'Сохранить обработку') : '') +
        (!staff && p.contract && p.status === 'Одобрена' ? wrapForm('partner-sign', p.id,
          dropdown('Подписание', 'method', ['Подписано вне платформы','Демо сервис подписи']) +
          M.upload('Копия подписанного договора', 'signedFile'), 'Передать на проверку') : '') +
        (staff && p.tasks.length ? M.list(p.tasks) : '') +
        (staff && p.comms.length ? M.list(p.comms) : '') +
        (p.status === 'Договор проверен' ? pack(action('Открыть партнёрский кабинет', 'become-partner', p.id, 'primary')) : '')
      )).join('') +
      (isPartner ? block(card('Материалы по категории', M.list(['Прайс-лист • демо', 'Договоры', 'Технические документы', 'Брендбук', 'Рекламные материалы', 'Инструкции']) +
        pack(link('Обучение','learn-programs','secondary'),link('Мероприятия','mvp-events','secondary'),link('Маркетинговая поддержка','mvp-funds','primary'))),
      card('Пользователи и делегирование', wrapForm('partner-role','',input('Название своей роли','role','Менеджер демо') +
        dropdown('Разрешение','permission',['Просмотр своих заявок','Работа с каталогом']), 'Создать роль') +
        table(['Роль','Права'], M.registry('delegations').filter(x=>x.owner===M.data.actor).map(x=>[text(x.name),text(x.permission)])))) : '');
  }
  function adjustment() {
    const current = M.data.settings.dropTerms || {rate:5,version:1};
    return head('Дропшиппинг', 'Ставка сохраняется в каждой заявке и действует для неё до завершения.',
      link('Новая заявка получателю', 'mvp-drop-new', 'primary')) +
      block(card('Действующие демо условия', note('Ставка ' + current.rate + '% · версия ' + current.version) +
        (M.allow('staff') ? wrapForm('drop-terms','',input('Новая ставка, %','rate',current.rate,'number') +
          input('Причина изменения','reason','Демо пересмотр'),'Применить к новым заказам') : '')),
        card('Заявки и сверка', table(['Заявка','Версия','Ставка','Начисление','Статус'], requests().filter(x=>x.drop&&(M.allow('staff')||x.owner===M.data.actor)).map(x=>[
          link(text(x.id),orderRoute(x.id),'secondary'), x.drop.version,x.drop.rate+'%',money(x.drop.amount),text(x.drop.status),
        ])) + (M.allow('staff') ? pack(action('Провести месячную сверку','drop-settle')) : pack(link('История начислений и выплат','mvp-balances','secondary')))));
  }
  function balancePage() {
    const who = M.allow('staff') ? M.params().get('owner') || 'client' : M.data.actor;
    const programList = M.allow('customer') ? ['product','school','refWaiting','reference'] :
      M.allow('partner') ? ['drop','mdf','retro'] : Object.keys(balances);
    const source = ledger().filter(x=>x.owner===who && programList.includes(x.program));
    return head('Баланс и история начислений', M.pageActor()[0] + ' · демо правила', link('Публичные калькуляторы','mvp-calculators','secondary')) +
      block(...programList.map(code => kpi(balances[code], money(balance(code,who)),
        ['product','school'].includes(code) ? 'На товары и обучение' : 'Отдельный счёт'))) +
      card('Журнал операций', table(['Приход / расход','Счёт','Основание','Срок/дата'], source.slice(0,45).map(x=>[
        money(x.amount),text(balances[x.program]),text(x.reason),showDate(x.expiry||x.at),
      ]))) + pack(link('Рефералы', 'mvp-referrals','secondary'), link('Выплаты', 'mvp-payouts','secondary'),
        M.allow(['partner','staff']) ? link('Фонды', 'mvp-funds','secondary') : '') +
      (M.allow('staff') ? wrapForm('demo-points','',dropdown('Счёт','program',[['product','Товарные бонусы'],['school','Учебные бонусы']]) +
        input('Коррекция','amount',-200,'number') + input('Причина','reason','Индивидуальный пересчёт при возврате'), 'Зафиксировать корректировку') : '');
  }
  function referrals() {
    const first = M.data.settings.firstReferral;
    const refEvents = M.registry('refEvents').filter(e=>M.allow('staff')||e.owner===M.data.actor);
    return head('Реферальная программа', 'Первый пригласивший сохраняется, денежная конвертация учитывается отдельно.',
      link('Баланс','mvp-balances','secondary')) +
      block(card('Приглашения', '<p>Демо промокод: FRX-DEMO-1042</p>' +
        pack(link('Пример ссылки',route('mvp-referrals',{invite:'FRX-DEMO-1042'}),'secondary')) +
        wrapForm('referral-bind','',input('Промокод','code',M.params().get('invite') || 'FRX-DEMO-1042'),'Учесть приглашение') +
        note(first ? 'Первый пригласивший: '+first : 'Первого приглашения ещё нет.')),
        card('Конвертация и покупки', table(['Основание','До конвертации','Статус'], refEvents.map(e=>[
          text(e.type),e.ready?showDate(e.ready):'Ожидание условий',text(e.converted?'Конвертировано':'Ожидает'),
        ])) + note('Товар: оплата, отгрузка и 21 день без возврата. Курс: более позднее из оплаты и первого завершённого урока, затем настраиваемый срок.') +
          (M.allow('staff') ? pack(action('Зарегистрировать демо приглашённого','ref-seed'),
            action('Проверить конвертацию сейчас','ref-advance')) : pack(link('Создать заявку на выплату','mvp-payouts','primary')))));
  }
  function payouts() {
    const isStaff=M.allow('staff');
    const visible=plans().filter(p=>isStaff||p.owner===M.data.actor);
    return head('Заявки на выплату', 'Сотрудник проверяет заявку, перечисление проводится вне портала.',
      link('Баланс','mvp-balances','secondary')) +
      (!isStaff ? wrapForm('payout-new','',
        dropdown('Источник','program',M.allow('partner')?[['drop','Дропшиппинг']]:[['reference','Денежное реферальное вознаграждение']]) +
        input('Сумма','amount',500,'number') + dropdown('Способ','method',['Банковские реквизиты','СБП']) +
        input('Банк или условный реквизит','bank','Демо-банк'),'Подать заявку') : '') +
      table(['Номер','Сумма','Способ','Статус','Действия'],visible.map(p=>[
        text(p.id),money(p.amount),text(p.method),caption(p.status),isStaff ? pack(
          p.status==='На проверке' ? action('Одобрить','payout-approve',p.id) + action('Отклонить','payout-reject',p.id) : '',
          p.status==='Одобрена' ? action('Зафиксировать внешний перевод','payout-paid',p.id) : '') : '',
      ]));
  }
  function funds() {
    const holder=M.allow('staff')?'dealer':M.data.actor;
    return head('Маркетинговая поддержка и фонды', M.pageActor()[0] + ' · модель демо',
      link('Журнал начислений','mvp-balances','secondary')) +
      block(kpi('MDF',money(balance('mdf',holder))),kpi('Ретробонус',money(balance('retro',holder)))) +
      (M.allow('staff') ? wrapForm('fund-credit','',dropdown('Счёт','program',[['mdf','MDF'],['retro','Ретробонус']]) +
        input('Сумма','amount',1000,'number') + input('Основание','reason','Ручное начисление демо'), 'Внести начисление')
        : wrapForm('fund-new','',dropdown('Действие','kind',[['support','Товар или услуга из каталога'],['refund','Возмещение расходов'],['transfer','Перевод между фондами']]) +
          dropdown('Счёт списания','program',[['mdf','MDF'],['retro','Ретробонус']]) + input('Сумма','amount',500,'number') +
          input('Услуга или пожелания','description','Оформление витрины') + M.upload('Документ','doc'), 'Отправить заявку')) +
      table(['Заявка','Счёт','Назначение','Сумма','Статус','Решение'],supportRequests().filter(r=>M.allow('staff')||r.owner===holder).map(r=>[
        text(r.id),text(balances[r.program]),text(r.description),money(r.amount),caption(r.status),
        M.allow('staff')&&r.status==='На проверке' ? action('Подтвердить','fund-approve',r.id,'primary')+action('Отклонить','fund-reject',r.id) : '',
      ]));
  }
  function calc() {
    const r=M.data.settings.calculation;
    return head('Калькуляторы FIVEROX','Оценка по открытым демонстрационным допущениям.') +
      wrapForm('calculate','',dropdown('Расчёт','kind',[['partner','Партнёрская разница'],['bonuses','Бонусы'],['ref','Реферальное вознаграждение']]) +
        input('Розничная сумма / РРЦ','retail',69000,'number') + input('Закупочная цена','cost',48500,'number') +
        input('Количество единиц','qty',1,'number') + input('Демо ставка, %','rate',5,'number'), 'Рассчитать') +
      (r ? card('Результат', '<p>' + text(r.formula) + '</p><strong>' + money(r.amount) + '</strong>') : '') +
      note('Партнёрская разница = (РРЦ − цена партнёра) × количество. Бонусы и рефералы = сумма × демо ставка. Фактические условия задаёт FIVEROX.');
  }
  function syncPage() {
    return head('Обмен с 1С', 'Ручная связь заявки с заказом и входящие демо события.',link('Заявки','mvp-orders','secondary')) +
      wrapForm('sync-catalog','',dropdown('Товар','product',products.map(p=>[String(p.id),p.name])) +
        input('РРЦ','price',69000,'number') + input('Доступный остаток','stock',5,'number') +
        input('Номер версии события','version',1,'number') + dropdown('Результат обмена','outcome',['Синхронизировано','Ошибка']), 'Запустить обмен') +
      note('Последнее подтверждённое обновление: ' + showDate(M.data.settings.lastSync) + '. При сбое наличие требует подтверждения.') +
      table(['Документ','Время','Статус','Действие'],M.registry('sync').map(x=>[text(x.id),showDate(x.at),caption(x.status),
        x.status==='Ошибка'?action('Повторить и сверить','sync-retry',x.id):'']));
  }

  M.onInstall(() => {
    add('mvp-orders','MVP10','Заявки на товары','Кабинеты',productActors,orderList);
    add('mvp-order','MVP11','Товарная заявка','Кабинеты',productActors,orderPage);
    add('mvp-order-new','MVP12','Новая заявка','Интернет-магазин',productActors,()=>directOrder());
    add('mvp-partner','MVP13','Подключение партнёра','Кабинеты',null,partnerPage);
    add('mvp-drop','MVP14','Дропшиппинг','Дилер',['drop','staff'],adjustment);
    add('mvp-drop-new','MVP15','Заявка от дропшиппинг-партнёра','Дилер','drop',()=>directOrder(true));
    add('mvp-balances','MVP16','Баланс и история начислений','Кабинеты',financeActors,balancePage);
    add('mvp-referrals','MVP17','Реферальная программа','Кабинеты',financeActors,referrals);
    add('mvp-payouts','MVP18','Заявки на выплату','Кабинеты',financeActors,payouts);
    add('mvp-funds','MVP19','Маркетинговая поддержка и фонды','Дилер',['partner','staff'],funds);
    add('mvp-calculators','MVP21','Калькуляторы','Публичный портал',null,calc);
    add('mvp-1c','MVP22','Обмен с 1С','Администратор','staff',syncPage);
    override('checkout',null,checkout);
    const oldCart=routes.cart.render;
    override('cart',null,()=>oldCart().replace('Ваш заказ в магазине FIVEROX.','Материалы для товарной заявки.').replace('Оформить заказ','Оформить заявку'));
    override('client-orders','customer',orderList);
    override('dealer-orders','partner',orderList);
    override('dealer-new','partner',()=>directOrder(M.allow('drop')));
    override('dealer-order','partner',orderPage);
    override('dealer-budgets','partner',funds);
    override('budget-shop','partner',funds);
    override('budget-success','partner',funds);
    override('admin-budgets','staff',funds);
    override('referral','customer',referrals);
    override('withdrawal','customer',payouts);
    override('withdrawal-success','customer',payouts);
    override('retail-success',null,orderList);
    override('dealer','partner',null);
    for(const id of ['dealer-debt','dealer-sales','sales-success','dealer-rating']) override(id,'partner',null);
    const oldDealer=routes.dealer.render;
    override('dealer','partner',()=>oldDealer()+pack(link('Мои заявки','mvp-orders','primary'),link('Документы и материалы','mvp-partner','secondary'),
      link('Маркетинговая поддержка','mvp-funds','secondary'),M.allow('drop')?link('Дропшиппинг','mvp-drop','secondary'):''));
    for(const id of ['partners-dealer','partners-service']){
      const previous=routes[id].render;
      override(id,null,()=>previous()+pack(link('Подать заявку партнёра','mvp-partner','primary'),link('Посчитать условия','mvp-calculators','secondary')));
    }
    const oldCatalog=routes.catalog.render;
    override('catalog',null,()=>oldCatalog()+pack(link('Публичные калькуляторы','mvp-calculators','secondary'),link('Мои заявки','mvp-orders','secondary')));
    menus.dealer.push(['Документы партнёра','mvp-partner'],['Балансы и операции','mvp-balances']);
    menus.client.push(['Бонусные счета','mvp-balances']);
    menus.admin.push(['Товарные заявки','mvp-orders'],['Партнёрские заявки','mvp-partner'],['Обмен с 1С','mvp-1c'],['Дропшиппинг','mvp-drop'],
      ['Балансы и выплаты','mvp-balances'],['Заявки на выплаты','mvp-payouts']);
    M.describe('Товарная заявка, 1С и резерв', 'client','mvp-order-new','AT-06–08 · AT-26–28',[
      'Отправьте состав заявки. Начального резерва и оплаты нет.',
      'Откройте роль FIVEROX. Согласуйте заявку, задайте резерв и свяжите её с 1С.',
      'Проведите внешнюю оплату и отгрузку. Повторите событие, затем оформите частичный возврат.',
    ]);
    M.describe('Партнёрская заявка и проверка договора','candidate','mvp-partner','AT-04–05',[
      'Подайте заявку. FIVEROX назначает категорию, задачи и готовит договор.',
      'Подпишите договор в кабинете кандидата. Полный доступ появляется после отдельной проверки.',
    ]);
    M.describe('Дропшиппинг и сверка','drop','mvp-drop-new','AT-09 · AT-32',[
      'Создайте заявку получателю. Ставка и версия закрепляются за заявкой.',
      'Смените условия в FIVEROX и сравните новую заявку со старой. Проведите сверку.',
    ]);
    M.describe('Бонусы, рефералы и выплаты','client','mvp-referrals','AT-24 · AT-26–32',[
      'Подставьте первый и второй промокоды.',
      'Просмотрите начисления и контрольные сроки товара и курса.',
      'Подайте заявку на выплату. FIVEROX проверяет и отмечает внешний расчёт.',
    ]);
    M.describe('MDF, ретробонус и маркетинг','dealer','mvp-funds','AT-33',[
      'Создайте заявку на поддержку, возмещение или перевод.',
      'Перейдите в FIVEROX и подтвердите. Суммы списываются и зачисляются по отдельным фондам.',
    ]);
  });

  M.form('order-new', productActors, (mode,v)=>{
    const original = mode==='cart' ? state.cart.map(x=>toLine(x.id,x.qty)) : [toLine(v.get('product'),toNumber(v.get('quantity'),1,500))];
    M.check(original.length, 'Добавьте хотя бы одну позицию.');
    let drop = null;
    if (mode==='drop') {
      M.check(M.allow('drop'), 'Заявка доступна партнёру по дропшиппингу.');
      const terms=M.data.settings.dropTerms || {rate:5,version:1};
      for(const item of original) item.price=item.rrp;
      drop={...terms,status:'Рассчитано',amount:Math.round(original.reduce((s,x)=>s+x.price*x.quantity,0)*terms.rate/100)};
    }
    const order=M.create('orders','FRX-ORD',{
      owner:M.data.actor, trade:M.allow(['partner','center']), lines:original, address:String(v.get('address')||''),
      delivery:String(v.get('delivery')), status:'new', paid:false, shipped:false, sync:[], drop, created:M.data.now,
    });
    const bonus = Number(v.get('bonus') || 0);
    if(bonus>0 && M.allow('customer')){
      spendPoints(order.owner,bonus,order.id,original.reduce((sum,line)=>sum+line.price*line.quantity,0));
      order.bonusUsed=bonus;
    }
    if(mode==='cart') state.cart=[];
    M.notify(['staff'],'Новая товарная заявка',order.id+' · заявка поступила. Резерв отсутствует.',['Email']);
    M.record('Создание товарной заявки',order.id,'1С');
    return orderRoute(order.id);
  });
  M.task('order-state','staff',command=>{
    const [id, target]=command.split(':');
    const order=fetchOrder(id);
    const allowed={work:['new'],clarify:['work'],approved:['work','clarify'],canceled:['new','work','clarify','approved']};
    M.change(order,allowed[target]||[],target);
    if(target==='canceled'&&order.reserve?.status==='Активен') order.reserve.status='Освобождён';
    M.record('Изменение заявки',order.id+' · '+phases[target]);
  });
  M.form('reserve','staff',(id,v)=>{
    const order=fetchOrder(id);
    M.check(['approved','linked'].includes(order.status),'Сначала согласуйте заявку.');
    const minutes=toNumber(v.get('minutes'),1,43200);
    order.reserve={status:'Активен',until:M.data.now+minutes*60000,source:String(v.get('source'))};
    M.record('Срок подтверждённого резерва',id+' до '+showDate(order.reserve.until));
    M.notify([order.owner],'Резерв подтверждён',id+' · '+showDate(order.reserve.until));
  });
  M.task('release-reserve','staff',id=>{
    const order=fetchOrder(id);
    M.check(order.reserve?.status==='Активен','Активный резерв отсутствует.');
    order.reserve.status='Освобождён';
    M.record('Досрочное освобождение',id);
  });
  M.form('order-link','staff',(id,v)=>{
    const o=fetchOrder(id), external=String(v.get('external')).trim();
    M.check(external && !requests().some(x=>x.id!==id&&x.external===external),'Номер 1С уже связан с другой заявкой.');
    M.change(o,['approved'],'linked');
    o.external=external;
    M.record('Связь с вручную перенесённым заказом 1С',id+' → '+external);
  });
  function customerAccrual(o) {
    if(!o.paid||!o.shipped||o.drop) return;
    for(const l of o.lines) {
      const amount=Math.round(l.price*l.unitsShipped*0.05);
      addEntry('product',o.owner,amount,'ship:'+o.id+':'+l.id,'Оплата и отгрузка '+o.id,90);
    }
    const linkOwner = M.data.settings.firstReferral ? 'client' : '';
    const ev = M.registry('refEvents');
    if(linkOwner&&linkOwner!==o.owner&&!ev.some(e=>e.key===o.id)){
      const amount=Math.round(o.lines.reduce((s,l)=>s+(l.unitsShipped-l.returned)*l.price,0)*0.02);
      M.create('refEvents','REF',{key:o.id,owner:linkOwner,type:'Товар '+o.id,ready:M.data.now+21*day,
        amount,valid:true,converted:false,firstPurchase:true});
      for(const e of ev.filter(x=>x.type==='Регистрация'&&x.owner===linkOwner&&!x.ready))e.ready=M.data.now;
    }
  }
  M.form('order-sync','staff',(id,v)=>{
    const o=fetchOrder(id), kind=String(v.get('kind')), event=String(v.get('event')).trim()+':'+kind;
    M.check(o.external&&['pay','ship','unpay','unship'].includes(kind),'Сначала создайте связь с 1С.');
    if(o.sync.includes(event)){toast('Повтор события распознан. Дубль не создан.'); return;}
    o.sync.push(event);
    if(kind==='pay'||kind==='unpay')o.paid=kind==='pay';
    else {
      o.shipped=kind==='ship';
      for(const l of o.lines) l.unitsShipped=o.shipped?l.quantity:0;
    }
    o.status=o.paid&&o.shipped?'done':'linked';
    o.documents=String(v.get('document')||'');
    if((kind==='unpay'||kind==='unship')&&!o.drop) {
      for(const l of o.lines) {
        const key='ship:'+id+':'+l.id;
        const net=ledger().filter(x=>x.program==='product'&&x.owner===o.owner&&
          (x.event===key||x.event.startsWith('return:'+id+':'+l.id+':')||x.event.startsWith('void:'+id+':'+l.id+':'))).reduce((s,x)=>s+x.amount,0);
        if(net>0)addEntry('product',o.owner,-net,'void:'+id+':'+l.id+':'+event,'Отмена события 1С '+id);
      }
      for(const ref of M.registry('refEvents'))if(ref.key===id&&!ref.converted)ref.valid=false;
    }
    customerAccrual(o);
    M.record('Входящее событие',id+' · '+event);
  });
  M.form('order-return','staff',(id,v)=>{
    const o=fetchOrder(id);
    const line=o.lines.find(l=>l.id===v.get('line'));
    const qty=toNumber(v.get('quantity'),1,500);
    M.check(Number.isInteger(qty)&&line&&qty<=line.unitsShipped-line.returned,'Нельзя вернуть больше отгруженного по этой строке.');
    line.returned+=qty;
    if(ledger().some(x=>x.event==='ship:'+id+':'+line.id))addEntry('product',o.owner,-Math.round(line.price*qty*0.05),
      'return:'+id+':'+line.id+':'+line.returned,'Частичный возврат строки '+line.id);
    const ref=M.registry('refEvents').find(x=>x.key===id&&!x.converted);
    if(ref)ref.amount=Math.round(o.lines.reduce((s,l)=>s+(l.unitsShipped-l.returned)*l.price,0)*0.02);
    M.record('Возврат по строке',id+' · '+line.id+' × '+qty);
  });
  M.onExpire(()=>{
    for(const o of requests())if(o.reserve?.status==='Активен'&&o.reserve.until<=M.data.now){
      o.reserve.status='Истёк';
      M.record('Резерв истёк, остаток освобождён',o.id);
      M.notify([o.owner,'staff'],'Резерв освобождён',o.id);
    }
    for(const ev of M.registry('refEvents'))if(ev.ready&&ev.ready<=M.data.now&&ev.valid&&!ev.converted){
      ev.converted=true;
      addEntry('reference',ev.owner,ev.amount,'convert:'+ev.id,'Конвертация · '+ev.type);
    }
  });
  M.form('partner-create',null,(_,v)=>{
    const app=M.create('partnerApps','PART',{owner:M.allow('staff')?'candidate':M.data.actor,org:String(v.get('org')),category:String(v.get('category')),
      status:'Подана',tasks:[],comms:[],contract:null});
    M.notify(['staff'],'Партнёрская заявка',app.id);
    return 'mvp-partner';
  });
  M.task('partner-review','staff',id=>M.change(M.find('partnerApps',id),['Подана'],'В работе'));
  M.task('partner-approve','staff',id=>{
    const p=M.find('partnerApps',id); M.change(p,['В работе'],'Одобрена'); M.notify([p.owner],'Заявка одобрена',p.id+' · ожидается договор');
  });
  M.form('partner-staff','staff',(id,v)=>{
    const p=M.find('partnerApps',id); const previous=p.category;
    p.lead=String(v.get('lead')); p.category=String(v.get('category'));
    if(v.get('task'))p.tasks.push(String(v.get('task')));
    if(v.get('communication'))p.comms.push(String(v.get('communication')));
    if(v.get('contractMode')==='template')p.contract='Договор из шаблона '+id+' · '+p.category;
    if(v.get('contractMode')==='file'){M.check(v.get('contractFile')?.name,'Выберите файл договора.');p.contract=v.get('contractFile').name;}
    M.record('Карточка партнёра',p.id+' · '+previous+' → '+p.category);
  });
  M.form('partner-sign',null,(id,v)=>{
    const p=M.find('partnerApps',id);
    M.check(p.owner===M.data.actor&&p.contract,'Договор недоступен.');
    if(v.get('method')==='Подписано вне платформы')M.check(v.get('signedFile')?.name,'Выберите подписанную копию.');
    p.sign=String(v.get('method'));
    M.change(p,['Одобрена'],'Подписан · на проверке');
    M.notify(['staff'],'Договор передан на проверку',p.id);
  });
  M.task('partner-verify','staff',id=>{
    const p=M.find('partnerApps',id);
    M.change(p,['Подписан · на проверке'],'Договор проверен');
    M.record('Договор проверен',p.id+' · '+p.category);
    M.notify([p.owner],'Кабинет открыт',p.id+' · '+p.category);
  });
  M.task('become-partner',null,id=>{
    const p=M.find('partnerApps',id);
    M.check(p.status==='Договор проверен'&&(p.owner===M.data.actor||M.allow('staff')),'Сначала FIVEROX проверяет договор.');
    const target=['distributor','official','dealer','asc','ascCertified','ascBrand','drop'][categories.indexOf(p.category)];
    M.setActor(target);
    return M.actors[target][2];
  });
  M.form('partner-role','partner',(_,v)=>{
    M.create('delegations','R',{owner:M.data.actor,name:String(v.get('role')),permission:String(v.get('permission'))});
    M.record('Создана роль в пределах кабинета',String(v.get('role')));
  });
  M.form('drop-terms','staff',(_,v)=>{
    const rate=toNumber(v.get('rate'),0,100),version=(M.data.settings.dropTerms?.version||1)+1;
    M.data.settings.dropTerms={rate,version};
    M.record('Индивидуальные условия дропшиппинга',version+' · '+v.get('reason'));
  });
  M.task('drop-check','staff',id=>{
    const o=fetchOrder(id);
    M.check(o.drop&&o.paid&&o.shipped&&o.drop.status==='Рассчитано','Расчёт ещё не готов к проверке.');
    o.drop.status='Проверено';
  });
  M.task('drop-settle','staff',()=>{
    for(const o of requests())if(o.drop?.status==='Проверено'){
      o.drop.status='Доступно к выплате';
      addEntry('drop',o.owner,o.drop.amount,'drop:'+o.id,'Сверка '+o.id);
    }
    M.record('Месячная сверка', 'Начислены проверенные позиции');
  });
  M.form('fund-credit','staff',(_,v)=>addEntry(String(v.get('program')),'dealer',toNumber(v.get('amount'),1),'fund:'+ ++M.data.count,String(v.get('reason'))));
  M.form('fund-new','partner',(_,v)=>{
    const r=M.create('fundRequests','SUP',{
      owner:M.data.actor,amount:toNumber(v.get('amount'),1),program:String(v.get('program')),kind:String(v.get('kind')),
      description:String(v.get('description')),doc:v.get('doc')?.name||'',status:'На проверке',
    });
    M.notify(['staff'],'Заявка в фонд',r.id);
  });
  M.task('fund-approve','staff',id=>{
    const r=M.find('fundRequests',id);
    M.check(balance(r.program,r.owner)>=r.amount,'Недостаточно средств на выбранном счёте.');
    M.change(r,['На проверке'],'Подтверждена');
    addEntry(r.program,r.owner,-r.amount,'from:'+id,'Списание по '+id);
    if(r.kind==='transfer')addEntry(r.program==='mdf'?'retro':'mdf',r.owner,r.amount,'to:'+id,'Перевод по '+id);
    M.record('Заявка маркетингового фонда',id+' · подтверждена');
  });
  M.task('fund-reject','staff',id=>M.change(M.find('fundRequests',id),['На проверке'],'Отклонена'));
  M.form('payout-new',['customer','partner'],(_,v)=>{
    const program=String(v.get('program')),amount=toNumber(v.get('amount'),500);
    const allowed=M.allow('customer')?program==='reference':program==='drop';
    const held=plans().filter(p=>p.owner===M.data.actor&&p.program===program&&['На проверке','Одобрена'].includes(p.status)).reduce((s,x)=>s+x.amount,0);
    M.check(allowed&&amount<=balance(program,M.data.actor)-held,'Доступного баланса для выплаты недостаточно.');
    const p=M.create('payouts','PAY',{owner:M.data.actor,program,amount,method:String(v.get('method')),status:'На проверке'});
    M.notify(['staff'],'Заявка на выплату',p.id);
  });
  M.task('payout-approve','staff',id=>M.change(M.find('payouts',id),['На проверке'],'Одобрена'));
  M.task('payout-reject','staff',id=>M.change(M.find('payouts',id),['На проверке','Одобрена'],'Отклонена'));
  M.task('payout-paid','staff',id=>{
    const p=M.find('payouts',id);
    M.change(p,['Одобрена'],'Выплачена вне портала');
    addEntry(p.program,p.owner,-p.amount,'paid:'+id,'Внешний перевод '+id);
    M.record('Отмечена внешняя выплата',id);
  });
  M.form('referral-bind', financeActors, (_,v)=>{
    const code=String(v.get('code')).trim();
    M.check(code,'Введите код.');
    if(!M.data.settings.firstReferral)M.data.settings.firstReferral=code;
    else toast('Первый пригласивший сохранён: '+M.data.settings.firstReferral);
  });
  M.task('ref-seed','staff',()=>{
    const events=M.registry('refEvents');
    if(!events.some(e=>e.key==='registration-demo'))M.create('refEvents','REF',{
      key:'registration-demo',owner:'client',type:'Регистрация',amount:150,valid:true,converted:false,ready:null,
    });
  });
  M.task('ref-advance','staff',()=>{});
  M.form('demo-points','staff',(_,v)=>addEntry(String(v.get('program')),'client',toNumber(v.get('amount'),-100000),'manual:'+ ++M.data.count,String(v.get('reason'))));
  M.form('calculate',null,(_,v)=>{
    const retail=toNumber(v.get('retail')), cost=toNumber(v.get('cost')), qty=toNumber(v.get('qty'),1,500),rate=toNumber(v.get('rate'),0,100);
    M.data.settings.calculation=v.get('kind')==='partner' ? {
      amount:(retail-cost)*qty,formula:'('+retail+' − '+cost+') × '+qty+' без учёта расходов',
    }:{amount:Math.round(retail*qty*rate/100),formula:retail+' × '+qty+' × '+rate+'%'};
  });
  function applyCatalog(event) {
    const last=M.data.products[event.product];
    if(!last||last.version<event.version){
      M.data.products[event.product]={price:event.price,qty:event.qty,version:event.version};
      const p=products.find(x=>String(x.id)===event.product);
      if(p)p.price=event.price;
      M.data.settings.lastSync=M.data.now;
      event.status='Синхронизировано';
    } else event.status='Повтор или устаревшая версия';
  }
  M.form('sync-catalog','staff',(_,v)=>{
    const event=M.create('sync','SYNC',{product:String(v.get('product')),price:toNumber(v.get('price')),
      qty:toNumber(v.get('stock'),0,100000),version:toNumber(v.get('version'),1),at:M.data.now,status:String(v.get('outcome'))});
    if(event.status!=='Ошибка')applyCatalog(event);
    M.record('Входящий обмен 1С',event.id+' · '+event.status);
  });
  M.task('sync-retry','staff',id=>applyCatalog(M.find('sync',id)));
  M.onInstall(()=>{
    for(const p of products) if(M.data.products[p.id])p.price=M.data.products[p.id].price;
  });
  function learnBonus(owner,track,step,courseComplete) {
    addEntry('school',owner,50,'lesson:'+track+':'+step,'Завершён урок '+(step+1),14);
    if(courseComplete)addEntry('school',owner,150,'course:'+track,'Завершён курс',14);
  }
  function referCourse(owner,track,paid,first,waitDays=7,valid=true) {
    if(!M.data.settings.firstReferral||owner==='client')return;
    const events=M.registry('refEvents');
    const key='course:'+owner+':'+track;
    const e=events.find(x=>x.key===key)|| M.create('refEvents','REF',{key,owner:'client',type:'Курс '+track,converted:false,amount:300});
    if(e.converted)return;
    e.valid=valid;
    e.ready=paid&&first?Math.max(paid,first)+waitDays*day:null;
    if(paid && valid)for(const event of events.filter(x=>x.type==='Регистрация'&&!x.ready))event.ready=paid;
  }
  return {balance, addEntry, learnBonus, referCourse, spendPoints, day};
})();

