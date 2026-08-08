# Actors, Authentication, and Community Authority

This document defines the single credentialed user identity, its credential and session lifecycle, and the roles a user may hold separately inside each community. Public authorship, scoped moderation authority, and private sign-in identity remain distinct even though they belong to the same account.

## REQ-AUTH-REG Account Provisioning and Login

Registration creates one platform account from an email address, password, and globally unique username. The email is the private sign-in identifier; the username is the public identity shown with community content. Authentication starts a user session but does not alter subscriptions or community roles. Identity conflicts and permanent account deletion are resolved before access can be granted.

### REQ-AUTH-REG-001 Register a User Account

Any person may register without an invitation or approval. A successful registration creates an active account from a valid email address, password, and available username.

The email address becomes the account's private sign-in identifier. The username becomes its public identifier on the profile and alongside posts and comments.

Successful registration also starts an authenticated session and creates the user's initial profile as defined in REQ-DOM-PROFILE-003.

### REQ-AUTH-REG-002 Refuse Conflicting Registration

An email address or username reserved by an existing or deleted account is unavailable under the case-insensitive comparisons in REQ-RULE-IDENTITY-001.

The platform refuses the registration, identifies whether the email or username is unavailable, and creates no account, profile, or session. The person may correct the conflicting value and submit again.

### REQ-AUTH-REG-003 Log In With Credentials

An existing active user may log in with the account's email address and password. Email matching follows the case-insensitive sign-in identity.

Successful authentication starts a new session for the same user. The session carries the user's current subscriptions and community-scoped roles; logging in neither grants nor revokes any of them.

### REQ-AUTH-REG-004 Refuse Ineligible Login

Credentials that do not match an active account do not establish a session. An unknown email address, a wrong password, and a permanently deleted account all produce the same neutral authentication failure, so the response does not disclose which condition applied.

The refused attempt does not affect sessions belonging to other accounts. A person who still controls a registered email address may use the password-recovery journey and then try again.

## REQ-AUTH-SESSION Session and Logout Lifecycle

A user may be signed in on several devices through independent sessions. Continuing one session preserves the same account identity while applying current community authority. The user can end only the session in use or revoke every active session. Password recovery and account deletion also revoke all sessions as effects of those account actions.

### REQ-AUTH-SESSION-001 Maintain Concurrent Sessions

Starting a session through registration, login, or later continuation does not terminate the user's other active sessions. Each active session belongs to the same account but can be terminated independently.

Account status and community roles are evaluated from their current state regardless of which session acts. An all-session revocation, completed password recovery, or account deletion may terminate the complete set together.

### REQ-AUTH-SESSION-002 Continue an Authenticated Session

An active user may renew an eligible session without re-entering the password. Renewal preserves the session's user identity and observes any account, subscription, ban, or role changes made since it was last used.

Continuation renews only the presented session; it does not create another concurrent session. A missing or revoked session, or one belonging to a deleted account, cannot be continued and requires an eligible login or recovery path.

### REQ-AUTH-SESSION-003 Log Out the Current Session

An authenticated user may revoke the session currently in use. That session can no longer authenticate or be continued, while every other active session for the account remains usable.

Current-session logout does not change the account, profile, authored content, subscriptions, or community roles. A repeated attempt with the revoked session is unauthenticated and makes no further change.

### REQ-AUTH-SESSION-004 Revoke All Active Sessions

An authenticated user may sign out everywhere. The action revokes every active session for the account, including the session that requested it, and none can subsequently authenticate or be continued.

The account remains active and may log in again. The action does not change profiles, content, subscriptions, community roles, bans, reports, or moderation history.

## REQ-AUTH-MGMT Account Management Lifecycle

Changing a known password and recovering a forgotten one use different authority proofs and have different session effects. Password replacement protects the account from continued use of the former credential. Account deletion is permanent: it removes the user's posts and comments, ends all authority, and resolves dependent participation and community ownership without leaving another user's records attached to the deleted identity.

### REQ-AUTH-MGMT-001 Change the Current Password

An authenticated user may replace the account password by supplying the current password and a different valid new password. A wrong current password or a new password identical to the current one is refused without changing credentials or sessions.

After a successful change, the old password can no longer authenticate. The session making the change remains active, while every other active session for the account is revoked.

### REQ-AUTH-MGMT-002 Recover a Forgotten Password

A user who cannot supply the current password may request one-time recovery proof through the account's registered email address. The request presents the same neutral result whether or not the email identifies an active account.

Only the most recent unused and unexpired proof for an active account can authorize a new password. Completion consumes that proof, replaces the password, revokes every active session, and requires a new login. A missing, used, expired, or superseded proof is refused, and deleted accounts cannot begin or complete recovery.

### REQ-AUTH-MGMT-003 Delete a User Account

An authenticated user may permanently delete their own account after confirming the current password. Failed confirmation leaves the account and all related state unchanged.

Successful deletion revokes every session and removes the profile and every post and comment authored by the user. Votes cast by the user are removed, with affected content scores and author karma adjusted. Subscriptions, moderator assignments, active bans, and unresolved reports belonging to the account are also removed. Resolved moderation history remains available without identifying the deleted user.

Each community owned by the user follows the succession and archival outcomes in REQ-DOM-COMMUNITY-LIFE. Deletion is one complete outcome: if its required authorship, aggregate, or ownership effects cannot finish together, the account remains active.

### REQ-AUTH-MGMT-004 Apply Permanent Deleted-Account Status

After deletion completes, the identity cannot log in, recover a password, reactivate, or perform any authenticated action. The former email address and username stay reserved so a new account cannot impersonate the deleted identity.

The deleted profile is not found. Records belonging to other users may remain, but they do not expose the deleted account's identity. Permanent deletion has no restoration path; the person may register a different account only with different available identifiers.

## REQ-AUTH-ROLE Community-Scoped Authority

Subscriber, moderator, and owner authority belongs to one community and never becomes a platform-wide grade. The creator begins as owner and subscriber. Owner is the highest authority and includes moderator capabilities; current owners and moderators may appoint moderators, while only the owner may remove them. Subscription, moderation, bans, and account status can change independently.

### REQ-AUTH-ROLE-001 Bootstrap Community Owner and Subscriber

Successful community creation makes the creator the community's sole owner and an active subscriber. Owner authority includes the moderator capabilities defined for that community and does not apply anywhere else.

Subscriber status lets the creator post immediately and includes the community in the creator's home feed. These role effects occur together with successful creation.

### REQ-AUTH-ROLE-002 Owner Appointment of Moderators

A community owner may assign that community's moderator role to another active platform user. The target may already be a subscriber or may remain a non-subscriber; moderator authority and subscription are independent.

The role grants moderator actions only inside the owner's community. Selecting an existing moderator succeeds without creating a duplicate assignment or additional authority. A non-owner or deleted target account is refused.

### REQ-AUTH-ROLE-003 Moderator Appointment of Peers

A current community moderator may appoint another active user as moderator in the same community. The caller's moderator authority must still be current when the assignment is made.

The target keeps any existing subscriber status and gains no authority in another community. Reassigning an existing moderator creates no duplicate. A caller without current owner or moderator authority, or a deleted target account, is refused.

### REQ-AUTH-ROLE-004 Owner Removal of Moderators

Only the community owner may revoke another user's moderator role. Revocation immediately ends the former moderator's authority to remove community content, manage bans, inspect or resolve reports, and appoint moderators.

The former moderator's account, subscription, authored content, and roles in other communities remain unchanged. Targeting a user who is not currently a moderator makes no role change and reports that no assignment existed.

### REQ-AUTH-ROLE-005 Protect Owner and Moderator Assignments

The owner role is not a valid target of the moderator-removal action, including when the owner targets themselves. Ownership changes only through the account-deletion succession lifecycle.

A moderator cannot remove their own moderator role or another moderator. Such attempts preserve all scoped roles; only the current owner may revoke moderator authority.
