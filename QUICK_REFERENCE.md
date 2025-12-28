# ?? Quick Reference - Toast & Disclaimers

## Installation

```bash
npm install
npm run dev
```

## Toast Usage

### Import
```typescript
import { useToast } from "@/composables/useToast";
const toast = useToast();
```

### Methods
```typescript
// Success (green, 5s)
toast.showSuccess("It worked!");

// Error (red, 7s)
toast.showError("Something failed");

// Warning (orange, 6s)
toast.showWarning("Be careful!");

// Info (purple, 5s)
toast.showInfo("Processing...");

// Transaction success
toast.showTxSuccess("0xabc123...");

// Transaction error
toast.showTxError("Insufficient balance");

// Wallet connecting
toast.showConnecting();

// Wallet connected
toast.showConnected("cosmos1abc...");
```

## Disclaimer Usage

### Import
```vue
<script setup>
import RcDisclaimer from "@/components/RcDisclaimer.vue";
</script>
```

### Warning (Yellow)
```vue
<RcDisclaimer type="warning" title="?? Caution">
  <p>This feature is in development...</p>
</RcDisclaimer>
```

### Info (Blue)
```vue
<RcDisclaimer type="info" title="?? Information">
  <p>This feature is active...</p>
</RcDisclaimer>
```

### Danger (Red)
```vue
<RcDisclaimer type="danger" title="?? Critical">
  <p>This action is irreversible...</p>
</RcDisclaimer>
```

### Dismissible
```vue
<RcDisclaimer 
  type="info" 
  :dismissible="true"
  @dismiss="handleDismiss"
>
  <p>Content...</p>
</RcDisclaimer>
```

## Common Patterns

### Transaction Flow
```typescript
const handleTransaction = async () => {
  toast.showInfo("Preparing transaction...");
  
  try {
    const result = await signAndBroadcast(...);
    
    if (result.code === 0) {
      toast.showTxSuccess(result.transactionHash);
    } else {
      throw new Error(result.rawLog);
    }
  } catch (e) {
    toast.showTxError(e.message);
  }
};
```

### Copy to Clipboard
```typescript
const copyAddress = async () => {
  await navigator.clipboard.writeText(address);
  toast.showSuccess("Copied!");
};
```

### Wallet Connection
```typescript
const handleConnect = async () => {
  toast.showConnecting();
  
  try {
    await connect();
    toast.showConnected(address.value);
  } catch (e) {
    toast.showError("Connection failed");
  }
};
```

## Toast Colors

| Type | Icon | Color | Duration |
|------|------|-------|----------|
| Success | ? | Green | 5s |
| Error | ? | Red | 7s |
| Warning | ?? | Orange | 6s |
| Info | ?? | Purple | 5s |

## Disclaimer Colors

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| warning | ?? | Yellow/Amber | Development, Beta |
| info | ?? | Blue/Indigo | Information, Active |
| danger | ? | Red/Rose | Critical, Irreversible |

## File Locations

```
src/
?? composables/
  ?? useToast.ts          ? Toast composable
?? components/
  ?? RcDisclaimer.vue     ? Disclaimer component
?? views/
  ?? BuyView.vue          ? Has disclaimer
  ?? DexView.vue          ? Has disclaimer
  ?? StakingView.vue      ? Has disclaimer
?? assets/
  ?? main.css             ? Toast styles
?? main.ts                ? Toast init
```

## Configuration

### Toast Config (main.ts)
```typescript
app.use(Toast, {
  position: "top-right",
  timeout: 5000,
  maxToasts: 5,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
});
```

### Custom Timeout
```typescript
toast.showSuccess("Message", {
  timeout: 10000 // 10 seconds
});
```

## Troubleshooting

### Toast not showing?
1. Check `npm install` completed
2. Verify `src/main.ts` has Toast plugin
3. Check browser console for errors
4. Verify `src/assets/main.css` has styles

### Disclaimer not rendering?
1. Check component import
2. Verify `RcDisclaimer.vue` exists
3. Check props are correct
4. Review browser console

### TypeScript errors?
```bash
rm -rf node_modules package-lock.json
npm install
```

## Testing

### Test Toasts
```typescript
// In browser console
const { useToast } = await import('/src/composables/useToast.ts');
const toast = useToast();
toast.showSuccess("Test!");
```

### Test Disclaimers
Visit:
- `/buy` - Warning disclaimer
- `/dex` - Warning disclaimer
- `/staking` - Info disclaimer

## Cheat Sheet

```typescript
// ? SUCCESS
toast.showSuccess("Success!");

// ? ERROR
toast.showError("Error!");

// ?? WARNING
toast.showWarning("Warning!");

// ?? INFO
toast.showInfo("Info!");

// ?? TX SUCCESS
toast.showTxSuccess("0xabc...");

// ?? TX ERROR
toast.showTxError("Failed!");

// ?? CONNECTING
toast.showConnecting();

// ? CONNECTED
toast.showConnected("cosmos1...");
```

## Visual Examples

```
Toast Position (Desktop):
???????????????????????????????????
?                                 ?
?                    ???????????? ?
?                    ? ? Toast  ? ?
?                    ???????????? ?
?                                 ?
?       Content Area              ?
?                                 ?
???????????????????????????????????

Disclaimer Position:
???????????????????????????????????
? ?? Warning Disclaimer           ? ? Top of page
???????????????????????????????????
?                                 ?
?       Page Content              ?
?                                 ?
???????????????????????????????????
```

## Best Practices

### ? DO
- Use appropriate toast type
- Keep messages concise
- Show disclaimers at top
- Test on mobile
- Handle errors gracefully

### ? DON'T
- Overuse toasts (max 5)
- Use long messages
- Hide disclaimers in docs
- Ignore mobile view
- Skip error messages

## Resources

- **Full Docs**: `NEXT_LEVEL_ENHANCEMENTS.md`
- **Installation**: `INSTALLATION_GUIDE.md`
- **Summary**: `ENHANCEMENT_SUMMARY.md`
- **Visual Guide**: `VISUAL_STYLE_GUIDE.md`

---

**Quick Start**: `npm install && npm run dev` ??
