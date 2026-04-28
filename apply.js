(() => {
  const repSlug   = location.pathname.split('/').filter(Boolean).pop();
  const repBanner = document.getElementById('repBanner');
  const repName   = document.getElementById('repName');
  const banner    = document.getElementById('banner');
  const submitBtn = document.getElementById('submitBtn');
  const submitNote= document.getElementById('submitNote');
  const form      = document.getElementById('appForm');

  fetch('/api/rep/' + encodeURIComponent(repSlug))
    .then(r => r.json())
    .then(j => {
      if (j.ok) {
        repName.textContent = 'Application will be sent to: ' + j.name;
        repBanner.style.display = 'inline-flex';
      }
    }).catch(() => {});

  function showBanner(kind, msg) {
    banner.className = 'banner show ' + kind;
    banner.textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    banner.className = 'banner';

    if (!document.getElementById('consent').checked) {
      return showBanner('error', 'Please check the consent box.');
    }

    const data = {};
    for (const [k, v] of new FormData(form).entries()) {
      data[k] = typeof v === 'string' ? v.trim() : v;
    }

    submitBtn.disabled = true;
    submitNote.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/apply/' + encodeURIComponent(repSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || ('Submission failed (HTTP ' + res.status + ')'));
      showBanner('success', '✓ Application sent. Your rep will be in touch shortly.');
      form.reset();
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      submitBtn.disabled = false;
      submitNote.textContent = '';
    }
  });
})();
