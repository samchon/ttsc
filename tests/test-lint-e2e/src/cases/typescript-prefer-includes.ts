declare const list: string[];
declare const text: string;
declare const tuple: [number, number];
declare function sideEffect(value: unknown): void;

// Positive: `arr.indexOf(x) !== -1` — the canonical case the rule guards.
// expect: typescript/prefer-includes error
if (list.indexOf("a") !== -1) {
  sideEffect(list);
}

// Positive: `arr.indexOf(x) === -1` — the "absent" polarity is also a rewrite.
// expect: typescript/prefer-includes error
if (list.indexOf("a") === -1) {
  sideEffect(list);
}

// Positive: `arr.indexOf(x) >= 0` — the "present" ordering form.
// expect: typescript/prefer-includes error
const presentOrder = list.indexOf("a") >= 0;

// Positive: `arr.indexOf(x) < 0` — the "absent" ordering form.
// expect: typescript/prefer-includes error
const absentOrder = list.indexOf("a") < 0;

// Positive: same shape on a string receiver.
// expect: typescript/prefer-includes error
const inText = text.indexOf("/") !== -1;

// Positive: tuple receiver.
// expect: typescript/prefer-includes error
const inTuple = tuple.indexOf(1) !== -1;

// Positive: swapped operand order (`-1 !== arr.indexOf(x)`).
// expect: typescript/prefer-includes error
const flipped = -1 !== list.indexOf("a");

// Negative: `.includes` — already the form the rule asks for.
const ok1 = list.includes("a");

// Negative: comparing against a non-sentinel constant (`-2`).
const ok2 = list.indexOf("a") !== -2;

// Negative: receiver type is not array/string (`Set#indexOf` doesn't exist,
// so we approximate with a method on a user type).
declare const tracker: { indexOf(value: string): number };
const ok3 = tracker.indexOf("a") !== -1;

sideEffect({ presentOrder, absentOrder, inText, inTuple, flipped, ok1, ok2, ok3 });
