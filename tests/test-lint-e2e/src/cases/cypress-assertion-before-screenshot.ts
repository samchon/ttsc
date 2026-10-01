declare const cy: any;
// Positive: `cy.screenshot()` runs with no preceding Cypress assertion,
// so the screenshot may capture a transient pre-stable state.
cy.get("[data-cy=dialog]");
// expect: cypress/assertion-before-screenshot error
cy.screenshot();
