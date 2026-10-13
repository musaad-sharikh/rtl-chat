# Contributing

Bug reports and pull requests are welcome.

## Reporting a problem

Open an issue at <https://github.com/musaad-sharikh/rtl-chat/issues> with:

- the site and the page, and whether you were signed in;
- your Firefox version and the RTL Chat version;
- the direction mode chosen for that site in the popup;
- what you expected and what you saw; a screenshot helps, with anything private
  removed.

A security problem is reported privately instead: see [SECURITY.md](SECURITY.md).

## Working on the code

The extension has no dependencies and no build step. You need Node.js and Firefox 142
or later.

```sh
npm test          # unit tests, then layout checks in headless Firefox
npm run lint      # web-ext lint
```

`npm test` starts a headless Firefox on a throwaway profile: a Flatpak Firefox when one
is installed, otherwise `firefox`, or the binary named in `FIREFOX`. `npm run lint`
downloads `web-ext` through `npx`, so it needs network access the first time.

Both must pass before a pull request. To try a change, load the extension from
`about:debugging#/runtime/this-firefox` with **Load Temporary Add-on…**.

What a change has to keep:

- No network requests, no remote code, no data collection.
- No runtime dependencies.
- No new permission without a reason a user would accept. Host access stays limited to
  the built-in sites, with every other site asked for one at a time.
- Site hosts and site-specific selectors live in `src/sites.js` only.
- A site's own navigation and layout are left alone.

A change in behaviour comes with a test: `tests/unit.test.js` for pure logic,
`tests/browser/` for anything that depends on real layout. `docs/live-testing.md`
says what has been checked against the real sites and how.

## Commits and licence

Commit messages follow Conventional Commits (`fix: …`, `feat: …`, `docs: …`), as the
history does.

Contributions are accepted under the project's MIT licence: by opening a pull request
you agree that your contribution is licensed under it.
