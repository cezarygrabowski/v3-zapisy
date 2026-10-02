#!/usr/bin/env bash
set -Eeuo pipefail
script=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../deploy" && pwd)/release.sh
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/bin" "$scratch/source"
printf 'standalone server\n' > "$scratch/source/server.js"
for command in sudo chown; do
    printf '#!/usr/bin/env bash\nexit 0\n' > "$scratch/bin/$command"
done
# shellcheck disable=SC2016
printf '#!/usr/bin/env bash\nexit "${HEALTH_FAILURE:-0}"\n' > "$scratch/bin/curl"
chmod +x "$scratch/bin/"*
export PATH="$scratch/bin:$PATH"
release_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1

prepare() {
    export DEPLOY_ROOT="$scratch/$1"
    mkdir -p "$DEPLOY_ROOT/shared" "$DEPLOY_ROOT/incoming" "$DEPLOY_ROOT/releases"
    printf 'AUTH_SECRET=previous-secret\n' > "$DEPLOY_ROOT/shared/.env"
    printf 'AUTH_SECRET=candidate-secret\n' > "$DEPLOY_ROOT/incoming/$release_id.env"
    tar -czf "$DEPLOY_ROOT/incoming/$release_id.tar.gz" -C "$scratch/source" .
}

prepare success
bash "$script" "$release_id"
test "$(readlink -f "$DEPLOY_ROOT/current")" = "$DEPLOY_ROOT/releases/$release_id"
test ! -e "$DEPLOY_ROOT/incoming/$release_id.tar.gz"
test ! -e "$DEPLOY_ROOT/incoming/$release_id.env"
test "$(cat "$DEPLOY_ROOT/shared/.env")" = 'AUTH_SECRET=candidate-secret'
test "$(stat -c %a "$DEPLOY_ROOT/current/.env")" = '640'

prepare rollback
mkdir "$DEPLOY_ROOT/releases/previous"
ln -s "$DEPLOY_ROOT/releases/previous" "$DEPLOY_ROOT/current"
if HEALTH_FAILURE=1 bash "$script" "$release_id"; then
    echo 'Unhealthy release was accepted' >&2
    exit 1
fi
test "$(readlink -f "$DEPLOY_ROOT/current")" = "$DEPLOY_ROOT/releases/previous"
test "$(cat "$DEPLOY_ROOT/shared/.env")" = 'AUTH_SECRET=previous-secret'

prepare first-failure
if HEALTH_FAILURE=1 bash "$script" "$release_id"; then
    echo 'Unhealthy first release was accepted' >&2
    exit 1
fi
test ! -e "$DEPLOY_ROOT/current"
test ! -L "$DEPLOY_ROOT/current"
if bash "$script" ../invalid; then
    echo 'Invalid release ID was accepted' >&2
    exit 1
fi
echo 'Release activation and rollback checks passed'
