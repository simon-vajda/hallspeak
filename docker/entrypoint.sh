#!/bin/sh
# Ownership of the /data bind mount is the container's problem, not the operator's:
# the directory they create on the host belongs to whatever uid they happen to be,
# and the server writes both the database and admin.json into it.
set -eu

DATA_DIR=/data

# Docker's own `user:` directive already chose the identity, and the ownership fix
# is not reachable unprivileged. Failing here would break a deliberate choice.
if [ "$(id -u)" -ne 0 ]; then
  exec "$@"
fi

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if ! mkdir -p "$DATA_DIR"; then
  echo "entrypoint: cannot create $DATA_DIR" >&2
  exit 1
fi

# Scoped to the mount and its contents. A recursive pass over the image would be
# both slow and pointless: nothing else is written at runtime.
chown -R "$PUID:$PGID" "$DATA_DIR" 2>/dev/null || true

# Checked as the runtime user rather than assumed from the chown: a read-only mount
# accepts neither, and the operator deserves the path in the message instead of a
# stack trace out of the database driver.
if ! setpriv --reuid "$PUID" --regid "$PGID" --clear-groups /usr/bin/test -w "$DATA_DIR"; then
  echo "entrypoint: $DATA_DIR is not writable by ${PUID}:${PGID}." >&2
  echo "entrypoint: check the bind mount is not read-only, or set PUID/PGID to an owner." >&2
  exit 1
fi

# setpriv comes from util-linux, already in the Debian base. gosu or su-exec would
# each add a package to serve the same three arguments.
exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
