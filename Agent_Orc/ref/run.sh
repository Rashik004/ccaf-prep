#!/usr/bin/env bash
# macOS/Linux launcher:  ./run.sh "your research topic"
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null || { echo "Node.js 20.12+ is required: https://nodejs.org"; exit 1; }
[ -d node_modules ] || { echo "Installing dependencies..."; npm install; }
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env - add your ANTHROPIC_API_KEY to it, then run again."
  exit 1
fi

npm start -- "$@"
