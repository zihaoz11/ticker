# @aleabitoreddit raw corpus

This directory stores raw public post records collected from the Nitter view of:

- X profile: `https://x.com/aleabitoreddit`
- Nitter profile: `https://nitter.net/aleabitoreddit`

## Files

- `2026-04-27_initial_backfill.jsonl`: first run backfill for visible posts from the previous week, collected on 2026-04-27.

## JSONL fields

- `schema_version`: record schema version.
- `source`: upstream source used for collection.
- `account`: X handle.
- `collected_at_utc`: collection timestamp.
- `collection_window`: requested backfill window.
- `published_label`: timestamp label shown by Nitter when an exact timestamp is unavailable.
- `source_url`: source page used for collection.
- `visibility`: `public` or `restricted`.
- `text`: raw visible post text when public.
- `tickers`: ticker-like symbols mentioned in the visible text.
- `notes`: collection caveats.

The initial run used the Nitter HTML page because the RSS endpoint returned an empty `200 OK` response in the local automation environment.
