
'use strict';

(() => {
  const M=MVP;
  const {add,override,card,block,note,pack,caption,action,text,input,dropdown,wrapForm,route,showDate,dateOnly} = M;
  const day=86400000, hour=3600000, offset=3*hour;
  const serviceKinds=['Оклейка зон риска','Полная оклейка','Тонировка','Контрольный осмотр'];
  const getProviders=()=>M.registry('providers',[
    {id:'CENTER-A',owner:'asc',name:'FIVEROX Studio',city:'Москва',kind:'АСЦ',category:'Авторизованный АСЦ',connected:true,service:'Оклейка зон риска',price:30000,verified:true,published:true,origins:[]},
    {id:'CENTER-B',owner:'ascCertified',name:'Демо-центр Б',city:'Москва',kind:'АСЦ',category:'Сертифицированный АСЦ',connected:true,service:'Тонировка',price:9000,verified:true,published:true,origins:[]},
    {id:'CENTER-C',owner:'ascBrand',name:'Демо-центр В',city:'Ставрополь',kind:'АСЦ',category:'Фирменный АСЦ',connected:true,service:'Полная оклейка',price:150000,verified:true,published:true,origins:[]},
    {id:'STUDIO-DEMO',name:'Detail Garage',city:'Москва',kind:'Детейлинг',category:'Профиль проверен',connected:false,service:'Оклейка зон риска',price:null,verified:true,published:true,origins:[{source:'Яндекс Карты',key:'DEMO-101'}]},
    {id:'MASTER-DEMO',name:'Частный мастер · демо',city:'Ставрополь',kind:'Частный мастер',category:'Профиль проверен',connected:false,service:'Тонировка',price:null,verified:true,published:true,origins:[{source:'2ГИС',key:'DEMO-201'}]},
  ]);
  const bookings=()=>M.registry('bookings');
  const reviews=()=>M.registry('reviews');
  const edits=()=>M.registry('profileEdits');
  const reports=()=>M.registry('profileReports');
  const currentCenter=()=>getProviders().find(p=>p.owner===M.data.actor);
  const centerOf=(id)=>M.find('providers',id,getProviders());
  const sameCenter=(provider)=>provider.owner===M.data.actor;
  const today=()=>new Date(M.data.now+offset).toISOString().slice(0,10);
  const dayIso=(t)=>new Date(t+offset).toISOString().slice(0,10);
  const atMsk=(date,time='12:00')=>Date.parse(date+'T'+time+':00+03:00');
  const weekday=(stamp)=>{const d=new Date(stamp+offset).getUTCDay();return d!==0&&d!==6;};
  function workingDeadline(stamp, duration) {
    let point=stamp, left=duration;
    while(left>0){
      const date=dayIso(point);
      const open=atMsk(date,'09:00'),close=atMsk(date,'18:00');
      if(!weekday(point)||point>=close){point=atMsk(dayIso(point+day),'09:00');continue;}
      point=Math.max(point,open);
      const portion=Math.min(left,close-point);
      left-=portion;
      point+=portion;
    }
    return point;
  }
  function workingDayDeadline(stamp,count) {
    let date=stamp;
    while(count>0){date+=day;if(weekday(date))count--;}
    return date;
  }
  function nextBusinessDate() { return dayIso(workingDayDeadline(M.data.now,1)); }
  function bookingVisible(b) {
    return M.allow('staff') || b.owner===M.data.actor || (b.owner==='guest'&&M.data.actor==='client') ||
      sameCenter(centerOf(b.provider));
  }
  function bookUrl(id){return route('mvp-booking-detail',{id});}
  function providerUrl(id){return route('mvp-provider',{id});}
  function slotUsed(provider,date,time) {
    return bookings().some(b=>b.provider===provider&&b.type==='future'&&b.date===date&&b.time===time&&
      (b.status==='Подтверждена'||(b.status==='Удержание слота'&&b.deadline>M.data.now)));
  }
  function directory() {
    const filters=M.params();
    const kind=filters.get('kind')||'Все', city=filters.get('city')||'Все', service=filters.get('service')||'Все';
    const category=filters.get('category')||'Все';
    const providers=getProviders().filter(p=>p.published&&(kind==='Все'||p.kind===kind)&&(city==='Все'||p.city===city)&&(service==='Все'||p.service===service)&&(category==='Все'||p.category===category));
    return head('Найдите свой центр','Подключённые АСЦ, детейлинги и частные мастера.',link('Мои обращения','client-bookings','secondary'))+
      wrapForm('directory-filter','',dropdown('Город','city',['Все','Москва','Ставрополь'],city)+
        dropdown('Тип исполнителя','kind',['Все','АСЦ','Детейлинг','Частный мастер'],kind)+
        dropdown('Услуга','service',['Все',...serviceKinds],service)+
        dropdown('Статус','category',['Все',...new Set(getProviders().filter(p=>p.published).map(p=>p.category))],category),'Найти')+
      (providers.length?block(...providers.map(p=>card(p.name,'<p>'+text(p.city)+' · '+text(p.kind)+' · '+caption(p.category)+'</p>'+
        '<p>'+text(p.service)+(p.price?' · от '+money(p.price):'')+'</p>'+pack(link('Карточка',providerUrl(p.id),'primary'),
          link(p.connected?'Записаться':'Подать заявку',route('mvp-booking',{id:p.id}),'secondary')))))
        :note('С такими фильтрами исполнители не найдены.'));
  }
  function providerPage(id=M.params().get('id')||'CENTER-A') {
    let p;
    try{p=centerOf(id);}catch(err){return head('Исполнитель',err.message,link('Каталог','centers','secondary'));}
    if(!p.published&&!M.allow('moderator')&&!sameCenter(p))return head('Карточка на проверке','Каталог показывает опубликованные профили.',link('Каталог','centers','secondary'));
    const publicReviews=reviews().filter(x=>x.provider===p.id&&x.status==='Опубликован');
    return head(text(p.name),text(p.kind+' · '+p.city),link('К каталогу','centers','secondary'))+
      block(card('Профиль исполнителя','<p>'+caption(p.category)+' '+caption(p.connected?'Расписание подключено':'Согласование через FIVEROX')+'</p>'+
        '<p>'+text(p.service)+(p.price?' · от '+money(p.price):'')+'</p>'+
        (p.photo?'<p>Одобренное фото: '+text(p.photo)+'</p>':'')+
        pack(link(p.connected?'Записаться':'Подать заявку FIVEROX',route('mvp-booking',{id:p.id}),'primary'),
          p.connected?link('Срочная заявка сегодня',route('mvp-booking',{id:p.id,mode:'urgent'}),'secondary'):'')+
        note(p.kind==='АСЦ'?'Условия «Гарантии 360°» проверяются по конкретной работе.':'Согласование услуги через FIVEROX. Профиль не имеет статуса АСЦ.')),
        card('Отзывы об услугах и обсуждение',publicReviews.map(x=>'<p>'+text(x.external?'Внешний · '+x.source:'После услуги в FIVEROX')+' · '+text(x.body)+
          (x.replyApproved?'<br>Ответ АСЦ: '+text(x.reply):'')+'</p>').join('')+
          (p.origins.length?M.list(p.origins.map(x=>'Карточка источника: '+x.source+' · '+x.key+' · демонстрационный идентификатор')):'')+
          pack(link('Оставить отзыв после услуги',route('mvp-reviews',{id:p.id}),'secondary'))+
          wrapForm('profile-report',p.id,input('Комментарий или сообщение об ошибке','message','Демо уточнение')+
            dropdown('Тип','kind',['Комментарий к карточке','Исправление владельцем','Запрос на удаление']),'Передать на проверку')));
  }
  function bookingForm() {
    let id=M.params().get('id');
    if(!id)id=state.bookingAuthorized===false?'STUDIO-DEMO':'CENTER-A';
    const p=centerOf(id);
    const urgent=p.connected&&M.params().get('mode')==='urgent';
    if(!p.published)return head('Запись','Профиль ещё не опубликован.',link('Каталог','centers','secondary'));
    const date=M.params().get('date')||nextBusinessDate();
    const slots=p.slots||['10:00','12:00','15:00','17:00'];
    const deadline=workingDeadline(M.data.now,2*hour);
    const available=slots.filter(time=>!slotUsed(p.id,date,time)&&atMsk(date,time)>deadline);
    const mode=urgent?'urgent':p.connected?'future':'offline';
    return head(urgent?'Срочная заявка сегодня':p.connected?'Запись в АСЦ':'Заявка на согласование',
      text(p.name),link('Карточка',providerUrl(p.id),'secondary'))+
      (p.connected?pack(link('Будущая дата',route('mvp-booking',{id:p.id}),'secondary'),
        link('Сегодня · срочная заявка',route('mvp-booking',{id:p.id,mode:'urgent'}),'secondary')):'')+
      (mode==='future'?wrapForm('slots',p.id,input('Показать слоты на дату','date',date,'date'),'Проверить свободное время'):'')+
      (mode==='future'&&!available.length?note('На эту дату нет свободных слотов. Выберите другую дату.'):
        wrapForm('booking-new',p.id,dropdown('Услуга','service',serviceKinds,p.service)+
          input('Автомобиль','car','Демо автомобиль')+input('Имя','name','Демо-клиент')+input('Контакт','contact','Демо контакт')+
          (mode==='future'?dropdown('Свободное время','time',available)+input('Дата будущего визита','date',date,'date') :
            (mode==='offline'?input('Пожелание по дате','date','','date',false):''))+
          input('Пожелания клиента','notes','','text',false)+'<input type="hidden" name="mode" value="'+mode+'">',
          urgent?'Отправить горячий лид':p.connected?'Запросить слот':'Передать FIVEROX','centers'))+
      note(urgent?'FIVEROX и АСЦ получат уведомление для звонка. Слот не блокируется.':
        p.connected?'Слот удерживается до решения АСЦ, не дольше двух рабочих часов. Демо график: пн–пт, 09:00–18:00 МСК.':
          'Пожелание по времени направляется FIVEROX. Запись согласует сотрудник после звонка исполнителю.');
  }
  function bookingList() {
    const rows=bookings().filter(bookingVisible);
    return head('Записи и обращения',M.pageActor()[0]+' · '+M.pageActor()[1],link('Найти исполнителя','centers','primary'))+
      table(['Номер','Тип','Исполнитель','Когда','Статус'],rows.map(b=>[
        link(text(b.id),bookUrl(b.id),'secondary'),text(b.type==='future'?'Будущий слот':b.type==='urgent'?'Срочная сегодня':'Через FIVEROX'),
        text(centerOf(b.provider).name),text([b.date,b.time].filter(Boolean).join(' ')||'По согласованию'),caption(b.status),
      ]))+(M.allow('center')?pack(link('Настроить слоты','mvp-calendar','secondary')):'');
  }
  function bookingDetail() {
    const rows=bookings().filter(bookingVisible);
    const id=M.params().get('id');
    const b=id?rows.find(x=>x.id===id):rows[0];
    if(!b)return head('Обращение','Запись недоступна в этом кабинете.',link('Реестр','client-bookings','secondary'));
    const p=centerOf(b.provider),right=M.allow('staff')||sameCenter(p);
    return head(text(b.id)+' · '+text(p.name),b.status,link('Реестр','client-bookings','secondary'))+
      block(card('Параметры',M.list([b.service,b.car,'Пожелания: '+(b.notes||'—'),
        b.date?[b.date,b.time].filter(Boolean).join(' '):'Время согласуется',
        ...(b.deadline?['Удержание до '+showDate(b.deadline)+' МСК']:[])])),
      card('Следующий шаг',pack(
        b.type==='future'&&b.status==='Удержание слота'&&sameCenter(p)?action('Подтвердить запись','booking-confirm',b.id,'primary'):'',
        b.type==='future'&&b.status==='Удержание слота'&&sameCenter(p)?action('Отклонить · освободить слот','booking-cancel',b.id):'',
        b.type==='urgent'&&b.status==='Горячий лид'&&right?action('Отметить созвон · передать в работу','booking-urgent-work',b.id,'primary'):'',
        b.type==='offline'&&b.status==='Поступила в FIVEROX'&&M.allow('staff')?action('Связаться с исполнителем','booking-negotiate',b.id):'',
        b.status==='Исполнитель уточняет'&&M.allow('staff')?action('Не удалось согласовать','booking-fail',b.id):'',
        ['Подтверждена','Согласована через FIVEROX','Передана в работу'].includes(b.status)?action('Отметить оказание услуги','booking-complete',b.id,'primary'):'',
        b.status==='Услуга оказана'?link('Оставить отзыв',route('mvp-reviews',{id:b.provider}),'secondary'):'',
        ['Удержание слота','Подтверждена','Поступила в FIVEROX','Исполнитель уточняет'].includes(b.status)&&!right?action('Отменить обращение','booking-cancel',b.id):'')+
        (b.status==='Исполнитель уточняет'&&M.allow('staff')?wrapForm('booking-agree',b.id,
          input('Согласованная дата','date',nextBusinessDate(),'date')+input('Время','time','12:00','time'),'Зафиксировать согласование'):'')+
        (b.type==='urgent'?note('Горячий лид сопровождается созвоном. Удержание слота и срок подтверждения не применяются.'):'')+
        (b.completion?note('Завершение зафиксировал: '+b.completion):'')));
  }
  function bookingById(id) {
    const b=bookings().find(x=>x.id===id&&bookingVisible(x));
    M.check(b,'Запись недоступна для текущей роли.');
    return b;
  }
  M.form('directory-filter',null,(_,v)=>route('centers',Object.fromEntries(v)));
  M.form('slots',null,(id,v)=>route('mvp-booking',{id,date:String(v.get('date'))}));
  M.form('booking-new',null,(id,v)=>{
    const p=centerOf(id); M.check(p.published,'Исполнитель недоступен.');
    const type=String(v.get('mode'));
    M.check(p.connected?['future','urgent'].includes(type):type==='offline','Тип записи не соответствует исполнителю.');
    const date=type==='urgent'?today():String(v.get('date')||'');
    const time=type==='future'?String(v.get('time')):'';
    if(type==='future'){
      const stamp=atMsk(date,time);
      M.check(date>today()&&Number.isFinite(stamp)&&weekday(stamp)&&stamp>workingDeadline(M.data.now,2*hour),'Выберите рабочий слот после срока подтверждения.');
      M.check((p.slots||['10:00','12:00','15:00','17:00']).includes(time)&&!slotUsed(id,date,time),'Слот уже недоступен. Выберите другой.');
    }
    const deadline=type==='future'?workingDeadline(M.data.now,2*hour):null;
    const b=M.create('bookings','BOOK',{owner:M.data.actor,provider:id,type,date,time,deadline,service:String(v.get('service')),
      car:String(v.get('car')),notes:String(v.get('notes')||''),status:type==='future'?'Удержание слота':type==='urgent'?'Горячий лид':'Поступила в FIVEROX'});
    const to=type==='urgent'?['staff',p.owner]:type==='future'?[p.owner]:['staff'];
    M.notify(to,type==='urgent'?'Срочный лид · требуется созвон':'Новая сервисная заявка',b.id+' · '+b.status,['В портале']);
    M.record('Создана сервисная заявка',b.id+' · '+b.status);
    return bookUrl(b.id);
  });
  M.task('booking-confirm','center',id=>{
    const b=bookingById(id);
    M.check(b.type==='future'&&sameCenter(centerOf(b.provider))&&b.deadline>M.data.now,'Удержание истекло или слот принадлежит другому центру.');
    M.change(b,['Удержание слота'],'Подтверждена');
    M.notify([b.owner],'Запись подтверждена',b.id+' · '+b.date+' '+b.time);
    M.notify([b.owner],'Напоминание о визите',b.id+' · запланировано за 2 часа до визита',['Push']);
    M.record('АСЦ подтвердил слот',b.id);
  });
  M.task('booking-cancel',null,id=>{
    const b=bookingById(id); M.change(b,['Удержание слота','Подтверждена','Поступила в FIVEROX','Исполнитель уточняет'],'Отменена');
    M.notify([b.owner,centerOf(b.provider).owner,'staff'].filter(Boolean),'Запись отменена',b.id);
  });
  M.task('booking-negotiate','staff',id=>M.change(bookingById(id),['Поступила в FIVEROX'],'Исполнитель уточняет'));
  M.task('booking-fail','staff',id=>M.change(bookingById(id),['Исполнитель уточняет'],'Не удалось согласовать'));
  M.form('booking-agree','staff',(id,v)=>{
    const b=bookingById(id);M.change(b,['Исполнитель уточняет'],'Согласована через FIVEROX');
    b.date=String(v.get('date'));b.time=String(v.get('time'));
    M.notify([b.owner],'Время согласовано',b.id+' · '+b.date+' '+b.time);
  });
  M.task('booking-urgent-work',['staff','center'],id=>{
    const b=bookingById(id);M.change(b,['Горячий лид'],'Передана в работу');M.record('Созвон по срочному лиду',id);
  });
  M.task('booking-complete',null,id=>{
    const b=bookingById(id);
    M.change(b,['Подтверждена','Согласована через FIVEROX','Передана в работу'],'Услуга оказана');
    b.completion=M.pageActor()[0]+' · '+showDate(M.data.now);
    M.notify([b.owner],'Можно оставить отзыв',b.id);
  });
  M.onExpire(()=>{
    for(const b of bookings())if(b.type==='future'&&b.status==='Удержание слота'&&b.deadline<=M.data.now){
      b.status='Истекла · слот свободен';
      M.notify([b.owner,centerOf(b.provider).owner],'Удержание истекло',b.id+' · слот снова доступен.');
      M.record('Истечение удержания',b.id);
    }
  });

  function reviewPage() {
    const id=M.params().get('id')||(M.allow('center')?currentCenter().id:'CENTER-A');
    const p=centerOf(id);
    const own=bookings().filter(b=>b.provider===id&&b.status==='Услуга оказана'&&(b.owner===M.data.actor||b.owner==='guest'&&M.data.actor==='client'));
    const allowedReview=own.filter(b=>!reviews().some(r=>r.service===b.id));
    return head('Отзывы о выполненной услуге',text(p.name),link('Карточка',providerUrl(id),'secondary'))+
      (allowedReview.length?wrapForm('review-new',id,dropdown('Выполненная услуга','booking',allowedReview.map(b=>[b.id,b.id+' · '+b.service]))+
        dropdown('Оценка','rating',['5','4','3','2','1'])+input('Отзыв','body','Демо отзыв об услуге'),'Отправить на модерацию'):
        note('Отзыв доступен клиенту после отметки об оказанной услуге.'))+
      reviews().filter(r=>r.provider===id&&(r.status==='Опубликован'||r.author===M.data.actor||sameCenter(p))).map(r=>
        card(r.external?'Внешний отзыв · '+r.source:'Отзыв клиента',caption(r.status)+'<p>'+text(r.body)+'</p>'+
          (sameCenter(p)&&!r.external&&r.status==='Опубликован'?wrapForm('review-answer',r.id,
            input('Ответ от АСЦ','reply',r.reply||'Спасибо за отзыв'),'Отправить ответ на модерацию'):'')
        )).join('');
  }
  function moderation() {
    return head('Каталог и модерация', 'Версии карточек, происхождение записей и разрешения на отзывы.',link('Каталог','centers','secondary'))+
      block(card('Импорт исполнителей',wrapForm('provider-import','',
        dropdown('Источник','source',['Яндекс Карты','2ГИС'])+input('Внешний идентификатор','key','DEMO-101')+
        input('Название','name','Detail Garage')+dropdown('Тип исполнителя','kind',['Детейлинг','Частный мастер','АСЦ'])+
        dropdown('Город','city',['Москва','Ставрополь'])+input('Филиал или адрес','branch','Основной филиал')+
        dropdown('Совпадение','match',[['compare','Найти вероятный дубль'],['separate','Отдельный филиал']]), 'Загрузить демостроку')+
        table(['Запись','Тип','Источники','Статус','Решение'],getProviders().map(p=>[
          link(text(p.name),providerUrl(p.id),'secondary'),text(p.kind),text(p.origins.map(x=>x.source).join(', ')||'От центра'),
          caption(p.published?'Опубликована':'На проверке'),!p.published?action('Проверить и опубликовать','provider-publish',p.id):'',
        ]))),
      card('Правки карточек',table(['Центр','Поля','Состояние','Действия'],edits().map(x=>[
        text(centerOf(x.provider).name),text([x.service,money(x.price),x.photo].filter(Boolean).join(' · ')),caption(x.status),
        x.status==='На модерации'?action('Опубликовать версию','profile-approve',x.id)+action('Отклонить','profile-reject',x.id):'',
      ]))+
        table(['Исполнитель','Обращение','Статус','Действие'],reports().map(r=>[
          text(centerOf(r.provider).name),text(r.kind+' · '+r.message),caption(r.status),
          r.status==='Новая'?action('Рассмотрено','profile-report-review',r.id):'',
        ]))))+
      block(card('Отзывы и ответы',table(['Текст','Источник','Права / статус','Действие'],reviews().map(r=>[
        text(r.body),text(r.external?r.source:'После услуги'),caption(r.status),
        pack(r.status==='На модерации'?action('Опубликовать','review-approve',r.id)+action('Отклонить','review-reject',r.id):'',
          r.replyPending?action('Опубликовать ответ','reply-approve',r.id):''),
      ]))),
      card('Внешний отзыв',wrapForm('external-review','',dropdown('Исполнитель','provider',getProviders().map(p=>[p.id,p.name]))+
        dropdown('Источник','source',['Яндекс Карты','2ГИС'])+input('Условная ссылка или ID','key','EXT-DEMO')+
        input('Предоставленный текст','body','Демонстрационный отзыв из внешнего источника')+
        dropdown('Право на воспроизведение','allowed',[['no','Не подтверждено'],['yes','Подтверждено']]),'Передать в модерацию')));
  }
  M.form('profile-report',null,(id,v)=>{
    centerOf(id);M.create('profileReports','MOD',{provider:id,message:String(v.get('message')),kind:String(v.get('kind')),status:'Новая'});
    M.notify(['moderator'],'Обращение по карточке',id);
    toast('Обращение передано на модерацию.');
  });
  M.task('profile-report-review','moderator',id=>M.change(M.find('profileReports',id),['Новая'],'Рассмотрено'));
  M.form('provider-import','moderator',(_,v)=>{
    const name=String(v.get('name')).trim(),city=String(v.get('city')),branch=String(v.get('branch'));
    const origin={source:String(v.get('source')),key:String(v.get('key')),at:M.data.now};
    const list=getProviders();
    if(list.some(p=>p.origins.some(x=>x.source===origin.source&&x.key===origin.key))){toast('Источник с этим ID уже учтён.');return;}
    const existing=v.get('match')==='compare'&&list.find(p=>p.city===city&&p.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')&&
      (!p.branch||p.branch===branch));
    if(existing){
      existing.origins.push(origin);
      M.record('Вероятный дубль: сохранено происхождение',existing.id+' · '+origin.source);
      toast('Сохранён второй источник для найденной карточки.');
      return;
    }
    M.create('providers','POOL',{name,city,branch,kind:String(v.get('kind')),category:'На проверке',connected:false,
      service:serviceKinds[0],price:null,verified:false,published:false,origins:[origin]});
  });
  M.task('provider-publish','moderator',id=>{
    const p=centerOf(id);p.verified=true;p.published=true;p.category='Профиль проверен';
    M.record('Опубликована проверенная карточка',id);
  });
  M.form('profile-change','center',(_,v)=>{
    const p=currentCenter();
    M.create('profileEdits','EDIT',{provider:p.id,price:Number(v.get('price')),service:String(v.get('service')),
      photo:v.get('photo')?.name||'Демо фото',status:'На модерации'});
    M.notify(['moderator'],'Изменения карточки АСЦ',p.id);
  });
  M.task('profile-approve','moderator',id=>{
    const e=M.find('profileEdits',id);M.change(e,['На модерации'],'Одобрена');
    const p=centerOf(e.provider);p.price=e.price;p.service=e.service;p.photo=e.photo;
    M.record('Опубликована версия профиля',id);
  });
  M.task('profile-reject','moderator',id=>M.change(M.find('profileEdits',id),['На модерации'],'Отклонена'));
  M.form('review-new',null,(id,v)=>{
    const b=bookings().find(x=>x.id===v.get('booking')&&x.provider===id&&x.status==='Услуга оказана'&&
      (x.owner===M.data.actor||x.owner==='guest'&&M.data.actor==='client'));
    M.check(b&&!reviews().some(x=>x.service===b.id),'Сначала завершите услугу или откройте существующий отзыв.');
    M.create('reviews','REV',{provider:id,service:b.id,author:M.data.actor,body:String(v.get('body')),rating:String(v.get('rating')),status:'На модерации'});
    M.notify(['moderator'],'Новый отзыв после услуги',b.id);
  });
  M.form('review-answer','center',(id,v)=>{
    const r=M.find('reviews',id);M.check(sameCenter(centerOf(r.provider))&&r.status==='Опубликован','Отзыв не относится к этому центру.');
    r.reply=String(v.get('reply'));r.replyPending=true;r.replyApproved=false;
  });
  M.form('external-review','moderator',(_,v)=>{
    const perm=v.get('allowed')==='yes';
    M.create('reviews','REV',{provider:String(v.get('provider')),external:true,source:String(v.get('source')),
      sourceKey:String(v.get('key')),at:M.data.now,body:perm?String(v.get('body')):'Текст недоступен для публикации',
      status:perm?'На модерации':'Право не подтверждено'});
  });
  M.task('review-approve','moderator',id=>M.change(M.find('reviews',id),['На модерации'],'Опубликован'));
  M.task('review-reject','moderator',id=>M.change(M.find('reviews',id),['На модерации'],'Отклонён'));
  M.task('reply-approve','moderator',id=>{
    const r=M.find('reviews',id);M.check(r.replyPending,'Нет ответа на модерации.');
    r.replyPending=false;r.replyApproved=true;
  });

  const clients=()=>M.registry('crmClients',[
    {id:'CLIENT-A',center:'CENTER-A',name:'Демо-клиент А',car:'Демо авто A',source:'Собственный клиент'},
    {id:'CLIENT-B',center:'CENTER-B',name:'Демо-клиент Б',car:'Демо авто B',source:'Собственный клиент'},
    {id:'CLIENT-C',center:'CENTER-C',name:'Демо-клиент В',car:'Демо авто C',source:'Собственный клиент'},
  ]);
  const works=()=>M.registry('crmWorks',[
    {id:'WORK-DEMO',center:'CENTER-A',client:'CLIENT-A',service:serviceKinds[0],post:'Пост 1',master:'Мастер 1',brand:'ATOMGARD',
      at:M.data.now-day,closed:M.data.now-day,status:'Закрыта',price:30000,cost:12000,paid:25000,reward:4500,spent:false},
    {id:'WORK-LATE',center:'CENTER-A',client:'CLIENT-A',service:serviceKinds[0],post:'Пост 2',master:'Мастер 2',brand:'ATOMGARD',
      at:M.data.now-20*day,closed:M.data.now-20*day,status:'Закрыта',price:28000,cost:10000,paid:28000,reward:4200,spent:false},
  ]);
  const stock=()=>M.registry('stockMoves',[
    {id:'ST-A',center:'CENTER-A',product:'ATOMGARD',qty:10,reason:'Демо поступление'},
    {id:'ST-B',center:'CENTER-B',product:'DETRONA',qty:7,reason:'Демо поступление'},
  ]);
  const activeCrm=()=>M.allow('staff')?(getProviders().find(p=>p.id===M.params().get('center')&&p.connected)||centerOf('CENTER-A')):currentCenter();
  const crmAllowed=(right)=>M.allow('staff')||sameCenter(centerOf(right.center));
  function workLink(id) {return route('mvp-work',{id});}
  function workById(id){
    const w=works().find(x=>x.id===id&&crmAllowed(x));M.check(w,'Работа недоступна в текущем кабинете.');return w;
  }
  function crm() {
    const p=activeCrm(),cw=works().filter(w=>w.center===p.id),cc=clients().filter(c=>c.center===p.id);
    const revenue=cw.reduce((s,w)=>s+w.price,0),cost=cw.reduce((s,w)=>s+w.cost,0),debt=cw.reduce((s,w)=>s+Math.max(0,w.price-w.paid),0);
    const qty=stock().filter(x=>x.center===p.id).reduce((s,x)=>s+x.qty,0);
    const pool=bookings().filter(x=>x.provider===p.id),complete=pool.filter(x=>x.status==='Услуга оказана').length;
    return head('Мини CRM АСЦ',text(p.name)+' · '+text(p.category),link('Записи','client-bookings','secondary'))+
      pack(link('Календарь',route('mvp-calendar',{center:p.id}),'secondary'),link('Склад','mvp-stock','secondary'),
        link('Гарантии','mvp-warranty','secondary'),link('Обращения до 36 месяцев','mvp-service','secondary'))+
      (M.allow('staff')?wrapForm('crm-center','',dropdown('Центр','center',getProviders().filter(x=>x.connected).map(x=>[x.id,x.name]),p.id),'Открыть показатели АСЦ'):'')+
      block(kpi('Клиенты / работы',cc.length+' / '+cw.length),kpi('Выручка / затраты',money(revenue)+' / '+money(cost)),
        kpi('Разница выручки и затрат',money(revenue-cost)),kpi('Долг / остаток',money(debt)+' / '+qty),
        kpi('Выплаты мастерам',money(cw.filter(w=>w.rewardPaid).reduce((s,w)=>s+w.reward,0))),
        kpi('Конверсия обращений',pool.length?Math.round(100*complete/pool.length)+'%':'—','Оказаны '+complete+' из '+pool.length),
        kpi('Повторные обращения',cc.filter(c=>cw.filter(w=>w.client===c.id).length>1).length),
        kpi('Загрузка постов и мастеров',new Set(cw.map(w=>w.post)).size+' / '+new Set(cw.map(w=>w.master)).size,'Задействованные ресурсы'))+
      block(card('Клиенты центра',table(['Клиент','Автомобиль','Источник'],cc.map(c=>[text(c.name),text(c.car),text(c.source)]))+
        (M.allow('center')?wrapForm('crm-client','',input('Имя','name','Новый демо-клиент')+input('Автомобиль','car','Демо авто'),'Добавить вручную')+
          wrapForm('crm-import','',dropdown('Шаблон','kind',[['client','Клиенты'],['stock','Склад']])+
            M.upload('Файл CSV или XLSX','file')+input('Демо строки через |','rows','Клиент демо,Автомобиль демо'),'Предпросмотр импорта')+
          (M.data.settings.importDraft?.center===p.id?table(['Строка','Проверка'],M.data.settings.importDraft.rows.map(x=>[text(x.raw),text(x.error||'Готова')]))+
            pack(action('Подтвердить импорт корректных строк','crm-import-apply')):''):'') ),
      card('Работы и заказ-наряды',table(['Номер','Услуга','Статус','Срок','Пост / мастер'],cw.map(w=>[
        link(text(w.id),workLink(w.id),'secondary'),text(w.service),caption(w.status),showDate(w.at),text(w.post+' · '+w.master),
      ]))+(M.allow('center')?pack(link('Новая работа','mvp-work-new','primary'),link('Отзывы',route('mvp-reviews',{id:p.id}),'secondary')):'')))+
      (M.allow('center')?card('Карточка центра',wrapForm('profile-change','',dropdown('Услуга','service',serviceKinds,p.service)+
        input('Цена','price',p.price,'number')+M.upload('Новая фотография','photo'),'Отправить изменения на модерацию')+
        pack(link('Публичная карточка',providerUrl(p.id),'secondary'))):'');
  }
  function addWorkPage(){
    const p=currentCenter(),list=clients().filter(c=>c.center===p.id);
    if(!list.length)return head('Новая работа','Добавьте клиента в реестр.',link('Мини CRM','mvp-crm','primary'));
    return head('Новая работа АСЦ',text(p.name),link('К реестру','mvp-crm','secondary'))+
      wrapForm('work-new','',dropdown('Клиент','client',list.map(c=>[c.id,c.name]))+dropdown('Услуга','service',serviceKinds)+
        input('Дата','date',nextBusinessDate(),'date')+input('Время','time','10:00','time')+dropdown('Пост','post',['Пост 1','Пост 2'])+
        dropdown('Мастер','master',['Мастер 1','Мастер 2'])+
        dropdown('Материал','brand',['ATOMGARD','DETRONA','UNDERCOVER','Другой бренд'])+
        input('Стоимость для клиента','price',30000,'number')+input('Затраты','cost',12000,'number'),'Создать заказ-наряд');
  }
  function workPage(){
    let w;
    try{w=workById(M.params().get('id'));}catch(err){return head('Заказ-наряд',err.message,link('Мини CRM','mvp-crm','secondary'));}
    const client=M.find('crmClients',w.client,clients());
    return head('Заказ-наряд '+text(w.id),text(centerOf(w.center).name)+' · '+w.status,link('К работам','mvp-crm','secondary'))+
      block(card('Клиент и работа',M.list([client.name,client.car,w.service,w.brand,w.post+' · '+w.master,showDate(w.at)])+
        note(w.spent?'Расход внесён вручную по этой работе.':'Расход материала ещё не внесён. Закрытие работы само по себе остаток не меняет.')+
        (M.allow('center')&&w.status==='Назначена'?pack(action('Закрыть выполненную работу','work-close',w.id,'primary')):'')+
        (M.allow('center')&&!w.spent?wrapForm('work-stock',w.id,input('Вручную списать, м','qty',1,'number'),'Списать материал'):'')+
        pack(link('Заказ-наряд и акт',route('mvp-work-doc',{id:w.id}),'secondary'),
          w.status==='Закрыта'&&sameCenter(centerOf(w.center))?link('Зарегистрировать гарантию',route('mvp-warranty-new',{work:w.id}),'primary'):'')),
      card('Расчёты',table(['Показатель','Сумма'],[['Стоимость',money(w.price)],['Затраты',money(w.cost)],['Оплачено',money(w.paid)],
        ['Долг',money(Math.max(0,w.price-w.paid))],['Расчёт мастеру',money(w.reward)],['Фактическая выплата',w.rewardPaid?money(w.reward):'Ожидается']])+
        (M.allow('center')?wrapForm('work-finance',w.id,input('Оплачено клиентом','paid',w.paid,'number')+
          input('Корректировка вознаграждения','reward',w.reward,'number')+dropdown('Внешняя выплата','rewardPaid',[['no','Ожидается'],['yes','Зафиксирована']],w.rewardPaid?'yes':'no'),'Сохранить расчёты'):'') ));
  }
  function docsPage(){
    let w;
    try{w=workById(M.params().get('id'));}catch(err){return head('Документы',err.message,link('Мини CRM','mvp-crm','secondary'));}
    const signature=w.signature?note('Подпись на экране учтена как демо отметка: '+w.signature):'';
    return head('Документы '+text(w.id),text(centerOf(w.center).name),link('К работе',workLink(w.id),'secondary'))+
      block(card('Заказ-наряд',M.list([w.id,w.service,w.brand,showDate(w.at),money(w.price)])),
        card('Акт выполненных работ',note(w.closed?'Работа закрыта '+dateOnly(w.closed):'Подготовлен черновик акта.')+signature+
          pack(action('Печать / PDF','print-work',w.id))+
          (M.allow('center')?wrapForm('sign-work',w.id,input('Отметка подписи клиента на экране','name','Демо подпись'),'Сохранить демо отметку'):'')+
          note('Для юридического применения подписи требуется отдельное согласование.')));
  }
  function calendar(){
    const p=activeCrm();
    return head('Календарь АСЦ',text(p.name)+' · посты, мастера и будущие записи.',link('Мини CRM','mvp-crm','secondary'))+
      (M.allow('center')?wrapForm('calendar-config','',input('Слоты, через запятую','slots',(p.slots||['10:00','12:00','15:00','17:00']).join(','))+
        dropdown('Накладка поста или мастера','overlap',[['warn','Предупреждать'],['deny','Запрещать']],p.overlap||'warn'),'Сохранить расписание'):'')+
      table(['Работа','Дата','Пост','Мастер','Статус'],works().filter(w=>w.center===p.id).map(w=>[
        link(text(w.id),workLink(w.id),'secondary'),showDate(w.at),text(w.post),text(w.master),caption(w.status),
      ]))+table(['Слот клиента','Когда','Статус'],bookings().filter(b=>b.provider===p.id&&b.type==='future').map(b=>[
          link(text(b.id),bookUrl(b.id),'secondary'),text(b.date+' '+b.time),caption(b.status),
      ]));
  }
  function stockPage(){
    const p=activeCrm(),rows=stock().filter(x=>x.center===p.id);
    return head('Материалы и остатки АСЦ',text(p.name),link('Мини CRM','mvp-crm','secondary'))+
      block(...['ATOMGARD','DETRONA','UNDERCOVER','Другой бренд'].map(product=>kpi(product,
        rows.filter(x=>x.product===product).reduce((s,x)=>s+x.qty,0)+' м')))+
      (M.allow('center')?wrapForm('stock-manual','',dropdown('Материал','product',['ATOMGARD','DETRONA','UNDERCOVER','Другой бренд'])+
        dropdown('Операция','kind',[['in','Поступление'],['out','Расход']])+input('Метры','qty',5,'number')+
        input('Основание','reason','Демо движение'),'Сохранить движение'):'')+
      table(['Материал','Количество','Основание'],rows.map(x=>[text(x.product),x.qty,text(x.reason)]));
  }
  function stockMove(center,product,qty,reason) {
    const total=stock().filter(x=>x.center===center&&x.product===product).reduce((s,x)=>s+x.qty,0);
    M.check(Number.isFinite(qty)&&qty&&total+qty>=0,'Количества на складе недостаточно.');
    M.create('stockMoves','ST',{center,product,qty,reason});
  }
  M.form('crm-center','staff',(_,v)=>route('mvp-crm',{center:String(v.get('center'))}));
  M.form('crm-client','center',(_,v)=>{
    const p=currentCenter(); clients();
    M.create('crmClients','CL',{center:p.id,name:String(v.get('name')),car:String(v.get('car')),source:'Собственный клиент'});
  });
  M.form('crm-import','center',(_,v)=>{
    const p=currentCenter(),kind=String(v.get('kind'));
    const rows=String(v.get('rows')).split('|').slice(0,25).map(raw=>{
      const [first,second]=raw.split(',').map(x=>x.trim());
      const error=!first||!second?'Отсутствует колонка':kind==='stock'&&!(Number(second)>0)?'Количество должно быть положительным':null;
      return {raw,first,second,error};
    });
    M.data.settings.importDraft={center:p.id,kind,rows,file:v.get('file')?.name||'Демо пример'};
  });
  M.task('crm-import-apply','center',()=>{
    const draft=M.data.settings.importDraft,p=currentCenter();
    M.check(draft?.center===p.id,'Подготовьте импорт.');
    for(const row of draft.rows.filter(x=>!x.error)){
      if(draft.kind==='stock')stockMove(p.id,row.first,Number(row.second),'Импорт '+draft.file);
      else if(!clients().some(c=>c.center===p.id&&c.name===row.first&&c.car===row.second))
        M.create('crmClients','CL',{center:p.id,name:row.first,car:row.second,source:'Демо импорт'});
    }
    M.record('Подтверждён импорт АСЦ',p.id+' · '+draft.file);
    delete M.data.settings.importDraft;
  });
  M.form('work-new','center',(_,v)=>{
    const p=currentCenter(),client=M.find('crmClients',String(v.get('client')));
    M.check(client.center===p.id,'Клиент относится к другому центру.');
    const at=atMsk(String(v.get('date')),String(v.get('time'))),price=Number(v.get('price')),cost=Number(v.get('cost'));
    M.check(Number.isFinite(at)&&price>=0&&Number.isFinite(price)&&cost>=0&&Number.isFinite(cost),'Проверьте даты и суммы.');
    const same=works().some(x=>x.center===p.id&&x.at===at&&(x.post===v.get('post')||x.master===v.get('master')));
    M.check(!same||p.overlap!=='deny','Выбранный пост или мастер уже занят.');
    if(same)toast('Предупреждение: накладка работ.');
    const w=M.create('crmWorks','WORK',{center:p.id,client:client.id,service:String(v.get('service')),post:String(v.get('post')),
      master:String(v.get('master')),brand:String(v.get('brand')),at,status:'Назначена',price,cost,paid:0,reward:Math.round(price*0.15),spent:false});
    return workLink(w.id);
  });
  M.task('work-close','center',id=>{
    const w=workById(id);M.change(w,['Назначена'],'Закрыта');w.closed=M.data.now;M.record('Закрыта работа АСЦ',id);
  });
  M.form('work-stock','center',(id,v)=>{
    const w=workById(id);M.check(!w.spent&&Number(v.get('qty'))>0,'Количество уже списано или некорректно.');
    stockMove(w.center,w.brand,-Number(v.get('qty')),id);w.spent=true;
  });
  M.form('stock-manual','center',(_,v)=>{
    const qty=Number(v.get('qty'));M.check(qty>0,'Укажите положительный объём.');
    stockMove(currentCenter().id,String(v.get('product')),v.get('kind')==='in'?qty:-qty,String(v.get('reason')));
  });
  M.form('work-finance','center',(id,v)=>{
    const w=workById(id),paid=Number(v.get('paid')),reward=Number(v.get('reward'));
    M.check(paid>=0&&Number.isFinite(paid)&&reward>=0&&Number.isFinite(reward),'Укажите корректные суммы.');
    w.paid=paid;w.reward=reward;w.rewardPaid=v.get('rewardPaid')==='yes';M.record('Расчёты по заказ-наряду',id);
  });
  M.form('sign-work','center',(id,v)=>{const w=workById(id);w.signature=String(v.get('name'));});
  M.task('print-work',['center','staff'],id=>{workById(id);window.print();});
  M.form('calendar-config','center',(_,v)=>{
    const p=currentCenter(),slots=String(v.get('slots')).split(',').map(x=>x.trim());
    M.check(slots.length&&slots.every(x=>/^(0[9]|1[0-7]):[0-5]\d$/.test(x)),'Слоты должны быть между 09:00 и 17:59.');
    p.slots=[...new Set(slots)].sort();p.overlap=String(v.get('overlap'));
  });

  const warranties=()=>M.registry('warranties',[
    {id:'W-DEMO-ACTIVE',center:'CENTER-A',work:'WORK-DEMO',owner:'client',make:'Демо авто',brand:'ATOMGARD',
      master:'Мастер 1',zones:'Зоны риска',roll:'ДЕМО-РУЛОН',vin:'DEMO-VIN',service360:true,
      installed:M.data.now-2*day,registered:M.data.now-day,inspection:M.data.now-day,start:M.data.now-day,status:'Активна'},
  ]);
  const cases=()=>M.registry('serviceCases');
  const warrantyVisible=w=>M.allow('staff')||w.owner===M.data.actor||sameCenter(centerOf(w.center));
  function warrantyById(id){const w=warranties().find(x=>x.id===id&&warrantyVisible(x));M.check(w,'Сертификат недоступен в этом кабинете.');return w;}
  function warrantyUrl(id){return route('mvp-warranty-card',{id});}
  function addMonths(stamp,months){
    const date=new Date(stamp+offset),originalDay=date.getUTCDate();
    date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months);
    const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay,lastDay));return date.getTime()-offset;
  }
  function warrantyList(){
    return head('Гарантии и сертификаты',M.pageActor()[0],link('Публичная проверка','mvp-warranty-check','secondary'))+
      (M.allow('center')?pack(link('Первичная регистрация','mvp-warranty-new','primary'),link('Закрытые работы','mvp-crm','secondary')):'')+
      table(['Номер','Центр','Статус','Действует до'],warranties().filter(warrantyVisible).map(w=>[
        link(text(w.id),warrantyUrl(w.id),'secondary'),text(centerOf(w.center).name),caption(w.status),
        dateOnly(w.start?addMonths(w.start,w.term||12):null),
      ]))+pack(link('Обращения по допсервису','mvp-service','secondary'));
  }
  function registerWarranty(){
    const p=currentCenter(),eligible=works().filter(w=>w.center===p.id&&w.closed);
    const next=M.params().get('work');
    return head('Первичная регистрация гарантии',text(p.name),link('Гарантии','mvp-warranty','secondary'))+
      (eligible.length?wrapForm('warranty-register','',dropdown('Выполненная работа','work',eligible.map(w=>[w.id,w.id+' · '+dateOnly(w.closed)]),next)+
        dropdown('Вид сертификата','program',[['fiv','Гарантия 360° FIVEROX'],['own','Гарантия самого АСЦ']])+
        input('Марка автомобиля','make','Демо авто')+input('VIN','vin','DEMO-VIN')+
        input('Номер рулона','roll','ДЕМО-РУЛОН')+input('Зоны оклейки','zones','Зоны риска')+
        input('Срок гарантии собственного АСЦ, мес.','term',6,'number'),'Зарегистрировать работу'):
        note('Сначала завершите заказ-наряд.'))+
      note('Регистрация в течение 3 рабочих дней. Осмотр исходным АСЦ в течение 14 дней после оклейки. В демо отсчёт осмотра календарный.');
  }
  function warrantyCard(){
    let w;try{w=warrantyById(M.params().get('id'));}catch(err){return head('Гарантия',err.message,link('Гарантии','mvp-warranty','secondary'));}
    const by=M.allow('staff'),original=sameCenter(centerOf(w.center));
    return head('Сертификат '+text(w.id),w.status,link('Реестр','mvp-warranty','secondary'))+
      block(card(w.service360?'Гарантия 360°':'Гарантия АСЦ',
        table(['Поле','Значение'],[['Автомобиль',text(w.make)],['VIN',text(w.vin)],['Плёнка',text(w.brand)],['Рулон',text(w.roll)],
          ['Зоны',text(w.zones)],['Мастер',text(w.master)],['АСЦ',text(centerOf(w.center).name)],['Регистрация',dateOnly(w.registered)],
          ['Осмотр',dateOnly(w.inspection)],['Начало',dateOnly(w.start)],['До',dateOnly(w.start?addMonths(w.start,w.term||12):null)]])+
        pack(action('Печать / PDF','warranty-print',w.id),link('Публичная проверка',route('mvp-warranty-check',{number:w.id}),'secondary'))),
      card('Действия по гарантии',pack(
        by&&w.status==='Ожидает проверки FIVEROX'?action('Подтвердить осмотр и активировать','warranty-activate',w.id,'primary'):'',
        by&&w.status==='Ожидает проверки FIVEROX'?action('Вернуть на устранение замечаний','warranty-correct',w.id):'',
        ['Не активирована из-за срока','Нужны исправления'].includes(w.status)&&(original||w.owner===M.data.actor)?
          action('Запросить восстановление','warranty-reopen',w.id,'primary'):'',
        w.service360&&w.start?link('Обращение по дополнительному сервису',route('mvp-service',{warranty:w.id}),'primary'):'')+
        (original&&['Ожидает осмотра','Не активирована из-за срока','Нужны исправления'].includes(w.status)?
          wrapForm('warranty-inspection',w.id,input('Дата осмотра','date',today(),'date')+
            dropdown('Результат','outcome',['Успешно','Нужна доработка']),'Зафиксировать осмотр'):'')+
        (by&&w.status==='Запрос восстановления'?wrapForm('warranty-restore',w.id,input('Индивидуальная дата начала','date',today(),'date')+
          input('Основание решения','reason','Демо проверка материалов'), 'Восстановить гарантию'):'')+
        (w.restoredReason?note('Основание восстановления: '+w.restoredReason):'')+
        (w.service360?note('Базовый период 12 месяцев от осмотра. Дополнительный сервис до 36 месяцев суммарно.'):'')));
  }
  function warrantyPublic(){
    const number=M.params().get('number')||'';
    const w=warranties().find(x=>x.id.toUpperCase()===number.toUpperCase());
    return head('Проверка гарантии по номеру','Публичные сведения о сертификате.')+
      wrapForm('warranty-search','',input('Номер сертификата','number',number||'W-DEMO-ACTIVE'),'Проверить')+
      (number? w?card('Результат проверки',table(['Статус','Срок','Марка автомобиля','АСЦ'],[[text(w.status),dateOnly(w.start?addMonths(w.start,w.term||12):null),
        text(w.make),text(centerOf(w.center).name)]])+note(w.service360?'Программа FIVEROX.':'Гарантию предоставляет АСЦ.')):note('Сертификат с таким номером не найден.'):'');
  }
  M.form('warranty-register','center',(_,v)=>{
    const w=workById(String(v.get('work')));M.check(w.closed,'Сначала закройте работу.');
    const service360=v.get('program')==='fiv';
    M.check(!service360||w.brand==='ATOMGARD','Для этой демонстрационной программы требуется материал ATOMGARD.');
    M.check(!warranties().some(x=>x.work===w.id&&x.id!=='W-DEMO-ACTIVE'),'Работа уже зарегистрирована.');
    const late=M.data.now>workingDayDeadline(w.closed,3);
    const term=service360?12:Number(v.get('term'));M.check(term>0&&term<=120,'Укажите срок гарантии.');
    const data=M.create('warranties','W',{center:w.center,work:w.id,owner:'client',service360,term,brand:w.brand,master:w.master,
      make:String(v.get('make')),vin:String(v.get('vin')),zones:String(v.get('zones')),roll:String(v.get('roll')),
      installed:w.closed,registered:M.data.now,late,status:service360?(late?'Не активирована из-за срока':'Ожидает осмотра'):'Гарантия АСЦ',
      start:service360?null:M.data.now});
    M.record('Регистрация гарантии',data.id);
    return warrantyUrl(data.id);
  });
  M.form('warranty-inspection','center',(id,v)=>{
    const w=warrantyById(id);M.check(sameCenter(centerOf(w.center))&&w.service360,'Осмотр проводит исходный АСЦ.');
    M.check(['Ожидает осмотра','Не активирована из-за срока','Нужны исправления'].includes(w.status),'Осмотр уже обработан.');
    const time=atMsk(String(v.get('date')));
    M.check(Number.isFinite(time)&&dayIso(time)>=dayIso(w.installed)&&dayIso(time)<=today(),'Проверьте дату осмотра.');
    w.inspection=time;
    if(w.late||dayIso(time)>dayIso(w.installed+14*day))w.status='Не активирована из-за срока';
    else w.status=v.get('outcome')==='Успешно'?'Ожидает проверки FIVEROX':'Нужны исправления';
    M.notify(['staff'],'Зафиксирован контрольный осмотр',id+' · '+w.status);
  });
  M.task('warranty-activate','staff',id=>{
    const w=warrantyById(id);M.change(w,['Ожидает проверки FIVEROX'],'Активна');w.start=w.inspection;
    M.notify([w.owner],'Гарантия активирована',id+' · документ в кабинете.');
    M.record('Активация с даты осмотра',id+' · '+dateOnly(w.start));
  });
  M.task('warranty-correct','staff',id=>M.change(warrantyById(id),['Ожидает проверки FIVEROX'],'Нужны исправления'));
  M.task('warranty-reopen',['customer','center'],id=>{
    const w=warrantyById(id);M.change(w,['Не активирована из-за срока','Нужны исправления'],'Запрос восстановления');
    M.notify(['staff'],'Запрос восстановления',id);
  });
  M.form('warranty-restore','staff',(id,v)=>{
    const w=warrantyById(id),date=atMsk(String(v.get('date')));
    M.check(Number.isFinite(date),'Укажите индивидуальную дату начала.');
    M.change(w,['Запрос восстановления'],'Восстановлена');
    w.start=date;w.restoredReason=String(v.get('reason'));
    M.record('Восстановление гарантии',id+' · '+dateOnly(date)+' · '+w.restoredReason);
  });
  M.form('warranty-search',null,(_,v)=>route('mvp-warranty-check',{number:String(v.get('number')).trim()}));
  M.task('warranty-print',['customer','center','staff'],id=>{warrantyById(id);window.print();});
  M.onExpire(()=>{
    for(const w of warranties()){
      if(w.status==='Ожидает осмотра'&&today()>dayIso(w.installed+14*day))w.status='Не активирована из-за срока';
      if(['Активна','Восстановлена','Гарантия АСЦ'].includes(w.status)&&w.start&&M.data.now>=addMonths(w.start,w.term||12))w.status='Истекла';
    }
  });
  function serviceDesk(){
    const staff=M.allow('staff');
    const visibleCases=cases().filter(c=>staff||c.owner===M.data.actor||(c.assigned&&sameCenter(centerOf(c.assigned))));
    const selected=M.params().get('warranty');
    const available=warranties().filter(w=>w.service360&&w.start&&M.data.now<addMonths(w.start,36)&&
      (w.owner===M.data.actor||M.allow('center')&&w.id===selected));
    return head('Дополнительный сервис до 36 месяцев','Клиент или АСЦ обращается в FIVEROX. Центр получает назначенное обращение.',
      link('Гарантии','mvp-warranty','secondary'))+
      (!staff?wrapForm('service-new','',available.length?
        dropdown('Сертификат','warranty',available.map(w=>[w.id,w.id]),selected)+input('Причина обращения','cause','Контроль плёнки'):
        input('Номер сертификата','warranty',selected||'W-DEMO-ACTIVE')+input('Причина обращения','cause','Контроль плёнки'),'Передать заявку FIVEROX'):'')+
      visibleCases.map(c=>card(c.id+' · '+c.warranty,'<p>'+caption(c.status)+' '+text(c.cause)+'</p>'+
        (c.assigned?note('Центр: '+centerOf(c.assigned).name+' · '+c.decision+' · '+c.payer):'')+
        (staff?wrapForm('service-decide',c.id,dropdown('Назначенный АСЦ','assigned',getProviders().filter(p=>p.connected).map(p=>[p.id,p.name]),c.assigned)+
          dropdown('Решение','outcome',['Подтверждено','Отклонено'])+input('Решение клиенту и АСЦ','decision','Провести осмотр')+
          input('Плательщик и условия','payer','Определяется по результатам осмотра')+input('Внутренняя причина','internal','Демо проверка'),'Зафиксировать решение')+
          (c.internal?'<p>Внутренний комментарий: '+text(c.internal)+'</p>':''):'')+
        (!staff&&c.assigned&&sameCenter(centerOf(c.assigned))&&c.status==='Подтверждено'?
          pack(action('Отметить исполнение','service-complete',c.id)):''))).join('');
  }
  M.form('service-new',['customer','center'],(_,v)=>{
    const w=warranties().find(x=>x.id===v.get('warranty')&&x.service360&&x.start&&M.data.now<addMonths(x.start,36));
    M.check(w&&(w.owner===M.data.actor||M.allow('center')),'Гарантия недоступна или срок допсервиса закончился.');
    const c=M.create('serviceCases','CASE',{warranty:w.id,owner:w.owner,cause:String(v.get('cause')),status:'Передано в FIVEROX'});
    M.notify(['staff'],'Обращение по дополнительному сервису',c.id);
  });
  M.form('service-decide','staff',(id,v)=>{
    const c=M.find('serviceCases',id),a=centerOf(String(v.get('assigned')));
    M.check(c.status!=='Выполнено','Обращение уже выполнено.');
    c.status=String(v.get('outcome'));c.assigned=c.status==='Подтверждено'?a.id:null;
    c.decision=String(v.get('decision'));c.payer=String(v.get('payer'));c.internal=String(v.get('internal'));
    M.notify([c.owner,...(c.assigned?[a.owner]:[])],'Решение по допсервису',id+' · '+c.decision+' · '+c.payer);
    M.record('Решение по дополнительному сервису',id+' · '+c.status);
  });
  M.task('service-complete','center',id=>{
    const c=M.find('serviceCases',id);
    M.check(c.assigned&&sameCenter(centerOf(c.assigned)),'Обращение назначено другому центру.');
    M.change(c,['Подтверждено'],'Выполнено');
  });

  M.onInstall(()=>{
    add('mvp-provider','MVP30','Карточка исполнителя','Сервисные центры',null,providerPage);
    add('mvp-booking','MVP31','Запись через FIVEROX','Сервисные центры',null,bookingForm);
    add('mvp-booking-detail','MVP32','Сервисная заявка','Сервисные центры',null,bookingDetail);
    add('mvp-reviews','MVP33','Отзывы после услуги','Сервисные центры',null,reviewPage);
    add('mvp-moderation','MVP34','Каталог и модерация','Администратор','moderator',moderation);
    add('mvp-crm','MVP35','Мини CRM АСЦ','Сервисный центр',['center','staff'],crm);
    add('mvp-work','MVP36','Заказ-наряд АСЦ','Сервисный центр',['center','staff'],workPage);
    add('mvp-work-new','MVP37','Новая работа АСЦ','Сервисный центр','center',addWorkPage);
    add('mvp-work-doc','MVP38','Документы работы','Сервисный центр',['center','staff'],docsPage);
    add('mvp-calendar','MVP39','Календарь АСЦ','Сервисный центр',['center','staff'],calendar);
    add('mvp-stock','MVP40','Склад АСЦ','Сервисный центр',['center','staff'],stockPage);
    add('mvp-warranty','MVP41','Гарантии и сертификаты','Гарантия 360',['customer','center','staff'],warrantyList);
    add('mvp-warranty-new','MVP42','Регистрация гарантии','Сервисный центр','center',registerWarranty);
    add('mvp-warranty-card','MVP43','Гарантийный сертификат','Гарантия 360',['customer','center','staff'],warrantyCard);
    add('mvp-warranty-check','MVP44','Публичная проверка гарантии','Гарантия 360',null,warrantyPublic);
    add('mvp-service','MVP45','Дополнительный сервис','Гарантия 360',['customer','center','staff'],serviceDesk);
    override('centers',null,directory);
    override('center',null,()=>providerPage('CENTER-A'));
    override('center-other',null,()=>providerPage('STUDIO-DEMO'));
    override('booking',null,bookingForm);
    override('booking-success',null,bookingDetail);
    override('review',null,reviewPage);
    override('client-bookings',['customer','staff','center','guest'],bookingList);
    override('client-warranty','customer',warrantyList);
    override('claim',['customer','center'],serviceDesk);
    override('claim-success',['customer','center','staff'],serviceDesk);
    override('admin-quality','staff',warrantyList);
    const originalClient=routes.client.render;
    override('client','customer',()=>originalClient()+pack(link('Мои заявки','client-orders','primary'),link('Гарантии','mvp-warranty','secondary'),
      link('Записи и срочные обращения','client-bookings','secondary'),link('Школа','learn-programs','secondary')));
    const initialGuarantee=routes.guarantee.render;
    override('guarantee',null,()=>initialGuarantee()+pack(link('Проверить номер сертификата','mvp-warranty-check','primary'),
      link('Обратиться по гарантии','mvp-service','secondary')));
    const initialAsc=routes.asc.render;
    override('asc','center',()=>M.allow('asc')?initialAsc()+pack(link('Мини CRM','mvp-crm','primary'),link('Календарь','mvp-calendar','secondary'),
      link('Паспорта и гарантии','mvp-warranty','secondary')):crm());
    for(const id of ['job-car','job-panels','job-material','job-prep','job-process','job-final','job-review','job-success'])override(id,'asc',null);
    const legacyJob=routes['job-success'].render;
    override('job-success','asc',()=>legacyJob()+pack(link('Гарантийный реестр','mvp-warranty','primary'),link('Мини CRM','mvp-crm','secondary')));
    override('inspection','center',warrantyList);
    override('inspection-success','center',warrantyList);
    override('certificate',['center','customer','staff'],warrantyList);
    const installation = menus.asc.find(item=>item[1]==='job-car');
    if(installation)installation[1]='mvp-work-new';
    menus.asc.push(['Мини CRM','mvp-crm'],['Записи клиентов','client-bookings'],['Календарь','mvp-calendar'],['Склад','mvp-stock']);
    menus.admin.push(['Записи и горячие лиды','client-bookings'],['Карточки и отзывы','mvp-moderation'],
      ['Мини CRM центров','mvp-crm'],['Гарантии','mvp-warranty'],['Сервис до 36 мес.','mvp-service']);
    M.describe('Исполнители, импорт и модерация','operator','mvp-moderation','AT-10 · AT-37–40',[
      'Выберите источник, добавьте дубль или отдельный филиал.',
      'Проверьте публичную карточку частного мастера и обычного детейлинга.',
      'Отмодерируйте обновление АСЦ, отзыв и отдельный ответ.',
    ]);
    M.describe('Запись в подключённый АСЦ','client',route('mvp-booking',{id:'CENTER-A'}),'AT-11–13 · AT-15',[
      'Выберите будущий слот. Проверьте его из второго клиента.',
      'Откройте кабинет АСЦ или продвиньте демо время в FIVEROX.',
      'После отметки об услуге клиент может отправить отзыв на модерацию.',
    ]);
    M.describe('Срочная заявка сегодня','client',route('mvp-booking',{id:'CENTER-A',mode:'urgent'}),'AT-14',[
      'Отправьте горячий лид без выбора слота.',
      'Откройте уведомления и отметьте созвон от имени АСЦ или FIVEROX.',
    ]);
    M.describe('Запись к неподключённому исполнителю','client',route('mvp-booking',{id:'MASTER-DEMO'}),'AT-37–38',[
      'Отправьте пожелание по времени.',
      'От имени FIVEROX согласуйте запись вручную или отразите отказ.',
    ]);
    M.describe('Мини CRM, склад и документы','asc','mvp-crm','AT-16–17',[
      'Создайте клиента, заказ-наряд и проверьте конфликт поста.',
      'Закройте заказ. Отдельно оформите расход, оплату и вознаграждение мастеру.',
      'Распечатайте документы. Переключите АСЦ для проверки доступа.',
    ]);
    M.describe('Гарантия и восстановление','asc','mvp-warranty-new','AT-18–21',[
      'Используйте работу WORK-DEMO для своевременной регистрации или WORK-LATE для просрочки.',
      'Зафиксируйте осмотр. FIVEROX активирует или восстанавливает гарантию.',
      'Проверьте номер в публичной части.',
    ]);
    M.describe('Дополнительный сервис до 36 месяцев','client','mvp-service','AT-22',[
      'Создайте обращение по демо сертификату W-DEMO-ACTIVE.',
      'FIVEROX назначает другой АСЦ и указывает решение и плательщика.',
      'Назначенный центр видит только конкретное обращение.',
    ]);
  });
})();

