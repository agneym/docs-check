#!/bin/sh
# User-local Ubuntu package extraction; no sudo or host-wide library changes.
set -eu
root="${DOCS_CHECK_QEMU_ROOT:-$HOME/.cache/docs-check-runtime/qemu}"
export QEMU_MODULE_DIR="$root/usr/lib/x86_64-linux-gnu/qemu"
export LD_LIBRARY_PATH="$root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$root/usr/bin/qemu-system-x86_64" -L "$root/usr/share/qemu" -bios "$root/usr/share/seabios/bios-256k.bin" "$@"
