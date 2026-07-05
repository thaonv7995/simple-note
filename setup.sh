#!/bin/bash

# Simple Note Installation Script (Native Binary Version)
# Usage:
# curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- install
# curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- update
# curl -sL https://raw.githubusercontent.com/thaonv7995/simple-note/main/setup.sh | bash -s -- remove

INSTALL_DIR="$HOME/.simple-note"
APP_NAME="simple-note"
SERVICE_NAME="simple-note.service"

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" = "Linux" ]; then
    BIN_NAME="server-linux-x64"
elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        BIN_NAME="server-macos-arm64"
    else
        BIN_NAME="server-macos-x64"
    fi
else
    echo "Unsupported OS: $OS"
    exit 1
fi

DOWNLOAD_URL="https://github.com/thaonv7995/simple-note/releases/latest/download/$BIN_NAME"

function do_install() {
    echo "Installing Simple Note (Native Binary)..."

    if [ -d "$INSTALL_DIR" ]; then
        echo "Directory $INSTALL_DIR already exists. Upgrading the binary..."
    fi

    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/data"

    echo "Downloading binary from GitHub Releases..."
    curl -# -L "$DOWNLOAD_URL" -o "$INSTALL_DIR/${APP_NAME}.tmp"
    mv -f "$INSTALL_DIR/${APP_NAME}.tmp" "$INSTALL_DIR/$APP_NAME"
    chmod +x "$INSTALL_DIR/$APP_NAME"

    # Setup systemd if on Linux
    if [ "$OS" = "Linux" ]; then
        if command -v systemctl &> /dev/null; then
            echo "Configuring systemd service (might require sudo password)..."
            sudo bash -c "cat <<EOF > /etc/systemd/system/$SERVICE_NAME
[Unit]
Description=Simple Note Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=$INSTALL_DIR/$APP_NAME
WorkingDirectory=$INSTALL_DIR
Restart=on-failure
Environment=PORT=22099

[Install]
WantedBy=multi-user.target
EOF"
            sudo systemctl daemon-reload
            sudo systemctl enable $SERVICE_NAME
            sudo systemctl restart $SERVICE_NAME
            echo "Systemd service installed and started!"
        else
            echo "Systemd not found. Starting binary in background using nohup..."
            cd "$INSTALL_DIR"
            pkill -f "./$APP_NAME" || true
            PORT=22099 nohup ./$APP_NAME > app.log 2>&1 &
        fi
    else
        echo "Starting binary in background using nohup..."
        cd "$INSTALL_DIR"
        # kill existing if running
        pkill -f "./$APP_NAME" || true
        PORT=22099 nohup ./$APP_NAME > app.log 2>&1 &
    fi

    echo "--------------------------------------------------"
    echo "✨ Simple Note installed successfully!"
    echo "Access it at: http://localhost:22099"
    echo "Data is stored in: $INSTALL_DIR/data"
    echo "--------------------------------------------------"
}

function do_update() {
    echo "Updating Simple Note..."
    do_install
}

function do_remove() {
    echo "Removing Simple Note..."

    if [ "$OS" = "Linux" ] && command -v systemctl &> /dev/null; then
        echo "Stopping systemd service..."
        sudo systemctl stop $SERVICE_NAME 2>/dev/null
        sudo systemctl disable $SERVICE_NAME 2>/dev/null
        sudo rm -f /etc/systemd/system/$SERVICE_NAME
        sudo systemctl daemon-reload
    else
        pkill -f "./$APP_NAME" || true
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
