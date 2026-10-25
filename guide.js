// Доступ: 1) регистрация (логин+пароль) → 2) подключение Telegram → 3) подписка на канал → кабинет и инструкция.
// В Mini App внутри Telegram вход происходит сам.
// Сервер: Cloudflare Worker (тот же, что у бота). Текст и картинки шагов меняются в пульте «🧭 Мастер настройки».
(function () {
  var API = 'https://pult-dlya-kolonki.tenylse.workers.dev';
  var BOT = 'alisa_mozgi_dlya_kolonki_bot';
  var KEY = 'mozgi_token';
  var $ = function (id) { return document.getElementById(id); };
  var screens = ['gate-login', 'gate-link', 'gate-sub', 'gate-error', 'guide', 'gate-wait'];

  function show(id) {
    screens.forEach(function (s) { $(s).hidden = s !== id; });
    var logged = id === 'guide' || id === 'gate-sub' || id === 'gate-link';
    document.querySelector('.logout').hidden = !logged || inTg();
    if (!logged && id !== 'gate-wait') $('kabinet').hidden = true;
  }
  function getToken() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) {} }
  function inTg() { return !!(window.Telegram && Telegram.WebApp && Telegram.WebApp.initData); }

  function request(path, opts) {
    opts = opts || {};
    var ctrl = new AbortController(); var timer = setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch(API + path, {
      method: opts.body ? 'POST' : 'GET',
      headers: Object.assign({ 'content-type': 'application/json' }, getToken() ? { authorization: 'Bearer ' + getToken() } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    }).then(function (r) { clearTimeout(timer); return r.json().then(function (d) { d.status = r.status; return d; }); });
  }

  function mountWidget(boxId) {
    var box = $(boxId);
    if (box.childElementCount) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', BOT);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '20');
    // Режим «переход по ссылке»: надёжнее всплывающего окна (его ломают блокировщики и запрет сторонних cookie)
    s.setAttribute('data-auth-url', location.origin + location.pathname);
    s.setAttribute('data-request-access', 'write');
    box.appendChild(s);
  }
  function showLogin() { show('gate-login'); mountWidget('tg-login'); }
  function showLink(login, msg) {
    show('gate-link'); $('link-login').textContent = login || '';
    $('link-msg').textContent = msg || '';
    mountWidget('tg-link');
  }

  function showSubscribe(missing) {
    var ul = document.querySelector('.gate-channels');
    ul.innerHTML = '';
    (missing || []).forEach(function (ch) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'btn ghost'; a.href = ch.url; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'Подписаться на ' + ch.name;
      if (inTg()) a.addEventListener('click', function (e) { e.preventDefault(); Telegram.WebApp.openTelegramLink(ch.url); });
      li.appendChild(a); ul.appendChild(li);
    });
    show('gate-sub');
  }

  function afterAuth(d) {
    if (!d.ok) {
      if (d.status === 409) return loadAll(d.error); // этот Telegram уже привязан к другому логину
      setToken(null); return showLogin();
    }
    setToken(d.token);
    if (d.linked === false) return showLink(d.login);
    loadCabinet();
    return d.subscribed ? loadGuide() : showSubscribe(d.missing);
  }

  // С сохранённым пропуском: кабинет (или просьба подключить Telegram) + инструкция
  function loadAll(msg) {
    show('gate-wait');
    request('/site/me').then(function (d) {
      if (d.status === 401) { setToken(null); return showLogin(); }
      if (d.needLink) return showLink(d.login, msg);
      if (d.ok) renderCabinet(d);
      loadGuide();
    }).catch(function () { show('gate-error'); });
  }

  // ---------- Личный кабинет ----------
  var AI = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
  function fmtDate(t) { return new Date(t * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function loadCabinet() {
    request('/site/me').then(function (d) { if (d.ok) renderCabinet(d); }).catch(function () {});
  }

  function renderCabinet(d) {
    $('kabinet').hidden = false;
    document.querySelector('.cab-hello').textContent = 'Здравствуйте, ' + (d.name || 'друг') + '! С нами с ' + fmtDate(d.since) + '. Звание: ' + (d.rank || '') + '.';
    var st = $('cab-status'); st.innerHTML = '';
    if (d.skill) {
      st.appendChild(el('h3', null, '🧠 Мозги установлены'));
      var ul = el('ul', 'cab-facts');
      ul.appendChild(el('li', null, 'С ' + fmtDate(d.skill.installedAt)));
      ul.appendChild(el('li', null, 'Нейросети: ' + String(d.skill.providers || 'gemini, groq').split(',').map(function (x) { return AI[x.trim()] || x; }).join(', ')));
      if (d.skill.old) {
        var up = el('li', 'cab-update');
        up.appendChild(el('b', null, '⬆️ Доступны новые мозги ' + d.skill.latest + ' (у вас ' + d.skill.version + '). '));
        up.appendChild(document.createTextNode(d.skill.news.replace(/\n/g, ' · ') + '. Обновить: в боте «Алиса» → «⬆️ Обновить мозги» — минута, ключи вводить не нужно.'));
        ul.appendChild(up);
      } else ul.appendChild(el('li', null, 'Версия мозгов: ' + d.skill.version + ' — последняя ✅'));
      if (d.stats) ul.appendChild(el('li', null, 'С мозгами ' + d.stats.days + ' дн. · в памяти ' + d.stats.memories + ' · отправлено в Телеграм ' + d.stats.voice + ' · проверок ' + d.stats.checks));
      if (d.lastCheck) ul.appendChild(el('li', null, 'Последняя проверка: ' + (d.lastCheck.result === 'fail' ? '❌ не ответили' : '✅ ' + (AI[d.lastCheck.result] || 'работают')) + ', ' + fmtDate(d.lastCheck.ts)));
      st.appendChild(ul);
      var b = el('button', 'btn', 'Проверить мозги'); b.type = 'button';
      var res = el('p', 'cab-result'); res.setAttribute('role', 'status');
      b.addEventListener('click', function () {
        b.disabled = true; res.textContent = '🩺 Задаю вашей Алисе тестовый вопрос…';
        request('/site/check', { body: {} }).then(function (r) {
          b.disabled = false;
          res.textContent = r.ok ? '✅ Мозги работают! ' + (AI[r.provider] || '') + ' ответил за ' + (r.ms / 1000).toFixed(1) + ' с: «' + (r.answer || '').slice(0, 120) + '»'
            : '❌ Не ответили (' + (r.error || 'ошибка') + '). Откройте бота → «Алиса» → «Проверить мозги» — там подсказки.';
        }).catch(function () { b.disabled = false; res.textContent = 'Сервер не ответил, попробуйте ещё раз.'; });
      });
      st.appendChild(b); st.appendChild(res);
      renderSettings(d);
    } else {
      st.appendChild(el('h3', null, '🫥 Мозги ещё не установлены'));
      st.appendChild(el('p', null, 'Операция займёт около 10 минут. Бот проведёт по шагам, а здесь появятся настройки колонки.'));
      var a = el('a', 'btn', 'Начать в боте'); a.href = d.bot + '?start=site_cab'; a.target = '_blank'; a.rel = 'noopener';
      st.appendChild(a);
      $('cab-settings').hidden = true;
    }
    renderTricks(d.tricks || []);
    renderMemory(d.memories || []);
    if (d.login) { $('cab-pass-state').textContent = 'Ваш логин: ' + d.login + '. Можно сменить пароль ниже.'; $('cab-pass-form').login.value = d.login; }
    $('cab-refs').textContent = d.refs;
    var copy = $('cab-copy-ref');
    copy.onclick = function () {
      var done = function () { copy.textContent = 'Скопировано ✓'; setTimeout(function () { copy.textContent = 'Скопировать мою ссылку'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(d.refLink).then(done, function () { prompt('Ваша ссылка:', d.refLink); }); else prompt('Ваша ссылка:', d.refLink);
    };
  }

  function renderTricks(list) {
    var ul = $('cab-tricks'); ul.innerHTML = '';
    list.slice().sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0); }).forEach(function (t) {
      var li = el('li', 'trick' + (t.fav ? ' fav' : ''));
      var star = el('button', 'star', t.fav ? '★' : '☆'); star.type = 'button';
      star.setAttribute('aria-pressed', t.fav ? 'true' : 'false');
      star.setAttribute('aria-label', (t.fav ? 'Убрать из избранного: ' : 'В избранное: ') + t.title);
      star.addEventListener('click', function () {
        star.disabled = true;
        request('/site/fav', { body: { id: t.id, fav: !t.fav } }).then(function (r) {
          star.disabled = false; if (r.ok) { t.fav = !t.fav; renderTricks(list); }
        }).catch(function () { star.disabled = false; });
      });
      var body = el('div', 'trick-body');
      body.appendChild(el('b', null, t.title));
      if (t.phrase) body.appendChild(el('span', 'phrase', t.phrase.replace(/&laquo;|&raquo;/g, '')));
      li.appendChild(star); li.appendChild(body);
      if (t.url) { var a = el('a', 'trick-link', 'Подробнее'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); }
      ul.appendChild(li);
    });
  }

  function renderMemory(list) {
    var ul = $('cab-mem'); ul.innerHTML = '';
    if (!list.length) { ul.appendChild(el('li', 'gate-small', 'Пока ничего не запомнено.')); return; }
    list.forEach(function (m) {
      var li = el('li', 'mem');
      li.appendChild(el('span', null, m.text));
      li.appendChild(el('small', null, fmtDate(m.ts)));
      var del = el('button', 'star', '✕'); del.type = 'button'; del.setAttribute('aria-label', 'Забыть: ' + m.text);
      del.addEventListener('click', function () {
        del.disabled = true;
        request('/site/memdel', { body: { id: m.id } }).then(function () { renderMemory(list.filter(function (x) { return x !== m; })); }).catch(function () { del.disabled = false; });
      });
      li.appendChild(del); ul.appendChild(li);
    });
  }

  // Установка сайта как приложения (PWA)
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); installEvt = e;
    $('cab-install').hidden = false; $('cab-install-alt').hidden = true;
  });
  $('cab-install').addEventListener('click', function () { if (installEvt) { installEvt.prompt(); installEvt = null; $('cab-install').hidden = true; } });

  function chip(text, active, onPick) {
    var b = el('button', 'chip' + (active ? ' on' : ''), text); b.type = 'button';
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', active ? 'true' : 'false');
    b.addEventListener('click', onPick); return b;
  }

  function renderSettings(d) {
    $('cab-settings').hidden = false;
    var box = $('cab-personas'); box.innerHTML = '';
    var cur = d.skill.persona;
    if (cur === 'custom') box.appendChild(chip('✍️ Свой (меняется в боте)', true, function () {}));
    d.personas.forEach(function (p) {
      if (p.locked) {
        var c = chip(p.title + ' 🔒', false, function () { $('cab-saved').textContent = 'Откроется, когда по вашей ссылке придут ' + p.need + ' ' + (p.need === 1 ? 'друг' : 'друга') + ' — ссылка ниже, в «Пригласить друга».'; });
        c.classList.add('locked'); box.appendChild(c); return;
      }
      box.appendChild(chip(p.title, p.key === cur, function () { save({ persona: p.key }, function () { d.skill.persona = p.key; renderSettings(d); }); }));
    });
    var pr = $('cab-primary'); pr.innerHTML = '';
    ['gemini', 'groq'].forEach(function (k) {
      pr.appendChild(chip(AI[k] + (k === 'gemini' ? ' (умнее)' : ' (быстрее)'), d.skill.primary === k, function () { save({ primary: k }, function () { d.skill.primary = k; renderSettings(d); }); }));
    });
  }

  function save(patch, then) {
    $('cab-saved').textContent = 'Сохраняю…';
    request('/site/settings', { body: patch }).then(function (r) {
      $('cab-saved').textContent = r.ok ? '✅ Сохранено. Колонка подхватит в течение минуты.' : 'Не сохранилось, попробуйте ещё раз.';
      if (r.ok) then();
    }).catch(function () { $('cab-saved').textContent = 'Сервер не ответил.'; });
  }

  window.mozgiAuth = function (user) {
    show('gate-wait');
    request('/site/auth', { body: { user: user } }).then(afterAuth).catch(function () { show('gate-error'); });
  };

  function loadGuide() {
    show('gate-wait');
    return request('/site/guide').then(function (d) {
      if (d.ok) return renderGuide(d.steps);
      if (d.error === 'subscribe') return showSubscribe(d.missing);
      if (d.error === 'link') return loadAll();
      setToken(null); showLogin();
    }).catch(function () { show('gate-error'); });
  }

  function renderGuide(steps) {
    var toc = $('guide-toc'), box = $('guide-steps');
    toc.innerHTML = ''; box.innerHTML = '';
    steps.forEach(function (s) {
      var li = document.createElement('li');
      li.innerHTML = '<a href="#step-' + s.key + '"></a>';
      li.firstChild.textContent = s.title.replace(/^[^\wА-Яа-яЁё]+/, '');
      toc.appendChild(li);
      var art = document.createElement('article');
      art.className = 'step' + (s.image ? '' : ' no-image');
      art.id = 'step-' + s.key;
      var text = document.createElement('div');
      text.className = 'step-text';
      text.innerHTML = s.html; // HTML из пульта (только b/i/a/code из Телеграма)
      text.querySelectorAll('a').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
      if (s.key === 'gemini') {
        var help = document.createElement('p');
        help.className = 'warn';
        help.innerHTML = '🆘 Google не даёт создать ключ (permission denied, Unsupported country)? <a href="gemini-help.html">Что делать — инструкция</a>. Или просто пропустите Gemini в боте — мозги будут работать на Groq.';
        text.appendChild(help);
      }
      art.appendChild(text);
      if (s.image) {
        var fig = document.createElement('figure');
        fig.innerHTML = '<a target="_blank" rel="noopener"><img loading="lazy" alt=""></a><figcaption>Нажмите, чтобы открыть крупно</figcaption>';
        fig.querySelector('a').href = s.image;
        var img = fig.querySelector('img'); img.src = s.image; img.alt = 'Скриншот: ' + s.title;
        art.appendChild(fig);
      }
      box.appendChild(art);
    });
    show('guide');
  }

  $('recheck').addEventListener('click', function () {
    $('recheck-msg').textContent = 'Проверяем…';
    request('/site/guide').then(function (d) {
      if (d.ok) return renderGuide(d.steps);
      $('recheck-msg').textContent = d.error === 'subscribe' ? 'Пока не видим подписку. Подпишитесь и нажмите ещё раз через пару секунд.' : 'Войдите заново.';
      if (d.error !== 'subscribe') { setToken(null); showLogin(); }
    }).catch(function () { show('gate-error'); });
  });
  document.querySelectorAll('[data-tab]').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
      document.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; });
    });
  });
  $('reg-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target; $('reg-msg').textContent = 'Создаю аккаунт…';
    request('/site/register', { body: { login: f.login.value, password: f.password.value } }).then(function (d) {
      if (d.ok) { f.reset(); $('reg-msg').textContent = ''; return afterAuth(d); }
      $('reg-msg').textContent = d.error || 'Не получилось.';
    }).catch(function () { $('reg-msg').textContent = 'Сервер не ответил.'; });
  });
  $('pass-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target; $('pass-msg').textContent = 'Проверяем…';
    request('/site/login', { body: { login: f.login.value, password: f.password.value } }).then(function (d) {
      if (d.ok) { f.reset(); return afterAuth(d); }
      $('pass-msg').textContent = d.error === 'too_many' ? 'Слишком много попыток. Подождите 15 минут.' : 'Неверный логин или пароль.';
    }).catch(function () { $('pass-msg').textContent = 'Сервер не ответил.'; });
  });
  $('cab-pass-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target; $('cab-pass-msg').textContent = 'Сохраняю…';
    request('/site/password', { body: { login: f.login.value, password: f.password.value } }).then(function (d) {
      $('cab-pass-msg').textContent = d.ok ? '✅ Готово! Теперь можно входить по логину ' + d.login + '.' : (d.error || 'Не получилось.');
      if (d.ok) { if (d.token) setToken(d.token); f.password.value = ''; $('cab-pass-state').textContent = 'Ваш логин: ' + d.login + '.'; }
    }).catch(function () { $('cab-pass-msg').textContent = 'Сервер не ответил.'; });
  });
  $('guide-login-btn').addEventListener('click', function () { showLogin(); window.scrollTo(0, 0); });
  document.querySelector('.logout').addEventListener('click', function () { setToken(null); showLogin(); });

  // Старт: Mini App входит сам; на сайте — возврат от Telegram (?id=…&hash=…), сохранённый пропуск или кнопка
  var qs = new URLSearchParams(location.search);
  if (inTg()) {
    request('/site/auth', { body: { initData: Telegram.WebApp.initData } }).then(afterAuth).catch(function () { show('gate-error'); });
  } else if (qs.get('hash') && qs.get('id')) {
    var user = {};
    ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].forEach(function (k) { if (qs.get(k) != null) user[k] = qs.get(k); });
    history.replaceState(null, '', location.pathname + location.hash);
    window.mozgiAuth(user);
  } else if (getToken()) {
    loadAll();
  } else {
    // Инструкция может быть открыта всем (если так включено в пульте)
    request('/site/guide').then(function (d) { if (d.ok) { renderGuide(d.steps); $('guide-login').hidden = false; } else showLogin(); }).catch(showLogin);
  }
})();
