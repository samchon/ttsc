// @ttsc-corpus-clean: unicorn/no-invalid-remove-event-listener
declare const el: EventTarget; const handler = () => {}; el.removeEventListener("click", handler);
