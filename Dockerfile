FROM rust:1.82-bookworm AS chain-builder

WORKDIR /build
COPY parachain-template/ ./parachain-template/

WORKDIR /build/parachain-template
RUN cargo build --release -p parachain-template-runtime

FROM node:20-bookworm AS dapp-builder

WORKDIR /build/dapp
COPY dapp/package.json dapp/package-lock.json ./
RUN npm ci

COPY dapp/ ./
RUN npm run build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl nodejs npm tini \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/nickvdyck/webserv/releases/download/v0.3.0/webserv-v0.3.0-linux-x64.tar.gz \
    | tar -xz -C /usr/local/bin/ 2>/dev/null || true

RUN curl -fsSL https://github.com/nickvdyck/webserv/releases/download/v0.3.0/webserv-v0.3.0-linux-x64.tar.gz -o /dev/null; \
    npm install -g serve

WORKDIR /app

COPY --from=chain-builder /build/parachain-template/target/release/wbuild/parachain-template-runtime/parachain_template_runtime.compact.compressed.wasm /app/runtime.wasm

COPY --from=dapp-builder /build/dapp/dist /app/dapp-dist

COPY dapp/scripts /app/scripts
COPY dapp/src/data /app/data
COPY dapp/package.json dapp/package-lock.json /app/dapp-deps/
COPY start.sh /app/

RUN cd /app/dapp-deps && npm ci --omit=dev 2>/dev/null || true

COPY <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/bash
set -e

CHAIN_PORT=${CHAIN_PORT:-9944}
DAPP_PORT=${DAPP_PORT:-5173}
BLOCK_TIME=${BLOCK_TIME:-3000}

echo "=== Trenchain All-in-One ==="
echo "  Chain RPC: ws://localhost:$CHAIN_PORT"
echo "  DApp:      http://localhost:$DAPP_PORT"
echo ""

if ! command -v polkadot-omni-node &>/dev/null; then
  echo "ERROR: polkadot-omni-node not found."
  echo "Mount it or install in a derived image."
  exit 1
fi

if ! command -v chain-spec-builder &>/dev/null; then
  echo "ERROR: chain-spec-builder not found."
  echo "Mount it or install in a derived image."
  exit 1
fi

echo "[1/4] Generating chain spec..."
chain-spec-builder create \
  -r /app/runtime.wasm \
  named-preset development \
  > /app/chain_spec.json

echo "[2/4] Starting node..."
polkadot-omni-node \
  --chain /app/chain_spec.json \
  --dev-block-time $BLOCK_TIME \
  --tmp \
  --rpc-port $CHAIN_PORT \
  --rpc-cors all \
  &
NODE_PID=$!
sleep 5

echo "[3/4] Seeding chain..."
if [ -d /app/scripts/seed ]; then
  cd /app/dapp-deps
  CHAIN_URL="ws://127.0.0.1:$CHAIN_PORT" npx tsx /app/scripts/seed/index.ts || echo "Seed failed (non-fatal)"
  cd /app
fi

echo "[4/4] Serving dApp..."
serve -s /app/dapp-dist -l $DAPP_PORT &
DAPP_PID=$!

echo ""
echo "=== Ready ==="
echo "  Chain: ws://localhost:$CHAIN_PORT"
echo "  DApp:  http://localhost:$DAPP_PORT"
echo ""

wait $NODE_PID
ENTRYPOINT

RUN chmod +x /app/entrypoint.sh

EXPOSE 9944 5173

ENTRYPOINT ["tini", "--"]
CMD ["/app/entrypoint.sh"]
