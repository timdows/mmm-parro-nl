# MMM-Parro-NL

MagicMirror²-module die de nieuwste Parro-berichten uit alle actieve groepen
toont. De module logt via een lokale Chromium-browser in op
[Parro](https://talk.parro.com), bewaart de sessie en bearer-token lokaal en
stuurt nooit gebruikersnaam, wachtwoord of token naar de MagicMirror-frontend.

## Installeren

Vereist: Node.js 22 of nieuwer; Node.js 24 LTS wordt aanbevolen.

```bash
cd ~/MagicMirror/modules
git clone <repository-url> MMM-Parro-NL
cd MMM-Parro-NL
npm install
npx playwright install chromium
cp settings.example.json settings.json
```

Vul daarna `username` en `password` in `settings.json` in. Dit bestand en de
opgeslagen browsersessie staan in `.gitignore`.

Voeg de module toe aan `config/config.js` van MagicMirror:

```js
{
  module: "MMM-Parro-NL",
  position: "top_right",
  config: {
    title: "Parro",
    maximumEntries: 5,
  }
}
```

## Testen zonder MagicMirror

Een voorbeeldweergave zonder account:

```bash
npm run debug:mock
```

Een echte inlog- en ophaalpoging met `settings.json`:

```bash
npm run debug
```

Open daarna <http://localhost:8080>. Bij de echte test verschijnen technische
diagnosebestanden in `debug-output/`. Daarin wordt het wachtwoord nooit
opgeslagen. Deel bij problemen vooral `debug-output/summary.json`; screenshots
kunnen wel persoonlijke informatie bevatten.

## Instellingen

De niet-geheime weergave-instellingen staan in MagicMirror `config.js`:

| Optie | Standaard | Betekenis |
| --- | --- | --- |
| `title` | `Parro` | Kop boven de berichten |
| `maximumEntries` | `5` | Aantal getoonde berichten: `3` of `5` |
| `showGroup` | `true` | Groepsnaam tonen |
| `showDate` | `true` | Datum tonen |

Browser-, account- en synchronisatie-instellingen staan in `settings.json`:

| Optie | Standaard | Betekenis |
| --- | --- | --- |
| `archiveFile` | `data/messages.json` | Lokaal, oplopend berichtenarchief |
| `authFile` | `.cache/parro-auth.json` | Lokale bearer-token-cache |
| `syncIntervalMs` | `3600000` | Parro ieder uur synchroniseren |
| `maximumEntries` | `5` | `3` of `5` berichten in de debugpagina |

Bij het starten wordt direct gesynchroniseerd; daarna ieder uur. Alle actieve
groepen en alle pagina's met mededelingen worden opgehaald en gezamenlijk op datum
gesorteerd. Nieuwe berichten worden aan `data/messages.json` toegevoegd.
Berichten die later van Parro verdwijnen blijven dus lokaal bewaard. Bij iedere
pagina-refresh wordt de laatste selectie uit dit JSON-bestand gelezen.

Een nog geldige bearer-token in `.cache/parro-auth.json` wordt eerst hergebruikt.
Bij een verlopen of geweigerde token opent automatisch de OAuth-login en wordt de
cache vernieuwd. Zowel `.cache/` als het archief staan in `.gitignore`; behandel
beide desondanks als persoonlijke data. Zet `headless` tijdelijk op `false` als de
login handmatige actie of tweestapsverificatie vraagt.

## Media lokaal downloaden

Dit is uitsluitend een handmatige laptop/debugfunctie en wordt nooit door
MagicMirror of de uurlijkse berichtsync gestart. Eerst bekijken hoeveel foto's
beschikbaar zijn en hoeveel ruimte ze ongeveer innemen:

```bash
npm run media:scan
```

Alle foto's downloaden:

```bash
npm run media:download
```

Foto's, video's en documenten downloaden:

```bash
npm run media:download:all
```

Bestanden komen standaard per groep in `downloads/parro-media`. Pas dit aan met
`mediaDownloadDirectory` in `settings.json`. Een lokaal manifest zorgt ervoor dat
reeds gedownloade bestanden bij een volgende run worden overgeslagen. De gehele
map `downloads/` staat in `.gitignore`.

> Parro heeft geen gedocumenteerde publieke API voor deze module. Een wijziging
> aan de website kan daarom aanpassing van de extractor vereisen.
