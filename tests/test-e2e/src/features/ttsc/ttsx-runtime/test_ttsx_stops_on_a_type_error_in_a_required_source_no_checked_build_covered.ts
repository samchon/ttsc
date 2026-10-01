import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TTSX_REGISTER, linkTtscPackage } from "../../../internal/ttsc/internal/ttsx-register";

/**
 * Verifies ttsx type-checks a required source that no checked build covered,
 * and stops before that source runs when the check fails.
 *
 * The entry build is ttsx's type gate, but it only covers the program the
 * compiler saw. A `require` of a file outside `include` reaches code that
 * program never contained, so without a check of its own the file would run
 * unchecked — or, before samchon/ttsc#1382, as another file's emit. Such a file
 * is a root, and every root is checked through its owning project, the same
 * gate `ttsc/register` applies at a JavaScript-to-TypeScript boundary. Its
 * negative twin is the installed-package case, which stays emit-only.
 *
 * 1. Create a project with `include: ["src"]` whose entry requires
 *    `tools/effect.ts`, a file with a type error and a filesystem side effect.
 * 2. Run the entry through ttsx and through the `ttsc/register` preload.
 * 3. Assert both runs fail naming the file and the diagnostic, that the side
 *    effect never happened, and that no synthesized tsconfig was left behind.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx and public register reach an excluded required effect.ts and must reject its string-to-number assignment before writing its filesystem marker.
 * @evidence contracts/testing.md#independent-expectations TypeScript assignability forbids the authored string initializer for number; the authored side-effect marker independently detects execution. Root-prefix inspection observes only names, not all retained caches.
 * @evidence contracts/testing.md#distinguishing-cases CLI and public register are separate startup routes for an excluded checked root. Installed dependency emit-only success belongs to complementary cases; each route executes before labeled failures are aggregated.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns two real Node/compiler startup routes and their explicit assertions; neither fixture program dynamically registers test hosts.
 * @evidence contracts/e2e.md#necessary-boundary A source required after upfront checking must receive its own diagnostic gate before effects. Pure project membership calculations cannot prove on-demand compiler errors stop Node execution.
 * @evidence contracts/e2e.md#shared-execution One fixture graph and linked public register package serve both hosts, with one required source per route; two process lifetimes remain because startup transport differs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Source/config identities stay immutable, the marker is reset to absent before each route and each synchronous child finishes before observations; that bounded reset prevents an earlier incorrect side effect contaminating the later route. TestProject owns package links and fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both original nonzero statuses, effect.ts root diagnostic, assignability text and marker absence plus final root-prefix cleanup assertion remain; no broad cache-cleanliness claim is added.
 */
export function test_ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered/inputs-1"));
    linkTtscPackage(root);
    const marker = path.join(root, "effect-ran.txt");

    const failures: unknown[] = [];
    for (const [lane, command, args] of [
      ["ttsx", TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"]],
      [
        "register",
        process.execPath,
        ["--require", TTSX_REGISTER, "src/main.ts"],
      ],
    ] as const) {
      fs.rmSync(marker, { force: true });
      const result = TestProject.spawn(command, [...args], {
        cwd: root,
        env: { TTSX_ROOT_MARKER: marker },
      });
      try {
      assert.notEqual(result.status, 0, `${lane}: ${result.stdout}`);
      assert.match(result.stderr, /root check failed for .*effect\.ts/);
      assert.match(
        result.stderr,
        /Type 'string' is not assignable to type 'number'/,
      );
      assert.equal(fs.existsSync(marker), false, `${lane} ran the root`);
      } catch (error) { failures.push(new Error(lane, { cause: error })); }
    }

    try { assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith(".ttsx-")),
      [],
    ); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, "required root diagnostic gates failed");
  }
