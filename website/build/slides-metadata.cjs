const fs = require("fs");
const path = require("path");

const SLIDES_DIR =
  [
    path.join(process.cwd(), "src", "slides"),
    path.join(process.cwd(), "website", "src", "slides"),
    path.join(__dirname, "..", "src", "slides"),
  ].find((candidate) => fs.existsSync(candidate)) ??
  path.join(process.cwd(), "src", "slides");
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

// Deck slugs may carry a trailing `-<code>` locale suffix, e.g. `evidence-kr`.
// The set is explicit rather than a bare two-letter match so a deck whose name
// legitimately ends in two letters is never mistaken for a translation. It
// holds ISO 639-1 language codes plus the ccTLD-style aliases this site uses
// (`kr`, `jp`, `cn`, `tw`), and omits codes that collide with English words
// (`it`, `no`, `is`, `id`, `be`, `he`, `as`, `to`).
const SLIDE_LOCALE_CODES = Object.freeze([
  "cn",
  "de",
  "en",
  "es",
  "fr",
  "ja",
  "jp",
  "ko",
  "kr",
  "pt",
  "ru",
  "tw",
  "vi",
  "zh",
]);
const SLIDE_LOCALE_PATTERN = /^(.+)-([a-z]{2})$/;

const parseSlideLocale = (slug) => {
  const match = slug.match(SLIDE_LOCALE_PATTERN);
  return match && SLIDE_LOCALE_CODES.includes(match[2])
    ? { base: match[1], locale: match[2] }
    : { base: slug, locale: null };
};

const parseFrontmatter = (content) => {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) return {};

  const metadata = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const keyValueMatch = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!keyValueMatch) continue;

    const [, key, rawValue] = keyValueMatch;
    const value = rawValue
      .trim()
      .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
    metadata[key] = value;
  }
  return metadata;
};

const readSlides = () =>
  fs
    .readdirSync(SLIDES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const file = path.join(SLIDES_DIR, entry.name);
      const slug = entry.name.replace(/\.md$/, "");
      const metadata = parseFrontmatter(fs.readFileSync(file, "utf8"));
      for (const key of ["title", "description", "image", "url"]) {
        if (!metadata[key])
          throw new Error(
            `${entry.name} is missing required '${key}' metadata.`,
          );
      }
      return {
        file,
        slug,
        route: `/slides/${slug}`,
        staticRoute: `/slides-static/${slug}/index.html`,
        ...metadata,
        ...parseSlideLocale(slug),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

const readListedSlides = () =>
  readSlides().filter((slide) => slide.locale === null);

const readSlide = (slug) =>
  readSlides().find((slide) => slide.slug === slug) ?? null;

module.exports = {
  FRONTMATTER_PATTERN,
  SLIDES_DIR,
  SLIDE_LOCALE_CODES,
  parseFrontmatter,
  parseSlideLocale,
  readListedSlides,
  readSlide,
  readSlides,
};
