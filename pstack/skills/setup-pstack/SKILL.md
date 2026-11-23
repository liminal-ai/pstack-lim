---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget. Detects your available models and writes the pstack roles section of the role file, which overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write the pstack roles section of the role file, which sets pstack's model per role. The role file is `~/lim-v2/AGENTS.md`. `~/lim-v2/CLAUDE.md`, which Claude Code reads, is a symlink to it. Write `AGENTS.md` by its own path, and never replace the symlink with a regular file. The section is the fenced block under `## pstack roles`. Run this from a v2 thread, so the catalog you detect is v2's.

## Steps

### 1. Detect available models

Call `orchestrator_capabilities`. Every model of a provider instance that can run a child task, with each of its option values, is a target you can pass to `delegate_task`. That is the dependable source. A real entry is `<providerInstanceId>/<model> <option>=<value>`, such as `claudeAgent/claude-opus-5-5 effort=xhigh`. If you cannot detect any, ask the user to paste the entries they have access to. Never write a real entry you have not confirmed is available. The aliases `inherit-parent` and `auto` are always valid even though they are not detected entries.

### 2. Load current state

The default role-to-model mapping is the block shape shown in step 5 below. If the role file already has the block, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from those defaults. A general work-kind line names a kind of work, not a pstack role: `simple code research`, `simple web research`, `x / tech / ai-twitter research`, `deep analysis`, `design / aesthetics`, `writing / drafting`, `computer use, easy`, `computer use, complex`, `computer use, high-volume easy`, `skill / prompt writing`, `skill / prompt review`, or another one Lee added. Keep every general work-kind line as it is. A pstack role line whose role is not in step 5, such as `how critics` or `architect runners`, is from a retired role. Drop it. Never drop a general work-kind line. One value is not a model role, so keep it as it is: a `counterparts` value (it points at the role file's Counterparts table).

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer the harness's ask-the-user tool over free text, or ask in chat when it has none. Offer these three options with these exact labels, and name the current budget when the rule records one. With no rule, say that `medium` matches the step 5 block. No role runs above `xhigh`. Under `medium`, most roles run at `high`, and `hardest tasks`, `design reviewers`, and `skill / prompt review` run at `xhigh`.

- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Build the working table from the step 5 block, and on a re-run keep any role you changed by family, list, or alias (`inherit-parent`, `auto`). Families are the ones Phase A step 3 of the **arena** skill defines, so Fable is its own family. The budget moves pstack role lines only. General work-kind lines keep their values. Each role has a target effort, which is its default's effort moved by the budget on the ladder `xhigh` > `high` > `medium` > `low`. `medium` keeps it, `large` raises it one step, and `small` lowers it one step. No role runs above `xhigh`, and a target at the bottom of the ladder stays there. Most defaults are at `high`, and each budget label names where those land. Set the effort option of every real entry in the role, panel entries included, to the role's target. The effort option is the one the model takes for reasoning (`effort`, `reasoningEffort`, `thinking_level`, or `reasoning_effort`). Other options, such as `fastMode=true` on a Grok entry, stay. If the model does not offer the target value, use its highest value at or below the target, else the same family's detected model that does, else mark the role as needing a choice. `inherit-parent` and `auto` do not change. So `large` turns `claudeAgent/claude-opus-5-5 effort=high` into `effort=xhigh` and `codex/gpt-6.2-sol reasoningEffort=high` into `reasoningEffort=xhigh`, and `hardest tasks` stays at `effort=xhigh`. `small` turns them into `effort=medium` and `reasoningEffort=medium`, and `hardest tasks` into `effort=high`. `antigravity/gemini-4-neon` takes `thinking_level` from `low` to `xhigh`, so `large` writes `thinking_level=xhigh` where its default is `high`.

**(c) Show the roles and confirm.** Show every role with its model, marking any real entry not in the detected set as needing a choice. Also list each line step 2 dropped. Ask whether to accept as-is or change specific roles, offering the detected models at `xhigh` or below plus `inherit-parent` and `auto` (both mean: this role runs on the parent thread's model, with no `target`) as the options. Prefer the harness's ask-the-user tool over free text, or ask in chat when it has none. For panel roles (arena runners, interrogate reviewers, design reviewers) the value is a list, and one subagent runs per entry, alias entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena runs one judge. It tries only values from a vendor other than the parent's, in list order, so order it by preference. Fable and the other Claude models are one vendor. A `counterparts` value resolves through the role file's Counterparts table. An `inherit-parent` or `auto` value never judges. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

### 4. Validate

Every real entry written must be in the detected set, with its provider instance, its model, and each option value, and its effort at `xhigh` or below. `inherit-parent` and `auto` always pass. If a chosen real entry is not available, stop and ask again.

Never write Claude fast mode (`fastMode=true` on any Claude entry), even when the user picks it here. Claude fast mode is approved per task, in a session, per the Speed rule in poteto-mode's Subagents section, so a role line is the wrong place for it. Say so and write the entry without it. Grok entries keep `fastMode=true`, as on the `x / tech / ai-twitter research` line, and GPT entries may carry `serviceTier=priority`.

### 5. Write the block

Show Lee the exact proposed block and wait for Lee's approval of that text before you edit `~/lim-v2/AGENTS.md`, per the role file's rule on agent instruction files. If Lee changes the text, show the new text and wait again. Write the approved block into `~/lim-v2/AGENTS.md` only, with a `# budget` line with the chosen label and its target effort, and one line per role, using the same labels poteto-mode uses. Replace the whole fenced block so re-runs stay idempotent. Leave the rest of the file as it is, including the notes and the Counterparts table under the block, and update a note only where it names a value you changed. Shape:

```
# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent thread's model (omit `target`). Alias entries in a panel list still count toward its fan-out.
# budget: medium (high)
simple code research: claudeAgent/claude-sonnet-5-5 effort=medium
simple web research: codex/gpt-6.1-terra reasoningEffort=medium
x / tech / ai-twitter research: cursor/grok-4.7 reasoning_effort=high fastMode=true
deep analysis: claudeAgent/claude-fable-5-2 effort=high, codex/gpt-6.2-astra reasoningEffort=high
design / aesthetics: claudeAgent/claude-opus-5-5 effort=high
writing / drafting: muse/muse-wonder-full-1.0 reasoningEffort=medium|high
computer use, easy: codex/gpt-6.2-sol reasoningEffort=medium
computer use, complex: codex/gpt-6.2-sol reasoningEffort=high
computer use, high-volume easy: codex/gpt-6.1-terra reasoningEffort=medium

feature, refactoring: claudeAgent/claude-opus-5-5 effort=high
bug-fix: claudeAgent/claude-opus-5-5 effort=high
perf-issue: claudeAgent/claude-opus-5-5 effort=high
hillclimb: claudeAgent/claude-opus-5-5 effort=high
hardest tasks: claudeAgent/claude-opus-5-5 effort=xhigh
judgment and prose: claudeAgent/claude-opus-5-5 effort=high
how explorer: claudeAgent/claude-sonnet-5-5 effort=high
how explainer: claudeAgent/claude-opus-5-5 effort=high
why investigators: codex/gpt-6.1-terra reasoningEffort=high
why synthesizer: claudeAgent/claude-opus-5-5 effort=high
reflect tooling: codex/gpt-6.1-terra reasoningEffort=high
reflect judgment, divergent, synthesizer: claudeAgent/claude-opus-5-5 effort=high
arena runners: claudeAgent/claude-opus-5-5 effort=high, codex/gpt-6.2-sol reasoningEffort=high
interrogate reviewers: claudeAgent/claude-opus-5-5 effort=high, codex/gpt-6.2-sol reasoningEffort=high
design reviewers: codex/gpt-6.2-astra reasoningEffort=xhigh, muse/muse-wonder-full-1.0 reasoningEffort=xhigh
arena cross-judge pool: counterparts
swarm workers: codex/gpt-6.2-sol reasoningEffort=medium, claudeAgent/claude-sonnet-5-5 effort=high
skill / prompt writing: antigravity/gemini-4-neon thinking_level=high
skill / prompt review: muse/muse-wonder-full-1.0 reasoningEffort=xhigh
```

### 6. Confirm

Tell the user the role file was written and that the change applies to new sessions. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, invoke `/create-verification-skill` (resolves wherever pstack is installed: workspace, user, or plugin). On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /create-formal-verification-skill." On yes, invoke `/create-formal-verification-skill` (resolves wherever pstack is installed: workspace, user, or plugin). On no, move on without pushing.
