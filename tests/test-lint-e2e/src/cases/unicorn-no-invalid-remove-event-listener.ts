declare const el: EventTarget;
// expect: unicorn/no-invalid-remove-event-listener error
el.removeEventListener("click", () => {});
