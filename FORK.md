# Fork maintenance: liminal-ai/pstack-lim

Read this file before you merge from upstream, push, open a PR, or merge one.

Fork of `cursor/plugins`, default branch `lim`. Fork point: upstream `11713c6` (pstack 0.15.17). Last synced: upstream `4dd1d05` (pstack 0.15.36), recorded in `FORK-SYNC-LOG.md`. Install only from `pstack/`, never the repo root; for the `/orchestrate` name clash see `poteto-help`. Role-file setup lives in `setup-pstack`.

## Upstream drift

```bash
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/cursor/plugins.git
git fetch --multiple upstream origin
SYNC=4dd1d05   # last synced upstream commit; set it to the new tip after each sync
git log --oneline $SYNC..upstream/main -- pstack cursor-team-kit/skills     # upstream commits since the last sync
git show upstream/main:pstack/.cursor-plugin/plugin.json | rg version        # upstream pstack version
comm -12 <(git diff --name-only $SYNC upstream/main -- pstack | sort) \
         <(git diff --name-only 11713c6 origin/lim -- pstack | sort)        # changed upstream since the sync and in the fork
```

## Copied cursor-team-kit skills

| Skill in pstack-lim | Upstream path | Matching upstream commit | Local edits |
|---|---|---|---|
| `pstack/skills/deslop/SKILL.md` | `cursor-team-kit/skills/deslop/SKILL.md` | `b21ab16`, byte-identical | none |
| `pstack/skills/control-cli/SKILL.md` | `cursor-team-kit/skills/control-cli/SKILL.md` | `d018dc4`, byte-identical at the copy | keeps the harness in the run folder, not `/tmp` (Scratch row) |
| `pstack/skills/control-ui/SKILL.md` | `cursor-team-kit/skills/control-ui/SKILL.md` | `d018dc4`, byte-identical at the copy | drops the `verify-this` pointer, counts T3's browser preview tools, saves screenshots in the run folder (Scratch row) |

Check: `git log --oneline <commit>..upstream/main -- cursor-team-kit/skills/<name>` and `git diff upstream/main:cursor-team-kit/skills/<name>/SKILL.md origin/lim:pstack/skills/<name>/SKILL.md`. To refresh, `git show upstream/main:...` over the copy, re-apply the control-ui edit, put the source commit in the commit message and update this table.

## T3 port intent

pstack upstream is written for Cursor. This fork runs it from T3 Code, where one lead thread delegates across providers (Claude, Codex, Cursor) through T3's own tools. The skills are rewritten in place for T3, not translated at runtime, so an agent reading a skill sees only T3 instructions. Each row is a difference the fork keeps on purpose. When upstream changes text in one of these areas, keep upstream's new idea and express it the fork's way. `scripts/check-t3-port.mjs` enforces the rows it can.

| Area | Upstream says | The fork says | Why |
|---|---|---|---|
| Subagents | Cursor `Task` with `subagent_type`, `readonly`, `environment` | a T3 `delegate_task` child, `mode: "async"`, with an explicit `target` (omitted only when the role line says `auto` or `inherit-parent`) | Only T3's tool reaches every provider from one lead. A child's task can publish its result when its turn ends, before any later wake, so its brief tells it never to end the turn to wait. |
| Model per role | `~/.cursor/rules/pstack-models.mdc`, slugs such as `grok-4.7-xhigh-fast` | the pstack roles block in `~/lim-v2/AGENTS.md`, entries `<providerInstanceId>/<model> <option>=<value>` | Every harness under `~/lim-v2` reads that one file, and T3 takes provider, model and options as separate fields. |
| Speed | a `-fast` slug, used when the job is urgent | Grok and GPT may run fast freely. Claude fast mode only on work the operator names in the session, and only that work. Retries, reviewers, verifiers and later tasks are covered only if the operator names them too. | Grok usage is plentiful. Claude fast mode spends rate limit fast, and a broad reading of one approval gets out of hand. |
| Effort | each spawn raises or lowers the role's effort for the job, up to max | each spawn keeps the role line's effort for judgment, review and design, may lower it for routine work, and never raises it above the role line | A raise spends Claude rate limit per spawn, and the `hardest tasks` line already covers the hardest work, so the role file stays the single source of model choice. |
| Waking | Cursor background agents and polling scripts | T3 `watch_pull_request`, child-completion wakes, and a fallback heartbeat per "Waking and polling" in `~/lim-v2/AGENTS.md`. A child polls within its turn. | A T3 thread that ends its turn is woken only by an event: a PR watch, a child's completion, a `schedule_task` or `t3_thread_send`, or, on Claude and Codex, its own background command finishing. A heartbeat covers what the watch misses. A child can't watch a PR, and a later wake can come after its result. |
| Todo list | the harness's todo tool | a T3 thread workflow, fitted to the task in a handful of steps and ending in a cleanup step, when thread workflows are on. Otherwise the harness's todo tool if it has one, or a checklist file under `todos/` in the pstack store, named in the first message | The operator watches a thread's workflow in T3, and it survives a pause and a pickup. T3's Claude harness has no todo tool, and a file also survives a pause and a pickup. |
| Trunk | `origin/main` | `origin/lim` for pstack itself, the repo's default branch elsewhere | The fork's default branch is `lim`. 55-minute audit ticks re-read playbooks from `origin/lim`. |
| Skill visibility | `disable-model-invocation: true` on leaf skills | every skill visible, its description ending "Use only when the user or another skill names it." The exceptions are `control-cli`, `control-ui`, `deslop` and `setup-pstack`, which load from the user's own wording on purpose. | Hidden skills made Claude's Skill tool refuse them even when poteto-mode named them. |
| Install | Cursor plugin, or a generated Claude Code or Codex tree | one per-user copy in `~/.agents/skills`, linked from `~/.claude/skills`, agents in `~/.agents/agents` | One install serves every provider T3 runs. Skills point at those absolute paths. |
| Visuals | Mermaid diagrams, `/visualize` charts and canvases, generated images, screenshots and videos from Cursor's tools | charts and diagrams on a self-contained HTML page checked with `html_preview` and published with `html_render`, screenshots from the control skill or `preview_snapshot` with `save: true`, recordings from `preview_recording_start` and `preview_recording_stop`, embedded as `![alt](path)` | T3 renders an `html_render` page above the reply and embeds local images and videos by path. It has no `/visualize` or image tool. |
| Scratch | `/tmp` paths for scratch, harnesses, candidate output and screenshots | `<project>/.pstack/runs/<run>/` in the project's main checkout, with `scratch/` and `proof/`, ignored by git; cleanup runs `references/cleanup-protocol.md` against it | `/tmp` filled with tens of gigabytes that nothing tracked, and verdicts cited reports there. A folder per run in the project gives cleanup one place to look and keeps proof out of worktrees. |
| Fix target | upstream issues | a PR to `liminal-ai/pstack-lim` against `lim`, then a reinstall | A broken skill gets fixed in this fork, never worked around. |

## Process changes we keep on purpose

The T3 port table covers how the fork runs pstack on T3. This table covers what the fork changed in pstack's process: how work is verified, accepted, merged and learned from. Each row is a change a retro round decided, and its round folder is `~/.local/state/pstack/retro/rounds/<round>/`, where `decisions.md` holds Lee's words. When upstream changes text in one of these areas, keep upstream's new idea and express it the fork's way, as for the port rows.

| Area | Upstream says | The fork says | Why | Round |
|---|---|---|---|---|
| Merge gate | Shipping step 4 merges with `gh pr merge` or `origin pr merge`, and may arm auto-merge | every merge goes through `merge-gate`, which checks CI, review threads, the review on the exact code, plan boxes, the lead's acceptance, Codex's review and instruction-file approval, and logs a receipt that `merge-gate audit` reads. Never `gh pr merge` or auto-merge. | Agents merged on green CI and their own summaries. A script holds the rule where text did not, and each round reviews how the gate is doing. | 10-17 (#15), 10-20 (#25), 10-26 (#28), 10-29 (#36), 11-06 |
| Instruction files | no rule | the gate refuses a change to any AGENTS.md or CLAUDE.md until Lee approves its exact text in chat and the agent posts the approval line. A sync PR may declare its upstream commit (`pstack-upstream:`), which must be on upstream's default branch and in the PR's history. A file then needs no approval when, mode included, it matches upstream at that commit and its base copy matched upstream at the last sync, so the fork never wrote it (`playbooks/shipping.md` step 4). | Agents changed the instruction files every agent loads without Lee seeing the text. A vendored upstream copy is not the fork's text, and approving it one-off blocked every sync. | 10-17 (#15, #19), 11-06 |
| Verification record | the verifier posts PASS, PASS+NOTES or FAIL | the plan is the record of done. Its verify boxes, by `check-plan.mjs` id, are what a review covers box by box. A skip, deferral or shortcut counts only when the lead accepts it on the gate run. | Done was claimed without the plan's checks, and a skip disappeared into a PASS. | 10-20 (#25), 10-29 (#36) |
| Exact code | compare `git patch-id` at the verdict SHA with the current head | `verdict-hash.sh` over the saved merge base and head | `git patch-id` matched code that runs differently. | 10-17 (#10) |
| Verifier family | one verifier per PR, a Cursor cloud agent that did not write the code | the counterpart of the author's model family, from the role file's Counterparts list, and never the author | A verifier from the author's family shares its blind spots. The author rule is poteto's. The family rule is ours. | 10-17 |
| Review and acceptance | the verifier posts PASS, PASS+NOTES or FAIL, and the run lands on a pass | the verifier posts a `pstack-review:` of box results and issues marked high, medium or low, with repros, and no pass or fail word. The lead judges and posts a `pstack-accept:` with what it checked and a written reason for each high or medium issue or failed box it leaves. The gate merges on both. | Lee: the verifier lists the issues and the lead decides. The fork's rule that only the verifier's next verdict clears a FAIL had made the verifier the acceptor. | 11-06 |
| Rechecks | "Fresh subagents by default", so each recheck is a fresh verifier | a recheck after a fix goes to the same verifier session, told what was done and fixed, with no limit on what it rechecks | A same-session verifier converges with the lead, keeps its cache, and churns less on minor findings. | 11-06 |
| Implementer self-review | no step | a code-writing delegate gets one self-review pass, with a verifier mindset, before the verifier. It fixes only what is obviously wrong and passes the rest along. | Obvious issues cost a verifier round. `baseline-verifier-findings.md` is the baseline the next round measures against. | 11-06 |
| Visual proof | attach videos or screenshots when they prove a claim | a PR that changes something a user can see or use carries before-and-after screenshots or a short video, made by the verifier or the implementer, published per the project's verify skill. The lead opens each one as part of acceptance. Setup-only PRs are exempt. | Lee: screenshots and videos of the change, checked by the lead against the code, are "game changers". | 11-06 |
| Orders to a running owner | no rule for messages to a running owner | orders to a running owner go by `steer`. Owners' reports to the root go by `queue`. | A queued order waits for the owner's turn to end, so it arrived after the owner had moved on. | 11-06 |
| Reflect and retro | reflect routes each learning to a skill edit at once | reflect records what happened, with evidence and a classification, in the pstack store, and applies nothing. A retro round reads several threads' reflects together, and Lee approves the changes. Reflect also judges each written justification the lead made for leaving an issue unfixed. | One thread is too narrow a base for a process change, and Lee wanted a tracked record of what was learned and what changed. The justification review shows where lead judgment holds. | 10-17 (#14), 10-20 (#25), 11-06 |
| Converging a design | interrogate sends adversaries at a design once and keeps only findings a run proved | a big design or plan goes through `references/converge-a-design.md`: reviewers from the `design reviewers` line give feedback, the lead verifies what it didn't know, adopts or pushes back, and goes back and forth with the same reviewers until they converge, then brings it to the operator | The lead makes the rulings and the reviewers inform them. interrogate drops design judgment and has no back-and-forth. | 2026-11-06, after close (Lee's direct ask) |

## Syncing upstream

Always a branch and a PR into `lim`, never a direct push. If many files changed on both sides, expect a re-port rather than a merge. Steps:

1. List upstream's commits since the last sync point (`SYNC` above) in a new `FORK-SYNC-LOG.md` table, one row each, marked take, adapt or skip with a reason. A row skipped in an earlier sync stays skipped unless upstream reworked it. After the last PR merges, set `SYNC` and the "Last synced" line to the new tip. Each sync PR's body declares `pstack-upstream: cursor/plugins@<the upstream commit it syncs to>`, so the merge gate skips upstream instruction files it copies unchanged (`playbooks/shipping.md` step 4).
2. Port by the table above. Assume upstream already handles the concern, keep upstream's new behavior, and change only what a row requires.
3. Run the checks. The drift check fails with a message that names the fix. If the check is wrong, fix the check in the same PR and say why.
4. For each upstream commit, confirm every behavior it claims is in the fork, adapted with the row named, or dropped with the reason logged.
5. Have a reviewer from the other model family read the diff against this section before merging.

```bash
node scripts/check-t3-port.mjs
node --test scripts/check-t3-port.test.mjs
node scripts/check-pstack-docs.mjs
(cd pstack/skills/poteto-mode/scripts && bun install --frozen-lockfile && bun test)
(cd pstack/skills/statechart/scripts && npm install --no-package-lock && npm test)   # Node 22.18+; the TLC tests skip unless TLA2TOOLS and JAVA name the jar and java that mise installs on the first statechart run
```

## Deploying

Installs are copies, so a merge changes nothing until a reinstall. Only the 55-minute audit ticks in autopilot-full, autopilot-stack and multi-phase-plan re-read playbooks from `origin/lim` (`check-plan.mjs` requires plans to include that re-read), so a merge without a reinstall splits running programs between new playbooks and old skills and scripts. Merge through the merge gate (`merge-gate --repo liminal-ai/pstack-lim --pr <n>`, per poteto-mode's Shipping playbook), then reinstall at once on every box: move `PSTACK_LIM_COMMIT` in `~/lim-v2/manifest.env`, run `~/lim-v2/bin/lim-setup` on lim-builder, then `bin/lim-fleet` (steps in `.agents/merge-brief.md`). Verify: `bin/lim-fleet --check`, naming the M5 too. A box without `~/lim-v2` reinstalls with the install steps in `poteto-help` (rsync `pstack/skills/*` into `~/.agents/skills`, link `~/.claude/skills/<name>`, copy `pstack/agents`). Verify: `diff -r pstack/skills/<name> ~/.agents/skills/<name>`.

## bun

Installed for leemoore at `~/.bun/bin/bun`, on `PATH` only through `~/.bash_profile`. The running `t3 serve` process's `PATH` doesn't include it, so shells that skip login init can't find it. Check with `command -v bun` in the shell that will run `watch-pr` or `merge-gate`.
