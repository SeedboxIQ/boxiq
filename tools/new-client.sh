#!/usr/bin/env bash
# Spin up a new prospect site from _template.
#
#   tools/new-client.sh bayer "Bayer" "#00617F" "#004C63" light
#                       slug   name    accent     darker    text-on-accent: light|dark
#
# Refuses to touch a folder that already exists, so an existing demo can never
# be overwritten by a new one.
set -euo pipefail
cd "$(dirname "$0")/.."

slug=${1:-}; name=${2:-}; accent=${3:-#8FB53C}; deep=${4:-#5A7A1E}; ontone=${5:-dark}
if [ -z "$slug" ] || [ -z "$name" ]; then
  echo "usage: tools/new-client.sh <slug> \"<Client Name>\" [#accent] [#accent-deep] [light|dark]" >&2
  exit 2
fi
if [ -e "$slug" ]; then
  echo "'$slug/' already exists. Pick another slug, or edit that folder directly." >&2
  exit 1
fi

case "$ontone" in
  light) on="#F2F2EE" ;;   # accent is dark, so text on it is light
  dark)  on="#1F211E" ;;   # accent is light, so text on it is near-black
  *) echo "last argument must be 'light' or 'dark'" >&2; exit 2 ;;
esac

cp -r _template "$slug"
month=$(date "+%B %Y")
esc=${name//&/\\&}

tmp=$(mktemp)
sed -e "s|CLIENT_NAME|$esc|g" \
    -e "s|MONTH YEAR|$month|" \
    -e "s|--accent:#8FB53C|--accent:$accent|" \
    -e "s|--accent-deep:#5A7A1E|--accent-deep:$deep|" \
    -e "s|--on-accent:#1F211E|--on-accent:$on|" \
    "$slug/index.html" > "$tmp"
mv "$tmp" "$slug/index.html"

cat <<MSG
Created $slug/

Still to do:
  1. Save their logo as $slug/<file>.png and set "logo" in $slug/index.html
  2. Replace $slug/gates.csv with rows that look like their operation
  3. tools/make-demo-labels.py $slug https://seedboxiq.github.io/boxiq/$slug/ SG01009001
  4. git add $slug && git commit -m "BoxIQ demo for $name" && git push

Live in about a minute at https://seedboxiq.github.io/boxiq/$slug/
MSG
