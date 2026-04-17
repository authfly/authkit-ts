import { AuthDOMController } from "./core/dom";
import { AuthFlow } from "./core/flow";
import { HankoProvider } from "./providers/hanko";

export * from "./index";

function bootstrap(): void {
  const config = AuthDOMController.readConfig();
  if (!config?.apiUrl) {
    return;
  }

  const provider = new HankoProvider(config.apiUrl, { locale: config.locale });
  const flow = new AuthFlow(provider, config);
  const controller = new AuthDOMController(flow);

  void controller.mount().catch(() => {
    // The controller already renders a user-facing error state.
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bootstrap();
}
