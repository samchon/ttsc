declare const cy: any;
// expect: cypress/unsafe-to-chain-command error
cy.get("input").type("a").type("b");
