import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import "./style.css";

interface ProgressPayload {
  status: string;
  percent: number;
}

const App = () => {
  const [status, setStatus] = useState("Initializing...");
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const unlistenUpdate = listen<ProgressPayload>("progress-update", (event) => {
      setStatus(event.payload.status);
      setPercent(event.payload.percent);
    });

    const unlistenClose = listen("progress-close", () => {
      getCurrentWindow().close();
    });

    return () => {
      unlistenUpdate.then((f) => f());
      unlistenClose.then((f) => f());
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        padding: "20px",
        boxSizing: "border-box",
        justifyContent: "center",
        backgroundColor: "var(--bg-body)",
        userSelect: "none",
        cursor: "default",
        border: "1px solid var(--border-color)",
      }}
      data-tauri-drag-region
    >
      <div style={{ marginBottom: "10px", fontSize: "14px", fontWeight: 600 }}>
        {status}
      </div>
      <div
        style={{
          width: "100%",
          height: "8px",
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            backgroundColor: "#fe968d",
            transition: "width 0.2s ease",
          }}
        />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
