#!/bin/bash

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./build.sh v0.1.0"
  exit 1
fi

mkdir -p dist

echo "Building Core..."
GOOS=linux GOARCH=amd64 go build -o dist/kronyx-core-$VERSION cmd/core/main.go

echo "Building Agent..."
GOOS=linux GOARCH=amd64 go build -o dist/kronyx-agent-$VERSION cmd/agent/main.go

echo "Done."
