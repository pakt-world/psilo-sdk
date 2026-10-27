import { Wallet, verifyTypedData } from "ethers";
import {
  AGENT_ACTION_DOMAIN_NAME,
  AGENT_ACTION_TYPES,
  agentBodyHash,
  newJurorSalt,
  sha256Hex,
  signAgentAction,
  stableStringify,
  voteCommitment,
} from "../agent-action";

// The same literals are pinned in paktsuite-v2 (agent-signature.guard.spec.ts and
// panel.util.spec.ts). If either side's hashing drifts, one of the two suites fails.
const NESTED = { b: 1, a: { d: [3, { z: 1, y: undefined }], c: "é" } };
const VECTORS: Array<[unknown, string, string]> = [
  [NESTED, `{"a":{"c":"é","d":[3,{"z":1}]},"b":1}`, "0x37589d8249d7e512325ef7a4efd5bef2bd752a273981fa743b9640a0597f1067"],
  [{}, `{}`, "0xb48d38f93eaa084033fc5970bf96e559c33c4cdc07d889ab00b4d63f9590739d"],
  [{ commitment: "aa" }, `{"commitment":"aa"}`, "0x671a9549d6bc13e71e281e9f6439ad8887d00a243a10dcd6bb153edca39ac0a5"],
];

describe("agent-action (paktsuite AgentSignatureGuard scheme)", () => {
  it.each(VECTORS)("stableStringify and bodyHash match the server for %j", (body, json, hash) => {
    expect(stableStringify(body)).toBe(json);
    expect(agentBodyHash(body)).toBe(hash);
  });

  it("hashes an absent body as {}", () => {
    expect(agentBodyHash(undefined)).toBe(agentBodyHash({}));
  });

  it("signs an AgentAction the server recovers to the agent", async () => {
    const wallet = Wallet.createRandom();
    const domain = { name: AGENT_ACTION_DOMAIN_NAME, version: "1", chainId: 8453 };
    const body = { commitment: "aa" };
    const path = "/v1/job-issues/abc/jury/commit";
    const headers = await signAgentAction(wallet, domain, { method: "post", path: `${path}?x=1`, subject: "abc", body });

    const expiry = Number(headers["x-agent-expiry"]);
    expect(expiry).toBeGreaterThan(Date.now() / 1000);
    expect(expiry).toBeLessThanOrEqual(Date.now() / 1000 + 300);
    const recovered = verifyTypedData(
      domain,
      AGENT_ACTION_TYPES,
      {
        action: `POST ${path}`,
        subject: "abc",
        bodyHash: agentBodyHash(body),
        nonce: headers["x-agent-nonce"],
        expiry,
      },
      headers["x-agent-signature"],
    );
    expect(recovered).toBe(wallet.address);
  });

  it("uses a fresh nonce per request", async () => {
    const wallet = Wallet.createRandom();
    const domain = { name: AGENT_ACTION_DOMAIN_NAME, version: "1", chainId: 8453 };
    const req = { method: "POST", path: "/v1/job-issues", body: {} };
    const a = await signAgentAction(wallet, domain, req);
    const b = await signAgentAction(wallet, domain, req);
    expect(a["x-agent-nonce"]).not.toBe(b["x-agent-nonce"]);
  });

  it("builds the panel's vote commitment", () => {
    const rationaleHash = sha256Hex("because");
    expect(voteCommitment("plaintiff", rationaleHash, "salt")).toBe(
      "71f11a8dc944ecae259075169bac07ed87723e989540d4d8da60baf1decacc54",
    );
    expect(newJurorSalt()).toMatch(/^[0-9a-f]{64}$/);
  });
});
