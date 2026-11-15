#!/bin/bash
# Builds the site and publishes it to rilvona.com (static files only).
#
# Required environment:
#   DEPLOY_HOST  user@host of the web server, e.g. deploy@example.com
# Optional:
#   DEPLOY_PATH  target directory (default /var/www/rilvona/current/)
#   DEPLOY_KEY   ssh private key (default ~/.ssh/id_ed25519)
set -e
: "${DEPLOY_HOST:?Set DEPLOY_HOST to user@host}"
cd "$(dirname "$0")"
node build.mjs
rsync -az --delete -e "ssh -i ${DEPLOY_KEY:-$HOME/.ssh/id_ed25519}" dist/ "$DEPLOY_HOST:${DEPLOY_PATH:-/var/www/rilvona/current/}"
echo "SITE DEPLOY OK"
