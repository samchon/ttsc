// Type-aware fixture for typescript/related-getter-setter-pairs.
//
// When a class declares both a `get` and a `set` accessor for the
// same member, the reader (`get`) should observe the same type the
// writer (`set`) accepts. The rule fires when those types diverge —
// callers would otherwise see a value type the setter cannot round-
// trip.

// Positive: getter returns `string`, setter accepts `number`. Reading
// `value` yields a `string` but assigning `string` to `value` is a
// type error — the accessor pair lies about its shape.
class Mismatch {
  private _value = "abc";
  // expect: typescript/related-getter-setter-pairs error
  get value(): string {
    return this._value;
  }
  set value(next: number) {
    this._value = String(next);
  }
}

// Negative: getter return type matches setter parameter type — the
// canonical, type-safe accessor pair.
class Matched {
  private _label = "ok";
  get label(): string {
    return this._label;
  }
  set label(next: string) {
    this._label = next;
  }
}

// Negative: only a getter — there is no setter to compare against, so
// the rule has nothing to report.
class GetterOnly {
  get version(): number {
    return 1;
  }
}

JSON.stringify({ Mismatch, Matched, GetterOnly });
