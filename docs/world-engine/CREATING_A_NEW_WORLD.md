# Een nieuwe wereld toevoegen aan World Engine v1.0

Deze handleiding beschrijft de **huidige handgeschreven ES-module-API** na WP5. De [Test World](../../tests/test-world.js) is een klein, werkend voorbeeld; zij staat alleen op de testpagina en is geen artistieke World 02. De gedeelde motor werkt zonder Node.js of buildstap via `python3 -m http.server 8000`. Een visuele World Builder en JSON-import bestaan nog niet.

## 1. Maak de wereldbestanden

Gebruik voor een nieuwe productiewereld bijvoorbeeld `js/worlds/example-world/config.js` en `js/worlds/example-world/world.js`. Voeg optioneel `journey-route.js` toe. Plaats eigen kleine beelden of modellen logisch onder `assets/worlds/example-world/`; plaats audiobestanden in een afgesproken lokale assetmap. De huidige `js/worlds/neon-city/` toont een wereld met audio, objecten en route. `tests/test-world.js` toont een wereld zonder audio of Journey.

**Verplicht:** een configobject en een factory die bij **iedere activatie een nieuwe wereldinstantie** met `config`, `init(scene)`, `update(dt, camera)`, `getAudioState()` en `dispose()` teruggeeft. **Optioneel:** `getJourneyRoute()` wanneer `guidedJourney:true`, plus audiobronnen en eigen assets. Een wereld zonder Journey zet `guidedJourney:false` en laat de routefunctie weg.

## 2. Schrijf de configuratie

Dit is een geldig, direct bruikbaar voorbeeld voor `js/worlds/example-world/config.js`:

```javascript
export const EXAMPLE_CONFIG = {
  id: 'example-world',
  name: 'Example World',
  camera: {
    position: [0, 5, 20], rotation: [0, 0, 0],
    fov: 70, near: 0.1, far: 300
  },
  environment: { background: 0x10243a, fog: null },
  guidedJourney: false,
  audio: { sources: [] },
  settings: { object: { position: [0, 4, 0], rotationSpeed: 0.2 } }
};
```

`camera.position` en `rotation` zijn `[x,y,z]`-arrays; rotatie staat in radialen, Euler-volgorde YXZ. `fov` is in graden, `near` en `far` bepalen de zichtbare afstand. De engine gebruikt deze camera-instellingen ook voor R/reset. `environment.fog` is expliciet `null` zonder mist, of `{ type:'exp2', color:0x..., density:... }` dan wel `{ type:'linear', color:0x..., near:..., far:... }`. RGB-kleuren zijn getallen zoals `0x10243a`. `validateWorldConfig()` in `js/world-contract.js` controleert deze algemene velden. De betekenis van `settings.object` bepaalt en valideert de **wereld zelf**.

## 3. Schrijf de factory en lifecycle

Een kleine wereld kan volledig in `js/worlds/example-world/world.js` staan. Deze module gebruikt alleen de bestaande lokale Three.js:

```javascript
import * as THREE from '../../../lib/three/three.module.js';
import { EXAMPLE_CONFIG } from './config.js';

export function createExampleWorld({ config = EXAMPLE_CONFIG } = {}) {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(4, 4, 4);
  const material = new THREE.MeshBasicMaterial({ color: 0x79d5dc });
  const object = new THREE.Mesh(geometry, material);
  object.position.fromArray(config.settings.object.position);
  root.add(object);
  let disposed = false;

  return {
    config,
    init(scene) { scene.add(root); },
    update(dt) { object.rotation.y += dt * config.settings.object.rotationSpeed; },
    getAudioState() { return { distances: {} }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
      root.clear();
    }
  };
}
```

De engine roept `update(dt, camera)` in haar **enige renderloop** aan; een wereld maakt geen tweede loop of renderer. `init(scene)` voegt alleen eigen objecten toe. De engine bezit camera en scèneomgeving. `dispose()` verwijdert de eigen root én geeft eigen geometrieën, materialen en textures vrij. Alleen uit de scène verwijderen geeft GPU-resources niet vrij. Maak cleanup herhaalbaar en zorg dat ook een gedeeltelijk mislukte `init()` veilig opgeruimd kan worden. Deel een texture of materiaal niet tussen werelden zonder expliciete eigendomsafspraak.

## 4. Registreer de wereld en activeer haar

`js/world-registry.js` krijgt een **expliciete lijst**. Voeg in de pagina-adapter, bijvoorbeeld `js/main.js`, de factory-import en een registratie toe:

```javascript
import { createExampleWorld } from './worlds/example-world/world.js';

const registry = createWorldRegistry([
  { id: 'neon-city', create: createNeonCity },
  { id: 'example-world', create: createExampleWorld }
]);
```

De snippet hoort **in dezelfde module waar `createWorldRegistry` en `createNeonCity` al zijn geïmporteerd**; hij vervangt daar de bestaande registryregel. `js/main.js` gebruikt momenteel dynamische imports voor die modules, maar een extra statische import van de nieuwe factory is gewone ES-modulecode. Registreren toont de nieuwe wereld nog niet vanzelf. De page-adapter moet bij een expliciete wereldkeuze `await manager.switchWorld('example-world')` aanroepen en een eigen UI-element daarvoor aanbieden. De productiepaginaregistry bevat tijdens WP5 alleen Neon City. Het register weigert dubbele/ongeldige IDs, een ontbrekende factory, een afwijkend `config.id` en hergebruik van dezelfde wereldinstantie.

De World Manager valideert eerst de kandidaat, beëindigt dan de oude Journey, laat de oude audio uitfaden, ruimt de oude wereld op, stelt camera/omgeving in en initialiseert de nieuwe wereld. Een nieuwe wereld met muziek wacht in Safari op een **nieuwe Start audio-klik**. Bij een fout na de oude cleanup blijft een veilige lege toestand over; kies opnieuw een wereld om te herstellen. Er is geen automatische rollback.

## 5. Verwijs naar eigen lokale assets

De Test World geeft een concreet voorbeeld in [`tests/test-world.js`](../../tests/test-world.js): `settings.testObject.texture` bevat `../assets/worlds/test-world/signal.svg`. Vanuit die module maakt `new URL(setting.texture, import.meta.url).href` een lokaal, **module-relatief** pad. `THREE.ImageLoader` leest het bestand; na succes wordt een `THREE.Texture(image)` gemaakt en als `material.map` gekoppeld. Het bezit van deze texture blijft bij de wereld. In een module onder `js/worlds/example-world/` zou een equivalent pad `../../../assets/worlds/example-world/pattern.svg` zijn.

Asynchrone loads vragen een `disposed`-guard: een callback na een wereldwissel mag geen nieuwe texture maken of een verwijderd materiaal wijzigen. Een fout-callback kan een basismateriaal laten staan en een zichtbare of testbare foutstatus opleveren. De huidige engine wacht **niet** automatisch op asset-readiness; een wereld kan alvast met een fallback verschijnen. De afbeeldingsaanvraag zelf wordt in de fixture niet afgebroken. Voeg geen algemene Asset Manager toe zolang een echte toepassing dat niet nodig maakt.

## 6. Audio is optioneel

Zonder muziek gebruikt de config `audio: { sources: [] }` en retourneert `getAudioState()` `{ distances: {} }`. Met muziek beschrijft de wereld maximaal twee lokale MP3-bronnen. Een voorbeeld van de **bestaande API** is:

```javascript
audio: {
  sources: [
    { id: 'ambient', type: 'global',
      url: './assets/audio/ambient.mp3', gain: 0.55 },
    { id: 'object-music', type: 'proximity',
      url: './assets/audio/object-music.mp3', gain: 0.45,
      distanceKey: 'object',
      distance: { fadeStart: 90, fullVolume: 12 } }
  ]
}
```

Die paden zijn **pagina-relatief**, anders dan de module-relatieve Test World-textuur. De MP3-bestanden uit het voorbeeld moeten eerst lokaal bestaan; dit fragment is een geldige configuratievorm, geen meegeleverd muziekbestand. De wereld geeft in `getAudioState()` bijvoorbeeld `{ distances: { object: camera.position.distanceTo(object.position) } }` terug, met de actuele 3D-afstand. De Audio Manager wijzigt alleen de gain van de relevante bron en bezit de AudioContext/media-elementen. Verplaats audio-opruiming niet naar `world.dispose()`. Maximaal twee bronnen zijn vandaag ondersteund; een derde levert een duidelijke configuratiefout. De gebruiker moet in Safari na een wereldwissel opnieuw op **Start audio** klikken. Lokale MP3's staan in `.gitignore` en mogen niet per ongeluk worden gevolgd.

## 7. Guided Journey is optioneel

Voor `guidedJourney:true` moet de wereld `getJourneyRoute()` implementeren. De route heeft `duration`, afzonderlijke `positions` en `targets`, `isSafe(point)` en `planEntry(origin, begin)`. Optioneel is `entry` met `speed`, `minDuration`, `maxDuration`, `safetyStepSeconds`, `velocityMode` en `velocityFallback`. Het werkende 42-secondenvoorbeeld staat in [`WP4_JOURNEY_TIMING.md`](WP4_JOURNEY_TIMING.md) en [`tests/technical-route.js`](../../tests/technical-route.js). `js/journey/route-contract.js` valideert de route bij installatie. Een ruwe route in JSON kan tijden en punten opslaan, maar **niet** de veiligheidsfuncties; die blijven momenteel wereldspecifieke JavaScript-code.

De aanloop vanaf de actuele camerapositie telt niet mee in `duration`. De route moet op de eigen geometrie en veiligheidsmarges van de wereld worden afgestemd. Bemonstering langs het pad is geen mathematisch botsingsbewijs. De Test World en een eenvoudige nieuwe wereld zonder route houden `guidedJourney:false`, waarna de Journey-knop uitgeschakeld is.

## 8. Testen en veilig vervangen

Start in de projectmap `python3 -m http.server 8000`. Test `http://localhost:8000/tests/browser.html` en de echte MP3-test op `tests/audio-streaming.html`. Maak voor een nieuwe wereld gerichte fixtures in de bestaande browserrunner: valideer config/contract, objectinstellingen, assetladen, ontbrekend asset, laat resultaat na `dispose()`, A→B→A, reset, mist, audio, Journey (indien aanwezig) en resource-opruiming. Gebruik `tests/world-switching.html` als voorbeeld voor een testpagina; zij is geen productiefunctie. Controleer zichtbaar in Safari en vergelijk prestatiecijfers alleen onder gelijke omstandigheden.

Normaal hoeven `js/engine.js`, `js/camera.js`, `js/controls.js`, `js/world-manager.js`, `js/world-registry.js`, `js/audio/` en `js/journey/` **niet** te veranderen voor een derde handgeschreven wereld. Verwijderen uit het register voorkomt nieuwe activaties maar ruimt een **al actieve** wereld niet op; schakel eerst via `manager.switchWorld(andereId)` over of roep bij het afsluiten `manager.dispose()` aan. De manager stopt dan de route en audio, de engine roept `world.dispose()` aan en verwijdert de actieve scène. Laat een laat assetresultaat nooit de oude wereld opnieuw activeren.

Een toekomstige World Builder heeft bovendien een versioneerbaar opslagformaat, een beperkte catalogus met bekende objecttypen/gedrag, consistente asset-IDs/paden en veilige validatie nodig. Deze handleiding beschrijft hoe werelden **nu** met code worden toegevoegd; zij claimt geen editor, algemene objectgenerator of JSON-loader.
