import { beforeAll, describe, expect, it } from "bun:test";
import { type Repos, makeRepos } from "./fakes.test-helper.ts";
import { Git, ReadError } from "./git.ts";

describe("Git.diffHash", () => {
  let repos: Repos;
  beforeAll(() => {
    repos = makeRepos();
  });

  it("hashes the same diff when the environment sets GIT_LITERAL_PATHSPECS", () => {
    const hash = () => new Git(repos.remote).diffHash(repos.main, repos.instructionHead, ["AGENTS.md"]);
    const plain = hash();
    process.env.GIT_LITERAL_PATHSPECS = "1";
    try {
      expect(hash()).toBe(plain);
    } finally {
      delete process.env.GIT_LITERAL_PATHSPECS;
    }
  });

  it("refuses to hash paths the diff does not touch", () => {
    const hash = () => new Git(repos.remote).diffHash(repos.main, repos.instructionHead, ["README.md"]);
    expect(hash).toThrow(ReadError);
    expect(hash).toThrow("printed no change for README.md");
  });
});
