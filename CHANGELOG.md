# ?? RetroChain Explorer - Changelog

## Version 2.2.0 - "Arcade Polish & Nav"

### ? Improvements

#### ?? Arcade Experience
- Arcade Games modal now shows richer details with genre/difficulty/status badges, styled stat tiles, and a clearer launch state.
- Added genre normalization (drops `GENRE_` prefixes) for filters, badges, and icons.
- Play button gains a launch icon and disables when no launch URL exists.

#### ?? Navigation
- Added a direct "Arcade Games" link to the Arcade dropdown for faster access.

---

## Version 2.1.0 - "Keplr Auto-Connect Update" ??

### ?? New Features

#### ?? **Keplr Auto-Connect on Account Page**
- Account page now automatically loads your connected Keplr wallet address
- Shows "?? Your Wallet" badge when viewing your own account
- Quick "Load My Account" button appears when Keplr is connected but not loaded
- Watches for Keplr connection changes and auto-loads address
- Seamless UX - no need to copy/paste your address anymore!

### ?? **Technical Improvements**

#### Account Page Enhancements
- Added `useKeplr` integration to AccountView
- Added watcher for Keplr address changes
- Auto-loads Keplr address on mount if connected and no route parameter
- Visual indicator (badge) when viewing your own wallet
- Green banner with quick-load button for connected Keplr wallet

---

## Version 2.0.0 - "The Amazing Update" ??

### ?? Major New Features

#### ?? **Universal Search System**
- Added `RcSearchBar.vue` component with smart search
- Created `useSearch.ts` composable for unified search logic
- Auto-detects input type (block, tx, address)
- Quick search suggestions dropdown
- Search from homepage or use navigation

#### ??? **Validator Dashboard**
- New `/validators` route and `ValidatorsView.vue`
- Created `useValidators.ts` composable
- Displays complete validator set with voting power
- Visual voting power distribution bars
- Commission rates and status indicators (Active/Jailed/Unbonding)
- Sorted by voting power descending

#### ??? **Governance Portal**
- New `/governance` route and `GovernanceView.vue`
- Created `useGovernance.ts` composable
- Lists all governance proposals
- Status tracking (Voting, Deposit, Passed, Rejected, Failed)
- Vote tally visualization (Yes, No, Veto, Abstain)
- Proposal descriptions and metadata
- Time tracking (submit, voting start/end)

#### ? **Real-time Auto-Refresh**
- Created `useAutoRefresh.ts` composable
- 10-second interval with countdown timer
- Pause/resume controls
- Integrated into Home and Blocks pages
- Visual feedback with animated buttons

#### ?? **Enhanced Transaction Details**
- Complete redesign of `TxDetailView.vue`
- Message decoding for all Cosmos SDK message types
- Visual success/failure indicators with status banner
- Formatted gas usage display
- Event logs with syntax highlighting
- Better organization with 3-column layout

#### ?? **Advanced Account Explorer**
- Complete redesign of `AccountView.vue`
- Transaction history per address
- Balance conversion (uretro ? RETRO)
- Beautiful stats cards showing:
  - Total balance
  - Asset count
  - Transaction count
- Search by address with validation
- Loading states with custom spinner

#### ?? **UI/UX Overhaul**
- Created `RcLoadingSpinner.vue` with 3-ring animation
- Created `RcNetworkStats.vue` for statistics display
- Added fade-in animations throughout
- Custom scrollbar styling
- Improved button states (hover, disabled, loading)
- Gradient accents and modern card designs
- Better responsive breakpoints

### ?? **Critical Bug Fixes**

#### ? Fixed: Stale/Fake Data Issue
**Problem**: Components showing cached data from previous views

**Root Cause**: Composables used singleton pattern with shared ref() state outside the function

**Solution**: Moved all `ref()` declarations inside composable functions
- Fixed in: `useBlocks.ts`, `useTxs.ts`, `useChainInfo.ts`, `useAccount.ts`, `useValidators.ts`, `useGovernance.ts`
- Each component instance now gets fresh data
- No more cross-contamination between views

#### ? Fixed: Keplr Detection Issue
**Problem**: "Install Keplr" button showing even when extension installed

**Root Cause**: 
1. Wrong property names in RcHeader.vue
2. Keplr loads asynchronously after page
3. Insufficient detection logic

**Solution**:
- Updated RcHeader.vue to use correct properties (`isAvailable`, `connecting`, `address`)
- Enhanced detection check in `useKeplr.ts`
- Added 1-second delayed re-check for async Keplr loading
- Better type checking for Keplr API availability

### ?? **Technical Improvements**

#### Code Quality
- Removed singleton pattern from all composables (prevents state sharing)
- Added proper TypeScript types for all new features
- Improved error handling with try-catch blocks
- Better loading states across all views

#### Performance
- Optimized re-renders with proper reactive refs
- Lazy loading for transaction history
- Pagination support for blocks (load more button)
- Debounced search input

#### Accessibility
- Better semantic HTML throughout
- Keyboard navigation support
- Screen reader friendly labels
- Focus states on interactive elements

### ?? **New Components**

1. **RcSearchBar.vue** - Universal search with dropdown
2. **RcLoadingSpinner.vue** - Beautiful 3-ring loading animation
3. **RcNetworkStats.vue** - Statistics grid component

### ?? **New Views**

1. **ValidatorsView.vue** - Validator dashboard
2. **GovernanceView.vue** - Governance portal
3. **NotFoundView.vue** - Beautiful 404 page

### ?? **Style Improvements**

#### CSS Additions in main.css
- `.animate-fade-in` - Smooth entrance animations
- `.animate-spin` - Rotating animations
- Better scrollbar styling for webkit browsers
- Improved button hover states
- Disabled state styling
- Transition utilities

#### Color System
- Emerald: Success states (#22c55e)
- Rose: Error states (#f43f5e)
- Cyan: Info/highlights (#06b6d4)
- Amber: Warnings (#f59e0b)
- Slate: Base colors (#64748b)

### ?? **Updated Components**

#### HomeView.vue
- Added search bar integration
- Network statistics section
- Auto-refresh with countdown
- Better loading states

#### BlocksView.vue
- Auto-refresh functionality
- "Load More" pagination
- Enhanced table styling
- Better mobile responsiveness

#### TxDetailView.vue
- Complete redesign with status banner
- Message type decoding
- Better data organization
- Responsive 3-column layout

#### AccountView.vue
- Stats cards for overview
- Transaction history integration
- Better form styling
- Loading spinner integration

#### RcHeader.vue
- Fixed Keplr integration
- Better navigation styling
- Responsive menu items
- Active route highlighting

### ??? **New Routes**

| Route | Component | Purpose |
|-------|-----------|---------|
| `/validators` | ValidatorsView | Validator set overview |
| `/governance` | GovernanceView | Governance proposals |
| `/:pathMatch(.*)*` | NotFoundView | 404 error page |

### ?? **Documentation**

#### New Files
- `README.md` - Comprehensive project documentation
- `QUICKSTART.md` - Step-by-step getting started guide
- `CHANGELOG.md` - This file!

#### Updated Files
- `.env.example` - Environment variable template
- `package.json` - Added "type": "module" for ES modules

### ?? **Future Enhancements Planned**

- [ ] IBC transfer tracking and visualization
- [ ] CosmWasm contract interaction panel
- [ ] Advanced filtering (by msg type, date range)
- [ ] Gas analytics and fee optimization
- [ ] Custom alerts and notifications
- [ ] Transaction builder UI
- [ ] Multi-chain support
- [ ] Light/dark theme toggle
- [ ] Export to CSV/JSON
- [ ] Address book with custom labels
- [ ] Historical charts (block time, tx volume)
- [ ] WebSocket support for instant updates

### ?? **Statistics**

- **New Files**: 12
- **Updated Files**: 15
- **Lines of Code Added**: ~2,500
- **Components Created**: 3
- **Composables Created**: 5
- **Views Created**: 3
- **Routes Added**: 3
- **Bug Fixes**: 2 major

---

## Version 1.0.0 - Initial Release

- Basic block explorer
- Transaction viewer
- Account lookup
- Keplr wallet integration
- Dark theme UI
- REST API integration

---

**Built with ?? for the Cosmos ecosystem**

*Making blockchain data beautiful, one explorer at a time* ?
