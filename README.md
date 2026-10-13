# RTL Chat

A Firefox extension that gives Arabic, Persian, Hebrew and Urdu text the right direction
on sites that lay everything out left-to-right.

On such a site, Arabic paragraphs hug the left edge, list numbers sit on the wrong side,
and a text box starts from the left. RTL Chat fixes that per paragraph, by the language
most of the paragraph is written in: an Arabic paragraph goes right-to-left even when it
opens with a word like "JavaScript", and an English one beside it stays left-to-right.
Code and math always stay left-to-right, and the site's own navigation is left alone.

## Sites

ChatGPT and Claude are supported from the start, with nothing to set up.

On any other site, open the popup and choose **Enable on this site**. Firefox asks for
access to that one site, and the site stays enabled until you choose **Remove this
site**, which gives the access back. RTL Chat does nothing on a site that was not
enabled.

Firefox's own settings can also give an extension access to all websites, on its
Permissions tab in `about:addons`. If you switch that on, RTL Chat works on every site
and the popup says where the access came from. Each site can still be switched off on
its own.

A site you enable gets the general rules; nothing in RTL Chat is written for it in
particular. How well they fit depends on how the site is built. RTL Chat is tested on
ChatGPT and Claude and does not claim to work on every site.

## Modes

- **Automatic** — each paragraph, list and table follows the language it is written in.
- **Always right-to-left** — all text is right-to-left whatever its language.

The mode is chosen per site, and each site can be switched off on its own from the
popup.

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

`tests/live/` checks the extension against the real sites; `docs/live-testing.md` says
how, and what has and has not been checked. `docs/manual-test-plan.md` is the test a
person runs, signed in, on both sites.

`src/sites.js` is the only file that knows site hosts and site-specific selectors. The
hosts there must match `host_permissions` in `manifest.json`; a unit test checks it.

## Licence

MIT — see [LICENSE](LICENSE).
