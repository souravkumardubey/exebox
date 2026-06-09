#!/usr/bin/env bash
set -euo pipefail

# Build all sandbox runner images
# Usage: ./build.sh [image_name]
#   image_name: optional, builds only that image (e.g., "python", "node")

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

IMAGES=(
  "python:exebox-python:latest"
  "node:exebox-node:latest"
  "go:exebox-go:latest"
  "java:exebox-java:latest"
  "cpp:exebox-cpp:latest"
  "rust:exebox-rust:latest"
)

if [ $# -gt 0 ]; then
  TARGET="$1"
  IMAGES=()
  for img in "python:exebox-python:latest" "node:exebox-node:latest" "go:exebox-go:latest" "java:exebox-java:latest" "cpp:exebox-cpp:latest" "rust:exebox-rust:latest"; do
    if [[ "$img" == "$TARGET:"* ]]; then
      IMAGES+=("$img")
    fi
  done
  if [ ${#IMAGES[@]} -eq 0 ]; then
    echo "Unknown image: $TARGET"
    echo "Available: python node go java cpp rust"
    exit 1
  fi
fi

for entry in "${IMAGES[@]}"; do
  IFS=":" read -r name tag <<< "$entry"
  echo "==> Building $tag..."
  docker build -t "$tag" -f "$ROOT_DIR/docker/$name.Dockerfile" "$ROOT_DIR/docker"
  echo "==> Done: $tag"
done

echo "All images built successfully."
