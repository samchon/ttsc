declare class Component {
  isMounted(): boolean;
}

class Widget extends Component {
  refresh() {
    // Positive: `isMounted()` call on a class component.
    // expect: react/no-is-mounted error
    if (this.isMounted()) {
      JSON.stringify("mounted");
    }
  }
}

JSON.stringify(Widget);
