# World Engine v1.0 — WP4: Guided Journey en timing

Status: uitgevoerd op `feature/world-engine-v1` vanaf goedgekeurde WP3-commit `acef6ae`. Dit document beschrijft uitsluitend WP4. Er is geen commit, push, merge, nieuwe artistieke wereld of extra runtime-afhankelijkheid gemaakt.

## Doel en resultaat

De bestaande Journey-motor kan nu vóór gebruik routegegevens controleren, een wereldspecifieke aanloop instellen en dezelfde begrensde visuele frametijd gebruiken als de wereldanimatie. Neon City behoudt **dezelfde positie- en kijkdoelpunten** en een route van 90 seconden. Een technische testfixture gebruikt de motor met een route van 42 seconden en andere aanloopwaarden.

```text
Wereldconfiguratie
    ↓
Wereldspecifieke route (tijd, posities, kijkdoelen, aanloop, veiligheid)
    ↓
validateJourneyRoute() — eenmaal bij het installeren
    ↓
createJourney() + createFlightModes() — aanloop, klok, camera-eigenaarschap
    ↓
Camera → bestaande renderer en één renderloop

actieve frametijd ───────────────→ Journey én world.update()
getAudioState() ─────────────────→ bestaande onafhankelijke audiomotor
```

Een **routepunt** is een tijdstip plus drie 3D-coördinaten. De positiecurve bepaalt waar de camera staat; de kijkdoelcurve bepaalt waar zij naar kijkt. De motor gebruikt nog steeds de bestaande `CatmullRomCurve3`-interpolatie. Een **aanloop** verbindt de huidige camerastand met het eerste routepunt; haar duur telt niet mee in `duration`.

## Routecontract en validatie

Een route levert `duration`, `positions`, `targets`, `isSafe(point)` en `planEntry(origin, begin)`. `positions` en `targets` zijn aparte lijsten van `{ time, value: [x, y, z] }`; elk begint op tijd 0, eindigt op `duration` en bevat minstens twee punten. Een route kan optioneel `entry` bevatten. `null` als route blijft toegestaan voor een wereld zonder Journey.

`js/journey/route-contract.js` valideert een eindige, positieve duur; oplopende en eindige tijden; eindige coördinaten; beide veiligheidsfuncties; en bekende, geldige aanloopinstellingen. De twee onafhankelijke curves worden bij route-installatie op sleutelpunten en tussenliggende tijden gecontroleerd op een samenvallend kijkdoel en camerapunt. Dit is een gerichte steekproef, geen wiskundig bewijs voor alle tussentijden. De validatie draait **niet per frame**.

`createFlightModes().setRoute(route)` maakt en valideert eerst de nieuwe Journey. Bij een fout blijft een reeds actieve geldige route intact. Tijdens een wereldwissel heeft de engine de oude route al verwijderd; als de nieuwe route faalt na `init()`, ruimt de engine de nieuwe wereld op en meldt de World Manager een herstelbare lege toestand. Oude routecallbacks kunnen de camera dan niet meer wijzigen.

Bij het starten controleert de motor daarnaast de actuele camera, beginvelocity en teruggegeven aanlooppunten. Een planner moet beginnen op de **huidige** positie en eindigen op het eerste routepunt. Ongeldige gegevens of een onveilige aanloop starten geen halve cameramodus. Het besturingspaneel toont een begrijpelijke melding.

### Concreet voorbeeld: route van 42 seconden

Dit is dezelfde gegevensvorm als de werkende fixture in `tests/technical-route.js`. De `THREE.Vector3`-objecten voor `planEntry` worden door de motor doorgegeven; de functie levert die objecten terug.

```javascript
export function createExampleRoute() {
  const isSafe = point => point.y > 1;
  return {
    duration: 42,
    positions: [
      { time: 0, value: [0, 5, 20] },
      { time: 12, value: [0, 7, 5] },
      { time: 26, value: [6, 8, -10] },
      { time: 42, value: [0, 6, -25] }
    ],
    targets: [
      { time: 0, value: [0, 6, 0] },
      { time: 14, value: [2, 7, -14] },
      { time: 28, value: [1, 8, -28] },
      { time: 42, value: [0, 7, -42] }
    ],
    entry: {
      speed: 4,
      minDuration: 3,
      safetyStepSeconds: 0.04,
      velocityMode: 'inherit',
      velocityFallback: 'zero'
    },
    isSafe,
    planEntry(origin, begin) {
      if (!isSafe(origin) || !isSafe(begin)) return null;
      return [origin, begin];
    }
  };
}
```

In een echte wereld moet `isSafe` rekening houden met haar eigen geometrie en veiligheidsmarges. `planEntry` mag een omweg met extra punten teruggeven. De eenvoudige voorbeeldplanner controleert zelf geen gebouwen; hij is geschikt als technische fixture, niet als algemene botsingsplanner.

## Configureerbare aanloop

De optionele `entry`-instellingen zijn:

| Instelling | Betekenis | Standaard |
| --- | --- | --- |
| `speed` | Gewenste snelheid waarmee segmentduur wordt berekend. | `16 / 1.875` wereldeenheden/s |
| `minDuration` | Minimale duur per aanloopsegment. | `2.5` s |
| `maxDuration` | Optionele bovengrens per segment. | Geen bovengrens |
| `safetyStepSeconds` | Tijdstap waarmee de gebogen aanloop op veiligheid wordt bemonsterd. | `0.04` s |
| `velocityMode` | `inherit` gebruikt Free Flight-startvelocity; `zero` begint rustig. | `inherit` |
| `velocityFallback` | `zero` probeert bij een onveilige geërfde snelheid opnieuw met nul; `reject` weigert de start. | `zero` |

Deze defaults leveren dezelfde aanloopduurformule en fallback als vóór WP4. Als de veiligheidscontrole naar nulvelocity terugvalt, geeft `getState().entryFallback` dit expliciet aan en meldt de UI het tijdens de aanloop. De overgedragen velocity bij een onderbreking komt dan uit de **werkelijk gekozen** aanlooppad, niet uit de afgewezen startsnelheid. Een fallback naar nul kan voelbaar vertragen; voor een wereld waar dat ongewenst is, kan `velocityFallback: 'reject'` worden gekozen.

Neon City heeft daarnaast in `config.settings.journey` de bestaande marge `clearance: 0.8` rond gebouwen en `coreRadius: 13.5` rond de kern. `journey-route.js` blijft eigenaar van die wereldspecifieke veiligheidsregels en de omwegplanning. De gedeelde Journey-motor kent geen Neon City-gebouwen. De veiligheidscontrole gebruikt samples langs het pad; zij garandeert geen mathematische botsingsvrijheid tussen samples.

## Actieve visuele tijd

`js/active-time.js` levert één actieve `deltaTime` per frame: de verstreken tijd, begrensd op **0,05 seconde**. `js/engine.js` geeft precies die waarde eerst aan `flightModes.update()` en daarna aan `world.update()`. Voorheen kon de Journey bij een uitzonderlijk frame de volledige vertraging verwerken terwijl wereldanimaties slechts 50 ms kregen. Na een verborgen tab of wereldwissel is de eerstvolgende actieve delta nul, omdat de vorige tijdstempel wordt gewist.

Een browserhapering van 500 ms of 2 seconden verplaatst de camera dus hoogstens 50 ms langs de route in dat frame. De vlucht kan daardoor iets langer duren in **werkelijke kloktijd**. Bij normale 30, 60 en 120 FPS blijft `duration` de opgegeven actieve routetijd. De prestatie-HUD meet ruwe frametijd voor FPS/P95; die ruwe tijd stuurt de camera niet aan. De Web Audio-klok, muziektijdlijnen en afstandsmix zijn niet gewijzigd: een browserhapering pauzeert audio niet automatisch. Exacte synchronisatie met muzikale tijdcodes valt buiten WP4.

## Camera, onderbreking en World Manager

In Free Flight beweegt alleen `controls.update()` de camera. Bij de start verplaatst de Journey de camera niet ineens; daarna bestuurt eerst de aanloop en dan de route haar positie en oriëntatie. Bij stoppen geeft `flightModes.stop()` de huidige pose en berekende velocity terug aan Free Flight. R onderbreekt en herstelt de startpose van de actieve wereld. Een voltooide route schakelt automatisch terug naar Free Flight. Een verborgen tab verzamelt geen voortgang.

Voor een exact verticale kijkrichting bewaart de motor de huidige yaw (draairichting rond de verticale as), begrenst de pitch net vóór ±90° en houdt roll op nul. Zo ontstaan geen ongeldige rotaties door een onbepaalde horizontale richting. Een samenvallend kijkdoel wordt bij routevalidatie afgewezen. Een niet-eindige cameraoriëntatie bij start wordt gecontroleerd geweigerd.

De WP3-World Manager blijft de eigenaar van de wereldwissel. `engine.suspendWorld()` beëindigt direct de oude Journey en verwijdert de route vóór audiofade en opruiming. Alleen de nieuwe wereld kan daarna een route installeren. Een routefout volgt dezelfde herstelbare foutweg als een fout tijdens wereldinitialisatie. Audio wordt bij Free Flight ↔ Journey niet opnieuw gestart of gepauzeerd.

## Bestanden en tests

Nieuw: `js/active-time.js`, `js/journey/route-contract.js`, `tests/technical-route.js`, `tests/wp4.js` en dit document.

Gewijzigd: `js/journey/journey.js`, `timed-path.js`, `flight-modes.js`; `js/engine.js`; `js/ui/flight-panel.js`; `js/worlds/neon-city/config.js` en `journey-route.js`; module-imports in `world.js`, `main.js`, `index.html` en betrokken bestaande browser-/audiotests. Geen geometrie, muziekbestand, Web Audio-mixformule, rendererinstelling of CatmullRom-curveformule is aangepast.

Automatisch in Safari via `tests/browser.html`: **214 PASS, 0 FAIL** (164 bestaande WP1–WP3- en regressiechecks plus 50 WP4-checks). De WP4-controles dekken een geldige 90- en 42-secondenroute, ongeldige velden, configureerbare aanloop en velocityfallback, 30/60/120 FPS, lange frames, verticale blik, verborgen tab, routevervanging, wereldwissel, routefout en herstel. De tests simuleren een lange stall via de gedeelde klokfunctie; zij zijn geen GPU-benchmark. De bestaande test van de volledige route simuleert 90 × 120 frames en controleert eindpositie, duur en veiligheidssamples.

In de echte Safari-pagina startte de 90-seconden-Journey vanuit de normale startpositie. De aanloop was afzonderlijk zichtbaar; na de volledige vlucht stond de UI weer op Vrije vlucht, met audio nog op afspelen. De lokale streamingtest gaf **7 PASS, 0 FAIL**: beide echte MP3's startten na een klik, bleven onafhankelijk lopen bij Journey-wissels, pauzeerden en hervatten, en een ontbrekend bestand gaf een begrijpelijke fout. De technische wereldwisselpagina bevestigde Neon City → Test World → Neon City tijdens een Journey, opnieuw starten en herstel na de opzettelijke foutwereld zonder pagina-herlaadbeurt. De zichtbare HUD liet tijdens een korte observatie 60 FPS en 10 drawcalls zien; dit is **geen reproduceerbare prestatiebenchmark** en bewijst geen FPS-verbetering. `git diff --check` slaagde. MP3-bestanden blijven door `.gitignore` buiten Git. Er is geen extra renderloop of cameracontroller toegevoegd.

## Grenzen en vervolg

- Veiligheid en samenvallende kijkrichting worden op samples gecontroleerd. Een toekomstige wereld moet haar eigen marges, geometrie en route zorgvuldig ontwerpen en testen.
- Een expliciete `maxDuration` kan een ver segment versnellen. Kies die alleen als de wereldroute dat toelaat.
- De visuele klok houdt een lage FPS of lange stall veilig, maar de Journey kan dan langer duren volgens de wandklok. Audiotijdcodes volgen niet automatisch mee.
- De technische 42-secondenroute is geen World 02. Voor WP5 blijven een echte tweede wereld, eigen compositie/route en de bijbehorende artistieke en prestatiecontroles over. Die zijn in WP4 niet gestart.

Zelf controleren: start `python3 -m http.server 8000`; open `http://localhost:8000`, `tests/browser.html`, `tests/audio-streaming.html` en `tests/world-switching.html`. Laat in de hoofdpagina de Guided Journey inclusief aanloop volledig uitlopen; controleer R, onderbreken en audio. Wissel op de technische testpagina tijdens Journey naar Test World en terug. De routepunten en sfeer van Neon City zijn artistiek niet herwerkt.
