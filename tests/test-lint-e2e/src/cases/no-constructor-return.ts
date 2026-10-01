class Returning {
  value: number;
  constructor(initial: number) {
    this.value = initial;
    // expect: no-constructor-return error
    return { handled: true } as unknown as Returning;
  }
}

// Negative: bare `return;` is permitted — it just ends the constructor
// early without contributing a return value.
class EarlyExit {
  value: number;
  constructor(initial: number) {
    if (initial < 0) {
      return;
    }
    this.value = initial;
  }
}

// Negative: a normal constructor with no return.
class NoReturn {
  value: number;
  constructor(initial: number) {
    this.value = initial;
  }
}

JSON.stringify({ Returning, EarlyExit, NoReturn });
