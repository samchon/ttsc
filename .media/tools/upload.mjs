/**
 * Publishes the rendered clips as GitHub-hosted attachments and reports the
 * URLs the website will reference.
 *
 * There is no API for this. GitHub's attachment CDN
 * (`github.com/user-attachments/assets/...`) is written only by the web upload
 * endpoint, which authenticates with a browser session rather than a token, so
 * `gh` cannot reach it. It is still the only host that serves an `.mp4` with a
 * video content type: `raw.githubusercontent.com` returns
 * `application/octet-stream` under `X-Content-Type-Options: nosniff`, which no
 * browser will play in a `<video>` element. So the upload is driven through a
 * real browser, and the session is kept in a local profile directory so the
 * login happens once.
 *
 * An uploaded asset stays private until a comment references it — an unposted
 * attachment answers 404 — so each family's clips are uploaded together and
 * published as one comment. That also makes the issue readable as a gallery
 * instead of a list of bare links.
 *
 * Run `node upload.mjs <issue-number> [family-slug ...]`.
 *
 * The first run opens a window. Sign in to GitHub there; every later run reuses
 * the stored profile and needs no interaction. Families already recorded in
 * urls.json are skipped, so an interrupted run resumes where it stopped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { specs } from "./build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(HERE, "..", ".browser-profile");
const CLIPS = path.join(HERE, "..", "clips");
const OUTPUT = path.join(HERE, "..", "urls.json");
const REPO = "samchon/ttsc";

/** GitHub rejects an attachment above this size, so a clip has to stay under it. */
const SIZE_LIMIT = 10 * 1024 * 1024;

const [issue, ...only] = process.argv.slice(2);
if (!issue) {
  throw new Error("usage: node upload.mjs <issue-number> [family-slug ...]");
}

/** Clips grouped the way the issue reads them: one comment per lint family. */
const groups = new Map();
for (const spec of specs()) {
  if (only.length > 0 && !only.includes(spec.familySlug)) continue;
  const group = groups.get(spec.familySlug) ?? {
    clips: [],
    family: spec.family,
  };
  group.clips.push(spec);
  groups.set(spec.familySlug, group);
}
if (groups.size === 0) throw new Error("no families selected");

for (const group of groups.values()) {
  for (const clip of group.clips) {
    const file = path.join(CLIPS, `${clip.slug}.mp4`);
    if (!fs.existsSync(file)) throw new Error(`${clip.slug} is not rendered`);
    const bytes = fs.statSync(file).size;
    if (bytes > SIZE_LIMIT) {
      throw new Error(
        `${clip.slug} is ${bytes} bytes, over GitHub's attachment limit`,
      );
    }
  }
}

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1440, height: 960 },
});
const page = context.pages()[0] ?? (await context.newPage());
const urls = fs.existsSync(OUTPUT)
  ? JSON.parse(fs.readFileSync(OUTPUT, "utf8"))
  : {};

try {
  await page.goto(`https://github.com/${REPO}/issues/${issue}`, {
    waitUntil: "domcontentloaded",
  });
  await signedIn(page);

  for (const [slug, group] of groups) {
    if (group.clips.every((clip) => urls[clip.slug])) {
      process.stdout.write(`skip ${slug} (already published)
`);
      continue;
    }
    const uploaded = [];
    for (const clip of group.clips) {
      const url = await attach(page, path.join(CLIPS, `${clip.slug}.mp4`));
      uploaded.push({ clip, url });
      process.stdout.write(`  uploaded ${clip.slug}
`);
    }
    await publish(page, body(group, uploaded, slug));
    for (const { clip, url } of uploaded) urls[clip.slug] = url;
    fs.writeFileSync(OUTPUT, JSON.stringify(urls, null, 2));
    process.stdout.write(`published ${slug} (${uploaded.length} clips)
`);
  }
} finally {
  await context.close();
}

/**
 * The comment for one family.
 *
 * A bare attachment URL on its own line is what GitHub renders as a player;
 * wrapping it in Markdown would publish a link instead. Everything around it is
 * the family's own catalog text, so the comment stays readable as documentation
 * rather than as a dump of asset ids.
 */
function body(group, uploaded, slug) {
  const sections = uploaded
    .map(
      ({ clip, url }) =>
        `### \`${clip.rule}\`

${clip.description}

${url}
`,
    )
    .join("\n");
  return `## ${group.family}

${group.clips[0].meta} · [rule catalog](https://ttsc.dev/docs/lint/rules/${slug})

${sections}`;
}

/**
 * Post the composed comment and wait for it to land.
 *
 * Posting is not presentation, it is what makes the assets reachable: an
 * attachment that no comment references answers 404, so an upload that is never
 * published produces URLs the website could not use.
 */
async function publish(page, text) {
  const editor = await composer(page);
  await editor.fill(text);
  const submit = page.getByRole("button", { name: /^comment$/i }).first();
  if ((await submit.count()) === 0) {
    throw new Error("no comment button to publish with");
  }
  await submit.click();
  for (let waited = 0; waited < 120_000; waited += 1_000) {
    const value = await (await composer(page)).inputValue().catch(() => "");
    if (value === "") return;
    await page.waitForTimeout(1_000);
  }
  throw new Error("the comment never posted");
}

/**
 * Wait for a signed-in session rather than driving the login form. Typing a
 * password into an automated browser is both fragile and the wrong place for a
 * credential; a human signing in once into a persistent profile is neither.
 *
 * The signal is the `user-login` meta tag, which carries the signed-in handle
 * and is empty otherwise. Looking for a sign-in link instead reports a session
 * that does not exist: the current issue UI has no bare `/login` anchor, so its
 * absence means nothing.
 */
async function signedIn(page) {
  for (let waited = 0; waited < 600_000; waited += 2_000) {
    const user = await page.evaluate(
      () =>
        document
          .querySelector('meta[name="user-login"]')
          ?.getAttribute("content") ?? "",
    );
    if (user) {
      process.stdout.write(`signed in as ${user}\n`);
      return;
    }
    if (waited === 0) {
      process.stdout.write("sign in to GitHub in the open window…\n");
    }
    await page.waitForTimeout(2_000);
    if (waited % 30_000 === 0 && waited > 0) await page.reload();
  }
  throw new Error("no GitHub session after ten minutes");
}

/**
 * Find the comment editor, opening it first if the page shows a placeholder.
 *
 * GitHub has more than one issue UI in flight and the composer's markup differs
 * between them, so the editor is looked up by several names rather than one. A
 * failure reports what the page did contain, because the next fix depends on
 * exactly that.
 */
async function composer(page) {
  // The current issue composer is a React textarea with a generated id and
  // neither a name nor an aria-label, so it cannot be named directly. The one
  // other textarea on the page is the site feedback form, which is stable
  // enough to exclude by id. Older markup is still matched first, because the
  // named selectors are unambiguous wherever they exist.
  const candidates = [
    "textarea[name='comment[body]']",
    "textarea#new_comment_field",
    "textarea[aria-label='Add a comment']",
    "textarea:not(#feedback)",
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const selector of candidates) {
      const editor = page.locator(selector).first();
      if ((await editor.count()) > 0 && (await editor.isVisible()))
        return editor;
    }
    // The composer can be collapsed behind a placeholder button on first paint.
    const opener = page
      .getByRole("button", { name: /^write$|add a comment/i })
      .first();
    if ((await opener.count()) > 0) await opener.click().catch(() => undefined);
    await page.waitForTimeout(3_000);
  }
  const found = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll("button")]
      .map((node) => node.textContent?.trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 25),
    textareas: [...document.querySelectorAll("textarea")].map((node) => ({
      id: node.id,
      label: node.getAttribute("aria-label"),
      name: node.name,
    })),
  }));
  throw new Error(`no comment editor found: ${JSON.stringify(found)}`);
}

/**
 * Hand the file to the composer.
 *
 * The current composer keeps no `input[type=file]` in the document; its drop
 * zone opens a native picker instead, so the file goes through the file-chooser
 * event rather than a hidden input. Older markup that does keep an input is
 * still handled, because setting it directly is cheaper and does not depend on
 * a button's accessible name.
 */
async function choose(page, file) {
  const input = page.locator("input[type='file']").first();
  if ((await input.count()) > 0) {
    await input.setInputFiles(file);
    return;
  }
  const opener = page
    .getByRole("button", { name: /add files|paste, drop, or click/i })
    .first();
  if ((await opener.count()) === 0) {
    throw new Error("the composer offers no way to attach a file");
  }
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 30_000 }),
    opener.click(),
  ]);
  await chooser.setFiles(file);
}

/**
 * Drop one file into the comment editor and read back the URL GitHub writes.
 *
 * The editor's file input is hidden behind a drop zone, so the file is set on
 * the input directly. GitHub replaces its own "Uploading…" placeholder with the
 * final attachment URL once the upload lands, which is the signal that the
 * asset exists — the comment itself never has to be posted for the URL to work,
 * but posting it keeps the gallery readable.
 */
async function attach(page, file) {
  const editor = await composer(page);
  const before = await editor.inputValue();
  await choose(page, file);
  for (let waited = 0; waited < 300_000; waited += 1_000) {
    const value = await editor.inputValue();
    // GitHub writes a placeholder while the upload runs and rewrites it to the
    // attachment URL when the asset exists, so the URL appearing anywhere in
    // the added text is the completion signal.
    const match =
      /https:\/\/github\.com\/user-attachments\/assets\/[\w-]+/.exec(
        value.slice(before.length),
      );
    if (match) {
      await editor.fill(before);
      return match[0];
    }
    if (/failed|too large|not supported/i.test(value.slice(before.length))) {
      throw new Error(
        `GitHub rejected ${path.basename(file)}: ${value.slice(before.length).trim()}`,
      );
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error(`upload never completed for ${path.basename(file)}`);
}
