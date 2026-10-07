// Positive: top-level `this` has no binding in a module — it resolves to
// `undefined`, so reading from it is almost always a copy-paste from a
// class method.
// expect: no-invalid-this error
void this;

// Positive: arrow functions inherit `this` from the enclosing scope, so a
// top-level arrow has no `this` binding either.
const topArrow = (): void => {
  // expect: no-invalid-this error
  void this;
};
void topArrow;

// Negative: a regular function declaration creates its own `this`.
function regular(this: { value: number }): number {
  return this.value;
}
void regular;

// Negative: methods and class static blocks each provide a `this`
// binding even when nested arrow functions read it.
class Owner {
  public value: number = 1;
  public read(): number {
    const inner = (): number => this.value;
    return inner();
  }
  public static counter: number = 0;
  static {
    const bump = (): void => {
      this.counter += 1;
    };
    bump();
  }
}
void new Owner().read();
