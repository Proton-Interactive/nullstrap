import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { CssVarsProvider } from '@mui/joy/styles';
import { theme as customTheme } from './theme';
import Button from '@mui/joy/Button';
import Stack from '@mui/joy/Stack';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { Titlebar } from './components/Titlebar';
import './style.css';

function useThemeSync() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'system'
  );

  useEffect(() => {
    const applyTheme = (t: string) => {
      const root = document.documentElement;
      if (t === 'system') {
        const systemDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches;
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
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
}

import { convertFileSrc } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';

function useBackgroundSync() {
  const [bgImage, setBgImage] = useState(() =>
    localStorage.getItem('backgroundImage')
  );
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem('splashBackground') === 'true'
  );
  const [bgOpacity, setBgOpacity] = useState(() =>
    parseFloat(localStorage.getItem('backgroundOpacity') || '0.1')
  );
  const [bgBlur, setBgBlur] = useState(() =>
    parseInt(localStorage.getItem('backgroundBlur') || '0')
  );
  const [bgBrightness, setBgBrightness] = useState(() =>
    parseInt(localStorage.getItem('backgroundBrightness') || '100')
  );
  const [bgContrast, setBgContrast] = useState(() =>
    parseInt(localStorage.getItem('backgroundContrast') || '100')
  );
  const [bgSaturation, setBgSaturation] = useState(() =>
    parseInt(localStorage.getItem('backgroundSaturation') || '100')
  );
  const [bgSize, setBgSize] = useState(
    () => localStorage.getItem('backgroundSize') || 'cover'
  );
  const [bgPosition, setBgPosition] = useState(
    () => localStorage.getItem('backgroundPosition') || 'center'
  );
  const [bgRotation, setBgRotation] = useState(() =>
    parseInt(localStorage.getItem('backgroundRotation') || '0')
  );
  const [resolvedBgImage, setResolvedBgImage] = useState<string | null>(null);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'backgroundImage') setBgImage(e.newValue);
      if (e.key === 'splashBackground') setEnabled(e.newValue === 'true');
      if (e.key === 'backgroundOpacity' && e.newValue)
        setBgOpacity(parseFloat(e.newValue));
      if (e.key === 'backgroundBlur' && e.newValue)
        setBgBlur(parseInt(e.newValue));
      if (e.key === 'backgroundBrightness' && e.newValue)
        setBgBrightness(parseInt(e.newValue));
      if (e.key === 'backgroundContrast' && e.newValue)
        setBgContrast(parseInt(e.newValue));
      if (e.key === 'backgroundSaturation' && e.newValue)
        setBgSaturation(parseInt(e.newValue));
      if (e.key === 'backgroundSize' && e.newValue) setBgSize(e.newValue);
      if (e.key === 'backgroundPosition' && e.newValue)
        setBgPosition(e.newValue);
      if (e.key === 'backgroundRotation' && e.newValue)
        setBgRotation(parseInt(e.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    let urlToRevoke: string | null = null;
    let active = true;

    const loadBg = async () => {
      if (!bgImage || !enabled) {
        if (active) setResolvedBgImage(null);
        return;
      }

      if (bgImage.startsWith('http://') || bgImage.startsWith('https://')) {
        if (active) setResolvedBgImage(bgImage);
        return;
      }

      try {
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
        if (active) setResolvedBgImage(convertFileSrc(bgImage));
      }
    };

    loadBg();

    return () => {
      active = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [bgImage, enabled]);

  useEffect(() => {
    const bgId = 'splash-custom-bg';
    let bgEl = document.getElementById(bgId);

    if (resolvedBgImage && enabled) {
      if (!bgEl) {
        bgEl = document.createElement('div');
        bgEl.id = bgId;
        bgEl.style.position = 'fixed';
        bgEl.style.top = '0';
        bgEl.style.left = '0';
        bgEl.style.right = '0';
        bgEl.style.bottom = '0';
        bgEl.style.zIndex = '-1';
        bgEl.style.pointerEvents = 'none';
        bgEl.style.transition = 'all 0.3s ease';
        document.body.appendChild(bgEl);
        document.body.style.backgroundImage = 'none';
      }

      bgEl.style.backgroundImage = `url("${resolvedBgImage}")`;
      bgEl.style.backgroundSize = bgSize;
      bgEl.style.backgroundPosition = bgPosition;
      bgEl.style.backgroundRepeat = 'no-repeat';
      bgEl.style.transform = `rotate(${bgRotation}deg) scale(${bgRotation !== 0 ? 1.5 : 1})`;
      bgEl.style.opacity = String(bgOpacity);
      bgEl.style.filter = `blur(${bgBlur}px) brightness(${bgBrightness}%) contrast(${bgContrast}%) saturate(${bgSaturation}%)`;
    } else {
      if (bgEl) bgEl.remove();
      document.body.style.backgroundImage = 'url(/src/assets/misa.png)';
    }
  }, [
    resolvedBgImage,
    enabled,
    bgOpacity,
    bgBlur,
    bgBrightness,
    bgContrast,
    bgSaturation,
    bgSize,
    bgPosition,
    bgRotation,
  ]);
}

const renderButtonSx = (width: string | number) => ({
  width,
});

export function LaunchRoblox() {
  return (
    <Button
      variant="soft"
      className="splash-btn"
      sx={renderButtonSx('220px')}
      onClick={() => {
        console.debug('LaunchRoblox clicked');
        const flags = localStorage.getItem('fastFlags_roblox') || '{}';
        const skybox = localStorage.getItem('activeSkyboxPath') || '';
        invoke('launch_roblox', { flagsJson: flags, skyboxPath: skybox }).catch(
          () => console.error('launch_roblox failed')
        );
      }}
    >
      <span
        style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.5px' }}
      >
        Launch Roblox
      </span>
    </Button>
  );
}

export function LaunchStudio() {
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

  if (currentPlatform === 'macos') {
    return null;
  }

  return (
    <Button
      variant="soft"
      className="splash-btn"
      sx={renderButtonSx('108px')}
      onClick={() => {
        console.debug('LaunchStudio clicked');
        invoke('launch_studio').catch((err) =>
          console.error('launch_studio failed:', err)
        );
      }}
    >
      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Studio</span>
    </Button>
  );
}

export function OpenSettings() {
  const handleClick = async () => {
    console.debug(
      'settings clicked - attempting to open main window via invoke'
    );
    try {
      await invoke('open_main_window');
    } catch (error) {
      console.error('failed to open main window via invoke:', error);
    }
  };

  return (
    <Button
      variant="soft"
      className="splash-btn"
      sx={renderButtonSx('108px')}
      onClick={handleClick}
    >
      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Settings</span>
    </Button>
  );
}

function SplashApp() {
  useThemeSync();
  useBackgroundSync();

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.classList.add('splash-window');
  }, []);

  return (
    <CssVarsProvider theme={customTheme}>
      <Titlebar showTitle={false} />
      <div id="splash-app">
        <Stack spacing={0.5} sx={{ alignItems: 'center', gap: '4px' }}>
          <LaunchRoblox />
          <Stack direction="row" spacing={0.5} sx={{ gap: '4px' }}>
            <OpenSettings />
            <LaunchStudio />
          </Stack>
        </Stack>
      </div>
    </CssVarsProvider>
  );
}

const container = document.getElementById('root');
if (!container) {
  console.error('could not find #root container for splash renderer');
} else {
  document.body.classList.add('splash-window');
  document.body.style.backgroundImage = 'url(/src/assets/misa.png)';
  const globalAny = window as any;
  let rootInstance = globalAny.__NULLSTRAP_SPLASH_ROOT as
    | import('react-dom/client').Root
    | undefined;

  if (!rootInstance) {
    rootInstance = ReactDOM.createRoot(container);
    globalAny.__NULLSTRAP_SPLASH_ROOT = rootInstance;
  }

  rootInstance.render(
    <React.StrictMode>
      <SplashApp />
    </React.StrictMode>
  );
}
