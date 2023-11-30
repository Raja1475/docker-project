#!/bin/bash

# List of repository names
repositories=("cart" "catalogue" "mongodb" "mysql" "payment" "shipping" "user" "web")

# Build Docker images for each repository
for repo in "${repositories[@]}"; do
    echo "Building Docker image for $repo"
    cd "$repo" || exit 1
    docker build -t "$repo" .
    cd ..
done

echo "All Docker images built successfully"
