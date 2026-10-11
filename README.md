# Neon City v0.4B — Guided Journey

Een lokale 3D-wireframe-stad met 108 reproduceerbare gebouwen, rastervloer,
een interactieve energiekern en subtiele zwevende lichtsporen. HTML, CSS en
vanilla JavaScript ES-modules, met Three.js 0.180.0 lokaal onder `lib/three/`.
Geen buildstap, runtime-CDN, backend of online assets.

## Starten in Safari

Open Terminal in deze projectmap en voer uit:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000 in Safari. Vernieuw een reeds geopend tabblad.
Open `index.html` niet via dubbelklik: ES-modules hebben de webserver nodig.
Als poort 8000 al in gebruik is door deze server, gebruik die bestaande server.
Stop een zelf gestarte server met Control-C. De volledige map kan worden
verplaatst; start de server daarna vanuit de nieuwe map.

## Besturing en beeldkwaliteit

- ↑ / ↓: vooruit / achteruit langs de kijkrichting.
- ← / →: draaien; A / D: zijwaarts.
- Spatie / Shift: stijgen / dalen, zonder zwaartekracht.
- R of Terug naar start: oorspronkelijke positie en oriëntatie.
- Muisblik aan: sleep met de linkermuisknop in de wereld om rond te kijken.
- Beeld wisselt tussen balans (max. 1,25 renderfactor), scherp (1,5) en licht (1).

Klik in de wereld als het toetsenbord nog in de adresbalk staat. Focusverlies
wist ingedrukte toetsen. De wereld is eindig; de camera kan vrij daarbuiten
vliegen en door gebouwen bewegen, net als in v0.1.

## Prestaties en fase 2

De analyse van v0.1 vond dubbel getekende verdiepingslijnen en lijnsegmenten
met lengte nul, zeven afzonderlijke kernringen en een Retina-renderfactor
van maximaal 1,5. Gebouwen waren al in drie tekenopdrachten gebundeld.

v0.2 verwijdert de overbodige vloersegmenten, bundelt de zeven ringen in twee
kleurgroepen en hergebruikt een bewegingsvector in plaats van elke frame een
nieuwe vector te maken. De bewegingsformules, snelheid en toetsen zijn behouden.
De standaard renderfactor 1,25 verwerkt bij Retina circa 31% minder pixels dan
1,5; dit is een berekende pixelreductie, geen gemeten GPU-tijdwinst.

De 90 atmosferische lichtsporen kosten samen één tekenopdracht. Alleen een
tijduniform verandert per frame; de geometrie blijft op de GPU. In het
startbeeld daalt het totale aantal tekenopdrachten van 14 naar 10, ondanks
extra architectuur. Er is geen bloom, postprocessing of schaduwberekening.

De FPS-teller toont elke seconde de gemeten beeldfrequentie. Houd de muis op
de teller voor P95-frametijd (laatste maximaal 240 frames), renderfactor en
lijnsegmenten. Een lagere P95 betekent minder lange frames. Deze waarde
omvat ook browserplanning, en is geen afzonderlijke GPU-meting. Metingen
worden gewist bij wisselen van beeldstand of zichtbaarheid.

## Testen

Open http://localhost:8000/tests/browser.html voor lokale browsercontroles:
alle vliegrichtingen, draaien, reset, focusverlies, beweging bij 30/60/120 FPS,
vaste gebouwseed, geldige geometrie, resource-opruiming, herinitialisatie en
WebGL/shader-rendering. De testpagina verandert geen bestanden of instellingen.

Controleer daarnaast in de gewone Safari-wereld:

1. Alle toetsen, muisblik aan/uit en reset; let op zachte versnelling en uitloop.
2. Het beeld tijdens vliegen tussen gebouwen en boven de stad.
3. Venster verkleinen/vergroten; tab wisselen en terugkomen, zonder grote sprong.
4. Vergelijk licht, balans en scherp op dezelfde positie na circa 10 seconden.
5. Observeer FPS en P95 gedurende minimaal een minuut; controleer Safari's
   console/netwerkoverzicht indien de ontwikkeltools reeds beschikbaar zijn.

Tijdens de korte Safari-test van v0.1 stond de teller rond 30 FPS met 14 draws.
Zie het fase-2-testrapport hieronder voor de daadwerkelijk waargenomen uitkomst.
Een browser- of energielimiet kan een rol spelen als alle beeldstanden exact
rond 30 FPS blijven, maar die oorzaak is hier niet vastgesteld. Geen garantie
op 60 FPS of aantoonbaar betere framestabiliteit zonder langere meting.

## Architectuur en gewijzigde bestanden

- `index.html`, `style.css`: bestaande interface, v0.2 en kwaliteitsknop.
- `js/engine.js`: renderer, renderloop, resizes, kwaliteitsstanden en frametijden.
- `js/controls.js`: bestaande vlucht, met hergebruik van tijdelijke vector.
- `js/camera.js`, `js/main.js`: behouden camera en opstartcode.
- `js/worlds/neon-city/world.js`: init/update/dispose van de wereld.
- `buildings.js`, `grid.js`, `sphere.js`: verfijnde gebouwen, raster en kern.
- `atmosphere.js`: nieuwe lichte, geanimeerde lichtsporen.
- `tests/browser.html`, `tests/browser.js`: lokale controles.
- `lib/three/`: bestaande Three.js-modules en MIT-licentie, ongewijzigd.

Visuele verfijning: terrassen, terugliggende bouwdelen, podiums, gevelpanelen,
verticale masten en subtiele goudlijnen; meer cyaancontrast, paarszwarte mist,
een iets grotere/nabijere kern en zwevende lichtfragmenten.
De referentie-JPG en oorspronkelijke fasespecificatie zijn behouden.
Geen nieuwe downloads, muziek, ruimtelijke audio, Guided Journey,
smartphonebesturing, publicatie of automatische Git-commit.

## Uitgevoerde fase-2-controles

Op 9 oktober 2026 in Safari: alle 12 lokale browsercontroles PASS, inclusief
WebGL-rendering van de atmosferische shader en volledige resource-opruiming.
Handmatig vooruitvliegen, stijgen, zijwaarts bewegen, draaien, reset en de
kwaliteitsknop bediend. De wereld blijft renderen met 10 draws. De waargenomen
teller bleef circa 30 FPS, ook in de lichte stand; een FPS-stijging of betere
P95 ten opzichte van v0.1 is niet aangetoond. Er is geen langdurige benchmark
of afzonderlijke GPU-profielmeting uitgevoerd. Alle relatieve module-imports
bestaan; `git diff --check` leverde geen fouten op.


## Fase 3 — Interactive Energy Core

De kern reageert op de echte 3D-afstand tussen camera en het actuele,
licht zwevende wereldcentrum (basispositie `[0, 19, -82]`, bolradius 11).
De camera, stad, rastervloer, besturing en beeldstanden zijn ongewijzigd.

- **Rust:** vanaf 90 units. Langzame draaiing, drie zachte orbitale banen,
  subtiele puls en hoofdzakelijk cyaan met goud.
- **Activatie:** van 90 tot 26 units. Intensiteit en draaisnelheid nemen
  continu toe; extra banen verschijnen geleidelijk.
- **Resonantie:** binnen 26 units, met maximum binnen 12 units. Alle twaalf
  banen zichtbaar, zacht turquoise/goud kleurverloop en een rustige puls.

De afstandswaarden lopen via smoothstep in elkaar over. Reactiewaarden
volgen met exponentiële demping (tijdconstante 1,2 seconde). Bij wegvliegen
of R neemt de reactie dus geleidelijk af. Rotatie wordt geïntegreerd in
de tijd; veranderende snelheid zet de rotatiehoek niet plotseling om.

Instellingen staan in `js/objects/energy-core-settings.js`: afstandsdrempels,
rotatie 0,075–0,19 rad/s, lijn-/gloedhelderheid, kleuren, pulsfrequentie
0,9 rad/s (circa zeven seconden per puls), pulsamplitude 2,5–5,5%, zweefbeweging
en aantal/segmenten van de banen. Optionele gedeeltelijke overrides worden
bij het aanmaken samengevoegd. `sphere.js` bevat alleen de plaatsing in Neon City.

De herbruikbare `createEnergyCore({ position, settings, onInteraction })`
levert `object`, `update(deltaTime, camera)`, `getInteractionState()` en
`dispose()`. Een optionele `onInteraction(snapshot)` ontvangt maximaal
circa tien keer per seconde afstand, activatie, resonantie, intensiteit en
het toestandslabel. Dit is het uitbreidingspunt voor toekomstige audio of
portalen; er wordt nu geen audio afgespeeld of navigatie uitgevoerd.
Toestandslabels beschrijven de afstand; visuele waarden blijven vloeiend
nalopen. Bij gebruik in een andere wereld moet die wereld de kern updaten
en opruimen, zoals Neon City dat doet.

De extra banen blijven binnen de bestaande twee kleurbundels. In totaal
vijf drawcalls voor de kern en tien voor de stad, net als v0.2. De orbitale
geometrie bevat 864 segmenten in plaats van 672 (+192); de overige kerngeometrie
is behouden. Alleen kleine uniforms, kleuren, opaciteit en transformaties
veranderen per frame. Geen nieuwe textures van internet, dependencies,
postprocessing, dynamische bufferuploads of schaduwberekeningen.

Vlak bij het exacte centrum wordt de schijnbare grootte van de gloed zacht
begrensd en vervaagt het kleine massieve midden. Dit voorkomt dat het hele
scherm wit wordt wanneer je door de kern vliegt. De orbitale lijnen blijven
aanwezig; normale perspectief- en near-plane-clipping blijft gelden.
Helderheid is een visuele gloed/opacity, geen echte belichting van gebouwen.

### Zelf testen in Safari

1. Vernieuw http://localhost:8000. Bij de start sta je circa 145 units van
   de kern: rust. Bekijk de langzame draaiing en subtiele puls.
2. Houd ↑ vast: na circa drie seconden kom je in de activatiezone.
   Laat los om de geleidelijke verandering te bekijken.
3. Vlieg verder naar de bol. Stijg met Spatie ongeveer een halve tot een
   hele seconde om dichter bij de centrumhoogte (19 units) te komen.
   Binnen 26 units begint resonantie; binnen 12 units is de reactie maximaal.
   Blijf even hangen, zodat de gedempte reactie kan volgen.
4. Vlieg door de bol, zijwaarts, omhoog of omlaag en vervolgens weg.
   Alle drie assen tellen mee. Buiten de reactieafstand keert rust terug.
5. Druk R. Controleer de oorspronkelijke positie en geleidelijk uitdoven.
6. Vergelijk FPS/P95 tijdens rust en resonantie in dezelfde beeldstand.
   Houd de muis op de FPS-teller voor de frametijdgegevens.
7. Open http://localhost:8000/tests/browser.html. De aanvullende kerncontroles
   testen afstand op X/Y/Z, getransformeerde plaatsing, nabijheidsgrenzen,
   terugkeer naar rust, 30/120 FPS, callbacks, passage door het centrum,
   shader-rendering, drawcallbudget en zelfstandig opruimen. De bestaande
   vluchtcontroles blijven eveneens aanwezig.

Gewijzigd in fase 3: `index.html`, `js/engine.js`,
`js/worlds/neon-city/world.js`, `js/worlds/neon-city/sphere.js`,
`tests/browser.html`, `tests/browser.js` en dit README. Nieuw: `js/objects/energy-core.js`,
`energy-core-settings.js`, `energy-response.js` en `tests/energy-core.js`.
Geen wijzigingen aan `controls.js`, `camera.js`, gebouwen, raster, atmosfeer,
CSS of lokale Three.js. Geen commit of push door deze ontwikkelfase.


### Uitgevoerde fase-3-controles

In Safari op 9 oktober 2026: alle 26 browsercontroles PASS (12 bestaande,
14 aanvullende kerncontroles). Handmatig rustbeeld, naderen, resonantie,
verder doorvliegen, terugvliegen en R gecontroleerd. In de waargenomen
rust-/naderings-/nabijheidsbeelden bleef de teller rond 30 FPS met tien
tekenopdrachten, zonder waargenomen daling. Dit is een korte praktijkcontrole,
geen langdurige benchmark of garantie op stabiele GPU-frametijden.
De automatische test rendert ook op exact nul afstand en aan beide kanten
van de kern, zonder consolefout, ongeldige schaal of ongeldige opacity.
Alle lokale module-imports bestaan; `git diff --check` is schoon.


## Fase 4A — audio-engine

Klik rechtsonder op **Start audio**. Voor die klik wordt geen AudioContext
of audiospeler aangemaakt en klinkt niets. De stadscompositie en kerncompositie
spelen daarna elk als onafhankelijke HTMLAudioElement-loop via een eigen
MediaElementAudioSourceNode en GainNode naar één mastergain. Geen fetch,
decodeAudioData, AudioBuffer van de volledige compositie of nieuwe dependency.
De browser beheert zelf het streamen, bufferen en decoderen van de MP3's;
de hoeveelheid gecomprimeerde data die hij buffert is browserafhankelijk.

**Pauzeer audio** fade't de uitgang gedurende 180 ms uit en pauzeert beide
spelers op hun huidige afspeeltijd. **Start audio** hervat ze na een nieuwe
klik, zonder terugzetten naar seconde nul of dubbele bronkoppeling.
**Mute/Unmute** fade't alleen de mastergain; beide tijdlijnen en de actuele
nabijheidsmix blijven doorlopen. De volumeschuif regelt 0–100% mastervolume
(standaard 65%). Er zijn geen nieuwe sneltoetsen. De volumeschuif en knoppen
gebruiken de bestaande uitsluiting van formulierelementen in Free Flight.

`js/audio/audio-settings.js` bevat alle relatieve URLs en mixinstellingen:

- Stad: `./assets/audio/city-ambient.mp3`, stabiele gain 0,55.
- Kern: `./assets/audio/energy-core.mp3`, maximale gain 0,45.
- `fadeStartDistance: 90`: buiten die afstand kernlaag stil.
- `fullVolumeDistance: 12`: binnen die afstand maximale kernlaag.
- Smoothstep tussen de grenzen, met `setTargetAtTime` en tijdconstante 0,65 s.

De afstand komt uit de bestaande kern na haar wereld-update, inclusief
zweefbeweging en alle drie de camera-assen. Er is geen afzonderlijk
hardgecodeerd audio-centrum. De kerntrack loopt ook op gain nul door;
naderen start haar niet telkens opnieuw. Bij R of wegvliegen neemt alleen
de kernlaag geleidelijk af. De uitlezing **Kernmix** toont het doelpercentage;
de hoorbare gain loopt door de demping iets na. Fase 4A is een
**afstandsafhankelijke mix**, geen binaurale of stereo-positionering met
PannerNode. MP3-loops zijn niet gegarandeerd sample-perfect/gapless: eventuele
stilte in de bron of encoderpadding kan aan het einde hoorbaar blijven.

Ontbrekende of onleesbare bestanden en afgewezen play-promises verschijnen
in het audiopaneel. Beide spelers worden dan gepauzeerd; de 3D-wereld blijft
bruikbaar. Corrigeer het bestand op dezelfde locatie en klik opnieuw op
Start audio. De engine voorkomt dubbele initialisatie en ruimt spelers,
eventlisteners, fades/timers en AudioNodes op bij verwijderen van de pagina.
Safari kan bij slaap of een onderbreking opnieuw een expliciete Hervat audio-
klik verlangen. Er wordt nooit automatisch vanuit een timer afspelen hervat.

### Lokale muziek en Git

De daadwerkelijk aanwezige bestanden zijn `city-ambient.mp3` (30.724.209 bytes)
en `energy-core.mp3` (7.125.342 bytes). Voor wijzigingen gaf
`git ls-files assets/audio` geen output: geen muziekbestanden werden gevolgd.
Nieuw `.gitignore` sluit `/assets/audio/*.mp3`, `*.wav` en `*.m4a` uit, plus
`.DS_Store`. De muziek is niet gewijzigd, verplaatst, hernoemd of geüpload.
`assets/audio/README.md` houdt de map reproduceerbaar. Op een andere computer
moeten de MP3's apart worden overgezet; een Git-clone bevat die muziek niet.

### Zelf controleren in Safari

1. Vernieuw http://localhost:8000: geen geluid tot Start audio.
2. Klik Start audio en vlieg naar de bol. De stad blijft klinken en de kernlaag
   wordt geleidelijk sterker; vlieg ook boven/onder de bol of door het centrum.
3. Vlieg terug of druk R: kernlaag neemt af, stad blijft stabiel.
4. Test volume, mute/unmute, pauzeren en opnieuw starten.
5. Laat beide composities hun volledige duur doorlopen om de loopovergangen
   muzikaal te beoordelen. Luister ook naar klikjes bij naderen en wegvliegen.
6. Controleer FPS/P95 met audio uit en aan, in dezelfde beeldstand.
7. http://localhost:8000/tests/browser.html voert de bestaande 26 controles
   en negen audio-logica/lifecycle-controles uit met nagebootste audio-nodes;
   die pagina start geen echte muziek.
8. http://localhost:8000/tests/audio-streaming.html test de echte MP3-spelers
   met mastervolume nul, na een knopklik: voortgang, loopvlaggen, pauze,
   hervatten na een nieuwe klik en een bewust ontbrekende test-URL.
   Die 404 is in die fouttest verwacht; de bestaande MP3's blijven staan.

Nieuwe bestanden: `.gitignore`, `js/audio/audio-settings.js`,
`audio-manager.js`, `audio-panel.js`, `assets/audio/README.md`,
`tests/audio.js`, `tests/audio-streaming.html` en `tests/audio-streaming.js`.
Gewijzigd: `index.html`, `style.css`, `js/main.js`, `js/engine.js`,
`js/worlds/neon-city/world.js`, `js/objects/energy-core.js` (alleen een
afstand-accessor), `tests/browser.js` en dit README. Camera, besturing,
stadsgeometrie, kernvisuals en lokale Three.js blijven behouden.
Niet ontwikkeld: Guided Journey/fase 4B, audio-reactieve visualisaties,
binaurale positionering, portalen, wereldwissels of publicatie.
Geen Git-add, commit, push of upload uitgevoerd.

### Uitgevoerde fase-4A-controles

Safari: alle 35 regressiecontroles PASS, plus zes controles met de echte
MP3-spelers (start, voortgang, stil doorlopen/afstand, pauze, hervatten en
ontbrekend bestand). Handmatig Start/Pauzeer, Mute/Unmute, volume, vliegen
en R bediend. De kernmix steeg bij naderen tot 98% en ging bij R terug naar
0%; stadsgain blijft constant. De daadwerkelijke MP3-duur is circa 768,1 s
(stad) en 178,1 s (kern). Volledige loopovergangen en hoorbare muzikale
kwaliteit/klikvrijheid zijn niet beluisterd; die controle blijft aan de gebruiker.
De automatische test controleert de loopvlaggen en tijdlijnvoortgang, niet de
klank aan het einde van de composities. Tijdens starten werd kort 26 FPS
gezien; tijdens afspelen/vliegen weer circa 30 FPS met tien draws. Geen
langdurige FPS-, geheugen- of GPU-profielmeting uitgevoerd.

Git-controle na implementatie:

`git status --short`:

```text
 M README.md
 M index.html
 M js/engine.js
 M js/main.js
 M js/objects/energy-core.js
 M js/worlds/neon-city/world.js
 M style.css
 M tests/browser.js
?? .gitignore
?? assets/
?? js/audio/
?? tests/audio-streaming.html
?? tests/audio-streaming.js
?? tests/audio.js
```

`git check-ignore assets/audio/*.mp3`:

```text
assets/audio/city-ambient.mp3
assets/audio/energy-core.mp3
```

`assets/` in de status omvat het nieuwe audio-README; de MP3's zijn genegeerd
en worden niet gevolgd. Alle lokale module-imports bestaan.


## Fase 4B — Guided Journey

Klik **Start audio** wanneer je muziek wilt, vervolgens **Guided Journey**.
De bestaande Python-server op localhost:8000 blijft voldoende. De veilige
cinematografische route duurt precies 90 seconden; de aanloop vanaf je huidige
positie telt afzonderlijk. Vanaf de oorspronkelijke startpositie duurt die
oriëntatieovergang 2,5 seconden. Bij een start elders kan de aanloop langer zijn.

| Vluchttijd | Route |
| --- | --- |
| 0–15 s | Langzaam de stad in |
| 15–40 s | Tussen de gebouwen, met kleine zijwaartse en hoogteverschillen |
| 40–65 s | Naar de kern; de bestaande audiocurve volgt de echte afstand |
| 65–80 s | Rustige gedeeltelijke boog vóór de kern, buiten de geometrie |
| 80–90 s | Uitdrijven nabij de kern, snelheid naar nul |

**Terug naar Free Flight** onderbreekt onmiddellijk zonder camera- of audiosprong.
De actuele vliegsnelheid wordt overgedragen en door de bestaande Free Flight
geleidelijk afgeremd. R en Terug naar start onderbreken de Journey en voeren
hun gebruikelijke reset uit. Na voltooiing keert Free Flight automatisch terug.
Een verborgen tab pauzeert alleen de Journey en het renderen; de bestaande
audiospelers worden door moduswissels of tabwissels niet herstart.

De aanloop controleert conservatieve gebouwvolumes en een veiligheidsradius
van 13,5 rond de kern (inclusief marge voor het zweven). Bij een geblokkeerde
directe route gaat hij via vrije hoogte boven de stad. Vanuit een gebouw,
de kern of onder de vloer wordt starten geweigerd met een melding; vlieg dan
eerst naar vrije ruimte of druk R. Free Flight behoudt zijn bestaande vrijheid
om door geometrie te bewegen. De routeveiligheid hoort bij de huidige wereld;
bij gewijzigde gebouw- of kerngeometrie moet de route opnieuw worden getest.

### Modules en instelbaarheid

- `js/journey/flight-modes.js`: modusbeheer, UI, zichtbaarheid en cleanup.
- `js/journey/journey.js`: herbruikbare cameramotor, afzonderlijke positie en
  kijkrichting, tijd en snelheidsoverdracht.
- `js/journey/timed-path.js`: Catmull-Rom-traject met vloeiende tijdmapping,
  quintische aanloop en framerate-onafhankelijke interpolatie.
- `js/worlds/neon-city/journey-route.js`: wereldspecifieke tijdpunten, posities,
  kijkdoelen, veiligheidsmarge en aanloopplanning. Een andere wereld levert
  via `getJourneyRoute()` dezelfde interface: `duration`, `positions`,
  `targets`, `isSafe(point)` en `planEntry(origin, begin)`.
- `buildings.js` levert alleen extra geometriegegevens voor de veiligheidscontrole;
  de gegenereerde zichtbare geometrie blijft identiek.

Geen nieuwe geometrie, materialen, audio-afhankelijkheden of renderloops.
De bestaande renderer blijft op 10 drawcalls. De aanloopplanning gebeurt bij
start; per frame worden alleen enkele vector- en curveberekeningen uitgevoerd.
De gewijzigde ingangsmodule, engine, wereld, controls, gebouwen en stylesheet
hebben lokale versie-URL's om oude Safari-modulecaches te vermijden.

### Testen

Open `http://localhost:8000/tests/browser.html`: 55 controles, inclusief alle
35 bestaande controles, 19 Journey-controles en één extra audio-Journey-test.
Controlepunten bij 30, 60 en 120 FPS hebben dezelfde positie en oriëntatie;
de route wordt op 120 samples per seconde gecontroleerd op gebouw- en
kernvrijheid, camera-roll en abrupte stappen. Tests dekken ook precies 90 s,
aanloop apart, twintig herstarts, handmatige en automatische moduswissels,
R, verborgen-tab-pauze, veilige omweg, onveilige start en eenmalige cleanup.

Open `http://localhost:8000/tests/audio-streaming.html` en klik de drie
knoppen achtereenvolgens zodra beschikbaar: zeven controles met de echte
lokale MP3's, inclusief behoud van beide lopende tijdlijnen bij Journey-start,
onderbreken en voltooiing. Deze audiotest gebruikt mastervolume nul.

Controleer zelf in de stad ook het geluidsbeeld met je eigen volume, een hele
Journey en onderbreken tijdens de aanloop en nabij de kern. Wissel tijdelijk
naar een ander tabblad en controleer dat de voortgang bij terugkeer hervat,
zonder verborgen tijd in te halen. Volume, mute en beeldkwaliteit blijven
bedienbaar. MP3's blijven lokaal en onder de bestaande `.gitignore`.

### Oplevercontrole fase 4B

Uitgevoerd in Safari via de bestaande localhost:8000-server: alle 55
regressiecontroles en alle zeven echte MP3-streamingcontroles geslaagd.
Ook de volledige zichtbare vlucht, automatische terugkeer, herstart vanaf het
eindpunt, onderbreken tijdens de aanloop, R en een verborgen-tab-pauze zijn
handmatig gecontroleerd. De HUD meldde tijdens deze sessie ongeveer 59–60 FPS
bij 10 drawcalls in balans; dit is een observatie, geen prestatiewinstmeting
ten opzichte van v0.4A of garantie voor andere vensterformaten.
De audioverificatie gebeurde op mute/mastervolume nul; beoordeel het hoorbare
ruimtelijke mengresultaat zelf met je eigen volume. Geen openstaande testfouten.

Toegevoegd: `js/journey/flight-modes.js`, `js/journey/journey.js`,
`js/journey/timed-path.js`, `js/worlds/neon-city/journey-route.js`,
`tests/journey.js`.

Gewijzigd: `index.html`, `style.css`, `js/main.js`, `js/engine.js`,
`js/controls.js`, `js/worlds/neon-city/buildings.js`,
`js/worlds/neon-city/world.js`, `tests/browser.js`, `tests/audio.js`,
`tests/audio-streaming.js`, `README.md`.

De audio-engine, audiobestanden, kernmodule, vloer en cameramodule blijven
ongewijzigd. `.gitignore` blijft ongewijzigd; beide MP3's worden nog genegeerd
en zijn niet opgenomen in Git. Geen commit, push of publicatie uitgevoerd.

## World Engine v1.0 — werkpakket 1

WP1 op branch `feature/world-engine-v1` vertrekt van v0.4B (`2528bd6`).
Camera-start, lens en omgeving staan nu in `js/worlds/neon-city/config.js`.
De engine valideert het wereldcontract; R gebruikt de actieve wereldpose.
`getAudioState()` levert een neutrale nabijheidsafstand aan de bestaande audio.
Neon City, Free Flight, Guided Journey en muziek blijven behouden.

Zie [WP1: wereldconfiguratie en wereldcontract](docs/world-engine/WP1_WERELDCONFIGURATIE.md)
voor het configuratievoorbeeld, API, bestandsoverzicht, tests en beperkingen.
De bestaande auditdocumenten beschrijven het eerdere vertrekpunt en zijn behouden.

## World Engine v1.0 — werkpakket 2

WP2 leest de twee Neon City-muziekbronnen uit de wereldconfiguratie en koppelt
de bediening via expliciete UI-adapters. Afstanden zijn per `distanceKey`
beschikbaar; momenteel zijn maximaal twee gelijktijdige bronnen toegestaan.
Zie [WP2: audio en gebruikersinterface](docs/world-engine/WP2_AUDIO_UI.md)
voor het contract, de testresultaten en de grenzen vóór WP3.
