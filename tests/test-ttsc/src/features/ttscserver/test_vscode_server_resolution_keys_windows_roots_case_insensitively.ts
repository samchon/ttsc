import * as mod from "../../../../../packages/vscode/src/serverResolution";
import assert from "node:assert/strict";

/**
 * Verifies VS Code client roots follow each Windows directory's identity.
 *
 * VS Code and Node can report the same Windows workspace root with different
 * drive-letter casing. The extension keys running clients by canonical root so
 * it does not stop and restart the same project unnecessarily.
 *
 * 1. Call the authored server resolution helper in the unit process.
 * 2. Prove ordinary aliases converge under supplied Windows directory authority.
 * 3. Inject a deterministic filesystem with two case-distinct roots.
 * 4. Prove planning, containment, and deepest-root selection keep both clients.
 * 5. Prove missing descendants inherit the nearest existing root semantics.
 *
 * @evidence contracts/testing.md#behavioral-verification root identity, root planning and deepest-root selection honor ordinary Windows aliases and sensitive directory distinctions.
 * @evidence contracts/testing.md#independent-expectations independently injected realpath and per-directory case semantics define identity, not lowercased strings.
 * @evidence contracts/testing.md#distinguishing-cases drive aliases and ordinary folding contrast with two sensitive sibling roots and missing descendants.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls authored serverResolution and the real identity resolver with an explicitly supplied realpath directory map and ordinary/sensitive case authority; host filesystem discovery is not impersonated and no language client or product process starts.
 */
export function test_vscode_server_resolution_keys_windows_roots_case_insensitively() {
  const observed = (() => {
    const upper = "C:\\Repo";
    const lower = "c:\\repo";
    const missing = () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    };
    const identities = mod.createServerRootPathIdentityContext("win32", {
      caseSensitive: (directory) =>
        directory.toLowerCase().startsWith("c:\\sensitive"),
      realpath: (location) => {
        const resolved = location.replaceAll("/", "\\");
        const folded = resolved.toLowerCase();
        if (folded === "c:\\repo") return "C:\\Repo";
        if (folded === "c:\\ordinary") return "C:\\Ordinary";
        if (folded === "c:\\ordinary\\repo") return "C:\\Ordinary\\Repo";
        if (resolved === "C:\\Sensitive") return resolved;
        if (resolved === "C:\\Sensitive\\Project") return resolved;
        if (resolved === "C:\\Sensitive\\project") return resolved;
        if (resolved === "C:\\Sensitive\\Project\\src") return resolved;
        if (resolved === "C:\\Sensitive\\project\\src") return resolved;
        return missing();
      },
    });
    const caseRoots = [
      "C:\\Sensitive\\Project",
      "C:\\Sensitive\\project",
    ] as const;
    return {
      sameKey: mod.rootKey(upper, "win32", identities) === mod.rootKey(lower, "win32", identities),
      planned: mod.planNonOverlappingClientRoots([upper, lower], undefined, "win32", identities),
      ordinaryInjected:
        mod.rootKey("C:\\ORDINARY\\repo", "win32", identities) ===
        mod.rootKey("c:\\ordinary\\REPO", "win32", identities),
      distinctInjected:
        mod.rootKey(caseRoots[0], "win32", identities) !==
        mod.rootKey(caseRoots[1], "win32", identities),
      casePlanned: mod.planNonOverlappingClientRoots(
        caseRoots,
        undefined,
        "win32",
        identities,
      ),
      firstSelected: mod.selectDeepestRootForPath(
        "C:\\Sensitive\\Project\\src\\main.ts",
        caseRoots,
        "win32",
        identities,
      ),
      secondSelected: mod.selectDeepestRootForPath(
        "C:\\Sensitive\\project\\src\\main.ts",
        caseRoots,
        "win32",
        identities,
      ),
      missingSensitive:
        mod.rootKey(
          "C:\\Sensitive\\Project\\Future.ts",
          "win32",
          identities,
        ) !==
        mod.rootKey(
          "C:\\Sensitive\\Project\\future.ts",
          "win32",
          identities,
        ),
      missingOrdinary:
        mod.rootKey(
          "C:\\Ordinary\\Repo\\Future.ts",
          "win32",
          identities,
        ) ===
        mod.rootKey(
          "c:\\ordinary\\repo\\future.ts",
          "win32",
          identities,
        ),
    };
  
  })();
  const actual = observed as {
    casePlanned: string[];
    distinctInjected: boolean;
    firstSelected?: string;
    missingOrdinary: boolean;
    missingSensitive: boolean;
    ordinaryInjected: boolean;
    planned: string[];
    sameKey: boolean;
    secondSelected?: string;
  };
  assert.equal(actual.sameKey, true);
  assert.equal(actual.planned.length, 1);
  assert.equal(actual.ordinaryInjected, true);
  assert.equal(actual.distinctInjected, true);
  assert.equal(actual.casePlanned.length, 2);
  assert.equal(actual.firstSelected, "C:\\Sensitive\\Project");
  assert.equal(actual.secondSelected, "C:\\Sensitive\\project");
  assert.equal(actual.missingSensitive, true);
  assert.equal(actual.missingOrdinary, true);
}
