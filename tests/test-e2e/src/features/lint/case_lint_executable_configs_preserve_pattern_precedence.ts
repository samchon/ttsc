import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../utils/src/TestProject";
import { EvidenceProcessOwnership } from "../../../../utils/src/evidence/EvidenceProcessOwnership";

/**
 * Verifies CJS and TypeScript loader options retain pattern precedence in fixes.
 *
 * The already prepared native lint binary and installed consumer are supplied
 * by the common experiment. Each extension uses its real loader, then the
 * native string-content rule must replace foo with the authored first match.
 *
 * 1. Copy the same authored source and ordered options into the owned slot.
 * 2. Run the selected native binary's supported fix command for each extension.
 * 3. Require complete first/untouched output and restore all overwritten bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native fix loads CJS or TS config through the installed loader and applies unicorn/string-content to the real file; exact first/untouched text distinguishes an option map reorder producing second.
 * @evidence contracts/testing.md#independent-expectations Literal foo$ before foo and expected first come from the original authored precedence regression, with untouched adjacent text preserved. No trace/raw JSON or native fix output generates the expectation.
 * @evidence contracts/testing.md#distinguishing-cases CJS and TS extension-specific loader paths are independently named profiles over identical rule inputs. Wrong precedence, no edit, unrelated edits, nonzero status, signal and spawn failure cannot count as success.
 * @evidence contracts/testing.md#execution-ownership Callable profile is not yet registered or executed. Caller owns the actual prepared binary, linked consumer, manifest and activation; Go direct JSON/cache units do not certify these two executable-loader connections.
 * @evidence contracts/e2e.md#necessary-boundary Config evaluation, result-file transport and native option consumption can disagree despite a direct JSON policy unit passing; this actual fixed file observes their joined consequence.
 * @evidence contracts/e2e.md#shared-execution Both profiles reuse the same supplied binary/consumer/installation. Their actual fix processes, loader children and Programs remain separately observed; two extension inputs are not claimed to reuse one Program or to reduce total starts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original bytes/absence of only four controlled files are saved before mutation and restored after synchronous direct-child return while ownership remains available. Null/signal/spawn failure retains uncertain descendant inputs and blocks further mutation; direct-child closure is not itself arbitrary descendant proof.
 * @evidence contracts/e2e.md#preserved-coverage Preserves the authored ordered two-pattern source and full first/untouched result across actual CJS/TS evaluation. Reverse/duplicate/numeric-key and cold/memory/disk policy remain direct Go owners; original loader donors remain pending actual survivor selection/execution.
 */
export function case_lint_executable_configs_preserve_pattern_precedence(
  directory: string,
  binary: string,
): void {
  assert.ok(path.isAbsolute(directory) && path.isAbsolute(binary));
  EvidenceProcessOwnership.assertAvailable(directory);
  const fixture = path.join(TestProject.WORKSPACE_ROOT, "tests/test-e2e/fixtures/lint/ordered-loader-options");
  const controlled = ["tsconfig.json", "loader-main.ts", "lint.config.cjs", "lint.config.ts"];
  const previous = controlled.map(name => {
    const file = path.join(directory, name);
    try {
      const stat = fs.lstatSync(file);
      assert.ok(stat.isFile(), "controlled input must be an owned regular file");
      return { bytes: fs.readFileSync(file), mode: stat.mode & 0o777 };
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  });
  const failures: unknown[] = [];
  try {
    for (const name of ["lint.config.cjs", "lint.config.ts"]) {
      EvidenceProcessOwnership.assertAvailable(directory);
      try {
        fs.copyFileSync(path.join(fixture, "tsconfig.json"), path.join(directory, "tsconfig.json"));
        fs.copyFileSync(path.join(fixture, "main.ts"), path.join(directory, "loader-main.ts"));
        fs.copyFileSync(path.join(fixture, name), path.join(directory, name));
        const result = E2eProcessTrace.spawnSync(binary, [
          "fix", "--cwd", directory, "--tsconfig", "tsconfig.json", "--plugins-json",
          JSON.stringify([{ name: "@ttsc/lint", config: { configFile: name } }]),
        ], { cwd: directory, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
        if (result.error || result.status === null || result.signal !== null)
          EvidenceProcessOwnership.retain(directory, new Error("Native fix did not establish owned descendant completion", {
            cause: result.error ?? result.signal,
          }));
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.equal(result.status, 0, String(result.stderr));
        assert.equal(fs.readFileSync(path.join(directory, "loader-main.ts"), "utf8"),
          'const value = "first";\nconst untouched = "untouched";\n');
      } catch (error) {
        failures.push(new Error(`ordered loader ${name}`, { cause: error }));
      }
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      EvidenceProcessOwnership.assertAvailable(directory);
      const cleanupErrors: unknown[] = [];
      for (const [index, name] of controlled.entries()) {
        const file = path.join(directory, name);
        const saved = previous[index];
        try {
          if (saved === undefined) {
            fs.rmSync(file, { force: true });
            assert.equal(fs.lstatSync(file, { throwIfNoEntry: false }), undefined);
          } else {
            fs.writeFileSync(file, saved.bytes);
            fs.chmodSync(file, saved.mode);
            assert.deepEqual(fs.readFileSync(file), saved.bytes);
            assert.equal(fs.statSync(file).mode & 0o777, saved.mode);
          }
        } catch (error) { cleanupErrors.push(error); }
      }
      if (cleanupErrors.length) {
        const error = new AggregateError(cleanupErrors, "Controlled input restoration");
        EvidenceProcessOwnership.retain(directory, error);
        throw error;
      }
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Executable config pattern precedence");
}
