// ============================================================
// KOUZ HOUS — Page d'inscription
// ============================================================
(function () {
  const form = document.getElementById('register-form');
  const countrySelect = document.getElementById('country');
  const prefixEl = document.getElementById('phone-prefix');
  const messageEl = document.getElementById('form-message');
  const submitBtn = document.getElementById('submit-btn');

  KOUZ.populateCountries(countrySelect);
  KOUZ.initPasswordToggles();
  KOUZ.startSlideshow();

  // Pré-remplit le code d'invitation depuis l'URL (?code=... ou ?ref=...)
  const params = new URLSearchParams(window.location.search);
  const refCode = (params.get('code') || params.get('ref') || '').trim();
  if (refCode) {
    const codeInput = document.getElementById('invitation-code');
    if (codeInput) codeInput.value = refCode.toUpperCase();
  }

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
      confirmPassword: document.getElementById('confirm-password').value,
      invitationCode: document.getElementById('invitation-code').value.trim(),
      termsAccepted: document.getElementById('terms').checked,
    };

    // Validation côté client
    if (!payload.country) return KOUZ.showMessage(messageEl, 'Veuillez choisir votre pays.', 'error');
    if (!payload.phone) return KOUZ.showMessage(messageEl, 'Veuillez saisir votre numéro de téléphone.', 'error');
    if (payload.password.length < 6)
      return KOUZ.showMessage(messageEl, 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
    if (payload.password !== payload.confirmPassword)
      return KOUZ.showMessage(messageEl, 'Les mots de passe ne correspondent pas.', 'error');
    if (!payload.invitationCode)
      return KOUZ.showMessage(messageEl, "Le code d'invitation est requis.", 'error');
    if (!payload.termsAccepted)
      return KOUZ.showMessage(messageEl, "Vous devez accepter les conditions d'utilisation.", 'error');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) return KOUZ.showMessage(messageEl, data.error || 'Erreur inconnue.', 'error');

      KOUZ.showMessage(messageEl, data.message, 'success');
      form.reset();
      setTimeout(() => (window.location.href = '/login'), 1300);
    } catch (err) {
      KOUZ.showMessage(messageEl, 'Impossible de contacter le serveur. Réessayez.', 'error');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span class="spinner"></span> Inscription…'
      : "S'inscrire";
  }
})();
