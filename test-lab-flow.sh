#!/bin/bash
# test-lab-flow.sh
#
# Walks one lab order through the full lifecycle against your running backend
# and prints the state at each step, so we can confirm:
#   - stock is untouched at ORDERED
#   - stock deducts (FEFO) + charges are created at SAMPLE_COLLECTED
#   - cancelling a costed order restocks + voids charges + zeroes revenue/cost
#   - the billing visit-summary reads lab pricing from LabOrderCharge
#
# No jq required — uses `python3 -m json.tool` (built into macOS) to
# pretty-print, and small python one-liners to pull fields out of JSON.
#
# USAGE:
#   1. Make sure the backend is running: cd cms/backend && npm run start:dev
#   2. Edit the CONFIG block below (patient id, visit id, test catalog id).
#   3. chmod +x test-lab-flow.sh && ./test-lab-flow.sh
#   4. Paste the full output back.
#
# If any curl below 404s, it means I guessed a route path wrong — paste the
# 404 and run:  grep -n "@Get\|@Post\|@Patch\|@Delete" src/laboratory/laboratory.controller.ts
# (and the inventory/billing equivalents) so I can fix the paths.

set -e
BASE="http://localhost:3000/api"

pp() { python3 -m json.tool 2>/dev/null || cat; }                     # pretty-print JSON, fall back to raw
jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }  # e.g. jget "['id']"

# ---------- CONFIG — fill these in ----------
LOGIN_USER="dr.hassan"
LOGIN_PASS="CHANGE_ME"          # your real password for this account
PATIENT_ID="CHANGE_ME"          # GET $BASE/patients to find one
VISIT_ID="CHANGE_ME"            # a visit belonging to that patient
CBC_TEST_ID="CHANGE_ME"         # GET $BASE/settings/laboratory/test-catalog, find "CBC"
# ---------------------------------------------

echo "=== 1. Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}")
echo "$LOGIN_RESPONSE" | pp
TOKEN=$(echo "$LOGIN_RESPONSE" | jget "['accessToken']" || echo "$LOGIN_RESPONSE" | jget "['access_token']" || echo "$LOGIN_RESPONSE" | jget "['token']")
echo "Token acquired: ${TOKEN:0:20}..."
AUTH=(-H "Authorization: Bearer $TOKEN")

echo
echo "=== 2. Look up CBC's recipe components, capture starting stock ==="
curl -s "${AUTH[@]}" "$BASE/settings/laboratory/test-catalog/$CBC_TEST_ID" | pp
echo "--- current lab supplies (note stockQuantity for CBC's reagents) ---"
curl -s "${AUTH[@]}" "$BASE/inventory/supplies" | pp

echo
echo "=== 3. Create the lab order (should NOT touch stock) ==="
ORDER=$(curl -s -X POST "$BASE/laboratory/orders" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"patientId\":\"$PATIENT_ID\",\"visitId\":\"$VISIT_ID\",\"testIds\":[\"$CBC_TEST_ID\"]}")
echo "$ORDER" | pp
ORDER_ID=$(echo "$ORDER" | jget "['id']")
echo "Order id: $ORDER_ID"
echo "Expect: status ORDERED, costedAt null, charges empty"

echo
echo "=== 4. Preview consumption (dry run — should show sufficient/shortfall, no deduction) ==="
curl -s "${AUTH[@]}" "$BASE/laboratory/orders/$ORDER_ID/preview-consumption" | pp

echo
echo "=== 5. Transition to SAMPLE_COLLECTED — this should deduct stock + create charges ==="
curl -s -X PATCH "$BASE/laboratory/orders/$ORDER_ID/status" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d '{"status":"sample_collected"}' | pp
echo "Expect: sampleCollectedAt set, costedAt set, charges[] populated, totalRevenue/totalCost/grossProfit set"

echo
echo "=== 6. Re-check stock — CBC's reagents should be down by 1 each ==="
curl -s "${AUTH[@]}" "$BASE/inventory/supplies" | pp

echo
echo "=== 7. Check the stock log entries for one of CBC's supplies (grab an id from step 6) ==="
echo "  (manual step — run: curl -H \"Authorization: Bearer \$TOKEN\" \"$BASE/inventory/supplies/<id>/stock-logs\" | python3 -m json.tool)"

echo
echo "=== 8. Cancel the order — should restock, void charges, null out revenue/cost/profit ==="
curl -s -X PATCH "$BASE/laboratory/orders/$ORDER_ID/status" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}' | pp
echo "Expect: status CANCELLED, totalRevenue/totalCost/grossProfit null, charges[].voidedAt set"

echo
echo "=== 9. Confirm stock is back to the starting numbers from step 2 ==="
curl -s "${AUTH[@]}" "$BASE/inventory/supplies" | pp

echo
echo "=== 10. Cancel again — should be a no-op (idempotency check) ==="
curl -s -X PATCH "$BASE/laboratory/orders/$ORDER_ID/status" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}' | pp

echo
echo "=== 11. Billing visit-summary for this visit — cancelled order must NOT appear in labTotal ==="
curl -s "${AUTH[@]}" "$BASE/billing/visit-summary/$VISIT_ID" | pp
echo "Expect: labTotal 0 (or unaffected by this order), labItems doesn't include this order's CBC charge"

echo
echo "=== 12. Run a SECOND order through to COMPLETED (not cancelled), to check billing picks it up ==="
ORDER2=$(curl -s -X POST "$BASE/laboratory/orders" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"patientId\":\"$PATIENT_ID\",\"visitId\":\"$VISIT_ID\",\"testIds\":[\"$CBC_TEST_ID\"]}")
ORDER2_ID=$(echo "$ORDER2" | jget "['id']")
curl -s -X PATCH "$BASE/laboratory/orders/$ORDER2_ID/status" \
  "${AUTH[@]}" -H "Content-Type: application/json" -d '{"status":"sample_collected"}' > /dev/null
curl -s "${AUTH[@]}" "$BASE/billing/visit-summary/$VISIT_ID" | pp
echo "Expect: labTotal now includes this CBC's charge.revenue, labItems has one entry named CBC"

echo
echo "=== DONE — paste all of the above back ==="
