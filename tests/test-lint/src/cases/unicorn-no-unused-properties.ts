export {};

const settings = {
  timeout: 1_000,
  // expect: unicorn/no-unused-properties error
  retries: 3,
  limits: {
    depth: 4,
    // expect: unicorn/no-unused-properties error
    breadth: 5,
  },
};
console.log(settings.timeout, settings.limits.depth);

// Negative twin: every property is read, so nothing is reported.
const used = { first: 1, second: 2 };
console.log(used.first, used["second"]);

// Negative: a dynamic key access can reach any property.
declare const anyKey: keyof { alpha: 1; beta: 2 };
const dynamic = { alpha: 1, beta: 2 };
console.log(dynamic[anyKey]);

// Negative: the object escapes as a call argument.
const escaped = { gamma: 1, delta: 2 };
console.log(escaped);

function report(args: {
  wanted: number;
  // expect: unicorn/no-unused-properties error
  ignored: number;
}): number {
  return args.wanted;
}
void report({ wanted: 1, ignored: 2 });
