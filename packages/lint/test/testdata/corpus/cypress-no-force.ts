declare const cy: any;
// expect: cypress/no-force error
cy.get("button").click({ force: true });
