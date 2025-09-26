#!/usr/bin/env bash
set -e

EXTENSION_ID="intel-gpu-monitor@perry_lin"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_ID"

echo "=== Intel GPU Monitor Installer ==="

# 检查依赖
echo "[1/5] 检查依赖..."
for cmd in gnome-shell gnome-extensions rsync systemctl; do
    if ! command -v $cmd &>/dev/null; then
        echo "缺少依赖: $cmd"
        echo "请先安装相关依赖后再运行 install.sh"
        exit 1
    fi
done
echo "依赖检查完成 ✅"

# 检查是否已经在目标目录
echo "[2/5] 安装 GNOME 扩展..."
if [[ "$(realpath .)" == "$(realpath "$EXTENSION_DIR")" ]]; then
    echo "⚠️ 检测到当前目录就是扩展安装目录，跳过复制"
else
    mkdir -p "$EXTENSION_DIR"
    rsync -av --delete ./ "$EXTENSION_DIR" \
        --exclude "install.sh" \
        --exclude "uninstall.sh" \
        --exclude ".git" \
        --exclude ".gitignore"
    echo "扩展文件已复制到: $EXTENSION_DIR ✅"
fi

# 安装 systemd 服务
echo "[3/5] 安装 systemd 服务..."
sudo mkdir -p /var/lib/gpu-monitor
sudo cp gpu-data-collector.service /etc/systemd/system/
sudo cp gpu-data-collector.timer /etc/systemd/system/
sudo cp power-data-collector.service /etc/systemd/system/
sudo cp power-data-collector.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gpu-data-collector.timer --now
sudo systemctl enable gpu-data-collector.service --now
sudo systemctl enable power-data-collector.timer --now
sudo systemctl enable power-data-collector.service --now
echo "systemd 服务已安装并启动 ✅"

# 启用扩展
echo "[4/5] 启用 GNOME 扩展..."
gnome-extensions enable "$EXTENSION_ID" || true
echo "扩展已启用 ✅"

# 重启 GNOME Shell
echo "[5/5] 重启 GNOME Shell..."
if [[ "$XDG_SESSION_TYPE" == "wayland" ]]; then
    echo "请手动注销或按 Alt+F2 后输入 'r' 重启 GNOME Shell"
else
    gnome-shell --replace &
fi

echo "=== 安装完成！ ==="
