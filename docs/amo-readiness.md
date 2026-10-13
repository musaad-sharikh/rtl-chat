# AMO readiness

What was checked before submitting RTL Chat to addons.mozilla.org (AMO), where each
fact came from, and what is still open. Everything was read on 2026-10-13. A test
build, 0.9.0, has been submitted for signing in the unlisted channel; nothing has been
submitted for listing.

## Name, add-on URL and add-on ID

Source: AMO's public API, `https://addons.mozilla.org/api/v5/addons/`.

| Question | Reading | What it shows |
|---|---|---|
| Is the add-on URL `rtl-chat` taken? | `addon/rtl-chat/` answers 404; so do `rtlchat` and `rtl_chat` | No public add-on uses it |
| Is the add-on ID `rtl-chat@musaad-sharikh` taken? | `addon/rtl-chat@musaad-sharikh/` answers 404 | No public add-on uses it |
| Is another add-on named exactly "RTL Chat"? | `search/?q=rtl chat`, Firefox extensions, the first 150 of 1335 results by relevance, every locale of each name | None |

The public API shows public listings only. An add-on that is unlisted, disabled or
deleted would not appear, so a 404 does not prove the URL or the ID was never used. AMO
checks both for good at submission: it warns when the URL is taken, and the URL is
assigned from the name unless edited.

A similar name and a conflicting identifier are different things. Only the URL and the
ID must be unique. Names need not be: three separate public add-ons are each called
"ChatGPT RTL" (`chatgpt_rtl`, `chatgptrtl`, `chatgpt-rtl-extension`).

Names close to this one, none identical, none sharing its URL or ID:

| Name | Add-on URL | Add-on ID | Daily users |
|---|---|---|---|
| RTL Chat Converter | `rtl-chat-converter` | `rtl-chat-converter@edrisahani.com` | 1 |
| RTL Chatbot Notion Perplexity Gemini Claude Duck | `rtl-chatbot-companion` | `{2794e354-d57c-4417-ab10-6e2e4a3ea272}` | 135 |
| AI Chat RTL Support | `ai-chat-rtl-support` | an email address, not copied here | 275 |
| Claude RTL | `claude-rtl` | `claude-rtl@example.com` | 261 |
| Arabic RTL for ChatGPT & Claude | `كايزن-rtl-تحسين-اتجاه-الكتابة` | `kaizen-rtl@x-kaizen.com` | 3 |

The user counts are a snapshot of that day.

## Manifest, permissions and package

| Item | State |
|---|---|
| `npm run lint` (web-ext lint) | 0 errors, 0 warnings, 0 notices |
| `npm test` | 20 of 20 unit tests, 106 of 106 layout checks in headless Firefox 158 |
| Manifest version, add-on ID, minimum Firefox | 3, `rtl-chat@musaad-sharikh`, 142.0 |
| Data collection declaration | `data_collection_permissions.required` is `["none"]` |
| Permissions | `storage`, `scripting`, `activeTab` |
| Host access from the start | `https://chatgpt.com/*`, `https://claude.ai/*` |
| Host access on request | `optional_host_permissions` `*://*/*`, asked for one site at a time |
| Network requests, remote code, `eval`, `innerHTML` in `src/` | none found |
| Summary length | 148 characters in English, 130 in Arabic |
| Package | `web-ext-artifacts/rtl_chat-1.0.0.zip`, from `npm run build`: the manifest, `LICENSE`, two icons, two locales and the eight files of `src/`; no tests, no docs |

Each permission is one the extension uses; what for is in the reviewer notes in
`docs/amo-listing.md`. `*://*/*` is what lets "Enable on this site" ask for a site
nobody listed in advance, and it grants nothing until the user accepts a prompt for one
site.

The package is built from the working tree. It has to be rebuilt from the commit that
is submitted.

What Firefox does with these permissions is in "Site access the user can change in
Firefox" below.

## Site access the user can change in Firefox

Read from Firefox 158 itself, in the throwaway profile `tests/live/` uses. MDN's
`optional_host_permissions` page says the same in general terms: users may opt in or
out of optional host permissions from the extension's Permissions tab.

| Observation | Result |
|---|---|
| What "Enable on this site" grants on duck.ai | exactly `https://duck.ai/*` |
| What Firefox stores for the added site | the host permission, and the content script with `persistAcrossSessions: true` |
| Switches on the Permissions tab of `about:addons` | "Access your data for all websites" (`*://*/*`), off unless the user turns it on, and one per site: the two built-in sites and each added site |

The extension cannot hide the "all websites" switch: it comes with the optional host
access that "Enable on this site" needs. It follows the switch instead. What it does on
each change to a site's access is measured in `docs/live-testing.md`.

## Testing across a restart

Sources: Extension Workshop, `develop/testing-persistent-and-restart-features/` and
`publish/signing-and-distribution-overview/`; `develop/web-ext-command-reference/`;
the add-ons server API documentation,
`https://mozilla.github.io/addons-server/topics/api/addons.html`.

A temporary add-on is unloaded when Firefox stops, so it cannot show restart behaviour.
Mozilla documents two ways to an extension that survives one:

| Way | What it takes | What it costs |
|---|---|---|
| An unsigned package in Firefox Nightly or Developer Edition, with `xpinstall.signatures.required` off, installed from file. This is the method Mozilla's restart-testing page gives. | Installing another Firefox | Nothing on AMO; can be repeated after every change |
| A package signed by AMO for self-distribution, the unlisted channel, installed in the ordinary Firefox. Signed through the Developer Hub ("On your own") or `web-ext sign --channel unlisted`. | A Mozilla account and API credentials; a submission to Mozilla, under its add-on policies | The add-on ID is registered to the account; signing can take up to 24 hours, longer if picked for manual review; every re-test after a change needs a new version number |

A version number must be unique across all channels, and a listed version must be
higher than every version signed before it. A build signed for this test therefore has
to carry a lower number than the one meant for the listing, 1.0.0.

Nothing has been signed and nothing installed.

## A signed test build

Read on 2026-10-13 from the Extension Workshop (`publish/developer-accounts/`,
`develop/getting-started-with-web-ext/`, `develop/web-ext-command-reference/`,
`develop/extensions-and-the-add-on-id/`, `publish/install-self-distributed/`,
`publish/distribute-pre-release-versions/`, `publish/self-distribution/`), the add-ons
server documentation (`topics/api/auth.html`, `topics/api/addons.html`) and MDN's
`manifest.json/version` page.

Version 0.9.0 was submitted on 2026-10-13 by the owner, through the Developer Hub, for
self-distribution: AMO's email confirms the submission and says it can be held for
human review. The add-on ID `rtl-chat@musaad-sharikh` is now registered to the owner's
account and the number 0.9.0 is used up. Whether the file has been signed yet is not
known here. It has not been installed, and the restart test has not been run.

What the sources state:

- A developer account is a Mozilla account. AMO refuses submissions from accounts on a
  disposable email address.
- A Manifest V3 extension must carry its ID in the manifest before it is submitted, and
  AMO checks that the ID is unique.
- An extension is signed for self-distribution either by uploading it in the Developer
  Hub and choosing "On your own", or with `web-ext sign --channel unlisted`, which
  downloads the signed copy. The second needs API credentials, a JWT issuer and a JWT
  secret, from AMO's credentials page; `web-ext` reads them from `WEB_EXT_API_KEY` and
  `WEB_EXT_API_SECRET`. The first needs none.
- The credentials act for the whole account, and are never to be committed or shared.
- Every submission is validated automatically before it is signed, falls under the
  add-on policies and the distribution agreement, and can be reviewed by hand at any
  time afterwards.
- A signed file is installed from `about:addons`, "Install Add-on From File".
- A self-distributed copy with no `update_url` in its manifest is moved by Firefox to a
  higher listed version once one exists.
- AMO accepts versions of one to four numbers, each of up to nine digits.

Not found in what was read: whether the account needs two-step sign-in before it can
submit, and whether the ID of a deleted add-on can be used again.

The test build is 0.9.0, so that 1.0.0 stays free for the listing. It is made outside
the repository, from the commit under test: `git archive` of that commit into an empty
folder, the version line of that copy's `manifest.json` changed, then `npm test`,
`npm run lint` and `npm run build` there. Rehearsed on commit `0e4f5e1`: the copy
differs from the commit in that one line, the tests and the lint pass, and the package
holds the same files as the 1.0.0 one. The repository and its working tree are not
touched.

The file submitted was built that way in `~/Downloads/rtl-chat-signing/`, outside the
repository: `rtl_chat-0.9.0.zip`, SHA-256
`9607dd541c1ecc25e9a4284992e0207141575766bd716487bf46e01694bdace9`, with 20 of 20 unit
tests, 106 of 106 layout checks and a clean lint on that copy.

## Listing requirements

Source: Mozilla's Extension Workshop, `https://extensionworkshop.com/documentation/`:
`publish/submitting-an-add-on/`, `develop/create-an-appealing-listing/` and
`publish/add-on-policies/`. Categories from the AMO API, `addons/categories/`.

| Requirement, as the source states it | Here |
|---|---|
| The add-on URL must be unique | See above |
| A privacy policy is required if any data is transmitted from the user's device | None transmitted, so none planned |
| An add-on for Firefox 140 or later that uses the built-in consent must state its data collection in the manifest, including when it collects none | Stated: `none` |
| A source code package is needed when the code is minified, obfuscated or otherwise hard to read | Not the case: no build step |
| Screenshots are recommended at 1280x800, or another size at a 1.6:1 ratio | Two at 1280x800 |
| A licence is chosen in the form | MIT |

AMO's extension categories: Alerts & Updates, Appearance, Bookmarks, Download
Management, Feeds News & Blogging, Games & Entertainment, Language Support, Other,
Photos Music & Videos, Privacy & Security, Search Tools, Shopping, Social &
Communication, Tabs, Web Development. Appearance with Language Support is proposed: it
is what the nearest add-ons use (`ai-chat-rtl-support`, `claude-rtl-hebrew-arabic`,
`arabic-rtl-chatgpt-gemini`).

The settings live in `storage.sync`, which Firefox itself carries between a user's
browsers when they use Firefox Sync. They hold site names: the sites switched off and
the sites forced right-to-left. The extension sends nothing anywhere.

## Screenshots

`docs/amo-screenshots/`, 1280x800, taken by `tests/live/` in a headless Firefox as a
logged-out visitor, so no account and no private conversation is in them:

- `chatgpt-with-rtl-chat.png` — the test reply on ChatGPT with the extension on.
- `chatgpt-without-rtl-chat.png` — the same reply with the extension switched off.

There is none from Claude. Claude answers the automated browser with a bot challenge
and needs an account, and nothing here tries to get past either. A Claude screenshot
has to be taken by hand. There is none of the popup either.

## Open

- **A site staying enabled after Firefox restarts is not verified.** It waits for the
  signed 0.9.0 file; the steps are test (و) in `docs/manual-test-plan.md`.
- **No screenshot of the popup.** The headless browser does not capture the popup
  panel.
- **By hand, the current build has only the re-check on Claude**, which passed. What
  it did not cover is in `docs/live-testing.md`.
- **No Claude screenshot.**
- **Unknown, to be supplied by the owner:** whether a Mozilla developer account exists
  and what it requires to submit; the support email, support site and homepage for the
  listing. The GitHub repository is private, so it cannot serve as a public homepage or
  source link as it stands.
- **Android.** The plan is desktop Firefox only; which platforms the listing offers is
  to be confirmed in the submission form.
- **The name** keeps the word "Chat" while the extension is now general. Whether that
  stays is the owner's call.
