#!/bin/sh
set -e

REPO="VorDeau/deauboard"
INSTALL_DIR="/usr/local/bin"
BIN_NAME="deauboard-agent"

# Warna
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "${GREEN}Deauboard Agent Installer${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Deteksi arsitektur
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)          SUFFIX="linux-x86_64" ;;
  aarch64 | arm64) SUFFIX="linux-arm64" ;;
  *)
    echo "${RED}✗ Arsitektur tidak didukung: $ARCH${NC}"
    exit 1
    ;;
esac

# Cek ketersediaan curl
if ! command -v curl > /dev/null 2>&1; then
  echo "${RED}✗ curl diperlukan. Install dulu: apt install curl${NC}"
  exit 1
fi

echo "  Arsitektur : $ARCH ($SUFFIX)"

# Ambil versi terbaru dari GitHub
echo "  Mengambil versi terbaru..."
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"tag_name"' \
  | sed 's/.*"tag_name": *"\(.*\)".*/\1/')

if [ -z "$LATEST" ]; then
  echo "${RED}✗ Gagal ambil versi terbaru. Pastikan ada release di GitHub.${NC}"
  exit 1
fi

echo "  Versi      : $LATEST"

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST/$BIN_NAME-$SUFFIX"

echo "  Mengunduh..."
curl -fsSL "$DOWNLOAD_URL" -o /tmp/deauboard-agent
chmod +x /tmp/deauboard-agent

# Install (dengan atau tanpa sudo)
if [ -w "$INSTALL_DIR" ]; then
  mv /tmp/deauboard-agent "$INSTALL_DIR/$BIN_NAME"
elif command -v sudo > /dev/null 2>&1; then
  sudo mv /tmp/deauboard-agent "$INSTALL_DIR/$BIN_NAME"
else
  echo "${YELLOW}! Tidak bisa install ke $INSTALL_DIR. Pindahkan manual:${NC}"
  echo "  mv /tmp/deauboard-agent /usr/local/bin/deauboard-agent"
  exit 0
fi

echo ""
echo "${GREEN}✓ Deauboard Agent $LATEST terinstall!${NC}"
echo ""
echo "Langkah selanjutnya:"
echo "  ${YELLOW}deauboard-agent setup${NC}           — setup awal"
echo "  ${YELLOW}deauboard-agent install-service${NC}  — install sebagai systemd service"
echo ""
