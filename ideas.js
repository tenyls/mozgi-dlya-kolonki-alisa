// Идеи: фильтр по категориям и «Включить на моей колонке» (нужен вход через Telegram на странице кабинета)
(function () {
  var API = 'https://pult-dlya-kolonki.tenylse.workers.dev';
  var token = null; try { token = localStorage.getItem('mozgi_token'); } catch (e) {}
  var status = document.getElementById('ideas-status');
  if (token) document.getElementById('ideas-hint').hidden = true;
  // В Telegram (Mini App) входим сами
  window.addEventListener('load', function () {
    var tg = window.Telegram && Telegram.WebApp;
    if (token || !tg || !tg.initData) return;
    fetch(API + '/site/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) })
      .then(function (r) { return r.json(); }).then(function (d) {
        if (d.ok) { token = d.token; try { localStorage.setItem('mozgi_token', token); } catch (e) {} document.getElementById('ideas-hint').hidden = true; }
      }).catch(function () {});
  });

  document.querySelectorAll('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.toggle('on', x === b); });
      var f = b.dataset.filter;
      document.querySelectorAll('.idea-group').forEach(function (g) { g.hidden = f !== 'all' && g.dataset.cat !== f; });
    });
  });

  document.querySelectorAll('[data-apply]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!token) { location.href = 'instrukciya.html'; return; }
      var label = b.textContent; b.disabled = true; b.textContent = 'Включаю…';
      fetch(API + '/site/settings', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ personaCustom: b.dataset.apply }),
      }).then(function (r) { return r.json().then(function (d) { d.status = r.status; return d; }); }).then(function (d) {
        b.disabled = false;
        if (d.status === 401 || d.status === 403) { location.href = 'instrukciya.html'; return; }
        b.textContent = d.ok ? 'Включено ✓' : label;
        status.textContent = d.ok ? 'Готово! Через минуту скажите колонке: «Алиса, запусти навык …» — и проверьте новый характер.' : 'Не получилось, попробуйте ещё раз.';
        setTimeout(function () { b.textContent = label; }, 2500);
      }).catch(function () { b.disabled = false; b.textContent = label; status.textContent = 'Сервер не ответил.'; });
    });
  });
})();
