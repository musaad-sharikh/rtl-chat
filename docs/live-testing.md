# Live testing

What has been checked against the real sites by automation, how, and what has not been.

**No site counts as verified.** Everything below was seen by an automated browser as a
logged-out visitor. The signed-in interface of every site, and six sites altogether,
have only the manual plan in `docs/manual-test-plan.md` to go by, and that has not been
run yet.

The fixture suite (`npm test`) proves the logic. It says nothing about a real site: each
site has its own markup, and several of the bugs below only showed up there.

## How

`tests/live/` drives a headless Firefox with the extension installed as a temporary
add-on, over Firefox's Marionette protocol. Nothing appears on screen.

```sh
npm run live:start                                   # leave running
node tests/live/scenario.js chatgpt                  # or gemini, perplexity
node tests/live/geometry.js "en-US,en" https://chatgpt.com/ https://grok.com/
node tests/live/permission.js https://duck.ai/
```

- `scenario.js` types an Arabic prompt that asks for Arabic and English paragraphs, an
  Arabic sentence opening with a Latin word, both kinds of list, a table and a code
  block. It measures the reply, then clicks through the real toolbar popup: off, on,
  always right-to-left, automatic again.
- `geometry.js` compares every visible element's box, direction and alignment with the
  extension off and on, on a page with no conversation.
- `permission.js` runs the "Enable on this site" flow on a site outside the built-in
  ones, answering Firefox's real permission prompt.

Screenshots land in `tests/live/shots/`, which Git ignores.

The browser is automated and says so (`navigator.webdriver`). A site that answers with
a bot challenge is left alone; nothing here tries to get past one.

## Automated checks, 2026-10-13, Firefox 157, logged out

"yes" means the automated check ran on the real site and found what was expected. It
does not mean a person looked at every function of the site.

| Site | Composer | Own message | Reply | Popup on the site | Site design unchanged |
|---|---|---|---|---|---|
| ChatGPT | yes | yes | yes | yes | yes, English and Arabic interface |
| Gemini | yes | yes | yes (1) | yes | yes, English and Arabic interface |
| Perplexity | yes | yes | yes | yes | yes, English and Arabic interface |
| Grok | yes | yes | no: a reply needs an account | yes | yes |
| duck.ai (added through the popup) | yes | no | no | yes, with the permission prompt | not compared |

(1) Gemini's full reply was measured on an earlier build, before the changes to list
indents, table cells and the list-item alignment rule. After that Gemini answered the
test prompt with a refusal three times, so the current build was only seen there on a
one-paragraph reply. ChatGPT is the only site whose full reply was measured on the
current build; Perplexity's was measured before the list-item alignment rule moved to
the user origin.

"Site design unchanged" compares the home page only, with no conversation on it.

"Reply" covers Arabic, English and mixed paragraphs, numbered and bulleted lists, a
table, a code block, and the reply while it was still streaming.

## Not checked

| Site | Why |
|---|---|
| Claude | Cloudflare challenge in the automated browser, and the app needs an account |
| Google AI Studio | Needs a Google account |
| Copilot | Redirects to a sign-in page on `copilot.com` |
| DeepSeek | Needs an account |
| Poe | Needs an account |
| Le Chat | Asks to accept its terms before the first message |

For these, the generic rules are what applies; the site-specific entries in
`src/sites.js` are unverified. The same goes for ChatGPT, Gemini, Perplexity and Grok
signed in: only their logged-out interface was seen.

Not checked on any site: typing English into the composer, reloading a conversation,
a long existing conversation, and the look of anything a person would judge by eye
beyond the screenshots taken along the way.

Also not checked: the popup in Arabic (the test browser has no Arabic interface), a
built-in site whose access was revoked from `about:addons`, and settings sync between
two browsers.

## What the real sites showed

- ChatGPT, Gemini, Perplexity and Grok already make an Arabic reply right-to-left as a
  whole. What they get wrong, and the extension corrects: an English paragraph or list
  inside that reply stays right-to-left, code blocks come out right-to-left (ChatGPT,
  Gemini, Perplexity), ChatGPT leaves the user's own Arabic message left-aligned, and
  Perplexity pins table headers to the left.
- ChatGPT builds the conversation itself as `ol[aria-label]` with one `li` per turn,
  and puts `role="list"` on the lists inside a reply.
- Gemini's whole app sits inside `side-navigation-v2`; its sidebar is `bard-sidenav`.
- Lexical (Perplexity) puts `dir` on its own paragraphs and drops a `dir` set on the
  editor root. Typing there with `WebDriver:ElementSendKeys` loses all but the first
  character with or without the extension; the keyboard action queue works.
- `copilot.microsoft.com` redirected to `copilot.com` for a logged-out visitor, which
  is why both hosts are listed. Where the signed-in app lives was not seen.

## Code review, 2026-10-13

Read for cost, conflicts with sites, and permissions. Findings, and what was done:

- **Cost.** One observer and one `input` listener for the page; a change re-judges
  only the elements around it, over at most 600 characters each. Measured in the
  fixture, in Firefox 157, on Arabic text in a left-to-right page (the worst case,
  where every element is given a direction): 54 ms for a first pass over 2000
  paragraphs and 200 lists, 0.013 ms per streamed chunk at the end of that
  conversation. Not measured on a real long conversation.
- **Conflicts.** The extension writes only its own attributes and `dir`, and its
  observer does not watch attributes, so it cannot trigger itself. An editor that
  manages `dir` on its own root (Lexical) removes the one the extension sets; typing
  there was seen to work on Perplexity. `li { text-align: start !important }` would
  have overridden an alignment a site gave a list item; it now goes in under the user
  origin and yields to the site. Forced right-to-left still overrides a site's own
  `direction` on text, which is what that mode is for.
- **Permissions.** `storage` holds the settings. `scripting` inserts the CSS and
  registers the content script for added sites. `activeTab` gives the popup the URL of
  a tab the extension has no access to yet, which "Enable on this site" needs. Host
  access is the ten sites' hosts; anything else is asked for one site at a time. No
  `tabs`, no `<all_urls>`. Whether `copilot.com` is needed next to
  `copilot.microsoft.com` is open until the signed-in app is seen.
