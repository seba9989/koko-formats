# @koko-anime/formats

Parser, zapis i walidacja formatów projektu **Koko-Anime** — polskiej ścieżki lektorskiej z syntezy Kokoro PL:

| Format | Plik | Klasa |
| --- | --- | --- |
| Koko-ASS v1 | `.ass` (nadzbiór ASS v4.00+) | `KokoAss` |
| Koko-Lexicon v1 | `koko-lexicon.toml` | `SeriesLexicon` |
| Koko-Pack v1 | `.kokopack` (ZIP) | `KokoPack` |

Działa w przeglądarce, Tauri i Node.js ≥ 20 (wymaga `crypto.subtle`, `Blob`, `TextEncoder`). Tylko ESM. Typy wymagają TypeScript ≥ 5.6 (starsze wersje tylko ze `skipLibCheck`).

```sh
npm i @koko-anime/formats
```

## Punkty wejścia

| Import | Zawartość |
| --- | --- |
| `@koko-anime/formats` | wszystko poniżej |
| `@koko-anime/formats/koko-ass` | `KokoAss`, `parseKokoAss`, `writeKokoAss`, `parseAssTime`, `formatAssTime` |
| `@koko-anime/formats/koko-lexicon` | `SeriesLexicon`, `compareCodePoints` |
| `@koko-anime/formats/koko-pack` | `KokoPack`, `sha256`, `videoFingerprint`, `isError` |
| `@koko-anime/formats/types` | typy i stałe ze specyfikacji (`KK_DIAGNOSTICS`, `KOKO_RULES_DEFAULTS`, …) |

## Koko-ASS

```ts
import { KokoAss } from '@koko-anime/formats/koko-ass';

const ass = KokoAss.parse(text);

ass.lektor.voice;                          // konfiguracja z wartościami domyślnymi
ass.get('Koko Rules', 'MaxSpeed');         // surowa wartość klucza
ass.set('Koko Rules', 'Numbers', 'auto');  // konfiguracja i diagnostyki przeliczone od razu
ass.events[0].text = 'Idę do pałacu.';     // style i zdarzenia ASS edytujesz wprost
ass.diagnostics;                           // KK0xx, w kolejności linii

const output = ass.toString();             // parse(output).toString() === output
```

Bez klasy: `parseKokoAss(text)` zwraca `{ document, diagnostics, layout }`, a `writeKokoAss(document, layout)` zapisuje z powrotem.

## Leksykon serii

```ts
import { SeriesLexicon } from '@koko-anime/formats/koko-lexicon';

const lexicon = SeriesLexicon.parse(toml);  // nie rzuca; zły plik → KL001/KL002 i `usable === false`
lexicon.find('Jinshiego');                   // wpis po kluczu, aliasie lub formie
lexicon.set('Maomao', { respell: 'Maomao', verified: true });
lexicon.flatten(episodeKeys).text;           // linie [Koko Lexicon] wg Koko-Lexicon §3
lexicon.toString();                          // TOML, klucze w kolejności kodów Unicode
```

## Koko-Pack

```ts
import { KokoPack, videoFingerprint } from '@koko-anime/formats/koko-pack';

const result = await KokoPack.open(bytes, { mode: 'edit' });
if (!result.ok) throw new Error(result.diagnostics.map((d) => d.code).join(', '));
const { pack } = result;

pack.subtitles;                              // KokoAss
pack.timeline;                               // null w profilu distribution lub po KP006/KP104
URL.createObjectURL(pack.audioBlob('lektor')!);
pack.matchVideo({ name: file.name, size: file.size, fingerprint: await videoFingerprint(file) });

const saved = await pack.save();             // przelicza hashe i `modified`, usuwa nieaktualne podpisy
```

Nowa paczka:

```ts
const pack = await KokoPack.create({
  generator: { name: 'Koko-Editor', version: '0.3.0' },
  subtitles: ass,
  seriesLexicon: lexicon,                   // spłaszczany do napisów, SeriesLexicon = none
  lektor: { track: { id: 'lektor', path: 'audio/lektor.mp3', codec: 'mp3', /* … */ }, data: mp3Bytes },
  timeline,                                 // z osią czasu → profil full, bez → distribution
});
```

## Diagnostyka

Żadna funkcja nie rzuca wyjątku z powodu błędnych danych. Problemy trafiają do `diagnostics` z kodami ze specyfikacji (`KK…`, `KL…`, `KP…`), poziomem (`error` / `warning` / `info`), miejscem i typowanymi danymi:

```ts
import type { KkDiagnosticOf } from '@koko-anime/formats/types';

const speed = ass.diagnostics.find((d): d is KkDiagnosticOf<'KK006'> => d.code === 'KK006');
speed?.data; // { key: string; value: string }
```

Odrzucenie paczki to `{ ok: false, diagnostics }` z `KokoPack.open`. Wyjątki oznaczają błąd programisty (np. `setProfile('full')` bez osi czasu).

## Walidacja (arktype)

Wartości w plikach są sprawdzane schematami [arktype](https://arktype.io). Schematy są eksportowane, więc te same reguły możesz użyć np. w formularzu ustawień edytora:

```ts
import { type } from 'arktype';
import { LEKTOR_VALUES } from '@koko-anime/formats/koko-ass';
import { MANIFEST } from '@koko-anime/formats/koko-pack';

const speed = LEKTOR_VALUES.speed(input.value);       // { speed: 1.25 } albo ArkErrors
if (speed instanceof type.errors) input.setCustomValidity(speed.summary);

const manifest = MANIFEST(JSON.parse(text));          // kształt manifest.json z opisem błędów
```

Opis błędu trafia do `diagnostic.message` (komunikaty arktype są po angielsku). Kod diagnostyki, poziom i typowane `data` pozostają takie jak w specyfikacji.

## Ograniczenia

- Brak przetwarzania tekstu mówionego: adnotacji `{!kk …}`, klasyfikacji linii, rozwijania liczb, łączenia i dopasowania czasowego.
- `KokoPack` nie liczy kluczy wypowiedzi (JCS), nie dopasowuje osi czasu (§6.3) i nie podmienia ramek MP3 (§4.1); przyjmuje gotowy `Timeline`.
- Podpisy (`signatures.json`) są odczytywane, ale nie weryfikowane (Ed25519, rejestr twórców).
- Symlinki w archiwum nie są wykrywane; cała paczka jest trzymana w pamięci; paczki > 4 GiB (ZIP64) nie były testowane.
- Komentarze w `[Script Info]` i nieznane pola najwyższego poziomu w TOML nie przetrwają zapisu.

## Rozwój

```sh
npm install
npm run check     # typecheck + testy (vitest)
npm run build     # dist/ z .d.ts i source mapami
npm pack --dry-run
```

## Licencja

Kod: MIT. Specyfikacje Koko-ASS, Koko-Lexicon i Koko-Pack: CC BY 4.0.
