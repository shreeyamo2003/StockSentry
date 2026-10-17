(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const modal = $('#modal');
  const dialog = $('.modal-dialog');
  const form = $('#stock-form');
  const done = $('#done');
  let lastFocus = null;

  const inr = (n) =>
    '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  /* ---------- open / close ---------- */
  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lock');
    setTimeout(() => $('#company').focus(), 250);
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lock');
    if (lastFocus) lastFocus.focus();
    setTimeout(resetView, 400);
  }
  function resetView() {
    dialog.classList.remove('is-done');
    done.hidden = true;
  }
  document.querySelectorAll('[data-open-modal]').forEach((b) => b.addEventListener('click', openModal));
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close-modal]')) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') {                       // keep focus inside the popup
      const f = [...dialog.querySelectorAll('button, input, a[href]')].filter((el) => el.offsetParent !== null && !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- helpers ---------- */
  const val = (id) => $(id).value.trim();
  const num = (id) => parseFloat($(id).value);

  /* ---------- live summary ---------- */
  function updateLive() {
    const sym = val('#symbol').toUpperCase();
    const ex = form.exchange.value;
    $('#lv-ticker').textContent = sym ? sym + (ex === 'NSE' ? '.NS' : '.BO') : '-';

    const q = num('#quantity'), p = num('#buyPrice');
    const lo = num('#targetMin'), hi = num('#targetMax');
    const okQP = q > 0 && p > 0;

    $('#lv-invested').textContent = okQP ? inr(q * p) : '₹0';
    $('#lv-low').textContent = okQP && lo > 0 ? `${inr(q * lo)} (${pct(lo, p)})` : '-';
    $('#lv-high').textContent = okQP && hi > 0 ? `${inr(q * hi)} (${pct(hi, p)})` : '-';

    // target band visual
    const scale = $('#scale');
    if (p > 0 && lo > 0 && hi > 0 && hi >= lo) {
      const min = Math.min(p, lo) * 0.9, max = Math.max(p, hi) * 1.1;
      const x = (v) => ((v - min) / (max - min)) * 100;
      $('#scale-band').style.left = x(lo) + '%';
      $('#scale-band').style.width = (x(hi) - x(lo)) + '%';
      const buy = $('#scale-buy');
      buy.style.left = x(p) + '%';
      buy.classList.toggle('flip', x(p) > 70);
      scale.classList.add('has-data');
    } else {
      $('#scale-band').style.width = '0';
      $('#scale-buy').style.left = '-10px';
      scale.classList.remove('has-data');
    }
  }
  function pct(target, buy) {
    const r = ((target - buy) / buy) * 100;
    return (r >= 0 ? '+' : '') + r.toFixed(1) + '%';
  }
  form.addEventListener('input', updateLive);
  form.addEventListener('change', updateLive);

  $('#nearPct').addEventListener('input', (e) => { $('#nearOut').textContent = e.target.value + '%'; });

  $('#emailOn').addEventListener('change', (e) => {
    $('#emailWrap').hidden = !e.target.checked;
    if (e.target.checked) $('#email').focus();
  });

  // symbol: uppercase as you type
  $('#symbol').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/\s+/g, '');
  });

  /* ---------- validation ---------- */
  function setErr(id, msg) {
    const field = $(id).closest('.field');
    const out = field.querySelector('.err');
    field.classList.toggle('invalid', !!msg);
    if (out) out.textContent = msg || '';
    return !msg;
  }

  function validate() {
    const ex = form.exchange.value;
    const sym = val('#symbol');
    const q = num('#quantity'), p = num('#buyPrice');
    const lo = num('#targetMin'), hi = num('#targetMax');
    const results = [];

    results.push(setErr('#company', val('#company') ? '' : 'Enter the company name.'));

    let symMsg = '';
    if (!sym) symMsg = 'Enter the stock symbol.';
    else if (ex === 'BSE' ? !/^[A-Z0-9]{3,10}$/.test(sym) : !/^[A-Z0-9&-]{1,20}$/.test(sym)) symMsg = 'Use letters and numbers only, with no spaces.';
    results.push(setErr('#symbol', symMsg));

    results.push(setErr('#quantity', Number.isInteger(q) && q > 0 ? '' : 'Enter a whole number greater than 0.'));
    results.push(setErr('#buyPrice', p > 0 ? '' : 'Enter the price you paid, above 0.'));
    results.push(setErr('#targetMin', lo > 0 ? '' : 'Enter your lowest target price.'));

    let hiMsg = '';
    if (!(hi > 0)) hiMsg = 'Enter your highest target price.';
    else if (lo > 0 && hi < lo) hiMsg = 'The highest target must be at least the lowest target.';
    results.push(setErr('#targetMax', hiMsg));

    let mailMsg = '';
    if ($('#emailOn').checked && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('#email'))) mailMsg = 'Enter a valid email address.';
    results.push(setErr('#email', mailMsg));

    return results.every(Boolean);
  }

  
  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validate()) {
      const bad = form.querySelector('.invalid input');
      if (bad) bad.focus();
      return;
    }

    const payload = {
      company_name: val('#company'),
      symbol: val('#symbol').toUpperCase(),
      exchange: form.exchange.value,
      quantity: num('#quantity'),
      buy_price: num('#buyPrice'),
      buy_date: val('#buyDate') || null,
      target_min: num('#targetMin'),
      target_max: num('#targetMax'),
      near_pct: Number($('#nearPct').value),
      email_alerts: $('#emailOn').checked,
      alert_email: $('#emailOn').checked ? val('#email') : null,
    };

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch('/api/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not save the stock.');
      }

      $('#done-title').textContent = `${payload.company_name} added`;
      $('#done-text').textContent =
        `${payload.quantity} shares of ${payload.symbol} on ${payload.exchange}, bought at ${inr(payload.buy_price)}, ` +
        `total invested ${inr(payload.quantity * payload.buy_price)}. ` +
        `Your target range is ${inr(payload.target_min)} to ${inr(payload.target_max)}.`;

      dialog.classList.add('is-done');
      done.hidden = false;

      console.log('Stock saved with ID:', result.id);
    } catch (error) {
      console.error('StockSentry save error:', error);
      alert(`Could not save stock: ${error.message}`);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });


  $('#add-another').addEventListener('click', () => {
    form.reset();
    $('#nearOut').textContent = '5%';
    $('#emailWrap').hidden = true;
    form.querySelectorAll('.invalid').forEach((f) => f.classList.remove('invalid'));
    form.querySelectorAll('.err').forEach((f) => (f.textContent = ''));
    updateLive();
    resetView();
    $('#company').focus();
  });

  updateLive();
})();



document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash === "#add-holding") {
    const openButton = document.querySelector("[data-open-modal]");

    if (openButton) {
      openButton.click();
    }
  }
});
