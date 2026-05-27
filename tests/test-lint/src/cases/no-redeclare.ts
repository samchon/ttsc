// Positive: two `var` declarations of the same name share the script scope.
var sample: number = 1;
// expect: no-redeclare error
var sample: number = 2;
void sample;

// Positive: redeclaring a function in the same scope silently overwrites.
function shared(): number {
  return 1;
}
// expect: no-redeclare error
function shared(): number {
  return 2;
}
void shared;

// Negative: `let` in an inner block shadows the outer binding rather than
// redeclaring it — the rule must leave nested-scope reuse alone.
let outerLet: number = 1;
{
  let outerLet: number = 2;
  void outerLet;
}
void outerLet;
