import { initializeLogging } from "./modules/utils/logger";
import { initializeUI } from "./modules/ui";
import { setupFastFlagsUI } from "./modules/roblox/fastflags";
import { setupSkyboxUI } from "./modules/roblox/skybox";
import { setupLauncherUI } from "./modules/roblox/launcher";
import { setupSettingsUI } from "./modules/settings";
import { setupSwiftTunnelUI } from "./modules/integrations/swifttunnel";

// init everything
(async () => {
  await initializeLogging();
  await initializeUI();

  setupFastFlagsUI();
  await setupSkyboxUI();
  setupLauncherUI();
  setupSettingsUI();
  setupSwiftTunnelUI();
})();
