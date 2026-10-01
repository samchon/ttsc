// Positive: only static members.
// expect: typescript/no-extraneous-class error
class StaticOnly {
  static factory(): number {
    return 1;
  }
  static readonly defaultValue = 42;
}

// Positive: empty class.
// expect: typescript/no-extraneous-class error
class Empty {}

// Negative: class with instance state.
class HasInstance {
  value: number;
  constructor(initial: number) {
    this.value = initial;
  }
}

// Negative: class extends another — polymorphic intent.
class Derived extends HasInstance {
  static factory(): Derived {
    return new Derived(0);
  }
}

// Negative: class implements an interface — polymorphic intent.
interface Renderable {
  render(): string;
}
class Implementer implements Renderable {
  static description = "static";
  render(): string {
    return Implementer.description;
  }
}

JSON.stringify({ StaticOnly, Empty, HasInstance, Derived, Implementer });
