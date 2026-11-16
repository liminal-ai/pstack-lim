### Orchestrate

**You run the program, never the code. Decide which agent does each piece of work, then check what each one produces.** For a standing project handed to one coordinator chat: multi-day, many stacked PRs, dozens to hundreds of subagents, few human turns. One task driven to a predicate is Autonomous run. One ambitious run that needs a bespoke workflow is figure-it-out. Work you would do yourself inside the session's budget is not a program. Work split across workers that each own a unit is one, however small it looks.

Run it with your own tools. Spawn workers with `delegate_task`. Keep the program's state in `orchestrate/<project-slug>/` in the pstack store (the `pstack store` line in the role file). Watch each PR with `watch_pull_request` and a fallback heartbeat, per the Waking and polling section of the role file. Call no scripts, run no polling loops, and never relay messages or status between agents.

#### Topology

- **One implementer per PR at a time.** Only it pushes while it runs. You hold the PR between rounds. Closing or retargeting a base PR orphans every PR above it, so no implementer does it without your call. You never author or edit code. Conflicted merges, chain rebases, and fixes go to implementers.
- **A fresh worker for each independent task.** Its kickoff carries everything it needs, including each upstream report it depends on, pasted in full. Workers can't see their siblings. Pick each subagent's effort for the job, per the Subagents section.
- **A sub-coordinator only when one area has many parallel workers.** It owns that area's workers and kickoffs and sends you one rollup, never raw worker reports. Stop at three levels: you, sub-coordinators, and workers. Keep about ten workers in flight per coordinator, and start the next one as each finishes instead of waiting on a whole batch.
- **Message the worker when new work that is not a fix round needs its built state,** such as its checkout, uncommitted changes, or a running process, because T3 can't fork a worker, and a branch carries no uncommitted changes or running process. Never message one to check on it, because a message restarts an idle agent.
- **Each PR gets a verifier that isn't its author,** on a different model family. Land it per `playbooks/shipping.md`.
- **Start with one unit.** Take it through kickoff, implementer, verifier, and merge before you fan out, so a flaw in the kickoff costs one agent instead of fifty. On near-identical cheap units, the first unit is that test.

#### Supervision

- **Each kickoff names the evidence that proves the work is done,** such as a command and its expected output, a check through the project's verify skill, or an artifact. It also names the goal, the paths the worker may and may not write, and the actions it must not take. If you can't name the evidence, the unit isn't scoped yet.
- **Read the diff or the artifact, not only the worker's summary.** Green CI is an input to a review, not a review. Behavioral work needs more than a type check. A review covers one head SHA, so a new push needs a new review and your acceptance. Read a sample of each sub-coordinator's kickoffs while its workers run, and fix its instructions when one fails.
- **Send back work that drifts from scope or grows past what was asked.** Keep only the fixes that block the program, and park the rest as follow-ups.
- **Check a PR's live state before you report on it,** with `gh pr view` and `gh pr checks` or your forge's equivalents, not the worker's last report. Account for every worker you spawned as done, replaced, or absorbed into another worker's scope.
- **Stop or replace a worker that stalls or loops.** Judge it by its pushes and PR activity, not its status text. Retry by cause: a smaller scope after a context or memory limit, the same kickoff after a dropped connection, and a different model after a tool error. After two retries, drop the unit and replan around it. When a stopped worker returns late, check its result against the PR's current state, and hand any unique findings to a fresh worker.
- **Ask the user only for a real decision or a blocker,** such as an irreversible action, a product or preference call that no experiment settles, or a dead end that survived a replan. Rebase mechanics, retries, CI flakes, review triage, and "should I keep going" never reach the user.

**Reply:** what landed against the goal, each PR's live state, review and acceptance with its link, what was dropped and why, and the decisions waiting on the user.
