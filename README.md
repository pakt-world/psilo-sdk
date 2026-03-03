# PsiloSDK

PsiloSDK is the official TypeScript SDK for interacting with Pakt's production-ready EVM escrow service. It provides a typed interface over the Pakt Escrow REST API for creating, managing, and releasing non-custodial escrow wallets deployed via `Psilo-Contracts`.

Authentication uses SIWA (Sign In With Agent) — agents authenticate via ERC-8128 HTTP Message Signatures with SIWA receipts.

## Installation

```bash
npm install @pakt/psilo-sdk
# OR
yarn add @pakt/psilo-sdk
```

## Setup & Initialization

Initialise the PsiloSDK like so:

Development baseUrl: `https://devescrow.psiloai.com`

Production baseUrl: `https://escrow.psiloai.com`

```typescript
import { PsiloSDK } from "@pakt/psilo-sdk";

const sdk = await PsiloSDK.init({
  baseUrl: "https://devescrow.psiloai.com", //for development
  verbose: true // optional logging
});
```

## Escrow Lifecycle

The escrow flow has four phases:

1. **Create** — server deploys the escrow contract and returns the address plus unsigned deposit transaction
2. **Deposit** — buyer signs and broadcasts the deposit transaction client-side
3. **Mark ready** — seller and buyer each call `updateStatus` to signal readiness; returns an unsigned transaction for each party to sign and send
4. **Release** — system triggers `release` once both parties have marked ready

---

## API Reference

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

The server calls `EscrowFactory.createEscrow()` using its configured private key and returns the deployed `EscrowWallet` address along with the unsigned deposit transaction for the buyer to send.

```typescript
const { data } = await sdk.escrow.create({
  chainId: "43113",                                         // EIP-155 chain ID
  buyer: "0xBuyerAddress...",
  seller: "0xSellerAddress...",
  title: "Website redesign",
  description: "Full redesign of landing page",            // optional
  amount: "100",                                           // in token units
  asset: "0x5425890298aed601595a70AB815c96711a31Bc65",    // token contract address
  expiration: "1735689600",                                // unix timestamp, optional
  releaseType: "0"                                         // 0–255, optional
});

const { escrowAddress, approve, deposit } = data.onChain;
// If asset requires allowance: sign and send `approve` tx first
// Then sign and send `deposit` tx to fund the escrow
```

**Response fields:**

| Field | Description |
|---|---|
| `onChain.escrowAddress` | Deployed escrow contract address |
| `onChain.approve` | ERC-20 approve tx to sign/send (null for native tokens) |
| `onChain.deposit` | Deposit tx to sign/send |
| `onChain.txHash` | Factory deployment tx hash |
| `buyerWallet` / `sellerWallet` / `arbiterWallet` | Party addresses |

---

### 2. Query Status

```typescript
const { data } = await sdk.escrow.getStatus("43113", "0xEscrowAddress...");

console.log(data.deposited);        // buyer has funded the escrow
console.log(data.readyForRelease);  // seller has marked ready
console.log(data.buyerReleaseReady); // buyer has marked ready
console.log(data.balance);          // current balance (wei / smallest unit)
```

**Response fields:** `chainId`, `escrow`, `buyer`, `seller`, `arbiter`, `deposited`, `released`, `readyForRelease`, `buyerReleaseReady`, `balance`

---

### 3. Mark Ready (Seller & Buyer)

Both parties must signal readiness before the escrow can be released. `updateStatus` checks the provided address against the escrow contract and returns the appropriate unsigned transaction:

- **Seller address** → `markReady` transaction
- **Buyer address** → `markBuyerEscrowReleaseReady` transaction

```typescript
const { data } = await sdk.escrow.updateStatus({
  chainId: "43113",
  escrow: "0xEscrowAddress...",
  address: "0xSellerOrBuyerAddress..."
});

// data is a PrepareTransactionResponse — sign and broadcast it client-side
// { to, data, value, chainId, gas, maxFeePerGas, maxPriorityFeePerGas, type, nonce, instructions }
```

---

### 4. Release Escrow

System-only endpoint. The server's arbiter key signs the on-chain release. Requires the `X-Release-Secret` header to be set — this should only be called by your backend/system trigger after confirming both parties have marked ready.

```typescript
const { data } = await sdk.escrow.release(
  "43113",            // chainId
  "0xEscrowAddress...",
  { recipient: "0xSellerAddress..." } // optional, defaults to seller
);

// data: { success, txHash, escrowAddress, arbiter }
```

> **Note:** Call `getStatus` first to confirm `readyForRelease` and `buyerReleaseReady` are both `true` before triggering release.
