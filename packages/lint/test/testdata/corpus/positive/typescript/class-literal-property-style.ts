class StringGetter {
  // expect: typescript/class-literal-property-style error
  static get label(): string {
    return "ttsc";
  }
}
class NumberGetter {
  // expect: typescript/class-literal-property-style error
  static get version(): number {
    return 1;
  }
}
class NegativeGetter {
  // expect: typescript/class-literal-property-style error
  static get offset(): number {
    return -42;
  }
}
class TemplateGetter {
  // expect: typescript/class-literal-property-style error
  get banner(): string {
    return `static template`;
  }
}
class GetterWithSetter {
  private _flag = "yes";
  get flag(): string {
    return this._flag;
  }
  set flag(value: string) {
    this._flag = value;
  }
}
class ComputedGetter {
  static get computed(): number {
    return 1 + 2;
  }
}
class FieldShape {
  static readonly label = "ok";
}
JSON.stringify({ StringGetter, NumberGetter, NegativeGetter, TemplateGetter, GetterWithSetter, ComputedGetter, FieldShape });
