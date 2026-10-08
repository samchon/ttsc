package linthost

import (
  "path/filepath"
  "testing"
)

// TestNoUnnecessaryTypeArgumentsResolvesImportedAliases verifies checker-owned
// alias resolution across type references, heritage, calls and constructors.
//
// 1. Import renamed, forwarded, default and namespace generic declarations.
// 2. Repeat their declared defaults and contrast distinct explicit arguments.
// 3. Require the complete nine-diagnostic sequence at the authored positive lines.
//
// @evidence contracts/testing.md#behavioral-verification The real in-process check reports exactly lines 4 through 12, covering imported type, interface heritage, implements, runtime heritage, function call, constructors, namespace access and a type alias with its own default.
// @evidence contracts/testing.md#independent-expectations Literal string defaults and the type alias's number default determine the nine positive lines independently of symbol identity; nine adjacent distinct arguments must produce no additional diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Named renaming, re-export forwarding, default import and namespace qualification exercise distinct alias paths; type-only and runtime contexts each retain a default-equal positive and a distinct negative.
// @evidence contracts/testing.md#execution-ownership This public Go unit uses a real temporary multi-file Program and Checker through the in-process check command, with no native compilation, installed consumer or child host.
func TestNoUnnecessaryTypeArgumentsResolvesImportedAliases(t *testing.T) {
  root := seedLintProject(t, `import DefaultBase, { Contract as ImportedContract, Base as ImportedBase, make as importedMake, OwnDefault as ImportedAlias } from './origin';
import { ForwardedContract } from './forward';
import * as NS from './origin';
type RepeatType = ImportedContract<string>;
interface RepeatInterface extends ForwardedContract<string> {}
class RepeatImplements implements ImportedContract<string> {}
class RepeatBase extends ImportedBase<string> {}
const repeatCall = importedMake<string>();
const repeatNew = new ImportedBase<string>();
const repeatDefault = new DefaultBase<string>();
type RepeatNamespace = NS.Contract<string>;
type RepeatOwnDefault = ImportedAlias<number>;
type DistinctType = ImportedContract<number>;
interface DistinctInterface extends ForwardedContract<number> {}
class DistinctImplements implements ImportedContract<number> {}
class DistinctBase extends ImportedBase<number> {}
const distinctCall = importedMake<number>();
const distinctNew = new ImportedBase<number>();
const distinctDefault = new DefaultBase<number>();
type DistinctNamespace = NS.Contract<number>;
type DistinctOwnDefault = ImportedAlias<string>;
`)
  writeFile(t, filepath.Join(root, "src", "origin.ts"), `export interface Contract<T = string> {}
export class Base<T = string> {}
export declare function make<T = string>(): T;
export default class DefaultBase<T = string> {}
export type OwnDefault<T = number> = Contract<T>;
`)
  writeFile(t, filepath.Join(root, "src", "forward.ts"), "export { Contract as ForwardedContract } from './origin';\n")
  const rule = "typescript/no-unnecessary-type-arguments"
  seedLintRules(t, root, map[string]string{rule: "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" {
    t.Fatalf("imported diagnostics: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, rule, stderr, 4, 5, 6, 7, 8, 9, 10, 11, 12)
}
