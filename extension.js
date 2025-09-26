import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const LOG_PATH = '/var/lib/gpu-monitor/gpu_stats.txt';
const POWER_LOG_PATH = '/var/lib/power-monitor/power_stats.txt';
const ICON_PATH = `${GLib.get_home_dir()}/.local/share/gnome-shell/extensions/intel-gpu-monitor@perry_lin/icons/`;
const REFRESH_INTERVAL = 1; // 刷新间隔(秒)

const GPUMonitorIndicator = GObject.registerClass(
class GPUMonitorIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, "GPU Monitor");
        this.add_style_class_name('gpu-monitor-button')
        
        this.box = new St.BoxLayout({ 
            vertical: false,
            style_class: 'panel-status-menu-box'
        });
        this.add_child(this.box);

        const file = Gio.File.new_for_path(ICON_PATH + 'gpu-symbolic.svg');
        if (file.query_exists(null)) {
            const fileIcon = new Gio.FileIcon({ file });
            this.gpuIcon = new St.Icon({
                gicon: fileIcon,
                style_class: 'system-status-icon',
                icon_size: 28
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
            text: "0% | 0 MHz",
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'gpu-monitor-label',
            width: 200,
            x_align: Clutter.ActorAlign.START
        });
        this.box.add_child(this.label);

        // 功率图标
        const powerFile = Gio.File.new_for_path(ICON_PATH + 'power-symbolic.svg');
        if (powerFile.query_exists(null)) {
            const fileIcon = new Gio.FileIcon({ file: powerFile });
            this.powerIcon = new St.Icon({
                gicon: fileIcon,
                style_class: 'system-status-icon',
                icon_size: 28
            });
        }
        else {
            this.powerIcon = new St.Icon({
                icon_name: 'battery-full-symbolic',
                style_class: 'system-status-icon'
            });
        }
        this.box.add_child(this.powerIcon);

        // 功率标签
        this.powerLabel = new St.Label({ 
            text: "0W",
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'power-monitor-label',
            width: 70,
            x_align: Clutter.ActorAlign.START
        });
        this.box.add_child(this.powerLabel);
        
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
        // 添加频率显示项
        this.freqItem = new St.Label({ 
            text: "GPUFreq: N/A", 
            x_align: Clutter.ActorAlign.START,
            style_class: 'gpu-monitor-menu-label'
        });
        const freqMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        freqMenuItem.add_child(this.freqItem);
        this.menu.addMenuItem(freqMenuItem);

        this._themeChangeId = St.ThemeContext.get_for_stage(global.stage).connect(
            'changed',
            this._updateMenuColors.bind(this)
        );

        this._timeoutId = null;
        this.displayText = "0% | 0 MHz";
        this._setRefreshTimer();
        this._updateMenuColors();
    }

    _updateMenuColors() {
        const settings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        const colorScheme = settings.get_string('color-scheme');
        const isDarkTheme = colorScheme === 'prefer-dark';
        
        Object.values(this.menuItems).forEach(label => {
            if (isDarkTheme) {
                label.remove_style_class_name('gpu-menu-light');
                label.add_style_class_name('gpu-menu-dark');
            } else {
                label.remove_style_class_name('gpu-menu-dark');
                label.add_style_class_name('gpu-menu-light');
            }
        });
        // 更新频率显示项的颜色
        if (isDarkTheme) {
            this.freqItem.remove_style_class_name('gpu-menu-light');
            this.freqItem.add_style_class_name('gpu-menu-dark');
        } else {
            this.freqItem.remove_style_class_name('gpu-menu-dark');
            this.freqItem.add_style_class_name('gpu-menu-light');
        }
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
                this._getGpuFrequency();
                this._readPowerData();
                this.label.text = this.displayText;
                return GLib.SOURCE_CONTINUE;
            }
        );
    }
    
    _readGpuData() {
        try {
            // 检查文件是否存在
            if (!GLib.file_test(LOG_PATH, GLib.FileTest.EXISTS)) {
                this.displayText = "NOFILE";
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
                        this.displayText = 'NODATA';
                        return;
                    }

                    // 渲染引擎占用率
                    const rcs = parseFloat(parts[6]);
                    const bcs = parseFloat(parts[9]);
                    const vcs = parseFloat(parts[12]);
                    const vecs = parseFloat(parts[15]);
                    const ccs = parseFloat(parts[18] || 0);

                    const maxUsage = Math.max(rcs, bcs, vcs, vecs, ccs);
                    this.displayText = `${maxUsage}%`;
                    this._updateStyle(maxUsage);

                    // 更新下拉菜单
                    this.menuItems.RCS.set_text(`Render/3D: ${rcs}%`);
                    this._updateMenuStyle(this.menuItems.RCS, rcs);
                    this.menuItems.BCS.set_text(`Blitter: ${bcs}%`);
                    this._updateMenuStyle(this.menuItems.BCS, bcs);
                    this.menuItems.VCS.set_text(`Video: ${vcs}%`);
                    this._updateMenuStyle(this.menuItems.VCS, vcs);
                    this.menuItems.VECS.set_text(`VideoEnhance: ${vecs}%`);
                    this._updateMenuStyle(this.menuItems.VECS, vecs);
                    this.menuItems.CCS.set_text(`Compute: ${ccs}%`);
                    this._updateMenuStyle(this.menuItems.CCS, ccs);

                    this._updateMenuColors();

                    return;
                }
            }

            this.displayText = "NODATA";
        } catch (e) {
            console.error(`GPU数据错误: ${e}`);
            this.displayText = "ERR";
        }
    }

    _readPowerData() {
        try {
            // 检查文件是否存在
            if (!GLib.file_test(POWER_LOG_PATH, GLib.FileTest.EXISTS)) {
                this.powerLabel.text = "NOFILE";
                return;
            }
            
            const [success, bytes] = GLib.file_get_contents(POWER_LOG_PATH);
            
            if (success && bytes.length > 0) {
                const decoder = new TextDecoder();
                const text = decoder.decode(bytes);

                // 获取倒数第二行非空行，防止最后一行未输出完
                const lines = text.split('\n').filter(line => line.trim() !== '');
                if (lines.length > 2) {
                    const lastLine = lines[lines.length - 2].trim();
                    
                    // 解析功率值 - 根据新的输出格式
                    const parts = lastLine.split(/\s+/);
                    if (parts.length >= 13) {
                        // 功率值是最后一个字段
                        const power = parseFloat(parts[12]);
                        if (!isNaN(power)) {
                            this.powerLabel.text = `${power.toFixed(1)}W`;
                            this._updatePowerStyle(power);
                            return;
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`功率数据错误: ${e}`);
            this.powerLabel.text = "ERR";
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
    _getGpuFrequency() {
        try {
            let subprocess = new Gio.Subprocess({
                argv: ['sudo', 'intel_gpu_frequency', '-g'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            subprocess.init(null);

            subprocess.communicate_utf8_async(null, null, (proc, res) => {
                this._readGpuData(); // 每次获取频率时也更新GPU使用率
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (proc.get_exit_status() === 0) {
                        let minFreq = 'N/A';
                        let curFreq = 'N/A';
                        let maxFreq = 'N/A';
                        
                        const lines = stdout.split('\n');
                        for (let line of lines) {
                            if (line.includes('min:')) {
                                const match = line.match(/min: \s*(\d+)\s* MHz/);
                                if (match) minFreq = match[1];
                            } else if (line.includes('cur:')) {
                                const match = line.match(/cur: \s*(\d+)\s* MHz/);
                                if (match) curFreq = match[1];
                            } else if (line.includes('max:')) {
                                const match = line.match(/max: \s*(\d+)\s* MHz/);
                                if (match) maxFreq = match[1];
                            }
                        }
                        
                        this.freqItem.set_text(`Freq: ${minFreq} | ${curFreq} | ${maxFreq} MHz`);
                        this.displayText += ` | ${curFreq} MHz`;
                    } else {
                        console.error(`intel_gpu_frequency error: ${stderr}`);
                        this.freqItem.set_text('Freq: ERR');
                        this.displayText += ' | ERR MHz';
                    }
                } catch (e) {
                    console.error(`获取频率失败: ${e}`);
                    this.freqItem.set_text('Freq: ERR');
                    this.displayText += ' | ERR MHz';
                }
            });
        } catch (e) {
            console.error(`启动频率获取命令失败: ${e}`);
            this.freqItem.set_text('Freq: ERR');
            this.displayText += ' | ERR MHz';
        }
    }
    
    _updateStyle(usage) {
        this.label.remove_style_class_name('gpu-monitor-label-high');
        this.label.remove_style_class_name('gpu-monitor-label-medium');
        this.label.remove_style_class_name('gpu-monitor-label-max');
        this.label.remove_style_class_name('gpu-monitor-label-error');
        this.label.remove_style_class_name('gpu-monitor-bg-max');
        this.gpuIcon.remove_style_class_name('gpu-icon-red');
        
        if (usage > 95) {
            this.label.add_style_class_name('gpu-monitor-label-max');
            this.label.add_style_class_name('gpu-monitor-bg-max');
            this.gpuIcon.add_style_class_name('gpu-icon-red');
        } else if (usage > 80) {
            this.label.add_style_class_name('gpu-monitor-label-high');
        } else if (usage > 60) {
            this.label.add_style_class_name('gpu-monitor-label-medium');
        }
    }

    _updatePowerStyle(power) {
        this.powerLabel.remove_style_class_name('power-monitor-medium');
        this.powerIcon.remove_style_class_name('power-icon-orange');
        this.powerLabel.remove_style_class_name('power-monitor-high');
        this.powerIcon.remove_style_class_name('power-icon-red');
        this.powerLabel.remove_style_class_name('power-monitor-max');
        this.powerLabel.remove_style_class_name('power-bg-max');

        if (power > 130) {
            this.powerLabel.add_style_class_name('power-monitor-max');
            this.powerIcon.add_style_class_name('power-icon-red');
            this.powerLabel.add_style_class_name('power-bg-max');
        } 
        else if (power > 100) {
            this.powerLabel.add_style_class_name('power-monitor-high');
            this.powerIcon.add_style_class_name('power-icon-red');
        }
        else if (power > 80) {
            this.powerLabel.add_style_class_name('power-monitor-medium');
            this.powerIcon.add_style_class_name('power-icon-orange');
        }
        

    }

    _updateMenuStyle(label, usage) {
        if (!label) return;
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

        if (this._themeChangeId) {
            St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangeId);
            this._themeChangeId = null;
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