package linthost

import ("reflect"; "testing")

// TestNoMisusedPromisesPreservesMigratedDefaultContexts verifies all six
// default contexts and the synchronous and Promise-aware controls.
//
// 1. Load the original strict fixture with disposable-library support.
// 2. Run the real command operation and compare exactly six diagnostic lines.
//
// @evidence contracts/testing.md#behavioral-verification runMigratedNoMisusedPromisesContexts invokes the owning lint command with a real Program and Checker; exact lines and exit code distinguish missed callback, predicate, spread, inheritance and disposal findings from false reports on the controls.
// @evidence contracts/testing.md#independent-expectations The six literal lines 3, 7, 8, 11, 18 and 24 preserve the reviewed source contexts from the former auto-discovery case rather than deriving expectations from current rule output.
// @evidence contracts/testing.md#distinguishing-cases Promise-producing callbacks, a predicate, object spread, a void-contract method and synchronous disposal report; synchronous disposal and a Promise-aware callback remain clean through the exact complete line list.
// @evidence contracts/testing.md#execution-ownership TestNoMisusedPromisesPreservesMigratedDefaultContexts calls runMigratedNoMisusedPromisesContexts and the in-process check operation with the original NodeNext/disposable-library fixture options and a real Program/Checker. No contributor artifact, CLI child or installed consumer runs; package auto-discovery and native transport belong to the surviving E2E batch.
func TestNoMisusedPromisesPreservesMigratedDefaultContexts(t *testing.T) {
 lines, code, stdout, stderr := runMigratedNoMisusedPromisesContexts(t, "declare function consume(callback: () => void): void;\n\nconsume(async () => {\n  await Promise.resolve();\n});\n\n[1].forEach(() => Promise.resolve());\n[1].filter(() => Promise.resolve(true));\n\nconst promise = Promise.resolve({ value: 1 });\nconsole.log({ ...promise });\n\ninterface SyncContract {\n  execute(): void;\n}\n\nclass AsyncImplementation implements SyncContract {\n  public async execute(): Promise<void> {\n    await Promise.resolve();\n  }\n}\n\nfunction manageResources(): void {\n  using asyncThroughSyncProtocol = {\n    async [Symbol.dispose](): Promise<void> {\n      await Promise.resolve();\n    },\n  };\n\n  using syncResource = {\n    [Symbol.dispose](): void {},\n  };\n\n  console.log(asyncThroughSyncProtocol, syncResource);\n}\n\ndeclare const asyncAware: {\n  forEach(callback: () => Promise<void>): void;\n};\n\nasyncAware.forEach(async () => {\n  await Promise.resolve();\n});\n\nexport { AsyncImplementation, manageResources };\n")
 if code != 2 || stdout != "" || !reflect.DeepEqual(lines, []int{3, 7, 8, 11, 18, 24}) { t.Fatalf("default contexts: code=%d stdout=%q lines=%v stderr=%s", code, stdout, lines, stderr) }
}
