import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a project-free terminal flag keeps today's behaviour when a project
 * does resolve.
 *
 * The project-free branch applies only when project resolution fails. Inside a
 * real project `ttsc --init` must still travel the established lane so tsgo
 * answers "a tsconfig.json is already defined" rather than ttsc writing a
 * second config over the existing one. The boundary twin of
 * `test_ttsc_init_writes_a_tsconfig_outside_a_project`.
 *
 * 1. Create a project with a recognisable tsconfig.
 * 2. Run `ttsc --init` inside it.
 * 3. Assert a zero exit and that the existing tsconfig is byte-identical.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs --init against an existing project and requires success with byte-identical tsconfig afterwards.
 * @evidence contracts/testing.md#independent-expectations The independently authored before bytes establish preservation; init on an existing project must not overwrite user configuration.
 * @evidence contracts/testing.md#distinguishing-cases This existing-config branch complements absent-config initialization; successful exit alone would not detect destructive rewrite.
 * @evidence contracts/testing.md#execution-ownership The matching TestExecutor feature executes the actual CLI init path.
 * @evidence contracts/e2e.md#necessary-boundary The installed launcher/compiler forwarding lane must preserve a real config file; parser units cannot prove publication behavior.
 * @evidence contracts/e2e.md#shared-execution One init command supplies status and byte-preservation checks using shared built executables and no plugin preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered project isolates initial config bytes and source. The synchronous child finishes before readback and TestProject removes the fixture at exit.
 * @evidence contracts/e2e.md#preserved-coverage Original success and exact byte equality remain; other project files and compiler-specific init messages are not checked.
 */
export const test_ttsc_init_inside_a_project_keeps_the_existing_forwarding_lane =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export const value: string = "init";\n`,
    });
    const before = fs.readFileSync(path.join(root, "tsconfig.json"), "utf8");

    const result = spawn(ttscBin, ["--cwd", root, "--init"], { cwd: root });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
      before,
      `ttsc --init must not rewrite an existing project config:\n${result.stdout}${result.stderr}`,
    );
  };
