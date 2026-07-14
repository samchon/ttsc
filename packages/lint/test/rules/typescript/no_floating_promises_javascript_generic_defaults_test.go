package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestNoFloatingPromisesHonorsJavaScriptGenericDefaults verifies partial
// explicit type arguments use the Checker's JavaScript default substitution.
//
// JSDoc defaults of empty object and unknown become any for a signature
// declared in JavaScript. Treating that signature as TypeScript would turn an
// uncertain mixed-receiver return into a falsely safe concrete object.
//
//  1. Import unsafe-any and safe-undefined JSDoc method defaults into TypeScript.
//  2. Call each method through a mixed Promise receiver with one explicit type argument.
//  3. Assert only the JavaScript-any return remains conservatively unhandled.
func TestNoFloatingPromisesHonorsJavaScriptGenericDefaults(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "allowJs": true,
    "checkJs": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts", "src/js-catch.js"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { JsSafeCatch, JsUncertainCatch } from "./js-catch";
declare const uncertain: Promise<void> | JsUncertainCatch;
declare const safe: Promise<void> | JsSafeCatch;
uncertain.catch<undefined>(() => undefined);
safe.catch<undefined>(() => undefined);
`)
  writeFile(t, filepath.Join(root, "src", "js-catch.js"), `export class JsUncertainCatch {
  /**
   * @template T
   * @template [U={}]
   * @param {() => T} onRejected
   * @returns {U}
   */
  catch(onRejected) {
    return /** @type {any} */ (onRejected());
  }
}

export class JsSafeCatch {
  /**
   * @template T
   * @template [U=undefined]
   * @param {() => T} onRejected
   * @returns {U}
   */
  catch(onRejected) {
    return /** @type {any} */ (onRejected());
  }
}
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "typescript/no-floating-promises": "error",
    },
  })

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("JavaScript generic-default run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/no-floating-promises]"); got != 1 ||
    !diagnosticOutputContains(stderr, "main.ts:4:") ||
    diagnosticOutputContains(stderr, "main.ts:5:") {
    t.Fatalf("JavaScript generic-default findings mismatch:\n%s", stderr)
  }
}
