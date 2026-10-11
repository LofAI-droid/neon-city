# World Engine v1.0 — WP2: audio en gebruikersinterface

Status: uitgevoerd op `feature/world-engine-v1`, boven op WP1-commit `d83c9e5`. Geen commit, push of merge door deze uitvoering. Dit document beschrijft de huidige code; de audit en het WP1-document blijven historische momentopnames.

## Doel en resultaat

De bestaande twee Neon City-composities komen nu uit de wereldconfiguratie. De gedeelde audiomotor kent bron-ID's en typen (`global` en `proximity`) in plaats van vaste variabelen voor stad en kern. HTML-knoppen worden in kleine adapters aan besturing, Journey, renderkwaliteit en audio gekoppeld. Neon City gebruikt dezelfde twee MP3's, volumes 0,55/0,45, mastervolume 0,65, smoothstep-grenzen 90/12, gain-demping 0,65 seconde en start/pauze-demping 0,18 seconde.

## Audio-configuratie en wereldcontract

`js/worlds/neon-city/config.js` bevat nu deze gegevensvorm:

```javascript
audio: {
  sources: [
    { id: 'city-ambient', type: 'global',
      url: './assets/audio/city-ambient.mp3', gain: 0.55 },
    { id: 'energy-core', type: 'proximity',
      url: './assets/audio/energy-core.mp3', gain: 0.45,
      distanceKey: 'energy-core',
      distance: { fadeStart: 90, fullVolume: 12 } }
  ]
}
```

`loop` is optioneel en standaard `true`. URL's zijn lokale paden relatief aan de HTML-pagina, niet aan `config.js`; `../assets/...` is daarom juist vanuit `tests/audio-streaming.html`. Een wereld zonder muziek mag `audio` weglaten of `audio: { sources: [] }` geven. De bron-ID moet binnen één configuratie uniek zijn. `distanceKey` is een aparte sleutel voor de afstandsgegevens; meerdere proximity-bronnen kunnen dus verschillende waarden krijgen.

WP1 leverde `getAudioState() -> { proximityDistance }`. WP2 leest bij voorkeur:

```javascript
getAudioState() {
  return { distances: { 'energy-core': werkelijke3DAfstand } };
}
```

Neon City levert tijdelijk **beide** vormen. De app geeft de toestand na `world.update(dt, camera)` door aan `audio.updateAudioState(...)`. Per proximity-bron leest de manager alleen haar eigen `distanceKey`; ontbrekende of niet-eindige afstand betekent buiten bereik. `updateDistance(number)` blijft voor één proximity-bron beschikbaar als compatibiliteitsmethode en weigert een dubbelzinnige aanroep bij twee proximity-bronnen. `coreMix` in de managerstatus en `getEnergyDistance()` in de Neon City-world blijven tijdelijk voor WP1-aanroepers; de nieuwe neutrale gegevens zijn `sourceMixes` en `distances`.

`validateAudioConfig()` controleert bronlijst, maximaal **twee** bronnen, geldige unieke ID's, type, lokaal MP3-pad, optionele loop-vlag, eindige gain tussen 0 en 1, afstandssleutel en `0 <= fullVolume < fadeStart`. De validatie loopt bij wereldconfiguratie én bij het maken van de manager. Een derde bron levert expliciet: `audio.sources ondersteunt momenteel maximaal 2 bronnen`. Er is geen externe validatiebibliotheek.

## Werking en eigenaarschap

`createAudioManager({ audio, settings, ... })` registreert de maximaal twee bronbeschrijvingen. Bij een expliciete Start-klik maakt hij **één** AudioContext, een master-GainNode en per bron één HTMLAudioElement, MediaElementSource en GainNode. De bronbestanden blijven streaming-elementen met onafhankelijke tijdlijnen. `updateDistances()` verandert uitsluitend de relevante gain-targets. Mute wijzigt de mastergain; pause/resume bewaart de afspeelpositie. Free Flight en Journey roepen geen start of reset van een muziekbestand aan.

De bestaande bescherming met generatie-tokens, start-timeout en fade-timer blijft. Een oud resultaat van `play()` mag een onderbreking of dispose niet terugdraaien. Bij een fout halverwege bronaanmaak worden gedeeltelijke nodes en media-elementen opgeruimd; een nieuwe Start-klik kan opnieuw proberen. `dispose()` stopt media, ontkoppelt gain- en bron-nodes en sluit de context één keer. De wereld beheert zelf geen AudioContext of MP3-element.

Safari mag audio pas na een gebruikersactie starten. De calls naar `context.resume()` en alle `element.play()` gebeuren daarom synchroon in `start()`, vóór de eerste `await`.

## UI zonder vaste selectors in de motor

`js/main.js` is de pagina-bootstrap en kiest de huidige Neon City-elementen. `createEngine()` krijgt status/performance-elementen expliciet; `createControls()` en `createFlightModes()` zoeken geen HTML-ID's meer. De nieuwe `js/ui/flight-panel.js` verbindt knoppen voor muisblik, reset, renderkwaliteit en Journey met de gedeelde methoden. `js/audio/audio-panel.js` krijgt de audio-elementen, het canvas voor focus en optionele labels. Een andere HTML-indeling kan eigen elementen en teksten doorgeven; tests gebruiken een los paneel zonder Neon City-ID's.

De Journey-knop blijft uitgeschakeld zonder route. Voortgang en `x / y s` gebruiken nu `route.duration`, ook als dat geen 90 seconden is. De titel van het besturingspaneel toont de actieve vliegmodus. Reset via R blijft in de besturing; reset-, muis- en kwaliteitsknoppen zijn bindings van de adapter. Beide adapters verwijderen hun eigen listeners bij `dispose()`.

## Uitbreidbaarheid naar meerdere audiobronnen

**A. Nu geïmplementeerd:** nul, één of twee bronnen. Beide mogen onafhankelijk proximity-bronnen met eigen `distanceKey` zijn. Elke bron heeft ID, lokaal bestand, optionele loop-instelling, eigen gain, eigen mixwaarde, eigen media-element en eigen opruiming. De interface `updateDistances({ sleutel: afstand })` hoeft voor een extra sleutel niet te veranderen. Er is één gedeelde AudioContext.

**B. Architecturaal voorbereid:** voor een derde bron verhogen we later de expliciete limiet in `audio-settings.js`, controleren we prestaties en voegen we tests met drie echte media-elementen toe. De manager verwerkt bronbeschrijvingen al als lijst; de publieke descriptorvorm en afstandskaart kunnen gelijk blijven. We breiden de UI dan zo nodig uit met bronstatus per ID. Dit is vandaag **niet** geactiveerd: drie bronnen worden afgewezen.

**C. Nog niet ondersteund:** een runtime-methode om bronnen na het starten te vervangen, een echte A→B→A-wereldwissel, automatische fades tussen werelden, `PannerNode`/richting of binaurale plaatsing, en kwaliteitsmeting van volledige audioloops. Een wereld met twee verschillende proximity-afstanden past nu wel in het contract; echte directionele 3D-audio vraagt een luisteraarpositie, bronpositie en oriëntatie per frame plus een panner en aparte browsertests.

## Voorbereiding op WP3: voorziene audiowissel

De app bezit de gedeelde audiomanager en daarmee vandaag de AudioContext en mastervolume/mute. De manager bezit zijn eigen bron-elementen/nodes; de wereld levert bronconfiguratie en actuele afstanden. WP3 kan een expliciete `setSources`- of sessie-overgang toevoegen: nieuwe config eerst valideren, oude bron-gains zacht naar nul sturen, oude media pauzeren en nodes ontkoppelen, daarna nieuwe bronset installeren. Mastervolume en mute moeten op app-niveau behouden blijven. Bij dezelfde bron-ID én hetzelfde bestand kan WP3 kiezen de tijdlijn te behouden. Nieuwe media mogen alleen automatisch starten als de wereldkeuze zelf een geldige gebruikersactie is; anders toont de UI Start/Hervat audio. Overlap, foutafhandeling en A→B→A horen bij WP3 en bestaan nog niet.

## Gewijzigde bestanden

Toegevoegd: `js/ui/flight-panel.js`, `tests/wp2.js`, dit document.

Gewijzigd: `js/audio/audio-settings.js`, `audio-manager.js`, `audio-panel.js`; `js/world-contract.js`; `js/worlds/neon-city/config.js` en `world.js`; `js/controls.js`, `engine.js`, `journey/flight-modes.js`, `main.js`; `index.html`; `tests/audio.js`, `audio-streaming.js`, `browser.js`, `journey.js`, `world-contract.js` en beide test-HTML-bestanden. `style.css`, de cameraformules, Journey-interpolatie, geometrie en kernrespons zijn niet gewijzigd. Query-versies op gewijzigde modules laten Safari de actuele lokale modules laden.

## Testresultaten en meetgrenzen

Op `http://localhost:8000/tests/browser.html` in Safari: **136 PASS, 0 FAIL**. Dit zijn 55 v0.4B-controles, 47 WP1-controles en 34 WP2-controles. De WP2-checks dekken configuratie, twee onafhankelijke afstandssleutels/gains, nul/één/twee bronnen, limietfout, tijdlijnen, master/mute, pause/resume, asynchrone start na dispose, gedeeltelijke init-fout met herstel, adapters zonder vaste ID's, reset, muisblik, Journey zonder route en een route van 42 seconden. De bestaande 30/60/120 FPS-route- en bewegingscontroles blijven geslaagd.

Op `http://localhost:8000/tests/audio-streaming.html` in Safari: **7 PASS, 0 FAIL** met de twee echte lokale MP3's op mastervolume nul. Getest zijn starten, doorlopende afzonderlijke tijdlijnen, afstand zonder trackreset, Journey-start/stop/voltooiing, pauze, hervatten en de verwachte fout bij een ontbrekend bestand. Het zijn korte streamingcontroles, geen volledige beluistering van beide composities.

In de echte Neon City-pagina zijn de stad, kern, raster, beide audioknoppen, reset en onderbreken van Guided Journey bekeken. Bij circa 36 seconden Journey stond de kernmix op 17%; na onderbreken en R op 0%. De HUD toonde op dit scherm ongeveer 60 FPS en 10 drawcalls. Dit is een momentopname, geen FPS-vergelijking onder gecontroleerde condities. De P95-titel is in deze sessie niet afgelezen; er is geen P95-winst geclaimd. Via code-inspectie zijn één renderloop, één context per manager, geen extra runtime-dependency en ongewijzigde camera-/geometrie-/kernresponsformules gecontroleerd. `git diff --check` slaagt; beide MP3's blijven genegeerd en alleen `assets/audio/README.md` is gevolgd in Git.

## Zelf in Safari controleren

1. Start in de projectmap `python3 -m http.server 8000` en open `http://localhost:8000`.
2. Controleer de startcompositie en alle zes vliegrichtingen; probeer muisblik, R/reset en beeldkwaliteit.
3. Klik Start audio; test mute, volume en pauze/hervat. Beweeg naar de kern en terug: alleen de kernmix verandert. Luister desgewenst zelf of de balans vertrouwd klinkt.
4. Start Guided Journey en onderbreek met de knop of R. Controleer dat muziek doorgaat, de voortgang de werkelijke duur toont en de paneeltitel mee verandert. Laat eventueel een volledige Journey uitlopen tot Free Flight.
5. Open de twee testpagina's. De fout na **Test ontbrekend bestand** is daar verwacht.

Bekende grenzen: maximaal twee bronnen, geen werkende wereldwissel, geen directionele audio en geen bewezen prestatieverbetering. WP3, WP4 en WP5 zijn niet uitgevoerd.
