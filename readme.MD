# Intel GPU Monitor for GNOME Shell

> 一个用于 **GNOME Shell** 的扩展，可以在顶栏实时显示 Intel GPU 的使用率。
<br>

~~perry_lin: 纯粹因为玩mc看不了intel核显占用所以写了（~~

## ✨ 功能
- 在 GNOME 顶栏实时显示 Intel GPU 占用率（百分比）
- 自动高亮高占用状态
- GPU 占用率颜色区分：
  - <60%：默认颜色
  - 60% ~ 85%：黄色
  - >85%：红色闪烁
- 无需手动刷新，自动每 2 秒更新一次
- **自动适配所有电脑，无需修改 ICON_PATH** ✅

---

## 📦 安装依赖

在使用此扩展前，需要安装 **intel-gpu-tools** 来获取 `intel_gpu_top` 命令，并确保 GNOME Shell JavaScript 环境可用。

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install intel-gpu-tools gnome-shell-extensions

# Fedora / RHEL
sudo dnf install intel-gpu-tools gnome-shell-extension-appindicator

# Arch / Manjaro
sudo pacman -S intel-gpu-tools gnome-shell-extensions
```

---

## ⚙️ 快速安装

我们提供了 **install.sh**，一键完成：
- 安装扩展
- 配置 systemd 服务与定时器
- 自动启用扩展

### 1. 克隆项目
```bash
mkdir -p ~/.local/share/gnome-shell/extensions
cd ~/.local/share/gnome-shell/extensions
git clone https://github.com/your-repo/intel-gpu-monitor.git intel-gpu-monitor@perry_lin
cd intel-gpu-monitor@perry_lin
```

### 2. 运行安装脚本
```bash
chmod +x install.sh
./install.sh
```

### 3. 重启 GNOME Shell
```bash
Alt + F2 → 输入 r → 回车
```

---

## 🛠 卸载扩展

使用 **uninstall.sh** 一键卸载：
```bash
cd ~/.local/share/gnome-shell/extensions/intel-gpu-monitor@perry_lin
chmod +x uninstall.sh
./uninstall.sh
```

它会自动：
- 停止并删除 systemd 服务和定时器
- 删除 GPU 日志文件
- 卸载 GNOME 扩展
- 禁用扩展

---

## 🧩 适配到其他电脑

现在扩展是 **完全自适应** 的：
- 图标路径自动根据扩展目录动态计算，无需修改 `ICON_PATH`
- GPU 数据文件路径固定为 `/var/lib/gpu-monitor/gpu_stats.txt`，保持一致即可
- `metadata.json` 的 GNOME Shell 版本默认是：
```json
"shell-version": ["46"]
```
如果目标电脑 GNOME 版本不同，比如 **45** 或 **47**，请根据实际修改。

---

## 🔄 更新扩展

```bash
cd ~/.local/share/gnome-shell/extensions/intel-gpu-monitor@perry_lin
git pull
./install.sh
```

然后重启 GNOME Shell：
```bash
Alt + F2 → 输入 r → 回车
```

---

## 🧩 故障排查

### 1. 扩展显示 "NOFILE"
> `/var/lib/gpu-monitor/gpu_stats.txt` 不存在。
```bash
sudo systemctl restart gpu-data-collector.service
```

### 2. 扩展显示 "NODATA"
> 文件存在但没有数据，可能 `intel_gpu_top` 没有输出。
```bash
sudo intel_gpu_top
```
如果该命令无法运行，请检查是否正确安装 `intel-gpu-tools`。

### 3. 扩展显示 "ERR"
> 无法读取数据，可能是权限不足。
```bash
sudo chmod 644 /var/lib/gpu-monitor/gpu_stats.txt
```

### 4. 检查 systemd 服务日志
```bash
sudo journalctl -u gpu-data-collector.service -f
```

---

## ✅ 已测试环境
- GNOME Shell 46 ✅
- Ubuntu 24.04 ✅

如果 GNOME Shell 版本较低，可能需要修改 `metadata.json`。

---

## 🧠 TODO
- [ ] 增加设置界面
- [ ] 自动检测 GNOME Shell 版本
- [ ] 多 GPU 支持

---

