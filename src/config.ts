export interface FastFlags {
  DFIntCSGLevelOfDetailSwitchingDistance: number;
  DFIntCSGLevelOfDetailSwitchingDistanceL12: number;
  DFIntCSGLevelOfDetailSwitchingDistanceL23: number;
  DFIntCSGLevelOfDetailSwitchingDistanceL34: number;
  FFlagHandleAltEnterFullscreenManually: boolean;
  DFFlagTextureQualityOverrideEnabled: boolean;
  DFIntTextureQualityOverride: number;
  FIntDebugForceMSAASamples: number;
  DFFlagDisableDPIScale: boolean;
  FFlagDebugGraphicsPreferD3D11: boolean;
  FFlagDebugSkyGray: boolean;
  DFFlagDebugPauseVoxelizer: boolean;
  DFIntDebugFRMQualityLevelOverride: number;
  FIntFRMMaxGrassDistance: number;
  FIntFRMMinGrassDistance: number;
  FFlagDebugGraphicsPreferVulkan: boolean;
  FFlagDebugGraphicsPreferOpenGL: boolean;
  FIntGrassMovementReducedMotionFactor: number;
  // studio / extended flags
  FFlagDebugGraphicsPreferMetal?: boolean;
  FIntRomarkStartWithGraphicQualityLevel?: number;
  FIntRenderShadowIntensity?: number;
  FFlagGlobalWindRendering?: boolean;
  FFlagNewLightAttenuation?: boolean;
  FFlagFastGPULightCulling3?: boolean;
  FIntRenderShadowmapBias?: number;
  DFFlagDebugDrawBroadPhaseAABBs?: boolean;
  DFFlagDebugEnableInterpolationVisualizer?: boolean;
  FFlagDebugLuaHeapDump?: boolean;
  DFFlagSimHumanoidPhysics?: boolean;
}

export interface SoberSettings {
  allow_gamepad_permission: boolean;
  bring_back_oof: boolean;
  close_on_leave: boolean;
  discord_rpc_enabled: boolean;
  discord_rpc_show_join_button: boolean;
  enable_gamemode: boolean;
  enable_hidpi: boolean;
  server_location_indicator_enabled: boolean;
  touch_mode: string;
  use_console_experience: boolean;
  use_libsecret: boolean;
  use_opengl: boolean;
  graphics_optimization_mode: string;
}

export interface AppConfig {
  snowfallEnabled: boolean;
  openingAnimationEnabled: boolean;
  unlockedFramerate: boolean;
  macOsUnlockFps: boolean;
  windowWidth: number;
  windowHeight: number;
  lastTab: string;
  fastFlags: FastFlags;
  fastFlagsStudio: FastFlags;
  currentSkybox: string;
  sober: SoberSettings;
  closeOnLaunch: boolean;
  minimizeOnLaunch: boolean;
  rememberWindowSize: boolean;
  autoUpdate: boolean;
  showNotifications: boolean;
  swiftTunnelEnabled: boolean;
  discordRpcEnabled: boolean;
  discordRpcClientId: string;
  rpcDetails: string;
  rpcState: string;
}

const DEFAULT_CONFIG: AppConfig = {
  snowfallEnabled: false,
  openingAnimationEnabled: true,
  unlockedFramerate: false,
  macOsUnlockFps: false,
  windowWidth: 800,
  windowHeight: 600,
  lastTab: "settings",
  currentSkybox: "Default",
  sober: {
    allow_gamepad_permission: false,
    bring_back_oof: false,
    close_on_leave: true,
    discord_rpc_enabled: false,
    discord_rpc_show_join_button: false,
    enable_gamemode: true,
    enable_hidpi: false,
    server_location_indicator_enabled: false,
    touch_mode: "off",
    use_console_experience: false,
    use_libsecret: false,
    use_opengl: false,
    graphics_optimization_mode: "quality",
  },
  fastFlags: {
    DFIntCSGLevelOfDetailSwitchingDistance: 250,
    DFIntCSGLevelOfDetailSwitchingDistanceL12: 500,
    DFIntCSGLevelOfDetailSwitchingDistanceL23: 750,
    DFIntCSGLevelOfDetailSwitchingDistanceL34: 1000,
    FFlagHandleAltEnterFullscreenManually: true,
    DFFlagTextureQualityOverrideEnabled: false,
    DFIntTextureQualityOverride: 3,
    FIntDebugForceMSAASamples: 0,
    DFFlagDisableDPIScale: false,
    FFlagDebugGraphicsPreferD3D11: false,
    FFlagDebugSkyGray: false,
    DFFlagDebugPauseVoxelizer: false,
    DFIntDebugFRMQualityLevelOverride: 0,
    FIntFRMMaxGrassDistance: 290,
    FIntFRMMinGrassDistance: 100,
    FFlagDebugGraphicsPreferVulkan: false,
    FFlagDebugGraphicsPreferOpenGL: false,
    FIntGrassMovementReducedMotionFactor: 5,
  },
  fastFlagsStudio: {
    DFIntCSGLevelOfDetailSwitchingDistance: 250,
    DFIntCSGLevelOfDetailSwitchingDistanceL12: 500,
    DFIntCSGLevelOfDetailSwitchingDistanceL23: 750,
    DFIntCSGLevelOfDetailSwitchingDistanceL34: 1000,
    FFlagHandleAltEnterFullscreenManually: true,
    DFFlagTextureQualityOverrideEnabled: false,
    DFIntTextureQualityOverride: 3,
    FIntDebugForceMSAASamples: 0,
    DFFlagDisableDPIScale: false,
    FFlagDebugGraphicsPreferD3D11: false,
    FFlagDebugSkyGray: false,
    DFFlagDebugPauseVoxelizer: false,
    DFIntDebugFRMQualityLevelOverride: 0,
    FIntFRMMaxGrassDistance: 290,
    FIntFRMMinGrassDistance: 100,
    FFlagDebugGraphicsPreferVulkan: false,
    FFlagDebugGraphicsPreferOpenGL: false,
    FIntGrassMovementReducedMotionFactor: 5,
    // Studio / Extended Flags defaults
    FFlagDebugGraphicsPreferMetal: false,
    FIntRomarkStartWithGraphicQualityLevel: 21,
    FIntRenderShadowIntensity: 1,
    FFlagGlobalWindRendering: true,
    FFlagNewLightAttenuation: true,
    FFlagFastGPULightCulling3: true,
    FIntRenderShadowmapBias: 75,
    DFFlagDebugDrawBroadPhaseAABBs: false,
    DFFlagDebugEnableInterpolationVisualizer: false,
    FFlagDebugLuaHeapDump: false,
    DFFlagSimHumanoidPhysics: false,
  },
  closeOnLaunch: false,
  minimizeOnLaunch: false,
  rememberWindowSize: true,
  autoUpdate: true,
  showNotifications: true,
  swiftTunnelEnabled: false,
  discordRpcEnabled: true,
  discordRpcClientId: "1461231170770698313",
  rpcDetails: "Playing Roblox",
  rpcState: "Using nullstrap",
};

export class ConfigManager {
  private static STORAGE_KEY = "app_config";
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): AppConfig {
    const stored = localStorage.getItem(ConfigManager.STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_CONFIG };
    }
    try {
      const parsed = JSON.parse(stored);
      // merge with default to ensure all keys exist
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      console.error("Failed to parse config", e);
      return { ...DEFAULT_CONFIG };
    }
  }

  public saveConfig() {
    localStorage.setItem(
      ConfigManager.STORAGE_KEY,
      JSON.stringify(this.config),
    );
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public set<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    this.config[key] = value;
    this.saveConfig();
  }

  public getAll(): AppConfig {
    return { ...this.config };
  }
}
