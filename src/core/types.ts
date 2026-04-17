export type AuthFlowName = "login" | "register";

export interface AuthError {
  code: string;
  message: string;
  cause?: string;
}

export interface AuthInput {
  name: string;
  type: string;
  error?: AuthError;
}

export interface AuthAction {
  enabled: boolean;
  inputs?: Record<string, AuthInput>;
  run(data?: Record<string, string>): Promise<AuthState>;
}

export interface AuthState {
  name: string;
  actions: Record<string, AuthAction>;
  error?: AuthError;
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

/**
 * AuthErrorCatalog maps Hanko-style error codes (and per-state-name overrides)
 * to user-facing messages. Used by the flow normalizer and the DOM controller
 * to render meaningful error text instead of generic SDK strings such as
 * "Form data invalid".
 *
 * Resolution order at runtime:
 *   byStateCode[stateName][errorCode]  ←  (most specific)
 *   byCode[errorCode]
 *   fallback
 */
export interface AuthErrorCatalog {
  fallback?: string;
  byCode?: Record<string, string>;
  byStateCode?: Record<string, Record<string, string>>;
}

export interface AuthErrorContext {
  fallback?: string;
}

export interface AuthConfig {
  apiUrl: string;
  locale?: string;
  features?: AuthFeatures;
  logoutPath?: string;
  successRedirect?: string;
  /**
   * Optional override layered on top of the built-in localized catalog
   * (selected by `locale`). Use it to add brand-specific copy without
   * forking the SDK.
   */
  errorCatalog?: AuthErrorCatalog;
}
