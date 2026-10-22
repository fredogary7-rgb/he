const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'assets', 'uploads');

// Enregistre une image encodée en base64 (data URL) et renvoie son URL publique.
// Retourne null si l'image est invalide ou trop volumineuse.
function saveImage(base64) {
  const m = String(base64 || '').match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const data = Buffer.from(m[2], 'base64');
  if (data.length > 5 * 1024 * 1024) return null; // 5 Mo max
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = 'msg_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), data);
    return '/uploads/' + name;
  } catch (e) {
    console.error('[upload]', e);
    return null;
  }
}

module.exports = { saveImage };