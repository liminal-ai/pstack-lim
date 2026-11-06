import {
  type Facts,
  type HashResult,
  type PlanRef,
  type PrRef,
  type ReviewFact,
  type AcceptanceFact,
  declaredPlan,
  findAcceptance,
  findReview,
  hasOldVerdictLine,
  hasReviewLine,
  isInstructionFile,
  parseAcceptance,
  parseReviewBody,
  parseReviewLine,
  speaksForRepo,
} from "./gate.ts";
import type { Git } from "./git.ts";
import { ReadError } from "./git.ts";
import type { GitHub } from "./github.ts";
import { resolvePlan } from "./plan.ts";

/** Reads every fact once. Throws on any read it cannot vouch for, so a read error never passes. */
export async function readFacts(
  github: GitHub,
  git: Git,
  pr: PrRef,
  asked: Pick<Facts, "accepted"> & {
    /** The plan --plan and --plan-pr pass, and the directory a relative plan path resolves from. */
    readonly plan: PlanRef | null;
    readonly cwd: string;
  }
): Promise<Facts> {
  const remote = git.remoteFor(pr);
  const [defaultBranch, pull, comments] = await Promise.all([
    github.defaultBranch(pr),
    github.pullRequest(pr),
    github.issueComments(pr),
  ]);
  const head = pull.headRefOid;
  const declared = declaredPlan(pull.body);
  if (declared !== null && "malformed" in declared)
    throw new ReadError(
      `the PR body's plan declaration does not read as one pstack-plan: <plan file> pr=<PR id> line: ${declared.malformed}. Fix the body so the gate can check the plan.`
    );
  const plan = resolvePlan(asked.plan, declared, asked.cwd);
  const [checks, threads, baseUsesMergeQueue] = await Promise.all([
    github.checks(pr, head),
    github.openThreads(pr),
    github.usesMergeQueue(pr, pull.baseRefName),
  ]);

  const baseTip = git.branchTip(remote, pull.baseRefName);
  git.fetch(remote, [baseTip, head]);
  const mergeBase = git.mergeBase(baseTip, head);
  const currentHash = git.verdictHash(mergeBase, head);

  const members = comments.filter(speaksForRepo);
  const found = findReview(members);
  let review: ReviewFact = {
    kind: "none",
    ignored: comments
      .filter((comment) => !speaksForRepo(comment) && hasReviewLine(comment))
      .map(({ author, association, url }) => ({ author, association, url })),
    oldVerdict:
      members.filter(hasOldVerdictLine).sort((a, b) => b.id - a.id)[0]?.url ?? null,
  };
  if (found !== null) {
    const parsed = parseReviewLine(found.line);
    review =
      parsed === null
        ? { kind: "malformed", line: found.line, url: found.url }
        : {
            kind: "found",
            ...parsed,
            url: found.url,
            recordedHash: recordedHash(git, remote, parsed.base, parsed.head),
            ...parseReviewBody(found.below),
          };
  }
  const record = findAcceptance(members);
  const parsedAcceptance =
    record === null ? null : parseAcceptance(record.line, record.below);
  const acceptance: AcceptanceFact =
    record === null
      ? { kind: "none" }
      : parsedAcceptance === null
        ? { kind: "malformed", line: record.line, url: record.url }
        : { kind: "found", ...parsedAcceptance, url: record.url };

  const instructionPaths = git
    .changedPaths(mergeBase, head)
    .filter(isInstructionFile);
  return {
    pr,
    defaultBranch,
    baseUsesMergeQueue,
    pull,
    checks,
    threads,
    comments,
    mergeBase,
    currentHash,
    review,
    acceptance,
    plan,
    accepted: asked.accepted,
    instructionFiles:
      instructionPaths.length === 0
        ? null
        : {
            paths: instructionPaths,
            approvalHash: git.diffHash(mergeBase, head, instructionPaths),
          },
  };
}

function recordedHash(
  git: Git,
  remote: string,
  base: string,
  head: string
): HashResult {
  try {
    git.fetch(remote, [base, head]);
  } catch (error) {
    if (!(error instanceof ReadError)) throw error;
    return {
      ok: false,
      detail: `its commits could not be fetched: ${error.message}`,
    };
  }
  return git.verdictHash(base, head);
}
