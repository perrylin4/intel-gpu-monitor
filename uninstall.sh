#!/usr/bin/env bash

set -e

EXTENSION_UUID="intel-gpu-monitor@perry_lin"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SERVICE_PATH="/etc/systemd/system/gpu-data-collector.service"
TIMER_PATH="/etc/systemd/system/gpu-data-collector.timer"
POWER_SERVICE_PATH="/etc/systemd/system/power-data-collector.service"
POWER_TIMER_PATH="/etc/systemd/system/power-data-collector.timer"
LOG_PATH="/var/lib/gpu-monitor/gpu_stats.txt"
POWER_LOG_PATH="/var/lib/gpu-monitor/power_stats.txt"

# ----------------------------
# 1. 停止并禁用 systemd 服务
# ----------------------------
echo "[INFO] 停止并禁用 systemd 服务..."

if systemctl list-unit-files | grep -q "gpu-data-collector.service"; then
    sudo systemctl stop gpu-data-collector.service || true
    sudo systemctl disable gpu-data-collector.service || true
    sudo rm -f "$SERVICE_PATH"
fi

if systemctl list-unit-files | grep -q "gpu-data-collector.timer"; then
    sudo systemctl stop gpu-data-collector.timer || true
    sudo systemctl disable gpu-data-collector.timer || true
    sudo rm -f "$TIMER_PATH"
fi

if systemctl list-unit-files | grep -q "power-data-collector.service"; then
    sudo systemctl stop power-data-collector.service || true
    sudo systemctl disable power-data-collector.service || true
    sudo rm -f "$POWER_SERVICE_PATH"
fi

if systemctl list-unit-files | grep -q "power-data-collector.timer"; then
    sudo systemctl stop power-data-collector.timer || true
    sudo systemctl disable power-data-collector.timer || true
    sudo rm -f "$POWER_TIMER_PATH"
fi

sudo systemctl daemon-reload

# ----------------------------
# 2. 删除 GPU 日志文件
# ----------------------------
echo "[INFO] 删除 GPU 数据日志..."
sudo rm -f "$LOG_PATH"
sudo rmdir --ignore-fail-on-non-empty /var/lib/gpu-monitor || true
sudo rm -f "$POWER_LOG_PATH"
sudo rmdir --ignore-fail-on-non-empty /var/lib/gpu-monitor || true

# ----------------------------
# 3. 删除 GNOME 扩展
# ----------------------------
echo "[INFO] 卸载 GNOME 扩展..."

gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null || true
rm -rf "$EXTENSION_DIR"

# ----------------------------
# 4. 更新 GNOME 扩展状态
# ----------------------------
echo "[INFO] 更新 GNOME 扩展状态..."
gnome-extensions list | grep "$EXTENSION_UUID" || echo "[INFO] 扩展已删除"

echo "[INFO] 卸载完成！"
echo "[INFO] 建议重启 GNOME Shell (Alt+F2 → 输入 r → 回车)"
