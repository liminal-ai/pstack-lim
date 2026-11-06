import { beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { main } from "./cli.ts";
import type { IssueComment } from "./gate.ts";
import {
  type Repos,
  REPO,
  codexComment,
  comment,
  fakeGitHub,
  makeRepos,
  runtimeFor,
} from "./fakes.test-helper.ts";

let repos: Repos;
beforeAll(() => {
  repos = makeRepos();
});

const SOL = "gpt-6.1-sol";
const LEAD = "claude-opus-5-5";

const review = (head: string, base: string, lines: readonly string[]) =>
  comment([`pstack-review: head=${head} base=${base} by=${SOL}`, ...lines].join("\n"));
const acceptance = (head: string, of: IssueComment, lines: readonly string[]) =>
  comment([`pstack-accept: head=${head} review=${of.url} by=${LEAD}`, ...lines].join("\n"));

async function replay(
  comments: readonly IssueComment[],
  flags: readonly string[] = [],
  head = repos.head
) {
  const github = fakeGitHub({
    pull: { headRefOid: head },
    comments: [...comments, codexComment(head)],
  });
  const runtime = runtimeFor(github, repos.gate);
  const exit = await main(["--repo", REPO, "--pr", "1", ...flags], runtime);
  const out = runtime.decision();
  return {
    exit,
    out,
    missing: out.split("\n").filter((line) => line.startsWith("missing: ")),
    calls: github.calls,
    merged: github.calls.some((call) => call.startsWith("merge ")),
    log: () => readFileSync(join(runtime.store, "merge-gate", "runs.tsv"), "utf8"),
  };
}

/** TU6's round-2 review at 3d9c298, restated: every box ran, one strict issue the lead overruled with no code change. */
const tu6Round2 = () =>
  review(repos.head, repos.main, [
    "box unit-1: done. `bun test apps/server` passed 113 tests. Receipt `server-tests.log`.",
    "box unit-2: done. `bun test convex-tests/plans.test.ts` passed 11 tests. Receipt `plans-tests.log`.",
    "box unit-3: done. `bun run verify --live` passed at clean head with 1737 passes and two existing skips.",
    "box live-1: done. Carried from round 1.",
    "shortcut live-1: CLI and agent-signup carry from round 1 at 7e5919b. The 12-file round-2 diff changes payment handling and billing prose, not signup or record operations.",
    "box live-2: done. Hosted 4242 payment produced Steward; CLI upgrade changed the same subscription to Pro.",
    "box live-3: done. Portal cancellation retained Pro until expiry; the test clock then produced Free.",
    "box perf: done. Twenty signed reset-Checkout redeliveries returned 200/applied=false, median 7.780 ms.",
    "issue 1 high: paid time is lost on a requested cancellation. Cancel a paid sandbox subscription through Stripe's API. The stored end moved from 1801756764000 to 1793804850150 and usage read Free. TU6 says deletion preserves paid-through time.",
    "issue 2 low: a concurrent duplicate cancel answers one delivery 404 and converges on Stripe's redelivery.",
    "issue 3 low: billing.md says active where the code accepts active or trialing.",
  ]);

describe("replays of real reviews against the review and acceptance gate", () => {
  it("TU6, limhealth #125: the lead lets a review's issue stand at unchanged code, and the gate merges with no new review", async () => {
    const r2 = tu6Round2();
    const accepted = acceptance(repos.head, r2, [
      "checked: read stripe.ts:178 and billing.ts:38, and lane 3's portal cancellation receipts",
      "issue 1: stands. Stripe deletes at once only when an operator cancels immediately, where that choice means end service now. A portal cancel ends at the period end, as lane 3 proved. The plan's cancellation line is amended to the rule the code follows.",
    ]);
    const result = await replay(
      [r2, accepted],
      ["--accept-shortcut", "live-1=the round-2 diff does not reach signup or record operations"]
    );
    expect(result.exit).toBe(0);
    expect(result.merged).toBe(true);
    expect(result.out).toContain(
      `met: Lead's acceptance (by ${LEAD}: 1 stand, 0 deferred, 0 fixed)`
    );
    const row = result.log().split("\n")[1].split("\t");
    expect(JSON.parse(row[8])).toEqual({
      review: r2.url,
      accept: accepted.url,
      by: LEAD,
      issues: [
        {
          n: 1,
          severity: "high",
          disposition: "stands",
          detail: expect.stringMatching(/^Stripe deletes at once only when an operator cancels immediately/),
        },
      ],
      bars: [],
    });
  });

  it("health-goals GT1, limhealth #102: a failed box and its high issue, accepted with stands, merges", async () => {
    const gt1 = review(repos.head, repos.main, [
      "box unit-1: done. typecheck exits 0; bun test apps/web has 122 pass, including all six GoalProgress states.",
      "box unit-2: done. bun run verify exits 0, 1,485 tests pass.",
      "box live-1: done. today, day-nav and midnight pass at trunk and head with zero page errors.",
      "box live-2: failed. issue 1",
      "box live-3: done. Both captures exit 0 with 55/55 shots and zero failing axe screens.",
      "box perf: done. Food median 204.1 ms trunk and 215.5 ms head, below the 300 ms threshold.",
      "issue 1 high: daily goals are separated from the day totals, contrary to the placement requirement. Open Today with goals at 1440 px. The goals card sits above the log, not under the Day total. The plan places goals with the day totals.",
      "issue 2 medium: a fasted day that becomes tomorrow after moving timezone west keeps a toggle whose action is refused. Move the timezone west after marking today fasted. The toggle is enabled and fails. The toggle should match what the server accepts.",
    ]);
    const result = await replay([
      gt1,
      acceptance(repos.head, gt1, [
        "checked: opened GT1-final-today-light-desktop.png and the plan's GT1 build box",
        "issue 1: stands. The plan told the owner to prototype two or three layouts and build the one it judged best. It built A, the card above the log, and kept B and C for Lee's close-out reel. Lee reviews the layout there.",
        "issue 2: stands. It needs a timezone change, so it is rare. Not blocking.",
      ]),
    ], []);
    expect(result.exit).toBe(0);
    expect(result.merged).toBe(true);
    expect(result.out).toContain(`met: Lead's acceptance (by ${LEAD}: 2 stand, 0 deferred, 0 fixed)`);
  });

  it("user-tiers TU6 round 1, limhealth #125: the double-subscription money-path issue with no acceptance is refused for want of acceptance", async () => {
    const round1 = review(repos.head, repos.main, [
      "box live-2: done. Hosted Checkout bought Steward, CLI changed the same subscription to Steward Pro.",
      "issue 1 high: two checkout links can create two active subscriptions for one account. Request two Steward upgrades with distinct request ids, then pay both hosted links. Stripe lists two active monthly Steward subscriptions for the same customer. One account holds at most one subscription.",
      "issue 2 high: a late subscription update restores a canceled subscription link and blocks buying again. Deliver a delayed update after portal cancellation and expiry. The next upgrade failed. A canceled subscription stays unlinked.",
    ]);
    const result = await replay([round1]);
    expect(result.exit).toBe(1);
    expect(result.merged).toBe(false);
    expect(result.missing).toEqual([
      `missing: Lead's acceptance. The lead has not accepted the review (${round1.url}). The lead judges each issue, then posts one comment at this head:`,
    ]);
    expect(result.out).toContain(
      `  pstack-accept: head=${repos.head} review=${round1.url} by=<your model>\n  checked: <what you ran or read yourself>\n  issue 1: fixed in <sha> | stands. <why it does not block> | deferred to <owner>\n  issue 2: `
    );
  });

  it("long-horizon-context #59, verify-lhc retrieval.md:23: a doc-only fix gets a review at the new head, with shortcuts for unrelated lanes, and merges on their acceptance", async () => {
    const before = review(repos.head, repos.main, [
      "box docs: done. Read the verify skills against main.",
      "issue 1 low: retrieval.md:23 says an oversized item slices only when 256 tokens remain, which reads as wrong to a reader who skips fromToken.",
    ]);
    const atFix = review(repos.docHead, repos.main, [
      "box docs: done. Read retrieval.md:23 against src/retrieval's slice rule; the sentence now matches it.",
      "shortcut retrieval: the live retrieval lane was not rerun; it carries the review at 494cf6a. Only retrieval.md changed, which the lane's helper does not read.",
      "shortcut thread-round-trip: not rerun; carries the review at 494cf6a. No code, config or verify step it runs changed.",
    ]);
    const result = await replay(
      [
        before,
        acceptance(repos.head, before, ["checked: read retrieval.md:23"]),
        atFix,
        acceptance(repos.docHead, atFix, ["checked: read the changed sentence and the slice rule in src/retrieval"]),
      ],
      [
        "--accept-shortcut", "retrieval=only the doc changed",
        "--accept-shortcut", "thread-round-trip=only the doc changed",
      ],
      repos.docHead
    );
    expect(result.exit).toBe(0);
    expect(result.merged).toBe(true);
    expect(result.out).toContain("met: Shortcuts (2 accepted by the lead)");
    expect(result.calls.find((call) => call.startsWith("comment "))).toContain(
      `the lead accepted these shortcuts the review ${atFix.url} lists`
    );
  });

  it("a PASS-shaped review, every box done and no issues, with no acceptance is refused", async () => {
    const clean = review(repos.head, repos.main, [
      "box unit-1: done",
      "box live-1: done. Fresh CLI and agent-signup runs passed at base and head.",
    ]);
    const result = await replay([clean]);
    expect(result.exit).toBe(1);
    expect(result.merged).toBe(false);
    expect(result.missing).toEqual([
      `missing: Lead's acceptance. The lead has not accepted the review (${clean.url}). The lead judges each issue, then posts one comment at this head:`,
    ]);
  });

  it("limhealth #102's final pstack-verdict alone is refused, asking for it restated as a review", async () => {
    const old = comment(
      [
        `pstack-verdict: PASS head=${repos.head} base=${repos.main} by=${SOL}`,
        "box unit-1: done. Reran through bun run verify at 27a8f37.",
      ].join("\n")
    );
    const result = await replay([old, comment(`pstack-ruling: head=${repos.head} by=${LEAD} APPROVE`)]);
    expect(result.exit).toBe(1);
    expect(result.missing[0]).toStartWith(
      `missing: Independent review. The PR has a pstack-verdict line (${old.url}) and no pstack-review line.`
    );
    expect(result.missing[0]).toContain("links the original comment and does not rerun unchanged code");
  });

  it("TU6, limhealth #125: an acceptance of round 2's review does not accept round 3's newer review", async () => {
    const r2 = tu6Round2();
    const accepted = acceptance(repos.head, r2, [
      "checked: read stripe.ts:178",
      "issue 1: stands. A portal cancel ends at the period end.",
    ]);
    const r3 = review(repos.head, repos.main, [
      "issue 1 medium: an open You page reports the expired paid plan. Advance the test clock past expiry with You open. It shows Steward until reload. Every surface shows the current plan.",
    ]);
    const result = await replay([r2, accepted, r3]);
    expect(result.exit).toBe(1);
    expect(result.missing).toEqual([
      `missing: Lead's acceptance. The latest acceptance (${accepted.url}) names the review ${r2.url}, not the one the gate reads (${r3.url}). The lead judges that review and posts a new acceptance:`,
    ]);
  });
});
