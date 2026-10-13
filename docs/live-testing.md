# Live testing

What has been checked against the real sites by automation, how, and what has not been.

Everything in the automated sections below was seen by an automated browser as a
logged-out visitor. The signed-in interface of both sites, and Claude altogether, have
only the manual plan in `docs/manual-test-plan.md` to go by. That plan has been run on
both and passed.

The fixture suite (`npm test`) proves the logic. It says nothing about a real site: each
site has its own markup, and several of the bugs below only showed up there.

## How

`tests/live/` drives a headless Firefox with the extension installed as a temporary
add-on, over Firefox's Marionette protocol. Nothing appears on screen.

```sh
npm run live:start                                   # leave running
node tests/live/scenario.js chatgpt
node tests/live/geometry.js "en-US,en" https://chatgpt.com/
node tests/live/permission.js https://duck.ai/
node tests/live/per-site.js https://duck.ai/ https://chatgpt.com/ https://ar.wikipedia.org/
node tests/live/access.js https://duck.ai/ https://ar.wikipedia.org/ https://chatgpt.com/
```

- `scenario.js` types an Arabic prompt that asks for Arabic and English paragraphs, an
  Arabic sentence opening with a Latin word, both kinds of list, a table and a code
  block. It measures the reply, then clicks through the real toolbar popup: off, on,
  always right-to-left, automatic again.
- `geometry.js` compares every visible element's box, direction and alignment with the
  extension off and on, on a page with no conversation.
- `permission.js` runs the "Enable on this site" flow on a site outside the built-in
  ones, answering Firefox's real permission prompt, and checks that a site removed and
  added again starts from the defaults.
- `per-site.js` forces right-to-left on an added site, switches a built-in site off,
  reads each one's settings back from the other, and counts what the extension marked
  on a site that was never enabled.
- `access.js` gives and takes away access with the real switches on the extension's
  Permissions tab in `about:addons`, one site and "all websites", with a tab left open,
  and reads the popup and the page after each change.

Screenshots land in `tests/live/shots/`, which Git ignores.

The browser is automated and says so (`navigator.webdriver`). A site that answers with
a bot challenge is left alone; nothing here tries to get past one.

## Automated checks, 2026-10-13, logged out

"yes" means the automated check ran on the real site and found what was expected. It
does not mean a person looked at every function of the site.

| Site | Composer | Own message | Reply | Popup on the site | Site design unchanged |
|---|---|---|---|---|---|
| ChatGPT | yes | yes | yes | yes | yes, English and Arabic interface |
| duck.ai (added through the popup) | yes | no | no | yes, with the permission prompt | not compared |

All five checks ran on the current build, in Firefox 158.

"Site design unchanged" compares the home page only, with no conversation on it: 130
elements, none different, with the interface in English and in Arabic.

Each site keeps its own settings, checked by `per-site.js`: with duck.ai forced
right-to-left, ChatGPT stayed automatic; with ChatGPT switched off, duck.ai stayed on
and forced. On ar.wikipedia.org, never enabled, the extension marked nothing. A site
removed and added again came back automatic.

Where access comes from, and what a change to it does, checked by `access.js`. "Stopped"
means the page was back to the site's own layout without a reload.

| Change | Popup afterwards | Page, tab left open |
|---|---|---|
| duck.ai added from the popup, forced right-to-left | "Added by you", with "Remove this site" | at work |
| Its access switched off in `about:addons` | "not active", with "Enable on this site" | stopped |
| Enabled again from the popup | "Added by you", still forced right-to-left | at work again |
| "All websites" switched on in `about:addons` | on a site never added: "Enabled for all websites, from Firefox's settings", the switch and the modes, no "Remove this site"; duck.ai still "Added by you" | at work on the site never added |
| That site switched off in the popup | off there; duck.ai still on and forced | stopped there only |
| duck.ai removed while "all websites" is on | "Enabled for all websites", automatic | at work, from the defaults |
| "All websites" switched off | "not active" on both | stopped |
| ChatGPT's access switched off, then given back from the popup | "no access", then "Supported site" | stopped, then at work again |

"Reply" covers Arabic, English and mixed paragraphs, numbered and bulleted lists, a
table, a code block, and the reply while it was still streaming.

## Manual test, signed in

| Site | Result |
|---|---|
| ChatGPT | passed, 2026-10-13 |
| Claude | passed, 2026-10-13 |

The owner ran `docs/manual-test-plan.md` on each site with a signed-in account and
reported it as passing, as a whole and without a step-by-step breakdown. The two steps
automation never covered, reloading the conversation (17) and scrolling a long one
(18), were confirmed by name on both sites, with no problem in direction or speed. The
Firefox version was not reported. The plan's five one-time tests passed by hand on
2026-10-13, each reported by name. Its optional Arabic-interface pass was not run on
either site and is not a condition for publishing.

### Re-check on Claude, current build

The manual results above are from an earlier build. Since then the direction mode
became a per-site setting, the popup changed, and every inserted rule was tied to an
attribute on the root element. The owner repeated a ten-step re-check on Claude, signed
in, on the current build, and reported it on 2026-10-13 as passing with no problems, as
a whole and without a step-by-step breakdown. The steps are in
`docs/manual-test-plan.md`: the reply's directions, the popup, switching off and on,
forced right-to-left, ChatGPT keeping its own mode meanwhile, a reload, and Claude's
access taken away in `about:addons` and given back with the tab open.

### Across a restart, signed 0.9.0

A temporary add-on is removed when Firefox closes, so this one check needs a signed
build. The owner ran it on 2026-10-14 with the 0.9.0 file signed by AMO, installed in
the ordinary Firefox 158. The signed package was compared file by file with commit
`62561ae`: it holds the same set of files a build takes from that commit, the twelve
other than `manifest.json` are byte-identical, and the manifest holds the same values
apart from the version number, laid out with one array item per line.

Before the restart: `en.wikipedia.org` enabled from the popup and set to "Always
right-to-left", and one built-in site switched off. Firefox was then quit completely
and started again. The owner reported each point by name as passing:

| After the restart | Result |
|---|---|
| The added site is still enabled | yes |
| It is still on "Always right-to-left" | yes |
| The direction is applied on the page before the popup is opened | yes |
| The built-in site that was switched off is still off | yes |
| A site never enabled is left alone | yes |
| The popup opens and works | yes |

Which built-in site was switched off was not reported. Read from the profile after the
restart: the add-on at 0.9.0, active, signed, not temporary, with
`https://en.wikipedia.org/*` among its granted hosts.

Not repeated by hand on the current build: anything on ChatGPT beyond the popup showing
its own mode, a long existing conversation on Claude, and the one-time tests. Never
done by hand: the "all websites" switch, and a site added by hand losing its access
with its tab open; both are covered by `tests/live/access.js` only.

## Not checked

| Site | Why |
|---|---|
| Claude | Cloudflare challenge in the automated browser, and the app needs an account |

Automation has never seen Claude: the manual test is the only check behind its entry
in `src/sites.js`. It was repeated on the current build, as the re-check below.

When a site's access is taken away, the stylesheets the extension inserted stay in the
open page until it reloads: Firefox removes a stylesheet only for an extension that
still has access to the page. They match nothing once the script has taken its
attribute off the root, which is what "stopped" above measures. A tab Firefox has
unloaded is not told, and needs nothing: it loads again without the script.

Whether an added site is still enabled after Firefox restarts is not checked by
automation: the test browser loads a temporary add-on, which is removed when Firefox
closes. It was checked by hand on a signed build, as "Across a restart" above.

Not checked by automation on any site, only by hand: typing English into the composer,
reloading a conversation, a long existing conversation, and the look of anything a
person would judge by eye beyond the screenshots taken along the way.

The popup in Arabic and a built-in site whose access was revoked from `about:addons`
were checked by hand only, as two of the one-time tests: the test browser has no Arabic
interface. Whether the extension starts on that site straight after access is given
back, or only after a reload, was not reported. Settings sync between two browsers is
not checked at all.

## What the real sites showed

- ChatGPT already makes an Arabic reply right-to-left as a whole. What it gets wrong,
  and the extension corrects: an English paragraph or list inside that reply stays
  right-to-left, code blocks come out right-to-left, and the user's own Arabic message
  is left-aligned.
- ChatGPT builds the conversation itself as `ol[aria-label]` with one `li` per turn,
  and puts `role="list"` on the lists inside a reply.

## Code review, 2026-10-13

Read for cost, conflicts with sites, and permissions. Findings, and what was done:

- **Cost.** One observer and one `input` listener for the page; a change re-judges
  only the elements around it, over at most 600 characters each. Measured in the
  fixture with the stylesheets in force, in Firefox 158, on Arabic text in a
  left-to-right page (the worst case, where every element is given a direction):
  between 61 and 208 ms across four runs for a first pass over 2000 paragraphs and 200
  lists, and 0.013 to 0.033 ms per streamed chunk at the end of that conversation. Not
  measured on a real long conversation.
- **Conflicts.** The extension writes only its own attributes and `dir`, one of them
  on the root element, and its observer does not watch attributes, so it cannot
  trigger itself. An editor that
  manages `dir` on its own root (Lexical) removes the one the extension sets.
  `li { text-align: start !important }` would have overridden an alignment a site
  gave a list item; it now goes in under the user origin and yields to the site.
  Forced right-to-left still overrides a site's own `direction` on text, which is
  what that mode is for.
- **Permissions.** `storage` holds the settings. `scripting` inserts the CSS and
  registers the content script for added sites. `activeTab` gives the popup the URL of
  a tab the extension has no access to yet, which "Enable on this site" needs. Host
  access is the two sites' hosts; anything else is asked for one site at a time. No
  `tabs`, no `<all_urls>`. Firefox itself offers the user an "all websites" switch for
  any extension with optional host access; the extension follows it and says so in
  the popup.
