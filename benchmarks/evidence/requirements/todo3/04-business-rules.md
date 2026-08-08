# Business Rules

## REQ-RULE-CREDENTIAL Credential Rules

Email is the stable account identity used by registration, login, and password recovery. Canonical matching prevents capitalization or accidental outer whitespace from creating duplicate private accounts.

Passwords use one acceptance boundary across initial registration and both replacement journeys. Email, password, and proof validation identify the input that must be corrected, while login failure uses one generic outcome that protects account existence. Successful replacement makes the new secret authoritative and ends access established under the old credential state.

### REQ-RULE-CREDENTIAL-1 Canonicalize and Uniquely Identify Email Accounts

An account email must be a valid email form after leading and trailing whitespace is removed. Email identity is compared without letter-case distinction, so capitalization does not create a different account.

Two values that differ only by case or outer whitespace resolve to the same canonical email identity. Registration accepts at most one account for that identity; a duplicate attempt creates nothing and leaves the existing account unchanged.

The canonical identity remains the account's email for login and forgotten-password recovery. An invalid email form cannot become an account identity.

### REQ-RULE-CREDENTIAL-2 Apply the Password Length Rule

Every initial, changed, or recovered password must contain from 8 through 128 characters, inclusive. The product evaluates the password exactly as submitted and does not trim it.

The rule imposes no separate uppercase, lowercase, digit, symbol, or character-class requirement. A value below 8 or above 128 characters is refused and leaves account, credential, and session state unchanged.

### REQ-RULE-CREDENTIAL-3 Conceal Login Credential Failure

When a submitted email-and-password pair does not authenticate an account, login returns one invalid-credentials outcome and creates no session. The same outcome applies to an unknown canonical email and to an incorrect password.

The result reveals neither whether the email is registered nor which credential failed. Repeated failure changes no account, profile, Todo, history, trash, credential, or session information.

### REQ-RULE-CREDENTIAL-4 Secure Credential Replacement

Password change requires the correct current password and a different new password. Forgotten-password recovery instead requires proven control of the registered email identity and does not require the old password. In both cases, the proposed replacement must satisfy the 8-through-128-character rule.

On success, only the new password authenticates future login and every session issued before replacement loses authority. Failed action-specific proof or an invalid proposed password leaves the prior credential and every current session unchanged.

## REQ-RULE-PROFILE Display Name Rules

A display name gives the private profile a readable identity but does not function as a login name or a public handle. The same acceptance rule applies when registration creates the profile and when the account holder edits it later.

Whitespace is normalized for meaningful presentation, length is bounded, and duplicate names remain valid because account ownership, rather than display text, determines identity and authority.

### REQ-RULE-PROFILE-1 Validate Private Display Names

Leading and trailing whitespace is removed from a proposed display name. The remaining value must contain from 1 through 100 characters, inclusive; a whitespace-only value therefore has no accepted name.

Different accounts may use the same display name. A duplicate name does not link profiles, grant authority, expose another user's account, or make another profile discoverable.

Registration or editing refuses a trimmed name above 100 characters or with no characters. A refused edit preserves the profile's current display name.

## REQ-RULE-CONTENT Todo Content and Date Rules

Todo content retains the source's required-title and optional-description distinction while giving both values clear acceptance boundaries. The same rules apply at creation and after an edit.

Start and due values remain independently optional calendar dates. Their relationship is evaluated only when both are present, so leaving either value empty stays valid while a complete pair describes a coherent planning interval.

### REQ-RULE-CONTENT-1 Validate Todo Title and Description

Leading and trailing whitespace is removed from a proposed title. The remaining title must contain from 1 through 200 characters, inclusive.

Description remains optional and may be omitted or empty. When present, it may contain up to 10,000 characters, inclusive.

The same boundaries apply to creation and editing. A whitespace-only or over-200-character title, or an over-10,000-character description, is refused. A refused edit preserves the prior Todo and creates no history entry.

### REQ-RULE-CONTENT-2 Validate Todo Planning Dates

Start date and due date are independently optional. A Todo with neither date, only a start date, or only a due date is valid.

When both calendar dates are present, the due date must be the same as or later than the start date. Equal dates are valid. Creation and editing evaluate the resulting pair after supplied changes, including after one date is cleared.

A pair with a due date earlier than its start date is refused. A refused edit preserves both prior dates and creates no history entry.

## REQ-RULE-BROWSE Todo Browsing Rules

Active and trash lists share bounded, one-based pagination so users receive predictable pages and navigation totals. Their content controls differ: active browsing has `all`, `complete-only`, and `incomplete-only` filters plus creation, start, and due date sorting in both directions, while trash keeps its recovery-focused newest-deleted order.

Creation ordering supports newest-first and oldest-first; start and due ordering support earliest-first and latest-first. An empty start or due date always follows dated tasks. Defaults and tie-breakers establish one complete order before pagination, preventing unchanged requests from moving equal-key items between pages.

### REQ-RULE-BROWSE-1 Bound Todo List Pagination

Active and trash lists use page numbers beginning at 1. An omitted page number selects page 1.

Page size accepts values from 1 through 100, inclusive, and defaults to 20 when omitted. Each result reports the total matching item count and total page count together with the current page items.

Ownership, active-or-trash scope, and any active-list completion filter are applied before totals and page boundaries are calculated. A page beyond the final page returns an empty item list with the correct totals.

A page number below 1 or a page size below 1 or above 100 is refused.

### REQ-RULE-BROWSE-2 Filter Active Todos by Completion

The active list accepts exactly these completion scopes:

| Filter | Included active todos |
| --- | --- |
| `all` | Both `complete` and `incomplete` todos. |
| `complete-only` | Only todos whose completion status is `complete`. |
| `incomplete-only` | Only todos whose completion status is `incomplete`. |

Omitting the filter selects `all`. Filtering never brings trashed or other-owned todos into the candidate list. Any other filter value is refused.

### REQ-RULE-BROWSE-3 Sort Active Todos by Supported Dates

The active list accepts exactly these sort combinations:

| Sort field | Directions |
| --- | --- |
| Creation date | Newest first or oldest first. |
| Start date | Earliest first or latest first. |
| Due date | Earliest first or latest first. |

A todo with no start date follows every todo with a start date in both start-date directions. A todo with no due date follows every todo with a due date in both due-date directions.

Any other sort field or direction is refused.

### REQ-RULE-BROWSE-4 Apply Stable Default and Tie-Break Ordering

When active browsing omits a sort, creation date newest first is used. Trash is always ordered by the most recent trash-entry time, newest first.

Equal selected keys are resolved as follows:

- equal start or due dates use creation date newest first, then stable Todo identity;
- equal creation dates use stable Todo identity; and
- equal trash-entry times use creation date newest first, then stable Todo identity.

The complete order is established before pagination. Repeated requests over unchanged candidates and selections therefore return the same item order.

## REQ-RULE-STATE Todo State, Conflict, and History Rules

Availability determines which Todo operations are meaningful. Active tasks support normal detail, content editing, completion changes, and soft deletion. Trashed tasks support trash detail, restoration, full history viewing, and permanent deletion; full history also remains available while the Todo is active.

Completion retries receive a safe no-change result. Content edits use a stricter boundary because each success creates history: the request must make a real current-content change and must not overwrite a newer accepted edit. The resulting history is an immutable chronology until terminal deletion.

### REQ-RULE-STATE-1 Qualify Operations by Todo Availability

Only an `active` Todo is eligible for normal detail, content editing, mark complete, mark incomplete, and soft deletion. Only a `trashed` Todo is eligible for trash detail, restoration, and permanent deletion.

Active browsing includes only active Todos, and trash browsing includes only trashed Todos. Full edit history remains viewable for an owned Todo in either retained state.

A state-ineligible command is refused without changing the Todo or history. A permanently deleted Todo is eligible for no detail, history, change, restore, or deletion action.

### REQ-RULE-STATE-2 Make Repeated Completion Requests Idempotent

For an owned active Todo, requesting `complete` when status is already `complete` succeeds without another transition. Requesting `incomplete` when status is already `incomplete` has the same successful no-change result.

Each result preserves the current completion value and every other Todo and history fact. Neither creates a content-edit history entry. Ownership and active-state qualification are applied before repeat handling.

### REQ-RULE-STATE-3 Refuse No-Op and Stale Content Edits

A content-edit request must supply at least one title, description, start-date, or due-date value that differs from the Todo's current content. A no-op request is refused and creates no history entry.

An edit is also refused when another content edit accepted after the user began editing makes the request stale. The refusal preserves the newer accepted Todo and history; the user can reload the current detail and history before submitting a new edit.

Invalid content, wrong availability, and ownership mismatches remain separate refusals. Every refused edit leaves both Todo content and edit history unchanged.

### REQ-RULE-STATE-4 Create Immutable Content Edit History

Each successful content edit creates exactly one immutable history entry with its edit time and changed-to values. If one edit changes several fields, those values remain together in that one entry.

A successful edit never modifies or removes an earlier entry. Mark complete, mark incomplete, soft delete, and restore create no content-edit history entry. A refused content edit also creates none.

History remains immutable while its Todo exists. Permanent deletion of the Todo or account removes history through the terminal deletion rules rather than changing an existing entry.
