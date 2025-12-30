# BattlePoints CosmWasm Contract Spec (for Copilot Agent)

This document describes the **Battle Points + Quest Claim** system currently represented in `src/views/ArcadeView.vue` and provides a clear contract/API/storage spec for implementing it as a **CosmWasm contract**.

The UI currently shows quest progress but claim is disabled with:

> Coming soon  claimable after next RC on-chain upgrade.

This contract is intended to power that future claim.

This spec also includes a **CW721 NFT Shop** extension where users can spend Battle Points to mint NFTs.

---

## 1. Background: What the frontend already computes

In `src/views/ArcadeView.vue`, the Battles section:

- Filters sessions into a **battle window** (`daily | weekly | monthly`) using local time logic (`dayjs().startOf('day'|'week'|'month')`).
- Optionally filters per game (`all | retrovaders | retronoid`).
- Computes leaderboards:
  - **Score Battle**: best single-session score per player
  - **Grind Battle**: number of sessions per player
  - **Burn Battle**: total burned (from `MsgInsertCoin`) per player
  - **Streak Battle**: max consecutive-day streak within the chosen window

It also defines **quests** and progress metrics:

### Existing Quest IDs
| Quest ID | Title | Metric | Target | Source |
|---|---|---:|---:|---|
| `q_runs_3` | Warm Up | runs | 3 | sessions length |
| `q_score_5k` | Score Hunter | best score | 5000 | sessions max(score) |
| `q_burn_1` | Insert Coin | burned RETRO | 1.00 | `MsgInsertCoin` burn totals |

The UI computes:
- `runs` = number of sessions in window+game for (player)
- `best_score` = max session score in window+game for (player)
- `burned_uretro` = sum of burn amounts in uretro (micro-RETRO) in window+game for (player)

The UI currently does **not** do any on-chain claim.

---

## 2. Contract goals

The contract should:

1. Allow a user to claim quest rewards **once per quest per battle window**.
2. Award **Battle Points** (contract-managed numbers) on successful claim.
3. Provide queries so the explorer UI can display:
   - progress snapshot (optional)
   - claim status
   - total points
   - per-window points (optional)
   - leaderboard by points (optional; indexer can do this too)

Because CosmWasm cannot trustlessly inspect historical tx events, the contract should use an **attestation model** (see below).

Additionally (v1.1 / next step), the system should:

4. Allow users to **spend Battle Points** to mint/buy NFTs from a configured **CW721 collection**.

---

## 3. Verification model (recommended): Attestation / Upsert Stats

### Why
CosmWasm contracts cannot query arbitrary historical sessions or tx logs. You need a trusted producer:

- the chains Arcade module (future), OR
- an indexer/backend service you run, OR
- a governance-controlled feeder.

This trusted producer periodically submits aggregated stats per player/window.

---

## 4. Core types

### Period
```rust
pub enum Period { Daily, Weekly, Monthly }
```

### GameFilter
```rust
pub enum GameFilter { All, Retrovaders, Retronoid }
```

### WindowId
Use explicit timestamps in seconds (UTC-based).

```rust
pub struct WindowId {
  pub start_ts: u64,
  pub end_ts: u64,
}
```

**Rule**: `start_ts <= end_ts`.

### BattleStats
```rust
pub struct BattleStats {
  pub runs: u32,
  pub best_score: u32,
  pub burned_uretro: u128,
}
```

---

## 5. Storage layout

Using `cw-storage-plus`.

### Config
- `admin: Addr`
- `stats_feeder: Addr` (authorized address to submit/overwrite stats)
- `points_by_quest: Map<String, u32>` (or a fixed set)
- `max_window_seconds: u64` (optional safety)

### Stats
Keyed by:

- `(player, period, game_filter, window.start_ts, window.end_ts)` ? `BattleStats`

### Claims
Keyed by:

- `(player, period, game_filter, window.start_ts, window.end_ts, quest_id)` ? `ClaimRecord`

`ClaimRecord`:
- `quest_id: String`
- `points_awarded: u32`
- `claimed_at: u64`

### Total points
- `points_total[player] => u64`

### Optional: per-window points
- `(player, period, game_filter, window...) => u64`

---

## 6. Contract messages

### InstantiateMsg
```rust
pub struct InstantiateMsg {
  pub admin: String,
  pub stats_feeder: String,
  pub max_window_seconds: Option<u64>,
  pub points: Option<Vec<(String, u32)>>,

  // Optional NFT shop wiring
  pub cw721_addr: Option<String>,
}
```

### ExecuteMsg
```rust
pub enum ExecuteMsg {
  SetAdmin { admin: String },
  SetStatsFeeder { stats_feeder: String },
  SetPoints { points: Vec<(String, u32)> },

  // --- NFT shop admin
  SetCw721 { cw721: String },
  UpsertShopItem { item: ShopItem },
  SetShopStatus { enabled: bool },

  UpsertStats {
    player: String,
    period: Period,
    game_filter: GameFilter,
    window: WindowId,
    stats: BattleStats,
  },

  ClaimQuest {
    period: Period,
    game_filter: GameFilter,
    window: WindowId,
    quest_id: String,
  },

  // --- NFT shop user flow
  BuyNft { item_id: String },
}
```

### QueryMsg
```rust
pub enum QueryMsg {
  Config {},

  Stats {
    player: String,
    period: Period,
    game_filter: GameFilter,
    window: WindowId,
  },

  ClaimStatus {
    player: String,
    period: Period,
    game_filter: GameFilter,
    window: WindowId,
    quest_id: String,
  },

  Points { player: String },

  ClaimsForPlayer {
    player: String,
    period: Option<Period>,
    game_filter: Option<GameFilter>,
    window: Option<WindowId>,
  },

  // --- NFT shop
  ShopConfig {},
  ShopItem { item_id: String },
  ShopItems { start_after: Option<String>, limit: Option<u32> },
}
```

---

## 6.1 NFT Shop + CW721 integration (Battle Points ? NFTs)

### Design

- Use a **standard CW721 implementation** (recommend `cw721-base`).
- The BattlePoints contract acts as the **minter** for the CW721 contract.
- Users spend points by calling `BuyNft` on BattlePoints; BattlePoints mints the NFT to the buyer.

Optionally, the shop can also support **CW20 payments** (in addition to Battle Points) if you want items purchasable with a token.

This keeps:

- quest verification + points accounting in one contract, and
- NFT ownership/transfer queried via CW721 standards.

### Recommended CW721 deployment

- Deploy `cw721-base` with `minter = <battlepoints_contract_addr>`.
- Metadata strategy:
  - simplest: `token_uri` per minted token pointing to off-chain JSON.
  - optional: use cw721 metadata extension in `extension`.

### On-chain SVG art (selected option)

For this project, NFT visuals should be generated as **SVG** based on:

- `art_style`
- `palette`
- `seed`

Because CW721 tokens reference metadata via `token_uri` (off-chain) while image_data is a metadata convention, the most practical on-chain approach is:

- Store the generated SVG (or the inputs required to generate it) in the BattlePoints contract.
- Provide a query that returns base64 SVG (or raw SVG) for a minted `token_id`.
- The explorer UI (or an indexer) can surface this as an image.

If you require strict marketplace compatibility, you can still publish `token_uri` off-chain, but have that JSON embed the on-chain SVG via `image_data` by fetching from the BattlePoints query endpoint.

### Token ID scheme (deterministic and collision-safe)

Recommend:

- store `next_token_id: u64` in BattlePoints, and
- mint with `token_id = format!("{}-{}", item_id, next_token_id)` and then increment.

This avoids requiring the shop admin to predefine token IDs.

---

## 6.1.1 Deployment order (recommended)

If you want the shop to depend on deployed contract addresses:

1. **Deploy CW20** (optional)
   - If using CW20 payments, deploy your CW20 first so you have the CW20 contract address.
2. **Deploy BattlePoints contract**
   - Instantiate BattlePoints with admin/stats-feeder (and optionally `cw721_addr` if already known).
   - If using CW20 payments, you can also configure the CW20 address after instantiate (see `SetCw20`).
3. **Deploy CW721**
   - Instantiate `cw721-base` with `minter = <battlepoints_contract_addr>`.
4. **Wire the shop**
   - Call `SetCw721 { cw721 }` on BattlePoints.
   - Optionally call `SetCw20 { cw20 }`.
   - Add items with `UpsertShopItem`.
   - Enable shop with `SetShopStatus { enabled: true }`.

---

## 6.1.2 CW20 payments (optional)

### Why

Battle Points are internal accounting. If you also want an on-chain token payment path (e.g., marketplace-like UX), add CW20 support.

### Payment modes

Define per-item pricing as one of:

- **Points-only** (default): deduct `points_total`.
- **CW20-only**: require CW20 transfer.
- **Points + CW20** (optional advanced): require both.

### Recommended approach

Use `cw20::Cw20ExecuteMsg::Send` / `Receive` flow so the CW20 token contract triggers the shop via `Cw20ReceiveMsg`.

This avoids needing the BattlePoints contract to pull tokens from user balances.

---

## 6.2 NFT Shop types

### ShopItem

```rust
pub struct ShopItem {
  pub item_id: String,
  pub name: String,
  pub description: Option<String>,
  pub image: Option<String>,

  // Battle Points price
  pub price_points: u64,

  // Optional CW20 price (if enabled)
  pub price_cw20: Option<Uint128>,
  pub active: bool,

  // CW721 mint metadata
  pub token_uri: Option<String>,

  // --- On-chain SVG generation inputs
  // Note: keep these small; they may be copied into per-mint records.
  pub art_style: String,
  pub palette: String,

  // Optional supply controls
  pub max_supply: Option<u32>,
}
```

### Art style + palette conventions

- `art_style`: a small string enum-like value, e.g. `"ships" | "aliens" | "lasers" | "planets"`.
- `palette`: a small string enum-like value, e.g. `"neon" | "ember" | "void" | "ice"`.

These are interpreted by contract SVG generator logic.

---

### Per-mint record (required for on-chain SVG)

Store per-token data so SVG can be reproduced later:

```rust
pub struct MintRecord {
  pub token_id: String,
  pub buyer: Addr,
  pub item_id: String,
  pub spent_points: u64,
  pub seed: u64,
  pub art_style: String,
  pub palette: String,
  pub purchased_at: u64,
}
```

Supply behavior:

- If `max_supply` is `None`: unlimited.
- If `Some(n)`: enforce `minted_count[item_id] < n`.

---

## 6.3 NFT Shop storage layout

Add to existing storage:

- `SHOP_ENABLED: Item<bool>`
- `CW721_ADDR: Item<Addr>`
- `CW20_ADDR: Item<Addr>` (optional)
- `SHOP_ITEMS: Map<String, ShopItem>`
- `MINTED_COUNT: Map<String, u32>`
- `NEXT_TOKEN_ID: Item<u64>`

On-chain SVG support:

- `MINTS_BY_TOKEN_ID: Map<String, MintRecord>`
- `MINTS_BY_BUYER: Map<(Addr, String), ()>` (optional index to list a buyer's tokens)

Notes:

- Store `CW721_ADDR` only after `deps.api.addr_validate`.
- `SHOP_ENABLED` default can be `false` unless explicitly enabled.

---

## 6.4 NFT Shop execution semantics

### Admin actions

- `SetCw721 { cw721 }`
  - admin-only
  - validates and sets `CW721_ADDR`

- `SetCw20 { cw20 }` (optional)
  - admin-only
  - validates and sets `CW20_ADDR`

- `UpsertShopItem { item }`
  - admin-only
  - validates `item_id` non-empty
  - validates `price_points > 0`

- `SetShopStatus { enabled }`
  - admin-only

### User action: BuyNft

`BuyNft { item_id }`:

1. Require `SHOP_ENABLED == true`.
2. Load `item` from `SHOP_ITEMS`.
   - require `item.active == true`.
3. Validate CW721 is configured (`CW721_ADDR` exists).
4. Enforce supply cap if configured.
5. Check and deduct points (if `item.price_points > 0`):
   - `points_total[sender] >= item.price_points`
   - decrement `points_total[sender]` by `price_points`
   - If you require points for every item, enforce `item.price_points > 0` at upsert-time.
6. Mint to sender via CW721 execute call:
   - `WasmMsg::Execute { contract_addr: cw721, msg: cw721::Cw721ExecuteMsg::Mint{...}, funds: vec![] }`
7. Increment counters:
   - `MINTED_COUNT[item_id] += 1`
   - `NEXT_TOKEN_ID += 1`

8. Create `MintRecord`:
   - choose `seed` (see below)
   - store `MINTS_BY_TOKEN_ID[token_id] = MintRecord { ... }`

### User action: BuyNft with CW20 (optional)

If `item.price_cw20` is set, prefer a `Receive` flow:

1. User executes on CW20:
   - `Send { contract: <battlepoints>, amount: item.price_cw20, msg: <encoded BuyNft { item_id }> }`
2. BattlePoints implements `ExecuteMsg::Receive(Cw20ReceiveMsg)`:
   - validate `info.sender == CW20_ADDR`
   - validate `amount == item.price_cw20`
   - then perform mint

Points + CW20 combined is possible, but implement carefully (deduct points only after validating CW20 receive).

### Purchase record (optional)

CW721 ownership is the source of truth. Optionally also store:

- `(buyer, token_id) => { item_id, spent_points, purchased_at }`

This can help build a purchase history query without crawling CW721.

For on-chain SVG, a per-mint record is effectively required.

### Seed selection

CosmWasm cannot access secure randomness by default. Use one of:

1. **Feeder-provided seed** (recommended):
   - add `BuyNft { item_id, seed: Option<u64> }` and require `seed` present, OR
   - have an admin/feeder call `UpsertSeed { token_id, seed }` after mint.
2. **Block-derived seed** (best-effort only):
   - derive `seed = sha256(sender || env.block.height || env.block.time || token_id)` and take first 8 bytes.

Be explicit in docs/UI: block-derived seeds are not secure against manipulation.

---

## 6.5 CW721 Mint message (reference)

When calling `cw721-base`, the execute payload is generally:

```rust
// pseudo (exact type path depends on versions)
Mint {
  token_id: String,
  owner: String,
  token_uri: Option<String>,
  extension: Option<...>,
}
```

Implementation note: youll likely include the `cw721` crate types (or define the mint message struct matching the deployed cw721-base version).

---

## 6.6 On-chain SVG queries (for Explorer/UI)

Add queries so the UI can render images without off-chain hosting.

### QueryMsg additions

```rust
pub enum QueryMsg {
  // ...existing...

  MintRecord { token_id: String },
  SvgImage { token_id: String },
}
```

### `SvgImage` response

Return either:

- `image_data`: `data:image/svg+xml;base64,<...>`

or

- raw SVG string with a `content_type: "image/svg+xml"`.

The SVG generator should use `art_style`, `palette`, and `seed` to produce themes like **space ships, aliens, lasers, planets**.

---

## 7. Quest rules (must-match current UI)

Quest evaluation uses the stored `BattleStats`.

### `q_runs_3`
Ready if:
- `stats.runs >= 3`

### `q_score_5k`
Ready if:
- `stats.best_score >= 5000`

### `q_burn_1`
Ready if:
- `stats.burned_uretro >= 1_000_000` (1.00 RETRO)

---

## 8. Claim semantics

A claim is uniquely scoped by:

- `player`
- `period`
- `game_filter`
- `window`
- `quest_id`

Rules:

1. Stats must exist for the exact scope.
2. Quest must be ready by the rules above.
3. Claim must not already exist.
4. On success:
   - write `ClaimRecord`
   - increment `points_total[player]`
   - optionally increment window points

No token transfers are required for v1.

---

## 9. Points configuration

Suggested initial point values (adjustable):

- `q_runs_3`: 10
- `q_score_5k`: 25
- `q_burn_1`: 15

These should be stored in config and mutable by `admin`.

---

## 10. Window rules

The frontend currently uses `dayjs().startOf('day'|'week'|'month')`, which is locale/timezone sensitive.

For the contract:

- Prefer **explicit `WindowId` provided by caller** plus safety checks.
- Enforce `end_ts - start_ts <= max_window_seconds`.
- Optionally later enforce strict canonical boundaries for daily/weekly/monthly.

---

## 11. Integration plan (Explorer UI)

When the chain upgrade is live:

1. The stats feeder (module/indexer) calls `UpsertStats` for each active player/window.
2. The UI queries:
   - `ClaimStatus` for each quest, and `Points` for totals.
3. The UI enables the claim button and executes `ClaimQuest` via Keplr.

---

## 12. Testing checklist (cw-multi-test)

- Instantiate sets admin/feeder.
- Only feeder can `UpsertStats`.
- Cannot `ClaimQuest` without stats.
- Cannot claim if not ready.
- Claim succeeds when ready and not claimed.
- Double-claim prevented.
- Points totals correct.

### NFT shop tests

- Only admin can set CW721 address.
- Only admin can upsert shop items.
- `BuyNft` fails if shop disabled.
- `BuyNft` fails if item inactive/unknown.
- `BuyNft` fails if insufficient points.
- `BuyNft` mints via CW721 when configured and deducts points.
- Supply cap enforced when `max_supply` is set.

---

## 13. Open questions

Answer these before finalizing v1:

1. Should `game_filter = All` stats be submitted directly, or derived from per-game stats?
2. Weekly boundary rule: ISO week vs Sunday week?
3. Do points reset per window or accumulate lifetime? (This spec assumes lifetime accumulation.)
4. Do you want streak-based quests? If yes, stats need `max_streak_days`.

---

## 14. Notes for Copilot agent

- Keep storage keys stable.
- Use `Addr::unchecked` only after validation.
- Use `env.block.time.seconds()` for `claimed_at`.
- Dont add external dependencies beyond standard CosmWasm + cw-utils/cw-storage-plus unless required.
