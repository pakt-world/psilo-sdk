// Job Terms v1 JSON schema, as data (non-ASCII escaped).
// tslint:disable
export const JOB_TERMS_SCHEMA: any = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pakt:job-terms:v1:schema",
  title: "Pakt Job Terms v1",
  description:
    "The funded terms of one Pakt job. metadataHash = keccak256(utf8(RFC 8785 JCS(terms))). Every field is required unless marked; no floats, no nulls. Patterns end with (?![\\s\\S]), not $, so Python and JavaScript agree that a trailing newline is refused. NFC and the full Unicode category rules are enforced by check_terms in hash.py and checkTerms in hash.ts; the patterns here are the part a schema can express.",
  type: "object",
  additionalProperties: false,
  required: [
    "schema",
    "title",
    "description",
    "deliverables",
    "price",
    "deadline",
    "materials",
    "subcontractingAllowed",
    "buildsOn",
    "statuteSetSha256",
  ],
  $defs: {
    hash32: {
      type: "string",
      minLength: 66,
      maxLength: 66,
      pattern: "^0x[0-9a-f]{64}(?![\\s\\S])",
    },
    address: {
      type: "string",
      minLength: 42,
      maxLength: 42,
      pattern: "^0x[0-9a-f]{40}(?![\\s\\S])",
    },
    id: {
      type: "string",
      minLength: 1,
      maxLength: 32,
      pattern: "^[a-z0-9][a-z0-9-]{0,31}(?![\\s\\S])",
    },
    imageDigest: {
      type: "string",
      minLength: 73,
      maxLength: 255,
      pattern: "^[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:[0-9a-f]{64}(?![\\s\\S])",
      description:
        "OCI image by the digest of ONE single-platform manifest, never an index. No tag (tags move) and no registry port.",
    },
    objectiveTest: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "image", "platform", "command", "inputs", "timeoutSeconds", "expect"],
      description:
        "A proof recipe, as data: run `command` in `image` on `platform` with the named inputs, within `timeoutSeconds`. It passes when the exit code matches and, when given, the stdout sha256 matches. How the court weighs a proof made with it is evidence law for the court spec and statutes, not this format.",
      properties: {
        kind: {
          const: "objective",
        },
        image: {
          $ref: "#/$defs/imageDigest",
        },
        platform: {
          enum: ["linux/amd64", "linux/arm64"],
          description: "The platform the manifest digest was built for.",
        },
        command: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "string",
            minLength: 1,
            maxLength: 1000,
            pattern:
              "^(?![ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000])(?![\\s\\S]*[ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000](?![\\s\\S]))[^\\u0000-\\u001f\\u007f-\\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]*(?![\\s\\S])",
          },
        },
        inputs: {
          type: "array",
          maxItems: 50,
          uniqueItems: true,
          items: {
            $ref: "#/$defs/id",
          },
        },
        timeoutSeconds: {
          type: "integer",
          minimum: 1,
          maximum: 3600,
        },
        expect: {
          type: "object",
          additionalProperties: false,
          required: ["exitCode"],
          properties: {
            exitCode: {
              type: "integer",
              minimum: 0,
              maximum: 255,
            },
            stdoutSha256: {
              $ref: "#/$defs/hash32",
            },
          },
        },
      },
    },
    statedTest: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "check"],
      description: "A checkable statement in words. Only the panel can decide it; code never settles it.",
      properties: {
        kind: {
          const: "stated",
        },
        check: {
          type: "string",
          minLength: 1,
          maxLength: 2000,
          pattern:
            "^(?![ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000])(?![\\s\\S]*[ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000](?![\\s\\S]))[^\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]*(?![\\s\\S])",
        },
      },
    },
  },
  properties: {
    schema: {
      const: "pakt.job-terms/1",
    },
    title: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      pattern:
        "^(?![ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000])(?![\\s\\S]*[ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000](?![\\s\\S]))[^\\u0000-\\u001f\\u007f-\\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]*(?![\\s\\S])",
    },
    description: {
      type: "string",
      minLength: 0,
      maxLength: 5000,
      pattern:
        "^(?![\\s\\S])|^(?![ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000])(?![\\s\\S]*[ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000](?![\\s\\S]))[^\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]*(?![\\s\\S])",
    },
    deliverables: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "description", "acceptanceTest", "format", "quantity"],
        properties: {
          id: {
            $ref: "#/$defs/id",
          },
          description: {
            type: "string",
            minLength: 1,
            maxLength: 2000,
            pattern:
              "^(?![ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000])(?![\\s\\S]*[ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000](?![\\s\\S]))[^\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]*(?![\\s\\S])",
          },
          acceptanceTest: {
            oneOf: [
              {
                $ref: "#/$defs/objectiveTest",
              },
              {
                $ref: "#/$defs/statedTest",
              },
            ],
          },
          format: {
            type: "string",
            minLength: 1,
            maxLength: 200,
            pattern:
              "^(?![ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000])(?![\\s\\S]*[ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000](?![\\s\\S]))[^\\u0000-\\u001f\\u007f-\\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]*(?![\\s\\S])",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 1000000,
          },
        },
      },
    },
    price: {
      type: "object",
      additionalProperties: false,
      required: ["amount", "token", "chainId", "decimals"],
      properties: {
        amount: {
          type: "string",
          minLength: 1,
          maxLength: 78,
          pattern: "^[1-9][0-9]{0,77}(?![\\s\\S])",
          description: "Base units of the token, as a decimal string.",
        },
        token: {
          allOf: [
            {
              $ref: "#/$defs/address",
            },
            {
              not: {
                const: "0x0000000000000000000000000000000000000000",
              },
            },
          ],
          description: "ERC-20 address; the escrow refuses the native token (NativeNotSupported).",
        },
        chainId: {
          type: "integer",
          minimum: 1,
          maximum: 9007199254740991,
        },
        decimals: {
          type: "integer",
          minimum: 0,
          maximum: 36,
        },
      },
    },
    deadline: {
      type: "integer",
      minimum: 1767225600,
      maximum: 4102444800,
      description:
        "Unix SECONDS (2026-01-01 to 2100-01-01), measured against Avalanche C-Chain block timestamps: the deadline has passed at the first C-Chain block whose timestamp is greater than this value. Milliseconds are refused by the range.",
    },
    materials: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "description", "sha256", "providedBy", "confidential"],
        properties: {
          id: {
            $ref: "#/$defs/id",
          },
          description: {
            type: "string",
            minLength: 1,
            maxLength: 500,
            pattern:
              "^(?![ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000])(?![\\s\\S]*[ \\n\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000](?![\\s\\S]))[^\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]*(?![\\s\\S])",
          },
          sha256: {
            $ref: "#/$defs/hash32",
            description: "SHA-256 of the exact bytes, so any agent can check it with a standard tool.",
          },
          providedBy: {
            enum: ["buyer", "seller"],
            description:
              "Who supplied it: a test failing only on a broken buyer input counts as passed; confidentiality protects the other party's inputs.",
          },
          confidential: {
            type: "boolean",
          },
        },
      },
    },
    subcontractingAllowed: {
      type: "boolean",
    },
    buildsOn: {
      type: "array",
      maxItems: 20,
      uniqueItems: true,
      items: {
        $ref: "#/$defs/hash32",
      },
      description: "metadataHash of each earlier job this job builds on.",
    },
    statuteSetSha256: {
      $ref: "#/$defs/hash32",
      description: "0x + the sha256 of the statute-set manifest in force when the job is funded.",
    },
  },
};
