# World Engine v1.0 — WP3: veilig wisselen tussen werelden

Status: uitgevoerd op `feature/world-engine-v1` boven op goedgekeurde WP2-commit `b5072cf`. Alleen WP3; geen commit, push of merge. De documentatie van WP1 en WP2 beschrijft de stand van die werkpakketten.

## Doel en resultaat

De applicatie kan nu een wereld vervangen zonder een tweede renderer, canvas, renderloop, camera, besturing of AudioContext te maken. De productiepagina registreert voorlopig alleen Neon City. `tests/world-switching.html` registreert daarnaast een kleine **uitsluitend technische** Test World en een bewust falende wereld om A → B → A en herstel te controleren. De Test World is geen World 02 en staat niet in het productieregister.

```text
Pagina-adapter (main.js of tests/world-switching.js)
  ├─ World Registry: ID → factory → nieuwe gevalideerde instantie
  └─ World Manager: één switchWorld(id) coördineert de wissel
       ├─ Engine: Journey, invoer, scène, camera, renderloop
       └─ Audio Manager: fade, bron-elementen, gedeelde context/master
            ↑ actieve wereld: config + getAudioState()
```

`js/world-registry.js` bevat de expliciete factorylijst. Hij controleert een geldige en unieke ID, een `create`-functie, het WP1-wereldcontract, overeenstemming tussen register-ID en `world.config.id`, en een **nieuwe instantie per activatie**. Een onbekende of ongeldige wereld wordt afgewezen voordat de actieve wereld verandert. Een al uitgegeven instantie wordt niet opnieuw verwijderd: die kan nog actief zijn.

`js/world-manager.js` is de enige coördinator van een complete wissel. `engine.setWorld()` blijft de bestaande, laag-niveau operatie voor scène en camera; de manager verbindt die operatie met audio en de overgangsstatus. De manager rapporteert `activeId`, `busy`, `disposed` en `error` via `getState()` en `onChange`. Een tweede verzoek terwijl `busy` waar is krijgt een duidelijke fout. Dezelfde actieve wereld opnieuw kiezen doet niets.

## Volgorde en eigenaarschap

1. Het register maakt een kandidaat en valideert haar configuratie en lifecycle **voordat** de oude wereld wordt aangeraakt.
2. De engine onderbreekt een lopende Journey, verwijdert de oude route, wist toetsen/snelheid/muisdrag en bevriest camerabesturing en wereldupdates. Het bestaande scènebeeld mag tijdens de korte audiofade nog worden getekend.
3. `audio.setSources()` laat de oude mastergain in standaard 0,18 seconde uitfaden, stopt de oude HTMLAudioElements, verwijdert hun `src` en koppelt hun MediaElementSource- en GainNodes los. De AudioContext en masterinstellingen blijven bestaan.
4. De engine roept `dispose()` van de oude wereld aan, leegt de scène en verwijdert achtergrond/mist. De wereld bezit haar eigen geometrieën, materialen, textures en eventuele eigen listeners; de engine bezit renderer, scène, camera en centrale loop.
5. De engine stelt camera en omgeving volgens de nieuwe configuratie in, roept `init(scene)` aan, installeert eventueel de nieuwe Journey-route en geeft Free Flight weer vrij. R/reset gebruikt vanaf dan de nieuwe camera-startpose.
6. De nieuwe audiobronbeschrijvingen zijn beschikbaar, maar blijven stil tot de speler **Start audio** klikt.

Er is precies één `renderer.setAnimationLoop(frame)` in `js/engine.js`. De World Manager start geen animatielus en maakt geen renderer of AudioContext. `getAudioState()` van de actieve wereld levert per `distanceKey` de actuele afstand; de bestaande audioformules en camerabewegingsformules zijn niet herschreven.

### Audio en Safari

`js/audio/audio-manager.js` accepteert nu `setSources(audioConfig, { fadeSeconds })`. De nieuwe configuratie wordt eerst met de WP2-regels gevalideerd: nul tot maximaal twee lokale MP3-bronnen, met hun eigen ID/gain/afstand. Alleen de bron-elementen en hun nodes worden vervangen. `muted` en `volume` blijven behouden. Een oude asynchrone `play()` of fade kan door generatie-tokens geen oude muziek terugbrengen na wissel of `dispose()`.

De bronbestanden van de vorige wereld worden **wel** gestopt; bij A → B → A begint A na de nieuwe klik met nieuwe elementen en dus nieuwe tijdlijnen. Dat is bewust anders dan Free Flight ↔ Guided Journey **binnen dezelfde wereld**, waar beide tijdlijnen gewoon doorlopen. De wereldkeuze kan na een `await` geen betrouwbare Safari-autoplaytoestemming meer garanderen. Daarom is een nieuwe klik op **Start audio** de vaste regel, ook wanneer een wereld via een knop gekozen wordt. Een stille wereld toont een uitgeschakelde audiostartknop. De technische testpagina past alleen voor haar eigen `/tests/`-locatie de pagina-relatieve MP3-paden aan.

### Fouten en herstel

- Onbekende ID, dubbele ID, ongeldige factory/configuratie of hergebruik van een wereldinstantie: de oude wereld, route, camera en audio blijven intact omdat de voorbereiding vóór de overgang gebeurt.
- Overlappend verzoek: geweigerd; de lopende wissel wordt niet onderbroken.
- Fout in `init(scene)` ná het opruimen van de oude wereld: de kandidaat krijgt `dispose()`, scène en mist worden leeggemaakt, de engine blijft veilig zonder actieve wereld en de UI toont de fout. De gebruiker kan Neon City daarna opnieuw kiezen zonder herladen. Er is geen automatische rollback naar de al verwijderde oude wereld.
- `dispose()` tijdens de audiofade: de wissel wordt geannuleerd, de renderloop/canvas verdwijnen en de AudioContext wordt gesloten. `dispose()` is herhaalbaar.

Een wereld blijft verantwoordelijk voor correcte cleanup van haar eigen GPU-resources en listeners. Als haar eigen `dispose()` zelf faalt, kan de engine nog wel objecten uit de scène verwijderen, maar niet bewijzen dat alle wereldspecifieke resources zijn vrijgegeven. Dat hoort bij het wereldcontract en verdient aparte tests per toekomstige wereld.

## Bestanden

Nieuw: `js/world-registry.js`, `js/world-manager.js`, `tests/test-world.js`, `tests/wp3.js`, `tests/world-switching.html`, `tests/world-switching.js` en dit document.

Gewijzigd: `js/engine.js` (pauze/activatie/cleanup en kleine teststatistieken), `js/audio/audio-manager.js` (bronwissel), `js/audio/audio-panel.js` (dynamische mixweergave), `js/controls.js` (invoerlock tijdens wissel), `js/main.js` (registratie en manager), `index.html`, de bestaande browsertestbestanden `tests/browser.html`, `tests/browser.js`, `tests/world-contract.js`, `tests/wp2.js`, `tests/audio.js`, `tests/journey.js` en de echte MP3-testbestanden `tests/audio-streaming.html` en `tests/audio-streaming.js` (actuele moduleversies). Neon City-geometrie, energie-kern, Journey-interpolatie, CSS en bestaande audio-instellingen zijn niet veranderd.

## Tests en meetgrenzen

`tests/browser.html` in Safari: **164 PASS, 0 FAIL** na de laatste wijziging (136 bestaande checks en 28 WP3-checks). WP3 test register- en factoryfouten, ongeldige kandidaatconfiguratie, een trage asynchrone audiostart, Neon City → stille Test World → Neon City, camera/achtergrond/mist/route, R en inputlock, één canvas en context, mastervolume/mute, niet-automatisch afspelen, twintig extra wissels, bron- en mesh-opruiming, overlappende verzoeken, opzettelijke init-fout, herstel en dispose tijdens fade. Bestaande tests voor 30/60/120 FPS, vlucht, Journey, kern en WP1/WP2 blijven slagen.

`tests/audio-streaming.html` in Safari: **7 PASS, 0 FAIL** met de echte lokale MP3's, inclusief starten, onafhankelijke tijdlijnen, nabijheidsmix, Journey, pauze/hervat en de verwachte fout van een ontbrekend bestand. Op de nieuwe handmatige testpagina zijn mute + echte MP3-start, A → B → A tijdens Journey, een stille wereld zonder mist/route, en fout → herstel zichtbaar gecontroleerd. De gewone hoofdpagina toont de stad en kern, circa **60 FPS en 10 drawcalls in één Safari-momentopname**, en Guided Journey, reset en echte audio reageerden. De Test World toonde **1 drawcall**. Dit zijn observaties, geen gecontroleerde FPS- of P95-benchmark; er is geen prestatieverbetering geclaimd. De testpagina toont ook `renderer.info.memory` als korte resource-indicatie, geen volledige heap- of GPU-lekmeting.

Via code-inspectie en Git-controle: één renderloop, hoogstens één AudioContext per manager, geen nieuwe runtime-afhankelijkheden, `git diff --check` schoon. `.gitignore` negeert beide lokale MP3's; `git ls-files -- assets/audio/` toont alleen `README.md`.

## Zelf testen in Safari

1. Start in de projectmap `python3 -m http.server 8000` en open `http://localhost:8000`. Test Free Flight, alle richtingen, R, muisblik, Guided Journey en de bestaande audio.
2. Open `http://localhost:8000/tests/browser.html` voor de automatische regressie. Er hoort geen FAIL te staan.
3. Open `http://localhost:8000/tests/world-switching.html`. Klik **Neon City (A)** → **Test World (B)** → **Terug naar A**. Controleer de andere camera, blauwe achtergrond, verdwenen mist, één canvas en de uitgeschakelde Journey-/audioknop in B.
4. Start in A de Journey en zet desgewenst de audio met **Mute** aan. Wissel tijdens de Journey naar B: de Journey stopt, de oude muziek stopt en B blijft stil. Terug in A moet voor muziek opnieuw **Start audio** worden geklikt; mute/volume blijven ingesteld.
5. Klik **Foutwereld**. De fout moet zichtbaar zijn; klik daarna **Terug naar A** en controleer dat Neon City zonder herladen terugkomt. Gebruik `tests/audio-streaming.html` voor de bestaande echte-MP3-regressie.

Nog niet uitgevoerd: artistieke World 02, productiewereldkiezer, portalen, naadloze crossfade tussen werelden, behoud van tijdlijn van een eerder verlaten wereld, meer dan twee bronnen en directionele 3D-audio. WP4 en WP5 wachten op afzonderlijke instructies.
