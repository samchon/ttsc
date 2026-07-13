declare function getPromise(): Promise<boolean>;
declare function sideEffect(): void;

// Positive: Promise in an `if` condition.
async function inIf(): Promise<void> {
  // expect: typescript/no-misused-promises error
  if (getPromise()) {
    sideEffect();
  }
}

// Positive: Promise in a `while` condition.
async function inWhile(): Promise<void> {
  // expect: typescript/no-misused-promises error
  while (getPromise()) {
    sideEffect();
    break;
  }
}

// Positive: Promise as ternary condition.
async function inTernary(): Promise<number> {
  // expect: typescript/no-misused-promises error
  return getPromise() ? 1 : 0;
}

// Positive: Promise behind a `!` operator.
async function inNegation(): Promise<boolean> {
  // expect: typescript/no-misused-promises error
  return !getPromise();
}

// Positive: Promise on the LHS of `&&`.
async function inLogicalAnd(): Promise<number> {
  // expect: typescript/no-misused-promises error
  return getPromise() && 1;
}

// Negative: `??` checks nullishness rather than boolean truthiness.
async function inNullishCoalescing(): Promise<number> {
  return getPromise() ?? 0;
}

// Positive: async callback passed to `forEach` — Promise return is
// discarded by the iteration.
async function inForEach(): Promise<void> {
  // expect: typescript/no-misused-promises error
  [1, 2, 3].forEach(async (value) => {
    await getPromise();
    sideEffect();
  });
}

// Negative: explicitly awaited.
async function awaitedInIf(): Promise<void> {
  if (await getPromise()) {
    sideEffect();
  }
}

// Negative: non-Promise condition.
function nonPromiseCondition(value: number): number {
  return value > 0 ? 1 : 0;
}

// Negative: `forEach` with a non-async callback.
function syncForEach(): void {
  [1, 2, 3].forEach((value) => {
    sideEffect();
  });
}

JSON.stringify({
  inIf,
  inWhile,
  inTernary,
  inNegation,
  inLogicalAnd,
  inNullishCoalescing,
  inForEach,
  awaitedInIf,
  nonPromiseCondition,
  syncForEach,
});
