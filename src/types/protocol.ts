export const PROTOCOL_VERSION = 1;

/** Must match VibranceFlow-core DEFAULT_PORT. */
export const DEFAULT_REMOTE_PORT = 8765;

export type RemoteCommand =
  | "ping"
  | "get_state"
  | "set_sliders"
  | "set_audio"
  | "set_observer"
  | "reset_profile";

export type PairingPayload = {
  v: number;
  host: string;
  port: number;
  key: string;
};

export type SliderState = {
  vibrance: number;
  brightness: number;
  contrast: number;
  gamma: number;
  hue: number;
};

export type ProgramEntry = {
  exe: string;
  sliders: SliderState;
  audio?: AudioState;
};

export type AudioState = {
  available: boolean;
  volume: number;
  muted: boolean;
  session_count?: number;
  backend?: string;
  display_name?: string;
  reason?: string;
};

export type RemoteState = {
  observer_enabled: boolean;
  active_exe: string | null;
  sliders: SliderState;
  audio?: AudioState;
  /** Saved game profiles on the PC (same as profiles.json). */
  programs?: ProgramEntry[];
};

export type RemoteRequest = {
  v: number;
  id: string;
  cmd: RemoteCommand;
  payload?: Record<string, unknown>;
};

export type RemoteResponse = {
  v: number;
  id?: string;
  ok: boolean;
  state?: RemoteState;
  error?: string;
  error_code?: string;
  /** Server push, e.g. port_closed before shutdown. */
  event?: string;
};

export const DEFAULT_SLIDERS: SliderState = {
  vibrance: 50,
  brightness: 0,
  contrast: 0,
  gamma: 1.0,
  hue: 0,
};

export const DEFAULT_AUDIO: AudioState = {
  available: false,
  volume: 100,
  muted: false,
  session_count: 0,
  backend: "none",
  display_name: "",
  reason: "no_session",
};
