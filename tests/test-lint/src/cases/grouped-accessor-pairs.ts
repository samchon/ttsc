// Positive: the `get value` and `set value` accessors are split apart by an
// unrelated method, so a reader scanning the class has to chase the pair
// across the body — the rule wants getter/setter pairs to sit together.
class Splayed {
  private state = 0;

  get value(): number {
    return this.state;
  }

  other(): void {
    this.state += 1;
  }

  // expect: grouped-accessor-pairs error
  set value(next: number) {
    this.state = next;
  }
}

// Negative: the matching `get` and `set` declarations are adjacent, which
// is the layout the rule wants every accessor pair to follow.
class Grouped {
  private state = 0;

  get value(): number {
    return this.state;
  }
  set value(next: number) {
    this.state = next;
  }
}

// Positive: object literals are inspected too. This one splits its
// `get total` and `set total` halves with an unrelated method between them,
// so the trailing setter is reported just like the split class above.
let counted = 0;
const splitObject = {
  get total(): number {
    return counted;
  },
  bump(): void {
    counted += 1;
  },
  // expect: grouped-accessor-pairs error
  set total(next: number) {
    counted = next;
  },
};

// Negative: the object literal keeps its `get`/`set` pair adjacent, the
// grouped layout the rule wants, so nothing is reported.
const groupedObject = {
  get total(): number {
    return counted;
  },
  set total(next: number) {
    counted = next;
  },
};

JSON.stringify({
  splayed: new Splayed(),
  grouped: new Grouped(),
  splitObject,
  groupedObject,
});
