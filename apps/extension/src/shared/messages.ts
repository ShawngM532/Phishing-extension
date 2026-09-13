import type { Verdict } from '@sentinel/heuristics';

import type { Settings } from '../background/settings';
import type { TabState } from './types';

export type Stage = 1 | 2;

export interface ScoreRequestPayload {
  url: string;
  features: number[];
  stage: Stage;
  formAddedAfterLoad: boolean;
  extractionMs?: number;
}

export interface UrlPayload {
  url: string;
}

export interface TabPayload {
  tabId?: number;
}

export type Message =
  | { type: 'SCORE_REQUEST'; payload: ScoreRequestPayload }
  | { type: 'SCORE_RESULT'; payload: { verdict: Verdict } }
  | { type: 'GET_TAB_STATE'; payload: TabPayload }
  | { type: 'GET_SETTINGS'; payload: Record<string, never> }
  | { type: 'SET_ENABLED'; payload: { enabled: boolean } }
  | { type: 'SET_ALLOWLIST'; payload: { etld1: string; allow: boolean } }
  | { type: 'PROCEED'; payload: TabPayload }
  | { type: 'DISMISS'; payload: TabPayload }
  | { type: 'MANUAL_CHECK'; payload: UrlPayload }
  | { type: 'DEEP_SCAN'; payload: UrlPayload }
  | { type: 'CLOSE_TAB'; payload: TabPayload };

export interface ResponseMap {
  SCORE_REQUEST: { verdict: Verdict };
  SCORE_RESULT: { ok: true };
  GET_TAB_STATE: { state: TabState | null };
  GET_SETTINGS: { settings: Settings };
  SET_ENABLED: { settings: Settings };
  SET_ALLOWLIST: { allowlist: string[] };
  PROCEED: { ok: true };
  DISMISS: { ok: true };
  MANUAL_CHECK: { verdict: Verdict };
  DEEP_SCAN: { verdict: Verdict };
  CLOSE_TAB: { ok: true };
}

export type MessageType = Message['type'];
export type MessageOf<T extends MessageType> = Extract<Message, { type: T }>;
export type ResponseOf<T extends MessageType> = ResponseMap[T];

/** Typed wrapper around chrome.runtime.sendMessage. Unknown message types are a compile error. */
export function sendMessage<T extends MessageType>(message: MessageOf<T>): Promise<ResponseOf<T>> {
  return chrome.runtime.sendMessage<MessageOf<T>, ResponseOf<T>>(message);
}

const RESPONSE_MAP_KEYS: Record<MessageType, true> = {
  SCORE_REQUEST: true,
  SCORE_RESULT: true,
  GET_TAB_STATE: true,
  GET_SETTINGS: true,
  SET_ENABLED: true,
  SET_ALLOWLIST: true,
  PROCEED: true,
  DISMISS: true,
  MANUAL_CHECK: true,
  DEEP_SCAN: true,
  CLOSE_TAB: true,
};

export function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && type in RESPONSE_MAP_KEYS;
}
