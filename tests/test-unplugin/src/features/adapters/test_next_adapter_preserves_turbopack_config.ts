import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { AUTOMATIC_RULE_GLOBS } from "../../internal/adapter-next/AUTOMATIC_RULE_GLOBS";
import { LOADER } from "../../internal/adapter-next/LOADER";
import { LOADER_FORMS } from "../../internal/adapter-next/LOADER_FORMS";
import { LOADER_IDENTITIES } from "../../internal/adapter-next/LOADER_IDENTITIES";
import { isTtscLoader } from "../../internal/adapter-next/isTtscLoader";
import { loadNext } from "../../internal/adapter-next/loadNext";
import { loadersOf } from "../../internal/adapter-next/loadersOf";

/**
 * Verifies the wrapper is additive: it preserves a caller's Turbopack
 * configuration and never registers its loader twice.
 *
 * The README told users to wire `turbopack.rules` by hand, so a project
 * adopting the wrapper afterwards would carry both. Registering the loader
 * twice would transform every module twice, which is worse than the silence it
 * replaces, and discarding the caller's own rules would break their build.
 *
 * 1. Wrap configs carrying unrelated Turbopack settings, the README's manual
 *    rules, and other loaders on the same glob in object, array, empty,
 *    conditional, and mixed forms.
 * 2. Assert unrelated settings and rules survive, and ttsc runs last in every
 *    shared chain, where it sees the original source.
 * 3. Assert a spelling of ttsc's own loader (package name, path, file URL, or case
 *    variant) suppresses a second registration only while the filesystem proves
 *    the path is this package's regular loader file.
 */
export async function test_next_adapter_preserves_turbopack_config(): Promise<void> {
  const next = await loadNext();

  const preserved = next({
    turbopack: {
      resolveAlias: { "@": "./src" },
      rules: { "*.svg": { loaders: ["@svgr/webpack"] } },
    } as Record<string, unknown>,
  });
  assert.deepEqual(
    (preserved.turbopack as Record<string, unknown>).resolveAlias,
    { "@": "./src" },
    "unrelated Turbopack settings must survive",
  );
  assert.deepEqual(
    loadersOf(preserved.turbopack?.rules?.["*.svg"]),
    ["@svgr/webpack"],
    "an unrelated rule must survive untouched",
  );
  assert.ok(
    loadersOf(preserved.turbopack?.rules?.["*.ts"]).some(isTtscLoader),
    "and ttsc is still wired beside it",
  );

  // A caller who followed the README's manual instructions gets the exact same
  // four-rule set as the wrapper and none of them is registered twice.
  const manual = next({
    turbopack: {
      rules: Object.fromEntries(
        AUTOMATIC_RULE_GLOBS.map((glob) => [glob, { loaders: [LOADER] }]),
      ),
    },
  });
  assert.deepEqual(
    Object.keys(manual.turbopack?.rules ?? {}),
    AUTOMATIC_RULE_GLOBS,
  );
  for (const glob of AUTOMATIC_RULE_GLOBS) {
    assert.equal(
      loadersOf(manual.turbopack?.rules?.[glob]).filter(isTtscLoader).length,
      1,
      `${glob} must not be registered a second time`,
    );
  }

  // A caller with another loader on the same glob keeps it, with ttsc placed
  // where the chain runs it first. Turbopack runs rule loaders through
  // webpack's `loader-runner`, whose normal phase runs right to left, so the
  // last entry is the one that sees the original source, and ttsc has to be
  // that one because it transforms TypeScript into TypeScript.
  const sharedRule = {
    as: "*.js",
    futureSetting: { retained: true },
    loaders: ["other-loader"],
    type: "typescript",
  };
  const shared = next({
    turbopack: { rules: { "*.ts": sharedRule } },
  });
  const sharedRuleOutput = shared.turbopack?.rules?.["*.ts"] as Record<
    string,
    unknown
  >;
  const sharedLoaders = loadersOf(sharedRuleOutput);
  assert.equal(sharedLoaders.length, 2, "the caller's loader must survive");
  assert.equal(sharedLoaders[0], "other-loader");
  assert.ok(
    isTtscLoader(sharedLoaders[1]),
    "ttsc must see the original source",
  );
  assert.equal(sharedRuleOutput.as, sharedRule.as);
  assert.equal(sharedRuleOutput.type, sharedRule.type);
  assert.deepEqual(sharedRuleOutput.futureSetting, sharedRule.futureSetting);

  const noLoadersRule = {
    as: "*.js",
    futureSetting: { retained: true },
    type: "typescript",
  };
  const noLoaders = next({
    turbopack: { rules: { "*.ts": noLoadersRule } },
  }).turbopack?.rules?.["*.ts"] as Record<string, unknown>;
  assert.ok(!Array.isArray(noLoaders));
  assert.equal(noLoaders.as, noLoadersRule.as);
  assert.equal(noLoaders.type, noLoadersRule.type);
  assert.deepEqual(noLoaders.futureSetting, noLoadersRule.futureSetting);
  assert.equal(loadersOf(noLoaders).filter(isTtscLoader).length, 1);

  // Turbopack also accepts a bare array of loaders. Spreading that into an
  // object produced `{ "0": "other-loader", loaders: [...] }`, which Next's own
  // strict schema rejects as an unrecognized key.
  const arrayForm = next({
    turbopack: {
      rules: { "*.ts": ["other-loader"] } as Record<string, unknown>,
    },
  });
  const arrayRule = arrayForm.turbopack?.rules?.["*.ts"];
  assert.ok(
    Array.isArray(arrayRule),
    `an array rule must remain an array (got ${JSON.stringify(arrayRule)})`,
  );
  const arrayLoaders = loadersOf(arrayRule);
  assert.equal(arrayLoaders.length, 2);
  assert.equal(arrayLoaders[0], "other-loader");
  assert.ok(isTtscLoader(arrayLoaders[1]));

  const emptyCollection = next({
    turbopack: { rules: { "*.ts": [] } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(emptyCollection));
  assert.equal(emptyCollection.length, 1);
  assert.ok(isTtscLoader(emptyCollection[0]));

  const conditionalRule = {
    as: "*.js",
    condition: "browser",
    futureSetting: { retained: true },
    type: "typescript",
  };
  const conditional = next({
    turbopack: { rules: { "*.ts": conditionalRule } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(conditional));
  assert.ok(loadersOf(conditional[0]).some(isTtscLoader));
  assert.deepEqual(conditional[1], conditionalRule);

  const mixedInput = [
    "other-loader",
    { condition: "browser", loaders: ["browser-loader"] },
    { condition: "node", futureSetting: true, type: "typescript" },
  ];
  const mixed = next({
    turbopack: { rules: { "*.ts": mixedInput } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(mixed));
  assert.ok(loadersOf(mixed[0]).some(isTtscLoader));
  assert.deepEqual(mixed.slice(1), mixedInput);

  for (const loader of LOADER_FORMS) {
    const resolved = next({
      turbopack: { rules: { "*.ts": [loader] } },
    }).turbopack?.rules?.["*.ts"];
    assert.ok(Array.isArray(resolved));
    assert.equal(
      resolved.length,
      1,
      `${JSON.stringify(loader)} must not be registered a second time`,
    );
    assert.deepEqual(resolved[0], loader);
  }

  const conditionalLoader = {
    condition: "browser",
    loaders: [LOADER],
  };
  const conditionallyCovered = next({
    turbopack: { rules: { "*.ts": conditionalLoader } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(conditionallyCovered));
  assert.ok(loadersOf(conditionallyCovered[0]).some(isTtscLoader));
  assert.deepEqual(conditionallyCovered[1], conditionalLoader);

  const unrelated = path.join(
    path.dirname(LOADER_IDENTITIES[1]!),
    "..",
    "..",
    "ttsc",
    "lib",
    "turbopack.js",
  );
  const unrelatedRule = next({
    turbopack: { rules: { "*.ts": [unrelated] } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(unrelatedRule));
  assert.equal(unrelatedRule[0], unrelated);
  assert.ok(isTtscLoader(unrelatedRule[1]));

  // An absolute loader's package ownership is a filesystem observation, not a
  // permanent property of its lexical path. Reusing the wrapper in one process
  // must see both directions of an atomic install or link retarget.
  const positiveRoot = TestProject.tmpdir("ttsc-next-loader-positive-");
  const positiveLoader = path.join(positiveRoot, "lib", "turbopack.js");
  const positiveLoaderUrl = pathToFileURL(positiveLoader).href;
  fs.mkdirSync(path.dirname(positiveLoader), { recursive: true });
  fs.writeFileSync(positiveLoader, "", "utf8");
  fs.writeFileSync(
    path.join(positiveRoot, "package.json"),
    JSON.stringify({ name: "@ttsc/unplugin" }),
    "utf8",
  );
  const initiallyOwned = loadersOf(
    next({
      turbopack: { rules: { "*.ts": [positiveLoaderUrl] } },
    }).turbopack?.rules?.["*.ts"],
  );
  assert.deepEqual(initiallyOwned, [positiveLoaderUrl]);
  fs.writeFileSync(
    path.join(positiveRoot, "package.json"),
    JSON.stringify({ name: "unrelated-loader" }),
    "utf8",
  );
  const replacedOwner = loadersOf(
    next({
      turbopack: { rules: { "*.ts": [positiveLoaderUrl] } },
    }).turbopack?.rules?.["*.ts"],
  );
  assert.equal(replacedOwner[0], positiveLoaderUrl);
  assert.ok(
    isTtscLoader(replacedOwner[1]),
    "a stale positive ownership verdict must not suppress the ttsc loader",
  );

  const negativeStore = TestProject.tmpdir("ttsc-next-loader-negative-");
  const foreignRoot = path.join(negativeStore, "foreign");
  const ownedRoot = path.join(negativeStore, "owned");
  const linkedRoot = path.join(negativeStore, "current");
  for (const root of [foreignRoot, ownedRoot]) {
    const loader = path.join(root, "lib", "turbopack.js");
    fs.mkdirSync(path.dirname(loader), { recursive: true });
    fs.writeFileSync(loader, "", "utf8");
  }
  fs.writeFileSync(
    path.join(foreignRoot, "package.json"),
    JSON.stringify({ name: "unrelated-loader" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(ownedRoot, "package.json"),
    JSON.stringify({ name: "@ttsc/unplugin" }),
    "utf8",
  );
  fs.symlinkSync(
    foreignRoot,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );
  const negativeLoader = path.join(linkedRoot, "lib", "turbopack.js");
  const initiallyForeign = loadersOf(
    next({
      turbopack: { rules: { "*.ts": [negativeLoader] } },
    }).turbopack?.rules?.["*.ts"],
  );
  assert.equal(initiallyForeign[0], negativeLoader);
  assert.ok(isTtscLoader(initiallyForeign[1]));
  fs.rmSync(linkedRoot, { force: true, recursive: true });
  fs.symlinkSync(
    ownedRoot,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.deepEqual(
    loadersOf(
      next({
        turbopack: { rules: { "*.ts": [negativeLoader] } },
      }).turbopack?.rules?.["*.ts"],
    ),
    [negativeLoader],
    "a stale negative ownership verdict must not duplicate the ttsc loader",
  );

  // Loader ownership follows the filesystem's identity and file-kind answers,
  // not the caller's lexical casing. A case-insensitive volume must collapse a
  // differently cased spelling, while a case-sensitive volume must retain it
  // as a missing foreign loader and append ttsc's real loader.
  const identityRoot = TestProject.tmpdir("ttsc-next-loader-identity-");
  fs.mkdirSync(path.join(identityRoot, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(identityRoot, "package.json"),
    JSON.stringify({ name: "@ttsc/unplugin" }),
    "utf8",
  );
  for (const extension of ["js", "mjs"]) {
    const identityLoader = path.join(
      identityRoot,
      "lib",
      `turbopack.${extension}`,
    );
    fs.writeFileSync(identityLoader, "", "utf8");
    const caseVariant = path.join(
      identityRoot,
      "LIB",
      `TURBOPACK.${extension.toUpperCase()}`,
    );
    const caseVariantLoaders = loadersOf(
      next({
        turbopack: { rules: { "*.ts": [caseVariant] } },
      }).turbopack?.rules?.["*.ts"],
    );
    if (fs.existsSync(caseVariant)) {
      assert.deepEqual(
        caseVariantLoaders,
        [caseVariant],
        `a case-insensitive filesystem identity must suppress the duplicate ${extension} loader`,
      );
    } else {
      assert.equal(caseVariantLoaders[0], caseVariant);
      assert.ok(
        isTtscLoader(caseVariantLoaders[1]),
        `a case-sensitive filesystem must not fold a missing ${extension} case variant`,
      );
    }

    const upperSchemeUrl = pathToFileURL(identityLoader).href.replace(
      /^file:/,
      "FILE:",
    );
    assert.deepEqual(
      loadersOf(
        next({
          turbopack: { rules: { "*.ts": [upperSchemeUrl] } },
        }).turbopack?.rules?.["*.ts"],
      ),
      [upperSchemeUrl],
      `the case-insensitive file URL scheme must preserve ${extension} loader ownership`,
    );
  }

  // A package manifest cannot own a loader path that does not name a regular
  // file. Both controls would be false positives if ownership were inferred
  // only from the lexical `lib/turbopack.js` suffix and neighboring manifest.
  for (const kind of ["missing", "directory"] as const) {
    const invalidRoot = TestProject.tmpdir(`ttsc-next-loader-${kind}-`);
    const invalidLoader = path.join(invalidRoot, "lib", "turbopack.js");
    fs.mkdirSync(path.dirname(invalidLoader), { recursive: true });
    if (kind === "directory") {
      fs.mkdirSync(invalidLoader);
    }
    fs.writeFileSync(
      path.join(invalidRoot, "package.json"),
      JSON.stringify({ name: "@ttsc/unplugin" }),
      "utf8",
    );
    const invalidLoaders = loadersOf(
      next({
        turbopack: { rules: { "*.ts": [invalidLoader] } },
      }).turbopack?.rules?.["*.ts"],
    );
    assert.equal(invalidLoaders[0], invalidLoader);
    assert.ok(
      isTtscLoader(invalidLoaders[1]),
      `an owned package's ${kind} loader path must not suppress the real loader`,
    );
  }
}
