# World Engine v1.0 — WP1: wereldconfiguratie en wereldcontract

Werkbranch: `feature/world-engine-v1`. Vertrekpunt: goedgekeurde `main`, Neon City v0.4B, `2528bd6`. Geen commit of push gemaakt. De bestaande, niet-gecommitte auditdocumenten zijn behouden.

## Wat WP1 verandert

Neon City heeft nu één configuratiemodule: `js/worlds/neon-city/config.js`. De gedeelde camera kent geen vaste Neon City-startpositie meer. De engine valideert de actieve wereld, stelt haar camera en omgeving in en activeert alleen een beschikbare Journey. De bestaande audiomotor blijft exact behouden; de bootstrap ontvangt de afstand via het neutrale wereldcontract.

```javascript
export const NEON_CITY_CONFIG = {
  id: 'neon-city',
  name: 'Neon City',
  camera: {
    position: [0, 7, 62],
    rotation: [0.018, 0, 0],
    fov: 66,
    near: 0.15,
    far: 650
  },
  environment: {
    background: 0x0b0616,
    fog: { type: 'exp2', color: 0x0b0616, density: 0.006 }
  },
  guidedJourney: true,
  settings: {
    energyCore: { position: [0, 19, -82], settings: ENERGY_CORE_DEFAULTS }
  }
};
```

`ENERGY_CORE_DEFAULTS` wordt uit de bestaande kerninstellingen geïmporteerd. `settings` is een gewoon object voor wereldspecifieke instellingen, geen nieuw configuratieframework. De gedeelde validator kent de inhoud van dit object niet; gespecialiseerde componenten blijven hun eigen instellingen beoordelen.

Posities gebruiken de bestaande wereldunits. `rotation` is `[pitch, yaw, roll]` in radialen met Euler-volgorde YXZ. Field of view gebruikt graden. Near/far bepalen de zichtbare afstand. Achtergrond en mistkleur zijn numerieke RGB-kleuren, bijvoorbeeld `0x0b0616`. Geen mist wordt expliciet aangegeven met `fog: null`; lineaire mist gebruikt `{ type: 'linear', color, near, far }`.

Concreet: bij een camera-configuratie met `position: [12,25,-30]` en `rotation: [0.1,0.4,-0.2]` maakt `createCamera(aspect, config.camera)` een camera op die pose. Na bewegen brengt R of de resetknop haar terug naar diezelfde pose. `configureCamera(camera, config.camera)` verandert ook de opgeslagen resetpose en lensparameters. De engine doet dit bij `setWorld(world)`. Zonder geselecteerde wereld is de camera neutraal op `[0,0,0]`; de zichtbare Neon City krijgt altijd de bovenstaande eigen waarden.

De opgeslagen camera-startarrays zijn kopieën. Configuratie wijzigen wordt pas actief wanneer de camera opnieuw geconfigureerd wordt. Bewerk configuratie vóór initialisatie; dit is geen runtime-editor.

## Klein wereldcontract

Iedere wereld levert een gewoon object:

| Veld/functie | Afspraak |
| --- | --- |
| `config` | Geldige wereld-ID, naam, camera, environment, guidedJourney en settings. |
| `init(scene)` | Initialiseert en voegt eigen objecten toe. Camera en scèneomgeving worden door de engine ingesteld. |
| `update(deltaTime, camera)` | Werkt eigen animaties en interactie bij vanuit de centrale renderloop; start geen eigen loop. |
| `getJourneyRoute()` | Optioneel. Nodig wanneer `config.guidedJourney === true`. Zonder route blijft Guided Journey uitgeschakeld. |
| `getAudioState()` | Levert `{ proximityDistance }`: de werkelijke 3D-afstand tot de gekozen interactiebron, of `Infinity` zonder bron. |
| `dispose()` | Verwijdert uitsluitend eigen objecten, geometrie, materialen, textures en eventuele eigen events. Vernietigt geen renderer/camera/audio-engine. |

Een wereld zonder kern hoeft geen kernmodule te importeren. Zij kan `getAudioState()` laten teruggeven `{ proximityDistance: Infinity }`. Een wereld zonder Journey heeft `guidedJourney: false` en hoeft geen `getJourneyRoute` te implementeren. Dit is in WP1 uitsluitend met kleine inline contractdoubles in tests gecontroleerd: er is geen Test World-module of nieuwe artistieke wereld gebouwd.

Neon City behoudt tijdelijk `getEnergyDistance()` als compatibiliteitsaccessor. De app gebruikt nu:

```javascript
audio.updateDistance(world.getAudioState().proximityDistance);
```

Dit gebeurt na `world.update()`, dus ook de zweefbeweging en alle camera-assen tellen mee. Muziekbestanden, gain-curves, mute/volume, pause/resume en start na een klik zijn niet veranderd. Er zijn nog steeds precies twee Neon City-audiolagen; neutrale afstandsgegevens betekenen nog geen algemene audioconfiguratie.

`world.init()` bepaalt geen achtergrond/mist meer. Bij rechtstreeks gebruik zonder engine moet de aanroeper eerst `applyWorldEnvironment(scene, world.config)` uitvoeren. De tests doen dat eveneens. De wereld verwijdert bij dispose niet de engine-omgeving; bij activeren wordt de nieuwe omgeving expliciet ingesteld, inclusief `fog:null`.

## Validatie

`js/world-contract.js` bevat `validateCameraConfig`, `validateWorldConfig`, `validateWorldContract` en `applyWorldEnvironment`. Er zijn geen validatie-afhankelijkheden toegevoegd.

Gecontroleerd worden:

- Wereld-ID: kleine letters/cijfers met optionele koppeltekens, bijvoorbeeld `neon-city`; naam niet leeg.
- Positie en rotatie: arrays met precies drie eindige getallen, zonder gaten.
- Field of view: eindig, groter dan 0 en kleiner dan 180 graden.
- Clipping: eindig en `0 < near < far`.
- Achtergrond/mistkleur: geheel getal tussen `0x000000` en `0xffffff`.
- Mist: expliciet null, exp2 met eindige niet-negatieve density, of linear met `0 <= near < far`.
- Journey-vlag: echte boolean; settings: object.
- Aanwezigheid van `init`, `update`, `getAudioState`, `dispose`; optionele routegetter is een functie en is verplicht bij Journey-beschikbaarheid.

Fouten noemen het veld en de regel, bijvoorbeeld: `Ongeldige wereldconfiguratie: camera.near/far vereist 0 < near < far met eindige waarden.` De engine valideert voordat de huidige wereld wordt aangeraakt. De bestaande zichtbare opstartmelding neemt deze reden over.

Uniciteit van IDs over meerdere registraties kan pas door de toekomstige World Manager worden bewaakt. WP1 controleert de vorm van één ID; er is geen wereldregistry toegevoegd. Routepunten en de teruggegeven audiostaat worden nog niet uitgebreid gevalideerd: hun gegevensvorm staat hierboven vast, verdere routehardening hoort bij een later werkpakket.

## Bestanden

Toegevoegd:

- `js/world-contract.js`
- `js/worlds/neon-city/config.js`
- `tests/world-contract.js`
- `docs/world-engine/WP1_WERELDCONFIGURATIE.md`

Aangepast:

- `js/camera.js`: configureerbare lens/startpose/reset; neutrale defaults.
- `js/controls.js`: alleen de camera-module-import; bewegingsformules ongewijzigd.
- `js/engine.js`: config/contractvalidatie, camera en omgeving toepassen, Journey-beschikbaarheid.
- `js/main.js`: neutrale audiostaat naar bestaande mix en WP1-module-URL's.
- `js/worlds/neon-city/world.js`: configreferentie en getAudioState; init bezit alleen wereldobjecten.
- `js/worlds/neon-city/sphere.js`: plaatsing uit config.
- `js/worlds/neon-city/journey-route.js`: startpunt en veiligheidscentrum uit config; bestaande routeverloop behouden.
- `js/journey/flight-modes.js`: Guided-knop uitschakelen zonder route en na routewijziging bijwerken.
- `index.html`, `tests/browser.html`, `tests/audio-streaming.html`: alleen versie-URL's voor gewijzigde modules.
- `tests/browser.js`, `tests/journey.js`: expliciete Neon City-camera/config en WP1-tests.
- `tests/audio.js`, `tests/audio-streaming.js`: alleen imports van de gewijzigde Journey/route-module; bestaande assertions behouden.
- `README.md`: verwijzing naar WP1-uitleg.

Geen bestanden verplaatst. Stijl, gebouwen, raster, atmosfeer, interactieve kernmodule, responsformules, audio-engine, lokale Three.js en `.gitignore` blijven ongewijzigd. De auditdocumenten blijven historische documenten over v0.4B.

## Testen en grenzen van WP1

De bestaande lokale testpagina blijft `http://localhost:8000/tests/browser.html`. De 55 bestaande controles blijven aanwezig, met expliciete Neon City-configuratie in de fixtures. De WP1-checks testen ook de echte engine met lege lifecycle-doubles, zonder een nieuwe wereld te bouwen.

Definitieve uitvoering in Safari: **102/102 controles geslaagd** (55 bestaande en 47 gerichte WP1-controles). Daaronder vallen alle zes bewegingsrichtingen, reset, configuratievalidatie, initialisatie/cleanup, de echte engine met een contract zonder kern/Journey, audio en Journey bij 30/60/120 FPS.

De afzonderlijke echte MP3-test op `http://localhost:8000/tests/audio-streaming.html` gaf **7/7 PASS**: starten, onafhankelijke stille loops, afstand zonder tijdlijnreset, Journey-start/stop/voltooiing zonder herstart, pauze, hervatten en een begrijpelijke ontbrekend-bestand-fout. Deze test gebruikt mastervolume nul en start na de bestaande knoppen; dit bewijst de afspeelwerking, niet de subjectieve klankkwaliteit.

De echte app is visueel gecontroleerd in Safari via de bestaande Python-server. Startcompositie, stad, raster en kern bleven behouden. Een volledige Journey liep tot automatische terugkeer naar Free Flight. Tijdens het naderen steeg de kernmix tot 99%; R bracht de camera terug en de kernmix naar 0%, zonder de lopende audio te herstarten. De HUD toonde tijdens deze controle circa 58–60 FPS en 10 drawcalls. Dit is een momentopname in deze testsessie, geen vergelijkende prestatiebenchmark of garantie voor een ander schermformaat.

Aanvullend gecontroleerd: bewegingsformules en de audio-engine zijn byte-identiek aan `2528bd6`; ook de objectgeometrie/atmosfeer/kernrespons en `.gitignore` zijn niet gewijzigd. Lokale module-imports bestaan en `git diff --check` slaagt. MP3-bestanden blijven genegeerd en staan niet in de tracked bestanden.

Handmatig controleren in Safari:

1. Vernieuw `http://localhost:8000` via de bestaande Python-server. Controleer dezelfde startcompositie, donkere mist, raster en kern.
2. Test alle vliegrichtingen, draaien, optionele muisblik en R/resetknop.
3. Start audio; test mute, volume en pause/resume. Vlieg naar de kern en terug: kernmix moet afstand volgen.
4. Start Guided Journey, onderbreek tijdens de aanloop of route en druk R. Controleer dat muziek doorloopt bij gewone moduswissels.
5. Laat een Journey eindigen; Free Flight keert automatisch terug. Een verborgen tab pauzeert de voortgang.
6. Open de beide testpagina's. De verwachte ontbrekende-MP3-fout hoort uitsluitend bij de audiotestknop.

Blijvende beperkingen: geen algemene audioconfiguratie of trackwissels (WP2), geen volledige World Manager/rollback bij init-falen (WP3), geen verdere UI-/route-/klokreorganisatie, geen artistieke World 02 of Test World (WP5). De Neon City-route blijft handmatig afgestemd op haar geometrie; alleen de camera-start en het safety-centrum uit config lezen maakt de hele route niet automatisch geschikt voor een verplaatste kern of andere stadsindeling. Er is geen nieuwe GPU-/geheugenbenchmark of garantie op een bepaalde FPS.
