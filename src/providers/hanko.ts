import { Hanko as ImportedHanko } from "@teamhanko/hanko-frontend-sdk";

import type { AuthFlowName, AuthProvider, AuthState } from "../core/types";

type HankoInstance = {
  createState(flow: AuthFlowName): Promise<AuthState>;
  onSessionCreated(cb: () => void): void;
  setLang?(lang: string): void;
};

type HankoOptions = {
  lang?: string;
};

type HankoConstructor = new (apiUrl: string, options?: HankoOptions) => HankoInstance;

const Hanko = ImportedHanko as unknown as HankoConstructor;

export interface HankoProviderOptions {
  /**
   * Optional locale forwarded to the Hanko frontend SDK (e.g. "ru", "en").
   * Used so that backend-localized error messages come back in the right
   * language.
   */
  locale?: string;
}

/**
 * NOTE on browser console "POST .../login... 400 (Bad Request)" entries:
 *
 *   These are emitted by the browser itself whenever the underlying
 *   XMLHttpRequest used by `@teamhanko/hanko-frontend-sdk` finishes with a
 *   non-2xx status. They cannot be silenced from JavaScript — Chromium and
 *   Firefox always log XHR failures as part of their dev-tools behaviour.
 *
 *   Functionally these are not unhandled errors: AuthKit normalises them
 *   into the current AuthState and renders a localized message in the
 *   form. Suppressing them would require an HTTP-level proxy that always
 *   returns 200 with the error in the body, which is an integrator concern
 *   (e.g. an edge worker in front of the Hanko API).
 */
export class HankoProvider implements AuthProvider {
  private readonly apiUrl: string;
  private readonly hanko: HankoInstance;

  constructor(apiUrl: string, options: HankoProviderOptions | string = {}) {
    const opts: HankoProviderOptions =
      typeof options === "string" ? { locale: options } : options;

    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.hanko = new Hanko(this.apiUrl, opts.locale ? { lang: opts.locale } : undefined);
    if (opts.locale) {
      this.hanko.setLang?.(opts.locale);
    }
  }

  async init(flow: AuthFlowName): Promise<AuthState> {
    return this.hanko.createState(flow);
  }

  async logout(): Promise<void> {
    await fetch(this.apiUrl + "/logout", {
      method: "POST",
      credentials: "include",
      mode: "cors",
    });
  }

  onSessionCreated(cb: () => void): void {
    this.hanko.onSessionCreated(cb);
  }
}
