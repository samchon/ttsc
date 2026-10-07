declare class Component<P = unknown, S = unknown> {
  props: P;
  state: S;
  setState(next: Partial<S>): void;
}

class Counter extends Component<unknown, { count: number }> {
  bump() {
    // Positive: writing `this.state` directly outside the constructor.
    // expect: react/no-direct-mutation-state error
    this.state.count = 1;
  }

  safe() {
    // Negative: going through `setState`.
    this.setState({ count: 1 });
  }
}

JSON.stringify(Counter);
