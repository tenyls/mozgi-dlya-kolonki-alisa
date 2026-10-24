// Операция на главной + режим Mini App внутри Telegram + офлайн (PWA)
(function () {
  var theatre = document.querySelector('.theatre');
  if (theatre) requestAnimationFrame(function () { setTimeout(function () { theatre.classList.add('ready'); }, 250); });

  var tg = window.Telegram && window.Telegram.WebApp;
  function initTg() {
    tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return;
    document.documentElement.classList.add('in-tg');
    tg.ready(); tg.expand();
    // Внутри Telegram ссылки на t.me открываем самим Телеграмом
    document.querySelectorAll('a[href^="https://t.me/"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); tg.openTelegramLink(a.href); });
    });
  }
  if (document.readyState === 'complete') initTg(); else window.addEventListener('load', initTg);

  // Кнопки «Скопировать»
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    var label = b.textContent;
    b.addEventListener('click', function () {
      var done = function () { b.textContent = 'Скопировано ✓'; setTimeout(function () { b.textContent = label; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, function () { prompt('Скопируйте:', b.dataset.copy); });
      else prompt('Скопируйте:', b.dataset.copy);
    });
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
