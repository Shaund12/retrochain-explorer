# ?? Installation Guide - Next Level Enhancements

## ? Quick Install

Run this command to install all new dependencies:

```bash
npm install
```

This will install:
- `vue-toastification@next` - Toast notifications
- `@vueuse/core` - Vue composition utilities
- `@cosmjs/stargate` - Cosmos SDK client
- `@cosmjs/proto-signing` - Transaction signing

## ?? What's New

### Package Updates

```json
{
  "dependencies": {
    "@cosmjs/proto-signing": "^0.32.4",
    "@cosmjs/stargate": "^0.32.4",
    "@vueuse/core": "^11.0.3",
    "axios": "^1.7.7",
    "dayjs": "^1.11.13",
    "vue": "^3.5.12",
    "vue-router": "^4.4.5",
    "vue-toastification": "^2.0.0-rc.5"
  }
}
```

## ?? New Features Added

### 1. Toast Notifications
- `src/composables/useToast.ts` - Enhanced with vue-toastification
- `src/main.ts` - Toast plugin registration
- `src/assets/main.css` - Custom toast styling

### 2. Disclaimer Component
- `src/components/RcDisclaimer.vue` - Reusable disclaimer banners
- Multiple types: info, warning, danger
- Animated backgrounds
- Dismissible option

### 3. Enhanced Views
- `src/views/BuyView.vue` - Added disclaimer + toast
- `src/views/DexView.vue` - Added disclaimer + toast
- `src/views/StakingView.vue` - Added disclaimer + toast

## ?? Build Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify Installation
```bash
npm list vue-toastification @vueuse/core
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

## ? Verification

After installation, verify everything works:

1. **Dev Server**: Visit `http://localhost:5173`
2. **Check Toasts**: Look for toast notifications in top-right
3. **Check Disclaimers**: See warning banners on Buy/DEX/Staking pages
4. **Test Features**: Try connecting wallet, copy address, etc.

## ?? Testing Toast Notifications

Open browser console and test:

```javascript
// In browser console
import { useToast } from '@/composables/useToast'
const toast = useToast()

toast.showSuccess("It works!")
toast.showError("Error test")
toast.showWarning("Warning test")
toast.showInfo("Info test")
```

## ?? Visual Testing

### Expected Results

1. **Buy Page** (`/buy`):
   - ?? Yellow warning banner at top
   - Toast when copying address
   - Toast on wallet connection

2. **DEX Page** (`/dex`):
   - ?? Yellow warning banner at top
   - Toast on swap attempts
   - Toast on wallet connection

3. **Staking Page** (`/staking`):
   - ?? Blue info banner at top
   - Toast on delegations
   - Toast on claiming rewards

## ?? Troubleshooting

### TypeScript Errors
If you see TypeScript errors after `npm install`, try:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Toast Not Showing
1. Check browser console for errors
2. Verify `vue-toastification` is installed
3. Check `src/main.ts` has Toast plugin registered
4. Verify `src/assets/main.css` has toast styles

### Disclaimer Not Rendering
1. Check `src/components/RcDisclaimer.vue` exists
2. Verify component is imported in views
3. Check for syntax errors in template

## ?? Customization

### Toast Position
Edit `src/main.ts`:
```typescript
app.use(Toast, {
  position: "top-right", // or "top-left", "bottom-right", etc.
  timeout: 5000, // milliseconds
  maxToasts: 5, // max on screen at once
});
```

### Toast Colors
Edit `src/assets/main.css`:
```css
/* Change success color */
.Vue-Toastification__toast--success .custom-toast {
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 
              0 0 20px rgba(16, 185, 129, 0.2);
}
```

### Disclaimer Types
Use in components:
```vue
<!-- Info (blue) -->
<RcDisclaimer type="info" title="Information">
  <p>Some helpful info...</p>
</RcDisclaimer>

<!-- Warning (yellow) -->
<RcDisclaimer type="warning" title="Warning">
  <p>Be careful...</p>
</RcDisclaimer>

<!-- Danger (red) -->
<RcDisclaimer type="danger" title="Critical">
  <p>Important notice!</p>
</RcDisclaimer>
```

## ?? File Changes Summary

### New Files
- ? `src/components/RcDisclaimer.vue`
- ? `NEXT_LEVEL_ENHANCEMENTS.md`

### Modified Files
- ?? `package.json` - Added new dependencies
- ?? `src/composables/useToast.ts` - Enhanced with vue-toastification
- ?? `src/main.ts` - Added Toast plugin
- ?? `src/assets/main.css` - Added toast styles
- ?? `src/App.vue` - Removed old toast host
- ?? `src/views/BuyView.vue` - Added disclaimer + toasts
- ?? `src/views/DexView.vue` - Added disclaimer + toasts
- ?? `src/views/StakingView.vue` - Added disclaimer + toasts

## ?? Next Steps

1. **Install packages**: `npm install`
2. **Test locally**: `npm run dev`
3. **Review disclaimers**: Check if wording is accurate
4. **Test toasts**: Try all user actions
5. **Build for prod**: `npm run build`
6. **Deploy**: Push to your hosting

## ?? Success Metrics

After installation, you should have:

? Professional toast notifications
? Clear development disclaimers
? Enhanced user feedback
? Production-ready UI/UX
? Zero TypeScript errors
? Smooth animations
? Beautiful gradients
? Mobile-responsive

## ?? Support

If you encounter issues:

1. Check this guide
2. Review `NEXT_LEVEL_ENHANCEMENTS.md`
3. Check browser console
4. Verify package.json dependencies
5. Try clean install: `rm -rf node_modules && npm install`

## ?? Preview

Your explorer now has:

```
???????????????????????????????????????????
?  ?? Feature Under Development           ?
?  The swap and liquidity features are... ?
???????????????????????????????????????????

???????????????????????????????????????????
?  ?? Swap Tokens                         ?
?  [From] 100 USDC                        ?
?  [To]   85 RETRO                        ?
?  [Swap]          ? Clicks this          ?
???????????????????????????????????????????

                    ?

???????????????????????????????????????????
?  ?? Toast appears:                       ?
?  ?? Preparing swap transaction...       ?
???????????????????????????????????????????

                    ?

???????????????????????????????????????????
?  ?? Toast updates:                       ?
?  ? Transaction successful! Hash: 0x... ?
???????????????????????????????????????????
```

**Your explorer is now NEXT LEVEL!** ???

---

## Installation Commands

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open browser
open http://localhost:5173

# 4. Test features
# - Go to /buy - see disclaimer
# - Go to /dex - see disclaimer
# - Go to /staking - see disclaimer
# - Connect wallet - see toast
# - Copy address - see toast

# 5. Build for production
npm run build

# 6. Deploy
# Upload dist/ folder to your hosting
```

Done! ??
