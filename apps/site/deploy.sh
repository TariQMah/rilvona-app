#!/bin/bash
# Builds the site and publishes it to rilvona.com (static files, plus the APK if one was staged).
#
# To release a new APK:
#   node publish-apk.mjs ../mobile/android/app/build/outputs/apk/release/app-release.apk
#   DEPLOY_HOST=user@host ./deploy.sh
#
# Required environment:
#   DEPLOY_HOST  user@host of the web server, e.g. deploy@example.com
# Optional:
#   DEPLOY_PATH  target directory (default /var/www/rilvona/current/)
#   DEPLOY_KEY   ssh private key (default ~/.ssh/id_ed25519)
set -e
: "${DEPLOY_HOST:?Set DEPLOY_HOST to user@host}"
cd "$(dirname "$0")"
TARGET="${DEPLOY_PATH:-/var/www/rilvona/current/}"
SSH="ssh -i ${DEPLOY_KEY:-$HOME/.ssh/id_ed25519}"

node build.mjs

# Upload the APK first so the page never links to a file that isn't there yet.
# /download/ is excluded from the --delete below, so redeploying the site never removes older APKs.
if ls apk/*.apk >/dev/null 2>&1; then
  $SSH "$DEPLOY_HOST" "mkdir -p '${TARGET}download'"
  rsync -az --progress -e "$SSH" apk/ "$DEPLOY_HOST:${TARGET}download/"
fi
rsync -az --delete --exclude '/download/' -e "$SSH" dist/ "$DEPLOY_HOST:$TARGET"
echo "SITE DEPLOY OK"
