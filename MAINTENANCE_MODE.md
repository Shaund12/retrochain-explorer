# ?? Maintenance Mode Guide

## Quick Toggle (Environment Variables)

Maintenance mode is now controlled via **Vercel Environment Variables** - no code editing needed!

### Enable Maintenance Mode

Go to your Vercel dashboard ? Settings ? Environment Variables and add:

```
VITE_MAINTENANCE_MODE=true
```

Then redeploy or wait for auto-deploy.

### Disable Maintenance Mode

Change or remove the environment variable:

```
VITE_MAINTENANCE_MODE=false
```

## Vercel Dashboard Setup

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Click "Add Variable"
3. Add these variables:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_MAINTENANCE_MODE` | `true` | Production |
| `VITE_MAINTENANCE_MESSAGE` | `?? Arcade Module Upgrade` | Production |
| `VITE_MAINTENANCE_DETAILS` | `Upgrading arcade module with new features!` | Production |
| `VITE_MAINTENANCE_ETA` | `Expected completion: 30 minutes` | Production |

4. Click "Redeploy" or push any commit to trigger deployment

## Using Vercel CLI

### Quick Enable (Keep default messages)
```bash
vercel env add VITE_MAINTENANCE_MODE production
# Enter: true

vercel --prod
```

### Quick Disable
```bash
vercel env rm VITE_MAINTENANCE_MODE production

vercel --prod
```

### Custom Messages
```bash
# Enable with custom message
vercel env add VITE_MAINTENANCE_MESSAGE production
# Enter: ?? Arcade Module Upgrade

vercel env add VITE_MAINTENANCE_DETAILS production
# Enter: Upgrading arcade module with new games and features!

vercel env add VITE_MAINTENANCE_ETA production
# Enter: Expected completion: 20 minutes

vercel env add VITE_MAINTENANCE_MODE production
# Enter: true

vercel --prod
```

## Local Development

For local testing, add to your `.env` file:

```bash
VITE_MAINTENANCE_MODE=true
VITE_MAINTENANCE_MESSAGE=?? Testing Maintenance Mode
VITE_MAINTENANCE_DETAILS=This is a test of the maintenance banner
VITE_MAINTENANCE_ETA=Expected completion: Now
```

Then restart your dev server:
```bash
npm run dev
```

## Example Messages

### Arcade Module Upgrade
```bash
vercel env add VITE_MAINTENANCE_MESSAGE production
# ?? Arcade Module Upgrade

vercel env add VITE_MAINTENANCE_DETAILS production
# We're upgrading the arcade module with new features and improvements!

vercel env add VITE_MAINTENANCE_ETA production
# Expected completion: 15-20 minutes
```

### Network Upgrade
```bash
vercel env add VITE_MAINTENANCE_MESSAGE production
# ? Network Upgrade

vercel env add VITE_MAINTENANCE_DETAILS production
# RetroChain mainnet is being upgraded. All transactions are temporarily paused.

vercel env add VITE_MAINTENANCE_ETA production
# Expected completion: 1 hour
```

### Validator Maintenance
```bash
vercel env add VITE_MAINTENANCE_MESSAGE production
# ??? Validator Maintenance

vercel env add VITE_MAINTENANCE_DETAILS production
# Performing routine maintenance on our validator infrastructure.

vercel env add VITE_MAINTENANCE_ETA production
# Expected completion: 30 minutes
```

### Emergency Maintenance
```bash
vercel env add VITE_MAINTENANCE_MESSAGE production
# ?? Emergency Maintenance

vercel env add VITE_MAINTENANCE_DETAILS production
# Urgent security patch being applied. Service will resume shortly.

vercel env add VITE_MAINTENANCE_ETA production
# Expected completion: ASAP
```

## What Users See

When maintenance mode is enabled, users see a prominent orange banner at the top:

```
??????????????????????????????????????????????????????????
? ??  ?? System Upgrade in Progress                      ?
?                                                        ?
? RetroChain is currently undergoing scheduled          ?
? maintenance to upgrade the arcade module. We'll be    ?
? back online shortly!                                  ?
?                                                        ?
? Expected completion: ~30 minutes • Some features may  ?
? be temporarily unavailable                            ?
??????????????????????????????????????????????????????????
```

## One-Line Enable/Disable

### Quick Enable via Vercel Dashboard
1. Go to Vercel Dashboard ? Settings ? Environment Variables
2. Add `VITE_MAINTENANCE_MODE` = `true`
3. Click "Redeploy"
4. Banner appears in ~1 minute!

### Quick Enable via CLI
```bash
vercel env add VITE_MAINTENANCE_MODE production
# Enter: true
vercel --prod
```

### Quick Disable
```bash
vercel env rm VITE_MAINTENANCE_MODE production
vercel --prod
```

## Deployment

The banner updates automatically when you:
1. Change environment variables in Vercel dashboard
2. Click "Redeploy" (or push any commit)
3. Wait ~1 minute for deployment
4. Banner appears/disappears!

No code changes needed! ??

## Features

? **Environment variable controlled** - No code editing needed!  
? **Vercel dashboard toggle** - Enable/disable with one click  
? **Prominent orange banner** at top of every page  
? **Animated pulse indicators** to show system is working  
? **Customizable messages** via environment variables  
? **ETA display** so users know when to come back  
? **Responsive design** works on mobile  
? **Auto-spacing** pushes content down (no overlap)  
? **Instant deployment** - Changes live in ~1 minute  

## Advanced: Programmatic Control

You can still enable/disable via code if needed:

```typescript
import { useMaintenance } from '@/composables/useMaintenance';

const { enableMaintenance, disableMaintenance } = useMaintenance();

// Enable with custom message
enableMaintenance(
  '?? Arcade Module Upgrade',
  'New games and features coming soon!',
  '20 minutes'
);

// Disable
disableMaintenance();
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MAINTENANCE_MODE` | Enable/disable banner (`true`/`false`) | `false` |
| `VITE_MAINTENANCE_MESSAGE` | Main heading | `?? System Upgrade in Progress` |
| `VITE_MAINTENANCE_DETAILS` | Detailed description | `RetroChain is currently undergoing...` |
| `VITE_MAINTENANCE_ETA` | Time estimate | `Expected completion: ~30 minutes` |

## Pro Tip: Schedule in Advance

1. Enable maintenance mode
2. Push to a branch: `git checkout -b maintenance`
3. Set up PR
4. When ready to go into maintenance, merge the PR
5. When done, revert and merge

## Files

- `src/composables/useMaintenance.ts` - Configuration
- `src/components/RcMaintenanceBanner.vue` - Banner UI
- `src/App.vue` - Integration (already added)

## Summary

**To enable maintenance (NO CODE CHANGES):**
1. Go to Vercel Dashboard ? Environment Variables
2. Add `VITE_MAINTENANCE_MODE` = `true`
3. (Optional) Add custom message variables
4. Click "Redeploy"
5. Banner appears in ~1 minute!

**To disable:**
1. Remove or change `VITE_MAINTENANCE_MODE` to `false`
2. Click "Redeploy"
3. Banner disappears!

**Super simple! Perfect for arcade module upgrades! ??**

No git commits required - just toggle the environment variable!
