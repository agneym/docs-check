#!/bin/sh
# Ubuntu/Debian x86_64 fallback when QEMU is absent and sudo is unavailable.
# Downloads distribution packages and extracts them under the user's cache.
set -eu
root="${DOCS_CHECK_QEMU_ROOT:-$HOME/.cache/docs-check-runtime/qemu}"
mkdir -p "$root/debs"
cd "$root/debs"
apt-get download qemu-system-x86 qemu-system-common qemu-system-data qemu-utils \
  seabios ipxe-qemu libfdt1 libpmem1 librdmacm1t64 libslirp0 liburing2 libndctl6 libdaxctl1
for f in ./*.deb; do dpkg-deb -x "$f" "$root"; done
ln -sf "$root/usr/lib/ipxe/qemu/efi-virtio.rom" "$root/usr/share/qemu/efi-virtio.rom"
LD_LIBRARY_PATH="$root/usr/lib/x86_64-linux-gnu" "$root/usr/bin/qemu-system-x86_64" --version
