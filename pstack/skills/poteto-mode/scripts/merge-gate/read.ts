import {
  type Facts,
  type HashResult,
  type InstructionFiles,
  type PlanRef,
  type PrRef,
  type ReviewFact,
  type AcceptanceFact,
  declaredPlan,
  declaredUpstream,
  findAcceptance,
  findReview,
  hasOldVerdictLine,
  hasReviewLine,
  isInstructionFile,
  parseAcceptance,
  parseReviewBody,
  parseReviewLine,
  short,
  speaksForRepo,
  type UpstreamRef,
} from "./gate.ts";
import type { Git } from "./git.ts";
import { ReadError, sameRepo } from "./git.ts";
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
  const upstream = declaredUpstream(pull.body);
  if (upstream !== null && "malformed" in upstream)
    throw new ReadError(
      `the PR body's upstream declaration does not read as one pstack-upstream: <owner>/<repo>@<40-hex commit sha> line: ${upstream.malformed}. Fix the body so the gate can compare the instruction files with that commit.`
    );
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
    instructionFiles: readInstructionFiles(git, pr, baseTip, mergeBase, head, upstream),
  };
}

function readInstructionFiles(
  git: Git,
  pr: PrRef,
  baseTip: string,
  mergeBase: string,
  head: string,
  upstream: UpstreamRef | null
): InstructionFiles | null {
  const paths = git.changedPaths(mergeBase, head).filter(isInstructionFile);
  if (paths.length === 0) return null;
  if (upstream === null)
    return {
      kind: "changed",
      paths,
      approvalHash: git.diffHash(mergeBase, head, paths),
      matched: null,
    };
  const refused = (problem: string): InstructionFiles => ({
    kind: "upstream-refused",
    paths,
    upstream,
    problem,
  });
  if (sameRepo(upstream, pr))
    return refused(
      "that names this PR's own repo. Fix the line to name the upstream repo the PR syncs from."
    );
  const url = `https://github.com/${upstream.owner}/${upstream.repo}.git`;
  let tip: string;
  try {
    tip = git.remoteHead(url);
    git.fetch(url, [tip, upstream.sha]);
  } catch (error) {
    if (!(error instanceof ReadError)) throw error;
    return refused(
      `the gate could not read that commit and the default branch's tip from ${url}: ${error.message}. Fix the line to name a commit in the upstream repo.`
    );
  }
  if (!git.isAncestor(upstream.sha, head))
    return refused(
      `${short(upstream.sha)} is not an ancestor of the PR's head ${short(head)}. Fix the line to name the upstream commit the PR merges.`
    );
  if (!git.isAncestor(upstream.sha, tip))
    return refused(
      `${short(upstream.sha)} is not on ${upstream.owner}/${upstream.repo}'s default branch, whose tip is ${short(tip)}. Fix the line to name the commit on that branch that the PR merges.`
    );
  const lastSync = git.mergeBase(baseTip, upstream.sha);
  const fromUpstream = paths.filter(
    (path) =>
      git.blobAt(head, path) === git.blobAt(upstream.sha, path) &&
      git.blobAt(mergeBase, path) === git.blobAt(lastSync, path)
  );
  const rest = paths.filter((path) => !fromUpstream.includes(path));
  const matched = fromUpstream.length === 0 ? null : { upstream, paths: fromUpstream };
  if (matched !== null && rest.length === 0) return { kind: "all-upstream", matched };
  return {
    kind: "changed",
    paths: rest,
    approvalHash: git.diffHash(mergeBase, head, rest),
    matched,
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
