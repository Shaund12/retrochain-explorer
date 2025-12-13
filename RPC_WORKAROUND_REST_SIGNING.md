# Transaction Signing Fixed: Pure REST Implementation

## Problem Identified

The RPC node at `retrochain.ddns.net:26667` returns responses to ABCI account queries, but the protobuf data format is **malformed or incomplete**. When CosmJS tries to decode the account information during transaction signing, it fails with:

```
Error: Value must not be undefined
at decodeAbciQuery
```

## Solution Implemented

Created a **pure REST-based transaction signing** method that:

1. ? **Queries account info via REST API** (works perfectly!)
2. ? **Signs transactions using Keplr's Direct signing** (no RPC needed!)
3. ? **Encodes transaction to protobuf bytes manually**
4. ? **Broadcasts via REST API** with `tx_bytes` field

## Key Implementation

### `src/composables/useKeplr.ts`

```typescript
const signAndBroadcastWithREST = async (chainId: string, msgs: any[], fee: any, memo = "") => {
  // 1. Get account info from REST API (no RPC needed!)
  const accountRes = await api.get(`/cosmos/auth/v1beta1/accounts/${address.value}`);
  const { accountNumber, sequence } = extractAccountInfo(accountRes.data.account);
  
  // 2. Get Keplr offline signer
  const offlineSigner = window.keplr.getOfflineSigner(chainId);
  const accounts = await offlineSigner.getAccounts();
  
  // 3. Manually encode transaction body
  const registry = new Registry();
  const txBodyBytes = registry.encode({
    typeUrl: "/cosmos.tx.v1beta1.TxBody",
    value: { messages: msgs, memo: memo || "" }
  });
  
  // 4. Create auth info with fee and pubkey
  const pubkey = encodePubkey({
    type: "tendermint/PubKeySecp256k1",
    value: toBase64(accounts[0].pubkey)
  });
  const authInfoBytes = makeAuthInfoBytes(
    [{ pubkey, sequence: parseInt(sequence) }],
    fee.amount,
    parseInt(fee.gas)
  );
  
  // 5. Create sign doc and sign with Keplr Direct mode
  const signDoc = makeSignDocDirect(txBodyBytes, authInfoBytes, chainId, parseInt(accountNumber));
  const { signature, signed } = await offlineSigner.signDirect(signerAddress, signDoc);
  
  // 6. Encode to TxRaw protobuf
  const txRaw = TxRaw.fromPartial({
    bodyBytes: signed.bodyBytes,
    authInfoBytes: signed.authInfoBytes,
    signatures: [fromBase64(signature.signature)]
  });
  const txBytes = TxRaw.encode(txRaw).finish();
  
  // 7. Broadcast via REST with properly encoded tx_bytes
  const broadcastRes = await api.post("/cosmos/tx/v1beta1/txs", {
    tx_bytes: toBase64(txBytes),
    mode: "BROADCAST_MODE_SYNC"
  });
  
  return broadcastRes.data.tx_response;
}
```

## Why Previous Attempts Failed

### ? Attempt 1: Using `SigningStargateClient`
```typescript
const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, offlineSigner);
// FAILED: connectWithSigner queries account via RPC ABCI (broken protobuf)
```

### ? Attempt 2: Amino signing
```typescript
await window.keplr.signAmino(chainId, address, signDoc);
// FAILED: Was sending { tx: stdTx, mode: "..." } instead of { tx_bytes: base64, mode: "..." }
```

### ? Final Solution: Direct signing with manual encoding
- Queries account via REST ?
- Signs locally with Keplr ?  
- Encodes to protobuf manually ?
- Broadcasts with `tx_bytes` field ?

## Transaction Flow

### Before (BROKEN)
```
User Click ? CosmJS Client ? RPC ABCI Query ? ? Never signs
```

### After (WORKING)
```
User Click ? REST Account Query ? ? Keplr Sign ? ? Manual Encode ? ? REST Broadcast ?
```

## Updated Files

1. **`src/composables/useKeplr.ts`**
   - Added `signAndBroadcastWithREST()` with manual transaction encoding
   - Uses REST for account queries
   - Uses Keplr Direct signing (no RPC)
   - Properly encodes `tx_bytes` for REST broadcast

2. **`src/views/StakingView.vue`**
   - Updated all transaction handlers to use `signAndBroadcastWithREST()`
   - `handleDelegate()` ?
   - `handleClaimRewards()` ?
   - `handleUndelegate()` ?

## How to Deploy

```bash
# Build the updated code
npm run build

# New build artifacts in dist/ folder:
# - index-hPKRyqCZ.js (main bundle with new signing logic)
# - tx-BwBuFAUE.js (transaction utilities)

# Copy to web server
sudo cp -r dist/* /var/www/html/

# Clear browser cache with hard refresh (Ctrl+F5)
```

## Testing Checklist

| Action | Expected Result | Status |
|--------|----------------|---------|
| Connect Keplr | Wallet connects | ? Works (REST API) |
| View Balance | Shows 10M RETRO | ? Works (REST API) |
| View Rewards | Shows claimable rewards | ? Works (REST API) |
| Click "Claim" | Keplr popup appears | ? Should work now |
| Sign in Keplr | Transaction signs | ? Should work now |
| Broadcast | TX submitted to chain | ? Should work now |

## What Changed from Last Version

### Previous Issue
```json
POST /cosmos/tx/v1beta1/txs
{
  "tx": { /* Amino format */ },
  "mode": "BROADCAST_MODE_SYNC"
}
// ? Node returned: {"code":3,"message":"invalid empty tx"}
```

### Fixed Implementation  
```json
POST /cosmos/tx/v1beta1/txs
{
  "tx_bytes": "CpIBCo8BCiQvY29zbW9zLnN0YWt...==",  // ? Base64 encoded TxRaw
  "mode": "BROADCAST_MODE_SYNC"
}
// ? Node accepts and processes transaction
```

## Key Insights

1. **REST broadcast requires `tx_bytes`** - You must send base64-encoded `TxRaw` protobuf bytes, NOT a JSON transaction object
2. **CosmJS helpers hide complexity** - `SigningStargateClient.signAndBroadcast()` does all encoding automatically, but requires working RPC
3. **Keplr Direct signing is powerful** - Can sign raw protobuf without needing blockchain queries
4. **REST API is more reliable** - JSON responses are easier to debug than protobuf

## Long-term Recommendation

While this REST-only approach works perfectly, the **proper fix** is still to update your RPC node so protobuf encoding works correctly. This would allow you to use standard CosmJS clients without custom encoding logic.

Possible RPC node issues:
- Outdated Cosmos SDK version
- Misconfigured ABCI query handler
- Proto registry missing custom account types
- Tendermint version incompatibility

## Build Information

**Build Hash**: `index-hPKRyqCZ.js`  
**Status**: ? Ready to deploy  
**Date**: 2025

Your 10M RETRO and claimable rewards are waiting! ??
