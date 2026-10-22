// ============================================================
// KOUZ HOUS — Tableau de bord
// ============================================================
(function () {
  const links = document.querySelectorAll('.dash-link');
  const sections = document.querySelectorAll('.dash-section');

  // ---- Navigation par sections (SPA) ----
  let teamLoaded = false;
  let historyLoaded = false;
  let productsLoaded = false;
  let currentCountry = null;
  function showSection(id) {
    sections.forEach((s) => s.classList.toggle('active', s.id === id));
    links.forEach((l) => l.classList.toggle('active', l.dataset.section === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'team' && !teamLoaded) {
      teamLoaded = true;
      loadTeam();
    }
    if (id === 'historique' && !historyLoaded) {
      historyLoaded = true;
      loadHistory(true);
    }
    if (id === 'produits' && !productsLoaded) {
      productsLoaded = true;
      loadProducts();
    }
  }

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(link.dataset.section);
      history.replaceState(null, '', '#' + link.dataset.section);
    });
  });

  const initial = (location.hash || '#accueil').replace('#', '');
  if (document.getElementById(initial)) showSection(initial);

  // ---- Avatar du profil (haut à droite) : ouvre la section Profil ----
  const userBtn = document.getElementById('dash-user-btn');
  if (userBtn) userBtn.addEventListener('click', () => showSection('profile'));

  // ---- Arrière-plan animé (fondu enchaîné doux) ----
  (function startBackground() {
    const slides = document.querySelectorAll('.dash-bg-slide');
    if (slides.length < 2) return;
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 7000);
  })();

  // ---- Déconnexion ----
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    window.location.href = '/login';
  });

  // ---- Helpers ----
  function formatMoney(n) {
    return Number(n || 0).toLocaleString('fr-FR');
  }

  function animateNumber(el, target) {
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatMoney(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = formatMoney(target);
    }
    requestAnimationFrame(tick);
  }

  async function loadJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function showToast(text, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'toast show ' + (type || 'success');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---- Chargement utilisateur + solde ----
  async function init() {
    let user;
    try {
      user = await loadJSON('/api/auth/me');
    } catch (e) {
      window.location.href = '/login';
      return;
    }

    const c = KOUZ.countryByName(user.country);
    const flag = c ? c.flag : '🌍';
    currentCountry = user.country;

    document.getElementById('nav-user').textContent = flag + ' ' + user.phone;
    document.getElementById('user-name').textContent = user.phone;
    document.getElementById('welcome-name').textContent = user.phone;
    document.getElementById('welcome-flag').textContent = flag;
    document.getElementById('welcome-loc').textContent = user.country;
    document.getElementById('profile-country').textContent = flag + ' ' + user.country;
    document.getElementById('profile-phone').textContent = user.phone;

    let wallet = { depot: 0, revenu: 0 };
    try { wallet = await loadJSON('/api/wallet'); } catch (e) {}
    animateNumber(document.getElementById('depot-balance'), wallet.depot);
    animateNumber(document.getElementById('revenu-balance'), wallet.revenu);

    // Badge de notifications (non lues)
    try {
      const notifData = await loadJSON('/api/notifications?limit=1');
      updateNotifBadge(notifData.unread);
    } catch (e) {}
  }

  // ---- Bannière défilante (dépôts / retraits) ----
  function buildTicker() {
    const initials = ['A', 'K', 'M', 'F', 'S', 'D', 'T', 'E', 'J', 'B', 'C', 'L'];
    const amounts = [1000, 2500, 5000, 7500, 10000, 20000, 50000, 100000];
    const items = [];
    for (let i = 0; i < 14; i++) {
      const type = Math.random() > 0.45 ? 'depot' : 'retrait';
      const amount = amounts[Math.floor(Math.random() * amounts.length)];
      const name = initials[Math.floor(Math.random() * initials.length)];
      const time = Math.floor(Math.random() * 55) + 1;
      items.push({ type, amount, name, time });
    }
    const html = items
      .map((m) => {
        const label = m.type === 'depot' ? 'Dépôt' : 'Retrait';
        return (
          '<div class="ticker-item">' +
          '<span class="t-type ' + m.type + '">' + label + '</span>' +
          '<span class="t-who">' + m.name + '****</span>' +
          '<span class="t-amount">' + formatMoney(m.amount) + ' FCFA</span>' +
          '<span class="t-time">il y a ' + m.time + ' min</span>' +
          '</div>'
        );
      })
      .join('');
    document.getElementById('ticker-track').innerHTML = html + html;
  }

  // ---- Roue de la chance ----
  const PRIZE_AMOUNTS = [25, 30, 40, 50, 60, 75, 80, 100];
  const PRIZES = PRIZE_AMOUNTS.map((a) => '+' + a);
  const COLORS = ['#10b981', '#0d7a54', '#f6b93b', '#1f7a8c', '#f43f5e', '#7c3aed', '#0ea5e9', '#e11d48'];
  const MOBILE = window.matchMedia('(max-width: 600px)').matches;
  const SIZE = MOBILE ? 120 : 150;
  const LABEL_FONT = MOBILE ? 8 : 10;
  const LABEL_POS = SIZE / 2 - 16;
  const HUB_R = MOBILE ? 14 : 18;

  const canvas = document.getElementById('wheel-canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const spinBtn = document.getElementById('spin-btn');
  const resultEl = document.getElementById('wheel-result');
  let rotation = 0;
  let spinning = false;

  function drawWheel(angle) {
    const n = PRIZES.length;
    const seg = (2 * Math.PI) / n;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const r = SIZE / 2 - 4;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    for (let i = 0; i < n; i++) {
      const start = i * seg;
      const end = start + seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + seg / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + LABEL_FONT + 'px Poppins, sans-serif';
      ctx.fillText(PRIZES[i], LABEL_POS, LABEL_FONT * 0.4);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, HUB_R, 0, 2 * Math.PI);
    ctx.fillStyle = '#06231b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  async function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    resultEl.textContent = 'Tirage en cours…';

    let data;
    try {
      const res = await fetch('/api/wheel/spin', { method: 'POST' });
      data = await res.json();
      if (!res.ok) {
        resultEl.textContent = data.error || 'Impossible de jouer.';
        spinning = false;
        return;
      }
    } catch (e) {
      resultEl.textContent = 'Erreur réseau. Réessayez.';
      spinning = false;
      spinBtn.disabled = false;
      return;
    }

    const amount = data.amount;
    const idx = PRIZE_AMOUNTS.indexOf(amount);
    const seg = (2 * Math.PI) / PRIZES.length;
    const pointer = -Math.PI / 2;
    const norm = (((pointer - (idx * seg + seg / 2)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const startMod = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let delta = norm - startMod;
    if (delta < 0) delta += 2 * Math.PI;
    const spins = 5 + Math.random() * 4;
    const total = delta + spins * 2 * Math.PI;
    const duration = 4200;
    const start = performance.now();
    const startRot = rotation;

    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      rotation = startRot + total * eased;
      drawWheel(rotation);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        resultEl.textContent = '🎉 Vous avez gagné ' + formatMoney(amount) + ' FCFA !';
        if (data.revenu != null) animateNumber(document.getElementById('revenu-balance'), data.revenu);
        spinning = false;
      }
    }
    requestAnimationFrame(step);
  }

  async function loadWheelStatus() {
    try {
      const data = await loadJSON('/api/wheel');
      if (data.alreadySpun) {
        spinBtn.disabled = true;
        resultEl.textContent = '🎁 Déjà joué aujourd\u2019hui. Revenez demain !';
      }
    } catch (e) {}
  }

  drawWheel(0);
  spinBtn.addEventListener('click', spin);
  loadWheelStatus();

  // ---- Popup d'informations (affiché à chaque visite) ----
  (function initInfoModal() {
    const modal = document.getElementById('info-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('info-modal-close');
    const ctaBtn = document.getElementById('info-modal-cta');
    const backdrop = document.getElementById('info-modal-backdrop');

    function openModal() {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (ctaBtn) ctaBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    // Apparition automatique à l'arrivée sur le dashboard.
    openModal();
  })();

  // ---- Page Team ----
  let teamMembers = [];
  let teamFilter = 'all';
  let teamVisible = 8;

  function renderTeamLevels(levels) {
    const grid = document.getElementById('team-level-grid');
    if (!grid) return;
    grid.innerHTML = (levels || [])
      .map(
        (lv) =>
          '<div class="team-level">' +
          '<span class="team-level-badge">Niveau ' + lv.level + '</span>' +
          '<b>' + lv.rate + ' %</b>' +
          '<p>' + (lv.label || '') + '</p>' +
          '</div>'
      )
      .join('');
  }

  function renderTeamMembers() {
    const listEl = document.getElementById('team-members-list');
    if (!listEl) return;

    const q = (document.getElementById('team-search').value || '').trim().toLowerCase();
    const filtered = teamMembers.filter((m) => {
      const matchesLevel = teamFilter === 'all' || String(m.level) === teamFilter;
      const matchesSearch = !q || String(m.phone).toLowerCase().indexOf(q) !== -1;
      return matchesLevel && matchesSearch;
    });

    if (filtered.length === 0) {
      const msg = teamMembers.length === 0
        ? 'Aucun filleul pour le moment. Partagez votre lien pour développer votre équipe.'
        : 'Aucun membre ne correspond à votre recherche.';
      listEl.innerHTML = '<div class="team-state">' + msg + '</div>';
      return;
    }

    const visible = filtered.slice(0, teamVisible);
    let html = visible
      .map((m) => {
        const c = KOUZ.countryByName(m.country);
        const flag = c ? c.flag : '🌍';
        const initials = String(m.phone).slice(0, 2).toUpperCase();
        const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString('fr-FR') : '—';
        return (
          '<div class="team-member">' +
          '<div class="team-member-avatar">' + initials + '</div>' +
          '<div class="team-member-info">' +
          '<div class="team-member-name">' + flag + ' ' + m.phone + '</div>' +
          '<div class="team-member-meta">Inscrit le ' + date + '</div>' +
          '</div>' +
          '<span class="team-member-level">Niveau ' + m.level + '</span>' +
          '</div>'
        );
      })
      .join('');

    if (filtered.length > teamVisible) {
      html +=
        '<button type="button" class="team-load-more" id="team-load-more">Afficher plus (' +
        (filtered.length - teamVisible) +
        ' restants)</button>';
    }

    listEl.innerHTML = html;

    const moreBtn = document.getElementById('team-load-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        teamVisible += 8;
        renderTeamMembers();
      });
    }
  }

  async function loadTeam() {
    const listEl = document.getElementById('team-members-list');
    if (listEl) listEl.innerHTML = '<div class="team-state">Chargement de votre équipe…</div>';

    let data;
    try {
      data = await loadJSON('/api/team');
    } catch (e) {
      if (listEl) {
        listEl.innerHTML = '<div class="team-state error">Impossible de charger votre équipe. Réessayez plus tard.</div>';
      }
      return;
    }

    const fullLink = window.location.origin + data.referralLink;
    const linkEl = document.getElementById('team-link');
    if (linkEl) linkEl.textContent = fullLink;

    document.getElementById('stat-team').textContent = formatMoney(data.stats.teamMembers);
    document.getElementById('stat-direct').textContent = formatMoney(data.stats.directReferrals);
    document.getElementById('stat-active').textContent = formatMoney(data.stats.activeMembers);
    document.getElementById('stat-commissions').textContent =
      formatMoney(data.stats.commissions) + ' FCFA';

    renderTeamLevels(data.levels);
    teamMembers = data.members || [];
    renderTeamMembers();
  }

  function showCopyFeedback(msg) {
    const el = document.getElementById('team-copy-feedback');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  async function copyReferralLink() {
    const linkEl = document.getElementById('team-link');
    const link = linkEl ? linkEl.textContent : '';
    try {
      await navigator.clipboard.writeText(link);
      showCopyFeedback('Lien copié !');
    } catch (e) {
      const tmp = document.createElement('textarea');
      tmp.value = link;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.select();
      try {
        document.execCommand('copy');
        showCopyFeedback('Lien copié !');
      } catch (e2) {
        showCopyFeedback('Copie impossible automatiquement.');
      }
      document.body.removeChild(tmp);
    }
  }

  async function shareReferralLink() {
    const linkEl = document.getElementById('team-link');
    const link = linkEl ? linkEl.textContent : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'KOUZ HOUS',
          text: 'Rejoignez mon équipe KOUZ HOUS.',
          url: link,
        });
      } catch (e) {
        /* partage annulé */
      }
    } else {
      await copyReferralLink();
      showCopyFeedback('Partage non disponible. Lien copié.');
    }
  }

  const teamCopyBtn = document.getElementById('team-copy-btn');
  const teamShareBtn = document.getElementById('team-share-btn');
  const teamSearchEl = document.getElementById('team-search');
  if (teamCopyBtn) teamCopyBtn.addEventListener('click', copyReferralLink);
  if (teamShareBtn) teamShareBtn.addEventListener('click', shareReferralLink);
  if (teamSearchEl) {
    teamSearchEl.addEventListener('input', () => {
      teamVisible = 8;
      renderTeamMembers();
    });
  }

  const teamFilterWrap = document.getElementById('team-filter');
  if (teamFilterWrap) {
    teamFilterWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.team-chip');
      if (!chip) return;
      teamFilterWrap.querySelectorAll('.team-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      teamFilter = chip.dataset.level;
      teamVisible = 8;
      renderTeamMembers();
    });
  }

  // ---- Page Historique ----
  const HIST_ICONS = {
    deposit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    withdrawal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    revenue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    commission: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    purchase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  };
  const HIST_TYPE_LABELS = {
    deposit: 'Dépôt',
    withdrawal: 'Retrait',
    revenue: 'Revenu',
    commission: 'Commission',
    purchase: 'Achat',
  };
  const HIST_STATUS_LABELS = {
    success: 'Réussi',
    pending: 'En attente',
    failed: 'Échoué',
    refused: 'Refusé',
    cancelled: 'Annulé',
  };

  const histState = { type: 'all', status: 'all', period: 'all', q: '', limit: 20, offset: 0, total: 0, items: [] };

  async function loadHistory(reset) {
    if (reset) {
      histState.offset = 0;
      histState.items = [];
      const listEl = document.getElementById('hist-list');
      if (listEl) listEl.innerHTML = '<div class="hist-state">Chargement de vos opérations…</div>';
    }

    const params = new URLSearchParams();
    if (histState.type !== 'all') params.set('type', histState.type);
    if (histState.status !== 'all') params.set('status', histState.status);
    if (histState.period !== 'all') params.set('period', histState.period);
    if (histState.q) params.set('q', histState.q);
    params.set('limit', String(histState.limit));
    params.set('offset', String(histState.offset));

    let data;
    try {
      data = await loadJSON('/api/history?' + params.toString());
    } catch (e) {
      if (reset) {
        const listEl = document.getElementById('hist-list');
        if (listEl) {
          listEl.innerHTML =
            '<div class="hist-state error">Impossible de charger votre historique.</div>' +
            '<button type="button" class="hist-load-more" id="hist-retry">Réessayer</button>';
        }
      }
      return;
    }

    document.getElementById('hist-deposits').textContent = formatMoney(data.summary.totalDeposits) + ' FCFA';
    document.getElementById('hist-withdrawals').textContent = formatMoney(data.summary.totalWithdrawals) + ' FCFA';
    document.getElementById('hist-revenues').textContent = formatMoney(data.summary.totalRevenues) + ' FCFA';
    document.getElementById('hist-commissions').textContent = formatMoney(data.summary.totalCommissions) + ' FCFA';

    histState.total = data.total;
    if (reset) histState.items = data.transactions;
    else histState.items = histState.items.concat(data.transactions);

    renderHistory();
  }

  function renderHistory() {
    const listEl = document.getElementById('hist-list');
    if (!listEl) return;

    if (histState.items.length === 0) {
      listEl.innerHTML = '<div class="hist-state">Aucune opération pour le moment. Vos transactions apparaîtront ici.</div>';
      return;
    }

    listEl.innerHTML = histState.items
      .map((t) => {
        const label = HIST_TYPE_LABELS[t.type] || t.type;
        const statusLabel = HIST_STATUS_LABELS[t.status] || t.status;
        const positive = t.type === 'deposit' || t.type === 'revenue' || t.type === 'commission';
        const d = new Date(t.createdAt);
        const date = d.toLocaleDateString('fr-FR');
        const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const ref = t.reference || 'Sans référence';
        return (
          '<div class="hist-item" data-id="' + t.id + '">' +
          '<div class="hist-item-icon ' + t.type + '">' + (HIST_ICONS[t.type] || HIST_ICONS.deposit) + '</div>' +
          '<div class="hist-item-info">' +
          '<div class="hist-item-type">' + label + '</div>' +
          '<div class="hist-item-ref">' + ref + '</div>' +
          '</div>' +
          '<div class="hist-item-amount">' +
          '<b class="' + (positive ? 'positive' : 'negative') + '">' + (positive ? '+' : '−') + formatMoney(t.amount) + ' FCFA</b>' +
          '<div class="hist-item-date">' + date + ' · ' + time + '</div>' +
          '<span class="hist-badge ' + t.status + '">' + statusLabel + '</span>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    if (histState.total > histState.items.length) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hist-load-more';
      btn.textContent = 'Afficher plus (' + (histState.total - histState.items.length) + ' restants)';
      btn.addEventListener('click', () => {
        histState.offset += histState.limit;
        loadHistory(false);
      });
      listEl.appendChild(btn);
    }

    listEl.querySelectorAll('.hist-item').forEach((el) => {
      el.addEventListener('click', () => {
        const t = histState.items.find((x) => String(x.id) === el.dataset.id);
        openHistoryDetail(t);
      });
    });
  }

  function openHistoryDetail(t) {
    if (!t) return;
    const modal = document.getElementById('hist-detail');
    const body = document.getElementById('hist-detail-body');
    const label = HIST_TYPE_LABELS[t.type] || t.type;
    const statusLabel = HIST_STATUS_LABELS[t.status] || t.status;
    const date = new Date(t.createdAt).toLocaleString('fr-FR');
    const ref = t.reference || '—';
    body.innerHTML =
      '<div class="hist-detail-row"><span>Type</span><b>' + label + '</b></div>' +
      '<div class="hist-detail-row"><span>Montant</span><b>' + formatMoney(t.amount) + ' FCFA</b></div>' +
      '<div class="hist-detail-row"><span>Statut</span><b>' + statusLabel + '</b></div>' +
      '<div class="hist-detail-row"><span>Date</span><b>' + date + '</b></div>' +
      '<div class="hist-detail-row"><span>Référence</span><b>' + ref + '</b></div>' +
      (t.reference ? '<button type="button" class="hist-detail-copy" id="hist-detail-copy">Copier la référence</button>' : '');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    const copyBtn = document.getElementById('hist-detail-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(t.reference);
          copyBtn.textContent = 'Référence copiée !';
        } catch (e) {
          copyBtn.textContent = 'Copie impossible';
        }
      });
    }
  }

  function closeHistoryDetail() {
    const modal = document.getElementById('hist-detail');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  const histCloseBtn = document.getElementById('hist-detail-close');
  const histBackdrop = document.getElementById('hist-detail-backdrop');
  if (histCloseBtn) histCloseBtn.addEventListener('click', closeHistoryDetail);
  if (histBackdrop) histBackdrop.addEventListener('click', closeHistoryDetail);

  const histListEl = document.getElementById('hist-list');
  if (histListEl) {
    histListEl.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'hist-retry') loadHistory(true);
    });
  }

  const histChips = document.getElementById('hist-chips');
  if (histChips) {
    histChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.hist-chip');
      if (!chip) return;
      histChips.querySelectorAll('.hist-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      histState.type = chip.dataset.type;
      loadHistory(true);
    });
  }

  const histSearch = document.getElementById('hist-search');
  if (histSearch) {
    let debounce;
    histSearch.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        histState.q = histSearch.value.trim();
        loadHistory(true);
      }, 350);
    });
  }

  const histStatusEl = document.getElementById('hist-status');
  if (histStatusEl) {
    histStatusEl.addEventListener('change', () => {
      histState.status = histStatusEl.value;
      loadHistory(true);
    });
  }

  const histPeriodEl = document.getElementById('hist-period');
  if (histPeriodEl) {
    histPeriodEl.addEventListener('change', () => {
      histState.period = histPeriodEl.value;
      loadHistory(true);
    });
  }

  // ---- Notifications ----
  function updateNotifBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  async function loadNotifications() {
    const body = document.getElementById('notif-panel-body');
    if (body) body.innerHTML = '<div class="notif-state">Chargement…</div>';

    let data;
    try {
      data = await loadJSON('/api/notifications');
    } catch (e) {
      if (body) body.innerHTML = '<div class="notif-state">Impossible de charger vos notifications.</div>';
      return;
    }

    updateNotifBadge(data.unread);
    renderNotifications(data.notifications);
  }

  function renderNotifications(list) {
    const body = document.getElementById('notif-panel-body');
    if (!body) return;

    if (!list || list.length === 0) {
      body.innerHTML = '<div class="notif-state">Aucune notification pour le moment.</div>';
      return;
    }

    const icon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

    let html = list
      .map((n) => {
        const d = new Date(n.createdAt);
        const date = d.toLocaleDateString('fr-FR');
        const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return (
          '<div class="notif-item ' + (n.read ? '' : 'unread') + '">' +
          '<div class="notif-item-icon">' + icon + '</div>' +
          '<div class="notif-item-info">' +
          '<div class="notif-item-title">' + n.title + '</div>' +
          '<div class="notif-item-msg">' + (n.message || '') + '</div>' +
          '<div class="notif-item-time">' + date + ' · ' + time + '</div>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    if (list.some((n) => !n.read)) {
      html += '<button type="button" class="notif-mark-read" id="notif-mark-read">Tout marquer comme lu</button>';
    }

    body.innerHTML = html;

    const markBtn = document.getElementById('notif-mark-read');
    if (markBtn) {
      markBtn.addEventListener('click', async () => {
        try { await fetch('/api/notifications/read', { method: 'POST' }); } catch (e) {}
        loadNotifications();
      });
    }
  }

  function openNotifications() {
    const panel = document.getElementById('notif-panel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    loadNotifications();
  }

  function closeNotifications() {
    const panel = document.getElementById('notif-panel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  const notifBtn = document.getElementById('notif-btn');
  const notifClose = document.getElementById('notif-panel-close');
  const notifBackdrop = document.getElementById('notif-panel-backdrop');
  if (notifBtn) notifBtn.addEventListener('click', openNotifications);
  if (notifClose) notifClose.addEventListener('click', closeNotifications);
  if (notifBackdrop) notifBackdrop.addEventListener('click', closeNotifications);

  // Actualise le badge de notifications toutes les 30 secondes.
  setInterval(async () => {
    try {
      const d = await loadJSON('/api/notifications?limit=1');
      updateNotifBadge(d.unread);
    } catch (e) {}
  }, 30000);

  // ---- Page Produits ----
  async function loadProducts() {
    const grid = document.getElementById('prod-grid');
    if (grid) grid.innerHTML = '<div class="prod-state">Chargement des produits…</div>';

    let data;
    try {
      data = await loadJSON('/api/products');
    } catch (e) {
      if (grid) grid.innerHTML = '<div class="prod-state error">Impossible de charger les produits.</div>';
      return;
    }
    renderProducts(data.products);
  }

  function renderProducts(products) {
    const grid = document.getElementById('prod-grid');
    if (!grid) return;

    grid.innerHTML = (products || [])
      .map((p, i) => {
        return (
          '<article class="prod-card" style="animation-delay:' + (i * 60) + 'ms">' +
          '<div class="prod-card-img"><img src="' + p.image + '" alt="' + p.name + '" /></div>' +
          '<div class="prod-card-body">' +
          '<div class="prod-card-name">' + p.name + '</div>' +
          '<div class="prod-price">' + formatMoney(p.price) + ' <span>FCFA</span></div>' +
          '<div class="prod-metrics">' +
          '<div class="prod-metric revenue"><span>Revenu / jour</span><b>+' + formatMoney(p.dailyRevenue) + ' FCFA</b></div>' +
          '<div class="prod-metric revenue"><span>Revenu total</span><b>' + formatMoney(p.totalRevenue) + ' FCFA</b></div>' +
          '<div class="prod-metric"><span>Durée</span><b>' + p.durationDays + ' jours</b></div>' +
          '</div>' +
          '<button type="button" class="prod-btn" data-id="' + p.id + '">Acheter</button>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    grid.querySelectorAll('.prod-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = (products || []).find((x) => String(x.id) === btn.dataset.id);
        openBuyConfirm(p);
      });
    });
  }

  let buyProduct = null;

  function openBuyConfirm(p) {
    if (!p) return;
    buyProduct = p;
    document.getElementById('buy-modal-product').textContent = p.name;
    document.getElementById('buy-modal-price').textContent = formatMoney(p.price) + ' FCFA';
    const modal = document.getElementById('buy-modal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeBuyConfirm() {
    const modal = document.getElementById('buy-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    buyProduct = null;
  }

  async function confirmBuy() {
    if (!buyProduct) return;
    const btn = document.getElementById('buy-modal-confirm');
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const res = await fetch('/api/products/' + buyProduct.id + '/buy', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Achat impossible.', 'error');
        closeBuyConfirm();
        return;
      }
      animateNumber(document.getElementById('depot-balance'), data.depot);
      showToast(data.message || 'Achat confirmé.', 'success');
      closeBuyConfirm();
    } catch (e) {
      showToast('Erreur réseau. Réessayez.', 'error');
      closeBuyConfirm();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Oui';
    }
  }

  const buyCancel = document.getElementById('buy-modal-cancel');
  const buyConfirm = document.getElementById('buy-modal-confirm');
  const buyBackdrop = document.getElementById('buy-modal-backdrop');
  if (buyCancel) buyCancel.addEventListener('click', closeBuyConfirm);
  if (buyConfirm) buyConfirm.addEventListener('click', confirmBuy);
  if (buyBackdrop) buyBackdrop.addEventListener('click', closeBuyConfirm);

  const profileLogout = document.getElementById('profile-logout');
  if (profileLogout) {
    profileLogout.addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
      window.location.href = '/login';
    });
  }

  // ---- Page Retrait ----
  const withdrawState = {
    services: {},
    rules: { minAmount: 1600, feeRate: 0.1 },
    balance: 0,
    country: null,
    service: null,
    submitting: false,
  };

  async function openWithdraw() {
    const overlay = document.getElementById('withdraw-overlay');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    withdrawState.country = currentCountry || null;
    withdrawState.service = null;
    withdrawState.submitting = false;
    setWithdrawStatus('', '');
    document.getElementById('withdraw-amount').value = '';
    document.getElementById('withdraw-phone').value = '';

    try {
      const [wallet, cfg] = await Promise.all([
        loadJSON('/api/wallet'),
        loadJSON('/api/wallet/services'),
      ]);
      withdrawState.balance = wallet.revenu;
      withdrawState.services = cfg.services || {};
      withdrawState.rules = cfg.rules || withdrawState.rules;
    } catch (e) {
      showToast('Impossible de charger les services de retrait.', 'error');
    }

    renderWithdrawBalance();
    renderWithdrawCountries();
    renderWithdrawServices();
    updateWithdrawRecap();
  }

  function closeWithdraw() {
    const overlay = document.getElementById('withdraw-overlay');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function renderWithdrawBalance() {
    document.getElementById('withdraw-balance').textContent = formatMoney(withdrawState.balance) + ' FCFA';
  }

  function renderWithdrawCountries() {
    const wrap = document.getElementById('withdraw-countries');
    const countries = KOUZ.countries || [];
    wrap.innerHTML = countries
      .map((c) => {
        const sel = withdrawState.country === c.name ? ' selected' : '';
        return (
          '<button type="button" class="withdraw-country' + sel + '" data-country="' + c.name + '">' +
          '<span class="flag">' + c.flag + '</span><span>' + c.name + '</span></button>'
        );
      })
      .join('');
    wrap.querySelectorAll('.withdraw-country').forEach((btn) => {
      btn.addEventListener('click', () => {
        withdrawState.country = btn.dataset.country;
        withdrawState.service = null;
        wrap.querySelectorAll('.withdraw-country').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        renderWithdrawServices();
        updateWithdrawRecap();
      });
    });
  }

  function renderWithdrawServices() {
    const wrap = document.getElementById('withdraw-services');
    if (!withdrawState.country) {
      wrap.innerHTML = '<div class="withdraw-services-empty">Choisissez un pays pour voir les services.</div>';
      return;
    }
    const list = withdrawState.services[withdrawState.country] || [];
    if (list.length === 0) {
      wrap.innerHTML = '<div class="withdraw-services-empty">Aucun service de retrait disponible pour ce pays.</div>';
      return;
    }
    wrap.innerHTML = list
      .map((s) => {
        const sel = withdrawState.service === s.id ? ' selected' : '';
        const initials = s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          '<button type="button" class="withdraw-service' + sel + '" data-service="' + s.id + '">' +
          '<span class="withdraw-service-logo" style="background:' + s.color + '">' + initials + '</span>' +
          '<span class="withdraw-service-name">' + s.name + '</span>' +
          '<span class="withdraw-service-check">✓</span></button>'
        );
      })
      .join('');
    wrap.querySelectorAll('.withdraw-service').forEach((btn) => {
      btn.addEventListener('click', () => {
        withdrawState.service = btn.dataset.service;
        wrap.querySelectorAll('.withdraw-service').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateWithdrawRecap();
      });
    });
  }

  function currentAmount() {
    const n = Number(document.getElementById('withdraw-amount').value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function updateWithdrawRecap() {
    const recap = document.getElementById('withdraw-recap');
    const amount = currentAmount();
    const fee = Math.round(amount * withdrawState.rules.feeRate);
    const net = amount - fee;
    const country = withdrawState.country || '—';
    const service = withdrawState.service
      ? (withdrawState.services[withdrawState.country] || []).find((s) => s.id === withdrawState.service).name
      : '—';
    const phone = document.getElementById('withdraw-phone').value.trim() || '—';
    recap.innerHTML =
      '<div class="withdraw-recap-row"><span>Montant demandé</span><b>' + formatMoney(amount) + ' FCFA</b></div>' +
      '<div class="withdraw-recap-row"><span>Frais de retrait (' + Math.round(withdrawState.rules.feeRate * 100) + ' %)</span><b>− ' + formatMoney(fee) + ' FCFA</b></div>' +
      '<div class="withdraw-recap-row"><span>Pays</span><b>' + country + '</b></div>' +
      '<div class="withdraw-recap-row"><span>Service</span><b>' + service + '</b></div>' +
      '<div class="withdraw-recap-row"><span>Numéro destinataire</span><b>' + phone + '</b></div>' +
      '<div class="withdraw-recap-row total"><span>Montant net estimé</span><b>' + formatMoney(net) + ' FCFA</b></div>';
  }

  function setWithdrawStatus(text, type) {
    const el = document.getElementById('withdraw-status');
    el.textContent = text;
    el.className = 'withdraw-status ' + (type || '');
  }

  async function submitWithdraw() {
    if (withdrawState.submitting) return;
    const amount = currentAmount();
    const phone = document.getElementById('withdraw-phone').value.trim();

    if (amount <= 0) return setWithdrawStatus('Veuillez saisir un montant valide.', 'error');
    if (amount < withdrawState.rules.minAmount) return setWithdrawStatus('Montant inférieur au minimum (' + formatMoney(withdrawState.rules.minAmount) + ' FCFA).', 'error');
    if (amount > withdrawState.balance) return setWithdrawStatus('Montant supérieur à votre revenu disponible.', 'error');
    if (!withdrawState.country) return setWithdrawStatus('Veuillez choisir un pays.', 'error');
    if (!withdrawState.service) return setWithdrawStatus('Veuillez choisir un service Mobile Money.', 'error');
    if (!/^\+?\d{8,15}$/.test(phone.replace(/[\s\-().]/g, ''))) return setWithdrawStatus('Numéro de portefeuille invalide.', 'error');

    withdrawState.submitting = true;
    const btn = document.getElementById('withdraw-submit');
    btn.disabled = true;
    btn.textContent = 'Traitement…';
    setWithdrawStatus('', '');

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, country: withdrawState.country, service: withdrawState.service, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithdrawStatus(data.error || 'Retrait impossible.', 'error');
        return;
      }
      withdrawState.balance = data.revenu;
      renderWithdrawBalance();
      document.getElementById('withdraw-amount').value = '';
      setWithdrawStatus('Retrait enregistré (en attente). Réf. ' + data.reference, 'success');
      historyLoaded = false;
    } catch (e) {
      setWithdrawStatus('Erreur réseau. Réessayez.', 'error');
    } finally {
      withdrawState.submitting = false;
      btn.disabled = false;
      btn.textContent = 'Confirmer le retrait';
    }
  }

  const withdrawBtn = document.getElementById('withdraw-btn');
  const dashWithdrawBtn = document.getElementById('dash-withdraw-btn');
  const withdrawClose = document.getElementById('withdraw-close');
  const withdrawSubmit = document.getElementById('withdraw-submit');
  const withdrawAmount = document.getElementById('withdraw-amount');
  const withdrawPhone = document.getElementById('withdraw-phone');
  if (withdrawBtn) withdrawBtn.addEventListener('click', openWithdraw);
  if (dashWithdrawBtn) dashWithdrawBtn.addEventListener('click', openWithdraw);
  if (withdrawClose) withdrawClose.addEventListener('click', closeWithdraw);
  if (withdrawSubmit) withdrawSubmit.addEventListener('click', submitWithdraw);
  if (withdrawAmount) withdrawAmount.addEventListener('input', updateWithdrawRecap);
  if (withdrawPhone) withdrawPhone.addEventListener('input', updateWithdrawRecap);

  // ---- Démarrage ----
  buildTicker();
  init();
})();
