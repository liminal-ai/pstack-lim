import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { main } from "./cli.ts";
import { acceptComment, codexComment, fakeGitHub, reviewComment, runtimeFor } from "./fakes.test-helper.ts";

const VENDORED = ".repos/pkg/AGENTS.md";

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
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

/**
 * Upstream U0, U1, U2 with the vendored file at v0, v1, v2. The PR branches from a fork base after U0 and
 * merges U2. With `advanced`, the base branch has meanwhile synced U1 on its own, so its tip and the PR's
 * merge base sit at different syncs.
 */
async function sync(options: { advanced?: boolean; baseAtV1?: boolean; symlink?: boolean }) {
  const root = mkdtempSync(join(tmpdir(), "merge-gate-upstream-cases-"));
  const [work, upstream, fork, gate] = ["work", "upstream.git", "fork.git", "gate"].map((name) => join(root, name));
  for (const bare of [upstream, fork]) {
    git(root, "init", "--quiet", "--bare", "--initial-branch=main", bare);
    git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  }
  git(root, "init", "--quiet", "--initial-branch=main", work);
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(work, path)), { recursive: true });
    writeFileSync(join(work, path), text);
    git(work, "add", path);
  };
  const commit = (message: string) => {
    git(work, "commit", "--quiet", "-m", message);
    return git(work, "rev-parse", "HEAD");
  };
  write(VENDORED, "v0");
  const u0 = commit("upstream 0");
  write(VENDORED, "v1");
  const u1 = commit("upstream 1");
  write(VENDORED, "v2");
  const u2 = commit("upstream 2");
  git(work, "push", "--quiet", upstream, `${u2}:refs/heads/main`);

  git(work, "checkout", "--quiet", "--detach", u0);
  write("fork.txt", "fork\n");
  if (options.baseAtV1) write(VENDORED, "v1");
  const branchBase = commit("fork base");
  spawnSync("git", ["merge", "--quiet", "--no-ff", "--no-commit", u2], { cwd: work });
  write(VENDORED, "v2");
  commit("sync upstream");
  if (options.symlink) {
    rmSync(join(work, VENDORED));
    symlinkSync("v2", join(work, VENDORED));
    write(".repos/pkg/v2", "fork-written instructions");
    git(work, "add", VENDORED);
    commit("fork makes the vendored file a symlink");
  }
  const head = git(work, "rev-parse", "HEAD");
  git(work, "push", "--quiet", fork, `${head}:refs/heads/review`);
  let baseTip = branchBase;
  if (options.advanced) {
    git(work, "checkout", "--quiet", "--detach", branchBase);
    spawnSync("git", ["merge", "--quiet", "--no-ff", "--no-commit", u1], { cwd: work });
    write(VENDORED, "v1");
    baseTip = commit("the base branch syncs U1 on its own");
  }
  git(work, "push", "--quiet", fork, `${baseTip}:refs/heads/main`);

  git(root, "init", "--quiet", gate);
  git(gate, "remote", "add", "origin", "https://github.com/owner/repo.git");
  git(gate, "config", `url.${fork}.insteadOf`, "https://github.com/owner/repo.git");
  git(gate, "config", `url.${upstream}.insteadOf`, "https://github.com/vendor/source.git");
  const review = reviewComment(head, branchBase);
  const github = fakeGitHub({
    pull: { headRefOid: head, body: `pstack-upstream: vendor/source@${u2}` },
    comments: [review, acceptComment(review, head), codexComment(head)],
  });
  const runtime = runtimeFor(github, gate);
  const exit = await main(["--repo", "owner/repo", "--pr", "1", "--check"], runtime);
  return { exit, out: runtime.decision() };
}

describe("instruction files against the declared upstream, beyond #76", () => {
  it("an untouched vendored file passes when the base branch has synced a later upstream commit since the PR branched", async () => {
    const result = await sync({ advanced: true });
    expect(result.out).toContain(`met: Instruction-file approval (${VENDORED} match vendor/source@`);
    expect(result.exit).toBe(0);
  });

  it("a vendored file the fork edited at the PR's base still needs approval when the base branch has synced since", async () => {
    const result = await sync({ advanced: true, baseAtV1: true });
    expect(result.out).toContain(`missing: Instruction-file approval. The PR changes ${VENDORED}.`);
    expect(result.exit).toBe(1);
  });

  it("a vendored file the fork turns into a symlink with upstream's bytes still needs approval", async () => {
    const result = await sync({ symlink: true });
    expect(result.out).toContain(`missing: Instruction-file approval. The PR changes ${VENDORED}.`);
    expect(result.exit).toBe(1);
  });
});
