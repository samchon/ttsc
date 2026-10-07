// AST-only fixture for typescript/no-useless-constructor.
//
// TS-aware extension of the core `no-useless-constructor` rule.
// A constructor with an empty body and no parameter properties is
// noise — the engine generates the same default constructor anyway.
// Parameter properties (`public x: number`) survive the check because
// they implicitly declare the class field; removing the constructor
// would delete the field.

// Positive: empty body, no parameters — same as default.
class EmptyNoParams {
  // expect: typescript/no-useless-constructor error
  constructor() {}
}

// Positive: empty body, plain parameters — also pointless because the
// arguments are never used.
class EmptyPlainParams {
  // expect: typescript/no-useless-constructor error
  constructor(_name: string, _count: number) {}
}

// Negative: parameter property declares a field. The empty body IS
// the implicit `this.name = name` assignment.
class WithParameterProperty {
  constructor(public name: string) {}
}

// Negative: mixed parameters — at least one is a parameter property,
// so the constructor still has semantic effect.
class MixedParameters {
  constructor(
    public id: number,
    _plain: string,
  ) {}
}

// Negative: non-empty body. The author is doing something inside the
// constructor regardless of parameter shape.
class WithBody {
  count: number;
  constructor() {
    this.count = 0;
  }
}

JSON.stringify({
  EmptyNoParams,
  EmptyPlainParams,
  WithParameterProperty,
  MixedParameters,
  WithBody,
});
