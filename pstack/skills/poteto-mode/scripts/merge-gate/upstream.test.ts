import { beforeAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { main } from "./cli.ts";
import {
  REPO,
  acceptComment,
  codexComment,
  comment,
  fakeGitHub,
  reviewComment,
  runtimeFor,
} from "./fakes.test-helper.ts";

const FIXTURES = join(import.meta.dir, "fixtures", "pr76");
const ALCHEMY = ".repos/alchemy-effect/AGENTS.md";
const OLD_AWS = ".repos/alchemy-effect/packages/alchemy/src/AWS/AGENTS.md";
const NEW_AWS = ".repos/alchemy-effect/packages/aws/src/AGENTS.md";
const OLD_EFFECT = ".repos/effect-smol/.agents/AGENTS.md";
const NEW_EFFECT = ".repos/effect/.agents/AGENTS.md";
const VENDORED = [ALCHEMY, NEW_AWS, NEW_EFFECT, OLD_AWS, OLD_EFFECT].sort();

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
      GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
    },
  });
  if (result.status !== 0)
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

/**
 * pingdotgg/t3code and the fork, as #76 met them. Both start from a commit with the vendored files'
 * old text. Upstream's commit applies #76's real diff to them; the fork's main moves on its own,
 * and the PR merges the upstream commit into it.
 */
interface Sync {
  readonly gate: string;
  readonly fork: string;
  readonly main: string;
  readonly upstreamCommit: string;
  /** Another upstream commit the PR does not merge. */
  readonly unmerged: string;
  readonly head: string;
  /** head plus one byte changed in the vendored alchemy-effect AGENTS.md. */
  readonly forkEdit: string;
  /** head plus a fork-root AGENTS.md change. */
  readonly forkRoot: string;
}

function makeSync(): Sync {
  const root = mkdtempSync(join(tmpdir(), "merge-gate-upstream-"));
  const fork = join(root, "fork.git");
  const upstream = join(root, "upstream.git");
  const work = join(root, "work");
  const gate = join(root, "gate");
  for (const bare of [fork, upstream]) {
    git(root, "init", "--quiet", "--bare", "--initial-branch=main", bare);
    git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  }
  git(root, "init", "--quiet", "--initial-branch=main", work);
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(work, path)), { recursive: true });
    writeFileSync(join(work, path), text);
    git(work, "add", path);
  };
  const commit = (message: string): string => {
    git(work, "commit", "--quiet", "-m", message);
    return git(work, "rev-parse", "HEAD");
  };

  write("README.md", "root\n");
  write("AGENTS.md", "fork rules\n");
  for (const [path, fixture] of [
    [ALCHEMY, "alchemy-effect.agents-md.txt"],
    [OLD_AWS, "alchemy-aws.agents-md.txt"],
    [OLD_EFFECT, "effect-smol.agents-md.txt"],
  ] as const) {
    mkdirSync(dirname(join(work, path)), { recursive: true });
    copyFileSync(join(FIXTURES, fixture), join(work, path));
    git(work, "add", path);
  }
  const shared = commit("vendored files, old text");

  git(work, "apply", "--index", join(FIXTURES, "instruction-files-76.patch"));
  const upstreamCommit = commit("chore(repos): sync Effect 4.1.2 and Alchemy beta.85, rename effect-smol");
  git(work, "checkout", "--quiet", "--detach", shared);
  write("upstream.txt", "elsewhere\n");
  const unmerged = commit("an upstream commit the PR does not merge");

  git(work, "checkout", "--quiet", "--detach", shared);
  write("fork.txt", "fork moved\n");
  const main = commit("fork moves");
  git(work, "merge", "--quiet", "--no-ff", "-m", "merge upstream", upstreamCommit);
  const head = git(work, "rev-parse", "HEAD");
  write(ALCHEMY, `${readFileSync(join(work, ALCHEMY), "utf8")}x`);
  const forkEdit = commit("fork edits a vendored file");
  git(work, "checkout", "--quiet", "--detach", head);
  write("AGENTS.md", "fork rules, edited\n");
  const forkRoot = commit("fork edits its own AGENTS.md");

  git(work, "push", "--quiet", upstream, `${upstreamCommit}:refs/heads/main`, `${unmerged}:refs/heads/side`);
  git(work, "push", "--quiet", fork, `${main}:refs/heads/main`);
  for (const [index, sha] of [head, forkEdit, forkRoot].entries()) {
    git(work, "push", "--quiet", fork, `${sha}:refs/tmp/${index}`);
    git(fork, "update-ref", "-d", `refs/tmp/${index}`);
  }

  git(root, "init", "--quiet", gate);
  git(gate, "remote", "add", "origin", "https://github.com/owner/repo.git");
  git(gate, "config", `url.${join(root, "fork")}.insteadOf`, "https://github.com/owner/repo");
  git(gate, "config", `url.${join(root, "upstream")}.insteadOf`, "https://github.com/pingdotgg/t3code");
  return { gate, fork, main, upstreamCommit, unmerged, head, forkEdit, forkRoot };
}

let sync: Sync;
beforeAll(() => {
  sync = makeSync();
});

async function gate(head: string, body: string) {
  const review = reviewComment(head, sync.main);
  const github = fakeGitHub({
    pull: { headRefOid: head, body },
    comments: [review, acceptComment(review, head), codexComment(head)],
  });
  const runtime = runtimeFor(github, sync.gate);
  const exit = await main(["--repo", REPO, "--pr", "1"], runtime);
  const out = runtime.decision();
  return {
    exit,
    out,
    missing: out.split("\n").filter((line) => line.startsWith("missing: ")),
    merged: github.calls.some((call) => call.startsWith("merge ")),
  };
}

const declares = (sha: string, repo = "pingdotgg/t3code") =>
  `Syncs upstream.\n\npstack-upstream: ${repo}@${sha}`;

const approvalHash = (head: string, paths: readonly string[]) =>
  createHash("sha256")
    .update(
      `${git(sync.fork, "diff-tree", "-r", "--no-renames", "--full-index", "--abbrev=40", sync.main, head, "--", ...paths)}\n`
    )
    .digest("hex");

describe("instruction files that match the declared upstream commit", () => {
  it("replays #76's diff: upstream's commit carries the same blobs as pingdotgg/t3code 43bf0ba", () => {
    const blob = (path: string) => git(sync.fork, "rev-parse", `${sync.upstreamCommit}:${path}`);
    expect(blob(ALCHEMY)).toBe("e5291a515b6cd841cb2a846dfab069b91365eb0f");
    expect(blob(NEW_AWS)).toBe("f6b21a3759103815f37c18cc043875c694304020");
    expect(blob(NEW_EFFECT)).toBe("e6450c28e1d6d7002e46500f243c2fd06e6f0e52");
  });

  it("#76: the three vendored AGENTS.md changes need no approval, and the gate merges", async () => {
    const result = await gate(sync.head, declares(sync.upstreamCommit));
    expect(result.missing).toEqual([]);
    expect(result.exit).toBe(0);
    expect(result.merged).toBe(true);
    expect(result.out).toContain(
      `${VENDORED.join(", ")} match pingdotgg/t3code@${sync.upstreamCommit.slice(0, 7)} byte for byte and need no approval`
    );
  });

  it("without the declaration, the same PR still needs Lee's approval of all five paths", async () => {
    const result = await gate(sync.head, "Syncs upstream.");
    expect(result.exit).toBe(1);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]).toStartWith("missing: Instruction-file approval.");
    expect(result.out).toContain(`The PR changes ${VENDORED.join(", ")}.`);
    expect(result.out).toContain(
      `lee-approves-instruction-files: ${approvalHash(sync.head, VENDORED)}`
    );
  });

  it("refuses a fork's one-byte edit to a vendored file, and the approval covers only that file", async () => {
    const result = await gate(sync.forkEdit, declares(sync.upstreamCommit));
    expect(result.exit).toBe(1);
    expect(result.merged).toBe(false);
    expect(result.out).toContain(`The PR changes ${ALCHEMY}. Show Lee`);
    expect(result.out).toContain(
      `\n  lee-approves-instruction-files: ${approvalHash(sync.forkEdit, [ALCHEMY])}\n`
    );
    expect(result.out).toContain(
      `(not part of the approval: ${VENDORED.filter((p) => p !== ALCHEMY).join(", ")} match pingdotgg/t3code@`
    );
  });

  it("still needs approval for the fork's own root AGENTS.md in the same PR", async () => {
    const result = await gate(sync.forkRoot, declares(sync.upstreamCommit));
    expect(result.exit).toBe(1);
    expect(result.out).toContain("The PR changes AGENTS.md. Show Lee");
    expect(result.out).toContain(
      `lee-approves-instruction-files: ${approvalHash(sync.forkRoot, ["AGENTS.md"])}`
    );
  });

  it("is met once Lee approves the remaining text, with the matched files noted", async () => {
    const review = reviewComment(sync.forkRoot, sync.main);
    const github = fakeGitHub({
      pull: { headRefOid: sync.forkRoot, body: declares(sync.upstreamCommit) },
      comments: [
        review,
        acceptComment(review, sync.forkRoot),
        codexComment(sync.forkRoot),
        comment(
          `lee-approves-instruction-files: ${approvalHash(sync.forkRoot, ["AGENTS.md"])}\napproved-in: 55835e2a-d498-4643-95ce-a3a0eb4f736b\n> yes`
        ),
      ],
    });
    const runtime = runtimeFor(github, sync.gate);
    expect(await main(["--repo", REPO, "--pr", "1", "--check"], runtime)).toBe(0);
    expect(runtime.decision()).toContain(
      `Lee approved the exact text of AGENTS.md; ${VENDORED.join(", ")} match pingdotgg/t3code@`
    );
  });

  it("refuses a declaration that names the PR's own repo", async () => {
    const result = await gate(sync.head, declares(sync.upstreamCommit, "owner/repo"));
    expect(result.exit).toBe(1);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]).toStartWith("missing: Instruction-file approval.");
    expect(result.out).toContain("that names this PR's own repo. Fix the line to name the upstream repo");
  });

  it("refuses a declared commit that is not an ancestor of the PR's head", async () => {
    const result = await gate(sync.head, declares(sync.unmerged));
    expect(result.exit).toBe(1);
    expect(result.out).toContain(
      `${sync.unmerged.slice(0, 7)} is not an ancestor of the PR's head ${sync.head.slice(0, 7)}. Fix the line to name the upstream commit the PR merges.`
    );
  });

  it("refuses the PR's own commit declared as upstream, though the gate's clone already has it", async () => {
    const result = await gate(sync.forkEdit, declares(sync.forkEdit));
    expect(result.exit).toBe(1);
    expect(result.merged).toBe(false);
    expect(result.out).toContain(
      `${sync.forkEdit.slice(0, 7)} is not on pingdotgg/t3code's default branch, whose tip is ${sync.upstreamCommit.slice(0, 7)}.`
    );
  });

  it("refuses a declared commit the upstream repo does not serve", async () => {
    const result = await gate(sync.head, declares("0".repeat(40)));
    expect(result.exit).toBe(1);
    expect(result.out).toContain("that commit could not be fetched from https://github.com/pingdotgg/t3code.git");
  });

  for (const [what, body] of [
    ["a malformed", `pstack-upstream: pingdotgg/t3code@${"a".repeat(12)}`],
    ["a doubled", `${declares("a".repeat(40))}\npstack-upstream: pingdotgg/t3code@${"b".repeat(40)}`],
  ] as const)
    it(`reads ${what} pstack-upstream line as a read error naming the fix`, async () => {
      const result = await gate(sync.head, body);
      expect(result.exit).toBe(2);
      expect(result.merged).toBe(false);
      expect(result.out).toContain(
        "does not read as one pstack-upstream: <owner>/<repo>@<40-hex commit sha> line"
      );
    });
});
