/**
 * GUT-Karten – Empfangs-Backend für Google Apps Script
 * Speichert die von Freunden gesendeten Karten-PNGs automatisch
 * in deinem Google Drive (Ordner "GUT Karten").
 *
 * Einrichtung: siehe APPS-SCRIPT-ANLEITUNG.md
 */

const ZIEL_ORDNER = 'GUT Karten';   // Ordner im Drive (wird automatisch angelegt)
const ZEITZONE = 'Europe/Berlin';

/**
 * Empfängt JSON im Format  { file: "data:image/png;base64,...", name: "...", ... }
 * und legt die PNG im Drive ab.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const dataUrl = payload.file || '';

    const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!m) {
      return json_({ ok: false, error: 'Kein gueltiges Bild (Data-URL erwartet)' });
    }

    const ext = m[1].toLowerCase() === 'jpg' ? 'jpg' : m[1].toLowerCase();
    const mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), mime, 'karte.' + ext);

    // Dateiname: Zeitstempel_Name.png (nur harmlose Zeichen)
    const name = String(payload.name || 'Gast')
      .replace(/[^\wÄÖÜäöüß\- ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 40) || 'Gast';
    const stamp = Utilities.formatDate(new Date(), ZEITZONE, 'yyyy-MM-dd_HHmmss');

    const folder = getOrCreateFolder_(ZIEL_ORDNER);
    const file = folder.createFile(blob.setName(stamp + '_' + name + '.' + ext));

    // Metadaten als kleiner Begleit-Eintrag (optional, hilfreich fuer die Punktetabelle)
    const meta = {
      gesendet: stamp,
      name: payload.name || '',
      nickname: payload.nickname || '',
      ovr: payload.ovr || '',
      pos: payload.pos || '',
      perk: payload.perk || '',
      edition: payload.edition || '',
      stats: payload.stats || {},
      datei: file.getName()
    };
    getOrCreateFolder_(ZIEL_ORDNER).createFile(
      Utilities.newBlob(JSON.stringify(meta, null, 2), 'application/json', stamp + '_' + name + '.json')
    );

    return json_({ ok: true, file: file.getName(), url: file.getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Gesundheitscheck: Aufruf der URL im Browser sollte {"ok":true} zeigen. */
function doGet() {
  return json_({ ok: true, service: 'GUT-Karten-Empfang' });
}

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
