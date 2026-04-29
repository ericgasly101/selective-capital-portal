(() => {
  // Rep slug is the last path segment: /upload/<rep>
  const repSlug = location.pathname.split('/').filter(Boolean).pop();

  const repBanner = document.getElementById('repBanner');
  const repName   = document.getElementById('repName');
  const banner    = document.getElementById('banner');
  const submitBtn = document.getElementById('submitBtn');
  const submitNote= document.getElementById('submitNote');
  const form      = document.getElementById('uploadForm');

  // Track files per category (so user can see the list & remove individual files)
  const buckets = { bankStatements: [], driversLicense: [], voidedCheck: [], other: [] };

  fetch('/api/rep/' + encodeURIComponent(repSlug))
    .then(r => r.json())
    .then(j => {
      if (j.ok) {
        repName.textContent = 'Documents will go to: ' + j.name;
        repBanner.style.display = 'inline-flex';
      }
    }).catch(() => {});

  // Wire up each dropzone
  document.querySelectorAll('.dropzone').forEach(zone => {
    const field = zone.dataset.field;
    const input = zone.querySelector('input[type=file]');
    const list  = document.querySelector(`[data-list="${field}"]`);

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag');
      addFiles(field, e.dataTransfer.files, list, input);
    });
    input.addEventListener('change', () => addFiles(field, input.files, list, input));
  });

  function addFiles(field, fileList, listEl, inputEl) {
    for (const f of fileList) {
      // Replace single-file fields rather than append
      if (field === 'driversLicense' || field === 'voidedCheck') {
        buckets[field] = [f];
      } else {
        buckets[field].push(f);
      }
    }
    inputEl.value = ''; // allow re-adding same name
    renderList(field, listEl);
  }

  function renderList(field, listEl) {
    listEl.innerHTML = '';
    buckets[field].forEach((f, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${escapeHtml(f.name)}</span>
        <span style="color:#6b7280;font-size:12px">${humanSize(f.size)}</span>
        <span class="x" data-idx="${idx}" data-field="${field}" title="Remove">×</span>`;
      listEl.appendChild(li);
    });
    listEl.querySelectorAll('.x').forEach(x => x.onclick = () => {
      buckets[field].splice(parseInt(x.dataset.idx, 10), 1);
      renderList(field, listEl);
    });
  }

  function humanSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/1024/1024).toFixed(2) + ' MB';
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function showBanner(kind, msg) {
    banner.className = 'banner show ' + kind;
    banner.textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    banner.className = 'banner';
    submitNote.textContent = '';

    if (!buckets.bankStatements.length) return showBanner('error', 'Please attach at least one bank statement.');
            if (!document.getElementById('consent').checked) return showBanner('error', 'Please check the consent box.');

    const fd = new FormData(form);
    // Remove the empty native file inputs (we send from buckets instead)
    fd.delete('bankStatements'); fd.delete('driversLicense'); fd.delete('voidedCheck'); fd.delete('other');

    for (const [field, files] of Object.entries(buckets)) {
      for (const f of files) fd.append(field, f, f.name);
    }

    submitBtn.disabled = true;
    submitNote.textContent = 'Uploading…';

    try {
      const res = await fetch('/api/upload/' + encodeURIComponent(repSlug), { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || ('Upload failed (HTTP ' + res.status + ')'));
      showBanner('success', '✓ Documents sent to your rep. They will reach out shortly.');
      form.reset();
      Object.keys(buckets).forEach(k => { buckets[k] = []; renderList(k, document.querySelector(`[data-list="${k}"]`)); });
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      submitBtn.disabled = false;
      submitNote.textContent = '';
    }
  });
})();
