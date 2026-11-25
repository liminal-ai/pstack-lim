import { beforeAll, describe, expect, it } from "bun:test";
import { type Repos, makeRepos } from "./fakes.test-helper.ts";
import { Git, ReadError } from "./git.ts";

describe("Git.diffHash", () => {
  let repos: Repos;
  beforeAll(() => {
    repos = makeRepos();
  });

  it("refuses to hash paths the diff does not touch", () => {
    const hash = () => new Git(repos.remote).diffHash(repos.main, repos.instructionHead, ["README.md"]);
    expect(hash).toThrow(ReadError);
    expect(hash).toThrow("printed no change for README.md");
  });
});
