Build a time tracking web application.

1. Mission
This time tracking application is built for internal use at our company. It serves two audiences. The first is our own team members, many of whom work as freelancers at AirGradient and want honest insight into how they spend their working hours. The second is the company itself, which needs aggregated data to spot inefficiencies and improve how our teams work. The tool is designed so that any one of us would want to use it even if the company never looked at the data.
We interact with the app through a simple workflow: start a timer when beginning a task, stop it when done, tag it with a category, client, or project, then rate the session on flow, energy, and efficiency before flagging any blockers that slowed us down. In the background, the app passively monitors idle time and counts context switches, without ever recording which sites or apps were visited, giving a fuller picture of how a session actually went.
All of this feeds into two dashboards. The personal dashboard gives each of us a detailed view of our own hours, trends, blockers, and session quality over time. That data is always fully exportable and belongs entirely to the person who created it. The company dashboard shows aggregated, process-level patterns across the team, surfacing which categories consume the most time and which blockers cost the most effort, without ranking or exposing anyone's individual performance.
What sets this application apart is Breezy, AirGradient's mascot and the emotional core of the product. Breezy is a living reflection of how we have been working. Breezy encourages focus at the start of a session, celebrates great flow, reminds us to take breaks and stay hydrated, and visually shifts mood based on recent habits. Over time, we can look back through the Breezy Journey, a personal timeline of our working days represented through Breezy's changing mood and air clarity, turning months of work into something calm, visual, and rewarding to revisit.

2. Non-Negotiable Deliverables
- Read this entire specification before coding.
- Save this full specification in the project as `docs/spec.md`.
- Create `docs/milestones.md` and keep it updated throughout the work.
- Implement the full time tracking workflow: start/stop/pause timer, create and categorise tasks, retroactive entries, end-of-session feedback, blocker tagging, idle and context-switch detection, personal and company dashboards, Breezy companion and Journey, medals, and raw data export.
- Honour the dual-aim design rule throughout: the individual sees full, detailed, personal data they can export at any time; the company sees aggregated, process-focused rollups, never individual league tables.
- Run the fastest useful checks and a browser verification loop before reporting done.
- Use one branch named `agentic-timetracker-app`.
- Open exactly one PR with `gh pr create`.
- Update the PR body with milestone status, files changed, checks run, browser verification, and risks.
- Report the PR link in the final response.
- Do not stop after implementation if docs, milestones, commits, push, PR, PR body, or verification steps remain.

3. Before Coding Checklist
- Read the full spec from top to bottom.
- Inspect the project structure and existing files.
- Read `AGENTS.md` if it exists.
- If `AGENTS.md` does not exist, create a short one using these rules: inspect first, keep architecture simple, verify with the fastest useful checks, and report evidence.
- Review this spec as a skeptical senior engineer before implementation.
- Identify missing context, risky assumptions, edge cases, unclear requirements, and missing data/auth/API details.
- Propose a short implementation plan and then implement unless a real blocker prevents progress.
- If GitHub context exists, read relevant issues or PR comments with `gh` before implementation and again before verification.

4. Product Requirements
- Target users:
  - Individual team member or freelancer tracking their own working hours and reflecting on their week.
  - Company viewing aggregated, anonymised process insight across the team.
  - AirGradient Employee and freelancer who have their @airgradient.com email.
- Core workflow:
  1. User signs in.
  2. User lands on the personal dashboard summarising recent activity and Breezy's current mood.
  3. User creates or selects a task, optionally tagging it with category, client, or project.
  4. User starts the timer (or adds a retroactive entry if they forgot).
  5. App passively tracks idle time and counts context switches in the background.
  6. User pauses, resumes, or stops the timer.
  7. On stop, user fills in a short skippable feedback form (flow, efficiency, energy, optional note) and selects any blockers.
  8. Breezy reacts to the session and the day rolls up into a Breezy day.
  9. User views the personal or company dashboard, the Breezy Journey, and their medal collection.
  10. User can export their raw data to CSV or JSON at any time.
- Functional requirements:
  - Start, stop, pause, and resume a timer attached to a task, with live elapsed-time display.
  - Create a task with title, description, category, optional client/project, optional time estimate, owner.
  - Editable category set, defaulting to Deep work, Meeting, Admin, Comms, Research, Other, with user-defined additions that persist for future use.
  - Share tasks across multiple signed-in users with combined effort, per-contributor breakdown, and a simple "who is tracking now" indicator.
  - History log of previous time entries that can be edited.
  - User accounts with sign up and sign in; data is scoped per user; shared tasks span users.
  - User profile page where each person selects their team (for example COMMS, Hardware, Software) for team-level rollups.
  - User fill in their estimate time for the tasks.
  - User time the tasks and recorded as actual time.
  - End-of-session feedback form, skippable, storing discrete fields:
    - Flow quality: Great flow / Neutral / Friction
    - Efficiency feel: Felt efficient / Felt manual / Felt wasteful
    - Energy: High / OK / Drained
    - Optional free-text note
  - Multi-select blocker tagging on a session: Waiting on someone, Tool was slow or broke, Unclear requirements, Interruptions, Context switching, Meetings overran, None.
  - Automatic tracking:
    - Idle detection with configurable threshold (default 5 min) offering keep / discard / split-as-break on return.
    - Context-switch counting via tab visibility (count switches only, never log which sites or apps).
  - Retroactive entry: add or edit a task or session after the fact; manual entries are flagged.
  - Personal dashboard and company dashboard (see section 6).
  - Breezy companion, Breezy Journey, and medals (see section 6).
  - Raw data export to CSV and JSON including tags, categories, client/project, feedback, blockers, durations, idle seconds, context switches, location label, and manual flag.
  - Authenticate only with airgradient email
- Out of scope for this build:
  - Billable hours, hourly rates, earnings, salary rates, and client billing logic.
  - Individual performance ranking on the company dashboard.

5. Technical Requirements
- Build as a Nuxt 3 + Vue 3 + TypeScript web application with a Nitro server API.
- PostgreSQL database accessed via Prisma or Drizzle, with migrations checked in.
- Session or JWT authentication.
- Use a Vue chart library for dashboards.
- Optional free LLM API for the AI Insights panel; the route must degrade cleanly when no key is configured.
- If the repository is empty, scaffold a new Nuxt 3 app.
- Use the existing package manager and scripts if present.
- Use plain Vue components and CSS unless Nuxt UI or another AirGradient-approved component library is already configured.
- Provide `.env.example` and seed/demo data (multiple users across teams, varied categories, feedback, blockers, sessions across recent weeks) so dashboards and the Breezy Journey look populated on first run.
- Add indexes on `time_entries(user_id, started_at)` and `time_entries(task_id)`.
- Keep the architecture simple, readable, and scoped.
- Do not add new dependencies unless clearly justified.
- Do not create a marketing landing page.
- Do not include explanatory in-app text about AI or the hackathon.
- Do not change unrelated files.

6. UI/UX Requirements
- The app should feel like a focused AirGradient internal productivity tool, calm and rewarding rather than gamified or guilt-tripping.
- Show account on the top right corner.
- Keep the app minimal.
- Two theme light, dark mode.
- UI use "Take a Break" instead of pause.
- Action button to toggle between individual and company dashboard.
- Each categories have their icon.
- Use the AirGradient visual style:
  - Catamaran/Cabin font stack if available,
  - AirGradient blue #1C75BC,
  - dark grey #212121,
  - orange #FC7E10,
  - light blue surface #D4ECFF,
  - clean white and light-blue surfaces.
- Keep UI responsive for mobile and desktop.
- Top-level layout:
  - Header with current task, live timer, and Breezy's current mood.
  - Main timer card with start / stop / pause / resume controls function in one or two button and category selector.
  - Tabs or sections for Personal dashboard, Company dashboard, Breezy Journey, Medals, History, Settings, Profile.
- Personal dashboard (for the individual / freelancer):
  - Your hours: total, by task, by category, by day.
  - Flow / efficiency / energy distribution and blocker patterns.
  - Estimate vs actual and week-on-week trend so the person can improve their own week.
  - Breezy's current mood and a link into the Breezy Journey.
  - Medal collection summary.
- Company dashboard (aggregated, process improvement):
  - Aggregated time by category and blocker frequency ranking (by count and by associated time).
  - Aggregated flow/efficiency distribution and context-switch rate trends.
  - Trends over time so a process change can be judged.
  - Team filter (COMMS, Hardware, Software, etc.) so blockers can be inspected per team.
  - Lean toward team-level rollups rather than ranking individuals. Shared-task per-contributor time is fine since it is opt-in and collaborative.
- Breezy companion:
  - Reusable Vue component, expressive SVG character with states: idle, happy, cheering, waving, sipping water, sleepy.
  - Non-blocking toast/notification system, tasteful, easy to mute (Breezy: quiet / gentle / chatty, plus global mute).
  - Mood reflects recent habits (breaks, feedback, great-flow sessions, steady tracking); rough patches leave Breezy hazier but never guilt-tripping.
  - Short motivating line on session start; light "you're in the zone" encouragement during long focused stretches.
  - "Take a Break" button: Breezy pops up with a supportive line, e.g. "Don't forget to drink water while you take a break."
  - Ventilation/air nudges: on a configurable cadence (default ~90 min of tracked time) Breezy reminds the user to open a window.
  - Praise: a "Great flow" session triggers a small celebration from Breezy.
- The Breezy Journey:
  - Calendar or timeline of Breezy days across weeks and months.
  - Each day with meaningful tracked work records a Breezy day: a snapshot of Breezy's mood / air clarity derived from hours plus healthy habits (breaks, feedback, great-flow sessions).
  - Time axis is shown in month names (e.g. March, April, May) with one data point per week. Do not use -1w / -2w style labels.
  - Use a single visualisation style; do not stack sprouts, saplings, and rings views.
  - Should feel calm, personal, and rewarding.
  - Roadmap with brezzy mood to represent user performance.
- Medals / collection:
  - Extendable badge set; adding a new medal is a config change, not a code rewrite.
  - Categories: time-based, team-based, consistency-based (Breezy days), topic-based, air-and-clarity, rhythm-and-rest, focus, honesty-and-self-knowledge, and Breezy milestones.
  - Examples: In the Zone, Fresh Air, Honest Reviewer, Steady Breeze, Hydrated, Clear Skies, Blue Sky Day, Cleared the Haze, Deep Breath, Well Watered, Sustainable Pace, Single-Tasker, Flow State, Straight Shooter, Pattern Spotter, Took Stock, Breezy's Best Day.
  - Users can browse their collection.
- Empty states:
  - No tasks yet: "Start your first task. Breezy is ready when you are."
  - No sessions today: "No tracked time yet today. Add a task to begin."
  - No blockers this week: "Clear skies — no blockers logged this week."
  - No medals yet: "Your first medal is on its way."
- Validation:
  - Cannot start a timer without a task selected.
  - Manual or retroactive entries require start and end times where end > start.
  - Editing to an empty task title keeps the previous title and exits edit mode.

7. ASCII Mockup

Main Timer View (Today):
+-----------------------------------------------------------------+
| AirGradient Time Tracker            [theme] [mute] [user_avatar]|
| [Today] [Journey] [Medals] [History] [Settings]   [Personal/Co] |
+-----------------------------------------------------------------+
| Today                                  Breezy: happy  (^_^)     |
| Keep the breeze going. One task at a time.                      |
|                                                                 |
| Current task                                                    |
| [ (>) Deep work: PCB layout review                         v ]  |
| Category: [ (B) Deep work    v ]                                |
|                                                                 |
|                    00:42:18                                     |
|                                                                 |
|         [   Start / Pause   ]      [   Task Done   ]            |
|                            [ Take a Break ]                     |
|                                                                 |
| Breezy: "You're in the zone, keep going."                       |
|                                                                 |
| Collaborators on this task                                      |
|   USER A   ##########............   42%   (tracking now)        |
|   USER B   ######....................  25%                      |
+-----------------------------------------------------------------+

Category icons legend:
  (B) Deep work    (M) Meeting     (A) Admin
  (C) Comms        (R) Research    (.) Other

Personal Dashboard:
+-----------------------------------------------------------------+
| AirGradient Time Tracker            [theme] [mute] [user_avatar]|
| [Today] [Journey] [Medals] [History] [Settings]   [< Personal >]|
+-----------------------------------------------------------------+
| Your week                              Breezy: clear skies      |
|                                                                 |
| Hours this week           Flow distribution                     |
|   Mon  ####  3.5h            Great flow  ##########  62%        |
|   Tue  #####  4.2h           Neutral     #####       28%        |
|   Wed  ###   2.8h            Friction    ##         10%         |
|   Thu  ######  5.0h                                             |
|   Fri  ####  3.1h          Top blockers this week               |
|                              1. Meetings overran    4x          |
| By category                  2. Interruptions       3x          |
|   (B) Deep work    9.2h      3. Waiting on someone  2x          |
|   (M) Meeting      4.5h                                         |
|   (C) Comms        2.8h    Estimate vs actual                   |
|   (A) Admin        1.6h      On target   ########  72%          |
|                                                                 |
|  -> Open Breezy Journey      -> View Medals (7 earned)          |
+-----------------------------------------------------------------+

Company Dashboard:
+-----------------------------------------------------------------+
| AirGradient Time Tracker            [theme] [mute] [user_avatar]|
| [Today] [Journey] [Medals] [History] [Settings]   [< Company >] |
+-----------------------------------------------------------------+
| Team: [ All v ]  ( COMMS / Hardware / Software / Design )       |
|                                                                 |
| Aggregated time by category       Blocker ranking (by time)     |
|   (B) Deep work    ########       1. Meetings overran    18.5h  |
|   (M) Meeting      ######         2. Tool was slow       12.0h  |
|   (R) Research     ####           3. Unclear reqs         9.2h  |
|   (C) Comms        ###            4. Interruptions        6.8h  |
|                                                                 |
| Flow distribution (team)          Context-switch trend          |
|   Great flow  ######  48%           ./\.    /\.                 |
|   Neutral     ####    35%          /    \./    \./\.            |
|   Friction    ##      17%         (4 weeks, lower is better)    |
+-----------------------------------------------------------------+

History Logs:
+-----------------------------------------------------------------+
| AirGradient Time Tracker            [theme] [mute] [user_avatar]|
| [Today] [Journey] [Medals] [History] [Settings]   [Personal/Co] |
+-----------------------------------------------------------------+
| [Individual] [Team]                                    [Export] |
|                                                                 |
| Today's sessions                                                |
| Cat  Task              Start   End     Duration   Feeling       |
| (B)  PCB layout review 09:15   10:27   1h 12m     Great flow    |
| (M)  Standup           11:00   11:30   0h 30m     Friction      |
|                                                   [Meetings ov.]|
| (C)  Slack + email     13:20   14:05   0h 45m     Neutral       |
| (B)  Firmware bring-up 14:30   16:10   1h 40m     Great flow    |
|                                                                 |
| Yesterday                                                       |
| (R)  Spec review       09:00   10:15   1h 15m     Neutral       |
| (M)  Design sync       14:00   15:00   1h 00m     Great flow    |
+-----------------------------------------------------------------+

Breezy Journey:
+-----------------------------------------------------------------+
| AirGradient Time Tracker            [theme] [mute] [user_avatar]|
| [Today] [Journey] [Medals] [History] [Settings]   [Personal/Co] |
+-----------------------------------------------------------------+
| Your Breezy Journey                                             |
|                                                                 |
|     March          April           May            June          |
|   (^_^) (^_^) (-_-) (^o^) (^_^) (^_^) (>_<) (^_^) (^o^)         |
|     w1    w2    w3    w4    w5    w6    w7    w8    w9          |
|                                                                 |
|   Air clarity over time                                         |
|    100 |        *           *  *                                |
|     75 |  *  *     *  *  *        *                             |
|     50 |              *                                         |
|     25 |                                                        |
|      0 +--------------------------------------                  |
|        Mar   Apr   May   Jun                                    |
|                                                                 |
| "9 clear-air weeks. Breezy is proud of your rhythm."            |
+-----------------------------------------------------------------+

End-of-Session Feedback:
+-----------------------------------------------------------------+
| Session complete. How did it feel? (skippable)                  |
|                                                                 |
| Flow:        ( ) Great flow  ( ) Neutral    ( ) Friction        |
| Efficiency:  ( ) Efficient   ( ) Manual     ( ) Wasteful        |
| Energy:      ( ) High        ( ) OK         ( ) Drained         |
|                                                                 |
| Blockers:    [ ] Waiting on someone  [ ] Tool was slow          |
|              [ ] Unclear requirements   [ ] Interruptions       |
|              [ ] Context switching   [ ] Meetings overran       |
|              [ ] None                                           |
|                                                                 |
| Note: [ optional ........................................... ] |
|                                              [ Skip ]  [ Save ] |
+-----------------------------------------------------------------+

Empty State (no tasks yet):
+-----------------------------------------------------------------+
| AirGradient Time Tracker            [theme] [mute] [user_avatar]|
+-----------------------------------------------------------------+
|                                                                 |
|                          (^_^)                                  |
|                          Breezy                                 |
|                                                                 |
|             Start your first task.                              |
|             Breezy is ready when you are.                       |
|                                                                 |
|                  [ + New task ]                                 |
|                                                                 |
+-----------------------------------------------------------------+


8. Data and Persistence Requirements
- Use PostgreSQL via Prisma or Drizzle with checked-in migrations.
- Schema (extend as needed; add indexes on `time_entries(user_id, started_at)` and `time_entries(task_id)`):
  - `users` — id, email, display_name, password_hash, team, created_at
  - `categories` — id, owner_id (nullable for global), name
  - `clients` — id, name, created_by_user_id, created_at
  - `projects` — id, client_id, name, description, created_by_user_id, created_at
  - `tasks` — id, title, description, category_id, client_id, project_id, estimate_minutes, owner_id, is_shared, is_archived, created_at
  - `task_members` — task_id, user_id
  - `time_entries` — id, task_id, user_id, started_at, ended_at, duration_seconds, is_manual, idle_seconds, context_switches, location_label, created_at
  - `entry_pauses` — id, entry_id, started_at, ended_at, duration_seconds
  - `entry_feedback` — entry_id, flow_quality, efficiency_feel, energy, note
  - `blockers` — id, name, is_default
  - `entry_blockers` — entry_id, blocker_id
  - `settings` — user_id, idle_threshold_minutes, nudge_cadence_minutes, breezy_verbosity, location_enabled, activity_enabled, location_labels
  - `breezy_nudges` — id, user_id, related_entry_id, type, message, shown_at, acknowledged_at
  - `breezy_days` — user_id, date, breezy_mood, air_clarity_score (derived daily roll-up; (user_id, date) unique)
  - `medals` — id, code, name, description
  - `user_medals` — user_id, medal_id, awarded_at
  - `exports` — id, user_id, format, date_from, date_to, exported_at
- Design queries so every dashboard metric in section 6 is a straightforward read.
- Raw data export to CSV and JSON must include tags, categories, client/project, feedback, blockers, durations, idle seconds, context switches, location label, and manual flag.
- Do not store billable, hourly rate, or earnings columns.
- Context-switch tracking must store counts only; never log destination URLs or app names.

9. Accessibility Requirements
- All buttons must have clear labels.
- Timer controls (start, stop, pause, resume) must be keyboard accessible.
- Feedback radio groups and blocker checkboxes must be keyboard accessible and have associated labels.
- Active dashboard tab and active filter must be visually and semantically distinguishable.
- Breezy nudges must be dismissable via keyboard and screen-reader friendly (use polite live regions, not alerts).
- Colour must not be the only signal for flow / energy / efficiency states.
- Respect `prefers-reduced-motion` for Breezy animations.

10. Testing and Verification Requirements
- After implementation, run this loop until checks pass or a real blocker remains:
  Build -> test -> read failures -> fix -> rerun -> report evidence.
- Run the fastest useful checks available in this project.
- If available, run:
  - type check,
  - unit tests,
  - lint,
  - production build,
  - database migration check against a clean database.
- Test layers:
  - Unit tests (Vitest) for: duration calculation, pause handling, idle splitting (keep/discard/break), context-switch counting, estimate-vs-actual, medal-award conditions, and the daily Breezy-day roll-up (mood / air-clarity derivation).
  - Component tests (@nuxt/test-utils + Vue Test Utils) for the timer control and the feedback form (correct fields stored, skippable).
  - API/integration tests for server routes: create task, start/stop entry, retroactive entry, share task, raw export (CSV and JSON shape), and the AI route's no-key fallback.
  - E2E (Playwright) for the core journey: sign in, create and categorise a task, track time, leave feedback and a blocker, see it on the personal dashboard, record a Breezy day, then export data.
- For browser verification, use Chrome DevTools MCP:
  1. Start the dev server with seeded data.
  2. Open the app in Chrome through Chrome DevTools MCP.
  3. Sign in as a seeded user.
  4. Create a categorised task and start the timer.
  5. Pause and resume the timer, then stop it.
  6. Fill in the feedback form and select a blocker.
  7. Verify Breezy reacts and a Breezy day is recorded.
  8. Add a retroactive entry and confirm it is flagged manual.
  9. Open the personal dashboard and confirm hours, flow distribution, blockers, and Breezy mood render.
  10. Open the company dashboard and confirm aggregated category time, blocker ranking, and team filter work.
  11. Open the Breezy Journey and confirm month-labelled timeline with one point per week.
  12. Export data to CSV and JSON and confirm the files include all required fields.
  13. Check the browser console for errors and the network panel for unexpected failed requests.
  14. Take a screenshot of the final working state.
  15. Fix visible UI, runtime, console, or persistence issues before reporting done.
- Acceptance criteria:
  - I can start, stop, and pause a timer attached to a categorised task and see live elapsed time.
  - I can create, categorise, share, and retroactively add tasks; manual entries are flagged.
  - After stopping, I get the structured feedback form (flow / efficiency / energy / note) plus multi-select blockers, stored as discrete fields.
  - Idle time offers keep/discard/break; context switches are counted (without logging which sites or apps).
  - Shared tasks show combined and per-contributor time and who is currently tracking.
  - The personal dashboard shows my hours, flow/efficiency/energy, blockers, estimate-vs-actual, trend, Breezy's mood, and a link to the Breezy Journey.
  - The company dashboard shows aggregated category time, blocker ranking, context-switch trends, and supports a team filter.
  - Breezy encourages focus, reacts to my habits, gives break/hydration/ventilation nudges, praises a great-flow session, awards at least two medals, and can be muted.
  - The Breezy Journey shows my run of Breezy days over time, labelled by month, one point per week, and feels calm and rewarding.
  - The AI Insights panel returns suggestions (personal and company) when a key is present, and degrades cleanly without one.
  - Raw data exports to CSV and JSON with tags, categories, feedback, blockers, durations, idle seconds, context switches, location, and manual flags.
  - The app works on desktop and mobile widths with no console errors during the main workflow.

11. GitHub, PR, and Milestone Workflow
- If this directory is not already a git repository, initialize one with `git init`.
- Add an appropriate `.gitignore` before the first commit (include `.env`, `node_modules`, `.nuxt`, `.output`, build artifacts).
- Never commit secrets, local environment files, build output, or dependency folders.
- Use the GitHub CLI (`gh`) for all GitHub operations.
- If `gh` is not installed or not authenticated, stop and report the missing setup.
- If no git remote exists, create a private GitHub repository named `ag-time-tracker` with:
  `gh repo create ag-time-tracker --private --source=. --remote=origin`
- If a remote already exists, use the existing remote; do not create a second repository.
- Create one working branch named `agentic-timetracker-app`.
- Save this full specification as `docs/spec.md`.
- Create `docs/milestones.md` with the checklist below.
- Keep `docs/milestones.md` updated as work progresses.
- Commit each completed milestone with a concise message such as `chore: initialize app`, `feat: timer and tasks`, `feat: feedback and blockers`, or `test: verify breezy journey`.
- After the first milestone commit, push with:
  `git push -u origin agentic-timetracker-app`
- Open exactly one PR for that branch with `gh pr create`.
- Use that same branch and same PR for the whole project.
- After each completed milestone:
  1. run the fastest relevant check,
  2. update `docs/milestones.md`,
  3. create a git commit,
  4. push the same branch,
  5. update the existing PR body with milestone status, files changed, checks run, browser verification, and remaining risks.
- Before each verification cycle, use `gh` to read relevant repository feedback:
  - `gh issue list`
  - `gh issue view <number> --comments`
  - `gh pr list`
  - `gh pr view <number> --comments`
- Treat actionable GitHub issue or PR comments as implementation and testing context.
- Add relevant comment-derived checks to the current verification cycle.
- When addressing GitHub issue or PR feedback from others, comment back on the relevant issue or PR with what changed, which commit addressed it, and which checks verified it.
- If a milestone cannot be completed, do not fake the checkbox. Record the blocker and missing context in `docs/milestones.md`.
- Do not stop after implementation while documentation, milestone updates, commits, push, PR creation, PR body update, PR comments, or verification remain incomplete.

Milestone checklist for `docs/milestones.md`:
- [ ] M0: Repository initialized, `.gitignore` added, `AGENTS.md` present, full spec saved to `docs/spec.md`, baseline project starts or builds, `.env.example` provided.
- [ ] M1: Nuxt 3 + PostgreSQL + auth scaffolded with AirGradient-style shell, responsive layout, and working start/stop timer writing to `time_entries`.
- [ ] M2: Tasks, editable categories, clients/projects, manual and retroactive entries, history log.
- [ ] M3: End-of-session feedback form and multi-select blocker tagging, stored as discrete fields.
- [ ] M4: Idle detection (keep/discard/break) and context-switch counting; settings page; opt-in location.
- [ ] M5: Personal dashboard (hours, trends, flow/efficiency/energy, blockers, estimate-vs-actual) with seeded data.
- [ ] M6: Company dashboard (aggregated category, blocker ranking, context-switch trends, team filter) and shared tasks with per-contributor time.
- [ ] M7: Breezy companion (mood, encouragement, break/hydration/ventilation nudges, praise), medals, profile page with team selection, and the Breezy Journey (month labels, one point per week, single visualisation).
- [ ] M8: AI Insights panel (personal and company) with graceful no-key fallback.
- [ ] M9: CSV/JSON raw export, accessibility pass, tests across all layers, README with run instructions and demo script.
- [ ] M10: GitHub issue/PR comments reviewed with `gh` and actionable feedback addressed.
- [ ] M11: Chrome DevTools MCP browser verification completed end-to-end, screenshot/evidence captured, PR body updated, final self-review written.

If scope runs short, prioritise the timer, feedback/blockers, the personal dashboard, and the Breezy companion + Breezy Journey, since those carry both halves of the project's purpose, and clearly flag whatever you deferred in `docs/milestones.md` and the PR body.

12. Before Final Response Checklist
- Confirm the entire spec was read and implemented or blockers were recorded.
- Confirm `docs/spec.md` exists and contains this full specification.
- Confirm `docs/milestones.md` exists and reflects current milestone status.
- Confirm all completed milestones were committed.
- Confirm the branch was pushed.
- Confirm exactly one PR was opened with `gh pr create`.
- Confirm the PR body was updated with milestone status, files changed, checks run, browser verification, and risks.
- Confirm GitHub issue/PR comments were reviewed and addressed or recorded.
- Confirm verification commands and browser checks were run, rerun after fixes, and recorded.
- Confirm the README includes a hackathon demo script: sign in, start a task, let Breezy encourage focus, stop and leave "Great flow" plus a blocker, watch Breezy react and record a clear-air day, open the personal dashboard, open the Breezy Journey, switch to the company dashboard, run AI Insights for one personal and one company suggestion, then export the data.
- Confirm the final response includes the PR link.
- If anything above is incomplete, finish it before the final response unless blocked.

13. Expected Final Response Format
Report:
1. What you built.
2. Files changed.
3. Commands run.
4. Verification results.
5. Browser/manual checks performed.
6. GitHub branch and PR link.
7. Milestone status.
8. Remaining risks or known limitations.

If blocked, stop and report:
- what blocked implementation,
- what context is missing,
- the smallest decision needed from a human.
