import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const LOG_PATH = '/var/lib/gpu-monitor/gpu_stats.txt';
const REFRESH_INTERVAL = 2; // 刷新间隔(秒)

const GPUMonitorIndicator = GObject.registerClass(
class GPUMonitorIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, "GPU Monitor");
        
        // 创建主容器
        this.box = new St.BoxLayout({ 
            vertical: false,
            style_class: 'panel-status-menu-box',
            x_expand: false,
            x_align: Clutter.ActorAlign.END // 右对齐
        });
        this.add_child(this.box);
        
        // 使用内置图标避免加载问题
        this.gpuIcon = new St.Icon({
            icon_name: 'video-display-symbolic',
            style_class: 'system-status-icon',
            icon_size: 16
        });
        this.box.add_child(this.gpuIcon);
        
        // 百分比标签 - 仅显示数值
        this.label = new St.Label({ 
            text: "0.0",
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'gpu-monitor-label'
        });
        this.box.add_child(this.label);
        
        // 百分比符号标签
        this.percentSymbol = new St.Label({ 
            text: "%",
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'gpu-monitor-symbol'
        });
        this.box.add_child(this.percentSymbol);
        
        this._timeoutId = null;
        
        // 延迟启动数据读取
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._setRefreshTimer();
            return GLib.SOURCE_REMOVE;
        });
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
                this.label.text = "0.0";
                return;
            }
            
            const [success, bytes] = GLib.file_get_contents(LOG_PATH);
            
            if (success && bytes.length > 0) {
                const decoder = new TextDecoder();
                const text = decoder.decode(bytes);
                
                // 获取最后一行非空行
                const lines = text.split('\n').filter(line => line.trim() !== '');
                if (lines.length > 0) {
                    const lastLine = lines[lines.length - 1];
                    
                    // 解析GPU使用率
                    const usage = this._parseGpuUsage(lastLine);
                    
                    if (usage !== null) {
                        // 保留1位小数
                        this.label.text = usage.toFixed(1);
                        this._updateStyle(usage);
                        return;
                    }
                }
            }
            
            this.label.text = "0.0";
        } catch (e) {
            console.error(`GPU数据错误: ${e}`);
            this.label.text = "0.0";
        }
    }
    
    _parseGpuUsage(line) {
        // 简化解析逻辑 - 只提取第一个浮点数
        const match = line.match(/\d+\.\d+/);
        return match ? parseFloat(match[0]) : null;
    }
    
    _updateStyle(usage) {
        this.label.remove_style_class_name('gpu-monitor-label-high');
        this.label.remove_style_class_name('gpu-monitor-label-medium');
        
        if (usage > 85) {
            this.label.add_style_class_name('gpu-monitor-label-high');
        } else if (usage > 60) {
            this.label.add_style_class_name('gpu-monitor-label-medium');
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
        try {
            indicator = new GPUMonitorIndicator();
            
            // 添加到左侧区域的最右侧
            const leftBox = Main.panel._leftBox;
            leftBox.add_child(indicator);
            
            // 将指示器移动到左侧区域的末尾
            const children = leftBox.get_children();
            if (children.length > 0) {
                const lastChild = children[children.length - 1];
                leftBox.set_child_below_sibling(indicator, lastChild);
            }
        } catch (e) {
            console.error("扩展启用失败:", e);
        }
    }
    
    disable() {
        try {
            if (indicator) {
                indicator.stop();
                indicator.destroy();
                indicator = null;
            }
        } catch (e) {
            console.error("扩展禁用失败:", e);
        }
    }
}