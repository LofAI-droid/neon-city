# World Engine v1.0 — WP5: architectuurvalidatie en World Builder Readiness

Basis: branch `feature/world-engine-v1`, schone werkboom bij start, goedgekeurde commit `21bb941`. WP5 gebruikt de bestaande Test World uit WP3; Neon City en de gedeelde engine zijn niet gewijzigd. De Test World blijft uitsluitend in `tests/` en ontbreekt in het productieregister van `js/main.js`. Geen commit, push, merge, installatie of nieuwe runtime-afhankelijkheid.

## Executive summary

**Ja, een derde handgeschreven wereld kan met de huidige factory, registry en manager worden toegevoegd zonder de gedeelde engine te veranderen.** WP5 heeft dit met de bestaande Test World, een configuratievariant en een eigen lokaal SVG-asset gecontroleerd. De 214 bestaande regressiechecks blijven slagen; 26 nieuwe WP5-checks en 7 tests met de echte MP3's slagen ook. Twintig opeenvolgende A→B→A-cycli hielden één canvas, camera en besturing. De gemeten `renderer.info.memory`-indicator voor Neon City was vóór/na die cycli 10/10 geometrieën en 1/1 texture.

Een toekomstige **visuele World Builder** kan nu al een deel van de wereldconfiguratie als gegevens opslaan, maar kan niet zonder extra, bewust ontworpen vertaallaag willekeurige objecten en gedragingen genereren. Er is geen visuele editor, JSON-wereldloader, algemene objectgenerator of Asset Manager gebouwd.

## Huidige architectuur en eigenaarschap

```text
TOEKOMSTIG: World Builder ──maakt later──> seriële wereldgegevens + assetverwijzingen
                                              │
NU: wereldspecifieke config.js + assets/       │ (gedeeltelijk als data mogelijk)
    wereldspecifieke world.js/route.js ────────┘
                     │  factory creëert nieuwe instantie
                     v
    js/world-registry.js ──ID→factory──> js/world-manager.js
                                             │ wisselt scene, route en audio
                                             v
                                   js/engine.js: één scene/renderer/loop
                                   ├─ camera.js + controls.js
                                   ├─ journey/flight-modes.js + journey.js
                                   └─ audio/audio-manager.js via page-adapter
                                             │
                                             v
                                   actieve wereld: init/update/dispose
```

De **engine** bezit renderer, scène, camera, Free Flight, Journey-installatie en centrale renderloop. De **World Manager** coördineert een overgang met `audio.setSources()`; de **Audio Manager** bezit AudioContext, masterinstellingen en media-elementen. Een **wereld** bezit uitsluitend haar eigen objecten, geometrieën, materialen, textures, route en actueel afstandsantwoord. `js/main.js` is de productiepagine-adapter en registreert alleen Neon City; `tests/world-switching.js` registreert daarnaast de technische fixture.

`js/world-registry.js` kent geen wereldnamen buiten de meegegeven factorylijst. `js/world-manager.js`, `js/world-contract.js`, `js/engine.js`, `js/audio/audio-manager.js` en `js/journey/` bevatten geen `test-world`-tak. Iedere `registry.create(id)` valideert het wereldcontract en eist een nieuwe instantie. `engine.setWorld()` past camera en omgeving toe, roept `init(scene)` aan en installeert eventueel de route. `dispose()` van de oude wereld wordt bij een wissel aangeroepen. Een ongeldige ID/factory wordt vóór de overgang afgewezen; een init-fout na opruiming laat een herstelbare lege toestand achter. Er is geen automatische rollback.

## Wat aan de bestaande Test World is toegevoegd

`tests/test-world.js` bevat nog steeds de WP3-camera `[6,4,18]`, donkerblauwe achtergrond `0x10243a`, `fog:null`, lege audiobronlijst en `guidedJourney:false`. Een klein grondvlak is toegevoegd. De bestaande roterende kubus leest nu `position`, `scale`, `rotationSpeed` en `texture` uit `config.settings.testObject`. De textuur is het afzonderlijke bestand `assets/worlds/test-world/signal.svg`. De kubus is solide gemaakt zodat de textuur echt zichtbaar is. Er zijn geen Neon City-geometrieën of -assets geïmporteerd.

De objectinstellingen worden alleen door de Test World geïnterpreteerd en daar licht gevalideerd. De gedeelde `validateWorldConfig()` controleert wel de algemene camera-, omgeving-, Journey- en audiovelden, maar kent geen `testObject`-schema. De testvariant verandert camera, achtergrond, objectpositie, schaal en rotatiesnelheid zonder enginecode te wijzigen; de standaardfixture blijft op haar oorspronkelijke pose en achtergrond.

### Lokaal assetladen en lifecycle

De `texture`-verwijzing is een module-relatief pad in de Test World-configuratie. `new URL(setting.texture, import.meta.url)` maakt er dezelfde lokale URL van, ongeacht of `tests/browser.html` of `tests/world-switching.html` de wereld laadt. `THREE.ImageLoader` laadt het SVG-bestand asynchroon. Pas in de succes-callback maakt de wereld een `THREE.Texture`, zet sRGB-kleurruimte en koppelt haar aan het eigen materiaal. Tijdens laden of na een fout blijft de eenvoudige basiskleur zichtbaar. `getAssetState()` van deze **testfixture** rapporteert `loading`, `ready`, `error` of `disposed`; de testpagina toont die status.

Bij `dispose()` verwijdert de fixture haar root uit de scène en ruimt kubus- en grondvlakgeometrie, beide materialen en een eventueel geladen texture precies eenmaal op. Een callback die na `dispose()` terugkomt, controleert de disposed-vlag **voordat** hij een texture maakt of een materiaal wijzigt. De test controleert dit ook met een bewust vertraagde loader. Een ontbrekend echt SVG-bestand leidde in Safari tot `error`, terwijl Free Flight en de wereld bleven functioneren. Het afbeeldingsverzoek zelf wordt nog niet geannuleerd; een laat resultaat wordt genegeerd. Er is geen algemene assetcache of Asset Manager.

## Tests en prestaties

| Controle | Uitkomst | Bewijsvorm |
| --- | --- | --- |
| Bestaande WP1–WP4- en regressietests | **214 PASS, 0 FAIL** | `tests/browser.html` in Safari; bestaande WP3-assertions aangepast aan grondvlak/texture. |
| Nieuwe WP5-tests | **26 PASS, 0 FAIL** | Zelfde browserpagina, `tests/wp5.js`. |
| Totaal automatische browsertests | **240 PASS, 0 FAIL** | Eén run in Safari. |
| Echte lokale MP3-test | **7 PASS, 0 FAIL** | `tests/audio-streaming.html` in Safari na gebruikersklik. |
| Configuratievariant | Camera/achtergrond én objectplaatsing/schaal/rotatie werkten | Gerichte fixture-tests en engine-integratie. |
| Echt lokaal SVG | Geladen, zichtbaar op kubus, 2 drawcalls | Browserassertion, `renderer.info`, zichtbare Safari-screenshot. |
| Ontbrekend/laat asset | Foutstatus, geen heractivering | Echt ontbrekend bestand plus gecontroleerde late callback. |
| Twintig A→B→A-cycli | Slaagden; één canvas/camera/controls | World Manager-integratietest. |
| Resource-opruiming | Aangemaakte en vrijgegeven fixture-resources gelijk | `dispose`-events en actieve-scènecontroles. |

Voor de twintig cycli was de Neon City-renderindicatie **10 drawcalls, 10 geometrieën, 1 texture**. Na afloop was zij opnieuw **10, 10, 1**. De Test World toonde **2 drawcalls, 2 geometrieën, 1 texture** na het laden. De zichtbare Safari-HUD liet kort **60 FPS en P95 circa 18 ms** op de testpagina zien bij renderfactor 1,25; de hoofdapp toonde later, na een volledige Journey, **30 FPS en 10 drawcalls**. Deze FPS/P95-cijfers zijn momentopnames onder verschillende omstandigheden en bewijzen geen snelheidswinst of afwezigheid van een langzaam geheugenlek. `renderer.info.memory` is een rendererindicator, geen volledige JavaScript-heap- of GPU-meting. De audiorace-/context- en inputlistener-regressies uit WP2/WP3 bleven slagen; code-inspectie bevestigt één `setAnimationLoop(frame)` en geen nieuw listenersysteem in de Test World.

De bestaande route van 90 seconden en de technische route van 42 seconden blijven door de WP4-tests gecontroleerd. In Safari is de Neon City-startcompositie opnieuw zichtbaar gecontroleerd. Free Flight en R zijn in de Test World met echte toetsen getest. De volledige Neon City-Journey liep zichtbaar tot automatische terugkeer naar Vrije vlucht; de audio bleef afspelen. Een tweede start kon worden onderbroken, waarna reset de camera en kernmix naar de starttoestand terugbracht. Deze observatie is onderscheiden van de automatische simulatietests.

## World Builder Readiness Audit

**Reeds ondersteund** betekent: de huidige runtime en de tests tonen het. **Gedeeltelijk** betekent: een handgeschreven wereld kan het, maar een editor kan het nog niet rechtstreeks uit opgeslagen data maken.

| Onderdeel | Oordeel | Concrete basis en beperking | Aanbevolen vervolgstap |
| --- | --- | --- | --- |
| Renderer, camera, besturing, centrale loop | Reeds ondersteund | `js/engine.js`, `camera.js`, `controls.js`; twee werelden gebruiken dezelfde instanties. | Behouden; geen tweede engine per wereld. |
| Registratie en wissel | Reeds ondersteund | `world-registry.js` gebruikt expliciete factories; `world-manager.js` wisselt met foutpad. Nieuwe wereld vereist nu handmatige registratie in de page-adapter. | Later een gecontroleerde catalogus voor Builder-uitvoer. |
| Algemene wereldconfiguratie | Reeds ondersteund | `world-contract.js`: ID/naam, camera, FOV, clipping, achtergrond, mist, Journey-vlag, audio; Test World-variant slaagt. | Versionering en migratie pas bij opgeslagen projecten. |
| Wereldspecifieke objectgegevens | Gedeeltelijk ondersteund | `TEST_WORLD_CONFIG.settings.testObject` stuurt één object; Neon City kent `energyCore` en `journey`-instellingen. Elk object heeft nog handgeschreven wereldcode. | Bij concrete tweede toepassing een kleine, getypeerde componentcatalogus overwegen. |
| Lokale assetverwijzing en cleanup | Gedeeltelijk ondersteund | `tests/test-world.js` laadt module-relatief SVG en ruimt texture op; `world.js` van Neon City ruimt eigen GPU-resources op. Geen centrale metadata, readiness- of cancelcontract. | Eerst padconventie, foutstatus en eigenaarschap uniformeren; Asset Manager pas bij bewezen behoefte. |
| Audio als wereldgegevens | Reeds ondersteund met limiet | `config.audio.sources`, `audio-settings.js`, `audio-manager.js`: 0–2 lokale MP3's, eigen gain/afstand; Safari-start na klik. URL's zijn **pagina-relatief**, anders dan de Test World-textuur. | Eén expliciete URL-conventie kiezen vóór Builder-export; bronlimiet alleen na prestatie- en audiotests verhogen. |
| Journey | Gedeeltelijk ondersteund | `journey/route-contract.js` valideert tijd-, positie- en kijkdoeldata; `isSafe` en `planEntry` zijn nog JavaScript-functies. | Routegegevens serialiseerbaar houden; veiligheidsstrategie later als gekozen, geteste component koppelen. |
| Wereld-lifecycle | Reeds ondersteund met grens | `init/update/getAudioState/dispose`, WP3/5-wisseltests; async fixture negeert late callbacks. Algemeen `init()` wacht niet op asset-readiness. | Alleen bij werelden die assets vóór activatie vereisen een klein readiness-contract ontwerpen. |
| Visuele World Builder / JSON-loader | Nog niet ondersteund | Geen editor, objectcatalogus, veilige gedragsmapping, opslagformaat of JSON-import in de code. | Apart werkpakket na ontwerp en use-cases; geen `eval` of willekeurige modulepaden. |

### Gegevens, code en toekomstige metadata

**Vandaag configureerbare gegevens (A, J):** wereld-ID/naam, camera-positie/-rotatie/FOV/near/far, achtergrond/mist, Guided-vlag, maximaal twee audio-descriptors, kerninstellingen, Journey-aanloop en de Test World-objectinstellingen zijn gewone getallen, strings, booleans, arrays of objecten en grotendeels JSON-serialiseerbaar. Een geladen `THREE.Texture`, `THREE.Vector3`, `THREE.Color`, callback, factory of AudioContext is dat niet. De huidige configuratiemodules zijn JavaScript-bestanden, geen JSON-documenten; serialiseerbare **inhoud** betekent nog geen bestaande import/exportfunctie.

**Nog hardcoded in wereldcode (B, K):** Neon City's gebouwgenerator, raster en atmosfeer in `buildings.js`, `grid.js`, `atmosphere.js`; de positie- en kijkdoelpunten plus `isSafe`/`planEntry` in `journey-route.js`; plaatsing/constructie van het Test World-grondvlak en de keuze voor `BoxGeometry` in `tests/test-world.js`. `createNeonCity()` en `createTestWorld()` zijn runtime-factories. Een Builder kan functies niet veilig als JSON opslaan of rechtstreeks uitvoeren.

**Hergebruikbaar (C, D, L):** engine, camera/controls, Registry/Manager, audio- en Journey-motor, energie-kernfactory en UI-adapters. Pas wanneer minstens twee echte werelden hetzelfde objecttype nodig hebben, is een kleine catalogus met bekende objecttypen, gevalideerde parameters, plaatsing, asset-ID en lifecycle-functies zinvol. Een generieke objecteditor of pluginplatform is nu niet nodig.

**Assets (E–H):** audio komt via HTMLAudioElement uit page-relatieve lokale MP3-URLs; de Test World-textuur via module-relatieve ImageLoader-URL. Identiteit is nu hoofdzakelijk het pad plus een audio-bron-ID; een algemene asset-ID ontbreekt. Eigenaren ruimen hun media-elementen/nodes respectievelijk textures/materialen/geometrieën op. Een latere bibliotheek heeft minstens stabiele asset-ID, soort/MIME, lokaal pad, eigenaar/licentie, afmetingen/duur, bestandsgrootte, afhankelijkheden en laad-/foutstatus nodig. Duplicaten en verwijzingen tussen werelden vragen dan een expliciet beleid; WP5 implementeert dit niet.

**Later op te slaan (I, M, N):** een Builder zou versie, wereld-ID, camera/omgeving, bekende objecttypen met gevalideerde parameters/transformaties, asset-ID's, audio-descriptors, routepunten en gekozen interacties moeten opslaan. Een **derde handgeschreven wereld** kan nu zonder wijziging aan de gedeelde engine door eigen config/factory en registratie in een adapter. Een derde **data-gegenereerde** wereld kan dat nog niet: type-mapping, opslagformaat, assetcontrole en veilige gedragscomponenten ontbreken. Ontwikkel voorlopig geen Planetary Drift, portalen, editor, algemene physics of assetpool.

## Vaststellingen, correcties en vervolgstap

WP5 vond geen fundamenteel enginegat voor een handgeschreven derde wereld. De enige codewijzigingen zijn aan de testfixture, testpagina en tests. De Test World kreeg een eigen bestandstextuur, simpele configuratievelden, gecontroleerde laadfout en late-callback-guard. `tests/wp3.js` telt nu de grondvlak- en eventuele textuurresources mee. Neon City, haar kunst, muziek, vlucht en alle gedeelde motormodules zijn onaangeroerd.

Open architectuurpunten voor een eventueel **WP6**: kies één portable URL-regel voor audio en beelden; definieer desgewenst een klein versieerbaar dataformaat voor camera/omgeving/object-descriptors; bepaal een beperkte lijst veilige object- en gedragscomponenten; voeg alleen als een echte wereld het vereist een asset-readiness-/foutcontract toe. Dit is een voorstel voor scope, geen gestart werkpakket. De huidige twee-bronnenlimiet, sample-gebaseerde routeveiligheid, ontbrekende rollback na init-fout en niet-afbreekbare ImageLoader-request blijven expliciete grenzen.

## Acceptatiecriteria AC1–AC20

| AC | Oordeel | Bewijs of grens |
| --- | --- | --- |
| 1 Modulariteit | Geslaagd | Beide werelden via dezelfde Engine/Manager zonder wereldtak. |
| 2 Wereldconfiguratie | Geslaagd | Test World-camera, omgeving en objectinstellingen in eigen config. |
| 3 Configuratiecontrole | Geslaagd | Camera/achtergrond en objectpositie/schaal/rotatie in variant getest. |
| 4 Onafhankelijke assets | Geslaagd | Eigen lokaal SVG-bestand, zichtbaar op kubus. |
| 5 Asset lifecycle | Geslaagd binnen fixture | Texture/geometrie/materiaal-dispose en herladen getest. |
| 6 Robuust laden | Geslaagd binnen fixture | Echt ontbrekend bestand en late callback gecontroleerd. |
| 7 Wereldwissels | Geslaagd | A→B→A zonder reload. |
| 8 Herhaalde wissels | Geslaagd binnen meetgrens | Twintig cycli, stabiele actieve resources; geen langetermijn-heapbewijs. |
| 9 Gedeelde systemen | Geslaagd | Eén canvas/camera/controls; WP3-audiocontext en renderloopregressie. |
| 10 Functies per wereld | Geslaagd | Test World zonder audio/Journey, Free Flight actief. |
| 11 Neon City | Geslaagd | 214 regressies, visuele startcompositie, ongewijzigde code. |
| 12 Regressie | Geslaagd | 214/214 bestaande PASS. |
| 13 Nieuwe tests | Geslaagd | 26/26 WP5 PASS. |
| 14 Prestaties | Geslaagd als controle | Drawcalls, FPS/P95-momentopname, scène- en resourcecijfers; geen winstclaim. |
| 15 Architectuur | Geslaagd | Geen gedeelde enginewijziging voor configuratie/asset. |
| 16 Documentatie | Geslaagd | `CREATING_A_NEW_WORLD.md`. |
| 17 Builder Readiness | Geslaagd als audit | Tabel en data/code/asset/lifecycle-analyse hierboven. |
| 18 Stack | Geslaagd | Alleen bestaande browserstack en lokale Three.js. |
| 19 Scope | Geslaagd | Geen World 02, Planetary Drift, editor of Asset Manager. |
| 20 Git | Geslaagd | Branch gecontroleerd; geen commit, push of merge. |

Deze oordelen gelden voor de beschreven technische tests en hun meetgrenzen. Zij zijn geen claim dat een volledige World Builder of langdurig foutloze GPU-lifecycle vandaag al bestaat.
