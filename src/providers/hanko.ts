import { Hanko as ImportedHanko } from "@teamhanko/hanko-frontend-sdk";

import type { AuthFlowName, AuthProvider, AuthState } from "../core/types";

type HankoInstance = {
  createState(flow: AuthFlowName): Promise<AuthState>;
  onSessionCreated(cb: () => void): void;
};

type HankoConstructor = new (apiUrl: string) => HankoInstance;

const Hanko = ImportedHanko as unknown as HankoConstructor;

export class HankoProvider implements AuthProvider {
  private readonly apiUrl: string;
  private readonly hanko: HankoInstance;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.hanko = new Hanko(this.apiUrl);
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
