#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
CHAIN_DIR="$PROJECT_ROOT/parachain-template"
DAPP_DIR="$PROJECT_ROOT/dapp"
CHAIN_SPEC="$CHAIN_DIR/chain_spec.json"
WASM_PATH="$CHAIN_DIR/target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm"

NGROK_CHAIN_URL="trenchain.ngrok.dev"
NGROK_DAPP_URL="trenchain.ngrok.io"

CHAIN_PORT=9944
DAPP_PORT=5173
BLOCK_TIME=3000

LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Options ──────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_TYPEGEN=false
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-types) SKIP_TYPEGEN=true ;;
  esac
done

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
echo -e "\n${YELLOW}[1/7] Cleaning up previous processes...${NC}"
pkill -9 -f "polkadot-omni-node" 2>/dev/null || true
pkill -f "ngrok.*$NGROK_CHAIN_URL" 2>/dev/null || true
pkill -f "ngrok.*$NGROK_DAPP_URL" 2>/dev/null || true
lsof -ti:$DAPP_PORT | xargs kill -9 2>/dev/null || true
sleep 2
rm -rf /tmp/substrate* 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Clean slate"

# ─── 2. Build runtime (release) ──────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo -e "\n${YELLOW}[2/7] Building runtime (release)...${NC}"
  cd "$CHAIN_DIR"
  cargo build --release -p parachain-template-runtime 2>&1 | tee "$LOG_DIR/build.log" | tail -5
  if [ ! -f "$WASM_PATH" ]; then
    echo -e "  ${RED}✗ WASM not found at $WASM_PATH${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Runtime compiled"
else
  echo -e "\n${YELLOW}[2/7] Skipping build (--skip-build)${NC}"
  if [ ! -f "$WASM_PATH" ]; then
    echo -e "  ${RED}✗ No WASM found — remove --skip-build${NC}"
    exit 1
  fi
fi

# ─── 3. Generate chain spec ──────────────────────────────────────
echo -e "\n${YELLOW}[3/7] Generating chain spec...${NC}"
cd "$CHAIN_DIR"
chain-spec-builder create \
  -t development \
  --relay-chain rococo-local \
  --para-id 1000 \
  -r "$WASM_PATH" \
  named-preset development > "$CHAIN_SPEC" 2>"$LOG_DIR/chainspec.log"

if [ ! -s "$CHAIN_SPEC" ]; then
  echo -e "  ${RED}✗ chain_spec.json generation failed. Check $LOG_DIR/chainspec.log${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} chain_spec.json generated (block time: ${BLOCK_TIME}ms)"

# ─── 4. Start chain ──────────────────────────────────────────────
echo -e "\n${YELLOW}[4/7] Starting parachain node (${BLOCK_TIME}ms blocks)...${NC}"
cd "$CHAIN_DIR"
polkadot-omni-node --dev --chain "$CHAIN_SPEC" --dev-block-time $BLOCK_TIME --tmp \
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

# ─── 5. Regenerate dedot types ────────────────────────────────────
if [ "$SKIP_TYPEGEN" = false ]; then
  echo -e "\n${YELLOW}[5/7] Regenerating dedot chain types...${NC}"
  cd "$DAPP_DIR"
  npx dedot chaintypes \
    -w "ws://127.0.0.1:$CHAIN_PORT" \
    -o src/chain-api/parachain-template-runtime \
    -c ParachainTemplateRuntime \
    > "$LOG_DIR/dedot-typegen.log" 2>&1
  if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} Types generated in src/chain-api/parachain-template-runtime/"
  else
    echo -e "  ${YELLOW}⚠${NC} Type generation failed (check $LOG_DIR/dedot-typegen.log)"
  fi
else
  echo -e "\n${YELLOW}[5/7] Skipping type generation (--skip-types)${NC}"
fi

# ─── 6. Seed blockchain ──────────────────────────────────────────
echo -e "\n${YELLOW}[6/7] Seeding blockchain...${NC}"
cd "$DAPP_DIR"
SEED_TIMEOUT=600
SEED_FAST=1 npx tsx scripts/seed/index.ts 2>&1 | tee "$LOG_DIR/seed.log" | sed 's/^/  /' &
SEED_PID=$!

# Wait with timeout
ELAPSED=0
while kill -0 $SEED_PID 2>/dev/null; do
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  if [ $ELAPSED -ge $SEED_TIMEOUT ]; then
    echo -e "\n  ${RED}✗ Seed timed out after ${SEED_TIMEOUT}s — killing${NC}"
    kill $SEED_PID 2>/dev/null
    break
  fi
done
wait $SEED_PID 2>/dev/null && SEED_OK=true || SEED_OK=false
if $SEED_OK; then
  echo -e "  ${GREEN}✓${NC} Seed complete"
else
  echo -e "  ${YELLOW}⚠${NC} Seed had errors (check $LOG_DIR/seed.log)"
fi

# ─── 7. Start dApp ───────────────────────────────────────────────
echo -e "\n${YELLOW}[7/7] Starting dApp dev server...${NC}"
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

# ─── Ngrok tunnels (optional, non-blocking) ──────────────────────
echo -e "\n${YELLOW}Starting ngrok tunnels...${NC}"

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
