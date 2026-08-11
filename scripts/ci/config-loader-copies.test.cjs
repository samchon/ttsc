// The completeness gate for `scripts/ci/config-loader-copies.cjs`.
//
// A drift gate that only ever runs against a tree it already agrees with proves
// nothing: it would report clean if its comparison silently matched everything.
// Every check the gate makes is therefore exercised here against a synthetic
// divergence built from the real sources, so the passing state below means the
// gate can still fail.

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  BEGIN_MARKER,
  COPIES,
  COPY_IDS,
  END_MARKER,
  SHARED,
  driftFailures,
  readRegion,
  readSources,
  regionFunctions,
} = require("./config-loader-copies.cjs");

/** The real sources with one copy rewritten. */
function withCopy(id, rewrite) {
  const sources = readSources();
  sources[id] = rewrite(sources[id]);
  return sources;
}

/** Splice `text` in just before a copy's closing marker. */
function insertIntoRegion(source, text) {
  return source.replace(END_MARKER, `${text}\n\n${END_MARKER}`);
}

test("the three Go config loader copies carry one implementation", () => {
  assert.deepEqual(driftFailures(), []);
});

test("changing one copy's code fails and names it", () => {
  // The exact divergence this gate was built for: #1157 taught `@ttsc/lint`'s
  // resolver to make a relative anchor absolute, and #1164 had to be filed a
  // cycle later because the other two copies never got it. Removing it from one
  // copy has to fail now instead of a cycle from now.
  const failures = driftFailures(
    withCopy("banner", (source) =>
      source.replace(
        "  if absolute, err := filepath.Abs(anchor); err == nil {\n    anchor = absolute\n  }\n",
        "",
      ),
    ),
  );
  assert.equal(failures.length, 1, failures.join("\n"));
  assert.match(failures[0], /nodePackageManifestFrom has drifted/);
  assert.match(failures[0], /packages\/banner\/driver\/banner\.go/);
  assert.match(failures[0], /packages\/lint\/linthost\/config\.go/);
});

test("a helper added to one copy alone fails as undeclared", () => {
  const failures = driftFailures(
    withCopy("strip", (source) =>
      insertIntoRegion(
        source,
        "func stripResolveSomethingNew(anchor string) string {\n  return anchor\n}",
      ),
    ),
  );
  assert.equal(failures.length, 1, failures.join("\n"));
  assert.match(failures[0], /stripResolveSomethingNew/);
  assert.match(failures[0], /not declared in SHARED/);
});

test("renaming a declared function out of a region fails", () => {
  const failures = driftFailures(
    withCopy("lint", (source) =>
      source.replace(/\bsetEnv\b/g, "setEnvironmentEntry"),
    ),
  );
  assert.ok(
    failures.some((failure) =>
      /setEnv is declared as the lint copy of setEnv/.test(failure),
    ),
    failures.join("\n"),
  );
});

test("moving a shared function outside the markers fails", () => {
  // Relocation is the quiet way a copy leaves the gate: the function still
  // exists and still compiles, and only its region membership changed.
  const failures = driftFailures(
    withCopy("banner", (source) => {
      const start = source.indexOf("func loaderFailureReason(");
      const stop = source.indexOf(END_MARKER);
      return `${source.slice(0, start)}${source.slice(stop)}\n${source.slice(start, stop)}`;
    }),
  );
  assert.equal(failures.length, 1, failures.join("\n"));
  assert.match(failures[0], /loaderFailureReason/);
  assert.match(failures[0], /no such function is inside the shared region/);
});

test("comments are free to differ, code is not", () => {
  assert.deepEqual(
    driftFailures(
      withCopy("strip", (source) =>
        source.replace(
          "func stripSetEnv(env []string, key, value string) []string {",
          "func stripSetEnv(env []string, key, value string) []string {\n  // A comment only this copy carries.",
        ),
      ),
    ),
    [],
  );
});

test("a copy borrowing another copy's error prefix fails", () => {
  // The prefix is canonicalized per copy, not erased: `@ttsc/banner:` in the
  // banner copy is the same policy as `@ttsc/strip:` in the strip copy, while
  // `@ttsc/lint:` inside the banner copy is a real mistake.
  const failures = driftFailures(
    withCopy("banner", (source) =>
      source.replace(
        '"@ttsc/banner: link config node_modules %s: %w"',
        '"@ttsc/lint: link config node_modules %s: %w"',
      ),
    ),
  );
  assert.equal(failures.length, 1, failures.join("\n"));
  assert.match(failures[0], /linkNearestNodeModules has drifted/);
});

test("a region that is missing, doubled, or inverted is an error", () => {
  for (const [rewrite, message] of [
    [(source) => source.replace(BEGIN_MARKER, "// gone"), /has no .*begin/],
    [(source) => source.replace(END_MARKER, "// gone"), /has no .*end/],
    [
      (source) => insertIntoRegion(source, BEGIN_MARKER),
      /opens the shared region twice/,
    ],
    [
      (source) => `${source}\n${END_MARKER}\n`,
      /closes the shared region twice/,
    ],
  ])
    assert.throws(() => driftFailures(withCopy("strip", rewrite)), message);
});

test("every copy is claimed for every shared function", () => {
  // The table's own two-way invariant. A copy that is neither declared nor
  // excused would let a deletion pass as an omission, which is the shape the
  // three copies were already in before #1169.
  for (const entry of SHARED) {
    const declared = Object.keys(entry.symbols ?? {});
    const excused = Object.keys(entry.absent ?? {});
    for (const id of COPY_IDS)
      assert.ok(
        declared.includes(id) !== excused.includes(id),
        `${entry.name} must either declare or excuse the ${id} copy, and not both`,
      );
    assert.ok(declared.length >= 2, `${entry.name} is not shared`);
  }
});

test("the regions hold the whole shared surface and nothing else", () => {
  // A floor per copy, not a total: an empty or half-parsed region would still
  // satisfy "no drift" while gating nothing at all.
  const sources = readSources();
  for (const id of COPY_IDS) {
    const found = regionFunctions(readRegion(id, sources[id]));
    const declared = SHARED.filter(
      (entry) => entry.symbols?.[id] !== undefined,
    ).length;
    assert.equal(
      found.size,
      declared,
      `${COPIES[id].file} has ${found.size} functions in its region and ${declared} declared`,
    );
    assert.ok(found.size >= 20, `${COPIES[id].file} region collapsed`);
  }
});
