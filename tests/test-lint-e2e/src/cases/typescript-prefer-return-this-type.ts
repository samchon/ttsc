declare function sideEffect(value: unknown): void;

class Chainable {
  // Positive: the body always `return this`, so the return type should
  // be `this` — a subclass call site keeps the narrower receiver type
  // instead of being widened back to `Chainable`.
  // expect: typescript/prefer-return-this-type error
  setName(name: string): Chainable {
    sideEffect(name);
    return this;
  }

  // Positive: branchy body that nevertheless `return this` on every
  // path.
  // expect: typescript/prefer-return-this-type error
  reset(flag: boolean): Chainable {
    if (flag) {
      return this;
    }
    return this;
  }

  // Negative: already `this` — already the form the rule asks for.
  ok1(): this {
    return this;
  }

  // Negative: returns something other than `this` on at least one path.
  ok2(flag: boolean): Chainable {
    if (flag) {
      return this;
    }
    return new Chainable();
  }

  // Negative: explicit void return — no value to widen.
  ok3(): void {
    sideEffect(this);
  }
}

sideEffect(new Chainable());
