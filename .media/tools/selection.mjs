/**
 * The two rules that represent each family on screen.
 *
 * Chosen by hand rather than by shortest example: a clip has to make a viewer
 * recognise a problem they have actually shipped. Where a family has a
 * type-aware or autofixable flagship, it takes one of the two slots, because
 * those are the checks a syntax-only linter in the editor cannot offer at all.
 */
import { families } from "./catalog.mjs";

const CHOICES = {
  boundaries: ["boundaries/element-types", "boundaries/no-private"],
  core: ["no-var", "object-shorthand"],
  cypress: ["cypress/no-force", "cypress/unsafe-to-chain-command"],
  functional: ["functional/immutable-data", "functional/no-let"],
  jest: ["jest/no-focused-tests", "jest/no-conditional-expect"],
  jsdoc: ["jsdoc/check-tag-names", "jsdoc/require-param-description"],
  "jsx-a11y": ["jsx-a11y/alt-text", "jsx-a11y/click-events-have-key-events"],
  nextjs: ["nextjs/no-img-element", "nextjs/no-sync-scripts"],
  playwright: [
    "playwright/no-focused-test",
    "playwright/prefer-web-first-assertions",
  ],
  promise: ["promise/always-return", "promise/prefer-await-to-then"],
  react: ["react/rules-of-hooks", "react/jsx-key"],
  "react-perf": [
    "react-perf/jsx-no-new-object-as-prop",
    "react-perf/jsx-no-new-function-as-prop",
  ],
  regexp: ["regexp/require-unicode-regexp", "regexp/prefer-d"],
  security: ["security/detect-unsafe-regex", "security/detect-child-process"],
  solid: ["solid/reactivity", "solid/no-innerhtml"],
  storybook: [
    "storybook/await-interactions",
    "storybook/no-redundant-story-name",
  ],
  "tanstack-query": [
    "tanstack-query/exhaustive-deps",
    "tanstack-query/no-unstable-deps",
  ],
  "testing-library": [
    "testing-library/await-async-queries",
    "testing-library/no-node-access",
  ],
  typescript: [
    "typescript/no-floating-promises",
    "typescript/no-wrapper-object-types",
  ],
  unicorn: [
    "unicorn/prefer-node-protocol",
    "unicorn/prefer-string-replace-all",
  ],
  vitest: ["vitest/no-focused-tests", "vitest/valid-expect"],
};

/** One accent per family, so a scroll of clips reads as a set rather than a run. */
const ACCENTS = {
  boundaries: "#8ab4ff",
  core: "#7bd0ff",
  cypress: "#69dba1",
  functional: "#9d8cff",
  jest: "#ffb072",
  jsdoc: "#7be0d0",
  "jsx-a11y": "#ff9ec4",
  nextjs: "#cfd6ee",
  playwright: "#8ce07a",
  promise: "#ffd479",
  react: "#61dafb",
  "react-perf": "#4fd6c0",
  regexp: "#ff8f6b",
  security: "#ff7b8a",
  solid: "#6aa9ff",
  storybook: "#ff88c2",
  "tanstack-query": "#ff9a5a",
  "testing-library": "#ff6f91",
  typescript: "#5aa9ff",
  unicorn: "#c792ea",
  vitest: "#a5e075",
};

export function selection() {
  const catalog = new Map(families().map((family) => [family.slug, family]));
  const clips = [];
  const missing = [];
  for (const [slug, ids] of Object.entries(CHOICES)) {
    const family = catalog.get(slug);
    if (!family) {
      missing.push(`${slug} (no family page)`);
      continue;
    }
    ids.forEach((id, index) => {
      const rule = family.rules.find((candidate) => candidate.rule === id);
      if (!rule) {
        missing.push(`${id} (no documented example)`);
        return;
      }
      clips.push({
        accent: ACCENTS[slug],
        accentLine: fade(ACCENTS[slug], 0.3),
        accentSoft: fade(ACCENTS[slug], 0.1),
        meta: `${family.total} ${family.title.toLowerCase()} rules · 725 across 21 families`,
        slug: `${slug}-0${index + 1}`,
        ...rule,
      });
    });
  }
  return { clips, missing };
}

function fade(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))
) {
  const { clips, missing } = selection();
  for (const clip of clips) {
    process.stdout.write(`${clip.slug} ${clip.rule}\n`);
  }
  for (const gap of missing) process.stdout.write(`MISSING ${gap}\n`);
  process.stdout.write(`${clips.length} clips\n`);
}
