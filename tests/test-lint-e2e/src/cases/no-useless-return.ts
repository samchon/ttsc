function trailing(): void {
  console.log("work");
  // expect: no-useless-return error
  return;
}

// Negative: `return X;` is never useless — it carries a value.
function withValue(): number {
  return 1;
}

// Negative: an early `return;` guards the statements that follow.
function guarded(flag: boolean): void {
  if (flag) {
    return;
  }
  console.log("after");
}

trailing();
JSON.stringify({ withValue: withValue(), guarded });
