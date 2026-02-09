import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logo from '../assets/logo.png';

interface TitlebarProps {
    showTitle?: boolean;
}

export function Titlebar({ showTitle = true }: TitlebarProps) {
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const w = getCurrentWindow();
      await w.minimize();
    } catch (err) {
      console.error('Titlebar minimize failed', err);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const w = getCurrentWindow();
      await w.toggleMaximize();
    } catch (err) {
      console.error('Titlebar maximize failed', err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const w = getCurrentWindow();

      const remember = localStorage.getItem('rememberWindowSize') === 'true';
      if (remember) {
        try {
          const s = await w.innerSize();
          localStorage.setItem('savedWindowSize', JSON.stringify({ width: s.width, height: s.height }));
          console.debug('titlebar: saved window size before hide');
        } catch (saveErr) {
          console.warn('titlebar: failed to save window size', saveErr);
        }
      }

      try {
        await w.hide();
        console.debug('titlebar: window hidden');
      } catch (hideErr) {
        console.warn('titlebar: hide() failed, attempting close()', hideErr);
        try {
          await w.close();
        } catch (closeErr) {
          console.error('Titlebar: close() failed', closeErr);
        }
      }
    } catch (err) {
      console.error('Titlebar close handler failed', err);
    }
  };

  return (
    <div className="titlebar" role="toolbar">
      <div data-tauri-drag-region className="drag-region">
        <div className="title-content" data-tauri-drag-region style={{ pointerEvents: 'none' }}>
            <img src={logo} alt="logo" className="window-icon" />
            {showTitle && <span className="window-title">nullstrap</span>}
        </div>
      </div>
      <div className="controls">
        <button
          className="tb-btn"
          title="Minimize"
          aria-label="Minimize"
          onClick={handleMinimize}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 13H5v-2h14z" />
          </svg>
        </button>
        <button
          className="tb-btn"
          title="Maximize"
          aria-label="Maximize"
          onClick={handleMaximize}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M3 3h18v18H3V3zm2 2v14h14V5H5z" />
          </svg>
        </button>
        <button
          className="tb-btn close"
          title="Close"
          aria-label="Close"
          onClick={handleClose}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M13.46 12L19 17.54V19h-1.46L12 13.46L6.46 19H5v-1.46L10.54 12L5 6.46V5h1.46L12 10.54L17.54 5H19v1.46z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
