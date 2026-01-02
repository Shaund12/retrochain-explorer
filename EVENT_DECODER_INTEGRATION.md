# ?? Quick Integration: Event Decoder in TxDetailView

## **5-Minute Integration Guide**

### **Step 1: Import the Event Decoder**

Add to `src/views/TxDetailView.vue` script section:

```typescript
import { decodeEvent, groupEventsByCategory, getCategoryColor, type DecodedEvent } from "@/utils/eventDecoder";
```

### **Step 2: Create Decoded Events Computed Property**

Add after existing `events` computed:

```typescript
const decodedEvents = computed<DecodedEvent[]>(() => {
  return events.value.map((event) => decodeEvent(event));
});

const groupedEvents = computed(() => {
  return groupEventsByCategory(decodedEvents.value);
});

const eventCategories = computed(() => {
  const groups = groupedEvents.value;
  return Object.keys(groups).filter((cat) => groups[cat].length > 0);
});
```

### **Step 3: Add New Events Section to Template**

Replace the existing events display section with this enhanced version:

```vue
<!-- Enhanced Event Decoder Section -->
<div v-if="hasEvents" class="card">
  <div class="flex items-center justify-between mb-3">
    <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
      <span>??</span>
      <span>Transaction Events</span>
      <span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-400/30 text-emerald-300">
        {{ decodedEvents.length }} events
      </span>
    </h2>
    <button
      class="text-xs text-slate-400 hover:text-white transition-colors"
      @click="viewMode = viewMode === 'pretty' ? 'raw' : 'pretty'"
    >
      {{ viewMode === 'pretty' ? '?? Raw View' : '?? Pretty View' }}
    </button>
  </div>

  <!-- Pretty View (Categorized Events) -->
  <div v-if="viewMode === 'pretty'" class="space-y-3">
    <div
      v-for="category in eventCategories"
      :key="category"
      class="rounded-xl border overflow-hidden"
      :class="`border-${getCategoryColor(category)}-500/30 bg-${getCategoryColor(category)}-500/5`"
    >
      <div class="px-3 py-2 border-b"
           :class="`border-${getCategoryColor(category)}-500/30 bg-${getCategoryColor(category)}-500/10`">
        <div class="text-xs font-semibold uppercase tracking-wider"
             :class="`text-${getCategoryColor(category)}-300`">
          {{ category }} ({{ groupedEvents[category].length }})
        </div>
      </div>
      <div class="p-3 space-y-2">
        <div
          v-for="(event, idx) in groupedEvents[category]"
          :key="`${event.type}-${idx}`"
          class="p-3 rounded-lg bg-slate-900/60 border border-white/10"
        >
          <div class="flex items-start gap-3">
            <div class="text-2xl">{{ event.icon }}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <div class="font-semibold text-white">{{ event.title }}</div>
                <span 
                  class="text-[10px] px-2 py-0.5 rounded-full border"
                  :class="event.importance === 'high' 
                    ? 'border-rose-400/40 bg-rose-500/10 text-rose-300'
                    : event.importance === 'medium'
                      ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
                      : 'border-slate-400/40 bg-slate-500/10 text-slate-300'"
                >
                  {{ event.importance }}
                </span>
              </div>
              <div class="text-xs text-slate-400 mb-2">{{ event.description }}</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div
                  v-for="attr in event.attributes"
                  :key="`${event.type}-${attr.key}`"
                  class="flex flex-col gap-0.5"
                >
                  <div class="text-slate-500 uppercase tracking-wider">{{ attr.key }}</div>
                  <div class="font-mono break-all text-slate-200">
                    <RouterLink
                      v-if="attr.link"
                      :to="attr.link"
                      class="text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
                    >
                      <span>{{ attr.formatted || attr.value }}</span>
                      <span class="text-[9px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                    </RouterLink>
                    <span v-else>{{ attr.formatted || attr.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Raw View (Original Display) -->
  <div v-else class="space-y-2">
    <div
      v-for="event in events"
      :key="event.id"
      class="p-3 rounded-lg bg-slate-900/60 border border-white/10"
    >
      <div class="text-xs font-semibold text-emerald-300 mb-2">{{ event.type }}</div>
      <div class="space-y-1 text-[11px]">
        <div v-for="attr in event.attributes" :key="attr.id" class="grid grid-cols-3 gap-2">
          <div class="text-slate-500">{{ attr.key }}</div>
          <div class="col-span-2 font-mono text-slate-200 break-all">{{ attr.value }}</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### **Step 4: Test the Integration**

Visit any transaction detail page and verify:
- ? Events are grouped by category (Transfer, Delegation, Contract, etc.)
- ? Each event shows an icon and formatted description
- ? Addresses are clickable links
- ? Toggle between "Pretty View" and "Raw View" works
- ? Importance badges (high/medium/low) are visible

---

## **?? Tailwind Color Classes**

The decoder uses dynamic color classes. Make sure these are available in your Tailwind config:

```javascript
// tailwind.config.js - already configured
colors: {
  emerald: { ... },  // Transfer
  indigo: { ... },   // Delegation
  purple: { ... },   // Contract
  cyan: { ... },     // IBC
  amber: { ... },    // Governance
  rose: { ... },     // Burn
  pink: { ... },     // Reward
  slate: { ... }     // Other
}
```

---

## **?? Expected Result**

Before:
```
Event: transfer
  recipient: cosmos1abc...xyz
  amount: 1000000uretro
  sender: cosmos1def...uvw
```

After:
```
TRANSFER (1)
  ?? Transfer
     1.000000 RETRO transferred
     [HIGH]
     
     Recipient: cosmos1abc...xyz [View]
     Amount: 1.000000 RETRO
     Sender: cosmos1def...uvw [View]
```

---

## **?? RetroChain Tip**

The event decoder automatically handles arcade-specific events like `burn` with `tokens_burned` attributes from Insert Coin operations! ????
