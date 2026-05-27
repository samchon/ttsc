class Greeter {
  public name = "world";
  public greet(): string {
    return this.name;
  }
  public static factory(): Greeter {
    return new Greeter();
  }
}

const g = new Greeter();

// Positive: instance method captured as a value loses its `this`.
// expect: typescript/unbound-method error
const captured = g.greet;

// Positive: passed as a callback — `setTimeout` will call it with a
// detached `this`.
// expect: typescript/unbound-method error
setTimeout(g.greet, 0);

// Positive: stored on an object literal — the receiver is now the
// outer object, not `g`.
// expect: typescript/unbound-method error
const wrapper = { run: g.greet };

// Negative: invoked in place — `this` is bound for the call.
const greeting = g.greet();

// Negative: static method on the constructor — no instance `this` to
// lose.
const built = Greeter.factory;

JSON.stringify({ captured, wrapper, greeting, built });
