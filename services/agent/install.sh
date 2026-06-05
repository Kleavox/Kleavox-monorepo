#!/bin/sh
set -eu

BASE_URL="${ZARKIV_AGENT_DOWNLOAD_BASE:-https://github.com/zarkiv/zarkiv/releases/latest/download}"
INSTALL_DIR="${ZARKIV_AGENT_INSTALL_DIR:-/usr/local/bin}"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) artifact="zarkiv-agent-linux-amd64" ;;
  Linux-aarch64|Linux-arm64) artifact="zarkiv-agent-linux-arm64" ;;
  *)
    echo "Unsupported platform: $(uname -s) $(uname -m)" >&2
    exit 1
    ;;
esac

command -v curl >/dev/null 2>&1 || {
  echo "curl is required" >&2
  exit 1
}
command -v sha256sum >/dev/null 2>&1 || {
  echo "sha256sum is required" >&2
  exit 1
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

curl -fsSL "$BASE_URL/$artifact" -o "$tmp_dir/zarkiv-agent"
curl -fsSL "$BASE_URL/$artifact.sha256" -o "$tmp_dir/zarkiv-agent.sha256"
(
  cd "$tmp_dir"
  sha256sum -c zarkiv-agent.sha256
)
chmod 0755 "$tmp_dir/zarkiv-agent"

if [ -w "$INSTALL_DIR" ]; then
  install -m 0755 "$tmp_dir/zarkiv-agent" "$INSTALL_DIR/zarkiv-agent"
elif command -v sudo >/dev/null 2>&1; then
  sudo install -m 0755 "$tmp_dir/zarkiv-agent" "$INSTALL_DIR/zarkiv-agent"
else
  echo "Root access is required to install into $INSTALL_DIR" >&2
  exit 1
fi

echo "Installed $INSTALL_DIR/zarkiv-agent"
echo "Use the enrollment command shown in Zarkiv Pulse."
