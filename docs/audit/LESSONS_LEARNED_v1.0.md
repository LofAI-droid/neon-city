# World Engine — Lessons Learned v1.0

Datum: 10 oktober 2026. Basis: Neon City v0.4B, commit `2528bd677e40fb9dd860a6d78dad827bb687250b`.

## Executive summary

Neon City bewijst dat een interactieve audiovisuele wereld mogelijk is met vanilla JavaScript, lokale Three.js, één renderloop en een eenvoudige Python-webserver. De sterkste ontwerpkeuzes zijn gebundelde lijngeometrie, tijdgebaseerde beweging, expliciete resource-opruiming, onafhankelijke audiotijdlijnen en de scheiding tussen Journey-motor en routegegevens.

De basis hoeft niet opnieuw te worden gebouwd voor World 02. Wel moeten enkele koppelingen worden verduidelijkt: de camera reset altijd naar Neon City, engine en besturing zoeken vaste HTML-elementen, de audio-manager kent precies stad en kern, en wereldwissels hebben nog geen volledige fout- en lifecycle-afhandeling. Deze beperkingen vormen technische schuld zodra een tweede wereld wordt toegevoegd.

De gemelde circa 30 FPS is geen verklaard probleem. Latere korte observaties van 59–60 FPS bewijzen evenmin een optimalisatiewinst. Eerst reproduceerbaar meten, daarna gericht verbeteren. De aanbeveling is een kleine, gecontroleerde reorganisatie, met behoud van bestaande vlucht- en audiocode.

## 1. Onderzoeksbasis en bewijskracht

Alle eigen JavaScript-modules, beide HTML-testpagina's, HTML/CSS, README, instellingen, `.gitignore` en de relevante Git-diffs zijn gelezen. De lokale Three.js-bestanden zijn gecontroleerd op versie, renderervereisten en licentie; de volledige externe bibliotheek is niet regel voor regel geaudit. Er zijn geen dependencies geïnstalleerd en geen applicatiebestanden gewijzigd.

De werkboom was bij aanvang schoon; `HEAD` is de opgegeven commit. `origin/main` verwijst lokaal naar dezelfde commit. Dit is een lokale Git-waarneming, geen nieuwe controle van de online repository. De extra historische refs met oudere commit-identiteiten veranderen de vijf inhoudelijke ontwikkelfasen op `main` niet.

We onderscheiden vier soorten bewijs:

| Label | Betekenis |
| --- | --- |
| Vastgesteld in code/Git | Direct zichtbaar in functies, imports of commit-diffs. Een onvolledig contract is niet automatisch een fout in de huidige ervaring. |
| Opnieuw gecontroleerd | Tijdens deze audit uitgevoerd op de bestaande testpagina in Safari. |
| Historisch gerapporteerd | Vastgelegd in README bij de eerdere oplevering; hier niet opnieuw gemeten. |
| Vermoedelijk risico | Een plausibele fout of vertraging bij een andere situatie; nog niet praktisch aangetoond. |

Tijdens deze audit is `http://localhost:8000/tests/browser.html` opnieuw geladen in Safari: **55 PASS, geen FAIL**, inclusief WebGL-rendering met **10 drawcalls en 13.794 lijnsegmenten** in het testbeeld. De test rendert op 200 × 150 pixels; dit is geen FPS-benchmark van het volledige venster. De zeven echte MP3-tests en de volledige zichtbare Journey zijn in README als eerdere oplevercontroles beschreven en tijdens deze audit niet opnieuw uitgevoerd. Er is geen nieuwe CPU/GPU- of geheugenprofielmeting gedaan.

## 2. Ontwikkeling van v0.1 tot v0.4B

| Fase en commit op main | Belangrijkste verwezenlijking | Ontwerples |
| --- | --- | --- |
| v0.1 — `b8cc569` | Lokale 3D-stad, camera, zes vliegrichtingen, muisblik, renderer en wereld met `init/update/dispose`. | Eerst een kleine, werkende doorsnede bouwen. De scheiding engine/wereld zat al in de eerste versie. |
| v0.2 — `ab9e2dd` | Meer architectuur, shader-atmosfeer, renderstanden, P95-uitlezing, lokale regressiepagina. Overbodige vloersegmenten verwijderd en zeven kernringen in twee kleurgroepen gebundeld. | Visuele rijkdom hoeft niet evenredig meer drawcalls te kosten. Meet wat een verandering werkelijk doet. |
| v0.3 — `a16bba6` | Energiekern uit de wereldmodule gehaald; aparte afstandsrespons en instellingen; echte 3D-afstand en uitbreidingscallback. | Scheid artistiek object, reactieformule en wereldplaatsing. |
| v0.4A — `d879607` | Twee lokale MP3-spelers via één Web Audio-context; afstandsmix, mute/volume/pauze, fouten en cleanup; muziek genegeerd door Git. | Afspelen en nabijheidsmix moeten onafhankelijk blijven. Audio begint alleen na een gebruikersactie. |
| v0.4B — `2528bd6` | 90 seconden Journey, aparte positie/kijkdoelen, veilige aanloop, moduswissels en verborgen-tab-pauze. | Eén eigenaar van de camera per modus; routegegevens horen bij de wereld. |

De commits leveren snapshots per fase, geen volledig dagboek van alle experimenten. De bijna identieke tijden van de eerste twee commits zijn geen maat voor de ontwikkelduur. Onderwerpen uit oudere README-secties, zoals “nog geen audio”, beschrijven die eerdere fase en niet de huidige app.

## 3. Succesvolle ontwerpprincipes

### 3.1 Eén centrale klok en renderloop

`createEngine()` in `js/engine.js` gebruikt één `renderer.setAnimationLoop(frame)`. Besturing, wereld en audio-update worden daar aangestuurd. De Journey start geen eigen animatielus. Dit voorkomt twee systemen die tegelijk camera of scène bijwerken.

De volgorde is zinvol: eerst camera via `flightModes.update()`, dan `world.update()`, daarna de audiokoppeling via `onUpdate()`. De afstand die de audio krijgt, hoort daardoor bij de huidige camera en het inmiddels bijgewerkte kerncentrum.

### 3.2 Gewone modules zijn voldoende

Factories zoals `createEnergyCore()` en `createJourney()` leveren een klein object met methodes terug. Er is geen framework, pluginregister of uitgebreide klassenhiërarchie nodig. ES-modules en relatieve imports maken het project zonder buildstap overdraagbaar.

“Modulair” betekent hier: één begrijpelijke verantwoordelijkheid per onderdeel. Het betekent nog niet dat elke module zonder de bestaande HTML of Neon City-instellingen inzetbaar is.

### 3.3 Batching vóór zwaardere optimalisaties

`createBuildings()` tekent 108 gebouwen als drie `LineSegments`-objecten. Een drawcall is een opdracht van JavaScript aan de GPU om een object met een materiaal te tekenen. Drie gebundelde kleurlagen kosten minder opdrachten dan een apart object voor iedere verdieping.

De v0.2-diff toont dat `box()` bij hoogte nul niet langer twee identieke rechthoeken en verticale nulsegmenten genereert. Dezelfde commit vervangt `velocity.clone()` per frame door een hergebruikte `difference`-vector. Beide verbeteringen zijn concreet en klein; er was geen nieuwe optimalisatiebibliotheek nodig.

### 3.4 Continu reageren, geen harde schakelaars

`createEnergyResponse()` gebruikt smoothstep en exponentiële demping. Smoothstep maakt het begin en einde van een afstandsovergang zacht. Demping laat de zichtbare reactie geleidelijk naar haar doel bewegen.

De namen rust, activatie en resonantie beschrijven de afstand, maar sturen geen abrupte materiaalwissel aan. De geïntegreerde intensiteit bepaalt de rotatiehoek. Daardoor springt die hoek niet wanneer de rotatiesnelheid verandert.

### 3.5 Audio is een doorlopende laag

`createAudioManager()` start beide loops onafhankelijk. `updateDistance()` verandert alleen de kern-gain. Mute verandert de mastergain, niet `currentTime`. Moduswissels bevatten geen audiocalls. Dat is precies waarom een terugkeer naar Free Flight de composities niet herstart.

Dit is afstandsafhankelijke muziek, geen binaurale ruimtelijke plaatsing: er is geen `PannerNode`. De commitnaam “spatial audio engine” moet niet tot een ruimere technische claim leiden.

## 4. Good practices om te behouden

- Houd `init`, `update` en `dispose` expliciet. `removeFromParent()` verwijdert een object uit de scène; `geometry.dispose()` en `material.dispose()` geven de bijbehorende GPU-resources vrij. Beide zijn nodig.
- Hergebruik tijdelijke vectors en materialen tijdens frames; genereer vaste geometrie bij initialisatie.
- Gebruik een vaste seed voor procedurele bouw. De seed `73129` maakt gebouwtests en routecontrole reproduceerbaar.
- Laat het interactieve object zijn eigen effect verzorgen. `sphere.js` bepaalt alleen waar de gedeelde kern in Neon City staat.
- Houd audio pas na een klik actief. `resume()` en beide `play()`-calls gebeuren vóór de eerste `await` in `start()`.
- Gebruik `AbortController` voor eventlisteners en generatie-tokens voor asynchrone audio. Een oud startresultaat mag een latere stop niet ongedaan maken.
- Test logica met nagebootste audio-nodes en browsergedrag afzonderlijk met echte bestanden. Een fake is een vervanger voor een browserobject waarmee je gerichte verwachtingen kunt controleren.
- Update knoptekst alleen als die verandert. Audio- en Journey-UI doen dit al; dat beperkt DOM-wijzigingen tijdens bediening.
- Behoud de lokale Three.js-versie en MIT-licentie samen. Test de shaderpatch opnieuw vóór een bibliotheekupgrade.
- Houd lokale muziek buiten Git. `.gitignore` werkt voor de aanwezige MP3's, maar verwijdert geen bestand dat eerder al gevolgd werd; controleer dus ook `git ls-files`.

## 5. Problemen, oorzaken en vermijdbare complexiteit

| Onderwerp | Vaststelling en oorzaak | Les |
| --- | --- | --- |
| Wereldspecifieke reset | `resetCamera()` zet altijd `[0,7,62]` en pitch `0.018`; controls importeren die reset rechtstreeks. | Maak startpose een wereldinstelling voordat World 02 wordt toegevoegd. |
| Verborgen HTML-contract | Engine en controls verwachten vaste selectors zoals `#quality-toggle`, `#mouse-toggle` en `#reset`. Ontbrekende elementen kunnen een fout veroorzaken. | Geef UI-elementen of callbacks expliciet door; vermijd wereldnamen in de motor. |
| Onvolledige wereldwissel | `setWorld()` verwijdert eerst de oude wereld en initialiseert daarna de nieuwe. Camera, audio en scèneomgeving hebben geen gezamenlijk wisselcontract. | Een functienaam voor wisselen is nog geen complete, foutveilige wereldwisseling. |
| Verdeelde wereldgegevens | Kernplaatsing staat in `sphere.js`, veiligheidscentrum opnieuw in `journey-route.js`; resetpose staat ook in camera en route. | Eén bron per plaatsing; artistieke drempels mogen afzonderlijk blijven als ze een ander doel hebben. |
| Cache-afhandeling | Lokale `?v=0.4B`-URL's staan op verschillende importplekken. README beschrijft oude Safari-modules bij herladen. Git bevat de workaround, geen cacheprofiel. | Leg een eenvoudige release-/herlaadprocedure vast. Vermijd toekomstige willekeurige versienummers per bestand. |
| FPS-onzekerheid | README rapporteert eerst circa 30 FPS en later 59–60 FPS, zonder vergelijkbare benchmarkcondities. | Verminderde pixel- of drawcallbelasting is geen bewezen frameratewinst. |
| Beperkte testclaims | Cleanup-events bewijzen dat `dispose()` wordt aangeroepen; ze meten geen langdurige heapgroei. | Beschrijf precies wat een test bewijst. |

Vermijd voor World 02 een volledige engineherschrijving, een algemene scenegraph boven op Three.js, een eventbus voor iedere waarde, automatisch gevonden plugins, een uitgebreide resourcepool of een willekeurig aantal audiobussen. Twee werelden vragen vooral expliciete afspraken. Een eenvoudige lijst met wereldfactories en twee configureerbare audiolagen volstaan voorlopig.

## 6. Belangrijkste lessen voor volgende werelden

1. Bouw voort op de werkende systemen en verander hun koppelingen vóór hun bewegings- of mixformules.
2. Splits configuratie van gedrag: camera-start, mist, route, objectplaatsing en audiobestanden horen bij de wereld.
3. Maak eigenaarschap duidelijk: de app bezit renderer en audio-context; de wereld bezit haar scèneobjecten; ieder onderdeel ruimt op wat het zelf maakte.
4. Voeg één gerichte lifecycle-test met een tweede eenvoudige testwereld toe vóór de echte World 02. Wissel terug en controleer reset, mist, route en audiobronnen.
5. Test slechte invoer en fouten, naast het succesvolle pad. De huidige route is geldig, maar ongeldige nieuwe routegegevens worden niet gevalideerd.
6. Kies expliciet wat kloktijd, verborgen-tab-pauze en audio bij een wereldwissel betekenen. De huidige Journey-klok en begrensde wereldklok lopen bij frames langer dan 50 ms uiteen.
7. Meet op hetzelfde apparaat, venster, kwaliteitsniveau, camera en audio-instelling. Noteer browser/OS en stroom-/energiestatus voordat circa 30 FPS aan een oorzaak wordt toegeschreven.
8. Behandel hoorbare loopovergangen als artistieke én technische acceptatie. Een `loop`-vlag bewijst geen klikvrije of sample-perfecte muziek.

## 7. Vervolg na goedkeuring

De volledige module-inventaris, technische schuld, aanbevolen structuur en maximaal tien aanbevelingen staan in [WORLD_ENGINE_ARCHITECTURE_AUDIT_v1.0.md](WORLD_ENGINE_ARCHITECTURE_AUDIT_v1.0.md). Deze audit levert uitsluitend documentatie. Er is geen architectuurwijziging uitgevoerd en World 02 is niet gestart.
