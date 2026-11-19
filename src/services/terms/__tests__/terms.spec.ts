// The files in ../vectors are the Job Terms v1 reference vectors, copied verbatim.
import { readFileSync } from "fs";
import { join } from "path";
import { AbiCoder, Interface, TypedDataEncoder, Wallet } from "ethers";
import {
  attestEscrowTerms,
  hashJobTerms,
  canonicalizeJobTerms,
  hashCanonicalJobTerms,
  parseJobTerms,
  JobTermsError,
  signJobTerms,
  verifyJobTermsSignature,
  jobTermsDomain,
  jobTermsMessage,
  JOB_TERMS_TYPES,
  JOB_TERMS_UNICODE_VERSION,
  checkJobTermsRuntime,
} from "../index";
import { jcs, ignorableRanges } from "../hash";

// tslint:disable-next-line:no-var-requires
const canonMod = require("canonicalize");
const canonicalize: any = canonMod.default ?? canonMod;
const read = (p: string) => readFileSync(join(__dirname, "..", "vectors", p), "utf8");
const VECTOR = read("v1-basic.json");
const EXPECTED = JSON.parse(read("expected.json"));
const CASES = JSON.parse(read("cases.json"));

describe("hashJobTerms", () => {
  it("reproduces vectors/expected.json for v1-basic.json", () => {
    expect(hashJobTerms(VECTOR)).toBe(EXPECTED["v1-basic_keccak256"]);
  });

  it("gives the same hash for the parsed object as for the text", () => {
    expect(hashJobTerms(JSON.parse(VECTOR))).toBe(EXPECTED["v1-basic_keccak256"]);
  });

  it("reproduces the keccak256 test values in expected.json", () => {
    expect(hashCanonicalJobTerms("")).toBe(EXPECTED.keccak256_empty);
    expect(hashCanonicalJobTerms("abc")).toBe(EXPECTED.keccak256_abc);
    expect(hashCanonicalJobTerms("a".repeat(200))).toBe(EXPECTED.keccak256_a_x200);
  });

  it("agrees with canonicalize@2.0.0 (RFC 8785 reference) on the vector and 500 random documents", () => {
    expect(jcs(parseJobTerms(VECTOR))).toBe((canonicalize as any)(JSON.parse(VECTOR)));
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const alpha = ["a", "Z", "é", "\u0001", "\u001f", "\u007f", " ", "ﬁ", "😀", '"', "\\", "\n", "\t", " ", "0"];
    const s = () =>
      Array.from({ length: Math.floor(rnd() * 7) }, () => alpha[Math.floor(rnd() * alpha.length)]).join("");
    const val = (d: number): unknown => {
      const r = rnd();
      if (d > 3 || r < 0.3) return s();
      if (r < 0.45) return Math.floor((rnd() - 0.5) * 2 ** 53);
      if (r < 0.55) return rnd() < 0.5;
      if (r < 0.75) return Array.from({ length: Math.floor(rnd() * 4) }, () => val(d + 1));
      return Object.fromEntries(Array.from({ length: Math.floor(rnd() * 5) }, () => [s(), val(d + 1)]));
    };
    for (let i = 0; i < 500; i++) {
      const v = val(0);
      expect(jcs(v)).toBe((canonicalize as any)(v));
    }
  });

  it("strict parse refuses quantity 1.0, 1e0, a float deadline and duplicate keys", () => {
    const pairs = [
      ['"quantity": 3', '"quantity": 1.0'],
      ['"quantity": 3', '"quantity": 1e0'],
      ['"deadline": 1798761600', '"deadline": 1798761600.5'],
      ['"quantity": 3', '"quantity": 3, "quantity": 3'],
    ];
    for (const [a, b] of pairs) {
      expect(VECTOR).toContain(a);
      expect(() => hashJobTerms(VECTOR.replace(a, b))).toThrow(JobTermsError);
    }
    expect(JSON.parse('{"q":1.0}').q).toBe(1); // why JSON.parse is never used for terms
  });

  it(`accepts and refuses exactly the ${CASES.cases.length} documents in vectors/cases.json`, () => {
    expect(CASES.cases.length).toBe(56);
    for (const c of CASES.cases) {
      let text = VECTOR;
      for (const [o, n] of c.replace) {
        expect(text.includes(o)).toBe(true);
        text = text.replace(o, n);
      }
      let ok = true;
      try {
        canonicalizeJobTerms(text);
      } catch (e) {
        ok = false;
      }
      expect([c.name, ok]).toEqual([c.name, c.valid]);
    }
  });

  it("refuses incomplete terms: a deliverable without an acceptance test, naming the field", () => {
    const t = JSON.parse(VECTOR);
    delete t.deliverables[0].acceptanceTest;
    let err: any;
    try {
      hashJobTerms(t);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(JobTermsError);
    expect(err.message).toContain("acceptanceTest");
    expect(err.problems.length).toBeGreaterThan(0);
    // other missing fields are refused too
    for (const field of ["deadline", "price", "materials", "statuteSetSha256", "subcontractingAllowed", "buildsOn"]) {
      const u = JSON.parse(VECTOR);
      delete u[field];
      expect(() => hashJobTerms(u)).toThrow(field);
    }
    // an empty deliverables list is not a contract either
    const e2 = JSON.parse(VECTOR);
    e2.deliverables = [];
    expect(() => hashJobTerms(e2)).toThrow(JobTermsError);
  });

  it("reports the runtime's Unicode and mode instead of throwing", () => {
    expect(JOB_TERMS_UNICODE_VERSION).toBe("17.0");
    expect(checkJobTermsRuntime({ unicode: "17.0" })).toEqual({ unicode: "17.0", mode: "full" });
    expect(checkJobTermsRuntime({ unicode: "17.1" }).mode).toBe("newer");
    expect(checkJobTermsRuntime({ unicode: "18.0" }).mode).toBe("newer");
    expect(checkJobTermsRuntime({ unicode: "16.0" })).toEqual({ unicode: "16.0", mode: "assigned-only" });
    expect(checkJobTermsRuntime({ unicode: "15.1" }).mode).toBe("assigned-only");
    expect(checkJobTermsRuntime({ unicode: "" }).mode).toBe("assigned-only");
    expect(checkJobTermsRuntime().mode).toBe(process.versions.unicode >= "17.0" ? "full" : "assigned-only");
  });

  it("refuses a runtime whose Unicode is newer than the pinned 17.0", () => {
    for (const unicode of ["17.1", "18.0"]) {
      expect(() => hashJobTerms(VECTOR, { unicode })).toThrow(JobTermsError);
      expect(() => hashJobTerms(VECTOR, { unicode })).toThrow(
        /newer than the pinned 17\.0.*process\.versions\.unicode/,
      );
    }
    expect(hashJobTerms(VECTOR, { unicode: "17.0" })).toBe(EXPECTED["v1-basic_keccak256"]);
  });

  it("default unassigned check (no injection): U+0378 on a simulated 16.0 runtime is refused with the runtime message", () => {
    // U+0378 is unassigned in every Unicode version, so the default \p{Cn} test of the runtime sees it.
    const text = VECTOR.replace("Landing page for a caf\u00e9", "Landing \u0378 page");
    let err: any;
    try {
      hashJobTerms(text, { unicode: "16.0" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(JobTermsError);
    expect(err.message).toContain("U+0378 is unassigned in this runtime's Unicode 16.0");
    expect(err.message).toContain("process.versions.unicode");
  });

  describe("older runtime (simulated by injecting its Unicode version and which characters it has not assigned)", () => {
    // Stand-in for a character assigned in Unicode 17 but not in the simulated 16.0 runtime.
    const NEWER = "\u{1F680}";
    const old = { unicode: "16.0", isUnassigned: (c: string) => c === NEWER || /^\p{Cn}$/u.test(c) };
    const withText = (a: string, b: string) => VECTOR.replace(a, b);

    it("hashes the vector identically to full mode", () => {
      expect(hashJobTerms(VECTOR, old)).toBe(EXPECTED["v1-basic_keccak256"]);
      expect(hashJobTerms(VECTOR, old)).toBe(hashJobTerms(VECTOR, { unicode: "17.0" }));
    });

    it("hashes ASCII and Latin-1 terms identically to full mode", () => {
      for (const title of ["Plain ascii title", "Caf\u00e9 cr\u00e8me br\u00fbl\u00e9e \u00f1 \u00df \u00a9"]) {
        const text = withText("Landing page for a caf\u00e9", title);
        expect(hashJobTerms(text, old)).toBe(hashJobTerms(text, { unicode: "17.0" }));
      }
    });

    it("refuses a code point unassigned in that runtime, naming its Unicode version", () => {
      const text = withText("Landing page for a caf\u00e9", `Landing ${NEWER} page`);
      expect(() => hashJobTerms(text, { unicode: "17.0", isUnassigned: old.isUnassigned })).not.toThrow(); // full mode
      let err: any;
      try {
        hashJobTerms(text, old);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(JobTermsError);
      expect(err.message).toContain("unassigned");
      expect(err.message).toContain("Unicode 16.0");
      expect(err.message).toContain("process.versions.unicode");
    });
  });

  it("unicode-rules defaultIgnorable equals the runtime's Default_Ignorable_Code_Point", () => {
    const re = /\p{Default_Ignorable_Code_Point}/u;
    const ranges = ignorableRanges();
    for (let c = 0; c <= 0x10ffff; c++) {
      if (c >= 0xd800 && c <= 0xdfff) continue;
      const listed = ranges.some(([a, b]) => c >= a && c <= b);
      if (listed !== re.test(String.fromCodePoint(c))) throw new Error(`U+${c.toString(16)} differs`);
    }
  });
});

const ESCROW = "0x000000000000000000000000000000000000dEaD";
const eoaProvider = { getCode: async () => "0x", call: async () => "0x" } as any;

describe("signJobTerms / verifyJobTermsSignature (EIP-712)", () => {
  it("signs readable title, price and deadline with the hash; tampering fails", async () => {
    const canonical = canonicalizeJobTerms(VECTOR);
    const w = new Wallet("0x" + "11".repeat(32));
    const msg = jobTermsMessage(canonical, ESCROW);
    expect(msg.title).toBe("Landing page for a café");
    expect(msg.amount).toBe(BigInt(500000000));
    expect(msg.deadline).toBe(BigInt(1798761600));
    expect(msg.metadataHash).toBe(EXPECTED["v1-basic_keccak256"]);
    const sig = await signJobTerms(VECTOR, w, ESCROW);
    // same bytes as signing the typed data directly with the documented domain and types
    expect(sig).toBe(await w.signTypedData(jobTermsDomain(43114, ESCROW), JOB_TERMS_TYPES, msg));
    const base = {
      provider: eoaProvider,
      chainId: 43114,
      escrow: ESCROW,
      terms: VECTOR,
      signer: w.address,
      signature: sig,
    };
    expect(await verifyJobTermsSignature(base)).toEqual({ ok: true, method: "eip712" });
    const other = VECTOR.replace("café", "bistro");
    expect((await verifyJobTermsSignature({ ...base, terms: other })).ok).toBe(false);
    expect((await verifyJobTermsSignature({ ...base, escrow: "0x000000000000000000000000000000000000bEEF" })).ok).toBe(
      false,
    );
    expect((await verifyJobTermsSignature({ ...base, chainId: 1 })).ok).toBe(false);
    expect((await verifyJobTermsSignature({ ...base, signer: new Wallet("0x" + "44".repeat(32)).address })).ok).toBe(
      false,
    );
    expect(() => jobTermsMessage(" " + canonical, ESCROW)).toThrow();
  });

  it("never signs incomplete terms", async () => {
    const t = JSON.parse(VECTOR);
    delete t.deliverables[1].acceptanceTest;
    await expect(signJobTerms(t, new Wallet("0x" + "11".repeat(32)), ESCROW)).rejects.toThrow(JobTermsError);
  });

  it("ERC-1271: a contract wallet is asked isValidSignature over the typed-data digest", async () => {
    const canonical = canonicalizeJobTerms(VECTOR);
    const wallet = "0x00000000000000000000000000000000000c0de1";
    const digest = TypedDataEncoder.hash(
      jobTermsDomain(43114, ESCROW),
      JOB_TERMS_TYPES,
      jobTermsMessage(canonical, ESCROW),
    );
    const iface = new Interface(["function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"]);
    const contract = (magicFor: string) =>
      ({
        getCode: async () => "0x6080",
        call: async (tx: any) => {
          const [h] = iface.decodeFunctionData("isValidSignature", tx.data);
          return AbiCoder.defaultAbiCoder().encode(["bytes4"], [h === magicFor ? "0x1626ba7e" : "0xffffffff"]);
        },
      } as any);
    const args = { chainId: 43114, escrow: ESCROW, terms: VECTOR, signer: wallet, signature: "0x1234" };
    expect(await verifyJobTermsSignature({ ...args, provider: contract(digest) })).toEqual({
      ok: true,
      method: "erc1271",
    });
    expect((await verifyJobTermsSignature({ ...args, provider: contract("0x" + "00".repeat(32)) })).ok).toBe(false);
  });

  it("EIP-7702 delegated EOA: a valid ECDSA signature verifies; a bad one falls through to ERC-1271", async () => {
    const w = new Wallet("0x" + "22".repeat(32));
    const sig = await signJobTerms(VECTOR, w, ESCROW);
    const delegated = {
      getCode: async () => "0xef0100" + "ab".repeat(20),
      call: async () => AbiCoder.defaultAbiCoder().encode(["bytes4"], ["0xffffffff"]),
    } as any;
    const args = { provider: delegated, chainId: 43114, escrow: ESCROW, terms: VECTOR, signer: w.address };
    expect(await verifyJobTermsSignature({ ...args, signature: sig })).toEqual({ ok: true, method: "eip712" });
    const other = await signJobTerms(VECTOR, new Wallet("0x" + "33".repeat(32)), ESCROW);
    expect(await verifyJobTermsSignature({ ...args, signature: other })).toEqual({ ok: false, method: "erc1271" });
  });
});

describe("attestEscrowTerms", () => {
  const W = new Interface([
    "function metadataHash() view returns (bytes32)",
    "function factory() view returns (address)",
    "function isEscrow(address) view returns (bool)",
  ]);
  const A_ESCROW = "0x00000000000000000000000000000000000e5c20";
  const FACTORY = "0x00000000000000000000000000000000000fac70";
  const HASH = EXPECTED["v1-basic_keccak256"];
  const OTHER = VECTOR.replace("café", "bistro");
  function mock(opts: { createdAt: number; hash: string; factory?: string; listed?: boolean; chainId?: bigint }) {
    return {
      getNetwork: async () => ({ chainId: opts.chainId ?? BigInt(43114) }),
      getBlock: async (n: number) => (n <= 100 ? { hash: "0x" + n.toString(16).padStart(64, "0") } : null),
      getCode: async (_a: string, n: number) => (n >= opts.createdAt ? "0x6080" : "0x"),
      call: async (tx: any) => {
        const fn = W.getFunction(tx.data.slice(0, 10))!.name;
        if (fn === "isEscrow") {
          if (tx.to.toLowerCase() !== FACTORY) throw new Error("isEscrow asked of the wrong contract");
          return AbiCoder.defaultAbiCoder().encode(["bool"], [opts.listed ?? true]);
        }
        return fn === "factory"
          ? AbiCoder.defaultAbiCoder().encode(["address"], [opts.factory ?? FACTORY])
          : AbiCoder.defaultAbiCoder().encode(["bytes32"], [opts.hash]);
      },
    } as any;
  }
  const base = { escrow: A_ESCROW, terms: VECTOR, factory: FACTORY };

  it("match, mismatch, deterministic attestation hash, no escrow address in it", async () => {
    const p = mock({ createdAt: 8, hash: HASH });
    const a = await attestEscrowTerms({ ...base, provider: p, blockNumber: 8 });
    expect(a.attestation.match).toBe(true);
    expect(a.attestation.termsKeccak256).toBe(HASH);
    expect(JSON.stringify(a.attestation).toLowerCase()).not.toContain(A_ESCROW.slice(2));
    const again = await attestEscrowTerms({ ...base, provider: p, blockNumber: 8 });
    expect(again.attestationKeccak256).toBe(a.attestationKeccak256);
    expect((await attestEscrowTerms({ ...base, provider: p, blockNumber: 8, terms: OTHER })).attestation.match).toBe(
      false,
    );
  });

  it("refuses a block before the escrow, a missing block, a block tag, an unlisted escrow, a wrong factory or chain", async () => {
    const p = mock({ createdAt: 8, hash: HASH });
    await expect(attestEscrowTerms({ ...base, provider: p, blockNumber: 7 })).rejects.toThrow(/no escrow contract/);
    await expect(attestEscrowTerms({ ...base, provider: p, blockNumber: 101 })).rejects.toThrow(/not found/);
    await expect(attestEscrowTerms({ ...base, provider: p, blockNumber: "latest" as any })).rejects.toThrow(
      /block number/,
    );
    await expect(
      attestEscrowTerms({ ...base, provider: mock({ createdAt: 8, hash: HASH, listed: false }), blockNumber: 8 }),
    ).rejects.toThrow(/isEscrow/);
    await expect(
      attestEscrowTerms({ escrow: A_ESCROW, terms: VECTOR, provider: p, blockNumber: 8 } as any),
    ).rejects.toThrow(/factory address is required/);
    await expect(
      attestEscrowTerms({
        ...base,
        provider: mock({ createdAt: 8, hash: HASH, chainId: BigInt(31337) }),
        blockNumber: 8,
      }),
    ).rejects.toThrow(/terms' chain/);
    await expect(
      attestEscrowTerms({ ...base, provider: mock({ createdAt: 8, hash: HASH, factory: A_ESCROW }), blockNumber: 8 }),
    ).rejects.toThrow(/factory/);
  });

  it("passes the stated block number to every chain read", async () => {
    const seen: [string, any][] = [];
    const inner = mock({ createdAt: 8, hash: HASH });
    const provider = {
      getNetwork: inner.getNetwork,
      getBlock: async (n: any) => (seen.push(["getBlock", n]), inner.getBlock(n)),
      getCode: async (a: string, n: any) => (seen.push(["getCode", n]), inner.getCode(a, n)),
      call: async (tx: any) => (seen.push(["call", tx.blockTag]), inner.call(tx)),
    } as any;
    await attestEscrowTerms({ ...base, provider, blockNumber: 8 });
    expect(seen.filter(([k]) => k === "call").length).toBe(3); // isEscrow, factory(), metadataHash()
    expect(seen.length).toBe(5);
    for (const [, tag] of seen) expect(tag).toBe(8);
  });

  it("refuses incomplete terms before reading the chain", async () => {
    const t = JSON.parse(VECTOR);
    delete t.deliverables[0].acceptanceTest;
    await expect(
      attestEscrowTerms({ ...base, provider: mock({ createdAt: 8, hash: HASH }), blockNumber: 8, terms: t }),
    ).rejects.toThrow(JobTermsError);
  });
});
