# ?? RetroChain Arcade Explorer

The **most amazing Cosmos blockchain explorer** - A beautiful, feature-rich explorer for RetroChain (and any Cosmos SDK blockchain).

![RetroChain Explorer](https://img.shields.io/badge/Cosmos-SDK-blue)
![Vue 3](https://img.shields.io/badge/Vue-3-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## ? Features

### ?? **Universal Search**
- Search by block height, transaction hash, or account address
- Smart auto-detection of search types
- Quick search suggestions with helpful hints

### ?? **Block Explorer**
- Real-time block updates with auto-refresh (10s interval)
- Detailed block information with navigation
- Transaction count and proposer details
- Beautiful loading states and animations

### ?? **Transaction Viewer**
- Enhanced transaction details with message decoding
- Visual success/failure indicators
- Gas usage analytics
- Event logs and raw JSON inspection
- Support for multiple message types (send, delegate, vote, etc.)

### ?? **Account Management**
- Comprehensive balance viewer with formatted amounts
- Transaction history per address
- Support for all denominations
- Beautiful stats cards showing total balance and activity

### ??? **Validators Dashboard**
- Complete validator set with voting power
- Visual voting power distribution
- Commission rates and status indicators
- Sorting by voting power
- Jailed/active status tracking

### ??? **Governance Portal**
- All governance proposals in one place
- Status tracking (voting, deposit, passed, rejected)
- Vote tally visualization
- Proposal details with descriptions

### ?? **Beautiful UI/UX**
- Dark theme optimized for extended use
- Smooth animations and transitions
- Responsive design for all screen sizes
- Loading spinners and skeleton states
- Custom scrollbar styling
- Gradient accents and modern card designs

### ? **Real-time Updates**
- Auto-refresh functionality with countdown timer
- Pause/resume controls
- Live network statistics
- 10-second refresh intervals (configurable)

### ?? **Keplr Wallet Integration**
- Connect to Keplr wallet
- Address display in header
- **Auto-connect on Account page** - Automatically loads your wallet when connected
- Visual indicator showing which account is yours
- Quick "Load My Account" button
- Ready for transaction signing (extensible)

## ??? Tech Stack

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript
- **Build Tool**: Vite 6
- **Styling**: Custom CSS with utility classes
- **HTTP Client**: Axios
- **Routing**: Vue Router 4
- **Date Formatting**: Day.js with relative time plugin
- **Blockchain**: Cosmos SDK REST API

## ?? Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

## ?? Configuration

Edit `.env` to configure your REST API endpoint:

```env
VITE_REST_API_URL=http://localhost:1317
```

## ?? Quick Start

1. **Start your Cosmos chain**:
   ```bash
   ignite chain serve
   ```

2. **Start the explorer**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to `http://localhost:5173`

## ?? Views & Routes

| Route | Description |
|-------|-------------|
| `/` | Home dashboard with quick stats |
| `/blocks` | All blocks with pagination |
| `/blocks/:height` | Detailed block view |
| `/txs` | All transactions |
| `/txs/:hash` | Detailed transaction view |
| `/account/:address?` | Account balances & history |
| `/validators` | Validator set overview |
| `/governance` | Governance proposals |

## ?? Key Components

### Composables
- `useApi` - Axios client configuration
- `useBlocks` - Block data fetching
- `useTxs` - Transaction queries
- `useAccount` - Account balance queries
- `useValidators` - Validator set management
- `useGovernance` - Governance proposals
- `useSearch` - Universal search
- `useAutoRefresh` - Auto-refresh functionality
- `useKeplr` - Keplr wallet integration
- `useToast` - Toast notifications
- `useChainInfo` - Chain metadata

### Components
- `RcHeader` - Navigation header with Keplr
- `RcSearchBar` - Universal search input
- `RcStatCard` - Stat display cards
- `RcLoadingSpinner` - Beautiful loading animation
- `RcToastHost` - Toast notification system
- `RcNetworkStats` - Network statistics grid

## ?? Design Philosophy

- **Information Density**: Show relevant data without overwhelming
- **Progressive Disclosure**: Details on demand
- **Visual Hierarchy**: Clear structure with typography and spacing
- **Performance**: Optimized rendering and lazy loading
- **Accessibility**: Semantic HTML and keyboard navigation
- **Responsiveness**: Works beautifully on all devices

## ?? Future Enhancements

- [ ] IBC transfer tracking and visualization
- [ ] CosmWasm contract interaction
- [ ] Advanced filtering (by message type, date range, etc.)
- [ ] Gas analytics and fee optimization
- [ ] Custom alerts and notifications
- [ ] Transaction builder
- [ ] Multi-chain support
- [ ] Light/dark theme toggle
- [ ] Export to CSV/JSON
- [ ] Address book with labels
- [ ] Historical charts (block time, tx volume)
- [ ] WebSocket support for instant updates
- [ ] Mobile app (React Native)

## ?? Contributing

This explorer is designed to be **the most amazing Cosmos explorer ever**. Contributions are welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## ?? License

MIT License - feel free to use this in your own projects!

## ?? Why This Explorer is Amazing

1. **?? Beautiful Design** - Not just functional, but gorgeous
2. **? Real-time Updates** - Stay in sync with the blockchain
3. **?? Smart Search** - Find anything instantly
4. **?? Rich Data** - Detailed insights at every level
5. **?? User Focused** - Built for actual blockchain users
6. **?? Fast & Responsive** - Optimized performance
7. **??? Extensible** - Easy to customize and extend
8. **?? Mobile Ready** - Works great on any device
9. **?? Production Ready** - Battle-tested patterns
10. **?? Open Source** - Free for everyone

---

Built with ?? for the Cosmos ecosystem
