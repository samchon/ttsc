const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
  FRONTMATTER_PATTERN,
  SLIDES_DIR,
  SLIDE_LOCALE_CODES,
  parseSlideLocale,
  readListedSlides,
  readSlides,
} = require("../build/slides-metadata.cjs");

const REQUIRED_SLUGS = ["evidence", "evidence-kr", "graph"];
const KOREAN_LOCALES = ["ko", "kr"];
const HANGUL_PATTERN = /[가-힣]/;

/**
 * Verifies website export: every declared slide has one navigable deck and one
 * social card, while a locale-suffixed deck stays reachable but unlisted.
 *
 * The list page, dynamic route, and Marp output read the same frontmatter, so
 * this assertion checks the exported consequence rather than trusting three
 * source-only integrations that could drift independently. The listing alone
 * reads `readListedSlides`, so a filter that leaked into `readSlides` would
 * delete `/slides/evidence-kr` instead of merely hiding its card; only the
 * exported HTML tells those two outcomes apart.
 *
 * 1. Read every source deck, the locale rule, and the exported slides index.
 * 2. Assert the deck set mirrors the source directory and that the listing
 *    accessor drops exactly the locale-suffixed decks.
 * 3. Assert each deck exports its own Marp presentation plus a route carrying its
 *    title, summary, and Open Graph image.
 * 4. Assert the index cards cover the default decks only, and that a Korean deck
 *    is written in Korean while a default deck never drifts into it.
 */
test("static slide routes publish their decks and social metadata", () => {
  const websiteRoot = path.resolve(__dirname, "..");
  const outputRoot = path.join(websiteRoot, "out");
  const indexHtml = fs.readFileSync(
    path.join(outputRoot, "slides", "index.html"),
    "utf8",
  );
  const slides = readSlides();
  const sourceSlugs = fs
    .readdirSync(SLIDES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.replace(/\.md$/, ""))
    .sort();

  assert.deepEqual(slides.map((slide) => slide.slug).sort(), sourceSlugs);
  for (const slug of REQUIRED_SLUGS)
    assert.ok(sourceSlugs.includes(slug), `${slug}.md must stay published`);

  assert.deepEqual(parseSlideLocale("evidence-kr"), {
    base: "evidence",
    locale: "kr",
  });
  assert.deepEqual(parseSlideLocale("evidence"), {
    base: "evidence",
    locale: null,
  });
  assert.ok(
    !SLIDE_LOCALE_CODES.includes("ab"),
    "the negative twin below needs an unrecognized two-letter suffix",
  );
  assert.deepEqual(parseSlideLocale("graph-ab"), {
    base: "graph-ab",
    locale: null,
  });

  assert.deepEqual(
    readListedSlides()
      .map((slide) => slide.slug)
      .sort(),
    sourceSlugs.filter(
      (slug) => !SLIDE_LOCALE_CODES.some((code) => slug.endsWith(`-${code}`)),
    ),
  );

  for (const slide of slides) {
    const source = fs.readFileSync(slide.file, "utf8");
    const body = source.replace(FRONTMATTER_PATTERN, "");
    const deckHtml = fs.readFileSync(
      path.join(outputRoot, "slides-static", slide.slug, "index.html"),
      "utf8",
    );
    const routeHtml = fs.readFileSync(
      path.join(outputRoot, "slides", slide.slug, "index.html"),
      "utf8",
    );
    const cardLink = new RegExp(`href="${slide.route}/?"`);

    assert.match(deckHtml, /data-bespoke-marp/);
    assert.ok(deckHtml.includes(slide.title));
    assert.ok(routeHtml.includes(slide.staticRoute));
    assert.ok(routeHtml.includes(slide.title));
    assert.ok(routeHtml.includes(slide.description));
    assert.ok(routeHtml.includes(slide.image));

    if (slide.locale === null) {
      assert.match(indexHtml, cardLink);
      assert.ok(indexHtml.includes(slide.description));
      assert.ok(indexHtml.includes(new URL(slide.image).pathname));
      assert.doesNotMatch(
        source,
        HANGUL_PATTERN,
        `${slide.slug}.md must stay in English`,
      );
      continue;
    }

    assert.doesNotMatch(
      indexHtml,
      cardLink,
      `${slide.slug} is a translation and must not be listed`,
    );
    assert.ok(
      !indexHtml.includes(slide.title),
      `${slide.slug} must not surface its title on the index`,
    );
    assert.ok(
      !indexHtml.includes(slide.description),
      `${slide.slug} must not surface its summary on the index`,
    );
    if (KOREAN_LOCALES.includes(slide.locale))
      assert.match(
        body,
        HANGUL_PATTERN,
        `${slide.slug}.md must be translated into Korean, not only retitled`,
      );
  }
});
