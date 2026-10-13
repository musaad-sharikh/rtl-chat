# AMO readiness

What was checked before submitting RTL Chat to addons.mozilla.org (AMO), where each
fact came from, and what is still open. Everything was read on 2026-10-13 unless a
section gives its own date. A test build, 0.9.0, has been signed in the unlisted
channel and passed the restart test on 2026-10-14. The 1.0.0 package is built and the
listing choices are made; nothing has been submitted for listing.

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
| Package | `web-ext-artifacts/rtl_chat-1.0.0.zip`, from `npm run build`: the manifest, `LICENSE`, two icons, two locales and the seven files of `src/`, thirteen files in all; no tests, no docs |

Each permission is one the extension uses; what for is in the reviewer notes in
`docs/amo-listing.md`. `*://*/*` is what lets "Enable on this site" ask for a site
nobody listed in advance, and it grants nothing until the user accepts a prompt for one
site.

`npm run build` packages the working tree, and Git ignores `web-ext-artifacts/`. The
package for the listing was built on 2026-10-14 with web-ext 10.7.0 from a clean tree
at commit `0dc9aa6`, after `npm test` and `npm run lint` passed there with the results
above. Its SHA-256 is
`eb061c455f56e9042438c45363686b59aa00d4e1af884c6d807d5540f5ae15fe`. Each of its
thirteen files is byte-identical to that commit, and the twelve other than
`manifest.json` are byte-identical to the signed 0.9.0 file, whose manifest differs in
the version number only. A later change to any packaged file means building again.

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

The second way was taken, with 0.9.0: "A signed test build" below.

## A signed test build

Read on 2026-10-13 from the Extension Workshop (`publish/developer-accounts/`,
`develop/getting-started-with-web-ext/`, `develop/web-ext-command-reference/`,
`develop/extensions-and-the-add-on-id/`, `publish/install-self-distributed/`,
`publish/distribute-pre-release-versions/`, `publish/self-distribution/`), the add-ons
server documentation (`topics/api/auth.html`, `topics/api/addons.html`) and MDN's
`manifest.json/version` page.

Version 0.9.0 was submitted on 2026-10-13 by the owner, through the Developer Hub, for
self-distribution. AMO's email says it passed the automated screening and is
tentatively approved, and that a person may still review it at any time and ask for
changes. The add-on ID `rtl-chat@musaad-sharikh` is now registered to the owner's
account and the number 0.9.0 is used up.

The signed file, SHA-256
`2352346e5dbc3b7c7ae6d1405474d87e60418cb8f1ac959ea1be3600abcaf05f`, carries Mozilla's
AMO production signature for that ID. The owner installed it in the ordinary Firefox
158 on 2026-10-14, where the popup opens, and the restart test passed that day: the
result is in `docs/live-testing.md`.

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

Not found in what was read: whether the ID of a deleted add-on can be used again.
Two-step sign-in is in "Listing an add-on that has an unlisted version" below.

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

## Listing an add-on that has an unlisted version

Read on 2026-10-14 from the Extension Workshop (`publish/submitting-an-add-on/`,
`publish/signing-and-distribution-overview/`, `publish/developer-accounts/`,
`develop/create-an-appealing-listing/`, `publish/add-on-policies/`), the add-ons server
API documentation (`topics/api/addons.html`) and the Mozilla add-ons blog post of
2021-03-11, "Two-factor authentication required for extension developers".

What the sources state:

- A version is uploaded to an existing add-on in the `listed` or the `unlisted`
  channel, so 1.0.0 goes to the add-on that already holds 0.9.0, under the same ID.
- A listed version needs a licence, a name, a summary and categories for each
  application it is compatible with. A submission to an existing add-on does not take
  these from the manifest, so they are entered on AMO.
- The summary is limited to 250 characters, and up to two categories are chosen for
  each platform.
- The support email, the support site and the homepage are optional. Mozilla suggests
  an email address as the minimum.
- The add-on URL can be edited and must be unique.
- The submission asks for the compatible platforms, and whether a source code package
  is needed.
- Screenshots are optional, with no practical limit to their number.
- Extension developers have had to turn on two-step sign-in to log in to AMO since
  2021-03-15; uploads made with API keys are not asked for the second step. The
  developer-accounts page does not mention it.

Not found in what was read: the Developer Hub's own steps for adding a first listed
version to an add-on that has only unlisted ones, where in that flow the add-on URL is
edited, and whether Firefox for Android is ticked by default. The manifest has no
`gecko_android` key.

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
Communication, Tabs, Web Development. Appearance with Language Support is chosen: it
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
has to be taken by hand. There is none of the popup either: the headless browser does
not capture the popup panel. The listing starts with the two above.

## Open

- **By hand, the current build has only the re-check on Claude, and the restart test on
  the signed 0.9.0 copy of it**, which both passed. What they did not cover is in
  `docs/live-testing.md`.
- **Whether AMO accepts `rtl-chat` as the add-on URL** is known only at submission.
- **The platform boxes in the submission form** are to be read before continuing:
  Firefox ticked, Firefox for Android not.
- **The submission itself** is the owner's, from the Mozilla developer account that
  submitted 0.9.0, with the choices in `docs/amo-listing.md`.
