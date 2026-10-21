#!/bin/zsh
# Open the trainer in your Mac's default browser. No server required.
cd -- "${0:A:h}" || exit 1
exec /usr/bin/open index.html
