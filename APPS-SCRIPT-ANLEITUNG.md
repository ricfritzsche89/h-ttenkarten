# Anleitung: Karten-Empfang per Google Apps Script (einmalig, ~15 Min)

Freunde öffnen deinen GitHub-Pages-Link, bauen ihre Karte – und per Klick auf
**„Karte an den Gastgeber senden"** landet die hochauflösende PNG (1800×2700)
**automatisch in deinem Google Drive** im Ordner **„GUT Karten"**. Verlustfrei,
kein Account für die Freunde, kostenlos.

## 1. Apps-Script anlegen

1. Öffne <https://script.google.com> und melde dich mit deinem Google-Konto an.
2. **„Neues Projekt"**.
3. Ersetze den Code im Editor komplett durch den Inhalt von
   **`apps-script/Code.gs`** (diese Ordnerdatei) und speichere (Strg+S),
   z. B. als Projektname „GUT-Karten-Empfang".

## 2. Als Web-App veröffentlichen

1. Oben rechts **„Deploy" → „Neues Deployment"**.
2. Zahnrad (⚙) → Typ: **Web-App**.
3. Einstellungen:
   - **Ausführen als:** Ich (dein Google-Konto)
   - **Zugriff:** **Alle**  ← wichtig, sonst können Freunde nicht senden
4. **„Deploy"** klicken, Google-Account erlauben („Zulassen"), ggf.
   „Erweitert" → „Zu Apps Script gehen".
5. Kopiere die angezeigte **Web-App-URL** (endet auf `/exec`).

> Die KI-Prüfung beim ersten Deploy kann „Warnung" zeigen – das ist bei
> eigenem Code normal. „Trotzdem fortfahren" ist in Ordnung.

## 3. URL in die App eintragen

In `index.html`, ganz oben im `<script>`-Block:

```js
const GUT_SUBMIT_URL = 'https://script.google.com/macros/s/AKfyc.../exec';
```

Speichern – fertig. Ohne diese URL bleibt der Senden-Button inaktiv und
freunde können weiterhin nur herunterladen.

## 4. Kurztest

1. Die URL im Browser aufrufen → es muss `{"ok":true}` erscheinen (Dienst läuft).
2. Seite öffnen, Karte bauen, **„Karte an den Gastgeber senden"** klicken →
   Toast „Karte an den Gastgeber gesendet! 📬".
3. Im Drive-Ordner **„GUT Karten"** liegen jetzt:
   - `2026-09-23_2015_Werner.png` – die Karte (voller Umfang, verlustfrei)
   - `2026-09-23_2015_Werner.json` – Name, Nickname, OVR, Stats
     (perfekt zum Eintragen in deine Punktetabelle)

## Wartung / Häufigkeit

- **Nach jeder Änderung von `Code.gs`:** „Deploy" → „Neue Deployment"
  (neue Version) – die URL bleibt gleich.
- Kontingent: Das ist mehr als ausreichend für eine Feier (Drive 15 GB gratis,
  Apps Script ~90 Min Laufzeit/Tag – bei ein paar dutzend Karten egal).
- Wer die URL kennt, kann dir Karten schicken (und nur das). Sie liegt im
  Quelltext deiner öffentlichen GitHub-Seite – für den Freundeskreis unkritisch.

## GitHub Pages: Dateiname nicht vergessen

GitHub Pages serviert die Seite unter `.../<repo>/` nur als **`index.html`**.
Beim Anlegen des Repos die HTML-Datei in **`index.html`** umbenennen
(und `vorlagen/`, `apps-script/`, `PROJEKTNOTIZEN.md` am besten NICHT mit ins
Repo legen, falls die Seite öffentlich sein soll – optional über
`.gitignore`).
