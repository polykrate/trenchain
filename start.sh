#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
CHAIN_DIR="$PROJECT_ROOT/parachain-template"
DAPP_DIR="$PROJECT_ROOT/dapp"
CHAIN_SPEC="$CHAIN_DIR/chain_spec.json"

NGROK_CHAIN_URL="trenchain.ngrok.dev"
NGROK_DAPP_URL="trenchchain.ngrok.io"

CHAIN_PORT=9944
DAPP_PORT=5173

LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  kill $(jobs -p) 2>/dev/null || true
  pkill -f "polkadot-omni-node.*chain_spec" 2>/dev/null || true
  pkill -f "ngrok.*$NGROK_CHAIN_URL" 2>/dev/null || true
  pkill -f "ngrok.*$NGROK_DAPP_URL" 2>/dev/null || true
  echo -e "${GREEN}Done.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  TRENCHAIN — Full Stack Launcher${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ─── 1. Kill previous instances ───────────────────────────────────
echo -e "\n${YELLOW}[1/5] Cleaning up previous processes...${NC}"
pkill -9 -f "polkadot-omni-node" 2>/dev/null || true
pkill -f "ngrok.*$NGROK_CHAIN_URL" 2>/dev/null || true
pkill -f "ngrok.*$NGROK_DAPP_URL" 2>/dev/null || true
lsof -ti:$DAPP_PORT | xargs kill -9 2>/dev/null || true
sleep 2
rm -rf /tmp/substrate* 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Clean slate"

# ─── 2. Start chain ──────────────────────────────────────────────
echo -e "\n${YELLOW}[2/5] Starting parachain node...${NC}"
cd "$CHAIN_DIR"
polkadot-omni-node --dev --chain "$CHAIN_SPEC" --dev-block-time 1000 --tmp \
  > "$LOG_DIR/chain.log" 2>&1 &
CHAIN_PID=$!
echo -e "  PID: $CHAIN_PID — waiting for blocks..."

for i in $(seq 1 60); do
  if grep -q "Imported #1" "$LOG_DIR/chain.log" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Node producing blocks"
    break
  fi
  if ! kill -0 $CHAIN_PID 2>/dev/null; then
    echo -e "  ${RED}✗ Node crashed. Check $LOG_DIR/chain.log${NC}"
    exit 1
  fi
  sleep 1
done

# ─── 3. Seed blockchain ──────────────────────────────────────────
echo -e "\n${YELLOW}[3/5] Seeding blockchain...${NC}"
cd "$DAPP_DIR"
SEED_FAST=1 npx tsx scripts/seed/index.ts > "$LOG_DIR/seed.log" 2>&1 &
SEED_PID=$!

PREV_LINES=0
while kill -0 $SEED_PID 2>/dev/null; do
  TOTAL_LINES=$(wc -l < "$LOG_DIR/seed.log" 2>/dev/null || echo 0)
  if [ "$TOTAL_LINES" -gt "$PREV_LINES" ]; then
    tail -n +$((PREV_LINES + 1)) "$LOG_DIR/seed.log" | head -n $((TOTAL_LINES - PREV_LINES)) | while IFS= read -r line; do
      echo -e "  $line"
    done
    PREV_LINES=$TOTAL_LINES
  fi
  sleep 2
done
wait $SEED_PID && SEED_OK=true || SEED_OK=false
# Print remaining lines
TOTAL_LINES=$(wc -l < "$LOG_DIR/seed.log" 2>/dev/null || echo 0)
if [ "$TOTAL_LINES" -gt "$PREV_LINES" ]; then
  tail -n +$((PREV_LINES + 1)) "$LOG_DIR/seed.log" | while IFS= read -r line; do
    echo -e "  $line"
  done
fi
if $SEED_OK; then
  echo -e "  ${GREEN}✓${NC} Seed complete"
else
  echo -e "  ${YELLOW}⚠${NC} Seed had errors (check $LOG_DIR/seed.log)"
fi

# ─── 4. Start dApp ───────────────────────────────────────────────
echo -e "\n${YELLOW}[4/5] Starting dApp dev server...${NC}"
cd "$DAPP_DIR"
npm run dev > "$LOG_DIR/dapp.log" 2>&1 &
DAPP_PID=$!

for i in $(seq 1 15); do
  if grep -q "Local:" "$LOG_DIR/dapp.log" 2>/dev/null; then
    DAPP_LOCAL=$(grep "Local:" "$LOG_DIR/dapp.log" | head -1 | sed 's/.*Local: *//')
    echo -e "  ${GREEN}✓${NC} dApp running at ${CYAN}$DAPP_LOCAL${NC}"
    break
  fi
  sleep 1
done

# ─── 5. Start ngrok tunnels ──────────────────────────────────────
echo -e "\n${YELLOW}[5/5] Starting ngrok tunnels...${NC}"

ngrok http --url="$NGROK_CHAIN_URL" $CHAIN_PORT \
  > "$LOG_DIR/ngrok-chain.log" 2>&1 &
echo -e "  ${GREEN}✓${NC} Chain tunnel: ${CYAN}wss://$NGROK_CHAIN_URL${NC}"

ngrok http --url="$NGROK_DAPP_URL" $DAPP_PORT \
  > "$LOG_DIR/ngrok-dapp.log" 2>&1 &
echo -e "  ${GREEN}✓${NC} dApp tunnel:  ${CYAN}https://$NGROK_DAPP_URL${NC}"

# ─── Summary ─────────────────────────────────────────────────────
echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}Local:${NC}"
echo -e "    Chain WS:  ws://127.0.0.1:$CHAIN_PORT"
echo -e "    dApp:      http://localhost:$DAPP_PORT"
echo -e "  ${GREEN}Remote (ngrok):${NC}"
echo -e "    Chain WS:  wss://$NGROK_CHAIN_URL"
echo -e "    dApp:      https://$NGROK_DAPP_URL"
echo -e "  ${GREEN}Polkadot.js:${NC}"
echo -e "    https://polkadot.js.org/apps/?rpc=ws://127.0.0.1:$CHAIN_PORT"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# ─── Logs ────────────────────────────────────────────────────────
tail -f "$LOG_DIR/chain.log" | grep --line-buffered "Idle\|finalized\|error" &

wait
