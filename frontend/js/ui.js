/* BUhostels — small UI helpers: toasts, dialogs, busy buttons. */
(function (w) {
  'use strict';
  const BU = (w.BU = w.BU || {});
  const esc = BU.esc;

  function toast(message, kind) {
    let root = document.getElementById('toasts');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toasts';
      root.className = 'toasts';
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
      document.body.appendChild(root);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = message;
    root.appendChild(t);
    setTimeout(
      () => {
        t.classList.add('out');
        setTimeout(() => t.remove(), 260);
      },
      kind === 'err' ? 5500 : 3200
    );
  }

  function dialog(html, cls) {
    const d = document.createElement('dialog');
    d.className = 'dlg ' + (cls || '');
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
    d.showModal();
    return d;
  }

  function confirmBox(o) {
    return new Promise((resolve) => {
      const d = dialog(
        '<form method="dialog" class="dlg-body"><h3>' + esc(o.title) + '</h3>' +
          (o.text ? '<p class="muted">' + esc(o.text) + '</p>' : '') +
          '<div class="dlg-actions"><button class="btn btn-ghost" value="no">Cancel</button>' +
          '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-solid') + '" value="yes">' + esc(o.ok || 'Confirm') + '</button></div></form>'
      );
      d.addEventListener('close', () => resolve(d.returnValue === 'yes'));
    });
  }

  // Resolves to an object of field values, or null if cancelled.
  function formDialog(o) {
    return new Promise((resolve) => {
      const d = dialog(
        '<form method="dialog" class="dlg-body"><h3>' + esc(o.title) + '</h3>' +
          (o.note ? '<p class="muted">' + esc(o.note) + '</p>' : '') +
          o.body +
          '<div class="dlg-actions"><button class="btn btn-ghost" value="no" formnovalidate>Cancel</button>' +
          '<button class="btn btn-solid" value="yes">' + esc(o.ok || 'Save') + '</button></div></form>'
      );
      const form = d.querySelector('form');
      d.addEventListener('close', () => resolve(d.returnValue === 'yes' ? Object.fromEntries(new FormData(form)) : null));
    });
  }

  // Disables a button and swaps its label while a request runs.
  async function busy(btn, label, fn) {
    if (!btn) return fn();
    const old = btn.innerHTML;
    btn.disabled = true;
    if (label) btn.textContent = label;
    try {
      return await fn();
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  Object.assign(BU, { toast, dialog, confirmBox, formDialog, busy });
})(window);
