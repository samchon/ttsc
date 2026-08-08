# Domain Model

This document defines the platform's business concepts, their reader-visible information, relationships, and lifecycle states. Commands and validation refusals are owned by the functional and business-rule documents.

## REQ-DOM-PROFILE User Profile Model

Every account owns one public profile. Its display name, biography, and avatar describe the user without replacing the unique username. The same page aggregates one signed karma total and all currently available posts and comments authored by that user. Registration supplies usable initial profile values before any edit.

### REQ-DOM-PROFILE-001 Define Public Profile Attributes

A public profile presents the account's username together with three editable attributes:

- **Display name:** public presentation text that may differ from, but never replaces, the unique username.
- **Bio:** public free-form text that may be empty.
- **Avatar:** an optional upload governed by REQ-RULE-MEDIA.

Email address, password, and recovery proof are private account information and never profile attributes.

### REQ-DOM-PROFILE-002 Relate Profiles to Karma and Authored Content

The profile shows the user's single signed karma total, which may be negative under the Karma model.

It also lists every currently available post and comment attributed to the user across all communities and posts. Deleted posts and deleted comment content no longer appear in either authored list.

### REQ-DOM-PROFILE-003 Establish Initial Profile Values

Successful registration creates a profile whose display name equals the selected username, whose bio is empty, and whose avatar is absent.

The display name and username make the new profile understandable even without an avatar. The user may later change all three profile fields without changing the username.

## REQ-DOM-COMMUNITY Community Model

A community is a public discussion scope identified by its unique name, description, and icon. Active communities have one owner, current subscriptions, and community-scoped content and moderation relationships. Subscriber count is derived only from active subscriptions. Public community information remains separate from private reports, bans, and moderation history.

### REQ-DOM-COMMUNITY-001 Define Community Attributes

The public community catalog contains:

- **Name:** the stable, unique public identifier used in discovery and content attribution.
- **Description:** public text explaining the community's topic or purpose.
- **Icon:** a public upload governed by REQ-RULE-MEDIA.
- **Status:** active, or archived when participation has permanently ended.
- **Subscriber count:** the current active-subscription total.

An archived community displays its status so a reader can distinguish a readable archive from a participation-capable community.

### REQ-DOM-COMMUNITY-002 Relate a Community to Its Owner

An active community identifies one current owner whose highest authority applies only within that community. The creator is the first owner.

Owner deletion follows REQ-DOM-COMMUNITY-LIFE for automatic succession or archival. No ownership relationship grants authority over another community.

### REQ-DOM-COMMUNITY-003 Relate Communities to Subscribers

The subscriber count equals the number of active user-community subscriptions. Each user contributes at most one active subscription.

Subscribing and unsubscribing adjust the displayed total. Owner or moderator status without an active subscription contributes nothing to that count.

### REQ-DOM-COMMUNITY-004 Relate Communities to Content and Moderation

Every post belongs directly to one community, and every comment belongs to that same community through its post. A content report belongs to the community of its target.

Bans, owner assignments, and moderator assignments apply to one community only. Public community viewing never exposes report reasons, reporter identities, ban history, or resolved moderation history.

## REQ-DOM-SUBSCRIPTION Subscription Lifecycle

A subscription is one active relationship between a user and a community. It controls subscriber count, home-feed inclusion, and post eligibility without limiting public viewing. Starting or ending it leaves moderation roles and past participation independent.

### REQ-DOM-SUBSCRIPTION-001 Establish Active Subscription State

Successful subscription creates one active relationship for the user-community pair. It adds one to subscriber count, includes the community in the user's home feed, and satisfies the subscription part of post eligibility.

The relationship does not grant owner or moderator authority. Existing content, votes, reports, bans, and role assignments remain unchanged.

### REQ-DOM-SUBSCRIPTION-002 End Active Subscription State

Unsubscribing ends the active relationship. The user no longer contributes to subscriber count, receives the community in the home feed, or qualifies to create a post through subscription.

Previously authored posts and comments remain available unless separately deleted. Votes and reports remain attributed while their account and target exist. Owner or moderator authority is unchanged. A later eligible subscription may establish a new active relationship.

## REQ-DOM-COMMUNITY-LIFE Community Ownership Lifecycle

An active community has exactly one owner with the highest authority in that scope. If account deletion removes that owner, succession first considers current moderators and then current subscribers. When nobody can succeed, the community preserves other users' content as a permanent public archive. Archived communities remain readable but no longer accept participation or moderation changes.

### REQ-DOM-COMMUNITY-LIFE-001 Maintain Active Community Ownership

Every active community identifies exactly one active user as its current owner. The creator is the first owner, and that authority applies only inside the created community.

An active community cannot have two simultaneous owners or remain without an owner while it accepts subscriptions, content, or role changes.

### REQ-DOM-COMMUNITY-LIFE-002 Transfer Ownership After Owner Deletion

When the current owner's account is deleted, ownership transfers automatically if another eligible user exists. The longest-serving current moderator succeeds first. If there is no current moderator, the longest-serving current subscriber succeeds.

Moderator tenure begins with the current moderator assignment; subscriber tenure begins with the current subscription. An exact tenure tie is broken by deterministic user-identifier order. The successor must be active, cannot be the deleting owner, and retains any moderator or subscriber relationship already held.

### REQ-DOM-COMMUNITY-LIFE-003 Archive an Ownerless Community

If owner deletion leaves no other active moderator or subscriber, the community changes permanently from active to archived after the deleting owner's posts and comments are removed.

The name, description, icon, and content authored by other users remain publicly viewable. No user receives owner or moderator authority, and the subscriber count reflects removal of the deleted owner's subscription.

### REQ-DOM-COMMUNITY-LIFE-004 Enforce Archived Community Read-Only State

An archived community remains in public community browse and name-search results with an archived indicator. Readers may open its feed, posts, and comment threads.

The platform refuses new subscriptions, posts, comments, votes, reports, bans, unbans, and role changes. Any residual subscriber may still unsubscribe to remove the archived community from their home feed; that is the only state-changing exception.

## REQ-DOM-POST Post Model

A post belongs permanently to one author and one community and preserves its original creation time. Its required title accompanies exactly one text, link, or image payload. Vote score and comment count summarize active participation. Direct and feed views present the same post identity at different levels of detail.

### REQ-DOM-POST-001 Define Post Identity and Relationships

Every post has a required title, one author, one community, and an original creation time. Direct views and feed cards show the title, the author's public username, and the community's unique name.

Editing never changes author, community, or original creation time. Those relationships continue to identify the same post throughout its active lifetime.

### REQ-DOM-POST-002 Define Post Types and Payloads

Each post has exactly one of these types:

| Type | Full payload |
| --- | --- |
| Text | Text content |
| Link | URL |
| Image | Uploaded image |

A post never contains several type-specific payloads at once.

### REQ-DOM-POST-003 Define Post Participation Measures

The vote score is the number of active upvotes minus the number of active downvotes.

The comment count includes every currently available top-level comment and reply on the post. Deleted comment content does not contribute, even when a neutral placeholder preserves the position of its descendant replies.

### REQ-DOM-POST-004 Define Full and Feed Post Presentation

A direct view shows the post's title, full text, URL, or image payload, author, community, vote score, comment count, and original creation time.

Every feed card shows title, author username, community name, vote score, comment count, and relative time since creation. Its type-specific preview is:

- the first 200 characters of text for a text post;
- a thumbnail for an image post; or
- the URL's domain name for a link post.

## REQ-DOM-POST-LIFE Post Lifecycle

A post begins active when creation succeeds. Editing changes reader-facing material while preserving identity and participation. Deletion removes the post everywhere and transitively resolves comments, votes, reports, and karma contributions that cannot exist without it.

### REQ-DOM-POST-LIFE-001 Preserve Post Identity During Editing

A successful author edit may change only the title and the payload belonging to the current post type. The author, community, type, original creation time, votes, comments, and reports remain associated with the same post.

Profiles, feeds, direct links, and moderation queues continue to identify that post and immediately present its revised title or payload. Existing score and comment count remain attached.

### REQ-DOM-POST-LIFE-002 Delete a Post and Dependent Participation

Deletion may result from the author's command, a community moderator's command, an approved report, or deletion of the author's account. The post then disappears from direct viewing, feeds, community content, and the author's profile and cannot be restored or edited.

Every comment and reply on the post is removed, together with votes and pending reports on the post or those comments. Karma contributions from every removed vote are reversed for the affected post and comment authors.

Resolved moderation history may keep a de-identified record that the action occurred, but it does not expose the removed post or comment content.

## REQ-DOM-COMMENT Comment Model

A comment belongs to one author and one post and displays its text, current vote score, and age. Comments form a recursive tree: top-level comments attach directly to the post, while replies attach to one comment on the same post. There is no product-imposed nesting limit.

### REQ-DOM-COMMENT-001 Define Comment Identity and Display

An available comment shows the author's public username, comment text, current vote score, and relative time since its original creation. The score follows the same active-upvotes-minus-active-downvotes formula as a post.

The post relationship and original creation time remain fixed through edits. Nested replies are relationships beneath the comment, not part of its text.

### REQ-DOM-COMMENT-002 Relate Comments Through Unbounded Nesting

A top-level comment has no parent. Each reply has one immediate parent comment on the same post and remains part of that post's thread.

Replies may receive replies recursively with no maximum depth. A thread can traverse every descendant from its top-level comments while preserving each immediate parent-child relationship.

## REQ-DOM-COMMENT-LIFE Comment Lifecycle

A comment begins active after successful creation. Editing changes its text while retaining authorship and thread placement. Deletion removes the author's content and participation, but a neutral placeholder preserves replies written by other users when necessary.

### REQ-DOM-COMMENT-LIFE-001 Preserve Comment Identity During Editing

A successful author edit replaces the comment text. Author, post, parent, original creation time, vote score, nested replies, and report relationships remain attached to the same comment.

The revised text appears immediately in the thread and the author's profile. The comment remains under the same parent and keeps its position according to the selected sibling sort.

### REQ-DOM-COMMENT-LIFE-002 Delete Comment Content and Preserve Replies

Deletion may result from the author, a community moderator, an approved report, account deletion, or deletion of the parent post. The comment's text, profile attribution, votes, and pending reports are removed. Its former vote contributions no longer affect score or author karma, and it no longer contributes to the post's comment count.

When replies written by other users remain, a neutral deleted marker preserves their position and nesting without exposing the removed text or deleted author identity. When no replies remain, the node disappears. Deleting the parent post removes the entire comment subtree rather than placeholders.

## REQ-DOM-VOTE Vote Model

A vote is one user's signed evaluation of one available post or comment. Upvote contributes positive one and downvote contributes negative one. A user-target pair has at most one active value. That value contributes equally to the target's public score and the target author's single karma total.

### REQ-DOM-VOTE-001 Define Vote Identity, Target, and Values

One vote belongs to one user and targets exactly one available post or one available comment. Its active value is:

| Vote | Signed value |
| --- | ---: |
| Upvote | +1 |
| Downvote | -1 |

One user may vote independently on different targets but may hold at most one active value per target. No vote is an absent state, not a third active value. Voting is permitted on any available post or comment, including the voter's own content.

### REQ-DOM-VOTE-002 Relate Active Votes to Content Score

A post or comment score is the sum of all active signed vote values on that target. The result may be positive, zero, or negative.

Changing direction replaces the previous contribution; removal leaves no contribution from that user-target pair. Votes on other targets have no effect.

### REQ-DOM-VOTE-003 Relate Active Votes to Author Karma

An active upvote adds one and an active downvote subtracts one from the karma of the target content's author. Post votes affect post authors; comment votes affect comment authors.

Changing or removing a vote first reverses the old value and then applies any new one. Casting a vote does not otherwise change the voter's karma.

## REQ-DOM-VOTE-LIFE Vote Lifecycle

A user-target pair begins with no vote, may enter upvote or downvote state, may switch between those states, and may return to no vote. Each transition updates target score and author karma together. Repeating the already-current direction or removing an absent vote is a no-change result.

### REQ-DOM-VOTE-LIFE-001 Enter Upvote State

When a user with no active vote casts an upvote on an available post or comment, the pair enters upvote state. Target score and author karma each increase by one immediately.

The pair still has only one vote. The upvote remains until it is changed, removed, or its target or author account is deleted.

### REQ-DOM-VOTE-LIFE-002 Enter Downvote State

When a user with no active vote casts a downvote on an available post or comment, the pair enters downvote state. Target score and author karma each decrease by one immediately.

The pair still has only one vote. The downvote remains until it is changed, removed, or its target or author account is deleted.

### REQ-DOM-VOTE-LIFE-003 Change Active Vote Direction

Casting the opposite direction replaces the current value without creating a second vote:

- upvote to downvote changes target score and author karma by −2;
- downvote to upvote changes both aggregates by +2.

The vote retains the same user and target. Casting the already-active direction makes no state or aggregate change.

### REQ-DOM-VOTE-LIFE-004 Remove an Active Vote

Removing the current vote returns the pair to no-vote state and reverses its contribution:

- removing an upvote changes target score and author karma by −1;
- removing a downvote changes both aggregates by +1.

A later eligible cast may choose either direction. Removing a vote when none exists makes no change.

## REQ-DOM-KARMA Karma Model

Every user has one signed karma total combining current votes received on their available posts and comments. It may fall below zero. Vote creation, direction change, removal, content deletion, and account deletion all adjust the same number through an explicit signed mapping.

### REQ-DOM-KARMA-001 Define the Single Signed Karma Total

Karma equals the sum of all active votes on the user's currently available posts and comments. Post and comment contributions do not form separate balances.

A user with no received active votes has karma zero, and there is no minimum of zero. Votes cast by a user do not directly affect their own total unless the target is that user's own content.

### REQ-DOM-KARMA-002 Define Karma Contribution Mappings

Karma follows these vote-state deltas:

| Transition on the user's content | Karma change |
| --- | ---: |
| No vote → upvote | +1 |
| No vote → downvote | −1 |
| Upvote → downvote | −2 |
| Downvote → upvote | +2 |
| Upvote → no vote | −1 |
| Downvote → no vote | +1 |

Deleting voted content removes every remaining contribution attached to it. Deleting the author account removes the total with the account.

## REQ-DOM-REPORT Content Report Model

A content report records one available post or comment, the reporting user, and a required textual reason. It belongs to the target content's community and appears there as unresolved moderation work. One reporter may have at most one unresolved report for a target, while other reporters and other targets remain independent.

### REQ-DOM-REPORT-001 Define Report Target, Reporter, and Reason

Every report targets exactly one available post or one available comment. It identifies the authenticated user who submitted it and preserves that user's nonblank textual reason.

The report belongs to the target post's community; a comment report derives the same community through the comment's post.

### REQ-DOM-REPORT-002 Relate Unresolved Reports to a Community Queue

An unresolved report appears only in the active moderation queue for the target content's community. Current owners and moderators can inspect the reported content, reporter, and reason together.

Public users and moderators of other communities cannot inspect it. Approval or dismissal removes it from unresolved work.

### REQ-DOM-REPORT-003 Prevent Duplicate Unresolved Reports

One user-target pair has at most one unresolved report. Different users may report the same content, and one user may report different content independently.

After the prior report is resolved, the same user may report a still-available target again with a new reason.

## REQ-DOM-REPORT-LIFE Content Report Lifecycle

A valid report enters unresolved state. Approval deletes its target; dismissal retains the target. Both decisions remove pending work. Resolved outcomes remain only in private community moderation history and never reappear in the active report list.

### REQ-DOM-REPORT-LIFE-001 Enter Unresolved Report State

Successful submission places the report in the target community's active queue with its target, reporter, and reason. It has no approval or dismissal outcome yet, and the target remains publicly available while the report is pending.

If the target is deleted by another action, the unresolved report leaves the queue because no content remains to decide.

### REQ-DOM-REPORT-LIFE-002 Approve a Report and Delete Its Target

When a current owner or moderator approves an unresolved report in their community, the reported post or comment is deleted under its owning lifecycle. Every other unresolved report on the same target also leaves active queues.

Private moderation history records an approved outcome, the acting moderator, and decision time. It does not retain the removed content. A removed report cannot later be approved or dismissed.

### REQ-DOM-REPORT-LIFE-003 Dismiss a Report and Retain Its Target

When a current owner or moderator dismisses an unresolved report, that report leaves the active queue and the reported post or comment remains available. Other unresolved reports on the same target are unchanged.

Private moderation history records a dismissed outcome, the acting moderator, and decision time. The dismissed report cannot return to unresolved state or receive another decision.

### REQ-DOM-REPORT-LIFE-004 Retain Resolved Moderation History

Current owners and moderators may inspect private resolved history for their community. A record shows approved or dismissed outcome, reporter, reason, acting moderator, decision time, and a target description only when the target still exists.

Resolved reports never appear as unresolved work. Removed target content is not retained. If a reporter or moderator account is later deleted, the record remains without identifying that account. Public users and moderators of other communities cannot inspect this history.

## REQ-DOM-BAN Community Ban Lifecycle

A ban is one active user-community participation restriction, independent of subscription and community role records. It blocks new posts and comments in that community but preserves public viewing and existing participation. Unbanning ends only the restriction. Former bans remain private history outside the active banned-user list.

### REQ-DOM-BAN-001 Enter Active Ban State

When a current owner or moderator bans an eligible user, one active ban begins for that user-community pair. It records the acting moderator and activation time for private moderation use.

The banned user cannot create posts or comments in that community but may still browse and view content. Existing content, votes, reports, subscriptions, and roles are not deleted, and no other community is affected.

### REQ-DOM-BAN-002 End Active Ban State

Unbanning ends the active restriction. The user may comment again and, when subscribed, may create posts under the ordinary participation rules.

Unbanning does not subscribe the user or change owner or moderator roles. Existing content and votes remain. Attempting to unban a user with no active ban makes no state change and reports that no active ban existed.

### REQ-DOM-BAN-003 Retain Resolved Ban History

Current owners and moderators can inspect private history showing the formerly banned user, banning moderator, activation time, unbanning moderator, and end time.

Only active bans appear in the current banned-user list, and ended history never blocks participation. Deleted user or moderator accounts are de-identified. Public users and moderators of other communities cannot inspect the history.
