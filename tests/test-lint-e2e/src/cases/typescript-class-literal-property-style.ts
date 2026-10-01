// Positive: getter returns a string literal with no companion setter.
class StringGetter {
  // expect: typescript/class-literal-property-style error
  static get label(): string {
    return "ttsc";
  }
}

// Positive: getter returns a number literal — should be a readonly field.
class NumberGetter {
  // expect: typescript/class-literal-property-style error
  static get version(): number {
    return 1;
  }
}

// Positive: getter returns a unary-minus numeric literal.
class NegativeGetter {
  // expect: typescript/class-literal-property-style error
  static get offset(): number {
    return -42;
  }
}

// Positive: getter returns a template literal with no substitutions.
class TemplateGetter {
  // expect: typescript/class-literal-property-style error
  get banner(): string {
    return `static template`;
  }
}

// Negative: getter has a companion setter — field form cannot replicate it.
class GetterWithSetter {
  private _flag = "yes";
  get flag(): string {
    return this._flag;
  }
  set flag(value: string) {
    this._flag = value;
  }
}

// Negative: getter body is non-trivial (computed expression).
class ComputedGetter {
  static get computed(): number {
    return 1 + 2;
  }
}

// Negative: already declared as a readonly field — the preferred shape.
class FieldShape {
  static readonly label = "ok";
}

JSON.stringify({
  StringGetter,
  NumberGetter,
  NegativeGetter,
  TemplateGetter,
  GetterWithSetter,
  ComputedGetter,
  FieldShape,
});
