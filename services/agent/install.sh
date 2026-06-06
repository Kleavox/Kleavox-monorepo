#!/bin/sh
set -eu

BASE_URL="${AGENT_DOWNLOAD_BASE:?Set AGENT_DOWNLOAD_BASE to the release download URL}"
INSTALL_DIR="${AGENT_INSTALL_DIR:-/usr/local/bin}"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) artifact="kleavox-agent-linux-amd64" ;;
  Linux-aarch64|Linux-arm64) artifact="kleavox-agent-linux-arm64" ;;
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

curl -fsSL "$BASE_URL/$artifact" -o "$tmp_dir/kleavox-agent"
curl -fsSL "$BASE_URL/$artifact.sha256" -o "$tmp_dir/kleavox-agent.sha256"
(
  cd "$tmp_dir"
  sha256sum -c kleavox-agent.sha256
)
chmod 0755 "$tmp_dir/kleavox-agent"

if [ -w "$INSTALL_DIR" ]; then
  install -m 0755 "$tmp_dir/kleavox-agent" "$INSTALL_DIR/kleavox-agent"
elif command -v sudo >/dev/null 2>&1; then
  sudo install -m 0755 "$tmp_dir/kleavox-agent" "$INSTALL_DIR/kleavox-agent"
else
  echo "Root access is required to install into $INSTALL_DIR" >&2
  exit 1
fi

echo "Installed $INSTALL_DIR/kleavox-agent"
echo "Use the enrollment command shown in Kleavox Pulse."
