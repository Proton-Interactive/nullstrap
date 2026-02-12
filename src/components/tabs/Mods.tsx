import { useState, useEffect } from 'react';

import { Typography, Divider, Button, Stack, Alert, Select, Option, Box, List, ListItem, ListItemContent, Switch } from '@mui/joy';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { type as getOsType } from '@tauri-apps/plugin-os';

const SKYBOX_ASSETS = import.meta.glob('/src/assets/skyboxes*.{tex,png,jpg}', {
    query: '?url',
    import: 'default',
    eager: true
});

export default function Mods() {
    const [cleanerStatus, setCleanerStatus] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [osType, setOsType] = useState<string>('windows');

    const [soberSettings, setSoberSettings] = useState<Record<string, any>>({
        allow_gamepad_permission: false,
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
        graphics_optimization_mode: "quality"
    });

    useEffect(() => {
        const getOs = async () => {
            const t = await getOsType();
            setOsType(t);
        };
        getOs();
    }, []);

    const updateSoberSetting = (key: string, value: any) => {
        setSoberSettings(prev => ({ ...prev, [key]: value }));
    };

    const [cleanLogs, setCleanLogs] = useState(true);
    const [cleanCache, setCleanCache] = useState(false);

    const [selectedSkybox, setSelectedSkybox] = useState<string>('default');

    const handleClean = async () => {
         try {
            const directories = [];
            if (cleanLogs) directories.push("RobloxLogs");
            if (cleanCache) directories.push("RobloxCache");
            
            if (directories.length === 0) {
                setCleanerStatus("No items selected.");
                return;
            }

            const result = await invoke('run_cleaner', { maxAgeDays: 0, directories });
            setCleanerStatus(result as string);
         } catch (e) {
             setCleanerStatus('Error: ' + String(e));
         }
    };

    const installPredefinedSkybox = async (name: string) => {
        setLoading(true);
        setStatus(`Preparing ${name} skybox...`);
        
        try {
            const keys = Object.keys(SKYBOX_ASSETS).filter(k => k.includes(`/skyboxes/${name}/`));
            
            if (keys.length === 0) {
                throw new Error(`No assets found for skybox: ${name}`);
            }

            const appData = await appLocalDataDir();
            const tempDir = await join(appData, 'temp_skybox');
            
            if (!await exists(tempDir)) {
                await mkdir(tempDir, { recursive: true });
            }

            setStatus(`Downloading ${keys.length} assets...`);

            for (const key of keys) {
                const assetUrl = SKYBOX_ASSETS[key] as string;
                const fileName = key.split('/').pop(); 
                if (!fileName) continue;

                const response = await fetch(assetUrl);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);

                const destPath = await join(tempDir, fileName);
                await writeFile(destPath, uint8Array);
            }

            setStatus('Installing to Roblox...');
            localStorage.setItem('activeSkyboxPath', tempDir);
            const result = await invoke('apply_skybox', { skyboxPath: tempDir });
            setStatus(result as string);

        } catch (e) {
            console.error(e);
            setStatus('Error: ' + String(e));
        } finally {
            setLoading(false);
        }
    };

    const installCustomSkybox = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                recursive: true
            });
            
            if (selected) {
                setLoading(true);
                const path = selected as string;
                setStatus(`Installing custom skybox from ${path}...`);
                localStorage.setItem('activeSkyboxPath', path);
                const result = await invoke('apply_skybox', { skyboxPath: path });
                setStatus(result as string);
            }
        } catch (e) {
            setStatus('Error: ' + String(e));
        } finally {
            setLoading(false);
        }
    };

    const handleApplySkybox = () => {
        if (selectedSkybox === 'custom') {
            installCustomSkybox();
        } else {
            installPredefinedSkybox(selectedSkybox);
        }
    };

    return (
        <>
            <Divider className="content-divider" />
            <List sx={{ mt: 2 }}>
                <ListItem>
                     <ListItemContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Typography level="body-md" className="option-header" sx={{ color: 'var(--text-primary)' }}>Skybox Manager</Typography>
                          <Typography level="body-sm" sx={{ mb: 1, color: 'var(--text-primary)' }}>
                              Select a skybox to apply to Roblox.
                          </Typography>
                          
                          <Stack direction="row" spacing={2} alignItems="center">
                              <Select 
                                value={selectedSkybox} 
                                onChange={(_e, v) => setSelectedSkybox(v as string)}
                                sx={{ 
                                    flex: 1,
                                    backgroundColor: 'var(--select-bg)',
                                    color: 'var(--text-primary)',
                                    borderColor: 'var(--select-border)',
                                    '&:hover': {
                                        backgroundColor: 'var(--select-bg-hover)'
                                    }
                                }}
                                slotProps={{
                                    listbox: { className: 'content-select-listbox' },
                                    button: { className: 'content-select-button', sx: { color: 'var(--text-primary)' } }
                                }}
                              >
                                  <Option value="default">Default</Option>
                                  <Option value="alya">Alya (Anime)</Option>
                                  <Option value="custom">Custom Folder...</Option>
                              </Select>
                              
                              <Button 
                                variant="solid" 
                                size="sm" 
                                onClick={handleApplySkybox}
                                loading={loading}
                                sx={{ backgroundColor: 'var(--splash-btn-bg)', color: 'var(--text-primary)' }}
                              >
                                  {selectedSkybox === 'custom' ? 'Browse & Apply' : 'Apply'}
                              </Button>
                          </Stack>

                          {status && (
                             <Alert color={status.startsWith('Error') ? 'danger' : 'success'} sx={{ mt: 1 }}>
                                 {status}
                             </Alert>
                          )}
                     </ListItemContent>
                </ListItem>
            </List>

            <Divider className="content-divider" sx={{ mt: 4 }} />
            <List sx={{ mt: 2 }}>
                <ListItem>
                     <ListItemContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography level="body-md" className="option-header" sx={{ color: 'var(--text-primary)' }}>Cleaner</Typography>
                          <Typography level="body-sm" sx={{ mb: 1, color: 'var(--text-primary)' }}>
                              Clean up cached files.
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                               <Switch 
                                    checked={cleanLogs} 
                                    onChange={(e) => setCleanLogs(e.target.checked)} 
                                    startDecorator={<Typography sx={{ color: 'var(--text-primary)' }}>Logs</Typography>}
                                    variant="soft"
                                />
                                <Switch 
                                    checked={cleanCache} 
                                    onChange={(e) => setCleanCache(e.target.checked)} 
                                    startDecorator={<Typography sx={{ color: 'var(--text-primary)' }}>Cache</Typography>}
                                    variant="soft"
                                />
                          </Box>
                          <Button 
                            variant="outlined" 
                            size="sm" 
                            onClick={handleClean} 
                            sx={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', mt: 1 }}
                          >
                            Run Cleaner
                          </Button>
                          {cleanerStatus && (
                             <Typography level="body-xs" sx={{ mt: 1, color: cleanerStatus.startsWith('Error') ? 'red' : 'green' }}>{cleanerStatus}</Typography>
                          )}
                     </ListItemContent>
                </ListItem>
            </List>

            {osType === 'linux' && (
                <>
                <Divider className="content-divider" sx={{ my: 3 }} />
                <Typography level="body-md" className="option-header" sx={{ color: 'var(--text-primary)', mb: 2 }}>Sober Settings</Typography>
                
                <Stack spacing={2} sx={{ mb: 2 }}>
                     <Button 
                        variant="solid" 
                        onClick={() => {
                            setStatus("Saving Sober settings...");
                            invoke('save_fast_flags', { flagsJson: JSON.stringify(soberSettings), mode: 'sober_main' })
                                .then(() => setStatus("Saved Sober settings!"))
                                .catch(e => setStatus("Error saving: " + e));
                        }}
                        sx={{ backgroundColor: 'var(--bg-titlebar)' }}
                    >
                        Save Configuration
                    </Button>
                </Stack>

                <List sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                     {Object.entries({
                        allow_gamepad_permission: { label: "Allow Gamepad", type: "boolean" },
                        close_on_leave: { label: "Close on Leave", type: "boolean" },
                        discord_rpc_enabled: { label: "Discord RPC", type: "boolean" },
                        discord_rpc_show_join_button: { label: "Discord: Show Join Button", type: "boolean" },
                        enable_gamemode: { label: "Enable Gamemode", type: "boolean" },
                        enable_hidpi: { label: "HiDPI Scaling", type: "boolean" },
                        server_location_indicator_enabled: { label: "Server Location Indicator", type: "boolean" },
                        touch_mode: { label: "Touch Mode", type: "select", options: ["off", "on", "fake-off"] },
                        use_console_experience: { label: "Console Experience", type: "boolean" },
                        use_libsecret: { label: "Use LibSecret", type: "boolean" },
                        use_opengl: { label: "Use OpenGL", type: "boolean" },
                        graphics_optimization_mode: { label: "Graphics Mode", type: "select", options: ["quality", "balanced", "performance"] }
                     }).map(([key, config]: [string, any]) => (
                         <ListItem key={key}>
                             <ListItemContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <Box>
                                     <Typography level="body-md" sx={{ color: 'var(--text-primary)' }}>{config.label}</Typography>
                                     <Typography level="body-xs" sx={{ opacity: 0.6, color: 'var(--text-primary)' }}>{key}</Typography>
                                 </Box>
                                 {config.type === 'boolean' ? (
                                    <Switch 
                                        checked={soberSettings[key] === true} 
                                        onChange={(e) => updateSoberSetting(key, e.target.checked)}
                                    />
                                 ) : (
                                     <Select 
                                         value={soberSettings[key]} 
                                         onChange={(_e, v) => updateSoberSetting(key, v)}
                                         sx={{ minWidth: 100 }}
                                     >
                                         {config.options.map((opt: string) => (
                                             <Option key={opt} value={opt}>{opt}</Option>
                                         ))}
                                     </Select>
                                 )}
                             </ListItemContent>
                         </ListItem>
                     ))}
                </List>
                </>
            )}
        </>
    );
}



