import { resolveCatalog, resolveError, type ResolvedError } from "./errors";
import type {
  AuthAction,
  AuthConfig,
  AuthErrorCatalog,
  AuthFlowName,
  AuthInput,
  AuthProvider,
  AuthState,
} from "./types";

function getLoginIdentifierAction(state: AuthState | null): AuthAction | null {
  if (!state) {
    return null;
  }
  return state.actions.continue_with_login_identifier ?? null;
}

function getLoginIdentifierInput(action: AuthAction | null): AuthInput | null {
  if (!action?.inputs) {
    return null;
  }
  return action.inputs.email ?? action.inputs.username ?? action.inputs.identifier ?? null;
}

export class AuthFlow {
  private readonly provider: AuthProvider;
  private readonly config: AuthConfig;
  private readonly catalog: AuthErrorCatalog;
  private currentState: AuthState | null = null;
  private currentFlow: AuthFlowName = "login";

  constructor(provider: AuthProvider, config: AuthConfig) {
    this.provider = provider;
    this.config = config;
    this.catalog = resolveCatalog(config.locale, config.errorCatalog);
  }

  async start(flow: AuthFlowName = "login"): Promise<AuthState> {
    this.currentFlow = flow;
    const state = await this.provider.init(flow);
    return this.setState(await this.advanceState(state));
  }

  /**
   * Re-create a fresh flow state, optionally preserving the previous
   * resolved error_message so the form can show it after recovery.
   */
  async restart(options: { preserveError?: boolean } = {}): Promise<AuthState> {
    const previousError = options.preserveError
      ? (this.currentState?.error_message ?? this.resolveError()?.message)
      : undefined;
    const state = await this.provider.init(this.currentFlow);
    const next = await this.advanceState(state);
    if (previousError) {
      next.error_message = previousError;
    }
    return this.setState(next);
  }

  getConfig(): AuthConfig {
    return this.config;
  }

  getCatalog(): AuthErrorCatalog {
    return this.catalog;
  }

  /**
   * Resolves the most user-friendly message for the current state, preferring
   * input-level errors with non-generic codes, then state-level errors, then
   * catalog lookups.
   */
  resolveError(): ResolvedError | null {
    return resolveError(this.currentState, this.catalog);
  }

  onSessionCreated(cb: () => void): void {
    this.provider.onSessionCreated(cb);
  }

  getState(): AuthState | null {
    return this.currentState;
  }

  async submitIdentifier(value: string): Promise<AuthState> {
    const action = getLoginIdentifierAction(this.currentState);
    const input = getLoginIdentifierInput(action);

    if (!action?.enabled || !input) {
      throw new Error(`Identifier submission is unavailable in state: ${this.currentState?.name ?? "none"}`);
    }

    const next = await action.run({ [input.name]: value });
    return this.setState(await this.advanceState(next));
  }

  async submitPassword(value: string): Promise<AuthState> {
    const state = this.requireState();
    const action = state.actions.password_login;

    if (!action?.enabled) {
      throw new Error(`Password submission is unavailable in state: ${state.name}`);
    }

    const next = await action.run({ password: value });
    return this.setState(next);
  }

  async continuePasswordLogin(): Promise<AuthState> {
    const state = this.requireState();
    const action = state.actions.continue_to_password_login;

    if (!action?.enabled) {
      throw new Error(`Password continuation is unavailable in state: ${state.name}`);
    }

    const next = await action.run();
    return this.setState(next);
  }

  async submitCurrent(data?: Record<string, string>): Promise<AuthState> {
    const state = this.requireState();
    const action = this.resolveSubmitAction(state);

    if (!action) {
      throw new Error(`Unexpected state: ${state.name}`);
    }

    const next = await action.run(data);
    return this.setState(await this.advanceState(next));
  }

  private async advanceState(state: AuthState): Promise<AuthState> {
    if (
      state.name === "login_method_chooser" &&
      state.actions.continue_to_password_login?.enabled
    ) {
      return state.actions.continue_to_password_login.run();
    }

    return state;
  }

  private resolveSubmitAction(state: AuthState): AuthAction | null {
    const identifierAction = getLoginIdentifierAction(state);
    const identifierInput = getLoginIdentifierInput(identifierAction);

    if (identifierAction?.enabled && identifierInput) {
      return identifierAction;
    }

    if (state.actions.password_login?.enabled) {
      return state.actions.password_login;
    }

    if (state.actions.continue_to_password_login?.enabled) {
      return state.actions.continue_to_password_login;
    }

    return null;
  }

  private requireState(): AuthState {
    if (!this.currentState) {
      throw new Error("Auth flow has not started");
    }
    return this.currentState;
  }

  private setState(state: AuthState): AuthState {
    this.currentState = this.normalizeState(state);
    return this.currentState;
  }

  private normalizeState(state: AuthState): AuthState {
    const resolved = resolveError(state, this.catalog);
    if (!resolved) {
      return state;
    }
    if (state.error_message === resolved.message) {
      return state;
    }
    return { ...state, error_message: resolved.message };
  }
}
