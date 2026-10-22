// ============================================================
// KOUZ HOUS — Page de connexion
// ============================================================
(function () {
  const form = document.getElementById('login-form');
  const countrySelect = document.getElementById('country');
  const prefixEl = document.getElementById('phone-prefix');
  const messageEl = document.getElementById('form-message');
  const submitBtn = document.getElementById('submit-btn');

  KOUZ.populateCountries(countrySelect);
  KOUZ.initPasswordToggles();
  KOUZ.startSlideshow();

  countrySelect.addEventListener('change', () => {
    const c = KOUZ.countryByName(countrySelect.value);
    if (c) prefixEl.textContent = c.code;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      country: countrySelect.value,
      phone: document.getElementById('phone').value.trim(),
      password: document.getElementById('password').value,
      rememberMe: document.getElementById('remember-me').checked,
    };

    if (!payload.country) return KOUZ.showMessage(messageEl, 'Veuillez choisir votre pays.', 'error');
    if (!payload.phone) return KOUZ.showMessage(messageEl, 'Veuillez saisir votre numéro de téléphone.', 'error');
    if (!payload.password) return KOUZ.showMessage(messageEl, 'Veuillez saisir votre mot de passe.', 'error');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) return KOUZ.showMessage(messageEl, data.error || 'Erreur inconnue.', 'error');

      window.location.href = '/dashboard';
    } catch (err) {
      KOUZ.showMessage(messageEl, 'Impossible de contacter le serveur. Réessayez.', 'error');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span class="spinner"></span> Connexion…'
      : 'Se connecter';
  }
})();
