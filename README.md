# Poker Timer

Lokale Browser-App für Texas-Hold'em-Homegames mit Turnier- und Cashgame-Modus.

## Lokal starten

```bash
npm start
```

Danach im Browser öffnen:

```text
http://localhost:4174
```

Die App nutzt nur HTML, CSS und JavaScript. Dadurch kann sie später ohne Umbau auf GitHub Pages oder einem normalen Webhost veröffentlicht werden.

## Checks

```bash
npm run check
```

Der Check prüft die JavaScript-Syntax. Für den Einsatz am Spielabend zusätzlich einmal Turnierstart, Levelwechsel, Cashgame, Export und Import im Browser testen.

## Wichtige Funktionen

- Turniermodus mit Presets, Blind-Struktur, Pausen, Rebuys, Add-ons und Payouts.
- Cashgame-Modus mit Session-Timer, Buy-ins, Cash-outs und Resultaten.
- TV-/Beamer-Modus für die große Timer-Anzeige.
- Lokale Speicherung im Browser, Export/Import einzelner Turniere und der Historie.
- Robuste Timer-Fortsetzung: Wenn der Browser kurz stockt oder der Tab inaktiv ist, holt die Uhr die verpasste Zeit nach.

## Export, Import und Historie

Turniere können lokal im Browser archiviert werden. Einzelne Turniere oder die gesamte Historie lassen sich als JSON exportieren und später wieder importieren. Das funktioniert auch bei einer Veröffentlichung über GitHub Pages, weil keine Datenbank benötigt wird.
