import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Typography,
  Divider,
  Button,
  Stack,
  Box,
  Switch,
  Textarea,
  List,
  ListItem,
  ListItemContent,
  Alert,
  Modal,
  ModalClose,
  Sheet,
  Input,
  Chip,
} from '@mui/joy';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';

const ROBLOX_FLAGS = {
  'Rendering API': [
    {
      key: 'FFlagDebugGraphicsPreferD3D11',
      type: 'boolean',
      label: 'Prefer Direct3D 11',
      exclusiveGroup: 'RenderingAPI',
    },
    {
      key: 'FFlagDebugGraphicsPreferVulkan',
      type: 'boolean',
      label: 'Prefer Vulkan',
      exclusiveGroup: 'RenderingAPI',
    },
    {
      key: 'FFlagDebugGraphicsPreferOpenGL',
      type: 'boolean',
      label: 'Prefer OpenGL',
      exclusiveGroup: 'RenderingAPI',
    },
  ],
  'Graphics Quality': [
    {
      key: 'DFFlagTextureQualityOverrideEnabled',
      type: 'boolean',
      label: 'Enable Texture Quality Override',
    },
    {
      key: 'DFIntTextureQualityOverride',
      type: 'number',
      label: 'Texture Quality Level',
    },
    { key: 'FIntDebugForceMSAASamples', type: 'number', label: 'MSAA Samples' },
    {
      key: 'DFIntDebugFRMQualityLevelOverride',
      type: 'number',
      label: 'FRM Quality Level',
    },
    {
      key: 'DFIntCSGLevelOfDetailSwitchingDistance',
      type: 'number',
      default: 0,
      label: 'CSG LOD Distance',
    },
    {
      key: 'DFIntCSGLevelOfDetailSwitchingDistanceL12',
      type: 'number',
      default: 0,
      label: 'CSG LOD L1 -> L2',
    },
    {
      key: 'DFIntCSGLevelOfDetailSwitchingDistanceL23',
      type: 'number',
      default: 0,
      label: 'CSG LOD L2 -> L3',
    },
    {
      key: 'DFIntCSGLevelOfDetailSwitchingDistanceL34',
      type: 'number',
      default: 0,
      label: 'CSG LOD L3 -> L4',
    },
  ],
  Environment: [
    { key: 'FFlagDebugSkyGray', type: 'boolean', label: 'Gray Sky' },
    {
      key: 'DFFlagDebugPauseVoxelizer',
      type: 'boolean',
      label: 'Pause Voxelizer',
    },
    {
      key: 'FIntFRMMaxGrassDistance',
      type: 'number',
      label: 'Max Grass Distance',
    },
    {
      key: 'FIntFRMMinGrassDistance',
      type: 'number',
      label: 'Min Grass Distance',
    },
    {
      key: 'FIntGrassMovementReducedMotionFactor',
      type: 'number',
      label: 'Grass Reduced Motion',
    },
  ],
  Window: [
    {
      key: 'FFlagHandleAltEnterFullscreenManually',
      type: 'boolean',
      label: 'Alt+Enter Fullscreen',
    },
    {
      key: 'DFFlagDisableDPIScale',
      type: 'boolean',
      label: 'Disable DPI Scale',
    },
  ],
};

const STUDIO_FLAGS = {
  'Lighting Technologies': [
    {
      key: 'DFFlagDebugRenderForceTechnologyVoxel',
      type: 'boolean',
      label: 'Voxel Lighting (Phase 1)',
      default: true,
      exclusiveGroup: 'Lighting',
    },
    {
      key: 'FFlagDebugForceFutureIsBrightPhase2',
      type: 'boolean',
      label: 'Shadowmap Lighting (Phase 2)',
      default: true,
      exclusiveGroup: 'Lighting',
    },
    {
      key: 'FFlagDebugForceFutureIsBrightPhase3',
      type: 'boolean',
      label: 'Future Lighting (Phase 3)',
      default: true,
      exclusiveGroup: 'Lighting',
    },
  ],
  'Rendering API': [
    {
      key: 'FFlagDebugGraphicsPreferMetal',
      type: 'boolean',
      label: 'Prefer Metal (MacOS)',
      default: true,
      exclusiveGroup: 'StudioRendering',
    },
    {
      key: 'FFlagDebugGraphicsPreferVulkan',
      type: 'boolean',
      label: 'Prefer Vulkan',
      default: true,
      exclusiveGroup: 'StudioRendering',
    },
    {
      key: 'FFlagDebugGraphicsPreferOpenGL',
      type: 'boolean',
      label: 'Prefer OpenGL',
      default: true,
      exclusiveGroup: 'StudioRendering',
    },
    {
      key: 'FFlagDebugGraphicsPreferD3D11FL10',
      type: 'boolean',
      label: 'Prefer DX10',
      default: true,
      exclusiveGroup: 'StudioRendering',
    },
    {
      key: 'FFlagDebugGraphicsPreferD3D11',
      type: 'boolean',
      label: 'Prefer DX11',
      default: true,
      exclusiveGroup: 'StudioRendering',
    },
  ],
  'Graphical Settings': [
    {
      key: 'FFlagDebugAvatarChatVisualization',
      type: 'boolean',
      label: 'Draw Circle Under Avatars',
      default: true,
    },
    {
      key: 'FFlagDebugCheckRenderThreading',
      type: 'boolean',
      label: 'Check Render Threading',
      default: true,
    },
    {
      key: 'FIntRuntimeMaxNumOfThreads',
      type: 'number',
      label: 'Max Threads',
      default: 2400,
    },
    {
      key: 'FIntTaskSchedulerThreadMin',
      type: 'number',
      label: 'Min Threads',
      default: 3,
    },
    {
      key: 'FFlagDebugRenderingSetDeterministic',
      type: 'boolean',
      label: 'Smoother Terrain',
      default: true,
    },
    {
      key: 'FIntRomarkStartWithGraphicQualityLevel',
      type: 'number',
      label: 'Start Graphic Quality',
      default: 1,
    },
    {
      key: 'FIntTerrainArraySliceSize',
      type: 'number',
      label: 'Terrain Slice Size',
      default: 4,
    },
    {
      key: 'FIntRenderShadowIntensity',
      type: 'number',
      label: 'Shadow Intensity',
      default: 0,
    },
    {
      key: 'DFFlagDisableDPIScale',
      type: 'boolean',
      label: 'Disable DPI Scale',
      default: true,
    },
    {
      key: 'FFlagGlobalWindRendering',
      type: 'boolean',
      label: 'Global Wind Rendering',
      default: false,
    },
    {
      key: 'DFIntRenderClampRoughnessMax',
      type: 'number',
      label: 'Clamp Roughness Max',
      default: -640000000,
    },
    {
      key: 'FFlagDisablePostFx',
      type: 'boolean',
      label: 'Disable PostFX',
      default: true,
    },
    {
      key: 'DFFlagDebugPauseVoxelizer',
      type: 'boolean',
      label: 'Pause Voxelizer',
      default: true,
    },
    {
      key: 'FFlagDebugSkyGray',
      type: 'boolean',
      label: 'Gray Sky',
      default: true,
    },
    {
      key: 'DFIntCSGLevelOfDetailSwitchingDistance',
      type: 'number',
      label: 'LOD Switching Distance',
      default: 0,
    },
    {
      key: 'FFlagNewLightAttenuation',
      type: 'boolean',
      label: 'New Light Attenuation',
      default: true,
    },
    {
      key: 'FFlagFastGPULightCulling3',
      type: 'boolean',
      label: 'Fast GPU Light Culling 3',
      default: true,
    },
    {
      key: 'DFIntMaxFrameBufferSize',
      type: 'number',
      label: 'Max Frame Buffer Size',
      default: 4,
    },
    {
      key: 'DFFlagTextureQualityOverrideEnabled',
      type: 'boolean',
      label: 'Texture Quality Override',
      default: true,
    },
    {
      key: 'DFIntTextureQualityOverride',
      type: 'number',
      label: 'Texture Quality Level',
      default: 3,
    },
    {
      key: 'FIntDebugForceMSAASamples',
      type: 'number',
      label: 'Force MSAA Samples',
      default: 4,
    },
    {
      key: 'FIntRenderShadowmapBias',
      type: 'number',
      label: 'Shadowmap Bias',
      default: 75,
    },
  ],
  'User Interface': [
    {
      key: 'FFlagEnableNavBarLabels3',
      type: 'boolean',
      label: 'Navbar Labels 3',
      default: true,
    },
    {
      key: 'FFlagUserShowGuiHideToggles',
      type: 'boolean',
      label: 'Show GUI Hide Toggles',
      default: true,
    },
    {
      key: 'FFlagLuaAppUseUIBloxColorPalettes1',
      type: 'boolean',
      label: 'Darker Dark Theme',
      default: true,
    },
    {
      key: 'DFIntMicroProfilerDpiScaleOverride',
      type: 'number',
      label: 'MicroProfiler DPI Scale',
      default: 100,
    },
    {
      key: 'FFlagDebugAdornsDisabled',
      type: 'boolean',
      label: 'Hide Adorns',
      default: true,
    },
    {
      key: 'FFlagDebugDontRenderUI',
      type: 'boolean',
      label: 'Dont Render UI',
      default: true,
    },
    {
      key: 'FFlagEnableCommandAutocomplete',
      type: 'boolean',
      label: 'Enable Command Autocomplete',
      default: false,
    },
    {
      key: 'FFlagEnableInGameMenuChrome',
      type: 'boolean',
      label: 'Enable Chrome UI',
      default: true,
    },
    {
      key: 'FFlagEnableChromePinnedChat',
      type: 'boolean',
      label: 'Chrome Pinned Chat',
      default: true,
    },
    {
      key: 'FFlagEnableBubbleChatFromChatService',
      type: 'boolean',
      label: 'Enable Bubble Chat',
      default: false,
    },
  ],
  Physics: [
    {
      key: 'DFIntTaskSchedulerTargetFps',
      type: 'number',
      label: 'Task Scheduler Target FPS',
      default: 9999,
    },
    {
      key: 'FFlagRemapAnimationR6ToR15Rig',
      type: 'boolean',
      label: 'Remap R6 to R15',
      default: true,
    },
    {
      key: 'DFFlagAnimatorPostProcessIK',
      type: 'boolean',
      label: 'Animator Post Process IK',
      default: true,
    },
    {
      key: 'DFIntDebugSimPhysicsSteppingMethodOverride',
      type: 'number',
      label: 'Physics Stepping Method',
      default: 10000000,
    },
    {
      key: 'DFIntMinClientSimulationRadius',
      type: 'number',
      label: 'Min Client Sim Radius',
      default: 2147000000,
    },
    {
      key: 'DFIntRaycastMaxDistance',
      type: 'number',
      label: 'Max Raycast Distance',
      default: 3,
    },
  ],
  Other: [
    {
      key: 'DFFlagDebugDisableTimeoutDisconnect',
      type: 'boolean',
      label: 'Disable Timeout Disconnect',
      default: true,
    },
    {
      key: 'FFlagReconnectDisabled',
      type: 'boolean',
      label: 'Disable Reconnect',
      default: true,
    },
    {
      key: 'DFIntVoiceChatRollOffMinDistance',
      type: 'number',
      label: 'Voice Chat Min Distance',
      default: 7,
    },
    {
      key: 'DFIntVoiceChatRollOffMaxDistance',
      type: 'number',
      label: 'Voice Chat Max Distance',
      default: 80,
    },
    {
      key: 'FFlagAdServiceEnabled',
      type: 'boolean',
      label: 'Ad Service Enabled',
      default: false,
    },
    {
      key: 'FFlagDebugDisableTelemetryEphemeralCounter',
      type: 'boolean',
      label: 'Disable Telemetry',
      default: true,
    },
    {
      key: 'FIntScrollWheelDeltaAmount',
      type: 'number',
      label: 'Scroll Wheel Delta',
      default: 140,
    },
    {
      key: 'DFIntConnectionMTUSize',
      type: 'number',
      label: 'MTU Size',
      default: 900,
    },
    {
      key: 'FFlagDebugDisplayFPS',
      type: 'boolean',
      label: 'Display FPS',
      default: true,
    },
  ],
};

export default function FastFlags({
  registerSave,
  unregisterSave,
}: {
  registerSave?: (cb: () => void | Promise<void>) => void;
  unregisterSave?: () => void;
}) {
  const [subTab, setSubTab] = useState<'roblox' | 'studio'>('roblox');
  const [flagValues, setFlagValues] = useState<Record<string, any>>({});
  const [jsonInput, setJsonInput] = useState('{\n\n}');
  const [jsonMode, setJsonMode] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showStudioWarning, setShowStudioWarning] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<string>('');

  useEffect(() => {
    try {
      const res = platform();

      if (typeof res === 'string') {
        setCurrentPlatform(res);
      } else if (res && typeof (res as any).then === 'function') {
        (res as Promise<string>)
          .then((val) => {
            if (val) setCurrentPlatform(val);
          })
          .catch(() => {

          });
      }
    } catch (e) {

    }
  }, []);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        setStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    setStatus(null);
  }, [subTab]);

  useEffect(() => {
    if (subTab === 'studio') {
      const timer = setTimeout(() => {
        setShowStudioWarning(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowStudioWarning(true);
    }
  }, [subTab]);

  const [allFlags, setAllFlags] = useState<Record<string, string> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [loadingFlags, setLoadingFlags] = useState(false);

  useEffect(() => {
    const savedJson = localStorage.getItem(`fastFlags_${subTab}`);
    if (savedJson) {
      setJsonInput(savedJson);
      try {
        JSON.parse(savedJson);
      } catch {}
    }
  }, [subTab]);

  const findFlagDef = (key: string) => {
    const collections =
      subTab === 'roblox'
        ? [ROBLOX_FLAGS, STUDIO_FLAGS]
        : [STUDIO_FLAGS, ROBLOX_FLAGS];

    for (const collection of collections) {
      for (const cat of Object.values(collection)) {
        for (const flag of cat) if (flag.key === key) return flag;
      }
    }
    return null;
  };

  const updateFlag = (key: string, value: any) => {
    setFlagValues((prev) => {
      const next = { ...prev };

      if (value === true) {
        const def = findFlagDef(key) as any;
        if (def && def.exclusiveGroup) {
          Object.values(ROBLOX_FLAGS).forEach((cat) =>
            cat.forEach((f: any) => {
              if (f.exclusiveGroup === def.exclusiveGroup && f.key !== key) {
                delete next[f.key];
              }
            })
          );
          Object.values(STUDIO_FLAGS).forEach((cat) =>
            cat.forEach((f: any) => {
              if (f.exclusiveGroup === def.exclusiveGroup && f.key !== key) {
                delete next[f.key];
              }
            })
          );
        }
      }

      if (value === undefined || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }

      updateJsonPreview(next);
      return next;
    });
  };

  const updateJsonPreview = (currentFlags: Record<string, any>) => {
    try {
      const currentJson = JSON.parse(jsonInput);
      const newJson = { ...currentJson, ...currentFlags };

      const allManagedKeys = new Set([
        ...Object.values(ROBLOX_FLAGS).flatMap((c) => c.map((f) => f.key)),
        ...Object.values(STUDIO_FLAGS).flatMap((c) => c.map((f) => f.key)),
      ]);

      for (const key of Object.keys(newJson)) {
        if (allManagedKeys.has(key) && !(key in currentFlags)) {
          delete newJson[key];
        }
      }

      const jsonStr = JSON.stringify(newJson, null, 2);
      setJsonInput(jsonStr);
      localStorage.setItem(`fastFlags_${subTab}`, jsonStr);
    } catch (e) {
      const jsonStr = JSON.stringify(currentFlags, null, 2);
      setJsonInput(jsonStr);
      localStorage.setItem(`fastFlags_${subTab}`, jsonStr);
    }
  };

  const stateRef = useRef({ jsonInput, subTab });
  useEffect(() => {
    stateRef.current = { jsonInput, subTab };
  }, [jsonInput, subTab]);

  const handleSave = useCallback(async () => {
    const { jsonInput, subTab } = stateRef.current;
    try {
      JSON.parse(jsonInput);
      localStorage.setItem(`fastFlags_${subTab}`, jsonInput);
      const result = await invoke('save_fast_flags', {
        flagsJson: jsonInput,
        mode: subTab,
      });
      setStatus(result as string);
    } catch (e) {
      setStatus('Error: ' + String(e));
    }
  }, []);

  useEffect(() => {
    if (registerSave) registerSave(handleSave);
    return () => {
      if (unregisterSave) unregisterSave();
    };
  }, [registerSave, unregisterSave, handleSave]);

  const handleOpenStudioFlagsList = async () => {
    setModalOpen(true);
    if (!allFlags) {
      setLoadingFlags(true);
      try {
        const data = await invoke('fetch_all_flags', { mode: subTab });
        setAllFlags(data as Record<string, string>);
      } catch (e) {
        setStatus('Failed to fetch flags: ' + String(e));
      } finally {
        setLoadingFlags(false);
      }
    }
  };

  const renderConfiguredFlagsList = () => {
    const keys = Object.keys(flagValues);
    if (keys.length === 0)
      return (
        <Typography level="body-sm" sx={{ opacity: 0.5, fontStyle: 'italic' }}>
          No flags configured
        </Typography>
      );

    return (
      <Stack spacing={1} sx={{ maxHeight: '300px', overflowY: 'auto' }}>
        {keys.map((key) => (
          <Box
            key={key}
            sx={{
              p: 1,
              border: '1px solid var(--border-color)',
              borderRadius: 'sm',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'var(--bg-content)',
            }}
          >
            <Box sx={{ overflow: 'hidden' }}>
              <Typography
                level="body-xs"
                fontWeight="bold"
                sx={{ color: 'var(--text-primary)' }}
              >
                {key}
              </Typography>
              <Typography
                level="body-xs"
                sx={{
                  fontFamily: 'monospace',
                  opacity: 0.7,
                  color: 'var(--text-primary)',
                }}
              >
                {String(flagValues[key])}
              </Typography>
            </Box>
            <Button
              color="danger"
              variant="plain"
              size="sm"
              onClick={() => updateFlag(key, undefined)}
            >
              ×
            </Button>
          </Box>
        ))}
      </Stack>
    );
  };

  const toggleAllFlag = (key: string) => {
    const current = flagValues[key];
    if (current !== undefined) {
      updateFlag(key, undefined);
    } else {
      if (key.startsWith('FInt') || key.startsWith('DFInt')) {
        updateFlag(key, 0);
      } else {
        updateFlag(key, true);
      }
    }
  };

  const renderFlag = (flag: {
    key: string;
    type: string;
    label?: string;
    default?: any;
    exclusiveGroup?: string;
  }) => {
    const isChecked = flagValues[flag.key] === true;
    const numberValue = flagValues[flag.key] || flag.default || 0;

    return (
      <ListItem key={flag.key}>
        <ListItemContent
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography level="body-md" sx={{ color: 'var(--text-primary)' }}>
              {flag.label || flag.key}
            </Typography>
            <Typography
              level="body-xs"
              sx={{
                fontFamily: 'monospace',
                opacity: 0.6,
                color: 'var(--text-primary)',
              }}
            >
              {flag.key}
            </Typography>
          </Box>
          {flag.type === 'boolean' ? (
            <Switch
              checked={isChecked}
              onChange={(e) => updateFlag(flag.key, e.target.checked)}
              variant="soft"
            />
          ) : (
            <input
              type="number"
              value={numberValue}
              onChange={(e) => updateFlag(flag.key, parseInt(e.target.value))}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '4px',
                borderRadius: '4px',
                width: '80px',
              }}
            />
          )}
        </ListItemContent>
      </ListItem>
    );
  };

  return (
    <>
      <Divider className="content-divider" />
      <Stack direction="row" spacing={2} sx={{ mb: 2, mt: 2 }}>
        <Button
          variant={subTab === 'roblox' ? 'solid' : 'outlined'}
          onClick={() => setSubTab('roblox')}
          sx={{
            flex: 1,
            backgroundColor:
              subTab === 'roblox' ? 'var(--bg-titlebar)' : 'transparent',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          Roblox
        </Button>
        {currentPlatform !== 'macos' && (
          <Button
            variant={subTab === 'studio' ? 'solid' : 'outlined'}
            onClick={() => setSubTab('studio')}
            sx={{
              flex: 1,
              backgroundColor:
                subTab === 'studio' ? 'var(--bg-titlebar)' : 'transparent',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            Studio
          </Button>
        )}
      </Stack>

      <Divider className="content-divider" sx={{ mb: 2 }} />

      <Button
        variant="outlined"
        onClick={() => setJsonMode(!jsonMode)}
        sx={{
          mb: 2,
          width: '100%',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {jsonMode ? 'Hide Advanced Editor' : 'Open Advanced Editor'}
      </Button>

      {jsonMode && (
        <Box
          sx={{
            mb: 2,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
          }}
        >
          <Stack spacing={2}>
            <Typography level="title-sm" sx={{ color: 'var(--text-primary)' }}>
              Raw JSON
            </Typography>
            <Textarea
              minRows={10}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              sx={{
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
            />
          </Stack>
          <Stack spacing={2}>
            <Typography level="title-sm" sx={{ color: 'var(--text-primary)' }}>
              Active Overrides
            </Typography>
            {renderConfiguredFlagsList()}
          </Stack>
          {status && (
            <Alert
              color={status.startsWith('Error') ? 'danger' : 'success'}
              sx={{ gridColumn: '1 / -1' }}
            >
              {status}
            </Alert>
          )}
        </Box>
      )}

      {status && !jsonMode && (
        <Alert
          color={status.startsWith('Error') ? 'danger' : 'success'}
          sx={{ mt: 1, mb: 2 }}
        >
          {status}
        </Alert>
      )}
      <Divider className="content-divider" />
      <List sx={{ overflowY: 'visible' }}>
        {subTab === 'roblox' && (
          <>
            {Object.entries(ROBLOX_FLAGS).map(([category, flags]) => (
              <React.Fragment key={category}>
                <ListItem>
                  <Typography
                    className="option-header"
                    level="body-md"
                    sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}
                  >
                    {category}
                  </Typography>
                </ListItem>
                {flags.map((f) => renderFlag(f as any))}
              </React.Fragment>
            ))}
          </>
        )}

        {subTab === 'studio' && currentPlatform !== 'macos' && (
          <>
            {showStudioWarning && (
              <ListItem sx={{ justifyContent: 'center' }}>
                <Alert color="warning" sx={{ mb: 2 }}>
                  Warning: Some Studio flags may cause instability.
                </Alert>
              </ListItem>
            )}
            {Object.entries(STUDIO_FLAGS).map(([category, flags]) => (
              <React.Fragment key={category}>
                <ListItem>
                  <Typography
                    className="option-header"
                    level="body-md"
                    sx={{ color: 'var(--text-primary)', mt: 1, mb: 1 }}
                  >
                    {category}
                  </Typography>
                </ListItem>
                {flags.map((f) => renderFlag(f as any))}
              </React.Fragment>
            ))}
            <ListItem sx={{ justifyContent: 'center' }}>
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                sx={{ width: '100%', mt: 2 }}
                onClick={handleOpenStudioFlagsList}
              >
                Browse All Available Flags
              </Button>
            </ListItem>
          </>
        )}
      </List>

      <Modal
        aria-labelledby="modal-title"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <Sheet
          variant="outlined"
          sx={{
            maxWidth: 800,
            width: '90%',
            height: '80vh',
            borderRadius: 'md',
            p: 3,
            boxShadow: 'lg',
            bgcolor: 'var(--bg-body)',
            borderColor: 'var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ModalClose variant="plain" sx={{ m: 1 }} />
          <Typography
            component="h2"
            id="modal-title"
            level="h4"
            textColor="inherit"
            fontWeight="lg"
            mb={1}
            sx={{ color: 'var(--text-primary)' }}
          >
            All Available Flags ({subTab})
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Input
              placeholder="Search flags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                flex: 1,
                bgcolor: 'transparent',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
            />
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
          >
            {[
              'Render',
              'Physics',
              'UI',
              'Audio',
              'Network',
              'DFFlag',
              'FInt',
            ].map((tag) => {
              const isActive = activeTags.includes(tag);
              return (
                <Chip
                  key={tag}
                  variant={isActive ? 'solid' : 'outlined'}
                  onClick={() =>
                    setActiveTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag]
                    )
                  }
                  sx={{
                    cursor: 'pointer',
                    bgcolor: isActive
                      ? 'white !important'
                      : 'transparent !important',
                    color: isActive ? 'black !important' : 'white !important',
                    borderColor: isActive
                      ? 'transparent'
                      : 'rgba(255, 255, 255, 0.3) !important',
                    '--Chip-bg': isActive ? 'white' : 'transparent',
                    '--Chip-color': isActive ? 'black' : 'white',
                    '&:hover': {
                      bgcolor: isActive
                        ? 'white !important'
                        : 'rgba(255, 255, 255, 0.1) !important',
                    },
                  }}
                >
                  {tag}
                </Chip>
              );
            })}
          </Stack>

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'sm',
              p: 1,
            }}
          >
            {loadingFlags ? (
              <Typography sx={{ p: 2, color: 'var(--text-primary)' }}>
                Loading flags from GitHub...
              </Typography>
            ) : (
              <List>
                <ListItem>
                  <Typography
                    level="body-xs"
                    sx={{ opacity: 0.7, color: 'var(--text-primary)' }}
                  >
                    Showing{' '}
                    {allFlags
                      ? Object.keys(allFlags).filter(
                          (k) =>
                            k
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()) &&
                            (activeTags.length === 0 ||
                              activeTags.some((t) => k.includes(t)))
                        ).length
                      : 0}{' '}
                    of {allFlags ? Object.keys(allFlags).length : 0} flags
                  </Typography>
                </ListItem>
                {allFlags &&
                  Object.keys(allFlags)
                    .filter(
                      (k) =>
                        k.toLowerCase().includes(searchTerm.toLowerCase()) &&
                        (activeTags.length === 0 ||
                          activeTags.some((t) => k.includes(t)))
                    )
                    .slice(0, 100)
                    .map((key) => (
                      <ListItem
                        key={key}
                        endAction={
                          <Switch
                            checked={flagValues[key] !== undefined}
                            onChange={() => toggleAllFlag(key)}
                          />
                        }
                      >
                        <ListItemContent>
                          <Typography
                            level="body-sm"
                            sx={{ color: 'var(--text-primary)' }}
                          >
                            {key}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{
                              fontFamily: 'monospace',
                              opacity: 0.5,
                              color: 'var(--text-primary)',
                            }}
                          >
                            Default: {allFlags[key]}
                          </Typography>
                        </ListItemContent>
                      </ListItem>
                    ))}
                {allFlags && Object.keys(allFlags).length > 100 && (
                  <ListItem>
                    <Typography level="body-xs" sx={{ p: 1, opacity: 0.5 }}>
                      Search to see more results...
                    </Typography>
                  </ListItem>
                )}
              </List>
            )}
          </Box>
        </Sheet>
      </Modal>
    </>
  );
}
