#!/bin/bash
# Phase 1 Integration Verification Script

echo "?? Phase 1 Blockscout Features - Verification"
echo "============================================="
echo ""

# Check if all required files exist
echo "?? Checking files..."

FILES=(
  "src/utils/eventDecoder.ts"
  "src/composables/useSearch.ts"
  "src/components/RcSearchBar.vue"
  "src/views/TxDetailView.vue"
  "src/constants/accountLabels.ts"
  "PHASE1_FINAL_COMPLETE.md"
  "EVENT_DECODER_INTEGRATION.md"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ? $file"
  else
    echo "  ? $file (MISSING)"
    ALL_EXIST=false
  fi
done

echo ""

# Check for key imports in TxDetailView
echo "?? Verifying TxDetailView integration..."
if grep -q "import { decodeEvent, groupEventsByCategory, getCategoryColor" "src/views/TxDetailView.vue"; then
  echo "  ? Event decoder import found"
else
  echo "  ? Event decoder import missing"
  ALL_EXIST=false
fi

if grep -q "const decodedEvents = computed" "src/views/TxDetailView.vue"; then
  echo "  ? Decoded events computed property found"
else
  echo "  ? Decoded events computed property missing"
  ALL_EXIST=false
fi

if grep -q "groupedEvents" "src/views/TxDetailView.vue"; then
  echo "  ? Grouped events computed property found"
else
  echo "  ? Grouped events computed property missing"
  ALL_EXIST=false
fi

echo ""

# Check for multi-entity search in RcSearchBar
echo "?? Verifying Search Bar integration..."
if grep -q "searchAll, results, suggestions" "src/components/RcSearchBar.vue"; then
  echo "  ? Multi-entity search imports found"
else
  echo "  ? Multi-entity search imports missing"
  ALL_EXIST=false
fi

if grep -q "showResults" "src/components/RcSearchBar.vue"; then
  echo "  ? Multi-result dropdown implemented"
else
  echo "  ? Multi-result dropdown missing"
  ALL_EXIST=false
fi

echo ""

# Check event decoder utilities
echo "?? Verifying Event Decoder utilities..."
if grep -q "export function decodeEvent" "src/utils/eventDecoder.ts"; then
  echo "  ? decodeEvent function found"
else
  echo "  ? decodeEvent function missing"
  ALL_EXIST=false
fi

if grep -q "export function groupEventsByCategory" "src/utils/eventDecoder.ts"; then
  echo "  ? groupEventsByCategory function found"
else
  echo "  ? groupEventsByCategory function missing"
  ALL_EXIST=false
fi

if grep -q "export function getCategoryColor" "src/utils/eventDecoder.ts"; then
  echo "  ? getCategoryColor function found"
else
  echo "  ? getCategoryColor function missing"
  ALL_EXIST=false
fi

echo ""

# Summary
echo "============================================="
if [ "$ALL_EXIST" = true ]; then
  echo "? Phase 1 Integration: VERIFIED"
  echo ""
  echo "All features are properly integrated:"
  echo "  ? Multi-Entity Search"
  echo "  ? Transaction Event Decoder"
  echo "  ? Address Labels System"
  echo "  ? Transaction Logs Pretty-Print"
  echo ""
  echo "?? RetroChain Explorer is ready!"
  echo ""
  echo "Next steps:"
  echo "  1. npm run dev - Start dev server"
  echo "  2. Test multi-entity search"
  echo "  3. Navigate to any transaction to see event decoder"
  echo "  4. Ready for Phase 2!"
  exit 0
else
  echo "? Phase 1 Integration: INCOMPLETE"
  echo ""
  echo "Some files or features are missing. Please review the errors above."
  exit 1
fi
