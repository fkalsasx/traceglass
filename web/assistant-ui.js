const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = selector => document.querySelector(selector);
const prompts = [
  ['01', 'Nereden başlamalıyım?', 'Öncelikli sorunları sırala', 'Önce neyi düzeltmeliyim?'],
  ['02', 'Neden bu kadar yavaş?', 'Bekleme sürelerini açıkla', 'Neden yavaş?'],
  ['03', 'Hatalar ne anlatıyor?', 'Durum kodlarını yorumla', 'Hataları açıkla'],
  ['04', 'Hangi dosyalar ağır?', 'Büyük aktarımları bul', 'Büyük dosyaları bul'],
];
const mark = '<span class="analyst-mark" aria-hidden="true"><i></i><i></i><i></i></span>';

export function createAssistant({ request, onInspect, onView, onFilter, isLoading }) {
  let analysis = null, context = {}, generation = 0, sending = false, turns = 0;
  const log = $('#chat-log'), input = $('#chat-input'), status = $('#chat-status');
  function welcome() {
    $('#chat-welcome').hidden = false;
    $('#chat-prompts').innerHTML = prompts.map(([n, title, detail, question]) => `<button class="prompt-card" data-prompt="${esc(question)}"><span>${n}</span><strong>${title}</strong><small>${detail}</small><b aria-hidden="true">↗</b></button>`).join('');
    $('#chat-prompts').querySelectorAll('button').forEach(button => { button.onclick = () => ask(button.dataset.prompt); });
  }
  function clear(focus = false) {
    generation++; context = {}; turns = 0; sending = false; log.replaceChildren();
    input.value = ''; input.style.height = ''; $('#chat-send').disabled = false; log.removeAttribute('aria-busy');
    status.textContent = 'Yanıtlar yalnızca açık kayıt ve seçili sayfaya dayanır.';
    welcome(); if (focus) input.focus();
  }
  function update(next) {
    analysis = next; clear();
    $('#assistant-capture').textContent = next.name;
    $('#assistant-scope').textContent = next.pageId === null ? 'Tüm sayfalar' : String(next.pageId);
    $('#assistant-requests').textContent = next.summary.count.toLocaleString('tr-TR');
    $('#assistant-failures').textContent = next.summary.failed.toLocaleString('tr-TR');
    $('#assistant-findings').textContent = next.findings.length;
  }
  function renderAnswer(answer, row) {
    row.innerHTML = `<div class="message-byline">${mark}<strong>Traceglass</strong><span>YEREL YORUMLAYICI</span></div><h3>${esc(answer.title)}</h3><p class="answer-lead">${esc(answer.lead)}</p>${answer.sections.map(s => `<section class="answer-section"><h4>${esc(s.title)}</h4><ul>${s.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>`).join('')}${answer.evidence.length ? `<div class="answer-evidence"><span class="answer-label">KAYITTAKİ KANITLAR</span>${answer.evidence.map((e, i) => `<button class="evidence-card" data-evidence="${e.entryId}"><span class="evidence-index">${String(i + 1).padStart(2, '0')}</span><span><strong>${esc(e.label)}</strong><small>${esc(e.detail)}</small></span><b aria-hidden="true">↗</b></button>`).join('')}</div>` : ''}${answer.note ? `<p class="answer-note">${esc(answer.note)}</p>` : ''}<div class="answer-actions">${answer.actions.map((a, i) => `<button class="button subtle small" data-action="${i}">${esc(a.label)} <span aria-hidden="true">↗</span></button>`).join('')}</div><div class="follow-ups">${answer.followUps.map(q => `<button data-followup="${esc(q)}">${esc(q)} <span aria-hidden="true">↗</span></button>`).join('')}</div>`;
    row.querySelectorAll('[data-evidence]').forEach(button => { button.onclick = () => onInspect(Number(button.dataset.evidence)); });
    row.querySelectorAll('[data-action]').forEach(button => { button.onclick = () => {
      const action = answer.actions[Number(button.dataset.action)];
      if (action.filter) onFilter(action.filter); else onView(action.view);
    }; });
    row.querySelectorAll('[data-followup]').forEach(button => { button.onclick = () => ask(button.dataset.followup); });
  }
  async function ask(question) {
    question = question.trim();
    if (sending || !question) return;
    if (isLoading() || !analysis) { status.textContent = 'Kayıt hazırlanıyor; yükleme bitince tekrar dene.'; return; }
    if (question.length > 2000) { status.textContent = 'Sorunu 2.000 karakter içinde yaz.'; return; }
    const ticket = generation;
    sending = true; $('#chat-send').disabled = true; $('#chat-welcome').hidden = true;
    input.value = ''; input.style.height = ''; log.setAttribute('aria-busy', 'true');
    status.textContent = 'Kayıttaki ölçümler inceleniyor…';
    const turn = document.createElement('div'); turn.className = 'chat-turn';
    const user = document.createElement('div'); user.className = 'message-user';
    const byline = document.createElement('span'); byline.textContent = 'SEN';
    const text = document.createElement('p'); text.textContent = question;
    user.append(byline, text); turn.append(user); log.append(turn);
    while (log.children.length > 12) log.firstElementChild.remove();
    try {
      const answer = await request('assistant', { question, context });
      if (ticket !== generation) return;
      context = answer.context;
      const row = document.createElement('article'); row.className = 'message-assistant';
      renderAnswer(answer, row); turn.append(row); turns++;
      status.textContent = turns > 12 ? 'Son 12 yanıt bellekte tutulur. Kayıt veya kapsam değişirse sohbet sıfırlanır.' : 'Kural tabanlı açıklama · Kanıt kartları istek ayrıntılarını açar.';
      if ($('#assistant-view').hidden === false) turn.scrollIntoView({ block: 'start', behavior: 'instant' });
    } catch (error) {
      if (ticket !== generation) return;
      const message = document.createElement('p'); message.className = 'chat-error'; message.textContent = error.message; turn.append(message);
      status.textContent = 'Yanıt oluşturulamadı. Yeniden deneyebilirsin.';
    } finally {
      if (ticket === generation) { sending = false; $('#chat-send').disabled = false; log.removeAttribute('aria-busy'); }
    }
  }
  $('#chat-form').onsubmit = event => { event.preventDefault(); ask(input.value); };
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); ask(input.value); }
  });
  $('#chat-clear').onclick = () => clear(true);
  return { update, ask };
}
