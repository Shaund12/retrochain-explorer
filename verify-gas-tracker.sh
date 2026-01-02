#!/bin/bash
# Phase 2 Gas Tracker Verification Script

echo "?? Phase 2: Gas Tracker Verification"
echo "===================================="
echo ""

# Check if files exist
echo "? Checking file structure..."

if [ -f "src/composables/useGasTracker.ts" ]; then
    echo "  ? Gas Tracker composable exists"
else
    echo "  ? Gas Tracker composable missing"
    exit 1
fi

if [ -f "src/views/HomeView.vue" ]; then
    echo "  ? HomeView exists"
else
    echo "  ? HomeView missing"
    exit 1
fi

echo ""
echo "? Checking Gas Tracker implementation..."

# Check for useGasTracker import in HomeView
if grep -q "import.*useGasTracker.*from.*@/composables/useGasTracker" src/views/HomeView.vue; then
    echo "  ? useGasTracker imported in HomeView"
else
    echo "  ? useGasTracker import missing in HomeView"
    exit 1
fi

# Check for gas-tracker card in dashboard
if grep -q 'id: "gas-tracker"' src/views/HomeView.vue; then
    echo "  ? gas-tracker card added to dashboard"
else
    echo "  ? gas-tracker card missing from dashboard"
    exit 1
fi

# Check for loadGasStats in refreshAll
if grep -q "loadGasStats()" src/views/HomeView.vue; then
    echo "  ? loadGasStats integrated into refresh cycle"
else
    echo "  ? loadGasStats not in refresh cycle"
    exit 1
fi

# Check for Gas Tracker template
if grep -q 'v-else-if="card.id === ' src/views/HomeView.vue | grep -q "gas-tracker"; then
    echo "  ? Gas Tracker card template exists"
else
    echo "  ??  Gas Tracker template may be incomplete"
fi

echo ""
echo "? Checking Gas Tracker composable features..."

# Check for key functions
if grep -q "parseGasPrice" src/composables/useGasTracker.ts && \
   grep -q "calculateStats" src/composables/useGasTracker.ts && \
   grep -q "calculateRecommendations" src/composables/useGasTracker.ts && \
   grep -q "fetchCurrentStats" src/composables/useGasTracker.ts; then
    echo "  ? Core functions implemented"
else
    echo "  ? Core functions missing"
    exit 1
fi

# Check for computed properties
if grep -q "efficiencyStatus" src/composables/useGasTracker.ts && \
   grep -q "congestionLevel" src/composables/useGasTracker.ts; then
    echo "  ? Computed properties implemented"
else
    echo "  ? Computed properties missing"
    exit 1
fi

# Check for interfaces
if grep -q "interface GasStats" src/composables/useGasTracker.ts && \
   grep -q "interface GasPriceRecommendation" src/composables/useGasTracker.ts; then
    echo "  ? TypeScript interfaces defined"
else
    echo "  ? TypeScript interfaces missing"
    exit 1
fi

echo ""
echo "? Checking documentation..."

if [ -f "PHASE2_GAS_TRACKER_COMPLETE.md" ]; then
    echo "  ? Gas Tracker documentation exists"
else
    echo "  ??  Gas Tracker documentation missing"
fi

echo ""
echo "===================================="
echo "? Phase 2: Gas Tracker Verification PASSED"
echo ""
echo "Next Steps:"
echo "1. Run: npm run dev"
echo "2. Navigate to HomeView (/)"
echo "3. Verify Gas Tracker card displays"
echo "4. Check auto-refresh updates gas stats"
echo "5. Test card collapse/expand/reorder"
echo ""
echo "Ready for Phase 2 next feature: Token Analytics! ??"
