class Base {
  protected value: number = 0;
  constructor(initial: number) {
    this.value = initial;
  }
}

// Positive: `this` referenced before `super()` in a derived constructor.
class UsesThisFirst extends Base {
  constructor() {
    // expect: no-this-before-super error
    this.value = 1;
    super(0);
  }
}

// Positive: `super.x` accessed before `super()`.
class UsesSuperPropertyFirst extends Base {
  constructor() {
    // expect: no-this-before-super error
    super.value;
    super(0);
  }
}

// Negative: `super()` first, then `this`.
class CorrectOrder extends Base {
  constructor() {
    super(0);
    this.value = 1;
  }
}

// Negative: base class (no extends) — `this` is legal everywhere.
class StandaloneBase {
  value: number;
  constructor(initial: number) {
    this.value = initial;
  }
}

// Negative: `this` inside a nested arrow — not attributed to the
// outer constructor.
class NestedArrowIsOk extends Base {
  helper: () => number = () => this.value;
  constructor() {
    super(0);
  }
}

JSON.stringify({
  Base,
  UsesThisFirst,
  UsesSuperPropertyFirst,
  CorrectOrder,
  StandaloneBase,
  NestedArrowIsOk,
});
