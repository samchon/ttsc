import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code client roots follow each Windows directory's identity.
 *
 * VS Code and Node can report the same Windows workspace root with different
 * drive-letter casing. The extension keys running clients by canonical root so
 * it does not stop and restart the same project unnecessarily.
 *
 * 1. Import the pure server resolution helper.
 * 2. Prove ordinary aliases converge under the Windows platform override.
 * 3. Inject a deterministic filesystem with two case-distinct roots.
 * 4. Prove planning, containment, and deepest-root selection keep both clients.
 * 5. Prove missing descendants inherit the nearest existing root semantics.
 */
export const test_vscode_server_resolution_keys_windows_roots_case_insensitively =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      const upper = "C:\\\\Repo";
      const lower = "c:\\\\repo";
      const missing = () => {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      };
      const identities = mod.createServerRootPathIdentityContext("win32", {
        caseSensitive: (directory) =>
          directory.toLowerCase().startsWith("c:\\\\sensitive"),
        realpath: (location) => {
          const resolved = location.replaceAll("/", "\\\\");
          const folded = resolved.toLowerCase();
          if (folded === "c:\\\\ordinary") return "C:\\\\Ordinary";
          if (folded === "c:\\\\ordinary\\\\repo") return "C:\\\\Ordinary\\\\Repo";
          if (resolved === "C:\\\\Sensitive") return resolved;
          if (resolved === "C:\\\\Sensitive\\\\Project") return resolved;
          if (resolved === "C:\\\\Sensitive\\\\project") return resolved;
          if (resolved === "C:\\\\Sensitive\\\\Project\\\\src") return resolved;
          if (resolved === "C:\\\\Sensitive\\\\project\\\\src") return resolved;
          return missing();
        },
      });
      const caseRoots = [
        "C:\\\\Sensitive\\\\Project",
        "C:\\\\Sensitive\\\\project",
      ];
      console.log(JSON.stringify({
        sameKey: mod.rootKey(upper, "win32") === mod.rootKey(lower, "win32"),
        planned: mod.planNonOverlappingClientRoots([upper, lower], undefined, "win32"),
        ordinaryInjected:
          mod.rootKey("C:\\\\ORDINARY\\\\repo", "win32", identities) ===
          mod.rootKey("c:\\\\ordinary\\\\REPO", "win32", identities),
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
          "C:\\\\Sensitive\\\\Project\\\\src\\\\main.ts",
          caseRoots,
          "win32",
          identities,
        ),
        secondSelected: mod.selectDeepestRootForPath(
          "C:\\\\Sensitive\\\\project\\\\src\\\\main.ts",
          caseRoots,
          "win32",
          identities,
        ),
        missingSensitive:
          mod.rootKey(
            "C:\\\\Sensitive\\\\Project\\\\Future.ts",
            "win32",
            identities,
          ) !==
          mod.rootKey(
            "C:\\\\Sensitive\\\\Project\\\\future.ts",
            "win32",
            identities,
          ),
        missingOrdinary:
          mod.rootKey(
            "C:\\\\Ordinary\\\\Repo\\\\Future.ts",
            "win32",
            identities,
          ) ===
          mod.rootKey(
            "c:\\\\ordinary\\\\repo\\\\future.ts",
            "win32",
            identities,
          ),
      }));
    `;
    const result = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--experimental-transform-types",
        "--input-type=module",
        "--eval",
        script,
      ],
      { cwd: repo, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout) as {
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
  };
