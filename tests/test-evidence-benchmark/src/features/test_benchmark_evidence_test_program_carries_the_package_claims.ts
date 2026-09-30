import path from "node:path";

import type { IBenchmarkWorkspace } from "../internal/IBenchmarkWorkspace";
import type { IRunResult } from "../internal/IRunResult";
import {
  readActivationGates,
  removeActivationGate,
} from "../internal/activationGates";
import { acquireBenchmarkWorkspace } from "../internal/benchmarkWorkspace";
import { discoverClaimConfigurations } from "../internal/claimConfigurations";
import {
  type IMissingAcknowledgement,
  readMissingAcknowledgements,
} from "../internal/evidenceDiagnostics";
import { provisionEnvironment } from "../internal/provisionEnvironment";
import { runScript } from "../internal/runScript";
import { sdkAccessorAddresses } from "../internal/sdkAccessorAddresses";
import { stripCitations } from "../internal/stripCitations";
import { materializeClaimLayer } from "../internal/workspaceLayer";

/**
 * Verifies every backend claim owes its units in the Program that compiles it,
 * and that its operation claim enumerates the SDK through the workspace link.
 *
 * A claim populates only from the Program that owns its hosts, so a claim is
 * proved by the gate that builds that Program and by no other. Which
 * configuration declares which claim is a template decision that has already
 * moved once, so the case discovers the configurations and asks each one's own
 * gate; naming them would keep it passing after the next move while covering
 * less than it did before.
 *
 * The operation reference is the sharper edge. It selects the generated
 * accessor surface out of an installed `package`, and a workspace dependency is
 * a link — pnpm writes a junction on Windows. Enumerating that link with a
 * walker that treats it as a plain entry returns nothing, and a reference that
 * selects nothing reports full coverage of work no one did. The scaffold test
 * already cites the one published operation, so this case takes that citation
 * away: the accessor then has to be demanded by name, which an empty population
 * can never do.
 *
 * 1. Build the workspace, then open every backend claim at once.
 * 2. Remove the scaffold's citations so nothing is acknowledged.
 * 3. Run both Programs' gates and read the obligations each reported.
 * 4. Assert each claim reports in its owning Program and that the test Program's
 *    operation obligations are exactly the accessors the generator published.
 *
 * @evidence contracts/testing.md#behavioral-verification Every discovered backend claim reports obligations in its owning gate, and build:test operation demands exactly equal the nonempty generated accessor set.
 * @evidence contracts/testing.md#independent-expectations Generator-authored accessor tags supply expected targets independently of Evidence diagnostics; Markdown/Prisma prefixes separate operation targets.
 * @evidence contracts/testing.md#distinguishing-cases Nonempty configuration discovery and a required build:test result prevent fallback/vacuity; stripped citations expose demands and exact equality rejects extra/missing accessors.
 * @evidence contracts/testing.md#execution-ownership The matching features export runs via DynamicExecutor, real Prisma/SDK prerequisites and each distinct discovered pnpm gate.
 * @evidence contracts/e2e.md#necessary-boundary Installed SDK link traversal must reach the Program hosting backend tests, connecting generator publication with native diagnostic output.
 * @evidence contracts/e2e.md#shared-execution One Evidence preparation serves initial Prisma/SDK builds and a second Prisma build after materialization; requests deduplicate by script across owning configurations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only temporary layers/markers/citations change after baseline restore. .env is provisioned, ignored generated/install trees remain, synchronous outputs are captured and benchmarkWorkspace owns cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original prerequisite/discovery/per-claim/exact-set checks remain. The body does not independently forbid backend-tests obligations in another Program.
 */
export const test_benchmark_evidence_test_program_carries_the_package_claims =
  async (): Promise<void> => {
    const workspace: IBenchmarkWorkspace =
      await acquireBenchmarkWorkspace("evidence");
    provisionEnvironment(workspace.workspace);
    const backend: string = path.join(
      workspace.workspace,
      "packages",
      "backend",
    );
    for (const script of ["build:prisma", "build:sdk"])
      requireZero(backend, script);

    // Discovered, never named. Which Program declares which claim is a
    // template decision that moves, and a case that spelled the files would
    // keep passing after such a move while covering fewer claims than before.
    const configurations = discoverClaimConfigurations(
      workspace.workspace,
    ).filter((configuration) => configuration.packageDirectory === backend);
    if (configurations.length === 0)
      throw new Error(
        `No lint configuration under ${backend} declares a claim. Either the arm no longer stages a backend graph, or this suite is no longer finding it.`,
      );

    for (const configuration of configurations)
      for (const gate of readActivationGates(configuration.file)) {
        materializeClaimLayer({
          workspace: workspace.workspace,
          claim: gate.claim,
        });
        removeActivationGate(configuration.file, gate.claim);
      }
    stripCitations(path.join(backend, "test", "features"));
    requireZero(backend, "build:prisma");

    // Each configuration is proved by the gate that compiles the Program it
    // governs. A claim populates only from the Program its hosts live in, so
    // running any other gate would prove nothing about it.
    const results = new Map<string, IRunResult>();
    for (const configuration of configurations)
      if (!results.has(configuration.script))
        results.set(
          configuration.script,
          runScript({ cwd: backend, script: configuration.script }),
        );

    // No fallback. The operation surface belongs to the Program that compiles
    // the e2e suite, and asserting it against whichever gate happened to run
    // would pass while proving nothing about the claim that owns it.
    const testProgram: IRunResult | undefined = results.get("build:test");
    if (testProgram === undefined)
      throw new Error(
        `No discovered backend configuration is proved by 'build:test', so the operation surface has no Program to be enumerated in. Either the e2e claim moved, or this suite is no longer finding it.`,
      );
    const testClaims: string[] = configurations.flatMap(
      (configuration) => configuration.claims,
    );

    for (const configuration of configurations) {
      const result: IRunResult = results.get(configuration.script)!;
      for (const claim of configuration.claims)
        if (obligationsFor(result, claim).length === 0)
          throw new Error(
            `Claim '${claim}' reported no obligation in the Program '${configuration.script}' compiles, which is the Program its hosts live in.

Command: pnpm run ${result.script}

Actual output:
${result.output}`,
          );
    }

    assertOperationSurfaceEnumerated(workspace, testProgram, testClaims);
  };

/**
 * Asserts the operation obligations are exactly the accessors the SDK
 * published.
 *
 * Equality rather than presence: a reference that selected the whole package
 * instead of its accessor globs would demand more than the generator published,
 * and one that resolved the link partially would demand less. Both are ways for
 * the obligation to stop describing the published contract, and only the exact
 * set catches both.
 */
const assertOperationSurfaceEnumerated = (
  workspace: IBenchmarkWorkspace,
  testProgram: IRunResult,
  testClaims: readonly string[],
): void => {
  const published: string[] = sdkAccessorAddresses(
    path.join(workspace.workspace, "packages", "api", "src", "functional"),
  );
  const demanded: string[] = [];
  for (const claim of testClaims)
    for (const obligation of obligationsFor(testProgram, claim))
      // A Markdown target always carries its document path and a Prisma target
      // always carries its `prisma:` prefix, so what remains is what the
      // TypeScript package reference selected.
      if (
        !obligation.target.includes(".md") &&
        !obligation.target.startsWith("prisma:")
      )
        demanded.push(obligation.target);
  const unique: string[] = [...new Set(demanded)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (unique.join("\n") === published.join("\n")) return;
  throw new Error(
    `The operation reference must enumerate the generated accessor surface through the workspace link, but the obligations do not match what the generator published.\n\nPublished by the SDK:\n  ${published.join("\n  ") || "(none)"}\n\nDemanded by the graph:\n  ${unique.join("\n  ") || "(none)"}\n\nAn empty or partial demand here is the state that reports full coverage while checking nothing.\n\nActual output:\n${testProgram.output}`,
  );
};

const obligationsFor = (
  result: IRunResult,
  claim: string,
): IMissingAcknowledgement[] =>
  readMissingAcknowledgements(result).filter(
    (obligation) => obligation.claim === claim,
  );

const requireZero = (cwd: string, script: string): void => {
  const result = runScript({ cwd, script });
  if (result.status === 0) return;
  throw new Error(
    `\`pnpm ${script}\` must pass before either Program can be compared; the obligations of both are unobservable until it does.\n\nDirectory: ${cwd}\nExit status: ${String(result.status)}\n\nActual output:\n${result.output}`,
  );
};
