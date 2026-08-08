# Product-Visible Quality Requirements

This document defines privacy, integrity, continuity, and accessibility outcomes that users and community moderators can rely on while using the product.

## REQ-NFR-PRIVACY Account and Moderation Privacy

Account secrets and private sign-in identity remain separate from public profiles. Pending and resolved moderation information belongs only to the responsible community's current moderators. Those privacy boundaries coexist with the intentionally public profile, community, content, and aggregate reading journeys.

### REQ-NFR-PRIVACY-001 Keep Credentials and Email Private

An email address is visible only to its owning authenticated account. Profiles, posts, comments, community lists, feeds, votes, bans, reports, and moderation history never expose it to another user.

Passwords are never returned after registration, login, change, or recovery. Recovery proof is visible only within the recovery journey and becomes unusable after completion. Neutral login and recovery responses do not reveal whether an email identifies an account.

### REQ-NFR-PRIVACY-002 Keep Moderation Records Community-Private

Pending and resolved reports, report reasons, reporter identities, active and former bans, and moderation actor history are visible only to current owners and moderators of their own community. Losing the scoped role ends access immediately.

Removed content is not retained in history, and deleted account identities are de-identified. Public content shows no report count or pending-report state.

### REQ-NFR-PRIVACY-003 Preserve Public Profiles and Community Content

Available profiles, communities, Popular and Community feeds, posts, comment threads, vote scores, karma, and subscriber counts remain readable to their defined public audiences. Logged-out visitors can use public profiles, community discovery, public feeds, post detail, and comment threads.

Non-subscribers and banned users retain public viewing. Archived communities and their remaining content stay public. Deleted and private information remains unavailable under its own lifecycle or privacy rule.

## REQ-NFR-INTEGRITY Visible Aggregate Integrity

Vote transitions, subscription transitions, comment changes, and deletions affect several reader views at once. After an action completes, every affected score, karma total, count, list, feed, profile, thread, and queue presents one mutually consistent product state.

### REQ-NFR-INTEGRITY-001 Keep Vote Score and Karma Mutually Consistent

After vote creation, direction change, removal, or deletion reversal completes, target score and author karma both reflect the same accepted signed transition. A fresh content or profile view never shows one new value with the other still old.

Same-direction and absent-removal no-ops preserve both values. Negative scores and karma remain valid consistent results.

### REQ-NFR-INTEGRITY-002 Keep Subscription Count and Home Feed Mutually Consistent

Subscribe adds one active relationship to subscriber count, the user's subscription list and Home scope, and posting membership together. Unsubscribe removes the same three effects together.

Duplicate subscribe and absent unsubscribe change none. Creator bootstrap presents count one, Home inclusion, and posting membership together. An unsubscribed owner or moderator affects none of these subscription-derived values.

### REQ-NFR-INTEGRITY-003 Keep Comment Count Consistent With Comment Availability

Each successful top-level comment or reply increments the post comment count once. Deleting comment content decrements it once. A neutral deleted marker contributes zero while its available descendants continue to count.

Failed or refused comment actions make no count change. Post detail and feed cards show the same completed count; deleting the post removes the count with it.

### REQ-NFR-INTEGRITY-004 Keep Deletion Effects Consistent Across Public Views

After account, post, or comment deletion completes, profiles, feeds, direct views, threads, queues, scores, karma, and counts agree on which content and participation remain. Deleted content never remains on one public surface after disappearing from another.

Dependent votes, reports, and authored lists reflect the same outcome. Account deletion completes all cascades and community-ownership effects together or leaves the account active. Neutral markers and de-identified moderation history expose only their explicitly preserved information.

## REQ-NFR-CONTINUITY Browsing Continuity

Paginated lists preserve one traversal meaning from first page to last and provide a visible fresh start when continuation becomes unusable. Nested discussions remain navigable through deletion. Relative-age labels continue to describe immutable creation moments without changing ranking identity.

### REQ-NFR-CONTINUITY-001 Provide Stable Paginated Continuation

A valid continuation preserves list scope, filters, order, page size, and snapshot until the final page. Stable tie fields ensure that equal-ranked root items are not duplicated or skipped.

Each unchanged root item in the snapshot is reachable once before traversal ends. An item deleted during traversal may disappear, but surviving snapshot items retain their order.

### REQ-NFR-CONTINUITY-002 Recover From an Invalid or Stale Continuation

An unknown, stale, or mismatched continuation returns the fresh first page under current inputs, visibly marks the reset, and begins a new snapshot. It never mixes a partial next page with first-page results.

The reader can continue normally from the reset page. Recovery changes no product data or permission. A valid final page has no next continuation rather than triggering a reset.

### REQ-NFR-CONTINUITY-003 Preserve Navigable Reply Structure

Every available reply remains reachable from its post and top-level branch at any depth. Deleting an ancestor preserves the same parent position with a neutral marker; descendants are never promoted to an unrelated parent.

The marker exposes no removed text or identity. Sorting changes only sibling order. Deleting the post removes the complete tree so no orphan branch remains.

### REQ-NFR-CONTINUITY-004 Keep Relative Time Anchored to Creation

Post and comment age labels update as time passes but always derive from the immutable original creation moment. Editing never resets age, and every view of the same item uses that same origin.

Examples such as “3 hours ago” do not impose a fixed unit. New, Top time windows, Hot age, and comment New all use original creation time.

## REQ-NFR-ACCESS Accessible Community Participation

Core public and authenticated journeys remain operable without pointer input and understandable through visible and assistive feedback. Focus, labels, state changes, nesting, color, and imagery all preserve the meaning a participant or moderator needs to complete the journey.

### REQ-NFR-ACCESS-001 Support Keyboard Operation for Core Journeys

Registration, login, recovery, profile editing, community discovery, subscription, post and comment creation or correction, voting, reporting, and moderation controls are reachable and operable by keyboard in a logical focus order.

Nested comments do not trap focus or require hovering. Opening a menu or dialog moves focus into it, and closing returns focus to the invoking control. Unavailable actions are identifiable before activation.

### REQ-NFR-ACCESS-002 Expose Understandable Labels, Focus, and Validation Feedback

Interactive controls present visible focus and meaningful labels associated with their fields. Email, password, username, profile, community, post, comment, report, sort, and moderation inputs are identifiable.

Field-specific validation identifies the affected control and correction. Vote, subscription, report, ban, and deletion outcomes announce their visible state change. Headings and nested comment relationships preserve a logical reading structure.

### REQ-NFR-ACCESS-003 Avoid Color-Only or Image-Only Meaning

Upvote and downvote direction, selected vote state, and score remain distinguishable without color. Post type, archived status, report pending/approved/dismissed state, active ban, and validation errors have text or equivalent semantic meaning.

An absent avatar still shows username and display name; an absent community icon still shows community name; an image post still shows its title. A thumbnail is never the only way to identify or open a post.
