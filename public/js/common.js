// ============================================================
// KOUZ HOUS — Helpers partagés (pays, slideshow, mot de passe)
// ============================================================
(function () {
  const COUNTRIES = [
    { name: 'Togo', code: '+228', flag: '🇹🇬' },
    { name: 'Bénin', code: '+229', flag: '🇧🇯' },
    { name: "Côte d'Ivoire", code: '+225', flag: '🇨🇮' },
    { name: 'Cameroun', code: '+237', flag: '🇨🇲' },
    { name: 'Burkina Faso', code: '+226', flag: '🇧🇫' },
    { name: 'Mali', code: '+223', flag: '🇲🇱' },
  ];

  window.KOUZ = {
    countries: COUNTRIES,
    countryByName(name) {
      return COUNTRIES.find((c) => c.name === name);
    },
  };

  // Remplit un <select> avec la liste des pays.
  window.KOUZ.populateCountries = function (select) {
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Choisissez votre pays</option>';
    COUNTRIES.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = `${c.flag}  ${c.name}  (${c.code})`;
      select.appendChild(opt);
    });
  };

  // Fond animé : fondu enchaîné + effet Ken Burns sur les images.
  window.KOUZ.startSlideshow = function () {
    const slides = document.querySelectorAll('.slide');
    if (slides.length < 2) return;
    let current = 0;
    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 4500);
  };

  // Boutons "afficher / masquer" le mot de passe.
  window.KOUZ.initPasswordToggles = function (root) {
    const scope = root || document;
    scope.querySelectorAll('.toggle-pass').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
      });
    });
  };

  // Affiche un message (erreur / succès) dans le formulaire.
  window.KOUZ.showMessage = function (el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'form-message show ' + (type || 'error');
  };
})();
