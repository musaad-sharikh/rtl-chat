# RTL Chat

A Firefox extension that gives Arabic, Persian, Hebrew and Urdu text the right direction
on AI chat sites.

Chat sites lay everything out left-to-right: Arabic paragraphs hug the left edge, list
numbers sit on the wrong side, and the composer starts from the left. RTL Chat fixes
that per paragraph, so an Arabic paragraph goes right-to-left and an English one in the
same reply stays as it is. Code and math always stay left-to-right, and the site's own
navigation is left alone.

## Sites

Works out of the box on ChatGPT, Claude, Gemini, Google AI Studio, Copilot, DeepSeek,
Perplexity, Grok, Le Chat and Poe.

On any other site, open the popup and choose **Enable on this site**. Firefox asks for
access to that one site; **Remove this site** gives it back.

## Modes

- **Automatic** — each paragraph, list and table follows its own first letter.
- **Always right-to-left** — every message is right-to-left whatever its language.

Each site can be switched off from the popup.

## Privacy

The extension makes no network requests and collects nothing. Its settings live in
Firefox's own sync storage.

## Trying it

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** and pick `manifest.json`.

A temporary add-on is removed when Firefox closes.

## Development

No dependencies and no build step. Needs Node.js and Firefox 142 or later.

```sh
npm test          # unit tests, then layout checks in headless Firefox
npm run lint      # web-ext lint
npm run build     # zip for AMO in web-ext-artifacts/
```

The layout checks run the real content script against `tests/browser/fixture.html` and
measure where the text ends up. A Flatpak Firefox is used when one is installed; set
`FIREFOX` to use a specific binary.

`src/sites.js` is the only file that knows site hosts and site-specific selectors. The
hosts there must match `host_permissions` in `manifest.json`; a unit test checks it.

## Licence

MIT — see [LICENSE](LICENSE).
