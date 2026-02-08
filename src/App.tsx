import { useEffect, useState, useCallback } from 'react';
import { Snowfall } from './Snowfall';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { Box, Button, Stack } from '@mui/joy';
import { CssVarsProvider } from '@mui/joy/styles';
import { theme as customTheme } from './theme';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import Integrations from './components/tabs/Integrations';
import Mods from './components/tabs/Mods';
import FastFlags from './components/tabs/FastFlags';
import Appearance from './components/tabs/Appearance';
import About from './components/tabs/About';
import { launchRoblox } from './utils/launcher';



function initLayout(): void {
  try {
    document.body.style.margin = '0';
  } catch {}

  const titlebar = document.querySelector('.titlebar') as HTMLElement | null;
  if (titlebar) {
    titlebar.style.position = 'fixed';
    titlebar.style.top = '0';
    titlebar.style.left = '0';
    titlebar.style.right = '0';
    titlebar.style.zIndex = '9999';
    titlebar.style.boxSizing = 'border-box';
  }

  const root = document.getElementById('root');
  if (root) {
    const offset = titlebar ? `${titlebar.offsetHeight}px` : '36px';
    root.style.paddingTop = offset;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('Integrations');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [snowfallEnabled, setSnowfallEnabled] = useState<boolean>(() => localStorage.getItem('snowfall') === 'true');
  const [rememberWindowSize, setRememberWindowSize] = useState<boolean>(() => localStorage.getItem('rememberWindowSize') === 'true');
  
  // background state
  const [bgImage, setBgImage] = useState(() => localStorage.getItem('backgroundImage'));
  const [bgOpacity, setBgOpacity] = useState(() => parseFloat(localStorage.getItem('backgroundOpacity') || '0.1'));
  const [bgBlur, setBgBlur] = useState(() => parseInt(localStorage.getItem('backgroundBlur') || '0'));
  const [bgBrightness, setBgBrightness] = useState(() => parseInt(localStorage.getItem('backgroundBrightness') || '100'));
  const [bgContrast, setBgContrast] = useState(() => parseInt(localStorage.getItem('backgroundContrast') || '100'));
  const [bgSaturation, setBgSaturation] = useState(() => parseInt(localStorage.getItem('backgroundSaturation') || '100'));
  const [bgSize, setBgSize] = useState(() => localStorage.getItem('backgroundSize') || 'cover');
  const [bgPosition, setBgPosition] = useState(() => localStorage.getItem('backgroundPosition') || 'center');
  const [bgRotation, setBgRotation] = useState(() => parseInt(localStorage.getItem('backgroundRotation') || '0'));
  
  const [resolvedBgImage, setResolvedBgImage] = useState<string | null>(null);

  const [saveHandler, setSaveHandler] = useState<(() => void | Promise<void>) | null>(null);

  const registerSave = useCallback((handler: () => void | Promise<void>) => {
      setSaveHandler(() => handler);
  }, []);

  const unregisterSave = useCallback(() => {
    setSaveHandler(null);
  }, []);

  const handleLaunch = async () => {
      try {
          await launchRoblox();
      } catch (e) {
          console.error("Failed to launch:", e);
      }
  };

  const handleSave = async () => {
      if (saveHandler) {
          await saveHandler();
      }
  };

  const handleSaveAndLaunch = async () => {
      if (saveHandler) {
          await saveHandler();
      }
      await handleLaunch();
  };

  const handleClose = () => {
      getCurrentWindow().close();
  };

  useEffect(() => {
    let urlToRevoke: string | null = null;
    let active = true;

    const loadBg = async () => {
        if (!bgImage) {
             if (active) setResolvedBgImage(null);
             return;
        }
        
        // Check for web URL
        if (bgImage.startsWith('http://') || bgImage.startsWith('https://')) {
            if (active) setResolvedBgImage(bgImage);
            return;
        }

        try {
            // Try reading as local file first to bypass asset protocol issues
            // This requires fs:allow-read permission
            const data = await readFile(bgImage);
            
            const ext = bgImage.split('.').pop()?.toLowerCase();
            let mime = 'image/jpeg';
            if (ext === 'png') mime = 'image/png';
            if (ext === 'gif') mime = 'image/gif';
            if (ext === 'webp') mime = 'image/webp';
            
            const blob = new Blob([data], { type: mime });
            const url = URL.createObjectURL(blob);
            urlToRevoke = url;
            if (active) setResolvedBgImage(url);
        } catch (e) {
            console.warn("Direct file read failed, falling back to convertFileSrc:", e);
            if (active) setResolvedBgImage(convertFileSrc(bgImage));
        }
    };

    loadBg();

    return () => {
        active = false;
        if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [bgImage]);

  const handleSetSnowfallEnabled = (v: boolean) => {
    setSnowfallEnabled(v);
    try {
      localStorage.setItem('snowfall', v ? 'true' : 'false');
    } catch (e) {}
  };

  const handleSetRememberWindowSize = async (v: boolean) => {
    setRememberWindowSize(v);
    try {
      localStorage.setItem('rememberWindowSize', v ? 'true' : 'false');
    } catch (e) {}

    try {
      if (v) {
        const w = getCurrentWindow();
        const s = await w.innerSize();
        localStorage.setItem('savedWindowSize', JSON.stringify({ width: s.width, height: s.height }));
      } else {
        localStorage.removeItem('savedWindowSize');
      }
    } catch (err) {
      console.warn('remember window size toggle handler failed', err);
    }
  };

  useEffect(() => {
    if (theme !== localStorage.getItem('theme')) {
      localStorage.setItem('theme', theme);
    }

    const applyTheme = (t: string) => {
      const root = document.documentElement;
      if (t === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', systemDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', t);
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) {
        setTheme(e.newValue);
      }
      if (e.key === 'snowfall' && e.newValue) {
        setSnowfallEnabled(e.newValue === 'true');
      }
      if (e.key === 'rememberWindowSize' && e.newValue) {
        setRememberWindowSize(e.newValue === 'true');
      }
      
      // sync background settings from storage events
      if (e.key === 'backgroundImage') setBgImage(e.newValue);
      if (e.key === 'backgroundOpacity' && e.newValue) setBgOpacity(parseFloat(e.newValue));
      if (e.key === 'backgroundBlur' && e.newValue) setBgBlur(parseInt(e.newValue));
      if (e.key === 'backgroundBrightness' && e.newValue) setBgBrightness(parseInt(e.newValue));
      if (e.key === 'backgroundContrast' && e.newValue) setBgContrast(parseInt(e.newValue));
      if (e.key === 'backgroundSaturation' && e.newValue) setBgSaturation(parseInt(e.newValue));
      if (e.key === 'backgroundSize' && e.newValue) setBgSize(e.newValue);
      if (e.key === 'backgroundPosition' && e.newValue) setBgPosition(e.newValue);
      if (e.key === 'backgroundRotation' && e.newValue) setBgRotation(parseInt(e.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    try {
      initLayout();
    } catch (e) {}

    document.body.classList.add('main-window');

    // clean up body style background if it exists from previous versions
    document.body.style.backgroundImage = '';

    // apply saved window size if the user has enabled the preference
    try {
      const remember = localStorage.getItem('rememberWindowSize') === 'true';
      const raw = localStorage.getItem('savedWindowSize');
      if (remember && raw) {
        try {
          const parsed = JSON.parse(raw);
          const w = getCurrentWindow();
          if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
            w.setSize(new LogicalSize(parsed.width, parsed.height));
            console.debug('applied saved window size', parsed);
          }
        } catch (e) {
          console.warn('failed to apply saved window size', e);
        }
      }
    } catch (e) {}
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'Integrations':
        return <Integrations />;
      case 'Mods':
        return <Mods />;
      case 'FastFlags':
        return <FastFlags registerSave={registerSave} unregisterSave={unregisterSave} />;
      case 'Appearance':
        return <Appearance 
          theme={theme} 
          setTheme={setTheme} 
          snowEnabled={snowfallEnabled} 
          setSnowEnabled={handleSetSnowfallEnabled} 
          rememberWindowSize={rememberWindowSize} 
          setRememberWindowSize={handleSetRememberWindowSize}
          
          bgImage={bgImage} setBgImage={(v) => { setBgImage(v); if(v) localStorage.setItem('backgroundImage', v); else localStorage.removeItem('backgroundImage'); }}
          bgOpacity={bgOpacity} setBgOpacity={(v) => { setBgOpacity(v); localStorage.setItem('backgroundOpacity', String(v)); }}
          bgBlur={bgBlur} setBgBlur={(v) => { setBgBlur(v); localStorage.setItem('backgroundBlur', String(v)); }}
          bgBrightness={bgBrightness} setBgBrightness={(v) => { setBgBrightness(v); localStorage.setItem('backgroundBrightness', String(v)); }}
          bgContrast={bgContrast} setBgContrast={(v) => { setBgContrast(v); localStorage.setItem('backgroundContrast', String(v)); }}
          bgSaturation={bgSaturation} setBgSaturation={(v) => { setBgSaturation(v); localStorage.setItem('backgroundSaturation', String(v)); }}
          bgSize={bgSize} setBgSize={(v) => { setBgSize(v); localStorage.setItem('backgroundSize', v); }}
          bgPosition={bgPosition} setBgPosition={(v) => { setBgPosition(v); localStorage.setItem('backgroundPosition', v); }}
          bgRotation={bgRotation} setBgRotation={(v) => { setBgRotation(v); localStorage.setItem('backgroundRotation', String(v)); }}
        />;
      case 'About':
        return <About />;
      default:
        return null;
    }
  };

  return (
    <CssVarsProvider theme={customTheme}>
      <Snowfall enabled={snowfallEnabled} />
      {resolvedBgImage && (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url("${resolvedBgImage}")`,
                backgroundSize: bgSize,
                backgroundPosition: bgPosition,
                backgroundRepeat: 'no-repeat',
                transform: `rotate(${bgRotation}deg) scale(${bgRotation !== 0 ? 1.5 : 1})`, // Scale up if rotated to cover edges
                opacity: bgOpacity,
                filter: `blur(${bgBlur}px) brightness(${bgBrightness}%) contrast(${bgContrast}%) saturate(${bgSaturation}%)`,
                zIndex: -1,
                pointerEvents: 'none',
                transition: 'all 0.3s ease'
            }}
        />
      )}
      <Titlebar showTitle={false} />
      <Box className="main-container" sx={{ flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <Box className="content-area" sx={{ flex: 1, overflowY: 'auto' }}>
                {renderContent()}
            </Box>
        </Box>
        <Box 
            className="footer" 
            sx={{ 
                p: 2, 
                borderTop: '1px solid var(--border-color)', 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: 1,
                backgroundColor: 'var(--bg-content)',
                backdropFilter: 'blur(10px)',
                zIndex: 10
            }}
        >
            <Button onClick={handleSave} disabled={!saveHandler} variant="outlined" color="neutral">Save</Button>
            <Button onClick={handleSaveAndLaunch} variant="solid" color="primary">Save and Launch</Button>
            <Button onClick={handleClose} variant="plain" color="danger">Close</Button>
        </Box>
      </Box>
    </CssVarsProvider>
  );
}

export default App;
