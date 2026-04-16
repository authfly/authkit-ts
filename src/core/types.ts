export type AuthFlowName = "login" | "register";

export interface AuthInput {
  name: string;
  type: string;
}

export interface AuthAction {
  enabled: boolean;
  inputs?: Record<string, AuthInput>;
  run(data?: Record<string, string>): Promise<AuthState>;
}

export interface AuthState {
  name: string;
  actions: Record<string, AuthAction>;
  error_message?: string;
  payload?: Record<string, unknown>;
}

export interface AuthProvider {
  init(flow: AuthFlowName): Promise<AuthState>;
  logout(): Promise<void>;
  onSessionCreated(cb: () => void): void;
}

export interface AuthFeatures {
  allowPublicRegistration?: boolean;
  allowOIDCRegistration?: boolean;
  allowSAMLRegistration?: boolean;
}

export interface AuthConfig {
  apiUrl: string;
  locale?: string;
  features?: AuthFeatures;
  logoutPath?: string;
  successRedirect?: string;
}
