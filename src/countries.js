// Liste des pays pris en charge (investissement FCFA / Mobile Money).
const COUNTRIES = [
  { name: 'Togo', code: '+228', flag: '🇹🇬' },
  { name: 'Bénin', code: '+229', flag: '🇧🇯' },
  { name: "Côte d'Ivoire", code: '+225', flag: '🇨🇮' },
  { name: 'Cameroun', code: '+237', flag: '🇨🇲' },
  { name: 'Burkina Faso', code: '+226', flag: '🇧🇫' },
  { name: 'Mali', code: '+223', flag: '🇲🇱' },
];

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);

// Opérateurs Mobile Money pris en charge par pays (pour les retraits).
// Aucun fournisseur de paiement automatisé n'est encore intégré : les retraits
// sont enregistrés puis traités manuellement (statut "en attente").
const WITHDRAWAL_SERVICES = {
  'Togo': [
    { id: 'flooz', name: 'Flooz (Moov Africa)', color: '#0070C0' },
    { id: 'tmoney', name: 'T-Money (Togocel)', color: '#F5A623' },
  ],
  'Bénin': [
    { id: 'mtn', name: 'MTN Mobile Money', color: '#FFCC00' },
    { id: 'moov', name: 'Moov Money', color: '#005BBB' },
    { id: 'celtiis', name: 'Celtiis', color: '#E30613' },
  ],
  "Côte d'Ivoire": [
    { id: 'orange', name: 'Orange Money', color: '#FF7900' },
    { id: 'mtn', name: 'MTN Mobile Money', color: '#FFCC00' },
    { id: 'wave', name: 'Wave', color: '#1DC4FF' },
    { id: 'moov', name: 'Moov Money', color: '#005BBB' },
  ],
  'Cameroun': [
    { id: 'mtn', name: 'MTN Mobile Money', color: '#FFCC00' },
    { id: 'orange', name: 'Orange Money', color: '#FF7900' },
  ],
  'Burkina Faso': [
    { id: 'orange', name: 'Orange Money', color: '#FF7900' },
    { id: 'moov', name: 'Moov Money', color: '#005BBB' },
  ],
  'Mali': [
    { id: 'orange', name: 'Orange Money', color: '#FF7900' },
    { id: 'moov', name: 'Moov Money', color: '#005BBB' },
  ],
};

// Règles de retrait (alignées sur les valeurs affichées dans le dashboard).
const WITHDRAWAL_RULES = {
  minAmount: 1600, // FCFA
  feeRate: 0.1, // 10 %
};

module.exports = { COUNTRIES, COUNTRY_NAMES, WITHDRAWAL_SERVICES, WITHDRAWAL_RULES };
