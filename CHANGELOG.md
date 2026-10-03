# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersje: [SemVer](https://semver.org/lang/pl/).
Do 1.0.0 zmiany niezgodne mogą pojawić się w wersji minor.

## [0.2.0] — 2026-10-03

### Zmienione

- Walidacja oparta na [arktype](https://arktype.io): wartości sekcji `[Koko …]`, wpisy `[Koko Sources]`,
  struktura `koko-lexicon.toml`, `manifest.json`, `timeline.json` i `signatures.json`.
- Diagnostyki z błędem walidacji mają opis w `message` (np. `must be at most 2 (was 5)`,
  `audio[0].channels must be 1 or 2 (was 3)`).
- Manifest: sprawdzane są reguły Opus (§4: `sampleRate` 48000, `spliceable` nie `true`).

### Dodane

- Eksport schematów: `LEKTOR_VALUES`, `RULES_VALUES`, `STYLE_PARAM_VALUES`, `SOURCE_FIELDS` (koko-ass),
  `LEXICON_HEADER`, `ENTRY_FIELDS` (koko-lexicon), `MANIFEST`, `TIMELINE`, `TIMELINE_UTTERANCE`,
  `SIGNATURES`, `AUDIO_TRACK` (koko-pack).
- Kontrola w czasie kompilacji, że wynik schematów pasuje do typów specyfikacji.

## [0.1.0] — 2026-10-03

### Dodane

- Typy i stałe dla Koko-ASS v1, Koko-Lexicon v1 i Koko-Pack v1 (`@koko-anime/formats/types`).
- `parseKokoAss`, `writeKokoAss` i klasa `KokoAss` — odczyt, edycja kluczy `[Koko …]` i zapis `.ass`
  z zachowaniem kolejności sekcji, linii `Format:`, końców linii i BOM. Diagnostyka KK0xx.
- Klasa `SeriesLexicon` — `koko-lexicon.toml`: walidacja (KL001–KL006), spłaszczanie do `[Koko Lexicon]`
  wg §3, `embedInto` dla Koko-Pack.
- Klasa `KokoPack` — otwieranie `.kokopack` z kontrolą spójności (§6.1), dopasowanie wideo, zapis
  z przeliczeniem hashy; `sha256`, `videoFingerprint`.
