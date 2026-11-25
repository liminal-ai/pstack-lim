import { describe, expect, it } from "bun:test";
import { isInstructionFile } from "./gate.ts";

describe("isInstructionFile", () => {
  for (const path of [
    "AGENTS.md",
    "CLAUDE.md",
    "nested/dir/AGENTS.md",
    "docs/CLAUDE.md",
    ".agents/skills/foo/AGENTS.md",
  ])
    it(`counts ${path}`, () => expect(isInstructionFile(path)).toBe(true));

  for (const path of [
    "features/agents.md",
    "claude.md",
    "sub/Claude.md",
    ".agents/skills/verify-limboard/features/agents.md",
    "AGENTS.md.bak",
  ])
    it(`does not count ${path}`, () => expect(isInstructionFile(path)).toBe(false));
});
