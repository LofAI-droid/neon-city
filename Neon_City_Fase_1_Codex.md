# Neon City — ontwikkelopdracht fase 1 (v0.1)

## Opdracht en toestemming
De projecteigenaar heeft **expliciet toestemming gegeven voor ontwikkelfase 1** van Neon City. Deze toestemming geldt **niet** voor fase 2 of verdere uitbreiding.

Je bent de AI-codeerassistent voor een interactieve artistieke 3D-wereld die in de browser draait. Werk uitsluitend in de bestaande, lokaal geopende projectmap `neon-city` op de MacBook Air M4.

**Visuele referentie:** `neon-city-visual-reference.jpg` in de hoofdmap. Als dit bestand ontbreekt, vraag de gebruiker eerst om het toe te voegen. Gebruik het als creatieve referentie, niet als platte achtergrond: de stad moet echt in 3D kunnen worden verkend.

## 1. Doel van v0.1
Bouw een **werkend, licht en overdraagbaar prototype** van een futuristische wireframe-stad, visueel zo dicht mogelijk bij de referentie. De gebruiker kan er vrij doorheen vliegen.

De wereld bevat:
- Een zeer donkere, bijna zwartpaarse achtergrond.
- Een cyaankleurige rastervloer die in de verte vervaagt.
- Een brede centrale straat met tientallen transparante wireframe-gebouwen aan weerszijden.
- Gevarieerde bouwhoogtes, silhouetten, verdiepingslijnen en fijne architectuurdetails; geen grote massieve neonblokken.
- Subtiele blauwe, turquoise en enkele goudkleurige accenten.
- Een zwevende, lichtgevende energiekern midden in de verte, voorlopig eenvoudig geanimeerd.
- Afstandsmist, perspectief en compositie die een grotere stad suggereren, hoewel de wereld afgebakend is.

De referentie is de visuele maatstaf. Verlies geen tijd aan visuele onderdelen die pas in volgende fasen nodig zijn.

## 2. Harde technische randvoorwaarden
- Alleen **HTML, CSS en vanilla JavaScript (ES-modules)**.
- Gebruik **Three.js** voor 3D-rendering.
- **Geen Node.js, npm, Vite, TypeScript, transpilers, bundlers, framework of buildstap.**
- **Geen backend en geen database.**
- Geen externe CDN, API of online asset-requests **tijdens runtime**: de benodigde vaste versie van Three.js en alle gebruikte uitbreidingen staan lokaal onder `lib/`.
- Gebruik uitsluitend **relatieve bestandspaden** en zorg dat de volledige map eenvoudig te verplaatsen is.
- De app draait vanaf de reeds beschikbare eenvoudige Python-webserver: `python3 -m http.server 8000 --bind 127.0.0.1`, vanuit de projectmap.
- Richt je op **Safari op MacBook Air M4**; andere desktopbrowsers zijn welkom, smartphoneoptimalisatie volgt later.
- Gebruik zo weinig mogelijk afhankelijkheden; als je een bibliotheek moet downloaden, vraag daarvoor eerst toestemming en leg uit welke bestanden worden toegevoegd.

## 3. Modulaire maar sobere architectuur
Houd de engine gescheiden van de specifieke wereld:
- `index.html` en `style.css`: pagina en minimale interface.
- `js/main.js`: opstarten.
- `js/engine.js`: scene, renderer en renderloop.
- `js/camera.js` en `js/controls.js`: camera en vrije vlucht.
- `js/worlds/neon-city/world.js`: wereldinitialisatie en -levenscyclus.
- `js/worlds/neon-city/buildings.js`, `grid.js`, `sphere.js`: wereldobjecten.
- `lib/three/`: lokaal opgeslagen, onderling compatibele Three.js-modules.
- `assets/`: alleen waar nodig.
- `README.md`: start-, test- en overdrachtsinstructies.

Gebruik waar zinvol een eenvoudige `init()`, `update(deltaTime)` en `dispose()`-structuur. Vermijd overengineering. Zorg dat een tweede wereld later kan worden toegevoegd zonder besturing en renderer te herschrijven.

## 4. Navigatie
Vrij vliegen in drie dimensies, **zonder zwaartekracht**:
- Pijltje omhoog/omlaag: vooruit / achteruit.
- Pijltje links/rechts: draaien naar links / rechts.
- A / D: zijwaarts bewegen.
- Spatie / Shift: stijgen / dalen.
- Muis: optioneel rondkijken; voorzie een duidelijke manier om muisbesturing te activeren/deactiveren.
- R: terug naar de startpositie.

Maak beweging vloeiend, met zachte acceleratie en vertraging, onafhankelijk van de framerate. Voeg een compacte toetsenlegenda toe. Laat browserstandaardgedrag (zoals scrollen via pijltjes of spatie) de besturing niet hinderen.

## 5. Efficiëntie en robuustheid
- Richtwaarde: vloeiende weergave, bij voorkeur circa 60 FPS op de MacBook Air M4; meet of rapporteer waar mogelijk, beloof geen gegarandeerde framerate.
- Hergebruik waar mogelijk geometrie en materialen, beperk drawcalls en onnodige overdraw.
- Genereer gebouwvariatie reproduceerbaar met een vaste random seed.
- Beperk zware textures, realistische schaduwen en postprocessing in deze eerste fase.
- Verwerk schermresizes correct; ruim WebGL-bronnen op bij wisseling/verwijdering van een wereld.
- Controleer consolefouten en ontbrekende bestanden.

## 6. Bewust buiten fase 1
**Nog niet implementeren:**
- Muziek, ruimtelijke audio of audio-reactiviteit (houd uitbreiding mogelijk).
- Guided Journey / automatische cameratrajecten (wel toekomstige ontwerpkeuze).
- Geavanceerde bloom, complexe deeltjessystemen of gedetailleerde energiebolshader.
- Portalen of andere werelden.
- Smartphonebesturing.
- GitHub Pages-publicatie.

## 7. Veiligheid, rechten en versiebeheer
- Werk uitsluitend in de geopende projectmap `neon-city`.
- Bekijk eerst de bestaande bestanden en behoud alles wat er al staat; verwijder geen gebruikersbestanden.
- Voer geen destructieve terminalopdrachten uit.
- Installeer geen Node.js of andere buildtools.
- Vraag expliciete toestemming voor downloads, internettoegang die extra rechten vereist of toegang buiten de projectmap.
- Maak geen automatische Git-commit en push niets naar GitHub.
- Rapporteer de aangemaakte en gewijzigde bestanden.

## 8. Acceptatiecriteria
Fase 1 geldt als opgeleverd als:
1. `http://localhost:8000` de app toont via de Python-webserver.
2. Het beeld herkenbaar aansluit bij de referentie: raster, hoge wireframe-gebouwen, donkere diepte en centrale energiekern.
3. De gebruiker volledig vrij kan vliegen, inclusief stijgen en dalen.
4. De beweging vloeiend is en toetsen betrouwbaar werken.
5. De gedeelde motor en Neon City-wereld gescheiden en herbruikbaar zijn.
6. Alle uitvoeringsafhankelijkheden lokaal aanwezig zijn; geen runtime-CDN's of netwerkrequests nodig zijn.
7. De hele projectmap zonder buildstap verplaatsbaar blijft.
8. `README.md` beschrijft hoe je start en test, en de belangrijkste mappen.

Test dit zo grondig mogelijk. Als je geen toegang hebt tot Safari om visueel te testen, geef duidelijk aan welke controles de gebruiker lokaal moet uitvoeren.

## 9. Gevraagde oplevering
Meld na fase 1 beknopt:
- welke bestanden zijn aangemaakt of gewijzigd;
- wat daadwerkelijk werkt en wat nog niet;
- welke tests je hebt uitgevoerd, met eventuele beperkingen;
- hoe de gebruiker het prototype in Safari opent;
- welke punten expliciet wachten op fase 2.

**Stop na fase 1 en wacht op nieuwe toestemming.**
