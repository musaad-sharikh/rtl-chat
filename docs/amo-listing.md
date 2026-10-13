# AMO listing text

Text and choices for the addons.mozilla.org listing. The name and the summary come from
`_locales/*/messages.json`; the rest goes into the listing form. What is settled and
what is still open is in `docs/amo-readiness.md`.

## English

**Name:** RTL Chat

**Summary:** Fixes text direction for Arabic, Persian, Hebrew and Urdu, paragraph by
paragraph. Works on ChatGPT and Claude, and on other sites you enable it on.

**Description:**

Many sites lay everything out left-to-right. Arabic paragraphs hug the left edge, list
numbers land on the wrong side, and the text box starts from the left.

RTL Chat fixes the direction paragraph by paragraph:

- An Arabic paragraph reads right-to-left; an English paragraph beside it stays
  left-to-right.
- Lists, numbering and tables follow the language they are written in.
- A text box follows what you type.
- Code blocks and math always stay left-to-right.
- The site's own menus and navigation are not changed.

ChatGPT and Claude work from the start. On any other site, open the popup and choose
"Enable on this site" — Firefox asks for access to that one site only, and "Remove
this site" gives it back. RTL Chat does nothing on a site you have not enabled.

If you give RTL Chat access to all websites in Firefox's own settings, it works on
every site, and the popup tells you so. Each site can still be switched off on its own.

A site you enable gets the same general rules, with nothing written for it in
particular, so how well they fit depends on how that site is built. RTL Chat is tested
on ChatGPT and Claude and does not claim to work on every site.

Prefer everything right-to-left on a site? Switch it to "Always right-to-left" in the
popup. Each site keeps its own choice, and each can be switched off on its own.

Privacy: RTL Chat makes no network requests and collects no data.

## العربية

**الاسم:** RTL Chat

**الملخص:** تصحّح اتجاه النص للعربية والفارسية والعبرية والأردية فقرة فقرة. تعمل على
ChatGPT و Claude، وعلى المواقع الأخرى التي تفعّلها عليها.

**الوصف:**

مواقع كثيرة تعرض كل شيء من اليسار لليمين: الفقرات العربية ملتصقة باليسار، وأرقام
القوائم في الجهة الخطأ، وخانة الكتابة تبدأ من اليسار.

RTL Chat تصحّح الاتجاه فقرة فقرة:

- الفقرة العربية من اليمين لليسار، والفقرة الإنجليزية بجانبها تبقى كما هي.
- القوائم والترقيم والجداول تتبع اللغة المكتوبة بها.
- خانة الكتابة تتبع ما تكتبه.
- الأكواد والمعادلات تبقى من اليسار لليمين دائماً.
- قوائم الموقع وواجهته لا تتغير.

تعمل مباشرة على ChatGPT و Claude. ولأي موقع آخر، افتح نافذة الإضافة واختر "فعّل على
هذا الموقع"، وفايرفوكس يطلب صلاحية ذلك الموقع فقط، و"أزل هذا الموقع" يرجّعها. الإضافة
لا تفعل شيئاً في موقع لم تفعّلها عليه.

إذا منحت RTL Chat صلاحية كل المواقع من إعدادات فايرفوكس نفسه، تعمل على كل المواقع،
ونافذة الإضافة تخبرك بذلك. وتقدر توقفها على أي موقع لوحده.

الموقع الذي تفعّله تُطبَّق عليه القواعد العامة نفسها، وليس فيها شيء مكتوب له خاصة،
فمدى مناسبتها يعتمد على طريقة بناء الموقع. RTL Chat مختبرة على ChatGPT و Claude، ولا
تدّعي أنها تعمل على كل المواقع.

تفضّل كل شيء من اليمين لليسار في موقع معيّن؟ اختر له "من اليمين لليسار دائماً" من نافذة
الإضافة. كل موقع يحتفظ باختياره، وتقدر توقف الإضافة على أي موقع لوحده.

الخصوصية: RTL Chat لا ترسل أي طلبات عبر الشبكة ولا تجمع أي بيانات.

## Listing form

| Field | Value |
|---|---|
| Distribution | "On this site": listed on AMO |
| Platform | Firefox for desktop only; Firefox for Android left unticked |
| Add-on URL | `rtl-chat`, if AMO accepts it; the add-on has a generated one from the test submission, to be edited |
| Categories | Appearance, Language Support |
| Licence | MIT, as in `LICENSE` |
| Privacy policy | none: nothing is transmitted from the user's device |
| Support email | `musaad.sharikh@gmail.com` |
| Support site, homepage | left blank |
| Source code package | not needed: nothing is minified or generated |
| Screenshots | the two in `docs/amo-screenshots/` |

## Notes for reviewers

- No build step, no dependencies, nothing minified: the package is the source.
- `host_permissions` covers the two sites that work from the start. Every other site
  is asked for one at a time, from a click on "Enable on this site" in the popup, out of
  `optional_host_permissions`. If the user switches on "all websites" on the
  Permissions tab instead, the extension follows that and the popup says so.
- `scripting` inserts the CSS, which a page's Content Security Policy would block from
  a `<style>` element, and registers the content script for the sites the user added.
- `activeTab` gives the popup the address of the current tab, to name the site and to
  ask for access to it.
- `storage` holds the settings: for each site, whether it is switched off and its
  direction mode.
- No network requests, no remote code.
