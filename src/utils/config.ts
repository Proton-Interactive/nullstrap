export class ConfigManager {
    private static instance: ConfigManager;

    private constructor() {}

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    public get(key: string): any {
        let storageKey = key;
        if (key === 'fastFlags') storageKey = 'fastFlags_roblox';
        if (key === 'fastFlagsStudio') storageKey = 'fastFlags_studio';
        if (key === 'currentSkybox') storageKey = 'activeSkyboxPath';

        try {
            const val = localStorage.getItem(storageKey);
            if (val === null) return this.getDefault(key);
            try {
                if (val === 'true') return true;
                if (val === 'false') return false;
                if (val.startsWith('{') || val.startsWith('[')) return JSON.parse(val);
                return val;
            } catch {
                return val;
            }
        } catch (e) {
            console.error(`Error reading config key ${key} (${storageKey}):`, e);
            return this.getDefault(key);
        }
    }

    public set(key: string, value: any): void {
        let storageKey = key;
        if (key === 'fastFlags') storageKey = 'fastFlags_roblox';
        if (key === 'fastFlagsStudio') storageKey = 'fastFlags_studio';
        if (key === 'currentSkybox') storageKey = 'activeSkyboxPath';

        try {
            if (typeof value === 'object') {
                localStorage.setItem(storageKey, JSON.stringify(value));
            } else {
                localStorage.setItem(storageKey, String(value));
            }
        } catch (e) {
            console.error(`Error writing config key ${key} (${storageKey}):`, e);
        }
    }

    private getDefault(key: string): any {
        const defaults: Record<string, any> = {
            snowfallEnabled: false,
            openingAnimationEnabled: true,
            windowWidth: 800,
            windowHeight: 600,
            currentSkybox: "Default",
            closeOnLaunch: true,
            minimizeOnLaunch: false,
            autoUpdate: true,
            showNotifications: true,
            discordRpcEnabled: false,
            cpuCoreLimit: 0,
            fastFlags: {},
            fastFlagsStudio: {},
            sober: {
                allow_gamepad_permission: false,
                bring_back_oof: false,
                close_on_leave: true,
                discord_rpc_enabled: false,
                enable_gamemode: true,
                graphics_optimization_mode: "performance"
            }
        };
        
        if (defaults[key] !== undefined) return defaults[key];
        
        if (key === 'discordRpcEnabled') return false;
        
        return null;
    }
    
    public saveConfig() {
    }
}
