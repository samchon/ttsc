// guard-for-in is purely structural: it inspects the SHAPE of the loop
// body, never what the guarding `if` tests. These fixtures pin both the
// reported shapes and the accepted ones, including guards the older
// semantic port wrongly flagged (`obj.hasOwnProperty`, an arbitrary
// `if`, a bare `if`, a `continue` early-skip).

// Positive: an unguarded body walks the prototype chain and processes
// inherited keys exactly like own keys.
function dumpAll(obj: Record<string, unknown>): void {
  // expect: guard-for-in error
  for (const key in obj) {
    console.log(key, obj[key]);
  }
}

// Positive: a guard that lives below another statement does not open
// the body, so the work above it still leaks onto inherited keys.
function dumpAfterEffect(obj: Record<string, unknown>): void {
  // expect: guard-for-in error
  for (const key in obj) {
    console.log("scanning", key);
    if (Object.hasOwn(obj, key)) {
      console.log(obj[key]);
    }
  }
}

// Positive: a leading `if` guard followed by a trailing statement still
// runs that statement for inherited keys. The semantic port missed this
// (it only inspected the first statement); the structural rule reports.
function dumpWithTrailingStatement(obj: Record<string, unknown>): void {
  // expect: guard-for-in error
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      console.log(obj[key]);
    }
    console.log("visited", key);
  }
}

// Negative: `Object.hasOwn(obj, key)` immediately guards the body.
function dumpWithHasOwn(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      console.log(key, obj[key]);
    }
  }
}

// Negative: `Object.prototype.hasOwnProperty.call(obj, key)` is the
// older guard form and is accepted on the same terms.
function dumpWithHasOwnPropertyCall(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      console.log(key, obj[key]);
    }
  }
}

// Negative: `obj.hasOwnProperty(key)` — the most common real-world
// guard. Any leading `if` satisfies the rule, so the method-call form is
// valid even though the semantic port wrongly reported it.
function dumpWithHasOwnPropertyMethod(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      console.log(key, obj[key]);
    }
  }
}

// Negative: any leading `if` satisfies the rule — the condition is
// never inspected, so an arbitrary predicate counts as the guard.
function dumpWithArbitraryGuard(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (key.length > 0) {
      console.log(key, obj[key]);
    }
  }
}

// Negative: a bare (block-less) `if` body is itself the guard.
function dumpWithBareIf(obj: Record<string, unknown>): void {
  for (const key in obj) if (key.length > 0) console.log(key, obj[key]);
}

// Negative: a leading `if` whose consequent is `continue` is the
// canonical early-skip, whatever it tests — here a plain string check,
// not `Object.hasOwn`.
function dumpWithPrefixSkip(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (key.startsWith("_")) continue;
    console.log(key, obj[key]);
  }
}

// Negative: an inverted `Object.hasOwn` guard whose `continue` sits in a
// block consequent is also accepted.
function dumpWithEarlyContinue(obj: Record<string, unknown>): void {
  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) {
      continue;
    }
    console.log(key, obj[key]);
  }
}

JSON.stringify({
  dumpAll: dumpAll({ a: 1 }),
  dumpAfterEffect: dumpAfterEffect({ a: 1 }),
  dumpWithTrailingStatement: dumpWithTrailingStatement({ a: 1 }),
  dumpWithHasOwn: dumpWithHasOwn({ a: 1 }),
  dumpWithHasOwnPropertyCall: dumpWithHasOwnPropertyCall({ a: 1 }),
  dumpWithHasOwnPropertyMethod: dumpWithHasOwnPropertyMethod({ a: 1 }),
  dumpWithArbitraryGuard: dumpWithArbitraryGuard({ a: 1 }),
  dumpWithBareIf: dumpWithBareIf({ a: 1 }),
  dumpWithPrefixSkip: dumpWithPrefixSkip({ a: 1 }),
  dumpWithEarlyContinue: dumpWithEarlyContinue({ a: 1 }),
});
