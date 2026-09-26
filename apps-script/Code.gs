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
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

    // Metadaten als kleiner Begleit-Eintrag (optional, hilfreich fuer die Punktetabelle)
    const meta = {
      gesendet: stamp,
      type: payload.type || (payload.caption !== undefined && !payload.ovr ? 'photo' : 'card'),
      caption: payload.caption || '',
      name: payload.name || '',
      nickname: payload.nickname || '',
      ovr: payload.ovr || '',
      pos: payload.pos || '',
      perk: payload.perk || '',
      edition: payload.edition || '',
      stats: payload.stats || {},
      datei: file.getName()
    };
    const metaFile = getOrCreateFolder_(ZIEL_ORDNER).createFile(
      Utilities.newBlob(JSON.stringify(meta, null, 2), 'application/json', stamp + '_' + name + '.json')
    );
    try { metaFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

    return json_({ ok: true, file: file.getName(), url: file.getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * GET-Anfrage: Liefert Kartenliste oder lädt ein einzelnes Bild herunter
 */
function doGet(e) {
  try {
    // 1. Download eines einzelnen Bildes als Base64
    if (e && e.parameter && e.parameter.downloadFileId) {
      const f = DriveApp.getFileById(e.parameter.downloadFileId);
      return json_({
        ok: true,
        name: f.getName(),
        mime: f.getMimeType(),
        base64: Utilities.base64Encode(f.getBlob().getBytes())
      });
    }

    // 2. Liste aller Karten abrufen
    const folder = getOrCreateFolder_(ZIEL_ORDNER);
    const files = folder.getFilesByType('application/json');
    const cards = [];

    while (files.hasNext()) {
      const file = files.next();
      try {
        const raw = file.getBlob().getDataAsString();
        const data = JSON.parse(raw);
        data.driveId = file.getId();
        // Bild-URL und Base64 fuer lokalen Download
        if (data.datei) {
          const imgFiles = folder.getFilesByName(data.datei);
          if (imgFiles.hasNext()) {
            const imgFile = imgFiles.next();
            data.imgFileId = imgFile.getId();
            data.cardImageUrl = 'https://drive.google.com/thumbnail?id=' + imgFile.getId() + '&sz=w600';
            // Bild direkt als Base64 mitsenden, damit es auf den Laptop geladen wird:
            data.imageBase64 = Utilities.base64Encode(imgFile.getBlob().getBytes());
          }
        }
        cards.push(data);
      } catch (inner) {}
    }

    cards.sort((a, b) => (b.gesendet || '').localeCompare(a.gesendet || ''));
    return json_({ ok: true, count: cards.length, cards: cards });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
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
