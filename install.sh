#!/usr/bin/env bash

set -e

EXTENSION_UUID="intel-gpu-monitor@perry_lin"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
ICON_PATH="$EXTENSION_DIR/icons/gpu-symbolic.svg"
LOG_PATH="/var/lib/gpu-monitor/gpu_stats.txt"
SERVICE_PATH="/etc/systemd/system/gpu-data-collector.service"
TIMER_PATH="/etc/systemd/system/gpu-data-collector.timer"

# ----------------------------
# 1. 检查系统并安装依赖
# ----------------------------
echo "[INFO] 检查并安装依赖..."

if command -v apt &>/dev/null; then
    sudo apt update
    sudo apt install -y intel-gpu-tools gnome-shell-extensions
elif command -v dnf &>/dev/null; then
    sudo dnf install -y intel-gpu-tools gnome-shell-extension-appindicator
elif command -v pacman &>/dev/null; then
    sudo pacman -Sy --noconfirm intel-gpu-tools gnome-shell-extensions
else
    echo "[ERROR] 不支持的 Linux 发行版，请手动安装 intel-gpu-tools"
    exit 1
fi

# ----------------------------
# 2. 安装扩展
# ----------------------------
echo "[INFO] 安装 GNOME Shell 扩展..."

mkdir -p "$HOME/.local/share/gnome-shell/extensions"
cp -r "$(pwd)" "$EXTENSION_DIR"

# 自动更新 ICON_PATH
sed -i "s#const ICON_PATH = .*#const ICON_PATH = '$ICON_PATH';#" "$EXTENSION_DIR/extension.js"

echo "[INFO] 扩展已复制到: $EXTENSION_DIR"

# ----------------------------
# 3. 配置 systemd service
# ----------------------------
echo "[INFO] 配置 systemd 服务..."

sudo mkdir -p /var/lib/gpu-monitor
sudo touch "$LOG_PATH"
sudo chmod 644 "$LOG_PATH"

# 写入 gpu-data-collector.service
sudo tee "$SERVICE_PATH" > /dev/null <<EOL
[Unit]
Description=Intel GPU Data Collector
After=network.target

[Service]
User=root
ExecStartPre=/bin/rm -f $LOG_PATH
ExecStartPre=/bin/touch $LOG_PATH
ExecStartPre=/bin/chmod 644 $LOG_PATH
ExecStart=/usr/bin/bash -c "sudo /usr/bin/intel_gpu_top -o - > $LOG_PATH"
RuntimeMaxSec=1800
Restart=always
RestartSec=5
StandardOutput=null
StandardError=journal

[Install]
WantedBy=multi-user.target
EOL

# 写入 gpu-data-collector.timer
sudo tee "$TIMER_PATH" > /dev/null <<EOL
[Unit]
Description=Restart GPU Data Collector every 30 minutes

[Timer]
OnUnitActiveSec=30m
Unit=gpu-data-collector.service

[Install]
WantedBy=timers.target
EOL

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable gpu-data-collector.service
sudo systemctl enable gpu-data-collector.timer
sudo systemctl start gpu-data-collector.service
sudo systemctl start gpu-data-collector.timer

echo "[INFO] systemd 服务配置完成"

# ----------------------------
# 4. 启用 GNOME 扩展
# ----------------------------
echo "[INFO] 启用 GNOME 扩展..."

gnome-extensions enable "$EXTENSION_UUID" || true

echo "[INFO] 安装完成！请重启 GNOME Shell (Alt+F2 → 输入 r → 回车)"
echo "[INFO] 如果 GPU 占用率显示异常，可检查日志:"
echo "       sudo journalctl -u gpu-data-collector.service -f"
