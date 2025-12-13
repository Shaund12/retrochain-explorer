# Technical Deep Dive: Cosmos TX Signing & Broadcasting

## The Problem

When broadcasting a transaction to a Cosmos SDK chain via REST API, you **MUST** send the transaction as base64-encoded protobuf bytes in the `tx_bytes` field, **NOT** as a JSON object in a `tx` field.

### Wrong (What We Were Doing)
```json
POST /cosmos/tx/v1beta1/txs
{
  "tx": {
    "body": { "messages": [...], "memo": "" },
    "auth_info": { "fee": {...}, "signer_infos": [...] },
    "signatures": ["..."]
  },
  "mode": "BROADCAST_MODE_SYNC"
}
```
**Result**: `{"code":3,"message":"invalid empty tx","details":[]}`

### Correct (What We Do Now)
```json
POST /cosmos/tx/v1beta1/txs
{
  "tx_bytes": "CpIBCo8BCiQvY29zbW9zLnN0YWtpbmcudjFiZXRhMS5Nc2dEZWxlZ2F0ZRJnCi1jb3Ntb3MxYWJjLi4ueHl6Ei5jb3Ntb3N2YWxvcGVyMWFiYy4uLnh5ehoGCgV1cmV0cm8SAzEwMBJoClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDDx...",
  "mode": "BROADCAST_MODE_SYNC"
}
```
**Result**: `{"tx_response":{"code":0,"txhash":"ABC123..."}}`

## Understanding Cosmos Transaction Structure

### 1. Transaction Components

A Cosmos transaction has 3 main parts:

```
TxRaw {
  body_bytes:      []byte  // Serialized TxBody
  auth_info_bytes: []byte  // Serialized AuthInfo  
  signatures:      [][]byte // Array of signatures
}
```

#### TxBody
```protobuf
message TxBody {
  repeated google.protobuf.Any messages = 1;
  string memo = 2;
  int64 timeout_height = 3;
  repeated google.protobuf.Any extension_options = 1023;
  repeated google.protobuf.Any non_critical_extension_options = 2047;
}
```

#### AuthInfo
```protobuf
message AuthInfo {
  repeated SignerInfo signer_infos = 1;
  Fee fee = 2;
}

message SignerInfo {
  google.protobuf.Any public_key = 1;
  ModeInfo mode_info = 2;
  uint64 sequence = 3;
}

message Fee {
  repeated Coin amount = 1;
  uint64 gas_limit = 2;
  string payer = 3;
  string granter = 4;
}
```

### 2. Signing Process

#### Direct Signing (What We Use)
```typescript
// 1. Encode TxBody
const txBodyBytes = registry.encode({
  typeUrl: "/cosmos.tx.v1beta1.TxBody",
  value: {
    messages: msgs,
    memo: memo
  }
});

// 2. Create AuthInfo
const authInfoBytes = makeAuthInfoBytes(
  [{ pubkey, sequence }],
  fee.amount,
  fee.gas
);

// 3. Create SignDoc
const signDoc = {
  bodyBytes: txBodyBytes,
  authInfoBytes: authInfoBytes,
  chainId: chainId,
  accountNumber: accountNumber
};

// 4. Sign with Keplr
const { signature, signed } = await offlineSigner.signDirect(address, signDoc);

// 5. Create TxRaw
const txRaw = TxRaw.fromPartial({
  bodyBytes: signed.bodyBytes,
  authInfoBytes: signed.authInfoBytes,
  signatures: [fromBase64(signature.signature)]
});

// 6. Encode to bytes
const txBytes = TxRaw.encode(txRaw).finish();
```

#### Amino Signing (Legacy)
```typescript
// Creates a different format (stdTx) that needs conversion
const signDoc = {
  chain_id: chainId,
  account_number: accountNumber,
  sequence: sequence,
  fee: fee,
  msgs: aminoMsgs,
  memo: memo
};

const { signature, signed } = await window.keplr.signAmino(chainId, address, signDoc);
// Still needs conversion to TxRaw before broadcasting
```

### 3. Broadcasting Options

Cosmos SDK supports 3 broadcast modes:

#### BROADCAST_MODE_SYNC (What We Use)
- Returns immediately after CheckTx
- Fast response (< 1 second)
- Only validates transaction format
- Doesn't wait for block inclusion
- Must query transaction hash later to see result

```typescript
{
  tx_bytes: "...",
  mode: "BROADCAST_MODE_SYNC"
}
// Returns: { code: 0, txhash: "ABC123..." }
```

#### BROADCAST_MODE_ASYNC
- Returns immediately
- Doesn't even run CheckTx
- Fastest but least safe

#### BROADCAST_MODE_BLOCK
- Waits for transaction to be included in a block
- Slow (6-8 seconds)
- Returns final result
- Best for critical transactions

## Why RPC Signing Failed

### What CosmJS Does Normally
```typescript
const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, signer);
// Under the hood:
// 1. Connects to RPC endpoint
// 2. Queries account via ABCI: /abci_query?path="/cosmos.auth.v1beta1.Query/Account"
// 3. Decodes protobuf response
// 4. Uses account_number and sequence for signing
```

### Why It Failed for Us
```
RPC Query ? ABCI Response ? Protobuf Decode ? ? Error: "Value must not be undefined"
```

The RPC node returns data, but:
- Missing required protobuf fields
- Incorrect field encoding
- Incompatible protobuf schema version

## Our REST Workaround

### Account Query
```typescript
// Instead of RPC ABCI query:
const accountRes = await api.get(`/cosmos/auth/v1beta1/accounts/${address}`);
// Returns: { account: { account_number: "0", sequence: "5", ... } }
// ? Clean JSON, easy to parse, no protobuf issues
```

### Manual Transaction Building
```typescript
// 1. Query account from REST ?
const { accountNumber, sequence } = await getAccountInfoREST(address);

// 2. Build transaction locally
const txBodyBytes = encodeTxBody(msgs, memo);
const authInfoBytes = encodeAuthInfo(pubkey, sequence, fee);

// 3. Sign locally with Keplr (no network needed)
const { signature } = await keplr.signDirect(address, signDoc);

// 4. Encode to TxRaw
const txRaw = TxRaw.fromPartial({ bodyBytes, authInfoBytes, signatures });
const txBytes = TxRaw.encode(txRaw).finish();

// 5. Broadcast via REST ?
await api.post("/cosmos/tx/v1beta1/txs", {
  tx_bytes: toBase64(txBytes),
  mode: "BROADCAST_MODE_SYNC"
});
```

## Key Takeaways

1. **REST broadcast requires `tx_bytes`** - Must be base64-encoded `TxRaw` protobuf
2. **JSON `tx` field doesn't work** - That's for legacy LCD endpoints (deprecated)
3. **RPC and REST are different** - RPC uses ABCI queries (protobuf), REST uses gRPC-gateway (JSON)
4. **Direct signing is better than Amino** - More features, more efficient, future-proof
5. **Account queries can use REST** - No need for RPC if you build transactions manually
6. **CosmJS hides complexity** - But you can do everything manually if needed

## Debugging Checklist

### If Transaction Fails to Sign
- [ ] Check account exists: `GET /cosmos/auth/v1beta1/accounts/{address}`
- [ ] Verify account has balance
- [ ] Check sequence number is correct (not too high/low)
- [ ] Verify chain ID matches
- [ ] Check Keplr is unlocked

### If Transaction Fails to Broadcast
- [ ] Verify `tx_bytes` is base64-encoded
- [ ] Check transaction is properly signed
- [ ] Verify fee is sufficient
- [ ] Check gas limit is enough
- [ ] Verify messages are valid

### If Transaction Is Rejected
- [ ] Check error message in `raw_log`
- [ ] Verify account has sufficient balance
- [ ] Check validator is active (for staking)
- [ ] Verify unbonding time hasn't passed (for undelegating)

## References

- [Cosmos SDK TX Proto](https://github.com/cosmos/cosmos-sdk/blob/main/proto/cosmos/tx/v1beta1/tx.proto)
- [Cosmos REST API](https://docs.cosmos.network/main/core/grpc_rest)
- [CosmJS Documentation](https://cosmos.github.io/cosmjs/)
- [Keplr Documentation](https://docs.keplr.app/)

---

**TL;DR**: Always use `tx_bytes` with base64-encoded protobuf when broadcasting via REST API. JSON transaction objects are legacy and don't work with modern Cosmos SDK nodes.
