import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const LOG_PATH = '/var/lib/gpu-monitor/gpu_stats.txt';
const ICON_PATH = `${GLib.get_home_dir()}/.local/share/gnome-shell/extensions/intel-gpu-monitor@perry_lin/icons/gpu-symbolic.svg`;
const REFRESH_INTERVAL = 1; // 刷新间隔(秒)

const GPUMonitorIndicator = GObject.registerClass(
class GPUMonitorIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, "GPU Monitor");
        
        this.box = new St.BoxLayout({ 
            vertical: false,
            style_class: 'panel-status-menu-box'
        });
        this.add_child(this.box);

        const file = Gio.File.new_for_path(ICON_PATH);
        if (file.query_exists(null)) {
            const fileIcon = new Gio.FileIcon({ file });
            this.gpuIcon = new St.Icon({
                gicon: fileIcon,
                style_class: 'system-status-icon',
                icon_size: 32
            });
        }
        else {
            this.gpuIcon = new St.Icon({
                icon_name: 'video-display-symbolic',
                style_class: 'system-status-icon'
            });
        }
        
        this.box.add_child(this.gpuIcon);
        
        this.label = new St.Label({ 
            text: "0%",
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'gpu-monitor-label'
        });
        this.box.add_child(this.label);
        
        // 下拉菜单
        this.menuItems = {};
        ['RCS', 'BCS', 'VCS', 'VECS', 'CCS'].forEach(name => {
            const item = new St.Label({ 
                text: `${name}: 0%`, 
                x_align: Clutter.ActorAlign.START,
                style_class: 'gpu-monitor-menu-label'   // 添加样式类
            });
            const menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
            menuItem.add_child(item);
            this.menu.addMenuItem(menuItem);
            this.menuItems[name] = item;
        });

        
        this._timeoutId = null;
        this._setRefreshTimer();
    }
    
    _setRefreshTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_INTERVAL,
            () => {
                this._readGpuData();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }
    
    _readGpuData() {
        try {
            // 检查文件是否存在
            if (!GLib.file_test(LOG_PATH, GLib.FileTest.EXISTS)) {
                this.label.text = "NOFILE";
                return;
            }
            
            const [success, bytes] = GLib.file_get_contents(LOG_PATH);
            
            if (success && bytes.length > 0) {
                const decoder = new TextDecoder();
                const text = decoder.decode(bytes);
                
                // 获取最后一行非空行
                const lines = text.split('\n').filter(line => line.trim() !== '');
                if (lines.length > 0) {
                    const lastLine = lines[lines.length - 1].trim();

                    // 表格格式匹配: Freq act IRQ RC6 gpu pkg RCS BCS VCS VECS CCS
                    const parts = lastLine.split(/\s+/);
                    if (parts.length < 19) {
                        this.label.text = 'NODATA';
                        return;
                    }

                    // 渲染引擎占用率
                    const rcs = parseFloat(parts[6]);
                    const bcs = parseFloat(parts[9]);
                    const vcs = parseFloat(parts[12]);
                    const vecs = parseFloat(parts[15]);
                    const ccs = parseFloat(parts[18] || 0);

                    const maxUsage = Math.max(rcs, bcs, vcs, vecs, ccs);
                    this.label.text = `${maxUsage}%`;
                    this._updateStyle(maxUsage);

                    // 更新下拉菜单
                    this.menuItems.RCS.set_text(`Render/3D: ${rcs}%`);
                    this.menuItems.BCS.set_text(`Blitter: ${bcs}%`);
                    this.menuItems.VCS.set_text(`Video: ${vcs}%`);
                    this.menuItems.VECS.set_text(`VideoEnhance: ${vecs}%`);
                    this.menuItems.CCS.set_text(`Compute: ${ccs}%`);

                    return;
                }
            }
            
            this.label.text = "NODATA";
        } catch (e) {
            console.error(`GPU数据错误: ${e}`);
            this.label.text = "ERR";
        }
    }
    
    _parseGpuUsage(line) {
        // 移除行首行尾空白
        const trimmedLine = line.trim();
        
        // 调试输出
        console.log(`解析行: "${trimmedLine}"`);
        
        // 尝试匹配表格格式的数据行
        const tableRowRegex = /^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/;
        const match = trimmedLine.match(tableRowRegex);
        
        if (match) {
            // 列索引说明：
            // 1: Freq req (MHz)
            // 2: Freq act (MHz)
            // 3: IRQ/s
            // 4: RC6%
            // 5: GPU Power (W)
            // 6: Package Power (W)
            // 7: RCS (渲染引擎)占用率
            
            // 提取渲染引擎占用率
            const rcsUsage = parseFloat(match[7]);
            if (!isNaN(rcsUsage)) {
                console.log(`表格格式解析成功: ${rcsUsage}%`);
                return rcsUsage;
            }
        }
        
        // 备选方案1：尝试匹配特定模式
        const fallbackMatch1 = line.match(/(\d+\.\d+)\s+render/);
        if (fallbackMatch1 && fallbackMatch1[1]) {
            const usage = parseFloat(fallbackMatch1[1]);
            if (!isNaN(usage)) {
                console.log(`备选模式1解析成功: ${usage}%`);
                return Math.round(usage);
            }
        }
        
        // 备选方案2：尝试匹配通用占用率模式
        const fallbackMatch2 = line.match(/(\d+\.\d+)%/);
        if (fallbackMatch2 && fallbackMatch2[1]) {
            const usage = parseFloat(fallbackMatch2[1]);
            if (!isNaN(usage)) {
                console.log(`备选模式2解析成功: ${usage}%`);
                return Math.round(usage);
            }
        }
        
        console.log("无法解析GPU使用率");
        return null;
    }
    
    _updateStyle(usage) {
        this.label.remove_style_class_name('gpu-monitor-label-high');
        this.label.remove_style_class_name('gpu-monitor-label-medium');
        this.label.remove_style_class_name('gpu-monitor-label-max');
        this.label.remove_style_class_name('gpu-monitor-label-error');
        
        if (usage > 95) {
            this.label.add_style_class_name('gpu-monitor-label-max');
        }
        else if (usage > 80) {
            this.label.add_style_class_name('gpu-monitor-label-high');
        } else if (usage > 60) {
            this.label.add_style_class_name('gpu-monitor-label-medium');
        }
    }

    _updateMenuStyle(label, usage) {
        label.remove_style_class_name('gpu-menu-high');
        label.remove_style_class_name('gpu-menu-medium');
        label.remove_style_class_name('gpu-menu-max');

        if (usage > 95) {
            label.add_style_class_name('gpu-menu-max'); // 红色加粗
        } else if (usage > 80) {
            label.add_style_class_name('gpu-menu-high'); // 橙色
        } else if (usage > 60) {
            label.add_style_class_name('gpu-menu-medium'); // 黄色
        }
    }
    
    stop() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
    }
});

let indicator = null;

export default class GPUMonitorExtension {
    enable() {
        indicator = new GPUMonitorIndicator();
        Main.panel.addToStatusArea('gpu-monitor-indicator', indicator, -1, 'left');
    }
    
    disable() {
        if (indicator) {
            indicator.stop();
            indicator.destroy();
            indicator = null;
        }
    }
}