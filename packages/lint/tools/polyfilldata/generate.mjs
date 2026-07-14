// Regenerates the versioned compatibility artifact and oracle fixtures
// consumed by the `unicorn/no-unnecessary-polyfills` lint rule:
//
//   packages/lint/linthost/polyfill_data_gen.json
//   packages/lint/test/testdata/polyfills/upstream-patterns.json
//   packages/lint/test/testdata/polyfills/browserslist-cases.json
//   packages/lint/test/testdata/polyfills/corejs-compat-cases.json
//
// The artifact is derived from the exact upstream datasets the ESLint rule
// resolves at runtime — core-js-compat (feature compatibility + entry-point
// maps), caniuse-lite (browser agents), node-releases (Node.js versions and
// EOL schedule), and electron-to-chromium (Electron → Chromium mapping) —
// plus the version-pinned constants browserslist bakes into its query engine
// (`defaults`, `dead`, Firefox ESR, browser-name aliases) and the alias /
// valid-target tables of core-js-compat's targets parser. Every source is
// downloaded as the pinned npm tarball and verified against the pin before
// anything is emitted, so the artifact is authoritative and
// provenance-stamped rather than hand-typed.
//
// The two `*-cases.json` fixtures are oracle outputs: the pinned browserslist
// and core-js-compat packages are executed in-process against a curated query
// / targets matrix (with `Date.now` frozen for time-dependent queries) and
// their results recorded, so the Go port is pinned to the real upstream
// resolver rather than to its own output.
//
// Regenerate with:
//
//   node packages/lint/tools/polyfilldata/generate.mjs
//
// Bump the PINNED_VERSIONS map to roll the datasets forward; the script fails
// loudly when a tarball's package.json disagrees with its pin or when the
// browserslist / core-js-compat / eslint-plugin-unicorn sources no longer
// contain the exact code shapes the extraction and the Go port rely on.

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

const PINNED_VERSIONS = {
  "eslint-plugin-unicorn": "71.1.0",
  "core-js-compat": "3.49.0",
  browserslist: "4.28.6",
  "caniuse-lite": "1.0.30001805",
  "node-releases": "2.0.51",
  "electron-to-chromium": "1.5.389",
  "change-case": "5.4.4",
  // Required by browserslist at load time (`baseline ...` queries); the Go
  // port rejects those queries, so only the pin (not the data) matters.
  "baseline-browser-mapping": "2.10.43",
};

// Frozen `Date.now` used while resolving time-dependent browserslist queries
// (`last N years`, `maintained node versions`) so the recorded oracle outputs
// stay reproducible between data bumps. Mirrored into the fixture so the Go
// tests evaluate the same instant.
const FROZEN_NOW_MS = Date.UTC(2026, 0, 7);

const scriptDir = path.dirname(
  new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const lintRoot = path.resolve(scriptDir, "..", "..");
const artifactPath = path.join(lintRoot, "linthost", "polyfill_data_gen.json");
const fixtureDir = path.join(lintRoot, "test", "testdata", "polyfills");

// Keep discovery-dependent behavior hermetic while the pinned packages run.
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "1";
process.env.BROWSERSLIST_DISABLE_CACHE = "1";
delete process.env.BROWSERSLIST;
delete process.env.BROWSERSLIST_CONFIG;
delete process.env.BROWSERSLIST_ENV;
delete process.env.BROWSERSLIST_STATS;
delete process.env.BROWSERSLIST_ROOT_PATH;
delete process.env.NODE_ENV;

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-polyfilldata-"));
try {
  // Extract every pinned tarball into a flat node_modules layout so the
  // packages can be required in-process with their real dependency graph.
  const nodeModules = path.join(workDir, "node_modules");
  const roots = {};
  for (const [name, version] of Object.entries(PINNED_VERSIONS)) {
    roots[name] = await fetchPackage(name, version, nodeModules);
  }

  const requireFrom = createRequire(path.join(workDir, "noop.js"));

  const compatData = requireFrom(path.join(roots["core-js-compat"], "data.json"));
  const entries = requireFrom(path.join(roots["core-js-compat"], "entries.json"));
  const modules = requireFrom(path.join(roots["core-js-compat"], "modules.json"));
  const external = requireFrom(path.join(roots["core-js-compat"], "external.json"));
  if (JSON.stringify(Object.keys(compatData)) !== JSON.stringify(modules)) {
    throw new Error("core-js-compat data.json key order no longer matches modules.json");
  }

  // caniuse-lite ships packed data; run the package's own unpacker so the
  // decoded agents table is byte-for-byte what browserslist sees at runtime.
  const agentsUnpacked = requireFrom(
    path.join(roots["caniuse-lite"], "dist", "unpacker", "agents.js"),
  ).agents;
  const agents = Object.entries(agentsUnpacked).map(([name, data]) => ({
    name,
    // browserslist derives `versions` and `released` from the raw
    // (null-padded) version list: released drops the trailing three slots
    // BEFORE nulls are filtered. Replicate that derivation here so the Go
    // side only consumes normalized arrays.
    versions: data.versions.filter((v) => typeof v === "string"),
    released: data.versions.slice(0, -3).filter((v) => typeof v === "string"),
    usage: Object.entries(data.usage_global).map(([version, usage]) => ({
      v: version,
      u: usage,
    })),
    // Ordered pairs in JS object-key order: `since` / `last N years` results
    // feed a stable sort whose ties preserve this iteration order.
    releaseDate: Object.entries(data.release_date)
      .filter(([, date]) => date !== null)
      .map(([version, date]) => ({ v: version, d: date })),
  }));

  const envs = requireFrom(
    path.join(roots["node-releases"], "data", "processed", "envs.json"),
  );
  const nodeSchedule = requireFrom(
    path.join(roots["node-releases"], "data", "release-schedule", "release-schedule.json"),
  );
  const electronVersions = requireFrom(
    path.join(roots["electron-to-chromium"], "versions.js"),
  );

  const browserslistSource = fs.readFileSync(
    path.join(roots.browserslist, "index.js"),
    "utf8",
  );
  const targetsParserSource = fs.readFileSync(
    path.join(roots["core-js-compat"], "targets-parser.js"),
    "utf8",
  );
  const compatHelpersSource = fs.readFileSync(
    path.join(roots["core-js-compat"], "helpers.js"),
    "utf8",
  );
  const compatSource = fs.readFileSync(
    path.join(roots["core-js-compat"], "compat.js"),
    "utf8",
  );
  assertBrowserslistSourceAnchors(browserslistSource);
  assertCoreJsCompatSourceAnchors(targetsParserSource, compatHelpersSource, compatSource);

  // Load the real pinned modules: exported constants feed the artifact and
  // the executed resolvers feed the oracle fixtures.
  const browserslist = requireFrom("browserslist");
  const coreJsCompat = requireFrom("core-js-compat");
  const browserslistConstants = {
    ...extractBrowserslistConstants(browserslistSource),
    defaults: [...browserslist.defaults],
    aliases: { ...browserslist.aliases },
    desktopNames: { ...browserslist.desktopNames },
    firefoxEsr: browserslist.versionAliases.firefox.esr,
  };
  const coreJsTargetTables = extractCoreJsTargetTables(targetsParserSource);

  const artifact = {
    provenance: {
      generator: "packages/lint/tools/polyfilldata/generate.mjs",
      note:
        "Derived from the pinned upstream datasets below. Do not edit by hand; " +
        "rerun the generator to refresh.",
      "eslint-plugin-unicorn": PINNED_VERSIONS["eslint-plugin-unicorn"],
      "core-js-compat": PINNED_VERSIONS["core-js-compat"],
      browserslist: PINNED_VERSIONS.browserslist,
      "caniuse-lite": PINNED_VERSIONS["caniuse-lite"],
      "node-releases": PINNED_VERSIONS["node-releases"],
      "electron-to-chromium": PINNED_VERSIONS["electron-to-chromium"],
    },
    browserslist: browserslistConstants,
    coreJs: coreJsTargetTables,
    // Ordered feature list: candidate collection and best-match tie-breaks in
    // the rule follow core-js-compat's data.json key order.
    modules,
    compat: compatData,
    entries,
    esModulesTargets: external.modules,
    agents,
    nodeVersions: envs.map((release) => release.version),
    nodeSchedule,
    // Ordered pairs: `last N electron versions` queries depend on key order.
    electronToChromium: Object.keys(electronVersions).map((electron) => [
      electron,
      electronVersions[electron],
    ]),
  };
  if (
    JSON.stringify(artifact.nodeVersions) !== JSON.stringify(browserslist.nodeVersions)
  ) {
    throw new Error("node-releases envs.json no longer matches browserslist.nodeVersions");
  }

  writeIfChanged(artifactPath, JSON.stringify(artifact, null, 1) + "\n");

  const changeCase = await import(
    pathToFileURL(path.join(roots["change-case"], "dist", "index.js")).href
  );
  const unicornRuleSource = fs.readFileSync(
    path.join(roots["eslint-plugin-unicorn"], "rules", "no-unnecessary-polyfills.js"),
    "utf8",
  );
  const patterns = buildUpstreamPatternFixture(
    compatData,
    changeCase.camelCase,
    unicornRuleSource,
  );
  writeIfChanged(
    path.join(fixtureDir, "upstream-patterns.json"),
    JSON.stringify(
      {
        provenance: {
          generator: "packages/lint/tools/polyfilldata/generate.mjs",
          "eslint-plugin-unicorn": PINNED_VERSIONS["eslint-plugin-unicorn"],
          "core-js-compat": PINNED_VERSIONS["core-js-compat"],
          "change-case": PINNED_VERSIONS["change-case"],
        },
        polyfills: patterns,
      },
      null,
      1,
    ) + "\n",
  );

  const emptyDir = path.join(workDir, "empty");
  fs.mkdirSync(emptyDir, { recursive: true });
  writeIfChanged(
    path.join(fixtureDir, "browserslist-cases.json"),
    JSON.stringify(
      {
        provenance: {
          generator: "packages/lint/tools/polyfilldata/generate.mjs",
          browserslist: PINNED_VERSIONS.browserslist,
          "caniuse-lite": PINNED_VERSIONS["caniuse-lite"],
          "node-releases": PINNED_VERSIONS["node-releases"],
          "electron-to-chromium": PINNED_VERSIONS["electron-to-chromium"],
        },
        frozenNowMs: FROZEN_NOW_MS,
        cases: buildBrowserslistCaseFixture(browserslist, emptyDir),
      },
      null,
      1,
    ) + "\n",
  );

  writeIfChanged(
    path.join(fixtureDir, "corejs-compat-cases.json"),
    JSON.stringify(
      {
        provenance: {
          generator: "packages/lint/tools/polyfilldata/generate.mjs",
          "core-js-compat": PINNED_VERSIONS["core-js-compat"],
          browserslist: PINNED_VERSIONS.browserslist,
        },
        cases: buildCoreJsCompatCaseFixture(coreJsCompat),
      },
      null,
      1,
    ) + "\n",
  );

  console.log("wrote", artifactPath);
  console.log("wrote", path.join(fixtureDir, "upstream-patterns.json"));
  console.log("wrote", path.join(fixtureDir, "browserslist-cases.json"));
  console.log("wrote", path.join(fixtureDir, "corejs-compat-cases.json"));
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}

/** Download and extract one pinned npm tarball; return the package root. */
async function fetchPackage(name, version, nodeModules) {
  const url = `https://registry.npmjs.org/${name}/-/${tarballBasename(name)}-${version}.tgz`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
  }
  const tarball = zlib.gunzipSync(Buffer.from(await response.arrayBuffer()));
  const destination = path.join(nodeModules, ...name.split("/"));
  extractTar(tarball, destination);
  const packageRoot = path.join(destination, "package");
  // npm tarballs nest everything under `package/`; hoist so the directory is
  // requireable as a regular node_modules entry.
  for (const entry of fs.readdirSync(packageRoot)) {
    fs.renameSync(path.join(packageRoot, entry), path.join(destination, entry));
  }
  fs.rmdirSync(packageRoot);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(destination, "package.json"), "utf8"),
  );
  if (manifest.version !== version) {
    throw new Error(`${name}: expected version ${version}, tarball contains ${manifest.version}`);
  }
  return destination;
}

/** Scoped packages publish tarballs named after the unscoped basename. */
function tarballBasename(name) {
  return name.startsWith("@") ? name.split("/")[1] : name;
}

/** Minimal ustar extraction: regular files only, pax/longname entries skipped. */
function extractTar(buffer, destination) {
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const size = parseInt(readTarString(header, 124, 12) || "0", 8);
    const type = String.fromCharCode(header[156]);
    const fullName = prefix ? `${prefix}/${name}` : name;
    offset += 512;
    if (type === "0" || type === "\0") {
      const target = path.join(destination, ...fullName.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buffer.subarray(offset, offset + size));
    }
    offset += Math.ceil(size / 512) * 512;
  }
}

function readTarString(header, start, length) {
  const raw = header.subarray(start, start + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? length : end).toString("utf8");
}

/**
 * Pull the version-pinned query-engine constants out of browserslist's source.
 * Anchored regexes fail loudly when upstream reshapes the code, which is the
 * signal to revisit the Go port before regenerating.
 */
function extractBrowserslistConstants(source) {
  const androidEvergreen = source.match(/var ANDROID_EVERGREEN_FIRST = '(\d+)'/);
  const opMobBlink = source.match(/var OP_MOB_BLINK_FIRST = (\d+)/);
  const dead = source.match(/var dead = (\[[^\]]+\])/);
  if (!androidEvergreen || !opMobBlink || !dead) {
    throw new Error("browserslist/index.js no longer matches the expected constant shapes");
  }
  return {
    androidEvergreenFirst: androidEvergreen[1],
    opMobBlinkFirst: Number(opMobBlink[1]),
    dead: parseJsStringArray(dead[1]),
  };
}

/**
 * Extract the engine alias and valid-target tables from core-js-compat's
 * targets parser so the Go port consumes versioned data instead of a
 * hand-copied table.
 */
function extractCoreJsTargetTables(source) {
  const aliasesBlock = source.match(/const aliases = new Map\(\[([\s\S]*?)\]\);/);
  const validBlock = source.match(/const validTargets = new Set\(\[([\s\S]*?)\]\);/);
  if (!aliasesBlock || !validBlock) {
    throw new Error("core-js-compat/targets-parser.js no longer matches the expected table shapes");
  }
  const aliases = {};
  for (const [, from, to] of aliasesBlock[1].matchAll(/\['([^']+)', '([^']+)'\]/g)) {
    aliases[from] = to;
  }
  if (Object.keys(aliases).length === 0) {
    throw new Error("core-js-compat targets-parser aliases table parsed empty");
  }
  return {
    aliases,
    validTargets: parseJsStringArray(validBlock[1]),
  };
}

/** Parse a single-quoted JS string-array literal extracted from source text. */
function parseJsStringArray(text) {
  const matches = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
  if (matches.length === 0) {
    throw new Error(`expected a string array literal, got: ${text}`);
  }
  return matches;
}

/**
 * Rebuild the upstream rule's polyfill pattern/token table so the Go port can
 * be pinned against it byte-for-byte. The construction below is a verbatim
 * transliteration of the table-building block in
 * `rules/no-unnecessary-polyfills.js`; `assertRuleSourceAnchors` fails the
 * generation when that block drifts so this copy cannot silently go stale.
 */
function buildUpstreamPatternFixture(compatData, camelCase, ruleSource) {
  assertRuleSourceAnchors(ruleSource);

  const additionalPolyfillModules = {
    "es.promise.finally": ["p-finally"],
    "es.object.set-prototype-of": ["setprototypeof"],
    "es.string.code-point-at": ["code-point-at"],
  };
  const additionalPolyfillPatterns = Object.fromEntries(
    Object.entries(additionalPolyfillModules).map(([feature, modules]) => [
      feature,
      `|(${modules.join("|")})`,
    ]),
  );
  const prefixes = "(mdn-polyfills/|polyfill-)";
  const suffixes = "(-polyfill)";
  const delimiter = String.raw`(\.|-|\.prototype\.|/)?`;
  const moduleDelimiter = /[-./]/;
  const getFirstSegment = (value) => {
    const [firstSegment = ""] = value.split(moduleDelimiter);
    return firstSegment;
  };
  const addPolyfillToken = (tokens, value) => {
    if (!value) {
      return;
    }
    const lowercaseValue = value.toLowerCase();
    tokens.add(lowercaseValue);
    tokens.add(getFirstSegment(lowercaseValue));
    const camelCasedValue = camelCase(value).toLowerCase();
    tokens.add(camelCasedValue);
    tokens.add(getFirstSegment(camelCasedValue));
  };

  return Object.keys(compatData).map((feature) => {
    const [rawEcmaVersion, rawConstructorName, rawMethodName = ""] = feature.split(".");
    let ecmaVersion = rawEcmaVersion;
    let constructorName = rawConstructorName;
    let methodName = rawMethodName;
    if (ecmaVersion === "es") {
      ecmaVersion = String.raw`(es\d*)`;
    }
    constructorName = `(${constructorName}|${camelCase(constructorName)})`;
    methodName &&= `(${methodName}|${camelCase(methodName)})`;
    const methodOrConstructor = methodName || constructorName;
    const patterns = [
      `^((${prefixes}?(`,
      methodName && `(${ecmaVersion}${delimiter}${constructorName}${delimiter}${methodName})|`,
      methodName && `(${constructorName}${delimiter}${methodName})|`,
      `(${ecmaVersion}${delimiter}${constructorName}))`,
      `${suffixes}?)|`,
      `(${prefixes}${methodOrConstructor}|${methodOrConstructor}${suffixes})`,
      `${additionalPolyfillPatterns[feature] || ""})$`,
    ];
    const tokens = new Set();
    if (rawEcmaVersion === "es") {
      tokens.add("es");
    } else {
      addPolyfillToken(tokens, rawEcmaVersion);
    }
    addPolyfillToken(tokens, rawConstructorName);
    addPolyfillToken(tokens, rawMethodName);
    for (const module of additionalPolyfillModules[feature] || []) {
      addPolyfillToken(tokens, module);
    }
    return { feature, pattern: patterns.join(""), tokens: [...tokens] };
  });
}

/**
 * Resolve a curated, deterministic query matrix with the real pinned
 * browserslist so the Go port's resolver is pinned to upstream outputs.
 * Time-dependent queries run under the frozen `Date.now`; queries that need
 * inputs the Go port deliberately rejects (`extends`, `supports`, regional
 * usage, `baseline`, `current node`) are excluded — the Go tests assert those
 * return errors instead.
 */
function buildBrowserslistCaseFixture(browserslist, emptyDir) {
  const queries = [
    // Combinators, defaults, dead.
    "defaults",
    "dead",
    "last 2 chrome versions, last 2 firefox versions",
    "last 2 chrome versions or last 2 ff versions",
    "chrome > 90 and chrome < 100",
    "last 2 versions and not chrome > 0",
    "> 0.5% and not dead",
    ["> 0.2%", "iOS 14", "not dead", "not op_mini all"],
    ["node 6"],
    // Global usage percentages and coverage.
    "> 0.5%",
    ">= 1%",
    "< 0.1%",
    "<= 0.05%",
    "cover 95%",
    // Last N versions across browsers, electron, and node.
    "last 2 versions",
    "last 1 major versions",
    "last 4 chrome versions",
    "last 2 chrome major versions",
    "last 2 and_chr versions",
    "last 2 android versions",
    "last 2 op_mob versions",
    "last 5 electron versions",
    "last 2 electron major versions",
    "last 4 node versions",
    "last 2 node major versions",
    // Unreleased.
    "unreleased versions",
    "unreleased chrome versions",
    "unreleased electron versions",
    // Release dates (deterministic: pinned release data).
    "since 2024",
    "since 2024-06",
    "since 2024-06-15",
    // Time-dependent (evaluated under the frozen Date.now).
    "last 2 years",
    "last 1.5 years",
    "maintained node versions",
    // Electron.
    "electron 32.0",
    "electron >= 35",
    "electron <= 1.1",
    "electron 28.0-30.5",
    // Node semver behaviors.
    "node 20",
    "node 20.11",
    "node 20.11.1",
    "node >= 20",
    "node < 0.12",
    "node 10 - 12",
    "node 12.0 - 14",
    // Browser versions, rays, ranges, aliases, special versions.
    "chrome 100",
    "chrome >= 130",
    "chrome < 20",
    "chrome 90-100",
    "Chrome 100",
    "firefox esr",
    "ff >= 130",
    "fx 100",
    "firefox > 130",
    "explorer 6-8",
    "ie >= 10",
    "opera 12.1",
    "ios 15.0-15.1",
    "ios_saf 15.4",
    "ios 7.0",
    "safari tp",
    "safari 17",
    "android >= 4",
    "op_mini all",
    "baidu >= 0",
    "op_mob <= 12.1",
    "samsung 4",
    "kaios 2.5",
    "phantomjs 1.9",
    "phantomjs 2.1",
    // Errors the Go port must reproduce (any error disables the rule).
    "not ie 11",
    "unknownbrowser 42",
    "chrome",
    "last two versions",
    "node 99",
    "electron 9999",
    "chrome 9999",
    "since 20",
  ];

  const originalNow = Date.now;
  Date.now = () => FROZEN_NOW_MS;
  try {
    return queries.map((query) => {
      try {
        return {
          query,
          expected: browserslist(query, { path: emptyDir, env: "production" }),
        };
      } catch {
        return { query, error: true };
      }
    });
  } finally {
    Date.now = originalNow;
  }
}

/**
 * Record `coreJsCompat({targets}).list` for a targets matrix covering every
 * engine family, alias normalization, esmodules handling, and the error
 * shapes the rule swallows.
 */
function buildCoreJsCompatCaseFixture(coreJsCompat) {
  const compat = coreJsCompat.default ?? coreJsCompat;
  const targetsMatrix = [
    { node: "18" },
    { node: ">=18" },
    { node: "22" },
    { node: "0.1.0" },
    { node: "4" },
    { node: 18 },
    "node >4",
    "node 6",
    ["chrome 55", "safari 11"],
    { chrome: "80" },
    { browsers: "last 2 chrome versions" },
    { browsers: { chrome: "100", firefox: "110" } },
    { esmodules: true },
    { esmodules: "intersect", node: "18" },
    { esmodules: true, browsers: "chrome 100" },
    { ie: "11" },
    { ios_saf: "14" },
    { NODE: "20" },
    { node: "20", npm: "7" },
    { opera_mobile: "70" },
    { android: "10" },
    { deno: "1.30" },
    { bun: "1.0" },
    { electron: "25.0" },
    { edge: "110" },
    { samsung: "20" },
    { "react-native": "0.70" },
    { rhino: "1.7.14" },
    { hermes: "0.12" },
    { quest: "5.0" },
    { firefox: "115", chrome: "109" },
    {},
    { node: "*" },
    "totally !!! invalid query",
  ];
  return targetsMatrix.map((targets) => {
    try {
      return { targets, expected: compat({ targets }).list };
    } catch {
      return { targets, error: true };
    }
  });
}

/**
 * Anchor lines whose presence in the upstream rule source certifies that the
 * transliterated pattern construction above still matches upstream.
 */
function assertRuleSourceAnchors(ruleSource) {
  const anchors = [
    "const prefixes = '(mdn-polyfills/|polyfill-)';",
    "const suffixes = '(-polyfill)';",
    "const delimiter = String.raw`(\\.|-|\\.prototype\\.|/)?`;",
    "'es.promise.finally': ['p-finally'],",
    "'es.object.set-prototype-of': ['setprototypeof'],",
    "'es.string.code-point-at': ['code-point-at'],",
    "ecmaVersion = String.raw`(es\\d*)`;",
    "constructorName = `(${constructorName}|${camelCase(constructorName)})`;",
    "methodName &&= `(${methodName}|${camelCase(methodName)})`;",
    "`^((${prefixes}?(`,",
    "`${suffixes}?)|`,",
    "`(${prefixes}${methodOrConstructor}|${methodOrConstructor}${suffixes})`,",
    "`${additionalPolyfillPatterns[feature] || ''})$`,",
    "const camelCasedValue = camelCase(value).toLowerCase();",
    // Anchors for the rule logic the Go port transliterates beyond the
    // pattern table: candidate prefiltering, target resolution, core-js
    // entry handling, and the exact diagnostic messages.
    "const directFeatureCheckPolyfills = new Set([",
    "'es6-symbol',",
    "'promise-polyfill',",
    "'es6-promise',",
    "'weakmap-polyfill',",
    "if (value.startsWith('polyfill-')) {",
    "if (value.startsWith('mdn-polyfills/')) {",
    "if (importedModule.startsWith('.prototype.', constructorIndex)) {",
    "} else if (['.', '-', '/'].includes(importedModule[constructorIndex])) {",
    "const segments = polyfill.feature.split('.').length;",
    "const browserslistOptions = {path: dirname, env: 'production'};",
    "const browserslistConfig = browserslist.loadConfig(browserslistOptions);",
    "return packageJsonResult.packageJson.engines;",
    "const targetsCacheKey = JSON.stringify(targets);",
    "unavailableFeatureSet = new Set(coreJsCompat({targets}).list);",
    "|| (feature.startsWith('esnext.') && features.includes(feature.replace('esnext.', 'es.')))",
    "if (typeof importedModule !== 'string' || ['.', '/'].includes(importedModule[0])) {",
    "const coreJsModuleFeatures = coreJsEntries[importedModule.replace('core-js-pure', 'core-js')];",
    "if (coreJsModuleFeatures.length > 1) {",
    "} else if (!unavailableFeatureSet.has(coreJsModuleFeatures[0])) {",
    "const matchedCoreJsModuleFeatures = coreJsEntries[`core-js/full/${namespace}${method && '/'}${method}`];",
    "[MESSAGE_ID_POLYFILL]: 'Use built-in instead.',",
    "'All polyfilled features imported from `{{coreJsModule}}` are available as built-ins. Use the built-ins instead.',",
  ];
  for (const anchor of anchors) {
    if (!ruleSource.includes(anchor)) {
      throw new Error(
        `eslint-plugin-unicorn rule source drifted; missing anchor: ${anchor}`,
      );
    }
  }
}

/**
 * Anchor lines certifying the browserslist code shapes the Go port
 * transliterates (config discovery, env picking, sorting, node matching).
 */
function assertBrowserslistSourceAnchors(source) {
  const anchors = [
    "var FIREFOX_ESR_VERSION = '140'",
    "return (versionA + '.').indexOf(versionB + '.') === 0",
    "released: normalize(agents[name].versions.slice(0, -3)),",
    "var minimum = majorVersions[majorVersions.length - number]",
    "return parseFloat(v.split('-')[1] || v)",
    "if (parts[1] === '0') {",
    "var iFirstEvergreen = chromeVersions.indexOf(ANDROID_EVERGREEN_FIRST)",
    "jump = getMajor(latest) - OP_MOB_BLINK_FIRST + 1",
    "return compareSemver(version2.split('.'), version1.split('.'))",
  ];
  for (const anchor of anchors) {
    if (!source.includes(anchor)) {
      throw new Error(`browserslist/index.js drifted; missing anchor: ${anchor}`);
    }
  }
}

/**
 * Anchor lines certifying the core-js-compat code shapes the Go port
 * transliterates (sloppy semver, module checking, esnext filtering,
 * targets normalization).
 */
function assertCoreJsCompatSourceAnchors(targetsParser, helpers, compat) {
  const anchors = [
    [targetsParser, "const { browsers, esmodules, node, ...rest } = (typeof targets != 'object' || Array.isArray(targets))"],
    [targetsParser, "const normalizedESModules = esmodules === 'intersect' ? 'intersect' : !!esmodules;"],
    [targetsParser, "list.push(['node', node === 'current' ? process.versions.node : node]);"],
    [targetsParser, "if (!reduced.has(engine) || compare(version, '<=', reduced.get(engine))) {"],
    [helpers, "const VERSION_PATTERN = /(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?/;"],
    [helpers, "if ($module.startsWith('esnext.') && modulesSet.has($module.replace(/^esnext\\./, 'es.'))) {"],
    [compat, "if (!has(requirements, engine) || compare(version, '<', requirements[engine])) {"],
    [compat, "if (!inverse) modules = filterOutStabilizedProposals(modules);"],
  ];
  for (const [source, anchor] of anchors) {
    if (!source.includes(anchor)) {
      throw new Error(`core-js-compat source drifted; missing anchor: ${anchor}`);
    }
  }
}

function writeIfChanged(target, content) {
  if (fs.existsSync(target) && fs.readFileSync(target, "utf8") === content) {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
