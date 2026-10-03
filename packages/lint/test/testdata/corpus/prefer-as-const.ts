// expect: typescript/prefer-as-const error
const asserted = "foo" as "foo";
// expect: typescript/prefer-as-const error
const angled = <4>4;
// expect: typescript/prefer-as-const error
let numeric: 2 = 2;
// expect: typescript/prefer-as-const error
let flag: true = true;
// expect: typescript/prefer-as-const error
let big: 10n = 10n;
// expect: typescript/prefer-as-const error
let []: "bar" = "bar";
// expect: typescript/prefer-as-const error
let nested: "deep" = "deep" as "deep";

class Holder {
  // expect: typescript/prefer-as-const error
  public value: "value" = "value";
  // expect: typescript/prefer-as-const error
  static count: 1 = 1;
  accessor tracked: "on" = "on";
  label: string = "wide";
  bare?: "alone";
}

enum Level {
  low = "low",
}

function pick(kind: "left" = "left"): string {
  return kind;
}

let differentQuotes = 'value' as "value";
let quotedAnnotation: "value" = 'value';
let echoed: "value" = quotedAnnotation;
let differentSpelling: 10 = 0xa;
let template = `tpl` as `tpl`;
let nullish = null as null;
let widened: string = "wide";
let alone: "alone";
alone = "alone";
let assertedConst: "done" = "done" as const;

numeric = 2;
flag = true;

export {
  alone,
  angled,
  asserted,
  assertedConst,
  big,
  differentQuotes,
  differentSpelling,
  echoed,
  flag,
  Holder,
  Level,
  nested,
  nullish,
  numeric,
  pick,
  quotedAnnotation,
  template,
  widened,
};
