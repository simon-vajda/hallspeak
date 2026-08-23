#!/bin/sh
# Ownership of the /data bind mount is the container's problem, not the operator's:
# the directory they create on the host belongs to whatever uid they happen to be,
# and the server writes both the database and admin.json into it.
set -eu

# The same variable the server reads, so the directory owned here is the directory
# written to. The image sets it; the default is for a `docker run` that does not.
DATA_DIR="${DATA_DIR:-/data}"

# Reported the same way from both branches: the alternative is better-sqlite3's stack
# trace, which names database.js rather than the mount the operator has to fix.
refuse_unwritable() {
  echo "entrypoint: $DATA_DIR is not writable by $1." >&2
  echo "entrypoint: check the mount is not read-only, and that this uid owns it —" >&2
  echo "entrypoint: PUID/PGID, or chown on the host if you set Docker's user: yourself." >&2
  exit 1
}

# Docker's own `user:` directive already chose the identity, and the ownership fix is
# not reachable unprivileged. Failing here would break a deliberate choice — but the
# directory still has to be writable, so that is checked rather than assumed.
if [ "$(id -u)" -ne 0 ]; then
  [ -w "$DATA_DIR" ] || refuse_unwritable "$(id -u):$(id -g)"
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
  refuse_unwritable "${PUID}:${PGID}"
fi

# setpriv comes from util-linux, already in the Debian base. gosu or su-exec would
# each add a package to serve the same three arguments.
exec setpriv --reuid "$PUID" --regid "$PGID" --clear-groups "$@"
