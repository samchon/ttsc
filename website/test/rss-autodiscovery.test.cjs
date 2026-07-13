const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ATTRIBUTE_PATTERN = /\s([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * Verifies website export: the blog advertises its RSS feed for auto-discovery.
 *
 * RSS readers inspect the rendered HTML head rather than guessing a feed URL.
 * The assertion reads the static export so a source-only link that Next.js
 * drops, rewrites, or duplicates cannot satisfy the regression.
 *
 * 1. Read the exported blog index HTML.
 * 2. Find links with the alternate relation and RSS media type.
 * 3. Assert exactly one link targets the exported feed with its stable title.
 */
test("static blog HTML advertises the RSS feed", () => {
  const output = path.join(__dirname, "..", "out", "blog", "index.html");
  const html = fs.readFileSync(output, "utf8");
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const rssLinks = links.filter((link) => {
    const attributes = parseAttributes(link);
    const relations = (attributes.rel ?? "").toLowerCase().split(/\s+/);
    return (
      relations.includes("alternate") &&
      attributes.type?.toLowerCase() === "application/rss+xml"
    );
  });

  assert.equal(
    rssLinks.length,
    1,
    `expected exactly one RSS auto-discovery link, found ${rssLinks.length}`,
  );
  const attributes = parseAttributes(rssLinks[0]);
  assert.equal(attributes.href, "/blog/rss.xml");
  assert.equal(attributes.title, "ttsc Blog RSS");
  assert.ok(
    fs.statSync(path.join(__dirname, "..", "out", "blog", "rss.xml")).isFile(),
    "RSS auto-discovery target must be part of the static export",
  );
});

function parseAttributes(tag) {
  const attributes = Object.create(null);
  for (const match of tag.matchAll(ATTRIBUTE_PATTERN))
    attributes[match[1].toLowerCase()] = match[2] ?? match[3];
  return attributes;
}
