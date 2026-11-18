
'use strict';

(() => {
  const M=MVP, F=MVPFinance;
  const {add,override,card,block,note,pack,caption,action,text,input,dropdown,wrapForm,route,showDate,dateOnly}=M;
  const quizAnswers={sales:[1,0,1,2,1],ppf:[0,1,2,0,1],tint:[1,0,2,1,0],business:[1,2,0,1,0]};
  const courseFixtures=[
    {id:'sales',free:1,price:4000,days:60,wait:7,manual:-1,issue:'auto',history:true,published:true,version:1},
    {id:'ppf',free:2,price:6500,days:90,wait:7,manual:1,issue:'auto',history:true,published:true,version:1},
    {id:'tint',free:1,price:4000,days:45,wait:10,manual:2,issue:'review',history:true,published:true,version:1},
    {id:'business',free:0,price:5500,days:30,wait:14,manual:2,issue:'review',history:true,published:true,version:1},
  ];
  const courseList=()=>M.registry('courses',courseFixtures);
  const courses=()=>courseList().filter(c=>c.published);
  const courseById=(id)=>M.find('courses',id,courseFixtures);
  const trackById=id=>learnTracks.find(t=>t.id===id);
  const enrollments=()=>M.registry('enrollments');
  const progress=()=>M.registry('schoolProgress');
  const certificates=()=>M.registry('schoolCertificates',[
    {id:'L-DEMO-SALES-SAMPLE',owner:'sample',track:'sales',at:Date.parse('2026-11-18T12:00:00+03:00'),status:'Действует'},
  ]);
  const trainingRequests=()=>M.registry('practiceRequests');
  const owner=()=>M.data.actor;
  const enroll=(person,id)=>enrollments().find(e=>e.owner===person&&e.course===id);
  const steps=(person,id)=>progress().filter(p=>p.owner===person&&p.course===id&&p.status==='Пройден').sort((a,b)=>a.step-b.step);
  const lessonRoute=(id,step)=>route('learn-lesson',{track:id,lesson:String(step)});
  const courseRoute=id=>route('mvp-course',{id});
  function identifier(person,id){return 'L-DEMO-'+id.toUpperCase()+'-'+person.toUpperCase();}
  function certLink(id){return route('mvp-certificate-check',{number:id});}
  function enrollmentActive(person,id){
    const e=enroll(person,id);return e?.status==='Доступ открыт'&&e.expires>M.data.now;
  }
  function allowedLesson(person,id,step) {
    const course=courseById(id);
    const e=enroll(person,id);
    const free=e?.free??course.free;
    return (step<free||enrollmentActive(person,id)) && course.published;
  }
  function refreshLearn() {
    learnData={
      progress:Object.fromEntries(learnTracks.map(t=>[t.id,steps(owner(),t.id).map(p=>p.step)])),
      certificates:certificates().filter(x=>x.owner===owner()&&x.status==='Действует').map(x=>({track:x.track,date:new Date(x.at).toISOString(),id:x.id})),
    };
  }
  function publicCourses() {
    return head('Программы обучения','FIVEROX School · курсы, онлайн-занятия и практика.',
      M.allow('learner')?link('Моё обучение','learn','secondary'):link('Войти или зарегистрироваться',route('mvp-login',{actor:'client',next:'learn-programs'}),'secondary'))+
      block(...courses().map(c=>{
        const t=trackById(c.id);
        return card(t.title,'<p>'+text(t.short)+'</p>'+M.list(t.lessons.map(x=>x.title))+
          pack(link('Открыть описание',courseRoute(c.id),'primary'),M.allow('learner')?link('Дорожная карта',route('learn',{track:c.id}),'secondary'):''));
      }))+
      pack(link('Проверить сертификат школы','mvp-certificate-check','secondary'),link('Мероприятия','mvp-events','secondary'));
  }
  function coursePage() {
    const id=M.params().get('id')||'sales';
    const c=courses().find(x=>x.id===id),t=trackById(id);
    if(!c||!t)return head('Курс','Описание недоступно.',link('Программы','learn-programs','secondary'));
    const enrolled=M.allow('learner')&&enroll(owner(),id);
    const done=M.allow('learner')?steps(owner(),id):[];
    const free=enrolled?.free??c.free;
    const active=enrollmentActive(owner(),id);
    const canRequest=M.allow('learner')&&(!enrolled||!['Ожидает внешней оплаты','Доступ открыт'].includes(enrolled.status));
    return head(text(t.title),text(t.short),link('Все программы','learn-programs','secondary'))+
      block(card('Программа и доступ',table(['Этап','Формат','Доступ'],t.lessons.map((l,i)=>[
        text(l.title),['Текст и видео','Файл и тест','Домашнее задание','Онлайн-занятие','Практика в АСЦ'][i],
        M.allow('learner')&&(i<free||active)?link(done.some(p=>p.step===i)?'Повторить':'Открыть',lessonRoute(id,i),'secondary'):
          caption(i<free?'После регистрации':'После подтверждения доступа'),
      ]))+note(free+' бесплатных этапов для зарегистрированных. Платная часть: '+money(c.price)+'. Демо срок доступа: '+c.days+' дней.')),
      card('Заявка и обучение',(enrolled?note(enrolled.status+(enrolled.expires?' · доступ до '+dateOnly(enrolled.expires):'')+(enrolled.bonusUsed?' · бонусов использовано '+enrolled.bonusUsed:'')):'')+
        (M.allow('learner')?pack(link('Дорожная карта',route('learn',{track:id}),'secondary'),
          link('Практика и онлайн-занятия',route('mvp-practice',{id}),'secondary'),
          enrolled&&['Ожидает внешней оплаты','Доступ открыт'].includes(enrolled.status)?'':
            action('Подать заявку на платный курс','course-apply',id,'primary')) :
          pack(link('Войти для доступа',route('mvp-login',{actor:'client',next:courseRoute(id)}),'primary'))) +
        (canRequest&&F.balance('product',owner())+F.balance('school',owner())>0
          ? wrapForm('course-with-points',id,input('Бонусы на обучение','points',10,'number',true,'Демо лимит 20% от цены курса'),
            'Подать заявку с бонусами') : '')+
        note('Оплата согласуется вне портала. Доступ открывается после отметки FIVEROX.')));
  }
  function gradeDesk() {
    const staff=M.allow('staff');
    return head(staff?'Управление школой':'Кабинет преподавателя','Заявки на курс, проверка уроков, публикация и практика.',
      link('Публичные программы','learn-programs','secondary'))+
      (staff?card('Доступ и внешний расчёт',table(['Заявка','Курс','Ученик / роль','Статус','Действия'],enrollments().map(e=>[
        text(e.id),text(trackById(e.course).title),text(M.actors[e.owner][0]),caption(e.status),
        pack(e.status==='Ожидает внешней оплаты'?action('Подтвердить оплату','course-paid',e.id,'primary'):'',
          e.paidAt&&e.status!=='Возврат отмечен'?action('Отметить возврат вне портала','course-refund',e.id):''),
      ]))+note('Пересчёт учебных бонусов после возврата фиксируется индивидуально в журнале балансов.')):'')+
      card('Задания на проверке',table(['Работа','Урок','Ученик / роль','Результат'],progress().filter(p=>p.status==='Ожидает преподавателя'&&teacherAssigned(p.course)).map(p=>[
        text(p.submission||'Демо ответ'),text(trackById(p.course).lessons[p.step].title),text(M.actors[p.owner][0]),
        pack(action('Зачесть','course-grade',p.id,'primary'),action('Вернуть на доработку','course-revise',p.id)),
      ])))+
      (staff?card('Сертификаты после подтверждения',table(['Номер','Курс','Решение'],certificates().filter(c=>c.status==='Ожидает проверки').map(c=>[
        text(c.id),text(trackById(c.track).title),action('Подтвердить выдачу','issue-certificate',c.id,'primary'),
      ]))):'')+
      block(...courseList().filter(c=>teacherAssigned(c.id)).map(c=>card(trackById(c.id).title,
        '<p>'+caption(c.draft?'Черновик на проверке':'Опубликованная версия '+c.version)+'</p>'+
        wrapForm('course-settings',c.id,input('Бесплатные уроки','free',c.draft?.free??c.free,'number')+
          input('Цена платной части','price',c.draft?.price??c.price,'number')+input('Доступ, дней','days',c.draft?.days??c.days,'number')+
          input('Реферальное ожидание, дней','wait',c.draft?.wait??c.wait,'number')+
          dropdown('Сертификат','issue',[['auto','Автоматически'],['review','После проверки']],c.draft?.issue??c.issue)+
          dropdown('История после окончания','history',[['yes','Доступна'],['no','Ограничена']],(c.draft?.history??c.history)?'yes':'no'),'Сохранить черновик')+
        (c.draft&&staff?pack(action('Проверить и опубликовать','course-publish',c.id,'primary')):''))))+
      pack(link('Практика и онлайн-занятия','mvp-practice','secondary'),link('Реестр учебных сертификатов','learn-certificates','secondary'));
  }
  function teacherAssigned(id){return M.allow('staff')||['sales','ppf'].includes(id);}
  function handleCompletion(entry) {
    entry.status='Пройден';
    entry.doneAt=M.data.now;
    const c=courseById(entry.course), t=trackById(entry.course);
    const done=steps(entry.owner,entry.course);
    const full=done.length===t.lessons.length;
    F.learnBonus(entry.owner,entry.course,entry.step,full);
    const e=enroll(entry.owner,entry.course);
    F.referCourse(entry.owner,entry.course,e?.paidAt,Math.min(...done.map(p=>p.doneAt)),e?.wait??c.wait,e?.status!=='Возврат отмечен');
    if(full&&!certificates().some(x=>x.owner===entry.owner&&x.track===entry.course)){
      const cert={id:identifier(entry.owner,entry.course),owner:entry.owner,track:entry.course,at:M.data.now,
        status:(e?.issue??c.issue)==='auto'?'Действует':'Ожидает проверки'};
      certificates().unshift(cert);
      M.notify(cert.status==='Действует'?[cert.owner]:['staff'],'Курс завершён',cert.id+' · '+cert.status);
    }
    M.notify([entry.owner],'Урок зачтён',t.title+' · этап '+(entry.step+1));
    M.record('Успешное завершение урока',entry.owner+' · '+entry.course+' · '+entry.step);
  }
  function dashboard(original) {
    refreshLearn();
    const id=learnTrack().id, e=enroll(owner(),id);
    return original()+pack(link('Условия и заявка',courseRoute(id),'primary'),
      link('Практика и онлайн-занятия',route('mvp-practice',{id}),'secondary'))+
      (e&&e.expires<=M.data.now&&e.status==='Доступ открыт'?note('Период доступа закончился. История хранится согласно настройкам курса.'):'');
  }
  function lesson(original) {
    refreshLearn();
    const t=learnTrack(),q=learnQuery().get('lesson'),n=q===null?Math.max(0,learnNext(t)):Number(q);
    if(!Number.isInteger(n)||!t.lessons[n])return original();
    if(!allowedLesson(owner(),t.id,n))return head('Доступ к учебному этапу',text(t.title),link('Условия курса',courseRoute(t.id),'primary'))+
      note('Этап входит в платную часть или срок доступа завершён. Оформите заявку и дождитесь подтверждения оплаты FIVEROX.');
    const saved=progress().find(p=>p.owner===owner()&&p.course===t.id&&p.step===n);
    const c=courseById(t.id);const e=enroll(owner(),t.id);
    if(!steps(owner(),t.id).some(p=>p.step===n)&&learnNext(t)!==n)return original();
    const html=original().replace(/data-learn-quiz data-track="[^"]+" data-lesson="\d+"/,
      'data-mvp-form="school-quiz" data-id="'+t.id+':'+n+'"').replace('class="learn-feedback"','class="learn-feedback" data-mvp-error');
    const extra=block(card('Материалы урока',M.list(['Текст урока открыт на этой странице.','Видеоматериал и файл доступны в демонстрации просмотра.',
      'Онлайн и практика согласуются через заявку.'])+
      pack(action('Открыть демонстрацию видео','course-media',t.id+':video'),
        action('Просмотреть образец файла','course-media',t.id+':file'))+
      (M.data.settings.media?.track===t.id?note(M.data.settings.media.status):'')),
      card('Проверка и практика',
        ((e?.manual??c.manual)===n?note('Этот этап проверяет преподаватель. После ответа вы увидите статус задания.'):'')+
        (saved?note(saved.status+(saved.submission?' · '+saved.submission:'')):'')+
        pack(link('Запросить практику','mvp-practice?id='+t.id,'secondary'))));
    return html+extra;
  }
  function certificateList() {
    refreshLearn();
    return head('Сертификаты школы','Номер и QR для публичной проверки.',link('Программы','learn-programs','secondary'))+
      table(['Номер','Курс','Статус','Действие'],certificates().filter(c=>c.owner===owner()).map(c=>[
        text(c.id),text(trackById(c.track).title),caption(c.status),
        c.status==='Действует'?link('Открыть сертификат',route('learn-certificate',{track:c.track}),'primary'):'',
      ]))+pack(link('Публичная проверка','mvp-certificate-check','secondary'));
  }
  function qrBlock(id) {
    const png=typeof MVP_CERT_QR==='object'&&MVP_CERT_QR[id];
    return pack(link('Проверить номер',certLink(id),'secondary'))+
      (png?'<figure><img width="156" height="156" alt="QR для проверки сертификата '+text(id)+'" src="data:image/png;base64,'+png+'"></figure>':'');
  }
  function certificatePage(original) {
    refreshLearn();
    const id=learnTrack().id;
    const c=certificates().find(x=>x.owner===owner()&&x.track===id);
    const set=enroll(owner(),id);
    if(set&&set.expires&&set.expires<=M.data.now&&!set.history)
      return head('Сертификат','Доступ по завершении периода ограничен настройкой курса.',link('Все курсы','learn-programs','secondary'));
    return original()+(c?.status==='Действует'?card('Публичная проверка и QR',qrBlock(c.id)):
      c?note('Сертификат ожидает подтверждения FIVEROX.'):'');
  }
  function publicCertificate() {
    const number=M.params().get('number')||'';
    const c=certificates().find(x=>x.id.toUpperCase()===number.toUpperCase());
    return head('Проверить сертификат FIVEROX School','Публичные сведения о документе.')+
      wrapForm('certificate-find','',input('Номер сертификата','number',number||'L-DEMO-SALES-SAMPLE'),'Проверить')+
      (number? c?card('Результат проверки',table(['Статус','Курс','Дата выдачи'],[[
        text(c.status),text(trackById(c.track).title),c.status==='Действует'?dateOnly(c.at):'—',
      ]])+qrBlock(c.id)):note('В реестре этой демоверсии сертификат не найден.'):'');
  }
  function practicePage() {
    const staff=M.allow(['staff','organizer']);
    const id=M.params().get('id')||'sales';
    return head('Практика и онлайн-занятия','Организатор согласует дату и центр.',link('Программы','learn-programs','secondary'))+
      (M.allow('learner')&&!staff?wrapForm('practice-new','',dropdown('Курс','course',courses().map(c=>[c.id,trackById(c.id).title]),id)+
        dropdown('Формат','type',['Практика в АСЦ','Онлайн-занятие'])+
        input('Пожелание по графику','notes','Демо пожелание'),'Отправить заявку'):'')+
      trainingRequests().filter(r=>staff||r.owner===owner()).map(r=>card(r.id+' · '+r.type,
        '<p>'+text(trackById(r.course).title)+' · '+caption(r.status)+'</p>'+
        (r.location?note(r.date+' · '+r.location):'')+
        (staff&&r.status!=='Согласована'?wrapForm('practice-approve',r.id,input('Дата','date','2026-12-01','date')+
          input('Центр или онлайн-встреча','location','Демо-центр А'),'Согласовать расписание'):''))).join('');
  }

  function applyCourse(id, points=0) {
    const c=courseById(id);const old=enroll(owner(),id);
    M.check(c.published&&(!old||!['Доступ открыт','Ожидает внешней оплаты'].includes(old.status)),'Заявка уже оформлена.');
    const e=M.create('enrollments','ENR',{owner:owner(),course:id,version:c.version,price:c.price,free:c.free,days:c.days,
      wait:c.wait,manual:c.manual,issue:c.issue,history:c.history,status:'Ожидает внешней оплаты'});
    if(points>0){F.spendPoints(owner(),points,e.id,e.price);e.bonusUsed=points;}
    M.notify(['staff'],'Заявка на курс',e.id+' · '+trackById(id).title);
  }
  M.task('course-apply','learner',id=>applyCourse(id));
  M.form('course-with-points','learner',(id,v)=>{
    const points=Number(v.get('points'));
    M.check(Number.isFinite(points)&&points>0,'Укажите положительное число бонусов.');
    applyCourse(id,points);
  });
  M.task('course-paid','staff',id=>{
    const e=M.find('enrollments',id);
    M.change(e,['Ожидает внешней оплаты'],'Доступ открыт');
    e.paidAt=M.data.now;e.expires=e.paidAt+e.days*F.day;
    const done=steps(e.owner,e.course);
    F.referCourse(e.owner,e.course,e.paidAt,done[0]?.doneAt,e.wait);
    M.notify([e.owner],'Оплата подтверждена · курс открыт',e.id);
    M.record('Внешняя оплата курса',id);
  });
  M.task('course-refund','staff',id=>{
    const e=M.find('enrollments',id);
    M.change(e,['Доступ открыт','Доступ завершён'],'Возврат отмечен');e.expires=M.data.now;
    F.referCourse(e.owner,e.course,e.paidAt,null,e.wait,false);
    M.record('Зафиксирован внешний возврат',id+' · учебный пересчёт требует решения');
  });
  M.form('school-quiz','learner',(id,v)=>{
    const [course,number]=id.split(':');
    const step=Number(number),t=trackById(course),c=courseById(course),e=enroll(owner(),course);
    M.check(t?.lessons[step]&&allowedLesson(owner(),course,step),'Проверьте доступ к уроку.');
    const all=progress();const previous=steps(owner(),course);
    M.check(previous.filter(p=>p.step<step).length===step,'Закончите предыдущие этапы.');
    const existing=all.find(p=>p.owner===owner()&&p.course===course&&p.step===step);
    if(existing?.status==='Пройден'){toast('Урок уже зачтён. Повторного начисления нет.');return route('learn',{track:course});}
    M.check(v.get('answer')!==null&&Number(v.get('answer'))===quizAnswers[course][step],'Ответ пока неверный. Проверьте материал и повторите.');
    const entry=existing||M.create('schoolProgress','LESSON',{owner:owner(),course,step});
    if((e?.manual??c.manual)===step){
      entry.status='Ожидает преподавателя';entry.submission='Контрольный ответ, этап '+(step+1);
      M.notify(['teacher','staff'],'Задание на проверке',entry.id);
      return lessonRoute(course,step);
    }
    handleCompletion(entry);
    return route('learn',{track:course});
  });
  M.task('course-grade','teacher',id=>{
    const x=M.find('schoolProgress',id);M.check(x.status==='Ожидает преподавателя'&&teacherAssigned(x.course),'Задание недоступно.');
    handleCompletion(x);
  });
  M.task('course-revise','teacher',id=>{
    const x=M.find('schoolProgress',id);M.check(teacherAssigned(x.course),'Этот курс не назначен.');
    M.change(x,['Ожидает преподавателя'],'Вернуть на доработку');
    M.notify([x.owner],'Задание требует доработки',x.id);
  });
  M.form('course-settings','teacher',(id,v)=>{
    const c=courseById(id); M.check(teacherAssigned(id),'Курс не назначен преподавателю.');
    const free=Number(v.get('free')),price=Number(v.get('price')),days=Number(v.get('days')),wait=Number(v.get('wait'));
    M.check(Number.isSafeInteger(free)&&free>=0&&free<=trackById(id).lessons.length&&Number.isFinite(price)&&price>=0&&days>0&&wait>=0,
      'Проверьте параметры доступа.');
    c.draft={free,price,days,wait,issue:String(v.get('issue')),history:v.get('history')==='yes'};
    M.notify(['staff'],'Настройки курса ожидают публикации',id);
  });
  M.task('course-publish','staff',id=>{
    const c=courseById(id);M.check(c.draft,'Нет черновика.');
    Object.assign(c,c.draft,{version:c.version+1});delete c.draft;
    M.record('Опубликована версия курса',id+' · '+c.version);
  });
  M.task('issue-certificate','staff',id=>{
    const c=M.find('schoolCertificates',id);M.change(c,['Ожидает проверки'],'Действует');c.at=M.data.now;
    M.notify([c.owner],'Сертификат школы выдан',c.id);
  });
  M.task('course-media','learner',id=>{
    const [track,format]=id.split(':');
    M.data.settings.media={track,status:format==='video'?'Демо проигрыватель. В финальном продукте видео доступно по приватной ссылке.':
      'Демо файл: чек-лист “Задача, условия, работа, контроль результата”.'};
  });
  M.form('certificate-find',null,(_,v)=>certLink(String(v.get('number')).trim()));
  M.form('practice-new','learner',(_,v)=>{
    const r=M.create('practiceRequests','PRAC',{owner:owner(),course:String(v.get('course')),type:String(v.get('type')),
      notes:String(v.get('notes')),status:'Ожидает согласования'});
    M.notify(['organizer','staff'],'Заявка на практику или онлайн-занятие',r.id);
  });
  M.form('practice-approve','organizer',(id,v)=>{
    const r=M.find('practiceRequests',id);M.change(r,['Ожидает согласования'],'Согласована');
    r.date=String(v.get('date'));r.location=String(v.get('location'));
    M.notify([r.owner],'Практика или онлайн-занятие согласованы',r.id+' · '+r.date);
  });
  M.onExpire(()=>{
    for(const e of enrollments())if(e.status==='Доступ открыт'&&e.expires<=M.data.now){
      e.status='Доступ завершён';M.notify([e.owner],'Период доступа к курсу завершён',e.id);
    }
  });

  const events=()=>M.registry('events',[
    {id:'EVT-DEMO',title:'Демо мастер-класс по оклейке',date:'2026-12-01',place:'Демо-центр А',confirmation:'manual',certificate:'attendance',
      audience:'Все зарегистрированные',material:'Программа и памятка участников',code:'EVT-DEMO-CHECKIN'},
  ]);
  const registrations=()=>M.registry('eventRegistrations');
  function eventPage() {
    const id=M.params().get('id');
    const cards=events().filter(e=>!id||e.id===id).map(e=>{
      const r=registrations().find(x=>x.event===e.id&&x.owner===owner());
      const audienceOk=e.audience==='Все зарегистрированные'||M.allow(['partner','center','staff']);
      return card(e.title,M.list([e.date,e.place,e.audience,e.confirmation==='manual'?'Подтверждает организатор':'Подтверждение автоматически'])+
        (r?note('Участие: '+r.status+(r.attended?' · присутствие отмечено':'')+(r.cert?' · сертификат доступен':'')):'')+
        (r&&['Подтверждена','Посетил'].includes(r.status)?note(e.material):'')+
        pack(!r&&M.allow('learner')&&audienceOk?action('Подать заявку','event-apply',e.id,'primary'):'',
          r?.cert?link('Сертификат участника',route('mvp-event-certificate',{id:r.id}),'secondary'):'',
          !M.allow('learner')?link('Войти для участия',route('mvp-login',{actor:'client',next:'mvp-events'}),'secondary'):''));});
    return head('Мероприятия FIVEROX','Календарь, заявки на участие и материалы.')+block(...cards);
  }
  function eventDesk() {
    return head('Кабинет организатора','Заявки, подтверждение и фактическое присутствие.',link('Календарь мероприятий','mvp-events','secondary'))+
      wrapForm('event-new','',input('Название','title','Демо встреча партнёров')+input('Дата','date','2026-12-05','date')+
        input('Место','place','Демо площадка')+dropdown('Аудитория','audience',['Все зарегистрированные','Партнёры и АСЦ'])+
        dropdown('Подтверждение','confirmation',[['manual','Организатором'],['auto','Автоматически']])+
        dropdown('Выдача сертификата','certificate',[['attendance','После присутствия'],['manual','После подтверждения организатором']])+
        input('Материалы','material','Демо программа'),'Создать мероприятие')+
      block(...events().map(e=>card(e.title,table(['Заявка','Участник','Статус','Действия'],registrations().filter(r=>r.event===e.id).map(r=>[
        text(r.id),text(M.actors[r.owner][0]),caption(r.status),pack(
          r.status==='Заявка подана'?action('Подтвердить участника','event-confirm',r.id,'primary'):'',
          r.status==='Подтверждена'?action('Отметить присутствие','event-attend',r.id):'',
          r.attended&&!r.cert?action('Выдать сертификат','event-issue',r.id):''),
      ]))+wrapForm('event-qr',e.id,input('Номер заявки','registration','')+
        input('Условный QR-код регистрации','code',e.code),'Демо QR отметка'))))+
      pack(link('Заявки на практику','mvp-practice','secondary'));
  }
  function eventCertificate(){
    const id=M.params().get('id'),r=registrations().find(x=>x.id===id&&x.cert&&(x.owner===owner()||M.allow('organizer')));
    if(!r)return head('Сертификат мероприятия','Документ доступен участнику после выдачи.',link('Мероприятия','mvp-events','secondary'));
    const e=M.find('events',r.event);
    return head('Сертификат участника',text(e.title),link('К мероприятию','mvp-events','secondary'))+
      card('Демонстрационный сертификат',M.list([r.cert,e.date,e.place])+pack(action('Печать / PDF','event-print',r.id)));
  }
  M.form('event-new','organizer',(_,v)=>{
    const e=M.create('events','EVT',{title:String(v.get('title')),date:String(v.get('date')),place:String(v.get('place')),
      audience:String(v.get('audience')),confirmation:String(v.get('confirmation')),certificate:String(v.get('certificate')),
      material:String(v.get('material')),code:'CHECKIN-DEMO-'+(M.data.count+1)});
    M.record('Настройки мероприятия',e.id);
  });
  M.task('event-apply','learner',id=>{
    const e=M.find('events',id);
    M.check(e.audience==='Все зарегистрированные'||M.allow(['partner','center','staff']),'Мероприятие для партнёров и АСЦ.');
    M.check(!registrations().some(r=>r.event===id&&r.owner===owner()),'Заявка уже подана.');
    const r=M.create('eventRegistrations','EVR',{event:id,owner:owner(),status:e.confirmation==='auto'?'Подтверждена':'Заявка подана'});
    M.notify(['organizer'],'Заявка на мероприятие',r.id);
  });
  M.task('event-confirm','organizer',id=>{
    const r=M.find('eventRegistrations',id);M.change(r,['Заявка подана'],'Подтверждена');
    M.notify([r.owner],'Участие подтверждено',id);
  });
  function eventCheckIn(r) {
    const e=M.find('events',r.event);M.change(r,['Подтверждена'],'Посетил');r.attended=M.data.now;
    if(e.certificate==='attendance')r.cert='EV-CERT-'+r.id;
    M.record('Факт посещения',r.id);
  }
  M.task('event-attend','organizer',id=>eventCheckIn(M.find('eventRegistrations',id)));
  M.form('event-qr','organizer',(id,v)=>{
    const e=M.find('events',id),r=M.find('eventRegistrations',String(v.get('registration')));
    M.check(r.event===e.id&&v.get('code')===e.code,'Код или заявка не совпадают с мероприятием.');
    eventCheckIn(r);
  });
  M.task('event-issue','organizer',id=>{
    const r=M.find('eventRegistrations',id);M.check(r.attended&&!r.cert,'Сначала отметьте фактическое присутствие.');
    r.cert='EV-CERT-'+r.id;M.notify([r.owner],'Выдан сертификат мероприятия',r.cert);
  });
  M.task('event-print',null,id=>{
    const r=M.find('eventRegistrations',id);M.check(r.cert&&(r.owner===owner()||M.allow('organizer')),'Документ закрыт.');
    window.print();
  });

  function admin() {
    return head('Управление FIVEROX','Демонстрационная операционная панель.',link('Бизнес-процессы','mvp-processes','secondary'))+
      block(
        card('Партнёры и продажи',pack(link('Партнёрская воронка','mvp-partner','primary'),link('Товарные заявки','mvp-orders','secondary'),
          link('Дропшиппинг и сверка','mvp-drop','secondary'),link('Обмен с 1С','mvp-1c','secondary'))),
        card('Запись, исполнители и работа АСЦ',pack(link('Записи и горячие лиды','client-bookings','primary'),
          link('Модерация и импорт исполнителей','mvp-moderation','secondary'),link('Мини CRM центров','mvp-crm','secondary'))),
        card('Гарантии и допсервис',pack(link('Реестр гарантий','mvp-warranty','primary'),link('Назначение дополнительного сервиса','mvp-service','secondary'))),
        card('Обучение и мероприятия',pack(link('Доступ, проверка и публикация курсов','mvp-teacher','primary'),
          link('Мероприятия и присутствие','mvp-eventdesk','secondary'))),
        card('Бонусы и бюджеты',pack(link('Журнал начислений','mvp-balances','secondary'),link('Рефералы','mvp-referrals','secondary'),
          link('Заявки на выплату','mvp-payouts','secondary'),link('MDF и ретробонус','mvp-funds','secondary'))),
        card('Уведомления, время и проверка прав',pack(link('Уведомления','mvp-notices','secondary'),
          link('Демо часы, копия и журнал','mvp-ops','primary'),link('Роли','roles','secondary'),link('Режимы устройств','mvp-channels','secondary'))));
  }
  M.onInstall(()=>{
    add('mvp-course','MVP50','Карточка курса','Обучающийся',null,coursePage);
    add('mvp-teacher','MVP51','Школа: управление и проверка','Администратор','teacher',gradeDesk);
    add('mvp-practice','MVP52','Практика и онлайн-занятия','Обучающийся','learner',practicePage);
    add('mvp-certificate-check','MVP53','Публичная проверка учебного сертификата','Публичный портал',null,publicCertificate);
    add('mvp-events','MVP54','Мероприятия','Публичный портал',null,eventPage);
    add('mvp-eventdesk','MVP55','Кабинет организатора','Администратор','organizer',eventDesk);
    add('mvp-event-certificate','MVP56','Сертификат мероприятия','Кабинеты','learner',eventCertificate);
    const learners='learner';
    const oldLearn=routes.learn.render,oldLesson=routes['learn-lesson'].render,oldCertificate=routes['learn-certificate'].render;
    override('learn-programs',null,publicCourses);
    override('learn',learners,()=>dashboard(oldLearn));
    override('learn-lesson',learners,()=>lesson(oldLesson));
    override('learn-certificates',learners,certificateList);
    override('learn-certificate',learners,()=>certificatePage(oldCertificate));
    override('admin','staff',admin);
    const roles={dealer:'sales',asc:'ppf',admin:'sales',client:'sales'};
    for(const [role,track] of Object.entries(roles)){
      override(role+'-learning',learners,()=>head('FIVEROX School', 'Курсы по вашему направлению.')+
        pack(link('Начать с рекомендованного курса',courseRoute(track),'primary'),link('Все программы','learn-programs','secondary'))+publicCourses());
    }
    for(const shell of ['client','dealer','asc','learner'])menus[shell].push(['Мероприятия','mvp-events']);
    menus.admin.push(['Управление школой','mvp-teacher'],['Мероприятия','mvp-eventdesk']);
    M.describe('Школа, доступ и учебный сертификат','client','learn-programs','AT-23–25 · AT-29–30',[
      'Откройте бесплатный этап и подайте заявку на платный курс.',
      'Сотрудник фиксирует внешнюю оплату, преподаватель проверяет назначенное задание.',
      'Пройдите этапы, получите бонусы и проверьте сертификат по номеру и QR.',
    ]);
    M.describe('Мероприятие, практика и присутствие','client','mvp-events','FR-LMS-02 · FR-EVT-01–02',[
      'Подайте заявку на мероприятие или практику.',
      'Организатор подтверждает участие, затем отдельно отмечает присутствие.',
      'Откройте материалы и сертификат.',
    ]);
  });
})();

MVP.install();

