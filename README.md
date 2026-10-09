# Neon City v0.2 — fase 2

Een lokale 3D-wireframe-stad met 108 reproduceerbare gebouwen, rastervloer,
een geanimeerde energiekern en subtiele zwevende lichtsporen. HTML, CSS en
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
