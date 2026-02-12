import { List, ListItem, ListItemContent, Switch, Typography, Select, Option, Divider, Button, Stack, Box, Slider, FormLabel, Input } from '@mui/joy';
import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';

type Props = { 
    theme: string; 
    setTheme: (t: string) => void; 
    snowEnabled: boolean; 
    setSnowEnabled: (b: boolean) => void; 
    rememberWindowSize: boolean; 
    setRememberWindowSize: (b: boolean) => void;

    bgImage: string | null;
    setBgImage: (v: string | null) => void;
    bgOpacity: number;
    setBgOpacity: (v: number) => void;
    bgBlur: number;
    setBgBlur: (v: number) => void;
    bgBrightness: number;
    setBgBrightness: (v: number) => void;
    bgContrast: number;
    setBgContrast: (v: number) => void;
    bgSaturation: number;
    setBgSaturation: (v: number) => void;
    bgSize: string;
    setBgSize: (v: string) => void;
    bgPosition: string;
    setBgPosition: (v: string) => void;
    bgRotation: number;
    setBgRotation: (v: number) => void;
};

export default function Appearance({ 
    theme, setTheme, 
    snowEnabled, setSnowEnabled, 
    rememberWindowSize, setRememberWindowSize,
    bgImage, setBgImage,
    bgOpacity, setBgOpacity,
    bgBlur, setBgBlur,
    bgBrightness, setBgBrightness,
    bgContrast, setBgContrast,
    bgSaturation, setBgSaturation,
    bgSize, setBgSize,
    bgPosition, setBgPosition,
    bgRotation, setBgRotation
}: Props) {
    const [splashBgEnabled, setSplashBgEnabled] = useState(() => localStorage.getItem('splashBackground') === 'true');

    const handlePickImage = async () => {
        try {
            const file = await open({
                multiple: false,
                filters: [{
                    name: 'Image',
                    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
                }]
            });
            if (file) {
                const path = file as string; 
                setBgImage(path);
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    const handleClearImage = () => {
        setBgImage(null);
    };

    return (
    <>
    <Divider className="content-divider" />
        <List sx={{ mt: 2, bgcolor: 'transparent' }}>
            <ListItem>
                <ListItemContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography level="body-md" className="option-header" sx={{ color: 'var(--text-primary)' }}>Theme</Typography>
                        <Select
                            value={theme}
                            onChange={(_e, val) => setTheme(val as string)}
                            className="content-select"
                            slotProps={{
                                listbox: { className: 'content-select-listbox' },
                                button: { className: 'content-select-button' },
                        }}
                        >
                            <Option value="system">System</Option>
                            <Option value="dark">Dark</Option>
                            <Option value="light">Light</Option>
                        </Select>
                    </ListItemContent>
                </ListItem>
                
                <Divider className="content-divider" style={{ marginTop: 8 }} />
                
                <ListItem sx={{ bgcolor: 'transparent' }}>
                     <Typography level="body-md" className="option-header" marginTop={"5px"} sx={{ color: 'var(--text-primary)' }}>Appearance</Typography>
                </ListItem>

                <ListItem>
                     <ListItemContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography level="body-md" sx={{ color: 'var(--text-primary)' }}>Snowfall</Typography>
                            <Typography level="body-xs" sx={{ opacity: 0.6, color: 'var(--text-primary)' }}>Enable winter effect</Typography>
                        </Box>
                        <Switch 
                            checked={snowEnabled} 
                            onChange={(e) => setSnowEnabled(e.target.checked)} 
                            variant="soft"
                        />
                     </ListItemContent>
                </ListItem>

                <ListItem>
                     <ListItemContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography level="body-md" sx={{ color: 'var(--text-primary)' }}>Remember Window Size</Typography>
                            <Typography level="body-xs" sx={{ opacity: 0.6, color: 'var(--text-primary)' }}>Save dimensions on exit</Typography>
                        </Box>
                        <Switch 
                            checked={rememberWindowSize} 
                            onChange={(e) => setRememberWindowSize(e.target.checked)} 
                            variant="soft"
                        />
                     </ListItemContent>
                </ListItem>
                
                <Divider className="content-divider" style={{ marginTop: 8 }} />
                
                <ListItem>
                     <Typography level="body-md" className="option-header" marginTop={"5px"} sx={{ color: 'var(--text-primary)' }}>Background Image</Typography>
                </ListItem>

                <ListItem>
                    <ListItemContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                         <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                            <Input 
                                placeholder="Image URL or Path" 
                                value={bgImage || ''} 
                                onChange={(e) => setBgImage(e.target.value)} 
                                variant="outlined"
                                size="sm"
                                sx={{ 
                                    flex: 1, 
                                    backgroundColor: 'transparent', 
                                    color: 'var(--text-primary)', 
                                    borderColor: 'var(--border-color)',
                                    '--Input-placeholderOpacity': 0.5,
                                    '& input': { color: 'var(--text-primary)', minWidth: 0 } 
                                }} 
                            />
                            <Button variant="outlined" onClick={handlePickImage} size="sm" sx={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                                Select
                            </Button>
                            {bgImage && (
                                <Button variant="plain" color="danger" onClick={handleClearImage} size="sm">
                                    Clear
                                </Button>
                            )}
                        </Stack>
                        
                        <Stack spacing={2} sx={{ mt: 1, p: 2, border: '1px solid var(--border-color)', borderRadius: 'md', bgcolor: 'transparent' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography level="body-xs" sx={{ color: 'var(--text-primary)' }}>Enable in Splash Screen</Typography>
                                <Switch 
                                    checked={splashBgEnabled} 
                                    onChange={(e) => {
                                        const newValue = e.target.checked;
                                        setSplashBgEnabled(newValue);
                                        localStorage.setItem('splashBackground', newValue ? 'true' : 'false');
                                        window.dispatchEvent(new StorageEvent('storage', { key: 'splashBackground', newValue: newValue ? 'true' : 'false' }));
                                    }}
                                    size="sm"
                                    variant="soft"
                                />
                            </Box>

                            <Box>
                                <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Opacity ({Math.round(bgOpacity * 100)}%)</FormLabel>
                                <Slider 
                                    value={bgOpacity} 
                                    min={0} max={1} step={0.01} 
                                    onChange={(_, v) => setBgOpacity(v as number)} 
                                    size="sm"
                                />
                            </Box>

                            <Box>
                                <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Blur ({bgBlur}px)</FormLabel>
                                <Slider 
                                    value={bgBlur} 
                                    min={0} max={40} step={1} 
                                    onChange={(_, v) => setBgBlur(v as number)} 
                                    size="sm" 
                                />
                            </Box>

                            <Stack direction="row" spacing={2}>
                                <Box sx={{ flex: 1 }}>
                                    <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Brightness ({bgBrightness}%)</FormLabel>
                                    <Slider value={bgBrightness} min={0} max={200} onChange={(_, v) => setBgBrightness(v as number)} size="sm" />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Contrast ({bgContrast}%)</FormLabel>
                                    <Slider value={bgContrast} min={0} max={200} onChange={(_, v) => setBgContrast(v as number)} size="sm" />
                                </Box>
                            </Stack>

                            <Stack direction="row" spacing={2}>
                                <Box sx={{ flex: 1 }}>
                                    <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Saturation ({bgSaturation}%)</FormLabel>
                                    <Slider value={bgSaturation} min={0} max={200} onChange={(_, v) => setBgSaturation(v as number)} size="sm" />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Rotation ({bgRotation}°)</FormLabel>
                                    <Slider value={bgRotation} min={0} max={360} onChange={(_, v) => setBgRotation(v as number)} size="sm" />
                                </Box>
                            </Stack>

                            <Stack direction="row" spacing={2}>
                                <Box sx={{ flex: 1 }}>
                                    <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Size Mode</FormLabel>
                                    <Select 
                                        value={bgSize} 
                                        onChange={(_, v) => setBgSize(v as string)} 
                                        size="sm" 
                                        variant="outlined"
                                        sx={{
                                            backgroundColor: 'transparent',
                                            color: 'var(--text-primary)',
                                            borderColor: 'var(--border-color)',
                                            '&:hover': {
                                                borderColor: 'var(--text-primary)',
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                            }
                                        }}
                                        slotProps={{ 
                                            listbox: { className: 'content-select-listbox' }, 
                                            button: { className: 'content-select-button', sx: { color: 'var(--text-primary)' } } 
                                        }}
                                    >
                                        <Option value="cover">Cover</Option>
                                        <Option value="contain">Contain</Option>
                                        <Option value="auto">Auto</Option>
                                        <Option value="100% 100%">Stretch</Option>
                                    </Select>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <FormLabel sx={{ color: 'var(--text-primary)', fontSize: 'xs', mb: 0.5 }}>Position</FormLabel>
                                    <Select 
                                        value={bgPosition} 
                                        onChange={(_, v) => setBgPosition(v as string)} 
                                        size="sm" 
                                        variant="outlined"
                                        sx={{
                                            backgroundColor: 'transparent',
                                            color: 'var(--text-primary)',
                                            borderColor: 'var(--border-color)',
                                            '&:hover': {
                                                borderColor: 'var(--text-primary)',
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                            }
                                        }}
                                        slotProps={{ 
                                            listbox: { className: 'content-select-listbox' }, 
                                            button: { className: 'content-select-button', sx: { color: 'var(--text-primary)' } } 
                                        }}
                                    >
                                        <Option value="center">Center</Option>
                                        <Option value="bottom">Top</Option>
                                        <Option value="top">Bottom</Option>
                                        <Option value="left">Left</Option>
                                        <Option value="right">Right</Option>
                                        <Option value="top left">Top Left</Option>
                                        <Option value="top right">Top Right</Option>
                                        <Option value="bottom left">Bottom Left</Option>
                                        <Option value="bottom right">Bottom Right</Option>
                                    </Select>
                                </Box>
                            </Stack>
                        </Stack>
                    </ListItemContent>
                </ListItem>
        </List>
    </>
    );    
}


