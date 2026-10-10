# World Engine — Architecture Audit v1.0

Datum: 10 oktober 2026. Geaudite basis: Neon City v0.4B, Git-commit `2528bd6` (`2528bd677e40fb9dd860a6d78dad827bb687250b`).

Dit document behandelt delen B–F van de opdracht. De ontwikkelretrospectieve, deel A, staat in [LESSONS_LEARNED_v1.0.md](LESSONS_LEARNED_v1.0.md).

## Executive summary

De huidige code is een goede basis voor een lichte World Engine. Renderer, vrije vlucht, Journey-interpolatie, nabijheidsrespons en audio zijn al afzonderlijke modules. De stad blijft in het gecontroleerde startbeeld op tien drawcalls. Er is geen buildproces, externe runtime-CDN, backend of zware postprocessing.

World 02 kan dezelfde cameramotor en renderer gebruiken. Dat kan nog niet volledig via alleen een nieuwe wereldmap: camera-reset, UI-selectors, audiosemantiek en wereld-lifecycle bevatten bestaande Neon City-aannames. Advies: **minimaal aanpassen en enkele verantwoordelijkheden gericht verplaatsen**, zonder een nieuw framework of volledige herschrijving.

Vóór World 02 zijn vooral een expliciet wereldcontract, wereldspecifieke camera/audio-instellingen, foutveilige wissels en integratietests nodig. Routes moeten gevalideerd worden. Voor prestaties is eerst een reproduceerbare meting nodig: de oorzaak van circa 30 FPS is onbekend.

## 1. Methode, scope en woordenlijst

Alle eigen JavaScript-modules en tests, HTML/CSS, README, lokale audio-informatie, `.gitignore` en de vijf fasecommits zijn onderzocht. De externe Three.js-distributie is op versie, WebGL-vereisten en licentie gecontroleerd; dit is geen interne audit van de complete bibliotheek. Geen applicatiecode of testcode is gewijzigd.

De bestaande browserregressie is tijdens de audit opnieuw uitgevoerd in Safari via de reeds draaiende Python-server: **55 controles geslaagd**, tien draws en 13.794 lijnsegmenten in het testbeeld. De echte audiotest en volledige Journey zijn hier alleen via code en het eerdere README-testrapport beoordeeld. Er zijn geen nieuwe geheugen- of GPU-metingen verricht.

- **Lifecycle:** de levenscyclus van een onderdeel: aanmaken, gebruiken, verwijderen.
- **Contract:** afspraken over welke instellingen en functies een module levert of verwacht.
- **Dependency:** een ander onderdeel waarop een module steunt, bijvoorbeeld Three.js, een camera of een HTML-knop.
- **Injectie:** zo'n dependency als argument doorgeven in plaats van haar intern op een vaste plek te zoeken.
- **Drawcall:** één tekenopdracht aan de GPU. Weinig drawcalls helpen, maar garanderen geen hoge FPS.
- **Overdraw:** meerdere transparante oppervlakken of lijnen kleuren dezelfde pixels opnieuw.
- **Idempotent opruimen:** een tweede `dispose()` veroorzaakt geen extra vernietiging of fout.

Een **vaststelling** is rechtstreeks uit code of tests afgeleid. Een **risico** beschrijft een nog niet praktisch aangetoond effect. De voorgestelde architectuur is toekomstig ontwerp, geen bestaande functionaliteit.

## 2. B — Huidige samenhang

```text
index.html + style.css
  └─ js/main.js
      ├─ createEngine(container, { onUpdate })
      │   ├─ Three.js Scene + WebGLRenderer + één frame-loop
      │   ├─ createCamera() + createControls()
      │   ├─ createFlightModes()
      │   │   └─ createJourney(route) → timed-path.js
      │   └─ world.init / world.update / world.dispose
      ├─ createNeonCity()
      │   ├─ gebouwen + grid + atmosfeer
      │   ├─ sphere.js → gedeelde createEnergyCore()
      │   │   └─ instellingen + createEnergyResponse()
      │   └─ createNeonCityRoute(gebouwvolumes)
      └─ createAudioManager() + createAudioPanel()
          ↑ world.getEnergyDistance() na world.update()
```

De audiomotor is geen onderdeel van de renderer; `main.js` verbindt beide. Dat is goed. De engine beheert cameramodi, maar het huidige modusbeheer bevat daarnaast UI-code. De gedeelde engine importeert geen Neon City-objectgeneratoren; de bootstrap kiest wel rechtstreeks `createNeonCity()`.

### 2.1 Rendering en 3D-engine

**Bestand/functies:** `js/engine.js`: `createEngine()`, `frame()`, `resize()`, `setWorld()`, `start()`, `dispose()`.

**Verantwoordelijkheid en dependencies:** bezit de scène, renderer, centrale lus, camera, controls en flight modes. Gebruikt Three.js, `window`, `document`, het container-element en vaste UI-selectors. `onUpdate` laat de bootstrap audio koppelen zonder dat de engine audiobestanden kent.

**Beoordeling:** de enkele renderloop en aparte wereld-interface zijn sterk. `start()` voorkomt dubbele lussen zolang de engine niet verwijderd is. Pixelratio is begrensd; er zijn drie renderstanden. Onderhoud wordt lastiger omdat kwaliteit, statusmelding, performance-HUD en canvasfocus in dezelfde functie staan als rendering. Afmetingen komen van het volledige venster, niet van de meegegeven container.

**Prestatie-impact:** antialiasing en framebufferresolutie kunnen GPU-kosten verhogen. Een `Float32Array(240)` bewaart frametijden; eens per seconde wordt een kleine array gesorteerd voor P95. Dat is codewerk, geen vastgesteld knelpunt.

**Verbeterpunten:** injecteer instellingen/UI-callbacks; maak `setWorld()` een expliciete lifecycle-operatie. Momenteel wordt de oude wereld vernietigd vóór de nieuwe succesvol is geïnitialiseerd. Er is geen rollback of aparte veilige foutstand. Journey stoppen gebeurt pas na `next.init()`. `dispose()` heeft geen disposed-guard; daarna zijn `start()` en `setWorld()` nog aanroepbaar. Dit zijn vastgestelde API-hiaten, geen waargenomen crash in de normale Neon City-flow. WebGL-contextverlies stopt de loop en vraagt herladen; automatisch herstel is niet aanwezig.

### 2.2 Camera en Free Flight

**Bestanden/functies:** `js/camera.js`: `createCamera()`, `resetCamera()`; `js/controls.js`: `createControls()`, `update()`, `reset()`, `setEnabled()`, `getVelocity()`, `dispose()`.

**Verantwoordelijkheid en dependencies:** camera maakt een perspectiefcamera; controls vertalen toetsen en optionele muisdrag naar beweging. Dependencies zijn Three.js, de camera, canvas, browser-events en vaste muis/resetknoppen. Reset importeert rechtstreeks de vaste startpose uit `camera.js`.

**Beoordeling:** zachte versnelling, normalisatie van diagonale input, formulierelement-uitsluiting en opruimen van toetsen bij focusverlies zijn goed. Hergebruikte vectors beperken tijdelijke objecten. `setEnabled(false)` voorkomt dubbele camera-aansturing tijdens een Journey. De huidige formule hoeft voor World 02 niet te worden herschreven.

**Herbruikbaarheid/onderhoud:** beperkt door FOV 66, near/far 0,15/650, pose `[0,7,62]`, snelheid 22, yaw-snelheid 1,05 en demping 5 in code. De browser-UI is impliciet vereist. Het besturingssysteem wordt gedeeld zodra pose/instellingen en knoppen expliciet worden doorgegeven.

**Prestatie en testgrens:** de exponentiële integraal is exact voor constante gewenste input per frame. Tijdens gecombineerd draaien en bewegen verandert de richting binnen een frame; de huidige straight-flight-FPS-test bewijst niet volledige gelijkheid voor die combinatie. Dit is een numeriek risico, geen vastgestelde hinder. Free Flight heeft bewust geen botsingsdetectie.

### 2.3 Journey, timing en routes

**Bestanden/functies:** `js/journey/flight-modes.js`: `createFlightModes()`; `journey.js`: `createJourney()`; `timed-path.js`: `createTimedPath()`, `createEntryPath()`, `ease()`; `js/worlds/neon-city/journey-route.js`: `createNeonCityRoute()`, `isSafe()`, `planEntry()`.

**Verantwoordelijkheid/dependencies:** timed-path maakt curves en tijdmapping; Journey schrijft positie/oriëntatie naar de camera; flight modes kiest de eigenaar van de camera. Alleen de wereldroute kent gebouwen en kern. De motor steunt op Three.js en het routecontract; flight modes steunt ook op DOM, zichtbaarheid en controls.

**Beoordeling:** afzonderlijke positie- en kijkdoelcurves, tijdgebaseerde sampling en snelheidsoverdracht zijn direct bruikbaar. De aanloop telt niet mee in de route van 90 seconden. Verborgen tabs worden via zichtbaarheid en de centrale klok gepauzeerd. Herstart, onderbreken en opruimen zijn getest. Er wordt geen audio aangeroepen bij een moduswissel.

**Onderhoudbaarheid:** de route-interface is informeel. Er is geen controle op minimaal twee punten, eindtijd gelijk aan duur, stijgende tijdstippen, eindige coördinaten of een geldig aanlooppad. Dubbele tijden kunnen een deling door nul veroorzaken. Dat is een vastgestelde ontbrekende validatie; de huidige route is geldig. De voortgang gebruikt de route-duur, maar de tekst bevat letterlijk `90 s`. `createEntryPath()` heeft vaste minimumduur 2,5 en snelheidsschaal 16: afstemmen op een andere wereldschaal vraagt nu codeaanpassing.

**Prestatie/safety:** per frame worden een paar curveposities berekend, waaronder twee voor een numerieke snelheid. `getState()` maakt kleine snapshots. Aanloopplanning scant 108 boxes, segmenten om de 0,4 units en de curved entry om de 0,04 seconde. Dit gebeurt bij starten, niet elk frame. Een extreem verre start kan veel synchroon werk vragen; dat is een mogelijk stall-risico, niet gemeten.

De veiligheid is conservatief en gesampled, geen continue botsingsgarantie. Het kerncentrum `[0,19,-82]`, veiligheidsradius 13,5 en vloergrens zijn wereldgegevens. De huidige marge houdt rekening met de kernbeweging, maar volgt een later verplaatste of grotere kern niet automatisch. De vaste route wordt in tests gecontroleerd, niet bij iedere start opnieuw tegen de hele geometrie. Bij falen van de entry met beginvelocity wordt een nulvelocity-entry geprobeerd. Daardoor kan snelheid toch abrupt stoppen; `getVelocity()` staat onmiddellijk na `start()` nog op de oorspronkelijke velocity. Deze fallback is een code-afgeleid randgeval, niet gedekt door de geslaagde velocity-test.

Kijkrichting gebruikt Euler `YXZ` en nul roll. Dat werkt voor de huidige route. Nieuwe routes die recht omhoog kijken, dezelfde positie en target hebben of door een oriëntatiesingulariteit gaan verdienen aparte tests; een algemene oriëntatiemotor is nog niet bewezen.

### 2.4 Audio-engine en afstandsmuziek

**Bestanden/functies:** `js/audio/audio-manager.js`: `createAudioManager()`, `initialize()`, `start()`, `pause()`, `updateDistance()`, `dispose()`; `audio-settings.js`: `AUDIO_SETTINGS`, `coreMixAtDistance()`; `audio-panel.js`: `createAudioPanel()`.

**Verantwoordelijkheid/dependencies:** één AudioContext, twee HTMLAudioElements, twee bronnen, twee laag-gains en één mastergain. Settings en factories zijn injecteerbaar; het paneel verwacht de bestaande DOM. `main.js` levert de actuele 3D-kernafstand na de wereld-update.

**Beoordeling:** goede onafhankelijkheid tussen tijdlijnen en mix, expliciete gebruikersactie, smoothstep, Web Audio-demping, mute zonder pauze en hergebruik van context/bronnen. Timers en generatie-tokens beschermen start/stop-resultaten. Start heeft een timeout en errors geven een zichtbare melding. Disposal is idempotent en ontkoppelt nodes.

**Herbruikbaarheid:** bestanden en gains zijn via overrides te vervangen. De motor kent wel exact `city` en `core`; UI en settings zijn naar de kern genoemd. Voor twee vergelijkbare lagen in World 02 volstaat beperkte generalisatie naar ambient/proximity en wereldconfiguratie. Een systeem voor onbeperkt veel bronnen is nu niet nodig. `coreMixAtDistance()` is als zuivere functie direct herbruikbaar.

**Prestaties/geheugen:** de app decodeert geen complete composities naar AudioBuffers. De browser beheert buffering en decoding van twee media-elements; browsergeheugen is niet gemeten. Gain-automatisering gebruikt een tolerantiedrempel, maar plant bij veranderende afstand nieuwe targets; groei of CPU-kosten zijn niet geprofileerd. Pauze houdt de context bewust stil draaiend voor veilig hervatten in Safari.

**Verbeterpunten:** huidige initialization heeft geen rollback als het aanmaken van een node/bron halverwege faalt. `context` bestaat dan al, waardoor een volgende `initialize()` vroeg terugkeert. Dit is een bevestigd ontbrekend herstelpad, geen tijdens de audit nagebootste browserfout. Volumes en timeout-overrides zijn minder volledig gevalideerd dan de afstandsgrenzen. Defaults voor audio en kern hebben dezelfde 90/12-afstanden, maar verschillende demping en doelen: ze hoeven niet één formule te worden. De app bevat geen PannerNode; “ruimtelijk” betekent hier uitsluitend afstandsmix. Gapless loops en hoorbare klikvrijheid blijven onbewezen.

### 2.5 Interactieve objecten en energiekern

**Bestanden/functies:** `js/objects/energy-core.js`: `createEnergyCore()`, `applyVisuals()`, `getDistance()`, `getInteractionState()`, `update()`, `dispose()`; `energy-response.js`: `createEnergyResponse()`; `energy-core-settings.js`: `resolveEnergySettings()`; wereldwrapper `sphere.js`: `createSphere()`.

**Verantwoordelijkheid/dependencies:** object maakt en bezit eigen geometrie, materialen en een lokaal gegenereerde 128 × 128-gloedtexture. Respons kent alleen settings en afstand. Wrapper bepaalt plaatsing. Object kent camera/Three.js en gebruikt een browsercanvas voor de texture, maar geen UI, audio of wereldnavigatie.

**Beoordeling:** sterkste herbruikbare visuele component. Wereldpositie van camera en kern telt mee, ook onder een parent-transformatie. Settings ondersteunen gedeeltelijke nested overrides. State-naam is beschrijvend; visuele waarden volgen continu. De callback is maximaal ongeveer tien keer per seconde bedoeld en vormt een klein uitbreidingspunt.

**Prestaties/onderhoud:** vijf draws: shell, twee orbitbundels, gloed en midden. Orbitzichtbaarheid gebeurt in de shader via één uniform, zonder geometrie per frame opnieuw te uploaden. Tijdelijke constructiegeometrie wordt opgeruimd. De gloed wordt bij het centrum begrensd om een schermvullende flits te vermijden.

**Verbeterpunten:** `onBeforeCompile` vervangt letterlijke shadertekst uit Three.js. De vastgezette r180-versie beperkt het risico; een library-upgrade kan deze vervanging stil breken. Niet iedere kleur-, pulse-, callback- of brightness-override is gevalideerd. De kern bezit zijn resources momenteel exclusief; voeg geen cache toe zonder eerst gedeeld resource-eigenaarschap te regelen. `energy-response.js` is geschikt voor de gedeelde engine; de artistieke energiekern is een optionele gedeelde effectmodule, geen verplicht wereldonderdeel.

### 2.6 Wereldbeheer en lifecycle

**Bestanden/functies:** `js/worlds/neon-city/world.js`: `createNeonCity()`, `init()`, `update()`, `getJourneyRoute()`, `getEnergyDistance()`, `dispose()`; objectfactories in `buildings.js`, `grid.js`, `atmosphere.js`, `sphere.js`.

**Verantwoordelijkheid/dependencies:** wereld bezit een root-group, stadsobjecten en route. Bepaalt achtergrond/mist op de engine-scène. Gebouwen maken ook 108 conservatieve boxes voor routeplanning. Atmosfeer heeft een eigen tijduniform; wereld verzorgt haar update en cleanup.

**Beoordeling:** `init/update/dispose` en de getters ondersteunen een tweede wereld op hoofdlijnen. `dispose()` laat eerst de kern zichzelf verwijderen en opruimen; daarna worden resources van de overige root verzameld in Sets. **De kern wordt hierdoor niet dubbel opgeruimd.** Herinitialiseren na dispose is getest.

**Vastgestelde beperkingen:** `dispose()` herstelt `scene.background` en `scene.fog` niet. Een volgende wereld die geen mist instelt erft de Neon City-mist. `init()` is niet beschermd tegen een tweede oproep zonder dispose; bestaande kinderen blijven dan aanwezig en oude objectreferenties worden overschreven. Algemene texture-cleanup kijkt alleen naar `material.map`; toekomstige andere texture-slots of shaderuniform-textures vragen eigen eigenaarschap. `createAtmosphere()` levert zelf geen dispose; dat is nu correct omdat de wereld eigenaar is, maar niet expliciet als componentcontract vastgelegd.

`getEnergyDistance()` is betekenisvol voor Neon City. World 02 hoeft geen energiekern te hebben; gebruik later een neutralere interactie-/audio-output. Een generator voor wireframe-gebouwen, deze vloer en deze atmosfeer zijn inhoud van Neon City, ook al kunnen losse technieken opnieuw worden gebruikt.

### 2.7 Configuratie en instellingen

**Bestanden:** `energy-core-settings.js`, `audio-settings.js`, `journey-route.js`, `camera.js`, `controls.js`, `engine.js`, objectgeneratoren en `world.js`.

**Beoordeling:** kernsettings en audiocurve zijn duidelijk, met eenheden en begrenzing. Daarbuiten zijn settings verspreid. Camera, reset, route, kernplaatsing en safety moeten handmatig overeenkomen. Renderkwaliteiten, seed, stadsafmetingen, palette en mist staan in factories.

**Dependency/onderhoud:** configuratie moet naar een gewone wereldbeschrijving gaan, met kleine engine-defaults. Gebruik geen allesomvattend configuratiebestand. Camera-pose, omgeving, route en audiobestanden zijn wereldspecifiek; algemene input- en renderdefaults mogen gedeeld zijn. Valideer bij laden, niet elke frame. Dit levert voorspelbaarheid zonder noemenswaardige framekosten.

### 2.8 Gebruikersinterface

**Bestanden:** `index.html`, `style.css`, `audio-panel.js`, UI in `flight-modes.js`, `controls.js` en `engine.js`.

**Beoordeling:** gewone toegankelijke knoppen, labels, volume-input, canvasfocus en ingetogen voortgang zijn passend. Audio en Journey beperken hun UI-updates tot ongeveer vijf keer per seconde. Knoptekst wordt alleen bij wijziging vervangen.

**Modulariteit/herbruikbaarheid:** de audio-UI is een adapter boven de motor. Journey-UI en moduslogica zijn nog vermengd; controls bevatten toggle/reset-UI. Selectors en het opschrift “3D-stad” zijn gekoppeld aan de huidige pagina. Het paneel blijft bovenaan “VRIJE VLUCHT” noemen tijdens een Journey; een kleine huidige presentatiediscrepantie, geen vluchtfout. De `role=status`-melding verandert elke seconde tijdens een Journey en kan bij hulptechnologie veel aankondigingen geven; dat is een niet geteste toegankelijkheidsvraag.

**Verbeterpunten:** geef UI-elementen/callbacks door, gebruik wereldtitel uit configuratie en echte route-duur in tekst. Responsiveness bestaat gedeeltelijk maar smartphonebediening is bewust geen bewezen functionaliteit. De engine kan na loskoppelen van selectors ook met een andere pagina-indeling werken.

### 2.9 Tests en foutafhandeling

**Bestanden:** `tests/browser.html`, `browser.js`, `energy-core.js`, `audio.js`, `journey.js`, `audio-streaming.html`, `audio-streaming.js`; fouten in `main.js`, `engine.js` en `audio-manager.js`.

**Wat goed is:** geen testframework of installatiestap nodig. De suite controleert zes richtingen, reset, focus, seed, lijnvaliditeit, resources, shaders, kernrespons, route, FPS-sampling, audiotijdlijnlogica en idempotente cleanup van kern/audio/Journey. Echte MP3's worden afzonderlijk en stil getest na een klik. Bootstrap vangt import- en opstartfouten; audiofalen hoeft de wereld niet uit te schakelen.

**Beperkingen:** static imports op de testpagina staan buiten de `try`; een ontbrekende testmodule kan “Bezig…” laten staan. De globale `try` stopt vervolgtests na een onverwachte exception. Fake gains voeren automatisering niet echt uit en de fake media-tijd blijft constant. De echte streamingtest observeert enkele seconden, niet complete composities. Cleanup-tests tellen dispose-events, geen GPU- of heaptrend. De verborgen-tab-test injecteert een EventTarget; zij bewijst niet alle Safari-levenscyclusgevallen. De engine zelf wordt niet direct geïntegreerd getest, evenmin echte A→B→A-wissels, muisdrag of gecombineerd draaien/vliegen.

**Foutpaden:** `main.js` ruimt engine op bij een opstartfout, maar niet de eerder gemaakte audio-manager/panel. Wanneer `createEngine()` vóór return faalt, is de lokale engine nog niet aan `main.js` toegewezen: interne partial resources hebben geen gegarandeerd cleanup-pad. `pagehide` met `persisted=true` pauzeert audio voor de back/forward-cache; een specifieke `pageshow`-handler ontbreekt. Werkelijke effecten hiervan zijn nog niet in een bfcache-test vastgesteld. Een exception in een frame heeft geen eigen gecontroleerde afhandeling.

## 3. C — Inventaris en herbruikbaarheid

A betekent direct inzetbaar binnen dezelfde browser/Three.js-basis en met geldige argumenten. B betekent een kleine aanpassing aan contract, configuratie of UI-koppeling. C betekent Neon City-inhoud, geen noodzakelijke enginefunctie.

| Component / bestand | Klasse | Bestemming en reden |
| --- | --- | --- |
| Lokale `lib/three/three.module.js`, `three.core.js`, `LICENSE` | A | Gedeelde library; versie en licentie samen behouden. |
| `createEnergyResponse()` | A | Gedeelde nabijheidslogica met aangeleverde settings; geen DOM/scene. |
| `coreMixAtDistance()` | A | Gedeelde afstandscurve met expliciete settings. |
| `createTimedPath()` en `ease()` | A | Gedeelde traject-/interpolatiehelpers bij geldig routecontract. |
| `createJourney()` | A | Gedeelde cameramotor voor huidige no-roll-routes; verwacht route-interface. Validatie kan bij laden toegevoegd worden. |
| `createEnergyCore()` en zijn settings | A | Optionele gedeelde effectbibliotheek; browsercanvas en Three.js nodig, artistieke vorm blijft een kern. |
| `createEntryPath()` | B | Gedeelde aanloophelper; duur/snelheid instelbaar maken voor andere schalen. |
| `createEngine()` | B | Gedeelde renderer/lus; UI, lifecycle en instellingen expliciteren. |
| `createCamera()` / `resetCamera()` | B | Gedeelde camerafactory; wereldpose/lensparameters ontvangen. |
| `createControls()` | B | Gedeelde Free Flight; settings/reset/UI injecteren. Bewegingsformules behouden. |
| `createFlightModes()` | B | Gedeeld modusbeheer; UI-adapter apart en echte route-duur gebruiken. |
| `createAudioManager()` / AUDIO_SETTINGS | B | Gedeelde tweelaagsaudio, neutrale rollen en wereldinstellingen. |
| `createAudioPanel()` | B | Gedeelde UI-adapter; elementen/labels injecteren. |
| `main.js` | B | App-bootstrap; wereldselectie en audio/lifecycle-koppeling generaliseren. |
| `index.html` en `style.css` | B | Gedeelde paginaschil/panelen; titel, labels en wereldstijl apart. |
| `createNeonCity()` / `world.js` | C | Individuele wereld, compositie en omgeving. Lifecycle-patroon is herbruikbaar. |
| `buildings.js`, inclusief seed/boxes | C | Specifieke stedelijke geometrie. Batching/seed-techniek kan elders gebruikt worden. |
| `grid.js` | C | Huidig Neon City-raster met vaste maten/offset; later pas delen als tweede gebruik ontstaat. |
| `atmosphere.js` | C | Huidige lichtsporen, kleuren, afmetingen en shader. Effect is te parametriseren, maar niet vooraf verplicht delen. |
| `sphere.js` | C | Plaatsingswrapper voor de kern in Neon City. |
| `journey-route.js` | C | Neon City-route, kijkdoelen en veiligheid. |
| Beide lokale MP3's | C | Wereldcontent, apart overdragen en buiten Git houden. |
| `tests/browser.js` en testpagina's | B | Gedeelde browserrunner/checks scheiden van Neon City-fixtures. |
| `tests/energy-core.js` | A | Tests voor gedeeld effect/response; lokaal Three.js-renderer nodig. |
| `tests/audio.js` | B | Algemene audio-checks behouden; Journey-fixture kent nu Neon City. |
| `tests/journey.js` | B | Motorchecks delen; routeveiligheidschecks blijven wereldspecifiek. |
| `tests/audio-streaming.js` | B | Browser/media-test met configureerbare bestanden en routefixture. |
| `.gitignore`, root README, `assets/audio/README.md` | B | Projectafspraken behouden en uitbreiden voor nieuwe wereldassets; audio-uitsluiting is nu alleen bestanden direct in deze map; nieuwe submappen vragen aangepaste uitsluiting. |
| `Neon_City_Fase_1_Codex.md` en auditdocumenten | C | Projecthistorie/documentatie; geen runtime-engine. |

**Kan World 02 vandaag worden toegevoegd?** Een factory met `init/update/dispose` en een route volgens dezelfde interface kan in principe door `setWorld()` worden geladen. De kern hoeft niet opnieuw geprogrammeerd te worden. Voor een andere camera-start, muziek, omgeving zonder mist en eigen UI zijn echter aanvullende bootstrap/contract-aanpassingen nodig. Twee werelden achtereenvolgens veilig wisselen is nog niet aangetoond. Er is geen behoefte aan een tweede renderer of tweede animatielus.

## 4. D — Prestaties, geheugen en technische schuld

### 4.1 Wat we weten en wat we niet weten

| Bewijs | Resultaat | Reikwijdte |
| --- | --- | --- |
| Code en v0.2-diff | Gebouwen drie batches; kernringen zeven → twee batches; nulsegmenten verwijderd; hergebruikte vector. | Concrete vermindering van werk; geen afzonderlijk gemeten tijdwinst. |
| Framebufferberekening | Bij dezelfde viewport en DPR minstens 1,5: `1 − (1,25/1,5)² ≈ 30,6%` minder pixels. | Alleen pixelbelasting; geen garantie op 30,6% snellere rendering. |
| Historische README v0.1 | Circa 30 FPS, 14 draws. | Korte waarneming. |
| Historische README v0.2/v0.3 | Circa 30 FPS, tien draws; ook lichte stand circa 30. | Geen bewezen FPS- of P95-winst. |
| Historische README v0.4A | Kort 26 FPS bij starten, daarna circa 30 bij audio/vliegen. | Geen audio-CPU-profiel of langdurige daling bewezen. |
| Historische README v0.4B | Circa 59–60 FPS, tien draws tijdens de sessie. | Niet gecontroleerd vergelijkbaar met eerdere fasen. |
| Audit: bestaande regressie opnieuw | 55 PASS; tien draws; 13.794 lijnsegmenten bij 200 × 150. | Functionele/rendercontrole, geen fullscreen-benchmark. |

Tijdens openen van Safari voor de audit was ook een HUD-waarneming van 60 FPS zichtbaar. Die losse waarde is evenmin een benchmark. Er is geen gemeten geheugengroei, afzonderlijke CPU/GPU-tijd of bewezen oorzaak voor circa 30 FPS.

### 4.2 Rendering en resourcebeheer

Tien draws in het testbeeld zijn verklaarbaar: gebouwen 3, grid 1, atmosfeer 1, kern 5. Frustum-culling kan elders minder objecten laten tekenen. De drie gebouwbatches hebben grote gezamenlijke grenzen, waardoor een deels zichtbare batch als geheel getekend kan worden. Op deze schaal is dat een redelijke eenvoud/efficiëntie-afweging; ruimtelijk opdelen kan pas na profiling verantwoord worden.

Vrijwel alles is transparant met `depthWrite:false`. Dat past bij wireframe-kunst maar kan overdraw veroorzaken. Mist verandert zichtbare kleur/alpha en is geen garantie dat verborgen geometrie niet wordt verwerkt. De geanimeerde atmosfeer wijzigt alleen een uniform; de vergrote bounding sphere houdt haar beweging binnen de cullinggrens. Geen schaduwmappen, realtime lampberekeningen of postprocessing.

Het geometriegeheugen bestaat vooral uit Float32Buffers. Een berekening van alleen de position-arrays van de gerapporteerde 13.794 lijnsegmenten is `13.794 × 2 × 3 × 4 = 331.056 bytes`. Dit is **geen totaalgeheugenmeting**: overige attributes, mesh/spritegegevens, indexes, framebuffer, driverkopieën, JavaScript-objecten en audio ontbreken. MP3-bestandsomvang zegt evenmin hoeveel geheugen de browser gebruikt. De kleine gloedtexture kan per kern worden aangemaakt; gedeelde caching is pas zinvol als er meerdere kernen zijn.

### 4.3 Klokken, beweging en audio

`frame()` gebruikt rawDelta voor Journey en begrenst worldDelta tot 0,05 seconde; Free Flight begrenst zelf ook tot 0,05. Bij 30/60/120 FPS overschrijdt een normale frame deze grens niet. Bij een stall of minder dan 20 FPS loopt de wereldanimatie trager dan Journey-kloktijd. Audio heeft haar eigen AudioContext/media-klok. Verborgen tabs pauzeren visuele update, terwijl muziek volgens de huidige keuze kan doorlopen. Dit is een bewuste asynchronie voor tabwissels, maar geen gedeeld klokbeleid voor alle omstandigheden.

Drie wereldbrede allocation-bronnen zijn kleine state-snapshots, de P95-array eens per seconde en UI-uitlezingen. Er is geen bewijs dat zij merkbare garbage-collection-stalls veroorzaken. Begin niet met pools voor zulke kleine objecten zonder meting. De synchrone route-aanloopplanner en audio-initialisatie verdienen afzonderlijke startmetingen.

### 4.4 Browsercompatibiliteit

De lokale `three.core.js` vermeldt revision 180. `three.module.js` documenteert en controleert dat WebGL 1 sinds r163 niet ondersteund wordt: WebGL 2 is dus nodig. De app gebruikt ES-modules, top-level await, `Array.at`, AbortController-listeners en Web Audio/media-elements. De huidige Safari-regressie slaagt; er is geen tijdens deze audit uitgevoerde Chrome/Firefox- of minimumversiematrix.

Audio gebruikt een `webkitAudioContext`-fallback en een fallback wanneer `cancelAndHoldAtTime` ontbreekt. Dat zijn nuttige compatibiliteitsvoorzieningen, geen garantie voor alle oude Safari-versies. Bestanden openen via `file://` is niet de ondersteunde startwijze. De Python-server is lokale bestandshosting, geen toepassingsbackend.

Contextverlies vraagt herladen. Back/forward-cache, lange slaap, audio-interruption en device-pixelratio-wissels verdienen aparte checks. Er is geen bewezen algemene browserbug of geheugenlek.

### 4.5 Mogelijke oorzaken van circa 30 FPS — onderzoeksplan

Onderstaande punten zijn **hypothesen**, geen diagnose:

| Mogelijkheid | Gerichte controle |
| --- | --- |
| Veel pixels, antialiasing of transparante overdraw | Zelfde route/venster in licht, balans, scherp; vergelijk mediane/P95-frametijden. Tijdelijk effect uitschakelen alleen in een latere geautoriseerde meetvariant. |
| Browser-/display-/energieplanning | Noteer Safari/OS-versie, refresh rate, stroomstatus, energiemodus en andere belasting; controleer zonder die settings nu automatisch te wijzigen. |
| CPU- of start-stall | Profiel rond `Journey.start()` en audio-start, apart van de stabiele vlucht. |
| Audio-buffering/decoding | Vergelijk dezelfde vlucht audio uit/aan, met dezelfde files en tijdvensters. |
| Warme shaders, thermiek of achtergrondwerk | Na warming-up meerdere runs van minstens 60 seconden; identieke omstandigheden vastleggen. |

P95 is de frametijd waaronder 95% van de samples valt. De HUD heeft hoogstens 240 samples: ongeveer acht seconden bij 30 FPS en vier seconden bij 60 FPS. Dat is geen minuutrapport en geen pure GPU-tijd. Meet CPU en GPU apart waar de beschikbare Safari-tools dat toelaten. Er is nu geen onderbouwde noodzaak voor instancing, nieuwe postprocessing of automatische kwaliteitsschaling.

### 4.6 Prioriteiten van technische schuld

| ID | Vastgestelde schuld / risico | Impact | Moeilijkheid | Vóór World 02? |
| --- | --- | --- | --- | --- |
| R1 | Onvolledig wereldcontract: reset, omgeving, wisselvolgorde en foutpad | Hoog bij tweede wereld | Middel | Essentieel |
| R2 | Vaste stad/kern-audio en geen wereld-audio-lifecycle | Hoog bij andere muziek/wereld | Middel | Essentieel |
| R3 | Verborgen DOM-contract en Journey-UI in moduslogica | Middel | Laag–middel | Essentieel |
| R4 | Geen routevalidatie; gemengde klokken en snelheid-fallback | Middel–hoog bij andere routes/stalls | Middel | Essentieel |
| R5 | Partial-init/disposed/bfcache-paden en ontbrekende engine-wisseltests | Hoog in fout- en wisselgevallen | Middel | Essentieel |
| R6 | Geen vergelijkbare performancebaseline | Middel, oorzaak 30 FPS onbekend | Laag–middel | Vóór harde prestatieclaims; nuttig nu |
| R7 | Verspreide settings, versiesuffixen, beperkte overridevalidatie | Middel | Laag–middel | Relevante wereldsettings via R1/R2; rest later |
| R8 | Generieke cleanup dekt alleen map; shaderpatch versiegevoelig | Middel bij gedeelde assets/upgrades | Laag–middel | Expliciet eigenaarschap nu; pooling/upgrade later |
| R9 | Geen binaurale panning/audio-reactiviteit/portalen | Toekomstige kans, geen huidige fout | Middel–hoog | Bewust uitstellen |
| R10 | Geen algemene physics, pluginplatform of adaptieve renderpipeline | Toekomstige kans, geen huidige fout | Hoog | Bewust uitstellen |

Deze IDs zijn dezelfde tien aanbevelingen als in deel F. Er worden geen extra, los geprioriteerde projecten aan toegevoegd.

## 5. E — Voorstel World Engine v1.0

### 5.1 Kleine reorganisatie met behoud van gedrag

Behoud de factories en ES-modules. Verplaats pas na goedkeuring renderer/camera/controls naar een kleine engine-map; behoud de bestaande Journey- en audioformules. Verplaats vaste UI-bindingen naar adapters. Maak één wereldregistry met expliciete lokale imports. Geen automatisch zoeken naar bestanden, inheritance-framework, eventbus of dependency-container.

Een aanbevolen toekomstige structuur is:

```text
neon-city/                         # portable projectmap; naam hoeft nu niet te veranderen
├─ index.html
├─ style.css                      # gedeelde paginaschil
├─ lib/three/                     # lokale, vastgezette distributie + LICENSE
├─ js/
│  ├─ main.js                     # bootstrap en koppeling van systemen
│  ├─ worlds.js                   # expliciete registry met lokale factories
│  ├─ engine/
│  │  ├─ engine.js                # scene, renderer, één loop, activeren/verwijderen
│  │  ├─ camera.js                # camera + configureerbare resetpose
│  │  ├─ controls.js              # input/beweging; geen vaste paneelselectors
│  │  └─ settings.js              # kleine gedeelde render/input-defaults
│  ├─ journey/
│  │  ├─ flight-modes.js          # camera-eigenaarschap
│  │  ├─ journey.js               # gedeelde motor
│  │  └─ timed-path.js            # timing/interpolatie
│  ├─ audio/
│  │  ├─ audio-manager.js         # twee configureerbare lagen + master
│  │  └─ audio-settings.js        # algemene defaults en afstandscurve
│  ├─ ui/
│  │  ├─ flight-panel.js          # huidige controls/Journey-knoppen
│  │  └─ audio-panel.js
│  ├─ objects/
│  │  ├─ energy-core.js           # optioneel effect, niet in elke wereld verplicht
│  │  ├─ energy-response.js
│  │  └─ energy-core-settings.js
│  └─ worlds/
│     ├─ neon-city/
│     │  ├─ config.js             # titel, pose, omgeving, audio, plaatsingen
│     │  ├─ world.js
│     │  ├─ journey-route.js
│     │  └─ buildings.js, grid.js, atmosphere.js, sphere.js
│     └─ world-02/
│        ├─ config.js
│        ├─ world.js
│        ├─ journey-route.js
│        └─ ... eigen inhoud
├─ assets/audio/                  # bestaande lokale muziek; geen verplichte verhuizing
│  └─ README.md
├─ tests/
│  ├─ browser.html               # bestaande eenvoudige runner
│  ├─ browser.js
│  ├─ engine-lifecycle.js         # toekomstige A→B→A- en fouttests
│  ├─ journey.js, audio.js, energy-core.js
│  ├─ audio-streaming.html, audio-streaming.js
│  └─ worlds/                    # route-/inhoudchecks per wereld
│     ├─ neon-city.js
│     └─ world-02.js
└─ docs/audit/
```

Dit is uitsluitend een ontwerp. De genoemde nieuwe config-, registry-, UI- en testmodules zijn niet aangemaakt. Imports moeten bij een latere verhuizing worden aangepast en regressietests moeten hetzelfde gedrag blijven bevestigen. Losse helpers pas in een aparte map zetten wanneer meerdere echte gebruikers bestaan.

### 5.2 Wie bezit welk systeem?

| Onderdeel | Eigenaar | Wat blijft wereldspecifiek? |
| --- | --- | --- |
| Renderer, scene, lus, zichtbaarheid, diagnostics | Gedeelde engine | Achtergrond/mist als gegevens, niet een tweede renderer. |
| Camera en Free Flight | Gedeelde engine | Startpose, lens, snelheidsafstemming. |
| Journey-motor en flight modes | Gedeeld | Tijdpunten, posities, targets, aanloop/safety. |
| AudioContext, mastervolume/mute, tweelaagsmix | Gedeelde app/audio | Bestanden, laagvolumes, nabijheidsdrempels en afstandsbron. |
| UI-panelen en events | Gedeelde adapters | Wereldtitel, eventuele labels en stijlaccenten. |
| Geometrie, materialen, textures, objectanimatie | Individuele wereld of expliciete objectfactory | Compositie en artistieke inhoud. |
| Interactieve energiekern | Optionele gedeelde objectfactory | Plaatsing en overrides per wereld. |

De wereld vernietigt geen renderer of gedeelde audio-context. De engine vernietigt geen materiaal dat volgens afspraak door een andere actieve eigenaar wordt gebruikt. De huidige wereldresources zijn exclusief eigendom; dat model behouden is eenvoudiger dan meteen referentietelling toevoegen.

### 5.3 Wereldbeschrijving en configuratie

Een registry-item kan conceptueel deze informatie bevatten:

```javascript
// Voorstel van gegevensvorm; geen huidige runtime-API.
{
  id: 'neon-city',
  title: 'Neon City',
  createWorld: createNeonCity,
  camera: { position: [0, 7, 62], rotation: [0.018, 0, 0],
            fov: 66, near: 0.15, far: 650 },
  environment: { background: 0x0b0616,
                 fog: { type: 'exp2', color: 0x0b0616, density: 0.006 } },
  audio: {
    ambient: { url: './assets/audio/city-ambient.mp3', gain: 0.55 },
    proximity: { url: './assets/audio/energy-core.mp3', gain: 0.45,
                 fadeStartDistance: 90, fullVolumeDistance: 12 }
  }
}
```

De root-bootstrap kan URLs relatief aan de pagina gebruiken zoals nu; als configuratie vanuit een andere URL moet werken, maak asset-URLs expliciet via `new URL(..., import.meta.url)`. Documenteer één conventie. Een geconfigureerde lege audiolaag betekent geen bron, geen kapotte fictieve MP3. Een wereld zonder mist krijgt expliciet `fog:null`; “niet opgegeven” mag geen oude mist behouden.

Behoud het kleine wereldcontract waar mogelijk:

| Functie | Afspraak voor v1.0 |
| --- | --- |
| `init(scene)` | Maakt/voegt eigen wereldobjecten toe, één keer per actieve instance; bij falen moet gedeeltelijke cleanup mogelijk zijn. Omgeving wordt door activatieconfig aangebracht. |
| `update(dt, camera)` | Werkt eigen animaties en actuele interactiewaarden bij; start geen lus. |
| `getJourneyRoute()` | Optioneel geldig routeobject; geen route betekent Guided-knop niet beschikbaar. |
| `getAudioState()` | Voorgestelde neutrale output, bijvoorbeeld `{ proximityDistance }`; zonder bron Infinity/stil. Vervangt later de naam `getEnergyDistance()`. |
| `dispose()` | Verwijdert eigen root/resources/listeners; tweede oproep veilig. Maakt geen gedeelde systemen stuk. |

Geef plaatsingen uit wereldconfig door aan zowel objectfactory als routeplanner. Kopieer het kerncentrum niet opnieuw in een veiligheidstest. Voor bewegende objecten kan de wereld een veilige envelope leveren; een volledig dynamisch botsingssysteem is niet noodzakelijk.

Valideer descriptor, camera, audio en route bij laden: eindige waarden, positieve duur, minstens twee punten, strikt stijgende tijden, start/eind passend bij route-duur, bruikbare targets en `planEntry`/`isSafe`-functies. In een gewone browser-runner zijn hiervoor kleine JavaScript-checks genoeg. JSON-schema of een nieuwe library is niet vereist.

### 5.4 Laden en veilig verwijderen

Een eenvoudige wisselprocedure moet na goedkeuring worden uitgewerkt en getest:

1. Zoek het id in een vaste registry en valideer de beschrijving. Construeer geen imports uit willekeurige gebruikerspaden.
2. Blokkeer overlappende wissels met één lopend wisseltoken. Stop de oude Journey voordat camera of wereld verandert; wis vastzittende input.
3. Leg het audio-wisselbeleid vast. Bij andere tracks: fade oude laag uit, pauzeer en ontkoppel haar bronnen. Behoud mastervolume en mute. Bij dezelfde tracks kan de bestaande tijdlijn behouden blijven. Laat nieuwe media via de gebruikersactie van de wereldkeuze starten; anders toon Start/Hervat audio.
4. Roep oude `world.dispose()` aan. Maak actieve world/route-referenties leeg, reset scene-omgeving expliciet en voorkom updates op verwijderde objecten.
5. Initialiseer de nieuwe wereld met try/catch. Bij een fout: ruim haar gedeeltelijke resources op, toon een bruikbare foutstand en laat opnieuw kiezen mogelijk. Automatisch terugbouwen van de oude wereld is geen noodzakelijke v1.0-feature.
6. Pas nieuwe camera/startpose en omgeving toe, installeer gevalideerde route en audio-output, en activeer de nieuwe wereld in dezelfde loop.
7. Bij hele-app-dispose: stop de loop eerst, abort listeners, verwijder wereld/controls/UI, ruim audio inclusief timers op en verwijder renderer/canvas. Maak verdere start/update-oproepen veilig inert of geef een duidelijke fout.

Deze procedure vereist duidelijke eigenaars en afhandeling van asynchrone audio-disposal. Een world-manager kan eerst als kleine functie in engine/bootstrap bestaan; een omvangrijk loaderframework is niet nodig. Sync geometrie-init behouden zolang er geen echte asynchrone wereldassets nodig zijn.

Een wisselbeleid mag andere muziek starten, maar een **Free Flight ↔ Guided Journey**-wissel mag nog steeds niets met afspeeltijden doen. Dat onderscheid moet in tests expliciet blijven.

### 5.5 Audio, route en klok koppelen

De minimale koppeling blijft:

```text
flight modes → huidige camera
world.update(dt, camera) → actuele proximityDistance
audio.updateDistance(distance) → gain-target, nooit track-reset
renderer.render(scene, camera)
```

De registry levert routeconfig aan de motor; de motor weet niet welk object “de kern” is. Audio leest actuele wereldinteractie, geen geschatte Journey-seconde. Daardoor blijft het geluidsbeeld ook bij onderbreken of afwijken correct.

Kies één beleid voor actieve frame-tijd en stalls en geef dit centraal door. Een eenvoudige begrensde actieve delta voor zowel route als wereld voorkomt grote camera-steps, maar laat een Journey bij stalls langer dan 90 seconden muurkloktijd duren. Een raw actieve klok houdt de 90 seconden nauwkeuriger, maar kan bij een lange stall een zichtbare sprong geven. Leg deze afweging vast en test haar; bij normaal 30/60/120 FPS moet de bestaande 90-secondenuitkomst behouden blijven. Een verborgen tab telt niet mee. Audio mag onafhankelijk blijven lopen zoals nu; volledige muziek/choreografie-synchronisatie is een andere, uitgestelde eis.

### 5.6 Toekomstige werelden testen

Behoud de bestaande browserpagina en voeg contract-/integratiechecks toe zonder Node.js of testinstallatie. Gebruik een zeer kleine testwereld met andere pose, geen mist en desnoods geen route/audio. Dit is een testfixture, geen start van de artistieke World 02.

Test na goedkeuring A→B→A en een mislukte B-init: correcte resetpose, geen oude scene-children/mist, route vervangen, slechts één canvas/lus, geen dubbele controls-events en audio-masterinstellingen behouden. Tel aanmaak/dispose van exclusieve resources. Observeer vervolgens tijdens vele wissels of `renderer.info.memory` en browsergeheugen stabiliseren; interne renderer-caches kunnen blijven bestaan, dus verwacht niet blind overal nul.

Voeg ongeldige routes, aanloopfallback, camera-targetsingulariteiten, frames langer dan 50 ms, gecombineerd draaien/bewegen, partial audio-init, dispose tijdens start/pauze, verborgen tab en bfcache/slaap toe. Iedere wereld krijgt eigen geometrie-/routechecks en een apart drawcallbudget; hardcode niet voor World 02 opnieuw exact tien draws.

Blijf echte media in Safari na een klik testen en luister de volledige loops. Doe kleine compatibiliteitschecks in andere beschikbare desktopbrowsers zonder daarvoor software te installeren. Registreer meetcondities en vergelijk dezelfde routes; het aantal PASS-regels is geen performancebewijs.

## 6. F — Maximaal tien concrete aanbevelingen

Complexiteit is een relatieve schatting: **laag** = enkele lokale settings/bindings en checks; **middel** = meerdere contracten plus integratietests; **hoog** = nieuw subsysteem en uitgebreid browseronderzoek. Dit zijn geen tijd- of kostenbeloftes.

### Essentieel vóór World 02

| ID | Probleem/kans | Voorgestelde oplossing | Verwachte meerwaarde | Complexiteit |
| --- | --- | --- | --- | --- |
| R1 | Camera-reset, omgeving en wissels hangen aan Neon City. | Kleine wereldregistry/descriptor; pose en omgeving configureren; Journey vóór verwijderen stoppen; expliciet wissel- en foutpad. | Tweede wereld laden zonder renderer/besturing herschrijven of oude mist erven. | Middel |
| R2 | Audio kent vaste stad/kern en geen andere-wereldbeleid. | Twee neutrale rollen ambient/proximity, wereld-URLs/instellingen en neutrale afstandsoutput; trackwissel en masterbehoud expliciet regelen. | Eigen geluidswereld voor World 02; bestaande Journey-tijdlijnen behouden. | Middel |
| R3 | Motoren zoeken vaste DOM en flight modes renderen zelf UI. | UI-elementen/callbacks injecteren, Journey-paneel als adapter; wereldlabels en werkelijke route-duur gebruiken. | Motoren testen en hergebruiken met andere pagina/wereld. | Laag–middel |
| R4 | Ongeldige routes, stalls en fallbackvelocity hebben geen volledig contract. | Valideren bij laden; gedeeld klokbeleid kiezen; entry-settings configureerbaar en velocityfallback expliciet maken/testen. | Voorspelbare beweging op andere wereldschaal, minder randgevalfouten. | Middel |
| R5 | Cleanup- en wisselfoutpaden zijn onvoldoende geïntegreerd getest. | Partial-init-cleanup/disposed-guards/bfcache-beleid; A→B→A-, init-failure- en audio-racechecks toevoegen. | Wereldwissels en fout-herstel aantoonbaar betrouwbaar. | Middel |

### Nuttig maar niet dringend

| ID | Probleem/kans | Voorgestelde oplossing | Verwachte meerwaarde | Complexiteit |
| --- | --- | --- | --- | --- |
| R6 | 30 FPS heeft geen reproduceerbare diagnose. | Meetprotocol met identieke route, viewport, renderfactor, audio, energiestatus en browser; mediane/P95 plus start-stalls. | Optimaliseren op bewijs; geen onnodige geometrie- of engineherschrijving. | Laag–middel |
| R7 | Defaults, release-suffixen en overridevalidatie zijn verspreid. | Kleine gedeelde defaults naast wereldconfig; resterende overrides valideren; één release-/cacheprocedure documenteren. | Minder handmatige inconsistentie en eenvoudiger leren/onderhouden. | Laag–middel |
| R8 | Cleanup is ad hoc bij toekomstige textures; shaderpatch hangt van r180 af. | Eigenaarschap per component vastleggen; kleine disposal-conventie, shaderregressie bij upgrades; geen assetpool zolang ongebruikt. | Nieuwe objecten veilig toevoegen zonder verborgen GPU-resources of gebroken orbitshader. | Laag–middel |

### Bewust uitstellen

| ID | Probleem/kans | Voorgestelde oplossing | Verwachte meerwaarde | Complexiteit |
| --- | --- | --- | --- | --- |
| R9 | Artistieke uitbreiding naar binaurale audio, reactive visuals of portalen. | Callback behouden; pas implementeren met concrete World 02-eis en afzonderlijke goedkeuring. | Duidelijke scope en geen ongebruikte audiografiek/navigatiecode. | Middel–hoog bij uitvoering |
| R10 | Verleiding tot algemene physics, plugins, resourcepooling of adaptieve postprocessing. | Huidige expliciete modules en safety-envelopes behouden; alleen uitbreiden na tweede aantoonbare toepassing of meting. | Lichte, leerbare en portable motor; beperkte technische schuld. | Hoog bij uitvoering |

## 7. Bronnen, toetsbaarheid en oplevergrens

De vijf fasecommits op `main` zijn `b8cc569`, `ab9e2dd`, `a16bba6`, `d879607`, `2528bd6`. Hun diffs en de README onderbouwen de retrospectieve. Concrete bronlocaties voor de belangrijkste conclusies:

| Bron | Functie/regels in de geaudite versie |
| --- | --- |
| `js/engine.js` | `frame()` 55–75; `setWorld/start/dispose` 78–84; vaste UI en settings 9–47. |
| `js/main.js` | Audio-afstand na update 21–24; pagehide 27–30; fatal catch 31–35. |
| `js/camera.js` | `resetCamera()` 9–12. |
| `js/controls.js` | DOM 14–15; reset/input 23–45; bewegingsintegraal 67–86. |
| `js/journey/flight-modes.js` | UI 8–15; mode/update/dispose 18–39. |
| `js/journey/journey.js` | Entry/fallback 18–31; timing/speed/completion 34–54. |
| `js/journey/timed-path.js` | Tijdmapping 4–18; entry 21–34. |
| `js/worlds/neon-city/world.js` | Omgeving/init 14–23; dispose 27–47. |
| `js/worlds/neon-city/journey-route.js` | Vaste route 4–17; safety/entry 18–40. |
| `js/audio/audio-manager.js` | Initialization 35–53; user-gesture/start 61–86; mix/dispose 104–118. |
| `js/audio/audio-panel.js` | Selectors 2–7; render en binding 11–35. |
| `js/objects/energy-core.js` | Shaderpatch 58–65; afstand/update 110–126; dispose 128–134. |
| `js/objects/energy-core-settings.js` | Defaults/overridevalidatie 2–28. |
| `js/worlds/neon-city/buildings.js` | Seed/layers 3–8; bounds 69; batching 75–83. |
| `js/worlds/neon-city/atmosphere.js` | Vaste attributes 21–25; shader/time/bounds 26–56. |
| `tests/browser.js`, `tests/journey.js`, `tests/audio.js`, `tests/energy-core.js` | Functionaliteits- en resourcechecks met de beschreven beperkingen. |
| `tests/audio-streaming.js` | Korte echte-media-controles; geen volledige loopbeluistering. |
| `README.md` | Historische fase-2/3/4A/4B-testresultaten en meetvoorbehouden. |
| `lib/three/three.core.js`, `three.module.js`, `LICENSE` | Revision 180, WebGL 2-vereiste en MIT-distributie. |

Tijdens deze audit zijn alleen de twee documenten in `docs/audit/` toegevoegd. Bestaande code, tests, instellingen, muziek en Git-history blijven ongewijzigd. Geen commit, push, publicatie of installatie. Architectuurwijzigingen en World 02 wachten op afzonderlijke goedkeuring.
