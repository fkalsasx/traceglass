(() => {
  const key = 'traceglass.theme', choices = ['system', 'paper', 'forest', 'midnight'];
  let choice = 'system';
  try { const saved = localStorage.getItem(key); if (choices.includes(saved)) choice = saved; } catch { /* Storage may be disabled. */ }
  const system = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const theme = choice === 'system' ? system.matches ? 'forest' : 'paper' : choice;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = ({ paper: '#f4f5f0', forest: '#0f1916', midnight: '#121521' })[theme];
  };
  apply(); system.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.querySelector('#theme-picker'); picker.value = choice;
    picker.addEventListener('change', () => {
      choice = choices.includes(picker.value) ? picker.value : 'system';
      try { localStorage.setItem(key, choice); } catch { /* Selection still works in memory. */ }
      apply();
    });
  });
})();
