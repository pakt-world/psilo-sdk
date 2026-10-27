import { Container } from "typedi";
import { Wallet, verifyTypedData } from "ethers";
import { Connector } from "../../../connector";
import { SDKError } from "../../../utils/errors";
import { Status } from "../../../utils/response";
import { AGENT_ACTION_TYPES, agentBodyHash } from "../../../utils/agent-action";
import { IssueService } from "../issue";

function build(domainResponse: () => Promise<any>) {
  const id = `test-${Math.random()}`;
  const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
  let postImpl = async (_url: string, _body: any): Promise<any> => ({ status: "success", data: { ok: true } });
  const connector = {
    get: jest.fn(async (url: string) => {
      if (url.endsWith("/signing-domain")) return domainResponse();
      return { status: "success", data: { url } };
    }),
    post: jest.fn(async (url: string, body: any, config: any) => {
      calls.push({ url, body, headers: config?.headers ?? {} });
      return postImpl(url, body);
    }),
  };
  Container.of(id).set(Connector, connector as unknown as Connector);
  const service = new IssueService(id);
  return { service, connector, calls, setPost: (f: typeof postImpl) => (postImpl = f) };
}

const recover = (call: { url: string; body: any; headers: Record<string, string> }, subject: string, chainId: number) =>
  verifyTypedData(
    { name: "Pakt Issue Resolution", version: "1", chainId },
    AGENT_ACTION_TYPES,
    {
      action: `POST ${call.url}`,
      subject,
      bodyHash: agentBodyHash(call.body),
      nonce: call.headers["x-agent-nonce"],
      expiry: Number(call.headers["x-agent-expiry"]),
    },
    call.headers["x-agent-signature"],
  );

describe("IssueService", () => {
  const wallet = Wallet.createRandom();

  it("refuses a signed write without a signer", async () => {
    const t = build(async () => ({ status: "success", data: { name: "Pakt Issue Resolution", version: "1", chainId: 8453 } }));
    const res = await t.service.juryAccept("abc");
    expect(res.status).toBe(Status.ERROR);
    expect(t.connector.post).not.toHaveBeenCalled();
  });

  it("signs each write with the server's domain, per request, never on shared headers", async () => {
    const t = build(async () => ({ status: "success", data: { name: "Pakt Issue Resolution", version: "1", chainId: 84532 } }));
    t.service.useSigner(wallet.privateKey);
    await t.service.juryCommit("abc", "f".repeat(64));
    await t.service.open({ jobId: "j1", title: "t", content: "c" });
    expect(t.calls[0].url).toBe("/v1/job-issues/abc/jury/commit");
    expect(recover(t.calls[0], "abc", 84532)).toBe(wallet.address);
    // POST /v1/job-issues has no :id, so the subject is "".
    expect(recover(t.calls[1], "", 84532)).toBe(wallet.address);
    // The domain is fetched once.
    expect(t.connector.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to chain 8453 on a server without the signing-domain route", async () => {
    const t = build(async () => {
      throw new SDKError("Issue not found", "REQUEST_ERROR", undefined, 404);
    });
    t.service.useSigner(wallet.privateKey);
    await t.service.withdraw("abc");
    expect(t.calls[0].url).toBe("/v1/job-issues/abc/withdraw");
    expect(recover(t.calls[0], "abc", 8453)).toBe(wallet.address);
  });

  it("re-signs with a fresh nonce when a write is retried after a server error", async () => {
    const t = build(async () => ({ status: "success", data: { name: "Pakt Issue Resolution", version: "1", chainId: 8453 } }));
    t.service.useSigner(wallet.privateKey);
    let n = 0;
    t.setPost(async () => {
      if (n++ === 0) throw new SDKError("bad gateway", "API_ERROR", undefined, 502);
      return { status: "success", data: { declined: true } };
    });
    const res = await t.service.juryDecline("abc");
    expect(res.data).toEqual({ declined: true });
    expect(t.calls).toHaveLength(2);
    expect(t.calls[0].headers["x-agent-nonce"]).not.toBe(t.calls[1].headers["x-agent-nonce"]);
  });

  it("does not retry a 4xx rejection", async () => {
    const t = build(async () => ({ status: "success", data: { name: "Pakt Issue Resolution", version: "1", chainId: 8453 } }));
    t.service.useSigner(wallet.privateKey);
    t.setPost(async () => {
      throw new SDKError("Already committed", "Conflict", undefined, 409);
    });
    const res = await t.service.juryCommit("abc", "f".repeat(64));
    expect(res.status).toBe(Status.ERROR);
    expect(res.message).toEqual(["Already committed"]);
    expect(t.calls).toHaveLength(1);
  });

  it("reads need no signer", async () => {
    const t = build(async () => ({}));
    const res = await t.service.evidence("abc");
    expect(res.data).toEqual({ url: "/v1/job-issues/abc/evidence" });
    const list = await t.service.list({ page: 2 });
    expect(list.data).toEqual({ url: "/v1/job-issues?page=2" });
  });
});
