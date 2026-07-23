// Theme controller. The inline blocker in index.html <head> applies the initial
// theme before first paint (no flash); this file keeps it in sync and exposes
// the manual toggle.
(function () {
  var STORAGE_KEY = 'mp-theme';
  var mql = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function resolved() {
    var choice = saved();
    if (choice === 'dark' || choice === 'light') return choice;
    return mql.matches ? 'dark' : 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Keep in sync when the OS preference changes and the user has no explicit choice.
  mql.addEventListener('change', function () {
    if (!saved()) apply(mql.matches ? 'dark' : 'light');
  });

  window.toggleTheme = function () {
    var next = resolved() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore storage failures (private mode) */
    }
    apply(next);
  };

  // Reconcile in case the attribute was not set yet (e.g. blocker skipped).
  apply(resolved());
})();
