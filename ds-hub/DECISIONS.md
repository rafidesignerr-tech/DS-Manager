# D.S Hub — Decisions, assumptions and acceptance status

## Open decisions from BRD §16

Defaults follow the BRD's "No by default" wording. Most are one-line changes in `app/config/hub.ts` (`POLICY`).

| Decision | Current behavior | Where to change |
|---|---|---|
| Final product name | "D.S Hub" | `HUB.name` |
| Content taxonomy and page names | Atoms / Molecules / Organisms; sample groups | `ATOMIC_LEVELS`, `reference_group` table |
| Task statuses, priorities | As proposed in BRD §7 | `app/domain/tasks.ts` |
| Fields contributors may edit | Status, progress, blocker reason — on tasks assigned to them | `CONTRIBUTOR_FIELDS` |
| Contributors can mark Done | No. Done is set by a manager after review | `POLICY.contributorCanComplete` |
| Contributors can create changelog drafts | No (they can view drafts) | `POLICY.contributorCanDraftChangelog` |
| Contributors can add internal feedback notes | No (they can view the inbox) | `POLICY.contributorCanAddFeedbackNotes` |
| Notification recipients | Assignee for assignment/status; everyone involved for blocked/unblocked/comments; managers for feedback; all members for publish; never the actor | `taskEventRecipients` in `app/domain/notifications.ts` |
| Email notifications | Not included (in-app only). Email is used only for invitations and password reset | — |
| Due-date reminders | Overdue and due-soon states are shown in every view; no scheduled reminder notifications yet | Would need a scheduled Worker (Cron Trigger) |
| Remove / suspend members | Suspend and reactivate are included (reversible, ends sessions). Permanent removal is not | `app/server/team.server.ts` |
| Mobile task management | Responsive: list, board (horizontal scroll), detail and all actions work on phones | — |
| Portal visibility | Mixed: public reference + private workspace | — |

## Other assumptions made during the build

- **Self-assignment:** allowed on unassigned tasks in Backlog or To do (`POLICY.selfAssignableStatuses`).
- **Contributors can't move tasks to Backlog:** scheduling stays with managers.
- **Comment editing:** authors can edit or delete within 15 minutes; managers always. Deleted comments leave a "deleted" marker so history stays readable.
- **Archive instead of delete** for tasks (BRD §10 retention). Archived tasks are read-only and can be restored.
- **Changelog drafts** can be deleted; published entries must be unpublished first.
- **Board view** uses a "Move to…" control on each card instead of drag and drop. It works with the keyboard and screen readers; Blocked is set from the task page because it needs a reason.
- **Sign-up** happens only through `/setup` (first manager) or a manager's invitation (expires after 7 days).

## MVP acceptance criteria (BRD §15)

| # | Criterion | Status | Verified by |
|---|---|---|---|
| 1 | Public browsing and feedback without an account | Done | e2e: visitor routes, feedback submit, no session cookie |
| 2 | Product Kit "Coming soon", no active actions | Done | Page review |
| 3 | Role-appropriate workspaces after sign-in | Done | Navigation and pages filtered by permission |
| 4 | Managers: tasks, team, feedback triage, changelog | Done | e2e |
| 5 | Contributors: view, self-assign, update permitted fields, comment | Done | e2e |
| 6 | Lifecycle, priority, assignee, timestamps, comments, history | Done | e2e + unit tests |
| 7 | Blocked captures and displays a reason | Done | e2e: rejected without reason, shown with reason |
| 8 | Restrictions enforced on operations, not just UI | Done | e2e: direct POSTs return 403 |
| 9 | Notifications for initial events, linked to records | Done (reminders pending, see above) | e2e |
| 10 | Mark read, find destination | Done | e2e: mark all read; opening marks read and redirects |
| 11 | Private feedback, triage, no public account | Done | e2e |
| 12 | Drafts private, published public | Done | e2e: draft 404 for visitors |
| 13 | Profile image, sign-out, password reset | Done | e2e (sign-out); manual (upload, reset link) |
| 14 | Search, filters, sorting, Atomic view with sample content | Done | Page review |
| 15 | Empty, loading, error, validation, success, access-denied states | Done | Page review |
| 16 | Keyboard usable, WCAG 2.2 AA target | Done for automated checks | axe-core: 0 violations on 24 page/theme combinations; skip link; Radix dialogs |
| 17 | No real inventory added | Done | Seed contains only neutral "Sample …" rows |
| 18 | Only approved libraries | Done | Stack approved in chat; see README |

Automated checks cover a lot of WCAG, not all of it. A manual pass with a screen reader is still worth doing before launch.
