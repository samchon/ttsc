type Tag = "a" | "b" | "c";
declare const tag: Tag;
declare function sideEffect(value: string): void;

// Positive: union member "c" has no matching case and there is no
// default clause, so the rule fires on the switch statement.
// expect: typescript/switch-exhaustiveness-check error
switch (tag) {
  case "a":
    sideEffect("a");
    break;
  case "b":
    sideEffect("b");
    break;
}

// Negative: every union member is covered explicitly.
switch (tag) {
  case "a":
    sideEffect("a");
    break;
  case "b":
    sideEffect("b");
    break;
  case "c":
    sideEffect("c");
    break;
}

// Negative: a `default` clause covers the remaining shape.
switch (tag) {
  case "a":
    sideEffect("a");
    break;
  default:
    sideEffect("rest");
    break;
}
