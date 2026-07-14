package linthost

import (
  "fmt"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const noAwaitInLoopCompleteSource = `declare function initializerValue(): Promise<number>;
declare function repeatedCondition(): Promise<boolean>;
declare function repeatedUpdate(): Promise<number>;
declare function repeatedBody(): Promise<void>;
declare function objectOnce(): Promise<Record<string, number>>;
declare function valuesOnce(): Promise<number[]>;
declare function forInBody(): Promise<void>;
declare function forOfBody(): Promise<void>;
declare function whileCondition(): Promise<boolean>;
declare function doBody(): Promise<void>;
declare function doCondition(): Promise<boolean>;
declare function outerCondition(): boolean;
declare function stream(): AsyncIterable<number>;
declare function consume(value: unknown): void;
declare function consumeAsync(value: unknown): Promise<void>;
declare function makeResource(): any;
declare function resources(): any[];
declare function nestedAwait(): Promise<void>;
declare function arrowAwait(): Promise<void>;
declare function methodAwait(): Promise<void>;

async function forPositions(): Promise<void> {
  for (
    let index = await initializerValue();
    await repeatedCondition();
    index = await repeatedUpdate()
  ) {
    await repeatedBody();
    break;
  }
}

async function iterablePositions(): Promise<void> {
  for (const key in await objectOnce()) {
    consume(key);
    await forInBody();
  }
  for (const value of await valuesOnce()) {
    consume(value);
    await forOfBody();
  }
}

async function conditionPositions(): Promise<void> {
  while (await whileCondition()) {
    break;
  }
  do {
    await doBody();
  } while (
    await doCondition()
  );
}

async function nestedForAwait(): Promise<void> {
  while (outerCondition()) {
    for /* a comment deliberately longer than the former source window */ await (const value of stream()) {
      await consumeAsync(value);
    }
    break;
  }
}

async function intentionalAsyncIteration(): Promise<void> {
  for /* spacing and comments must not affect typed detection */ await (const value of stream()) {
    await consumeAsync(value);
  }
}

async function resourcePositions(): Promise<void> {
  for (await using initialResource = makeResource(); false; ) {
    consume(initialResource);
  }
  while (outerCondition()) {
    await using bodyResource = makeResource();
    consume(bodyResource);
    break;
  }
  for (await using item of resources()) {
    consume(item);
  }
}

async function scopedBoundaries(): Promise<void> {
  while (outerCondition()) {
    async function nested(): Promise<void> {
      await nestedAwait();
    }
    const arrow = async (): Promise<void> => {
      await arrowAwait();
    };
    class Holder {
      static async load(): Promise<void> {
        await methodAwait();
      }
    }
    consume(nested);
    consume(arrow);
    consume(Holder);
    break;
  }
}

consume({ forPositions, iterablePositions, conditionPositions, nestedForAwait, intentionalAsyncIteration, resourcePositions, scopedBoundaries });
`

// TestNoAwaitInLoopMatchesExecutionPositionsAndImplicitAwaits verifies the complete ESLint traversal contract.
//
// A loop ancestor alone is insufficient: initializers and iterable operands run
// once, while tests, updates, bodies, nested for-await statements, and await-using
// declarations in repeated positions are implicit or explicit serialization.
// Typed AST fields must also recognize for-await through arbitrary comments.
//
//  1. Exercise every loop position plus function, method, and for-await boundaries.
//  2. Assert the native engine reports the exact candidate-node ranges once.
//  3. Run the real check command and require the same diagnostic count and lines.
func TestNoAwaitInLoopMatchesExecutionPositionsAndImplicitAwaits(t *testing.T) {
  nestedForAwaitTarget := `for /* a comment deliberately longer than the former source window */ await (const value of stream()) {
      await consumeAsync(value);
    }`
  targets := []string{
    "await repeatedCondition()",
    "await repeatedUpdate()",
    "await repeatedBody()",
    "await forInBody()",
    "await forOfBody()",
    "await whileCondition()",
    "await doBody()",
    "await doCondition()",
    nestedForAwaitTarget,
    "await using bodyResource = makeResource()",
    "await using item",
  }
  type expectedRange struct {
    pos    int
    end    int
    target string
  }
  expected := make([]expectedRange, 0, len(targets))
  for _, target := range targets {
    if count := strings.Count(noAwaitInLoopCompleteSource, target); count != 1 {
      t.Fatalf("target %q occurs %d times", target, count)
    }
    pos := strings.Index(noAwaitInLoopCompleteSource, target)
    expected = append(expected, expectedRange{pos: pos, end: pos + len(target), target: target})
  }
  sort.Slice(expected, func(i, j int) bool { return expected[i].pos < expected[j].pos })

  file := parseTS(t, noAwaitInLoopCompleteSource)
  findings := NewEngine(RuleConfig{"no-await-in-loop": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  sort.Slice(findings, func(i, j int) bool { return findings[i].Pos < findings[j].Pos })
  if len(findings) != len(expected) {
    t.Fatalf("want %d findings, got %d: %+v", len(expected), len(findings), findings)
  }
  const message = "Unexpected `await` inside a loop — iterations run sequentially; prefer `Promise.all` when independent."
  for index, finding := range findings {
    want := expected[index]
    if finding.Pos != want.pos || finding.End != want.end || finding.Message != message {
      target := ""
      if finding.Pos >= 0 && finding.End >= finding.Pos && finding.End <= len(noAwaitInLoopCompleteSource) {
        target = noAwaitInLoopCompleteSource[finding.Pos:finding.End]
      }
      t.Fatalf("finding %d: want [%d,%d) %q, got [%d,%d) %q message=%q",
        index, want.pos, want.end, want.target, finding.Pos, finding.End, target, finding.Message)
    }
  }

  root := seedLintProject(t, noAwaitInLoopCompleteSource)
  seedLintRules(t, root, map[string]string{"no-await-in-loop": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" {
    t.Fatalf("command result mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if count := strings.Count(stderr, "[no-await-in-loop]"); count != len(expected) {
    t.Fatalf("want %d command diagnostics, got %d: %s", len(expected), count, stderr)
  }
  for _, want := range expected {
    line := strings.Count(noAwaitInLoopCompleteSource[:want.pos], "\n") + 1
    location := fmt.Sprintf("main.ts:%d:", line)
    if !diagnosticOutputContains(stderr, location) {
      t.Fatalf("missing command diagnostic at %s for %q: %s", location, want.target, stderr)
    }
  }
}
