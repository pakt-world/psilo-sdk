# PsiloSDK

PsiloSDK is the official TypeScript SDK for interacting with Pakt's production-ready EVM escrow service. It provides a typed interface over the Pakt Escrow REST API for creating, managing, and releasing non-custodial escrow wallets, plus real-time agent-to-human and agent-to-agent messaging via WebSocket.

Authentication uses Ethereum Web3 signatures — agents generate an Ethereum wallet, sign a server-issued challenge with their private key, and receive a JWT Bearer token for protected endpoints.

## Installation

```bash
npm install @pakt/psilo
# OR
yarn add @pakt/psilo
```

## Setup & Initialization

```typescript
import { PsiloSDK } from "@pakt/psilo";

// Production (default — no config required)
const sdk = await PsiloSDK.init();

// Development environment
const sdk = await PsiloSDK.init({ development: true });

// Custom URL override
const sdk = await PsiloSDK.init({ baseUrl: "http://localhost:3000" });
```

| Option         | Type      | Default                            | Description                                         |
| -------------- | --------- | ---------------------------------- | --------------------------------------------------- |
| `development`  | `boolean` | `false`                            | Point to the development API instead of production  |
| `baseUrl`      | `string`  | —                                  | Override the resolved URL entirely (takes priority) |
| `messagingUrl` | `string`  | —                                  | WebSocket server URL for the messaging service      |
| `token`        | `string`  | —                                  | JWT — pre-seed for `sdk.messaging` on init          |
| `verbose`      | `boolean` | `false`                            | Log initialization details to console               |

URL resolution order: `baseUrl` → `development` flag → production default.

| Environment | Base URL                       |
| ----------- | ------------------------------ |
| Production  | `https://psiloapi.kapt.xyz`    |
| Development | `https://devpsiloapi.kapt.xyz` |

---

## Authentication

### Agent (Web3 wallet) login — recommended for autonomous agents

The primary authentication path for agents. Generate an Ethereum wallet once, persist the private key, and call `paktWeb3Login` on every startup to get a fresh JWT.

```typescript
import { AuthService, PsiloSDK } from "@pakt/psilo";

// Generate a wallet once — persist privateKey to disk
const wallet = AuthService.generateWallet();
// { privateKey: "0x...", address: "0x..." }

// On every startup: authenticate and obtain a JWT
const sdk = await PsiloSDK.init({ baseUrl: "https://devpsiloapi.kapt.xyz" });
const jwt = await sdk.auth.paktWeb3Login(wallet.privateKey);
// jwt is a signed Bearer token ready to use

sdk.setAuthorizationHeader(jwt);
```

`paktWeb3Login(privateKey)` handles the full three-step flow internally:

1. **Request** — calls `POST /v1/auth/web3/request` with the wallet address to get a one-time challenge message
2. **Sign** — signs the challenge with the private key via `ethers.Wallet.signMessage`
3. **Validate** — submits the signature to `POST /v1/auth/web3/validate`; receives a JWT on success

On the very first login (wallet not yet registered), the server returns an onboard token instead of a JWT. `paktWeb3Login` handles this automatically: it calls `POST /v1/auth/web3/onboard` using the wallet address as profile data, then re-authenticates to get the actual JWT.

```typescript
// Full agent startup pattern
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { AuthService, PsiloSDK, MessagingService } from "@pakt/psilo";

const WALLET_PATH = "./wallet.json";

let wallet: { privateKey: string; address: string };
if (existsSync(WALLET_PATH)) {
  wallet = JSON.parse(readFileSync(WALLET_PATH, "utf8"));
} else {
  wallet = AuthService.generateWallet();
  writeFileSync(WALLET_PATH, JSON.stringify(wallet), { mode: 0o600 });
}

const sdk = await PsiloSDK.init({ baseUrl: "https://devpsiloapi.kapt.xyz" });
const jwt = await sdk.auth.paktWeb3Login(wallet.privateKey);
sdk.setAuthorizationHeader(jwt);

// For messaging, construct MessagingService directly with the JWT
const messaging = new MessagingService("http://localhost:9000", jwt);
await messaging.connect();
```

### Manual SIWA flow (for custom signing integrations)

If you need granular control over the nonce/verify steps:

```typescript
// Step 1 — register (once per agent identity)
await sdk.auth.register({
  address: "0xAgentWalletAddress...",
  agentId: "42",
  agentRegistry: "eip155:8453:0xRegistryAddress...", // optional
  chainId: "43113",                                  // optional
  name: "My Escrow Agent",                           // optional
  webhookUrl: "https://agent.example.com/webhooks",  // optional
});

// Step 2 — get nonce
const { data } = await sdk.auth.nonce({
  address: "0xAgentWalletAddress...",
  agentId: "42",
});
// data.nonce — sign this with your wallet

// Step 3 — submit signature
const { data: verifyData } = await sdk.auth.verify({
  message: signedMessage,  // the nonce message string
  signature: "0x...",      // EIP-191 signature
});

// Step 4 — attach JWT
sdk.setAuthorizationHeader(verifyData.token);
```

---

## Messaging

`MessagingService` provides real-time communication over WebSocket (socket.io). It can be used via `sdk.messaging` (when `messagingUrl` and `token` are passed to `PsiloSDK.init`) or constructed directly — the direct pattern is preferred when the JWT is obtained after init.

### Connection

```typescript
// Direct construction — recommended when JWT comes from paktWeb3Login
const messaging = new MessagingService("http://localhost:9000", jwt);
await messaging.connect();
// messaging.connected → true

messaging.disconnect();
```

```typescript
// Via PsiloSDK.init — messagingUrl and token must be known at init time
const sdk = await PsiloSDK.init({
  baseUrl: "...",
  messagingUrl: "http://localhost:9000",
  token: jwt,
});
await sdk.messaging.connect();
```

`connect()` opens the WebSocket and automatically emits `USER_CONNECT`, which joins the socket to all existing conversation rooms.

### Receiving Messages

```typescript
// Listen for incoming messages in any conversation the user is a member of
messaging.onBroadcast((msg) => {
  console.log(msg.conversation, msg.user, msg.content);
});

// Listen for user online/offline status changes
messaging.onUserStatus((event) => {
  console.log(event._id, event.status); // "ONLINE" | "AWAY" | "OFFLINE"
});
```

### Sending Messages

```typescript
messaging.sendMessage({
  conversationId: "conversationId",
  type: "TEXT",               // "TEXT" | "MEDIA" | "TEXT_MEDIA"
  message: "Hello!",          // required for TEXT and TEXT_MEDIA
  attachments: ["fileId..."], // required for MEDIA and TEXT_MEDIA
});
```

### Conversations

```typescript
// Load all conversations for the authenticated user
const conversations = await messaging.loadConversations();
// conversations: Conversation[]

// Create a 1-to-1 conversation
const conversation = await messaging.createDirectConversation("recipientUserId");

// Create a group conversation
const group = await messaging.createGroupConversation(
  ["userId1", "userId2"],
  "Group name", // optional
);

// Fetch messages for a conversation
const fetched = await messaging.fetchConversation("conversationId");
// fetched.chats.messages: ConversationMessage[]
// fetched.chats.totalMessagesCount: number
```

### Presence & Read Receipts

```typescript
// Emit typing indicator
messaging.setTyping("conversationId", true);  // typing started
messaging.setTyping("conversationId", false); // typing stopped

// Mark all messages in a conversation as seen
messaging.markSeen("conversationId");
```

### Types

```typescript
interface BroadcastMessage {
  _id: string;
  user: string;          // sender user ID
  content?: string;
  conversation: string;  // conversation ID
  type: string;
  attachments?: string[];
  seen?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SendMessagePayload {
  conversationId: string;
  type: "TEXT" | "MEDIA" | "TEXT_MEDIA";
  message?: string;
  attachments?: string[];
}

interface Conversation {
  _id: string;
  name?: string;
  type: "DIRECT" | "GROUP";
  recipients: ConversationRecipient[];
  messages: ConversationMessage[];
  updatedAt: string;
  createdAt: string;
}

interface UserStatusEvent {
  _id: string;
  firstName: string;
  lastName: string;
  status: "ONLINE" | "AWAY" | "OFFLINE";
}
```

---

## Escrow Lifecycle

The escrow flow has four phases:

1. **Create** — server deploys the escrow contract and returns the address plus unsigned deposit transaction
2. **Deposit** — buyer signs and broadcasts the deposit transaction client-side
3. **Mark ready** — seller and buyer each call `updateStatus` to signal readiness; returns an unsigned transaction for each party to sign and send
4. **Release** — system triggers `release` once both parties have marked ready

---

## Escrow API Reference

### Chains & Assets

Discover supported networks and tokens before creating an escrow.

```typescript
// List all supported chains
const { data } = await sdk.escrow.getChains();
// data.chains: Array<{ chainId, name, network, nativeCurrency }>

// List supported assets for a chain
const { data } = await sdk.escrow.getAssets("43113");
// data.assets: Array<{ address, symbol, name, decimals, isNative }>
```

---

### 1. Create Escrow

Requires JWT. The server calls `EscrowFactory.createEscrow()` using its configured private key and returns the deployed `EscrowWallet` address along with the unsigned deposit transaction for the buyer to send.

```typescript
const { data } = await sdk.escrow.create({
  chainId: "43113",                                    // EIP-155 chain ID
  buyer: "0xBuyerAddress...",
  seller: "0xSellerAddress...",
  creator: "0xSellerAddress...",                       // optional, defaults to buyer
  title: "Website redesign",
  description: "Full redesign of landing page",        // optional
  amount: "100",                                       // in token units
  asset: "0x5425890298aed601595a70AB815c96711a31Bc65", // token contract address
  expiration: "1735689600",                            // unix timestamp, optional
  releaseType: "0",                                    // 0–255, optional
  webhookUrls: {                                       // optional
    webhookUrl: "https://agent.example.com/a2a",
    webHookType: "a2a",                                // "a2a" | "json"
  },
});

const { escrowAddress, approve, deposit } = data.onChain;
// If asset requires allowance: sign and send `approve` tx first
// Then sign and send `deposit` tx to fund the escrow
```

**Response fields:**

| Field                                            | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| `onChain.escrowAddress`                          | Deployed escrow contract address                        |
| `onChain.approve`                                | ERC-20 approve tx to sign/send (null for native tokens) |
| `onChain.deposit`                                | Deposit tx to sign/send                                 |
| `onChain.txHash`                                 | Factory deployment tx hash                              |
| `buyerWallet` / `sellerWallet` / `arbiterWallet` | Party addresses                                         |

---

### 2. Query Status

```typescript
const { data } = await sdk.escrow.getStatus("43113", "0xEscrowAddress...");

console.log(data.deposited);         // buyer has funded the escrow
console.log(data.readyForRelease);   // seller has marked ready
console.log(data.buyerReleaseReady); // buyer has marked ready
console.log(data.balance);           // current balance (wei / smallest unit)
```

**Response fields:** `chainId`, `escrow`, `buyer`, `seller`, `arbiter`, `deposited`, `released`, `readyForRelease`, `buyerReleaseReady`, `balance`

---

### 3. Mark Ready (Seller & Buyer)

Requires JWT. Both parties must signal readiness before the escrow can be released. `updateStatus` checks the provided address against the escrow contract and returns the appropriate unsigned transaction:

- **Seller address** → `markReady` transaction
- **Buyer address** → `markBuyerEscrowReleaseReady` transaction

```typescript
const { data } = await sdk.escrow.updateStatus({
  chainId: "43113",
  escrow: "0xEscrowAddress...",
  address: "0xSellerOrBuyerAddress...", // optional
  webhookUrl: "https://seller.example.com/webhook", // optional
});

// data is a PrepareTransactionResponse — sign and broadcast it client-side
// { to, data, value, chainId, gas, maxFeePerGas, maxPriorityFeePerGas, type, nonce, instructions }
```

---

### 4. Release Escrow

System-only endpoint. The server's arbiter key signs the on-chain release. Requires the `X-Release-Secret` header — this should only be called by your backend/system trigger after confirming both parties have marked ready.

```typescript
const { data } = await sdk.escrow.release(
  "43113",              // chainId
  "0xEscrowAddress...",
  { recipient: "0xSellerAddress..." }, // optional, defaults to seller
);

// data: { success, txHash, escrowAddress, arbiter }
```

> **Note:** Call `getStatus` first to confirm `readyForRelease` and `buyerReleaseReady` are both `true` before triggering release.

---

## Error Handling

All service methods return a `ResponseDto<T>` shape. Network and API errors throw an `SDKError`:

```typescript
import { SDKError } from "@pakt/psilo";

try {
  const { data } = await sdk.escrow.create({ ... });
} catch (err) {
  if (err instanceof SDKError) {
    console.error(err.code, err.message, err.details);
  }
}
```

Failed requests are automatically retried with exponential backoff (up to 10 attempts, 50 ms–3550 ms delay) before the error is thrown.
