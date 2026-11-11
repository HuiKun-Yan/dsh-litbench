(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(2500);
  const btn = document.getElementById('btnSettings');
  if (!btn) return { error: 'no settings button' };
  btn.click();
  await sleep(500);
  const box = document.querySelector('#modalRoot .modal-body') || document.querySelector('#modalRoot');
  const fields = [...box.querySelectorAll('.field')].map((f) => ({
    label: (f.querySelector('.label') || {}).textContent || '',
    input: f.querySelector('input,select') ? (f.querySelector('input,select').value || '') : '',
  }));
  const kvs = [...box.querySelectorAll('.kv')].map((n) => n.textContent).filter(Boolean).slice(0, 6);
  const btns = [...box.querySelectorAll('button')].map((b) => b.textContent);
  const migChecked = (box.querySelector('input[type=checkbox]') || {}).checked;
  return { fields, kvs, btns, migChecked, html: box.innerHTML.length };
})()
