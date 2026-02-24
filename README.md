# PsiloSDK

PsiloSDK is the official TypeScript SDK for interacting computationally with Pakt's production-ready EVM single-use, non-custodial, MPC-protected escrow wallets via the Model Context Protocol (MCP) compatible backend.

It is designed to be fully AI-native and provide seamless interoperability for creating, managing, and releasing Escrow objects that leverage Pakt's `Psilo-Contracts`.

## Installation

```bash
npm install @pakt/psilo-sdk
# OR
yarn add @pakt/psilo-sdk
```

## Setup & Initialization

You must initialize the SDK by pointing it to the deployed MCP-compatible endpoint hosting the Psilo backend server.

```typescript
import { PsiloSDK } from "@pakt/psilo-sdk";

const sdk = await PsiloSDK.init({
  baseUrl: "http://localhost:3000", // Example backend or MCP deployment URL
  verbose: true // Optional logging
});
```

## Features: Escrow Management

The SDK maps all features designed within the `Psilo-Contracts/MCP_INTEGRATION.md`.

### 1. Compute Address
Compute an expected escrow address deterministically before deploying it.

```typescript
const computed = await sdk.escrow.computeAddress({
  sender: "0xSenderAddress...",
  receiver: "0xReceiverAddress...",
  asset: "0x0000000000000000000000000000000000000000", // ETH
  amount: "1000000000000000000",
  originator: "0xOriginator...",
  salt: "0x123..."
});
console.log("Predicted address:", computed.data.predictedAddress);
```

### 2. Create Escrow
Create a new escrow on the blockchain.

```typescript
const escrowResponse = await sdk.escrow.create({
  sender: "0xSenderAddress...",
  receiver: "0xReceiverAddress...",
  asset: "0x0000000000000000000000000000000000000000",
  amount: "1000000000000000000",
  originator: "0xOriginator...",
  salt: "0xSomeDeterministicSalt...",
  metadataHash: "0xOptionalMetadata..."
});
const escrowAddress = escrowResponse.data.escrowAddress;
```

### 3. Deposit
Fund a created escrow.

```typescript
await sdk.escrow.deposit(escrowAddress, {
  from: "0xSenderAddress..."
});
```

### 4. Status and Listing
Query statuses and lists of active escrows.

```typescript
// Query one
const status = await sdk.escrow.getStatus(escrowAddress);
console.log("Status:", status.data.deposited, status.data.released);

// Query all
const escrows = await sdk.escrow.list({
    sender: "0xSenderAddress...",
    status: "deposited"
});
```

### 5. Multi-Party Approval & Release
The MPC-shard functionality is exposed through signing a release using 2-of-3 configured authority.

```typescript
// Ask the sender to sign
const senderSignature = await sdk.escrow.signRelease(escrowAddress, {
    signerAddress: "0xSenderAddress...",
    privateKey: "0x..." // Optional if managed by the MCP server environment
});

// Ask the receiver to sign
const receiverSignature = await sdk.escrow.signRelease(escrowAddress, {
    signerAddress: "0xReceiverAddress..."
});

// Release funds
await sdk.escrow.release(escrowAddress, {
    signatures: [senderSignature.data.signature, receiverSignature.data.signature],
    executor: "0xExecutorAddress..."
});
```
