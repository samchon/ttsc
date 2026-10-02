import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSourceBuildCachePaths } from "../../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { FixtureFiles } from "../../../internal/FixtureFiles";
import { canonicalCheckedOutputProfiles } from "../../../internal/ttsc/internal/runtime-canonical-checked-output-profiles";
import { canonicalCommonJsOrphanProfiles } from "../../../internal/ttsc/internal/runtime-canonical-commonjs-orphan-profiles";
import { canonicalDecoratorMapProfile } from "../../../internal/ttsc/internal/runtime-canonical-orphan-decorator-map-profile";
import { runCanonicalRuntimeProfiles } from "../../../internal/ttsc/internal/runtime-canonical-profile-assembly";
import { runCanonicalReadonlyCorpus } from "../../../internal/ttsc/internal/runtime-canonical-readonly-corpus";
import { verifyRuntimeCleanOwnerAssembly } from "../../../internal/ttsc/internal/runtime-clean-owner-assembly";
import {
  prepareNativeDependencyPublicationCorpus,
  verifyNativeDependencyDeclaredOutputs,
} from "../../../internal/ttsc/internal/runtime-native-dependency-publication";
import {
  prepareCanonicalLinkedRuntimeIndex,
  verifyCanonicalLinkedRuntimeIndexClosed,
} from "../../../internal/ttsc/internal/runtime-native-root-links";
import {
  TTSX_REGISTER,
  linkTtscPackage,
} from "../../../internal/ttsc/internal/ttsx-register";
import { case_buildsourceplugin_defaults_to_workspace_local_cache } from "../source-plugin/case_buildsourceplugin_defaults_to_workspace_local_cache";

/**
 * Verifies CommonJS source identity and fallback under shared project profiles.
 *
 * One authored corpus retains included basename collisions, raw packages,
 * omitted sources and stale JavaScript. Explicit root/output and files-only
 * profiles are real configuration transitions after each host has exited. The
 * configured cache and its released lock container persist across later hosts;
 * the cleanup check permits those two names and rejects entry configs. Loader
 * extension detection shares the configured CommonJS host. Nested star exports
 * and inert export-shaped decoys share the existing NodeNext ESM and CTS hosts.
 * Rewritten-root children share the initial host; propagation, fork and
 * concurrent dependency children share the configured host. The configured host
 * consumes a real linked run index. Two public clean commands retire the
 * completed default cache only after all runtime readers have exited. The
 * initial no-rootDir profile also checks an excluded preload before main
 * execution; its invalid-byte transition retains one additional necessary
 * negative host. Three immutable dependency projects borrow the configured
 * consumer host while preserving their own options and excluded-source
 * preparation. A single canonical source publication returns its real binary
 * and container. Nine further profiles borrow this joined consumer root,
 * preserving eighteen requests and their original configuration transitions.
 * Only their owned holding namespace is excluded from active-profile oracles.
 * An actual root junction preserves the excluded-entry alias boundary where
 * supported. Unresolved launch metadata stops input changes and retains both
 * the consumer and the published artifact's container.
 *
 * 1. Run included collisions and raw packages together; preserve suppression in
 *    the configured-output host.
 * 2. Select configured and absent output profiles and assert native source
 *    identities and the native TypeScript extension handler/precedence.
 * 3. Select the files-only profile and run the omitted source through both public
 *    routes, then exercise NodeNext MTS/CJS interoperation and the CTS main
 *    entry, including the same nested star exports in both native formats.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public ttsx executes same-name included and excluded sources, a raw installed index beside a project index, suppression flags, source-bound dirname and stale-JS rejection; public register also executes the files-only omitted-source request; NodeNext MTS resolves a real MJS specifier and imports a CommonJS dependency with constant/function/namespace exports, while a CTS main executes under contrary package type; the configured CommonJS host verifies require.extensions handler identity, typed-only extensionless resolution and JavaScript priority, and both NodeNext hosts consume the same nested star graph and reject all seven type/comment/string/template ghost names. Initial and configured hosts retain rewritten, propagated, forked and concurrent descendant requests, both valid and invalid excluded preloads; composite dependency included/excluded values, unchanged authored output paths and two newly published physical roots; followed by actual linked-index cleanup and conservative versus explicitly selected clean effects.
 * @evidence contracts/testing.md#independent-expectations Distinct authored a,b,tools/package-own/entry-ran/other/fresh markers reject borrowing another source's emit. Native realpath of authored directories independently establishes dirname, unchanged STALE tool.js is a negative control, and authored mts-runner-ok/42:OK:7/cts-runner-ok literals require the actual NodeNext module connections. Authored typed-config/only-ts/from-js JSON and Node handler identity establish extension behavior independently; literal foo-ok:bar-ok:renamed-ok:leaf-ok values and seven nonexecuting declaration/assignment decoys establish the nested-star positive and negative oracles. Authored first,second and descendant dependency literals require the real child connections; legacy and malformed records independently distinguish kept default state from explicit cache deletion, and linked-run plus physical emptiness establish actual execution and cleanup. The authored preload tag and string-to-number error distinguish real pre-main checking; inside/extra and dep-value/dep2-value literals, original sorted output paths and fresh live manifest publications distinguish dependency execution and source isolation.
 * @evidence contracts/testing.md#distinguishing-cases Static versus computed imports, package versus consumer ownership, excluded required versus direct entry, absent versus explicit outDir and include versus files-only configs exercise different connections; NodeNext MTS and CTS suffixes retain their original module-resolution profile and contrary package type; errors are collected across completed profiles and joined descendants; malformed or duplicate descendant receipts cannot borrow a different group's output. Typed-only versus colliding JS/TS sources and real runtime exports versus inert star-export decoys retain adjacent negative cases; both native consumers validate those decoys rather than borrowing one format's result.
 * @evidence contracts/testing.md#execution-ownership The filename-matching E2E export is discovered by the test-e2e ttsc population. Fixture modules supply program inputs; thirty-three planned public runtime requests, seven joined descendant requests and two final public clean requests are explicit in the parent and its named helpers. They do not certify one compiler preparation: dependency compilation remains a separate native operation.
 * @evidence contracts/e2e.md#necessary-boundary Native emission ownership, inherited child loader admission, linked index cleanup and conservative versus explicitly selected clean effects must agree under these public launch routes; synthetic emit-index records cannot certify the runtime connection or source-only reads.
 * @evidence contracts/e2e.md#shared-execution One tracked authored corpus replaces independent roots. Included collisions and the raw package share one absent-rootDir host; forwarded suppression joins the configured rootDir/outDir dirname host to preserve its original emission profile. Explicit-root configured output, absent output, direct excluded entry and files-only register routes retain different native inputs or main-entry transports; A distinct driver cwd and relative cache option join the configured dirname and suppression host, and two nested runtime requests retain changed installation placement while their portable query/marking rules execute in source units; NodeNext changes compiler module/resolution and package type once and its MTS/CTS mains require separate entry transports; extension detection joins the configured rootDir/outDir CommonJS host, and the nested-star ESM/CJS consumers join the existing NodeNext MTS/CTS hosts without adding another host. The copied nested graph keeps its original lib package identity, no-type classification and authored source bytes. The extension main and the copied CTS consumer gain export {} to keep their declarations module-scoped beside the other consumer modules; their original executable statements remain intact. Rewritten source children share the initial host; propagation, fork and three concurrent dependency children share the configured rootDir host, retaining seven actual descendants with no extra runtime parent host. That host also consumes the fresh physical run index through its real directory link. After the first twelve hosts close normally and their descendant-producing parents succeed, exact original readonly populations borrow the same root for three public requests; real denial and restoration of the root and its empty owned installation boundary retain six Windows ACL operations. Missing prerequisites remain BLOCKED; root execution reports zero readonly coverage. Default and explicit public clean share the safely restored canonical root and add two real command children after cache reuse ends. The excluded preload positive joins the initial noRootDir host through actual -r; its invalid-source transition retains another host and restores exact original bytes before the configured profile. Composite included/excluded requests and two physical-root dependencies then share the configured host, but preserve three actual dependency project configurations and separate excluded-source preparation. Existing descendant publications are separated using the real live manifest filename baseline, not assumed global cache counts. Denied native aliases explicitly report zero physical-root coverage while the independent composite requests still execute. Required dependency preparations remain native work. This corpus does not claim the whole runtime family is fully consolidated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every synchronous child exits before the root config changes. Central packages and source identities stay immutable, the stale JavaScript remains present, CommonJS profiles overwrite only tsconfig.json; the final NodeNext phase also replaces package.json with an authored module package after all CommonJS hosts finish, and TestProject owns the single corpus through process cleanup. The configured children join before its synchronous launcher closes, and the linked index is observed only after that closure. Readonly transitions hold and restore original src, node_modules, package and config only after prior host closure. Every phase collects failures and verifies effective write restoration; an unresolved child or failed restoration retains the root and blocks clean. After all thirty-three runtime requests finish, an authored nonempty workspace package establishes owned default-clean authority; conservative then explicit clean operates only on the completed canonical cache. No warm-cache equivalence is asserted.
 * @evidence contracts/e2e.md#preserved-coverage Original ordered a,b,a,b,tools, rawpkg=package-own, entry-ran, configured dirname/template/native identities, absent-output asset/identity/no-adjacent emit, both fresh-source requests and both omitted-source launch routes, mts-runner-ok, 42:OK:7 and cts-runner-ok, the exact extension-detection JSON and both nested-star literal outputs with every ghost rejection, relative-cache identity and post-exit emptiness, no nearer boundary creation and the empty nearer boundary after its real first cache publication are retained. Four redundant native cache-path CLI queries are covered by actual cache-dispatch source units and the direct cache placement/marking source unit; the actual public cache transport stays in the compiler corpus. Original first,second rewritten bytes; worker:child-loaded-dependency; child:rescued-from-source; three worker:shared-built-once descendant outputs; actual child statuses; linked-run and the post-close empty physical index; all eight conservative-versus-explicit legacy/malformed clean assertions, valid preload status/tag and invalid preload status/root/assignability/no-tag, included/excluded composite values and unchanged output paths, plus both dependency values and two fresh physical-root publications remain. Receipt boundaries occur exactly once; only the original single separator blank is removed, and order is free only among the three identical concurrent receipts. Original readonly default status, marker and unchanged root entries, plus excluded failure, entry path, remedy and no execution followed by included success and marker remain; genuine write-refusal and restoration probes strengthen those boundaries. Standalone originals remain until this final corpus has passed and its actual preparation counts are reviewed.
 */
export async function test_commonjs_runtime_corpus_preserves_source_ownership_across_project_profiles() {
  const root = TestProject.createProject(
    FixtureFiles.read("ttsc/runtime-commonjs-corpus"),
  );
  linkTtscPackage(root);
  const failures: unknown[] = [];
  let publication:
    | ReturnType<
        typeof case_buildsourceplugin_defaults_to_workspace_local_cache
      >
    | undefined;
  try {
    publication = case_buildsourceplugin_defaults_to_workspace_local_cache();
  } catch (cause) {
    failures.push(new Error("canonical native source publication", { cause }));
  }
  const completedHosts: ReturnType<typeof TestProject.spawn>[] = [];
  let launchInputsSettled = true;
  const retainInputs = (reason: string): void => {
    for (const retained of [root, publication?.root])
      if (retained !== undefined)
        try {
          TestProject.retainTemporaryDirectory(retained, reason);
        } catch (cause) {
          failures.push(
            new Error("retain canonical consumer authority", { cause }),
          );
        }
  };
  const recordHost = (result: ReturnType<typeof TestProject.spawn>): void => {
    completedHosts.push(result);
    if (!isOrdinarilyClosedReadonlyLauncher(result)) {
      launchInputsSettled = false;
      const reason =
        `BLOCKED: unresolved canonical launcher status=${result.status}` +
        ` signal=${result.signal} pid=${result.pid} error=${result.error?.message}`;
      retainInputs(reason);
      throw new AggregateError([...failures, new Error(reason)], reason);
    }
  };
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
      if (!launchInputsSettled) throw cause;
    }
  };
  const launch = (
    entry: string,
    flags: string[] = [],
    cwd: string = root,
    env: NodeJS.ProcessEnv = {},
  ) => {
    let result: ReturnType<typeof TestProject.spawn>;
    try {
      result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...flags, entry],
        {
          cwd,
          env: { TTSC_CACHE_DIR: "", ...env },
        },
      );
    } catch (cause) {
      launchInputsSettled = false;
      retainInputs("canonical launcher threw before a completion receipt");
      throw cause;
    }
    recordHost(result);
    return result;
  };
  const select = (profile: string): void => {
    fs.copyFileSync(
      path.join(root, "profiles", profile + ".json"),
      path.join(root, "tsconfig.json"),
    );
  };
  const receipt = (
    output: string,
    name: string,
    expected: string[],
    trailingBlank: boolean,
    unordered = false,
  ): void => {
    const rows = output.trim().split(/\r?\n/);
    const begin = rows.indexOf("BEGIN:" + name);
    const end = rows.indexOf("END:" + name);
    assert.equal(rows.filter((row) => row === "BEGIN:" + name).length, 1);
    assert.equal(rows.filter((row) => row === "END:" + name).length, 1);
    assert.ok(begin >= 0 && end > begin, output);
    const body = rows.slice(begin + 1, end);
    if (trailingBlank) assert.equal(body.pop(), "", output);
    assert.deepEqual(unordered ? body.sort() : body, expected);
  };
  const combined = launch("src/main.ts", ["-r", "./preload.ts"]);
  check("combined status", () =>
    assert.equal(combined.status, 0, combined.stderr),
  );
  const lines = combined.stdout.trim().split(/\r?\n/);
  for (const [name, expected] of [
    ["same-named", "a,b,a,b,tools"],
    ["raw-package", "rawpkg=package-own"],
  ]) {
    check(name!, () => {
      const begin = lines.indexOf("BEGIN:" + name);
      const end = lines.indexOf("END:" + name);
      assert.ok(begin >= 0 && end > begin, combined.stdout);
      assert.equal(lines.slice(begin + 1, end).join("\n"), expected);
    });
  }
  check("native rewritten children", () =>
    receipt(combined.stdout, "native-rewritten-root", ["first,second"], true),
  );
  check("typed excluded preload", () =>
    assert.equal(lines.filter((line) => line === "tag=preloaded").length, 1),
  );
  check("mistyped excluded preload", () => {
    const preload = path.join(root, "preload.ts");
    const original = fs.readFileSync(preload);
    const config = fs.readFileSync(path.join(root, "tsconfig.json"));
    try {
      fs.copyFileSync(
        path.join(root, "mutations", "preload-invalid.ts"),
        preload,
      );
      const result = launch("src/main.ts", ["-r", "./preload.ts"]);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /root check failed for .*preload\.ts/);
      assert.match(
        result.stderr,
        /Type 'string' is not assignable to type 'number'/,
      );
      assert.doesNotMatch(result.stdout, /tag=/);
      assert.doesNotMatch(
        result.stdout,
        /BEGIN:same-named|BEGIN:native-rewritten-root/,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(root, "tsconfig.json")),
        config,
      );
    } finally {
      if (launchInputsSettled) fs.writeFileSync(preload, original);
    }
  });
  select("configured");
  let dependencyPopulation:
    | ReturnType<typeof prepareNativeDependencyPublicationCorpus>
    | undefined;
  check("native dependency preparation", () => {
    dependencyPopulation = prepareNativeDependencyPublicationCorpus(root);
  });
  let physicalRuns: string | undefined;
  check("linked runtime index setup", () => {
    physicalRuns = prepareCanonicalLinkedRuntimeIndex(root);
  });
  const driver = path.join(root, "driver");
  fs.mkdirSync(driver);
  const dirname = launch(
    "src/dirname.ts",
    [
      "--cache-dir",
      ".ttsx-cache",
      "--noEmit",
      "--emitDeclarationOnly",
      "--declaration",
    ],
    driver,
    {
      TTSX_TEST_PHYSICAL_ROOTS: dependencyPopulation?.physicalRootsAvailable
        ? "1"
        : "0",
    },
  );
  check("configured dirname status", () =>
    assert.equal(dirname.status, 0, dirname.stderr),
  );
  check("configured dirname identity", () => {
    const output = dirname.stdout.trim().split(/\r?\n/);
    assert.deepEqual(output.slice(0, 2), [
      "source-relative-dirname",
      "dirname-preserved",
    ]);
    assert.equal(
      output.length,
      dependencyPopulation?.physicalRootsAvailable ? 31 : 28,
    );
    assert.equal(output[4], "relative-runner-cache");
    assert.equal(output[5], "entry-ran");
    assert.equal(
      fs.realpathSync.native(output[2]!),
      fs.realpathSync.native(path.join(root, "src")),
    );
    assert.equal(
      fs.realpathSync.native(output[3]!),
      fs.realpathSync.native(root),
    );
    const projectCache = path.join(root, ".ttsx-cache", "project");
    assert.equal(fs.existsSync(projectCache), true);
    assert.deepEqual(fs.readdirSync(projectCache), []);
    assert.equal(
      fs.existsSync(path.join(driver, ".ttsx-cache", "project")),
      false,
    );
  });
  check("CommonJS extension detection", () => {
    const output = dirname.stdout.trim().split(/\r?\n/);
    assert.equal(output[6], "BEGIN:extension-detection");
    assert.equal(output[8], "END:extension-detection");
    assert.deepEqual(JSON.parse(output[7]!), {
      config: "typed-config",
      lone: "only-ts",
      loneResolved: true,
      nodeHandler: true,
      precedence: "from-js",
    });
  });
  check("linked runtime index after host closure", () => {
    assert.equal(dirname.stdout.trim().split(/\r?\n/)[9], "linked-run");
    assert.ok(physicalRuns !== undefined, "linked setup must have succeeded");
    verifyCanonicalLinkedRuntimeIndexClosed(physicalRuns);
  });
  check("native propagated child", () =>
    receipt(
      dirname.stdout,
      "native-loader-propagation",
      ["worker:child-loaded-dependency"],
      true,
    ),
  );
  check("native fork rescue", () =>
    receipt(
      dirname.stdout,
      "native-js-fork-rescue",
      ["child:rescued-from-source"],
      false,
    ),
  );
  check("native concurrent dependency", () =>
    receipt(
      dirname.stdout,
      "native-concurrent-dependency",
      Array(3).fill("worker:shared-built-once"),
      true,
      true,
    ),
  );
  check("native declared dependency values", () =>
    receipt(
      dirname.stdout,
      "native-declared-dependency-output",
      ["inside", "extra"],
      false,
    ),
  );
  check("native declared dependency path preservation", () => {
    assert.ok(
      dependencyPopulation !== undefined,
      "dependency setup must have succeeded",
    );
    verifyNativeDependencyDeclaredOutputs(
      root,
      dependencyPopulation.declaredOutputPaths,
    );
  });
  check("native physical dependency roots", () => {
    assert.ok(
      dependencyPopulation !== undefined,
      "dependency setup must have succeeded",
    );
    if (dependencyPopulation.physicalRootsAvailable)
      receipt(
        dirname.stdout,
        "native-physical-dependency-roots",
        ["VALUE:dep-value/dep2-value", "PHYSICAL-ROOTS:2"],
        false,
      );
    else {
      assert.equal(
        dirname.stdout
          .trim()
          .split(/\r?\n/)
          .filter(
            (line) =>
              line === "CAPABILITY-SKIPPED:native-physical-dependency-roots",
          ).length,
        1,
      );
      console.log("CAPABILITY-SKIPPED:native-physical-dependency-roots");
    }
  });
  select("no-outdir");
  const absentOutput = launch("src/no-outdir.ts");
  check("absent outDir status", () =>
    assert.equal(absentOutput.status, 0, absentOutput.stderr),
  );
  check("absent outDir source identity", () => {
    const output = absentOutput.stdout.trim().split(/\r?\n/);
    assert.equal(output[0], "no-outdir-preserved");
    assert.equal(output.length, 2);
    assert.equal(
      fs.realpathSync.native(output[1]!),
      fs.realpathSync.native(path.join(root, "src")),
    );
    assert.equal(fs.existsSync(path.join(root, "src", "no-outdir.js")), false);
  });
  select("stale");
  for (const entry of ["tool.ts", "src/stale-required.ts"]) {
    const result = launch(entry);
    check(entry, () => {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "fresh tool.ts");
      assert.equal(
        fs.readFileSync(path.join(root, "tool.js"), "utf8"),
        'console.log("STALE tool.js");\n',
      );
    });
  }
  select("files-only");
  const direct = launch("entry/index.ts");
  let registered: ReturnType<typeof TestProject.spawn>;
  try {
    registered = TestProject.spawn(
      process.execPath,
      ["--require", TTSX_REGISTER, "entry/index.ts"],
      { cwd: root, env: { TTSC_CACHE_DIR: "" } },
    );
  } catch (cause) {
    launchInputsSettled = false;
    retainInputs("canonical register threw before a completion receipt");
    throw cause;
  }
  recordHost(registered);
  for (const [name, result] of [
    ["files-only ttsx", direct],
    ["files-only register", registered],
  ] as const) {
    check(name, () => {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "other=other");
    });
  }
  check("temporary config cleanup", () => {
    assert.deepEqual(
      fs
        .readdirSync(root)
        .filter((name) => name.startsWith(".ttsx-"))
        .sort(),
      [".ttsx-cache", ".ttsx-cache.lock"],
    );
    // The configured host owns a persistent lock container. Its active
    // generation must be gone; neither that container nor the cache is a
    // synthesized entry config left by the files-only hosts.
    assert.equal(
      fs.statSync(path.join(root, ".ttsx-cache.lock")).isDirectory(),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, ".ttsx-cache.lock", "current")),
      false,
    );
  });
  const nested = path.join(root, "nested");
  const physicalNested = TestProject.physicalPath(nested);
  const outerCache = path.join(
    TestProject.physicalPath(root),
    "node_modules",
    ".cache",
    "ttsc",
  );
  const nestedCache = path.join(
    TestProject.physicalPath(nested),
    "node_modules",
    ".cache",
    "ttsc",
  );
  for (const [name, expected] of [
    ["outer installation", outerCache],
    ["empty nearer installation", nestedCache],
  ] as const) {
    if (name === "empty nearer installation") {
      check(name + " setup", () => {
        fs.mkdirSync(path.join(nested, "node_modules"), { recursive: true });
        assert.deepEqual(fs.readdirSync(path.join(nested, "node_modules")), []);
      });
    }
    check(name + " before", () =>
      assert.equal(
        resolveSourceBuildCachePaths(physicalNested, undefined, {}).root,
        expected,
      ),
    );
    const nestedRun = launch("nested/main.ts", [
      "--project",
      "nested/tsconfig.json",
    ]);
    check(name + " runtime", () => {
      assert.equal(nestedRun.status, 0, nestedRun.stderr);
      assert.deepEqual(nestedRun.stdout.trim().split(/\r?\n/), [
        "nested-cache-root",
        "empty-install-boundary",
      ]);
    });
    check(name + " after", () => {
      assert.equal(
        resolveSourceBuildCachePaths(physicalNested, undefined, {}).root,
        expected,
      );
      assert.deepEqual(
        fs.readdirSync(path.join(expected, "ttsx", "project")),
        [],
      );
      if (name === "outer installation")
        assert.equal(fs.existsSync(path.join(nested, "node_modules")), false);
    });
  }
  select("node-next");
  fs.copyFileSync(
    path.join(root, "profiles", "module-package.json"),
    path.join(root, "package.json"),
  );
  const nodeNext = launch("node-next/node-next.mts");
  check("NodeNext status", () =>
    assert.equal(nodeNext.status, 0, nodeNext.stderr),
  );
  const nodeNextLines = nodeNext.stdout.trim().split(/\r?\n/);
  for (const [name, expected] of [
    ["mts-entry", "mts-runner-ok"],
    ["commonjs-lowering", "42:OK:7"],
    ["nested-star", "foo-ok:bar-ok:renamed-ok:leaf-ok"],
  ]) {
    check(name!, () => {
      const begin = nodeNextLines.indexOf("BEGIN:" + name);
      const end = nodeNextLines.indexOf("END:" + name);
      assert.ok(begin >= 0 && end > begin, nodeNext.stdout);
      assert.equal(nodeNextLines.slice(begin + 1, end).join("\n"), expected);
    });
  }
  const cts = launch("node-next/main.cts");
  check("NodeNext CTS entry", () => {
    assert.equal(cts.status, 0, cts.stderr);
    assert.deepEqual(cts.stdout.trim().split(/\r?\n/), [
      "cts-runner-ok",
      "BEGIN:nested-star",
      "foo-ok:bar-ok:renamed-ok:leaf-ok",
      "END:nested-star",
    ]);
  });
  const allHostsClosed =
    completedHosts.every((host) => isOrdinarilyClosedReadonlyLauncher(host)) &&
    combined.status === 0 &&
    dirname.status === 0;
  if (!allHostsClosed) {
    const reason =
      "BLOCKED: canonical host termination did not prove descendant closure";
    failures.push(new Error(reason));
    retainInputs(reason);
  }
  let safeForCleanup = allHostsClosed;
  if (allHostsClosed) {
    try {
      const readonly = await runCanonicalReadonlyCorpus(
        root,
        {
          defaultCache: FixtureFiles.read(
            "ttsc/runtime-commonjs-corpus/profiles/readonly-default",
          ),
          excludedEntry: FixtureFiles.read(
            "ttsc/runtime-commonjs-corpus/profiles/readonly-excluded",
          ),
        },
        [],
      );
      if (readonly === false) {
        console.log(
          "CAPABILITY-SKIPPED:canonical-readonly-root; no coverage claimed",
        );
      } else {
        safeForCleanup = readonly.safeForCleanup;
        failures.push(...readonly.failures);
        for (const phase of readonly.phases)
          console.log(
            `READONLY:${phase.name}:${phase.state}:hosts=${phase.hosts.length}`,
          );
      }
    } catch (cause) {
      safeForCleanup = false;
      failures.push(
        new Error("canonical readonly input transition", { cause }),
      );
    }
    if (!safeForCleanup) {
      const reason =
        "BLOCKED: canonical readonly restoration did not prove cleanup authority";
      failures.push(new Error(reason));
      retainInputs(reason);
    }
  }
  if (safeForCleanup) {
    const alias = root + "-runtime-profile-link";
    let rootAlias: string | undefined;
    let ownsAlias = false;
    try {
      try {
        fs.lstatSync(alias);
        throw new Error("canonical root alias already exists: " + alias);
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
      }
      try {
        fs.symlinkSync(root, alias, "junction");
        ownsAlias = true;
        rootAlias = alias;
      } catch (cause) {
        const code = (cause as NodeJS.ErrnoException).code;
        if (!["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(code ?? ""))
          throw cause;
        console.log(
          "CAPABILITY-SKIPPED:canonical-root-alias; no alias coverage claimed",
        );
      }
      const readProfile = (name: string) =>
        FixtureFiles.read("ttsc/runtime-commonjs-corpus/profiles/" + name);
      const runtime = runCanonicalRuntimeProfiles(root, [
        ...canonicalCommonJsOrphanProfiles(
          {
            placement: readProfile("orphan-placement"),
            identity: readProfile("orphan-compiler-identity"),
            race: readProfile("orphan-source-race"),
          },
          publication?.binary,
        ),
        canonicalDecoratorMapProfile(readProfile("orphan-decorator-maps")),
        ...canonicalCheckedOutputProfiles(
          {
            installed: readProfile("output-installed-package"),
            excluded: readProfile("output-excluded-link"),
            declared: readProfile("output-declared-bytes"),
            stale: readProfile("output-stale-neighbor"),
            missing: readProfile("output-missing-owned"),
          },
          rootAlias,
        ),
      ]);
      failures.push(...runtime.failures);
      safeForCleanup = runtime.safeForCleanup;
      for (const phase of runtime.phases)
        console.log("RUNTIME-PROFILE:" + phase);
    } catch (cause) {
      safeForCleanup = false;
      failures.push(
        new Error("canonical runtime profile transitions", { cause }),
      );
    } finally {
      if (ownsAlias && safeForCleanup) {
        try {
          assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
          assert.equal(
            fs.realpathSync.native(alias),
            fs.realpathSync.native(root),
          );
          fs.unlinkSync(alias);
        } catch (cause) {
          safeForCleanup = false;
          failures.push(new Error("release canonical root alias", { cause }));
        }
      }
    }
  }
  if (!safeForCleanup) {
    const reason =
      "unresolved canonical runtime or source publication consumer";
    retainInputs(reason);
  }
  if (safeForCleanup)
    check("completed canonical clean ownership", () => {
      fs.copyFileSync(
        path.join(root, "profiles", "workspace-package.json"),
        path.join(root, "package.json"),
      );
      const expectedCache = path.join(
        TestProject.physicalPath(root),
        "node_modules",
        ".cache",
        "ttsc",
      );
      assert.equal(
        resolveSourceBuildCachePaths(
          TestProject.physicalPath(root),
          undefined,
          {},
        ).root,
        expectedCache,
      );
      verifyRuntimeCleanOwnerAssembly(root, retainInputs);
    });
  if (failures.length)
    throw new AggregateError(failures, "CommonJS runtime corpus failed");
}
