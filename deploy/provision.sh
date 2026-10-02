#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root'; exit 1; }
public_key_file=${1:?Pass the deployment public key file}
config_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
base=/srv/v3-zapisy
command -v node >/dev/null || { echo 'Install nodejs (Node 22 or newer) first'; exit 1; }

id v3-zapisy >/dev/null 2>&1 || useradd --system --user-group --home-dir "$base" --shell /usr/sbin/nologin v3-zapisy
id v3-zapisy-deploy >/dev/null 2>&1 || useradd --create-home --gid v3-zapisy --shell /bin/bash v3-zapisy-deploy
install -d -o v3-zapisy-deploy -g v3-zapisy -m 0750 "$base" "$base/releases" "$base/shared"
install -d -o v3-zapisy-deploy -g v3-zapisy -m 0700 "$base/incoming" /home/v3-zapisy-deploy/.ssh
key=$(cat "$public_key_file")
if ! grep -qF "$key" /home/v3-zapisy-deploy/.ssh/authorized_keys 2>/dev/null; then
    printf 'restrict %s\n' "$key" >> /home/v3-zapisy-deploy/.ssh/authorized_keys
fi
chown v3-zapisy-deploy:v3-zapisy /home/v3-zapisy-deploy/.ssh/authorized_keys
chmod 0600 /home/v3-zapisy-deploy/.ssh/authorized_keys
install -m 0644 "$config_dir/v3-zapisy.service" /etc/systemd/system/
install -m 0644 "$config_dir/v3-zapisy-cron.service" "$config_dir/v3-zapisy-cron.timer" /etc/systemd/system/
if id postgres >/dev/null 2>&1; then
    install -d -m 0700 -o postgres -g postgres /var/backups/elder-hub/daily
    install -m 0755 "$config_dir/backup.sh" /usr/local/sbin/v3-zapisy-backup
    install -m 0644 "$config_dir/v3-zapisy-backup.service" "$config_dir/v3-zapisy-backup.timer" /etc/systemd/system/
fi
printf 'v3-zapisy-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart v3-zapisy.service, /usr/bin/systemctl stop v3-zapisy.service\n' > /etc/sudoers.d/v3-zapisy-deploy
chmod 0440 /etc/sudoers.d/v3-zapisy-deploy
visudo -cf /etc/sudoers.d/v3-zapisy-deploy
systemctl daemon-reload
systemctl enable v3-zapisy.service
echo 'Host provisioned. Install shared/.env and deploy a release before starting.'
