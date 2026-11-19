// Job Terms v1: canonical encoding and hash.
//
//   metadataHash = keccak256(utf8(JCS(terms)))      JCS = RFC 8785
//
// The only way in is text: parseTerms(text) is a strict JSON parser that refuses floats and
// exponents (1.0, 1e0), duplicate keys and integers outside the safe range. JSON.parse cannot do
// this (it turns 1.0 into 1), so never hash a JSON.parse result of someone else's text.
import { keccak256, toUtf8Bytes } from "ethers";
import Ajv2020 from "ajv/dist/2020.js";
import { JOB_TERMS_SCHEMA } from "./schema";
import { UNICODE_RULES } from "./unicode-rules";

export const UNICODE_VERSION: string = UNICODE_RULES.unicodeVersion;
const IGNORABLE: [number, number][] = UNICODE_RULES.defaultIgnorable.map(([a, b]: string[]) => [
  parseInt(a, 16),
  parseInt(b, 16),
]);
const BLANK = new Set<number>(UNICODE_RULES.blankLetters.map((x: string) => parseInt(x, 16)));
export const ignorableRanges = (): [number, number][] => IGNORABLE.slice();

export const DEADLINE_MIN = 1767225600; // 2026-01-01T00:00:00Z
export const DEADLINE_MAX = 4102444800; // 2100-01-01T00:00:00Z

/** Thrown for terms that are incomplete or break a rule. `problems` lists every one. */
export class JobTermsError extends Error {
  public readonly problems: string[];
  constructor(problems: string[]) {
    super(`Job Terms v1 refused: ${problems.join("; ")}`);
    this.name = "JobTermsError";
    this.problems = problems;
  }
}

/**
 * The Unicode tables of the runtime that checks the text. `unicode` is its version; `isUnassigned` says whether one
 * character is unassigned there (default: \p{Cn}). Pass your own only to simulate another runtime in tests.
 */
export interface RuntimeUnicode {
  unicode?: string;
  isUnassigned?: (ch: string) => boolean;
}

export interface RuntimeReport {
  unicode: string;
  /** "full": Unicode 17.0. "assigned-only": older. "newer": newer than the pin, which is refused. */
  mode: "full" | "assigned-only" | "newer";
}

const CN = /^\p{Cn}$/u;

function modeFor(v: string | undefined): RuntimeReport["mode"] {
  const m = /^(\d+)\.(\d+)/.exec(String(v ?? ""));
  if (!m) return "assigned-only";
  const [pinMajor, pinMinor] = UNICODE_VERSION.split(".").map(Number);
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major === pinMajor && minor === pinMinor) return "full";
  return major > pinMajor || (major === pinMajor && minor > pinMinor) ? "newer" : "assigned-only";
}

/**
 * The rules are pinned to Unicode 17.0, which is "full" mode. Normalization stability (Unicode policy): NFC of an
 * assigned code point never changes in later versions. So on a runtime older than 17.0 the hash is identical, as
 * long as the text holds no code point that runtime treats as unassigned ("assigned-only" mode). A runtime newer
 * than 17.0 is "newer": its tables could classify characters differently from the pin, so it is refused.
 */
export function checkUnicodeVersion(runtime: RuntimeUnicode = {}): RuntimeReport {
  const unicode = runtime.unicode ?? (globalThis as any).process?.versions?.unicode;
  return { unicode: String(unicode ?? "unknown"), mode: modeFor(unicode) };
}

// ------------------------------------------------------------------ strict parse
export function parseTerms(text: string): unknown {
  let i = 0;
  const ws = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i++;
  };
  const fail = (m: string): never => {
    throw new JobTermsError([`${m} at ${i}`]);
  };
  const value = (): unknown => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const o: Record<string, unknown> = Object.create(null);
      ws();
      if (text[i] === "}") {
        i++;
        return o;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail("expected key");
        const k = str();
        ws();
        if (text[i++] !== ":") fail("expected :");
        if (Object.prototype.hasOwnProperty.call(o, k)) fail(`duplicate key ${JSON.stringify(k)}`);
        o[k] = value();
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return o;
        }
        fail("expected , or }");
      }
    }
    if (c === "[") {
      i++;
      const a: unknown[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return a;
      }
      for (;;) {
        a.push(value());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return a;
        }
        fail("expected , or ]");
      }
    }
    if (c === '"') return str();
    for (const [lit, litValue] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as [string, unknown][]) {
      if (text.startsWith(lit, i)) {
        i += lit.length;
        return litValue;
      }
    }
    const m = /^-?(0|[1-9][0-9]*)/.exec(text.slice(i));
    if (!m) fail("unexpected character");
    if (m![0] === "-0") fail("-0 is refused; write 0");
    i += m![0].length;
    if (text[i] === "." || text[i] === "e" || text[i] === "E") fail("floats and exponents are refused");
    const n = Number(m![0]);
    if (!Number.isSafeInteger(n)) fail("integer outside the safe range");
    return n;
  };
  const str = (): string => {
    let s = "";
    i++;
    for (;;) {
      if (i >= text.length) fail("unterminated string");
      const c = text[i++];
      if (c === '"') return s;
      if (c < " ") fail("raw control character in string");
      if (c !== "\\") {
        s += c;
        continue;
      }
      const e = text[i++];
      const simple: Record<string, string> = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      if (e in simple) s += simple[e];
      else if (e === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i, i + 4))) {
        s += String.fromCharCode(parseInt(text.slice(i, i + 4), 16));
        i += 4;
      } else fail("bad escape");
    }
  };
  const v = value();
  ws();
  if (i !== text.length) fail("trailing content");
  return v;
}

// ------------------------------------------------------------------ RFC 8785 (JCS), subset
export function jcs(v: unknown): string {
  if (v === null) throw new Error("null is not allowed in Job Terms");
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new Error(`not a safe integer: ${v}`);
    return String(v);
  }
  if (typeof v === "string") {
    if (/[\uD800-\uDFFF]/.test(v.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""))) {
      throw new Error("lone surrogate in string");
    }
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return "[" + v.map(jcs).join(",") + "]";
  if (typeof v === "object") {
    // Default sort compares UTF-16 code units, which is what RFC 8785 requires.
    const keys = Object.keys(v as object).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + jcs((v as any)[k])).join(",") + "}";
  }
  throw new Error(`unsupported type: ${typeof v}`);
}

// ------------------------------------------------------------------ rules beyond the schema
const BAD = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/u;
const ZS = /^\p{Zs}$/u;
const EDGE = /^[\p{Cc}\p{Zs}\p{Zl}\p{Zp}\p{Cf}]$/u;
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const HASH32 = /^0x[0-9a-f]{64}$/;
const MULTILINE = new Set([
  "description",
  "deliverables/*/description",
  "deliverables/*/acceptanceTest/check",
  "materials/*/description",
]);

function textProblems(s: string, path: (string | number)[], rt: RuntimeUnicode): string[] {
  const where = path.join("/");
  const norm = path.map((p) => (typeof p === "number" ? "*" : p)).join("/");
  const errs: string[] = [];
  if (s.normalize("NFC") !== s) errs.push(`${where}: not NFC`);
  const cps = Array.from(s);
  const report = checkUnicodeVersion(rt);
  if (report.mode === "assigned-only") {
    const unassigned = rt.isUnassigned ?? ((c: string) => CN.test(c));
    const bad = cps.find((c) => unassigned(c));
    if (bad !== undefined) {
      errs.push(
        `${where}: U+${bad.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")} is unassigned in this ` +
          `runtime's Unicode ${report.unicode}, so it cannot be checked or hashed here; ` +
          `check process.versions.unicode and use a Node that reports ${UNICODE_VERSION} ` +
          `(measured: Node 20.20+, 24.14+ and 26)`,
      );
      return errs;
    }
  }
  for (const ch of cps) {
    if (ch === "\n" && MULTILINE.has(norm)) continue;
    const cp = ch.codePointAt(0)!;
    const ign = BLANK.has(cp) || IGNORABLE.some(([a, b]) => cp >= a && cp <= b);
    if (BAD.test(ch) || ign || (ZS.test(ch) && ch !== " ")) {
      errs.push(`${where}: refused character U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
      break;
    }
  }
  if (s.includes("  ")) errs.push(`${where}: runs of spaces are refused`);
  if (s.includes("\n\n") || s.includes(" \n") || s.includes("\n ")) {
    errs.push(`${where}: blank lines and spaces next to a line break are refused`);
  }
  if (cps.length && (EDGE.test(cps[0]) || EDGE.test(cps[cps.length - 1]))) {
    errs.push(`${where}: leading or trailing whitespace`);
  }
  return errs;
}

function* strings(v: unknown, path: (string | number)[] = []): Generator<[(string | number)[], string]> {
  if (typeof v === "string") yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], [...path, i]);
  else if (v && typeof v === "object") for (const k of Object.keys(v)) yield* strings((v as any)[k], [...path, k]);
}

export function checkTerms(t: any, rt: RuntimeUnicode = {}): string[] {
  const errs: string[] = [];
  for (const [p, s] of strings(t)) errs.push(...textProblems(s, p, rt));
  const dl = t?.deadline;
  if (!(Number.isSafeInteger(dl) && dl >= DEADLINE_MIN && dl <= DEADLINE_MAX)) {
    errs.push(`deadline: must be unix seconds between ${DEADLINE_MIN} and ${DEADLINE_MAX}`);
  }
  const matIds = (t?.materials ?? []).map((m: any) => m?.id);
  const delIds = (t?.deliverables ?? []).map((d: any) => d?.id);
  for (const [field, ids] of [
    ["deliverables", delIds],
    ["materials", matIds],
  ] as [string, any[]][]) {
    if (new Set(ids).size !== ids.length) errs.push(`${field} ids must be unique`);
    for (const id of ids)
      if (!(typeof id === "string" && ID.test(id))) errs.push(`${field}: bad id ${JSON.stringify(id)}`);
  }
  const hashes = [...(t?.buildsOn ?? []), t?.statuteSetSha256, ...(t?.materials ?? []).map((m: any) => m?.sha256)];
  for (const h of hashes) if (!(typeof h === "string" && HASH32.test(h))) errs.push(`bad hash ${JSON.stringify(h)}`);
  if (new Set(t?.buildsOn ?? []).size !== (t?.buildsOn ?? []).length) errs.push("buildsOn entries must be unique");
  for (const d of t?.deliverables ?? []) {
    const at = d?.acceptanceTest ?? {};
    if (at.kind === "objective") {
      for (const ref of at.inputs ?? []) {
        if (!matIds.includes(ref)) errs.push(`deliverable ${d.id}: input ${JSON.stringify(ref)} is not a material`);
      }
      if (new Set(at.inputs ?? []).size !== (at.inputs ?? []).length)
        errs.push(`deliverable ${d.id}: inputs must be unique`);
    }
  }
  return errs;
}

let schemaCheck: any;
function schema(): any {
  if (!schemaCheck) schemaCheck = new (Ajv2020 as any)({ allErrors: true, strict: false }).compile(JOB_TERMS_SCHEMA);
  return schemaCheck;
}

function schemaProblems(check: any): string[] {
  return check.errors.map((e: any) => {
    const missing = e.keyword === "required" ? ` ("${e.params.missingProperty}")` : "";
    return `${e.instancePath || "(terms)"} ${e.message}${missing}`;
  });
}

/** Text in, canonical string out, or a JobTermsError listing every problem (incomplete terms are refused). */
export function canonicalTerms(text: string, rt: RuntimeUnicode = {}): string {
  const report = checkUnicodeVersion(rt);
  if (report.mode === "newer") {
    throw new JobTermsError([
      `this runtime's Unicode ${report.unicode} is newer than the pinned ${UNICODE_VERSION}; ` +
        `check process.versions.unicode and use a Node that reports ${UNICODE_VERSION} (measured: Node 20.20+, 24.14+ and 26)`,
    ]);
  }
  const t = parseTerms(text);
  const check = schema();
  const errs: string[] = [];
  if (!check(t)) errs.push(...schemaProblems(check));
  else errs.push(...checkTerms(t, rt)); // schema first, then the text rules
  if (errs.length) throw new JobTermsError(errs);
  return jcs(t);
}

/** 0x-prefixed lowercase hex keccak256 of a canonical string: the value for createEscrow's metadataHash. */
export function hashCanonical(canonical: string): string {
  return keccak256(toUtf8Bytes(canonical)).toLowerCase();
}

export function jobTermsHashFromText(text: string): string {
  return hashCanonical(canonicalTerms(text));
}

/**
 * Terms as text (the strict path) or as an object. An object is serialised with JSON.stringify and then
 * run through the same strict parser, schema and text rules; a float, NaN, undefined field or null in it
 * is refused like in text.
 */
export type JobTermsInput = string | object;

export function termsText(terms: JobTermsInput): string {
  if (typeof terms === "string") return terms;
  const text = JSON.stringify(terms);
  if (text === undefined) throw new JobTermsError(["terms must be a JSON object"]);
  return text;
}

/** Validate (schema, text rules, completeness) and return the canonical JCS string. */
export function canonicalizeJobTerms(terms: JobTermsInput, runtime?: RuntimeUnicode): string {
  return canonicalTerms(termsText(terms), runtime);
}

/** keccak256 of the canonical terms: the escrow's `metadataHash`. Refuses incomplete or rule-breaking terms. */
export function hashJobTerms(terms: JobTermsInput, runtime?: RuntimeUnicode): string {
  return hashCanonical(canonicalizeJobTerms(terms, runtime));
}
