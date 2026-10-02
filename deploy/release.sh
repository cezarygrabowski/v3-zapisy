#!/usr/bin/env bash
set -Eeuo pipefail
umask 0027
release_id=${1:?Pass the release ID}
[[ $release_id =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || exit 2
base=${DEPLOY_ROOT:-/srv/v3-zapisy}
release="$base/releases/$release_id"
archive="$base/incoming/$release_id.tar.gz"
environment="$base/incoming/$release_id.env"
exec 9>"$base/deploy.lock"
flock -w 300 9
test -f "$environment"
test -f "$archive"
test ! -e "$release"
previous=$(readlink -e "$base/current" || true)
if [[ -n $previous && ! -f $previous/.env ]]; then
    install -m 0640 "$base/shared/.env" "$previous/.env"
fi
activated=false

recover() {
    status=$?
    trap - ERR
    if $activated; then
        if [[ -n $previous && -d $previous ]]; then
            ln -sfn "$previous" "$base/current.next"
            mv -Tf "$base/current.next" "$base/current"
            sudo /usr/bin/systemctl restart v3-zapisy.service
        else
            sudo /usr/bin/systemctl stop v3-zapisy.service
            rm -f "$base/current"
        fi
        echo 'Release failed; restored previous application state.' >&2
    fi
    exit "$status"
}
trap recover ERR

mkdir "$release"
tar --no-same-owner -xzf "$archive" -C "$release"
test -f "$release/server.js"
install -m 0640 "$environment" "$release/.env"
rm -f "$environment"
mkdir -p "$release/.next/cache"
chmod -R u=rwX,g=rX,o= "$release"
chown -R :v3-zapisy "$release"
chmod g+w "$release/.next/cache"
ln -sfn ../current/.env "$base/shared/.env.next"
mv -Tf "$base/shared/.env.next" "$base/shared/.env"
ln -sfn "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
activated=true
sudo /usr/bin/systemctl restart v3-zapisy.service
curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-all-errors --max-time 10 \
    http://127.0.0.1:3001/api/health > /dev/null
rm -f "$archive"
echo "Deployed $release_id"
