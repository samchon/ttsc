declare const el: { onclick: any };
// expect: unicorn/prefer-add-event-listener error
el.onclick = () => {};
