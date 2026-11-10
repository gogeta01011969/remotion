#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Linux ]] || { echo 'This installer is for Linux runners'; exit 1; }
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends ffmpeg libnss3 libgbm1 libasound2t64 libgtk-3-0t64 libxkbcommon0
python -m pip install -r requirements-linux.txt
npx remotion browser ensure
