#!/bin/bash

# Simple Note Installation Script
# Usage:
# curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- install
# curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- update
# curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- remove

REPO_URL="https://github.com/thaonv7995/simple-note.git"
INSTALL_DIR="$HOME/.simple-note"
APP_NAME="simple-note"

function check_node() {
    if ! command -v node &> /dev/null; then
        echo "Node.js is not installed. Please install Node.js (v20+) first."
        exit 1
    fi
    if ! command -v npm &> /dev/null; then
        echo "npm is not installed. Please install npm."
        exit 1
    fi
}

function install_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo "Installing PM2 globally (might require sudo)..."
        npm install -g pm2
    fi
}

function do_install() {
    echo "Installing Simple Note..."
    check_node
    install_pm2

    if [ -d "$INSTALL_DIR" ]; then
        echo "Directory $INSTALL_DIR already exists. Please run update or remove first."
        exit 1
    fi

    echo "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"

    cd "$INSTALL_DIR" || exit
    echo "Installing dependencies..."
    npm install

    echo "Building application..."
    npm run build

    echo "Starting app with PM2 on port 22099..."
    PORT=22099 pm2 start server.js --name "$APP_NAME"

    echo "Saving PM2 process list..."
    pm2 save

    echo "--------------------------------------------------"
    echo "✨ Simple Note installed successfully!"
    echo "Access it at: http://localhost:22099"
    echo "Data is stored in: $INSTALL_DIR/data"
    echo "--------------------------------------------------"
}

function do_update() {
    echo "Updating Simple Note..."
    if [ ! -d "$INSTALL_DIR" ]; then
        echo "Simple Note is not installed in $INSTALL_DIR."
        exit 1
    fi

    cd "$INSTALL_DIR" || exit
    echo "Pulling latest changes..."
    git pull

    echo "Installing dependencies..."
    npm install

    echo "Building application..."
    npm run build

    echo "Restarting app..."
    pm2 restart "$APP_NAME"

    echo "✨ Simple Note updated successfully!"
}

function do_remove() {
    echo "Removing Simple Note..."
    if command -v pm2 &> /dev/null; then
        pm2 stop "$APP_NAME" 2>/dev/null
        pm2 delete "$APP_NAME" 2>/dev/null
        pm2 save --force
    fi

    if [ -d "$INSTALL_DIR" ]; then
        BACKUP_DIR="$HOME/simple-note-backup-$(date +%s)"
        if [ -d "$INSTALL_DIR/data" ]; then
            echo "Backing up your notes data..."
            mv "$INSTALL_DIR/data" "$BACKUP_DIR"
            echo "✅ Data safely backed up to: $BACKUP_DIR"
        fi
        rm -rf "$INSTALL_DIR"
    fi

    echo "🗑️ Simple Note removed successfully."
}

ACTION=$1

case "$ACTION" in
    install)
        do_install
        ;;
    update)
        do_update
        ;;
    remove)
        do_remove
        ;;
    *)
        echo "Usage: $0 {install|update|remove}"
        echo "Example: curl -sL <url>/setup.sh | bash -s -- install"
        exit 1
        ;;
esac
