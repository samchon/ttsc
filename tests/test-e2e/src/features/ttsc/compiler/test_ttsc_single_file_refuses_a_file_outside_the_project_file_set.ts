import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies positional `ttsc <file>` refuses a file its project does not
 * compile, instead of writing another file's JavaScript under its name.
 *
 * Pins samchon/ttsc#1382 row 7. The single-file lane builds the whole project
 * into a private directory and then looks up the requested file's output. For
 * `scripts/index.ts` outside `include: ["src"]` there is none, and the lookup
 * used to score `src/index.js` by its shared `index` name: `ttsc
 * scripts/index.ts` wrote `lib/scripts/index.js` containing `src/index.ts`'s
 * code and exited 0. The lookup now also mirrors against the pinned `rootDir`,
 * where it previously used the project root, so a project that declares
 * `rootDir` never needed the name match in the first place.
 *
 * 1. Create a project with `include: ["src"]`, `outDir: "lib"`, and both
 *    `src/index.ts` and `scripts/index.ts`.
 * 2. Run `ttsc scripts/index.ts`, then `ttsc src/index.ts`.
 * 3. Assert the first fails naming the file and the tsconfig and writes nothing,
 *    and the second emits `src/index.ts`'s own code.
 *
 * @evidence contracts/testing.md#behavioral-verification Outside scripts/index.ts fails naming module/config and creates no lib; included src/index.ts then emits its own marker without scripts marker.
 * @evidence contracts/testing.md#independent-expectations Authored include excludes scripts; distinct same-stem source literals independently expose erroneous fallback copy.
 * @evidence contracts/testing.md#distinguishing-cases Outside requested file and valid same-name included file in one project.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_file_refuses_a_file_outside_the_project_file_set is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Native project file set and launcher temporary-output lookup must reject absent output before any user-tree copy.
 * @evidence contracts/e2e.md#shared-execution One project/native installation serves refused and included positional runs. Separate requests are necessary to prove both rejection and adjacent successful materialization after refusal.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private root starts with no lib output, so refused run cannot pass by observing earlier emit; included run follows only after refusal assertions. Child completion is synchronous and tracked root ends at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Outside scripts/index.ts fails naming module/config and creates no lib; included src/index.ts then emits its own marker without scripts marker. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_single_file_refuses_a_file_outside_the_project_file_set =
  (): void => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_single_file_refuses_a_file_outside_the_project_file_set/inputs-1"));

    const refused = spawn(ttscBin, ["--cwd", root, "scripts/index.ts"], {
      cwd: root,
    });
    assert.notEqual(refused.status, 0, refused.stdout);
    assert.match(
      refused.stderr,
      /scripts[\\/]index\.ts is not part of the program of .*tsconfig\.json/,
    );
    assert.equal(fs.existsSync(path.join(root, "lib")), false);

    const emitted = spawn(ttscBin, ["--cwd", root, "src/index.ts"], {
      cwd: root,
    });
    assert.equal(emitted.status, 0, `${emitted.stdout}${emitted.stderr}`);
    const output = fs.readFileSync(
      path.join(root, "lib", "src", "index.js"),
      "utf8",
    );
    assert.match(output, /ran src\/index\.ts/);
    assert.doesNotMatch(output, /ran scripts/);
  };
