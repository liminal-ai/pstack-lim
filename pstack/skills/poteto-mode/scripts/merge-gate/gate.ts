import type {
  Check,
  PrNumber,
  Repository,
  ReviewDecision,
} from "../watch-pr/types.ts";

export interface PrRef extends Repository {
  readonly number: PrNumber;
}

export interface PullRequest {
  readonly state: "OPEN" | "CLOSED" | "MERGED";
  readonly isDraft: boolean;
  readonly mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  readonly baseRefName: string;
  readonly headRefOid: string;
  readonly reviewDecision: ReviewDecision;
  readonly autoMergeArmed: boolean;
  readonly body: string;
}

/** `app` is the slug of the GitHub App whose check suite reported a check run; null for a commit status or an app GitHub does not name. */
export type HeadCheck = Check & { readonly app: string | null };

export interface OpenThread {
  readonly author: string | null;
  readonly path: string | null;
  readonly line: number | null;
  readonly body: string;
  readonly url: string | null;
}

export const AUTHOR_ASSOCIATIONS = [
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
  "CONTRIBUTOR",
  "FIRST_TIME_CONTRIBUTOR",
  "FIRST_TIMER",
  "MANNEQUIN",
  "NONE",
] as const;
export type AuthorAssociation = (typeof AUTHOR_ASSOCIATIONS)[number];

export interface IssueComment {
  /** GitHub's REST id. It grows with creation order, so it orders comments posted in the same second. */
  readonly id: number;
  readonly author: string;
  readonly isBot: boolean;
  readonly association: AuthorAssociation;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly url: string;
}

export type HashResult =
  | { readonly ok: true; readonly hash: string }
  | { readonly ok: false; readonly detail: string };

export interface IgnoredReview {
  readonly author: string;
  readonly association: AuthorAssociation;
  readonly url: string;
}

export type BoxStatus = "done" | "failed" | "n/a" | "skipped";

/** One `box <id>: <status>. <note>` line under a review. A failed box's note names its issue. */
export interface ReviewBox {
  readonly id: string;
  readonly status: BoxStatus;
  readonly note: string;
}

export interface ReviewShortcut {
  readonly id: string;
  readonly note: string;
}

export const SEVERITIES = ["high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One `issue <n> <severity>: <text>` line under a review. */
export interface ReviewIssue {
  readonly n: number;
  readonly severity: Severity;
  readonly text: string;
}

export interface Accepted {
  readonly id: string;
  readonly reason: string;
}

export interface Deferral {
  readonly id: string;
  readonly owner: string;
}

/** A missing gate check the lead accepts, given as `--waive <check>=<reason>` on the run that merges. */
export interface CheckWaiver {
  readonly check: string;
  readonly reason: string;
}

export interface Acceptances {
  readonly skips: readonly Accepted[];
  readonly deferrals: readonly Deferral[];
  readonly shortcuts: readonly Accepted[];
  readonly checks: readonly CheckWaiver[];
}

/** A plan file and the PR id that ends its section's title, as --plan and --plan-pr or a PR body's pstack-plan line give them. */
export interface PlanRef {
  readonly path: string;
  readonly pr: string;
}

/** The plan the run checks: the one passed, else the one the PR body declares. */
export type PlanFact =
  | { readonly kind: "none" }
  | {
      readonly kind: "read";
      readonly boxes: PlanBoxes;
      readonly declared: boolean;
    }
  | { readonly kind: "declared-missing"; readonly declared: PlanRef }
  | {
      readonly kind: "mismatch";
      readonly declared: PlanRef;
      readonly passed: PlanRef;
    };

/** The required verify boxes of the PR's section in its plan, as check-plan.mjs names them. */
export interface PlanBoxes {
  readonly path: string;
  readonly pr: string;
  readonly ids: readonly string[];
}

export type ReviewFact =
  | {
      readonly kind: "none";
      readonly ignored: readonly IgnoredReview[];
      /** The newest repo-member comment with an old `pstack-verdict:` line, which the gate no longer reads. */
      readonly oldVerdict: string | null;
    }
  | { readonly kind: "malformed"; readonly line: string; readonly url: string }
  | {
      readonly kind: "found";
      readonly head: string;
      readonly base: string;
      readonly by: string;
      readonly url: string;
      readonly recordedHash: HashResult;
      readonly boxes: readonly ReviewBox[];
      readonly unreadBoxLines: readonly string[];
      readonly shortcuts: readonly ReviewShortcut[];
      readonly unreadShortcutLines: readonly string[];
      readonly issues: readonly ReviewIssue[];
      readonly unreadIssueLines: readonly string[];
    };

export type Disposition =
  | { readonly kind: "fixed"; readonly sha: string }
  | { readonly kind: "stands"; readonly why: string }
  | { readonly kind: "deferred"; readonly owner: string; readonly why: string };

export interface IssueDisposition {
  readonly n: number;
  readonly disposition: Disposition;
}

/** A `box <id>: changed. <earlier bar> to <new bar>, <who>, <why>` line, kept as written. */
export interface BarChange {
  readonly id: string;
  readonly change: string;
}

export type AcceptanceFact =
  | { readonly kind: "none" }
  | { readonly kind: "malformed"; readonly line: string; readonly url: string }
  | {
      readonly kind: "found";
      readonly head: string;
      readonly review: string;
      readonly by: string;
      readonly url: string;
      readonly checked: string | null;
      readonly issues: readonly IssueDisposition[];
      readonly bars: readonly BarChange[];
      readonly unreadLines: readonly string[];
    };

/** The upstream commit a sync PR merges, as the PR body's `pstack-upstream: <owner>/<repo>@<sha>` line names it. */
export interface UpstreamRef extends Repository {
  readonly sha: string;
}

/** Changed instruction files whose text at head is the upstream commit's, so they need no approval. */
export interface UpstreamMatch {
  readonly upstream: UpstreamRef;
  readonly paths: readonly string[];
}

/** The AGENTS.md and CLAUDE.md changes, judged against the declared upstream commit when there is one. */
export type InstructionFiles =
  | {
      readonly kind: "changed";
      readonly paths: readonly string[];
      /** Covers `paths` only, never the files that match upstream. */
      readonly approvalHash: string;
      readonly matched: UpstreamMatch | null;
    }
  | { readonly kind: "all-upstream"; readonly matched: UpstreamMatch }
  | {
      readonly kind: "upstream-refused";
      readonly paths: readonly string[];
      readonly upstream: UpstreamRef;
      readonly problem: string;
    };

/** Everything the requirements judge, read once at the PR's current head. */
export interface Facts {
  readonly pr: PrRef;
  readonly defaultBranch: string;
  readonly baseUsesMergeQueue: boolean;
  readonly pull: PullRequest;
  readonly checks: readonly HeadCheck[];
  readonly threads: readonly OpenThread[];
  readonly comments: readonly IssueComment[];
  readonly mergeBase: string;
  readonly currentHash: HashResult;
  readonly review: ReviewFact;
  readonly acceptance: AcceptanceFact;
  readonly plan: PlanFact;
  readonly accepted: Acceptances;
  readonly instructionFiles: InstructionFiles | null;
}

export type Result =
  | {
      readonly met: true;
      readonly note: string;
      readonly details?: readonly string[];
    }
  | {
      readonly met: false;
      readonly missing: string;
      readonly details?: readonly string[];
    };

export interface Requirement {
  readonly name: string;
  /** The id a lead names in `--waive <id>=<reason>`; absent for a check no lead may waive. */
  readonly waiver?: string;
  readonly evaluate: (facts: Facts) => Result;
}

export interface Evaluation {
  readonly name: string;
  readonly waiver?: string;
  readonly result: Result;
}

const REVIEW_PREFIX = "pstack-review:";
const REVIEW_LINE =
  /^pstack-review: head=([0-9a-f]{40}) base=([0-9a-f]{40}) by=(\S+)$/;
const OLD_VERDICT_PREFIX = "pstack-verdict:";
const ACCEPT_PREFIX = "pstack-accept:";
const ACCEPT_LINE = /^pstack-accept: head=([0-9a-f]{40}) review=(\S+) by=(\S+)$/;
export const BOX_ID = /^[a-z]+(?:-\d+)?$/;
const BOX_LINE =
  /^(?:[-*] )?box ([a-z]+(?:-\d+)?): (done|failed|n\/a|skipped)(?:\. (.*))?$/;
const BOX_PREFIX = /^(?:[-*] )?box /;
const CHANGED_BOX = /^(?:[-*] )?box \S+: changed\b/;
const FAILED_NOTE = /^issue (\d+)\b/;
const ISSUE_PREFIX = /^(?:[-*] )?issue /;
const ISSUE_LINE = /^(?:[-*] )?issue (\d+) (high|medium|low): (\S.*)$/;
const CHECKED_LINE = /^(?:[-*] )?checked: (\S.*)$/;
const CHECKED_PREFIX = /^(?:[-*] )?checked:/;
const DISPOSITION_LINE =
  /^(?:[-*] )?issue (\d+): (?:fixed in ([0-9a-f]{7,40})|stands\. (\S.*)|deferred to (\S+?)\. (\S.*))$/;
const BAR_LINE = /^(?:[-*] )?box ([a-z]+(?:-\d+)?): changed\. (\S.* to \S.*, \S.*, \S.*)$/;
export const SHORTCUT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHORTCUT_LINE = /^(?:[-*] )?shortcut ([a-z0-9]+(?:-[a-z0-9]+)*): (\S.*)$/;
const SHORTCUT_PREFIX = /^(?:[-*] )?shortcut\b/i;
export const DEFER_OWNER_FORMS =
  "a Linear id such as LH-215 or an open workflow step as <thread id>/w<n>.<n>";
const LINEAR_ID = /^[A-Z][A-Z0-9]*-\d+$/;
const WORKFLOW_STEP = /^\S+\/w\d+\.\d+$/;
export const isDeferOwner = (owner: string): boolean =>
  LINEAR_ID.test(owner) || WORKFLOW_STEP.test(owner);
const PLAN_PREFIX = "pstack-plan:";
const PLAN_DECLARATION = /^pstack-plan: (\S(?:.*\S)?) pr=(\S+)$/;
const UPSTREAM_PREFIX = "pstack-upstream:";
const UPSTREAM_DECLARATION =
  /^pstack-upstream: ([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)@([0-9a-f]{40})$/;
const APPROVAL_PREFIX = "lee-approves-instruction-files:";
const APPROVED_IN = /^approved-in: \S+$/;
const CODEX_LOGINS = new Set([
  "chatgpt-codex-connector",
  "chatgpt-codex-connector[bot]",
]);
const CODEX_STATE = /<!-- codex-review-state:v1 (\{.*?\}) -->/s;

export const short = (sha: string): string => sha.slice(0, 7);

const lines = (body: string): string[] =>
  body.split(/\r?\n/).map((line) => line.trim());

const readable = (line: string): string =>
  line
    .replace(/\[?!\[[^\]]*\]\([^)]*\)(\]\([^)]*\))?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();

const firstLine = (body: string): string =>
  lines(body)
    .map(readable)
    .find((line) => line !== "")
    ?.slice(0, 120) ?? "(empty comment)";

/** Anyone can comment on a public repo, so a pasted review, acceptance or approval line counts only from someone with a role in it. */
const SPEAKS_FOR_REPO: ReadonlySet<AuthorAssociation> = new Set([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
]);
export const speaksForRepo = (comment: IssueComment): boolean =>
  SPEAKS_FOR_REPO.has(comment.association);

const hasLine = (comment: IssueComment, prefix: string): boolean =>
  lines(comment.body).some((line) => line.startsWith(prefix));
export const hasReviewLine = (comment: IssueComment): boolean =>
  hasLine(comment, REVIEW_PREFIX);
export const hasOldVerdictLine = (comment: IssueComment): boolean =>
  hasLine(comment, OLD_VERDICT_PREFIX);

const isBugbot = (check: HeadCheck): boolean =>
  check.app === "cursor" && check.name.includes("Bugbot");

/** Creation order, not edit time, so editing an old comment never makes it the newest. */
const newestFirst = (a: IssueComment, b: IssueComment): number => b.id - a.id;

/**
 * The most recent comment with a `prefix` line decides; its last such line counts, with the lines below it.
 * An edit can leave an older record and its lines above, and those belong to that older record.
 */
function findRecord(
  comments: readonly IssueComment[],
  prefix: typeof REVIEW_PREFIX | typeof ACCEPT_PREFIX
): {
  readonly line: string;
  readonly below: readonly string[];
  readonly url: string;
} | null {
  for (const comment of [...comments].sort(newestFirst)) {
    const all = lines(comment.body);
    const at = all.findLastIndex((line) => line.startsWith(prefix));
    if (at !== -1)
      return { line: all[at], below: all.slice(at + 1), url: comment.url };
  }
  return null;
}
export const findReview = (comments: readonly IssueComment[]) =>
  findRecord(comments, REVIEW_PREFIX);
export const findAcceptance = (comments: readonly IssueComment[]) =>
  findRecord(comments, ACCEPT_PREFIX);

export function parseReviewBody(below: readonly string[]): {
  readonly boxes: readonly ReviewBox[];
  readonly unreadBoxLines: readonly string[];
  readonly shortcuts: readonly ReviewShortcut[];
  readonly unreadShortcutLines: readonly string[];
  readonly issues: readonly ReviewIssue[];
  readonly unreadIssueLines: readonly string[];
} {
  const boxes: ReviewBox[] = [];
  const unreadBoxLines: string[] = [];
  const shortcuts: ReviewShortcut[] = [];
  const unreadShortcutLines: string[] = [];
  const issues: ReviewIssue[] = [];
  const unreadIssueLines: string[] = [];
  for (const line of below.map(readable)) {
    if (BOX_PREFIX.test(line)) {
      const match = BOX_LINE.exec(line);
      if (match === null) unreadBoxLines.push(line);
      else
        boxes.push({
          id: match[1],
          status: match[2] as BoxStatus,
          note: match[3]?.trim() ?? "",
        });
    } else if (SHORTCUT_PREFIX.test(line)) {
      const match = SHORTCUT_LINE.exec(line);
      if (match === null) unreadShortcutLines.push(line);
      else shortcuts.push({ id: match[1], note: match[2].trim() });
    } else if (ISSUE_PREFIX.test(line)) {
      const match = ISSUE_LINE.exec(line);
      if (match === null) unreadIssueLines.push(line);
      else
        issues.push({
          n: Number(match[1]),
          severity: match[2] as Severity,
          text: match[3].trim(),
        });
    }
  }
  return { boxes, unreadBoxLines, shortcuts, unreadShortcutLines, issues, unreadIssueLines };
}

export function parseReviewLine(line: string): {
  readonly head: string;
  readonly base: string;
  readonly by: string;
} | null {
  const match = REVIEW_LINE.exec(line.replace(/\s+/g, " "));
  return match === null ? null : { head: match[1], base: match[2], by: match[3] };
}

/** The lead's `pstack-accept:` record; null when its first line does not parse. */
export function parseAcceptance(
  line: string,
  below: readonly string[]
): Omit<Extract<AcceptanceFact, { kind: "found" }>, "kind" | "url"> | null {
  const match = ACCEPT_LINE.exec(line.replace(/\s+/g, " "));
  if (match === null) return null;
  let checked: string | null = null;
  const issues: IssueDisposition[] = [];
  const bars: BarChange[] = [];
  const unreadLines: string[] = [];
  for (const entry of below.map(readable)) {
    if (CHECKED_PREFIX.test(entry)) {
      const found = CHECKED_LINE.exec(entry);
      if (found === null) unreadLines.push(entry);
      else checked ??= found[1].trim();
    } else if (ISSUE_PREFIX.test(entry)) {
      const found = DISPOSITION_LINE.exec(entry);
      const disposition: Disposition | null =
        found === null
          ? null
          : found[2] !== undefined
            ? { kind: "fixed", sha: found[2] }
            : found[3] !== undefined
              ? { kind: "stands", why: found[3].trim() }
              : isDeferOwner(found[4])
                ? { kind: "deferred", owner: found[4], why: found[5].trim() }
                : null;
      if (found === null || disposition === null) unreadLines.push(entry);
      else issues.push({ n: Number(found[1]), disposition });
    } else if (BOX_PREFIX.test(entry)) {
      const found = BAR_LINE.exec(entry);
      if (found === null) unreadLines.push(entry);
      else bars.push({ id: found[1], change: found[2].trim() });
    }
  }
  return { head: match[1], review: match[2], by: match[3], checked, issues, bars, unreadLines };
}

/**
 * The PR body's one `pstack-plan: <path> pr=<id>` line; the path may hold spaces. Any line that starts
 * `pstack-plan:`, in a code block or not, counts. Two of them, or one that does not parse, come back as
 * `{ malformed }`, so no declared plan is ever dropped or outranked silently.
 */
export function declaredPlan(
  body: string
): PlanRef | { readonly malformed: string } | null {
  const declared = lines(body).filter((line) => line.startsWith(PLAN_PREFIX));
  if (declared.length === 0) return null;
  if (declared.length > 1)
    return { malformed: `${declared.length} plan lines (${declared.join(" | ")}); a PR declares one plan` };
  const match = PLAN_DECLARATION.exec(declared[0]);
  return match === null ? { malformed: declared[0] } : { path: match[1], pr: match[2] };
}

/** The PR body's one `pstack-upstream: <owner>/<repo>@<40-hex sha>` line, read by the same rules as `declaredPlan`. */
export function declaredUpstream(
  body: string
): UpstreamRef | { readonly malformed: string } | null {
  const declared = lines(body).filter((line) => line.startsWith(UPSTREAM_PREFIX));
  if (declared.length === 0) return null;
  if (declared.length > 1)
    return { malformed: `${declared.length} upstream lines (${declared.join(" | ")}); a PR declares one upstream commit` };
  const match = UPSTREAM_DECLARATION.exec(declared[0]);
  return match === null
    ? { malformed: declared[0] }
    : { owner: match[1], repo: match[2], sha: match[3] };
}

export function strayAcceptances(facts: Facts): string[] {
  const { review, accepted } = facts;
  const notSkipped = (flag: string, ids: readonly string[]): string[] =>
    review.kind !== "found"
      ? []
      : ids
          .filter(
            (id) =>
              !review.boxes.some(
                (box) => box.id === id && box.status === "skipped"
              )
          )
          .map(
            (id) =>
              `${flag} ${id}: the review (${review.url}) does not skip box ${id}`
          );
  const shortcuts =
    review.kind !== "found"
      ? []
      : accepted.shortcuts
          .filter(({ id }) => !review.shortcuts.some((s) => s.id === id))
          .map(
            ({ id }) =>
              `--accept-shortcut ${id}: the review (${review.url}) lists no shortcut ${id}`
          );
  const checks = accepted.checks.flatMap((waiver) => {
    const requirement = REQUIREMENTS.find((r) => r.waiver === waiver.check);
    return requirement === undefined || !requirement.evaluate(facts).met
      ? []
      : [
          `--waive ${waiver.check}: ${requirement.name} is met, so there is nothing to waive`,
        ];
  });
  return [
    ...notSkipped("--accept-skip", accepted.skips.map(({ id }) => id)),
    ...notSkipped("--defer", accepted.deferrals.map(({ id }) => id)),
    ...shortcuts,
    ...checks,
  ];
}

export const isInstructionFile = (path: string): boolean => {
  const name = path.split("/").pop()?.toLowerCase();
  return name === "agents.md" || name === "claude.md";
};

const met = (note: string, details?: readonly string[]): Result => ({
  met: true,
  note,
  ...(details === undefined ? {} : { details }),
});
const unmet = (missing: string, details?: readonly string[]): Result => ({
  met: false,
  missing,
  ...(details === undefined ? {} : { details }),
});

const openAndMergeable: Requirement = {
  name: "Open and mergeable",
  evaluate({ pull, defaultBranch, baseUsesMergeQueue }) {
    if (pull.state === "MERGED")
      return unmet("The PR is already merged. There is nothing to merge.");
    if (pull.state === "CLOSED")
      return unmet("The PR is closed. Reopen it before merging.");
    if (pull.isDraft)
      return unmet("The PR is a draft. Mark it ready for review.");
    if (pull.baseRefName !== defaultBranch)
      return unmet(
        `The PR targets ${pull.baseRefName}, not ${defaultBranch}. Merge its parent first, then retarget it to ${defaultBranch}.`
      );
    if (baseUsesMergeQueue)
      return unmet(
        `${defaultBranch} uses a merge queue. The gate merges directly, and here gh would only queue the PR, which could then land after the gate's checks went stale. Ask Lee how to land it.`
      );
    if (pull.mergeable === "CONFLICTING")
      return unmet(
        `The PR conflicts with ${defaultBranch}. Rebase it and push.`
      );
    if (pull.mergeable === "UNKNOWN")
      return unmet(
        "GitHub has not finished working out whether the PR merges cleanly. Run the gate again in a minute."
      );
    return met(`open, ready, targets ${defaultBranch}, no conflicts`);
  },
};

const autoMerge: Requirement = {
  name: "Auto-merge",
  evaluate({ pr, pull }) {
    if (!pull.autoMergeArmed) return met("not armed");
    return unmet(
      "Auto-merge is armed on the PR, so GitHub could land it later without the gate. Disarm it, then run the gate again:",
      [`gh pr merge ${pr.number} --repo ${pr.owner}/${pr.repo} --disable-auto`]
    );
  },
};

const checks: Requirement = {
  name: "Checks",
  waiver: "checks",
  evaluate({ checks: all }) {
    const counted = all.filter((check) => !isBugbot(check));
    const ignored = all.length - counted.length;
    const bugbot = ignored === 0 ? "" : `, ${ignored} Bugbot ignored`;
    if (counted.length === 0) return met(`no checks reported${bugbot}`);
    const running = counted.filter(
      (check) => check.kind === "pending" || check.kind === "code-review-gate"
    );
    const failed = counted.filter((check) => check.kind === "failed");
    if (running.length === 0 && failed.length === 0)
      return met(`${counted.length} passed${bugbot}`);
    const parts: string[] = [];
    if (failed.length > 0)
      parts.push(
        `${failed.length} failed (${failed.map((check) => check.name).join(", ")}). Fix the failures and push`
      );
    if (running.length > 0)
      parts.push(
        `${running.length} still running (${running.map((check) => check.name).join(", ")}). Wait for them to finish, then run the gate again`
      );
    return unmet(`${parts.join(". ")}.`);
  },
};

const reviewThreads: Requirement = {
  name: "Review threads",
  waiver: "threads",
  evaluate({ threads }) {
    if (threads.length === 0) return met("none open");
    return unmet(
      `${threads.length} unresolved. Address each one and resolve it.`,
      threads.map((thread) => {
        const where =
          thread.path === null
            ? "(no file)"
            : thread.line === null
              ? thread.path
              : `${thread.path}:${thread.line}`;
        return `${thread.author ?? "(unknown)"} at ${where}: ${firstLine(thread.body)} ${thread.url ?? ""}`.trimEnd();
      })
    );
  },
};

const reviewDecision: Requirement = {
  name: "Review decision",
  evaluate({ pull }) {
    if (pull.reviewDecision === "CHANGES_REQUESTED")
      return unmet(
        "A reviewer requested changes. Address them and have the reviewer approve or dismiss their review."
      );
    return met(
      pull.reviewDecision === null
        ? "no review decision"
        : pull.reviewDecision.toLowerCase().replace("_", " ")
    );
  },
};

const review: Requirement = {
  name: "Independent review",
  evaluate({ review: fact, currentHash, mergeBase, pull }) {
    const postLine = `pstack-review: head=${pull.headRefOid} base=${mergeBase} by=<model>`;
    if (fact.kind === "none" && fact.oldVerdict !== null)
      return unmet(
        `The PR has a pstack-verdict line (${fact.oldVerdict}) and no pstack-review line. The gate reads only reviews now. Have the verifier restate its report as one comment in Shipping step 1's review format, starting "pstack-review: head=<the head it verified> base=<that head's merge base> by=<model>", with a box line per plan box and an issue line per issue. The restated review links the original comment and does not rerun unchanged code.`
      );
    if (fact.kind === "none")
      return unmet(
        `No review on the PR. Have a verifier from the other model family review it and post the line "${postLine}".${fact.ignored.length === 0 ? "" : " The gate ignored the review lines below because their authors are not owners, members or collaborators of the repo."}`,
        fact.ignored.length === 0
          ? undefined
          : fact.ignored.map(
              (line) =>
                `ignored: ${line.author} (${line.association}) ${line.url}`
            )
      );
    if (fact.kind === "malformed")
      return unmet(
        `The latest review line does not read as "${postLine}" (${fact.url}). Have the verifier post a corrected line.`
      );
    const numbers = fact.issues.map(({ n }) => n);
    const repeated = [...new Set(numbers)].filter(
      (n) => numbers.indexOf(n) !== numbers.lastIndexOf(n)
    );
    const parts: string[] = [];
    const details: string[] = [];
    if (fact.unreadIssueLines.length > 0) {
      parts.push(
        `${fact.unreadIssueLines.length} issue line${fact.unreadIssueLines.length === 1 ? " does" : "s do"} not read as ${ISSUE_FORM}`
      );
      details.push(...fact.unreadIssueLines.map((line) => `unread: ${line}`));
    }
    if (repeated.length > 0) {
      parts.push(
        `${repeated.length} issue number${repeated.length === 1 ? " is" : "s are"} used more than once. Have the verifier number each issue once`
      );
      details.push(`listed more than once: ${repeated.map((n) => `issue ${n}`).join(" ")}`);
    }
    if (parts.length > 0)
      return unmet(`${parts.join(". ")}. (${fact.url})`, details);
    const reason = !fact.recordedHash.ok
      ? `the review's change could not be hashed (${fact.recordedHash.detail})`
      : !currentHash.ok
        ? `the PR's current change could not be hashed (${currentHash.detail})`
        : fact.recordedHash.hash !== currentHash.hash
          ? "the code changed since the review"
          : null;
    if (reason !== null)
      return unmet(
        `The latest review covers ${short(fact.base)}..${short(fact.head)}, not the PR's current change ${short(mergeBase)}..${short(pull.headRefOid)}, because ${reason}. Get a new review at this head.`
      );
    const count = (severity: Severity) =>
      fact.issues.filter((issue) => issue.severity === severity).length;
    return met(
      `by ${fact.by} covers this code, ${fact.issues.length === 0 ? "no issues" : SEVERITIES.map((severity) => `${count(severity)} ${severity}`).join(", ")}`
    );
  },
};

export const ISSUE_FORM = '"issue <n> <high|medium|low>: <what is wrong>"';

export const BOX_FORMS =
  '"box <id>: done", "box <id>: failed. issue <n>", "box <id>: n/a. <reason>" or "box <id>: skipped. <what did not run>"';

const planBoxes: Requirement = {
  name: "Plan boxes",
  evaluate({ review: fact, plan: planFact, accepted }) {
    if (planFact.kind === "declared-missing") {
      const { path, pr } = planFact.declared;
      return unmet(
        `The PR body declares the plan ${path} for ${pr}, and it is not on this machine. Run the gate from where that path resolves, or pass the plan's path here:`,
        [`--plan ${path} --plan-pr ${pr}`]
      );
    }
    if (planFact.kind === "mismatch") {
      const { declared, passed } = planFact;
      return unmet(
        "--plan and --plan-pr name another plan than the PR body declares. Pass the declared plan, or fix the PR body's pstack-plan line:",
        [
          `declared: pstack-plan: ${declared.path} pr=${declared.pr}`,
          `passed: --plan ${passed.path} --plan-pr ${passed.pr}`,
        ]
      );
    }
    const plan = planFact.kind === "read" ? planFact.boxes : null;
    const noPlan =
      planFact.kind === "none"
        ? ["No plan checked: the PR declares none and none was passed."]
        : [];
    if (fact.kind !== "found")
      return met("no review to read; see Independent review", noPlan);
    const listed = new Set(fact.boxes.map((box) => box.id));
    const repeated = [...listed].filter(
      (id) => fact.boxes.filter((box) => box.id === id).length > 1
    );
    const omitted = (plan?.ids ?? []).filter((id) => !listed.has(id));
    const noReason = fact.boxes.filter(
      (box) => (box.status === "n/a" || box.status === "skipped") && box.note === ""
    );
    const unlinked = fact.boxes.filter((box) => {
      const issue = FAILED_NOTE.exec(box.note);
      return (
        box.status === "failed" &&
        (issue === null || !fact.issues.some(({ n }) => n === Number(issue[1])))
      );
    });
    // Every agent posts as the same GitHub account, so no comment can say the lead accepted a skip; only the lead's own gate run can.
    const settled = new Set([
      ...accepted.skips.map(({ id }) => id),
      ...accepted.deferrals.map(({ id }) => id),
    ]);
    const unwaived = fact.boxes.filter(
      (box) => box.status === "skipped" && !settled.has(box.id)
    );
    const parts: string[] = [];
    const details: string[] = [];
    if (fact.unreadBoxLines.length > 0) {
      parts.push(
        `${fact.unreadBoxLines.length} box line${fact.unreadBoxLines.length === 1 ? " does" : "s do"} not read as ${BOX_FORMS}`
      );
      details.push(...fact.unreadBoxLines.map((line) => `unread: ${line}`));
      if (fact.unreadBoxLines.some((line) => CHANGED_BOX.test(line)))
        parts.push(
          'A changed bar is not a review status. The lead records it in the pstack-accept comment as "box <id>: changed. <earlier bar> to <new bar>, <who changed it>, <why>"'
        );
    }
    if (repeated.length > 0) {
      parts.push(
        `${repeated.length} box${repeated.length === 1 ? " is" : "es are"} listed more than once, so the review does not say which status holds. Have the verifier list each box once`
      );
      details.push(`listed more than once: ${repeated.join(" ")}`);
    }
    if (omitted.length > 0) {
      parts.push(
        `The review omits ${omitted.length} required box${omitted.length === 1 ? "" : "es"} of ${plan?.pr} in ${plan?.path}. Have the verifier list each one as ${BOX_FORMS}`
      );
      details.push(`omitted: ${omitted.join(" ")}`);
    }
    if (noReason.length > 0) {
      parts.push(
        `${noReason.length} box${noReason.length === 1 ? " is" : "es are"} n/a or skipped with no reason. Have the verifier give one`
      );
      details.push(`no reason: ${noReason.map((box) => box.id).join(" ")}`);
    }
    if (unlinked.length > 0) {
      parts.push(
        `${unlinked.length} failed box${unlinked.length === 1 ? " does" : "es do"} not name an issue the review lists. Have the verifier write "box <id>: failed. issue <n>" with an "issue <n> <severity>: ..." line for it`
      );
      details.push(`no issue: ${unlinked.map((box) => box.id).join(" ")}`);
    }
    if (unwaived.length > 0) {
      parts.push(
        `${unwaived.length} skipped box${unwaived.length === 1 ? " is" : "es are"} not accepted or deferred by the lead. Run the box and get a new review. Or the lead runs the gate with "--accept-skip <id>=<reason>" for a box that does not apply, or "--defer <id>=<owner>" for a box whose work is owed`
      );
      details.push(`not accepted: ${unwaived.map((box) => box.id).join(" ")}`);
    }
    if (parts.length > 0)
      return unmet(`${parts.join(". ")}. (${fact.url})`, details);
    const deferred = fact.boxes.flatMap((box) => {
      const deferral = accepted.deferrals.find(({ id }) => id === box.id);
      return box.status === "skipped" && deferral !== undefined
        ? [{ box, owner: deferral.owner }]
        : [];
    });
    const skipped =
      fact.boxes.filter((box) => box.status === "skipped").length -
      deferred.length;
    const scope =
      plan === null
        ? `no plan given, ${fact.boxes.length} box${fact.boxes.length === 1 ? "" : "es"} listed`
        : `all ${plan.ids.length} required boxes of ${plan.pr} listed${planFact.kind === "read" && planFact.declared ? `, from the plan the PR body declares` : ""}`;
    const notes = [
      scope,
      ...(skipped === 0
        ? []
        : [`${skipped} skip${skipped === 1 ? "" : "s"} accepted by the lead`]),
      ...(deferred.length === 0
        ? []
        : [`${deferred.length} box${deferred.length === 1 ? "" : "es"} deferred`]),
    ];
    const owed = deferred.map(
      ({ box, owner }) => `deferred: box ${box.id} to ${owner}: ${box.note}`
    );
    const notesBelow = [...noPlan, ...owed];
    return met(
      notes.join(", "),
      notesBelow.length === 0 ? undefined : notesBelow
    );
  },
};

export const SHORTCUT_FORM =
  '"shortcut <id>: <what was not rerun, and the review it carries>. <why nothing that changed reaches it>", with <id> the box id such as live-1, or a lowercase slug with hyphens';

const shortcuts: Requirement = {
  name: "Shortcuts",
  evaluate({ review: fact, accepted }) {
    if (fact.kind !== "found") return met("no review to read; see Independent review");
    if (fact.shortcuts.length === 0 && fact.unreadShortcutLines.length === 0)
      return met("none listed");
    const ids = fact.shortcuts.map(({ id }) => id);
    const repeated = [...new Set(ids)].filter(
      (id) => ids.indexOf(id) !== ids.lastIndexOf(id)
    );
    const reasons = new Map(accepted.shortcuts.map((a) => [a.id, a.reason]));
    const unaccepted = [...new Set(ids)].filter((id) => !reasons.has(id));
    const parts: string[] = [];
    const details: string[] = [];
    if (fact.unreadShortcutLines.length > 0) {
      parts.push(
        `${fact.unreadShortcutLines.length} shortcut line${fact.unreadShortcutLines.length === 1 ? " does" : "s do"} not read as ${SHORTCUT_FORM}`
      );
      details.push(...fact.unreadShortcutLines.map((line) => `unread: ${line}`));
    }
    if (repeated.length > 0) {
      parts.push(
        `${repeated.length} shortcut${repeated.length === 1 ? " is" : "s are"} listed more than once. Have the verifier list each once`
      );
      details.push(`listed more than once: ${repeated.join(" ")}`);
    }
    if (unaccepted.length > 0) {
      parts.push(
        `${unaccepted.length} shortcut${unaccepted.length === 1 ? " is" : "s are"} not accepted by the lead. Rerun what it skipped and get a new review, or, if the lead accepts it, the lead runs the gate with "--accept-shortcut <id>=<reason>"`
      );
      details.push(
        ...fact.shortcuts
          .filter(({ id }) => unaccepted.includes(id))
          .map(({ id, note }) => `not accepted: shortcut ${id}: ${note}`)
      );
    }
    if (parts.length > 0) return unmet(`${parts.join(". ")}. (${fact.url})`, details);
    return met(
      `${fact.shortcuts.length} accepted by the lead`,
      fact.shortcuts.map(
        ({ id, note }) => `shortcut ${id}: ${note} Accepted: ${reasons.get(id)}`
      )
    );
  },
};

export const ACCEPT_FORMS =
  '"checked: <what you ran or read yourself>", "issue <n>: fixed in <sha>", "issue <n>: stands. <why it does not block>", "issue <n>: deferred to <owner>. <why it can wait>" with <owner> ' +
  DEFER_OWNER_FORMS +
  ', or "box <id>: changed. <earlier bar> to <new bar>, <who changed it>, <why>"';

/** The issues the lead must give a line: each high and medium one, and each a failed box names. */
const needsDisposition = (
  fact: Extract<ReviewFact, { kind: "found" }>
): readonly ReviewIssue[] => {
  const ofFailed = new Set(
    fact.boxes.flatMap((box) => {
      const issue = box.status === "failed" ? FAILED_NOTE.exec(box.note) : null;
      return issue === null ? [] : [Number(issue[1])];
    })
  );
  return fact.issues.filter(
    (issue) => issue.severity !== "low" || ofFailed.has(issue.n)
  );
};

const dispositionLine = ({ n, disposition }: IssueDisposition): string =>
  disposition.kind === "fixed"
    ? `issue ${n}: fixed in ${disposition.sha}`
    : disposition.kind === "stands"
      ? `issue ${n}: stands. ${disposition.why}`
      : `issue ${n}: deferred to ${disposition.owner}. ${disposition.why}`;

const acceptance: Requirement = {
  name: "Lead's acceptance",
  evaluate({ review: reviewed, acceptance: fact, pull }) {
    if (reviewed.kind !== "found")
      return unmet(
        "No review to accept; see Independent review. Once the review is posted, the lead judges it and posts its acceptance at this head:",
        [`pstack-accept: head=${pull.headRefOid} review=<url of the review comment> by=<your model>`]
      );
    const owed = needsDisposition(reviewed);
    const postLines = [
      `pstack-accept: head=${pull.headRefOid} review=${reviewed.url} by=<your model>`,
      "checked: <what you ran or read yourself>",
      ...owed.map(
        ({ n }) =>
          `issue ${n}: fixed in <sha> | stands. <why it does not block> | deferred to <owner>. <why it can wait>`
      ),
    ];
    if (fact.kind === "none")
      return unmet(
        `The lead has not accepted the review (${reviewed.url}). The lead judges each issue, then posts one comment at this head:`,
        postLines
      );
    if (fact.kind === "malformed")
      return unmet(
        `The latest acceptance line does not read as "pstack-accept: head=<head sha> review=<url> by=<model>" (${fact.url}). The lead posts a corrected one:`,
        postLines
      );
    if (fact.review !== reviewed.url)
      return unmet(
        `The latest acceptance (${fact.url}) names the review ${fact.review}, not the one the gate reads (${reviewed.url}). The lead judges that review and posts a new acceptance:`,
        postLines
      );
    const listed = new Set(reviewed.issues.map(({ n }) => n));
    const given = fact.issues.map(({ n }) => n);
    const repeated = [
      ...[...new Set(given)]
        .filter((n) => given.indexOf(n) !== given.lastIndexOf(n))
        .map((n) => `issue ${n}`),
      ...[...new Set(fact.bars.map(({ id }) => id))]
        .filter((id) => fact.bars.filter((bar) => bar.id === id).length > 1)
        .map((id) => `box ${id}`),
    ];
    const unlisted = [
      ...[...new Set(given)].filter((n) => !listed.has(n)).map((n) => `issue ${n}`),
      ...fact.bars
        .filter(({ id }) => !reviewed.boxes.some((box) => box.id === id))
        .map(({ id }) => `box ${id}`),
    ];
    const undecided = owed.filter(({ n }) => !given.includes(n));
    const parts: string[] = [];
    const details: string[] = [];
    if (fact.unreadLines.length > 0) {
      parts.push(
        `${fact.unreadLines.length} line${fact.unreadLines.length === 1 ? " does" : "s do"} not read as ${ACCEPT_FORMS}`
      );
      details.push(...fact.unreadLines.map((line) => `unread: ${line}`));
    }
    if (fact.checked === null)
      parts.push(
        'It has no "checked: <what you ran or read yourself>" line'
      );
    if (repeated.length > 0) {
      parts.push(
        `${repeated.length} line${repeated.length === 1 ? " is" : "s are"} given more than once. Give each once`
      );
      details.push(`given more than once: ${repeated.join(" ")}`);
    }
    if (unlisted.length > 0) {
      parts.push(
        `${unlisted.length} line${unlisted.length === 1 ? " names" : "s name"} an issue or box the review does not list`
      );
      details.push(`not in the review: ${unlisted.join(" ")}`);
    }
    if (undecided.length > 0) {
      parts.push(
        `${undecided.length} issue${undecided.length === 1 ? " has" : "s have"} no line. Each high and medium issue, and the issue of each failed box, needs "issue <n>: fixed in <sha>", "issue <n>: stands. <why>" or "issue <n>: deferred to <owner>. <why>"`
      );
      details.push(
        ...undecided.map(({ n, severity, text }) => `no line: issue ${n} ${severity}: ${text}`)
      );
    }
    if (parts.length > 0)
      return unmet(`${parts.join(". ")}. (${fact.url})`, details);
    const count = (kind: Disposition["kind"]) =>
      fact.issues.filter(({ disposition }) => disposition.kind === kind).length;
    const bars = fact.bars.length === 0 ? "" : `, ${fact.bars.length} bar${fact.bars.length === 1 ? "" : "s"} changed`;
    return met(
      `by ${fact.by}: ${count("stands")} stand, ${count("deferred")} deferred, ${count("fixed")} fixed${bars}`,
      [
        `checked: ${fact.checked}`,
        ...fact.issues.map(dispositionLine),
        ...fact.bars.map(({ id, change }) => `box ${id}: changed. ${change}`),
      ]
    );
  },
};

const codexReview: Requirement = {
  name: "Codex review",
  waiver: "codex",
  evaluate({ comments, pull }) {
    const ask =
      'Comment "@codex review" on the PR and wait for Codex\'s summary comment to name this head.';
    for (const comment of [...comments].sort(newestFirst)) {
      if (!CODEX_LOGINS.has(comment.author)) continue;
      const match = CODEX_STATE.exec(comment.body);
      if (match === null) continue;
      let review: { commit_sha?: unknown; status?: unknown } | undefined;
      try {
        review = (JSON.parse(match[1]) as { code_review?: typeof review })
          .code_review;
      } catch {
        return unmet(
          `Codex's review state could not be read (${comment.url}). ${ask}`
        );
      }
      if (review?.commit_sha !== pull.headRefOid) {
        const seen =
          typeof review?.commit_sha === "string"
            ? short(review.commit_sha)
            : "no commit";
        return unmet(
          `Codex last reviewed ${seen}, not ${short(pull.headRefOid)}. ${ask}`
        );
      }
      if (review.status !== "completed")
        return unmet(
          `Codex's review of ${short(pull.headRefOid)} is ${String(review.status ?? "not started")}, not completed. Wait for it to finish.`
        );
      return met(`completed at ${short(pull.headRefOid)}`);
    }
    return unmet(`Codex has not reviewed the PR. ${ask}`);
  },
};

const instructionApproval: Requirement = {
  name: "Instruction-file approval",
  evaluate({ instructionFiles, comments }) {
    if (instructionFiles === null)
      return met("no AGENTS.md or CLAUDE.md changes");
    const upstreamName = ({ owner, repo, sha }: UpstreamRef): string =>
      `${owner}/${repo}@${short(sha)}`;
    const matchedNote = ({ upstream, paths }: UpstreamMatch): string =>
      `${paths.join(", ")} match ${upstreamName(upstream)} byte for byte and need no approval`;
    if (instructionFiles.kind === "upstream-refused")
      return unmet(
        `The PR changes ${instructionFiles.paths.join(", ")} and declares pstack-upstream: ${instructionFiles.upstream.owner}/${instructionFiles.upstream.repo}@${instructionFiles.upstream.sha}, but ${instructionFiles.problem}`
      );
    if (instructionFiles.kind === "all-upstream")
      return met(matchedNote(instructionFiles.matched));
    const { matched } = instructionFiles;
    const line = `${APPROVAL_PREFIX} ${instructionFiles.approvalHash}`;
    const approved = comments.some((comment) => {
      const body = lines(comment.body);
      return (
        !comment.isBot &&
        speaksForRepo(comment) &&
        body.includes(line) &&
        body.some((l) => APPROVED_IN.test(l))
      );
    });
    if (approved)
      return met(
        `Lee approved the exact text of ${instructionFiles.paths.join(", ")}${matched === null ? "" : `; ${matchedNote(matched)}`}`
      );
    return unmet(
      `The PR changes ${instructionFiles.paths.join(", ")}. Show Lee that exact text in a T3 thread. Once Lee approves it there, the agent that showed it posts one comment with these lines, Lee's words quoted. Never post it without Lee's approval in chat:`,
      [
        line,
        "approved-in: <T3 thread id>",
        "> <Lee's words>",
        ...(matched === null ? [] : [`(not part of the approval: ${matchedNote(matched)})`]),
      ]
    );
  },
};

export const REQUIREMENTS: readonly Requirement[] = [
  openAndMergeable,
  autoMerge,
  checks,
  reviewThreads,
  reviewDecision,
  review,
  planBoxes,
  shortcuts,
  acceptance,
  codexReview,
  instructionApproval,
];

export const WAIVABLE_CHECKS: readonly string[] = REQUIREMENTS.flatMap(
  (requirement) => (requirement.waiver === undefined ? [] : [requirement.waiver])
);

/** Each requirement's result, a missing check the lead waived counting as met with its reason. */
export const evaluate = (facts: Facts): readonly Evaluation[] =>
  REQUIREMENTS.map(({ name, waiver, evaluate: judge }) => {
    const result = judge(facts);
    const waived = facts.accepted.checks.find((entry) => entry.check === waiver);
    return {
      name,
      waiver,
      result:
        result.met || waived === undefined
          ? result
          : met(
              `waived by the lead: ${waived.reason}; unmet: ${result.missing}`,
              result.details
            ),
    };
  });

export const missingNames = (evaluations: readonly Evaluation[]): string[] =>
  evaluations.filter((entry) => !entry.result.met).map((entry) => entry.name);

export function renderEvaluations(
  header: string,
  evaluations: readonly Evaluation[]
): string {
  const out = [header];
  for (const { name, waiver, result } of evaluations) {
    if (result.met) continue;
    out.push(`missing: ${name}. ${result.missing}`);
    for (const detail of result.details ?? []) out.push(`  ${detail}`);
    if (waiver !== undefined)
      out.push(
        `  If the lead accepts merging without it, the lead runs the gate with --waive ${waiver}=<reason>.`
      );
  }
  for (const { name, result } of evaluations) {
    if (!result.met) continue;
    out.push(`met: ${name} (${result.note})`);
    for (const detail of result.details ?? []) out.push(`  ${detail}`);
  }
  return `${out.join("\n")}\n`;
}
