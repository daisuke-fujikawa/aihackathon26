"use client";

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  type ReactNode,
} from "react";

// --- Types ---

export type SessionPhase =
  | "SETUP"
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "KANPAI";

export type YoiDrunkLevel = 1 | 2 | 3;

export type YoiImageKey =
  | "drunk_1"
  | "drunk_2"
  | "drunk_3"
  | "kanpai"
  | "pass"
  | "clock"
  | "restroom";

export type FacilitationTriggerType =
  | "SILENCE_KILLER"
  | "PASS_TO_PARTICIPANT"
  | "GO_HOME_REMIND"
  | "BREAK_SUGGEST";

export interface FacilitationTrigger {
  type: FacilitationTriggerType;
}

export interface FacilitationConfig {
  silenceThresholdSec: number;
  passIntervalSec: number;
  breakIntervalMin: number;
  kanpaiBreakThreshold: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "yoi";
  content: string;
  timestamp: number;
  triggerType?: FacilitationTriggerType;
  yoiImage?: YoiImageKey;
}

export interface SessionState {
  phase: SessionPhase;
  participants: string[];
  messages: ChatMessage[];
  kanpaiCount: number;
  sessionStartTime: number;
  lastSpeechTime: number;
  drunkLevel: YoiDrunkLevel;
  currentYoiImage: YoiImageKey;
  facilitationConfig: FacilitationConfig;
}

// --- Defaults ---

const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2時間

const DEFAULT_FACILITATION_CONFIG: FacilitationConfig = {
  silenceThresholdSec: 30,
  passIntervalSec: 60,
  breakIntervalMin: 30,
  kanpaiBreakThreshold: 3,
};

const INITIAL_STATE: SessionState = {
  phase: "SETUP",
  participants: [],
  messages: [],
  kanpaiCount: 0,
  sessionStartTime: 0,
  lastSpeechTime: 0,
  drunkLevel: 1,
  currentYoiImage: "drunk_1",
  facilitationConfig: DEFAULT_FACILITATION_CONFIG,
};

// --- Reducer ---

type SessionAction =
  | { type: "SET_PHASE"; phase: SessionPhase }
  | { type: "SET_PARTICIPANTS"; participants: string[] }
  | { type: "ADD_MESSAGE"; message: Omit<ChatMessage, "id" | "timestamp"> }
  | { type: "INCREMENT_KANPAI" }
  | { type: "START_SESSION" }
  | { type: "UPDATE_DRUNK_LEVEL" }
  | { type: "SET_TEMPORARY_YOI_IMAGE"; image: YoiImageKey }
  | { type: "RESET_YOI_IMAGE" }
  | { type: "UPDATE_LAST_SPEECH_TIME" };

function drunkLevelFromElapsed(
  sessionStartTime: number,
  now: number
): YoiDrunkLevel {
  if (sessionStartTime === 0) return 1;
  const elapsed = now - sessionStartTime;
  const ratio = elapsed / SESSION_DURATION_MS;
  if (ratio >= 2 / 3) return 3;
  if (ratio >= 1 / 3) return 2;
  return 1;
}

function drunkLevelToImage(level: YoiDrunkLevel): YoiImageKey {
  switch (level) {
    case 1:
      return "drunk_1";
    case 2:
      return "drunk_2";
    case 3:
      return "drunk_3";
  }
}

let messageCounter = 0;

function sessionReducer(
  state: SessionState,
  action: SessionAction
): SessionState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SET_PARTICIPANTS":
      return { ...state, participants: action.participants };

    case "ADD_MESSAGE": {
      const newMessage: ChatMessage = {
        ...action.message,
        id: `msg-${Date.now()}-${++messageCounter}`,
        timestamp: Date.now(),
      };
      return { ...state, messages: [...state.messages, newMessage] };
    }

    case "INCREMENT_KANPAI":
      return { ...state, kanpaiCount: state.kanpaiCount + 1 };

    case "START_SESSION":
      return {
        ...state,
        phase: "IDLE",
        sessionStartTime: Date.now(),
        lastSpeechTime: Date.now(),
      };

    case "UPDATE_DRUNK_LEVEL": {
      const newLevel = drunkLevelFromElapsed(
        state.sessionStartTime,
        Date.now()
      );
      return {
        ...state,
        drunkLevel: newLevel,
        currentYoiImage: drunkLevelToImage(newLevel),
      };
    }

    case "SET_TEMPORARY_YOI_IMAGE":
      return { ...state, currentYoiImage: action.image };

    case "RESET_YOI_IMAGE":
      return {
        ...state,
        currentYoiImage: drunkLevelToImage(state.drunkLevel),
      };

    case "UPDATE_LAST_SPEECH_TIME":
      return { ...state, lastSpeechTime: Date.now() };

    default:
      return state;
  }
}

// --- Context ---

interface SessionContextValue {
  state: SessionState;
  setPhase: (phase: SessionPhase) => void;
  setParticipants: (participants: string[]) => void;
  addMessage: (
    message: Omit<ChatMessage, "id" | "timestamp">
  ) => void;
  incrementKanpaiCount: () => void;
  startSession: () => void;
  updateDrunkLevel: () => void;
  setTemporaryYoiImage: (image: YoiImageKey) => void;
  resetYoiImage: () => void;
  updateLastSpeechTime: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_STATE);

  const setPhase = useCallback(
    (phase: SessionPhase) => dispatch({ type: "SET_PHASE", phase }),
    []
  );

  const setParticipants = useCallback(
    (participants: string[]) =>
      dispatch({ type: "SET_PARTICIPANTS", participants }),
    []
  );

  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) =>
      dispatch({ type: "ADD_MESSAGE", message }),
    []
  );

  const incrementKanpaiCount = useCallback(
    () => dispatch({ type: "INCREMENT_KANPAI" }),
    []
  );

  const startSession = useCallback(
    () => dispatch({ type: "START_SESSION" }),
    []
  );

  const updateDrunkLevel = useCallback(
    () => dispatch({ type: "UPDATE_DRUNK_LEVEL" }),
    []
  );

  const setTemporaryYoiImage = useCallback(
    (image: YoiImageKey) =>
      dispatch({ type: "SET_TEMPORARY_YOI_IMAGE", image }),
    []
  );

  const resetYoiImage = useCallback(
    () => dispatch({ type: "RESET_YOI_IMAGE" }),
    []
  );

  const updateLastSpeechTime = useCallback(
    () => dispatch({ type: "UPDATE_LAST_SPEECH_TIME" }),
    []
  );

  return (
    <SessionContext value={{
      state,
      setPhase,
      setParticipants,
      addMessage,
      incrementKanpaiCount,
      startSession,
      updateDrunkLevel,
      setTemporaryYoiImage,
      resetYoiImage,
      updateLastSpeechTime,
    }}>
      {children}
    </SessionContext>
  );
}

export function useSessionState(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      "useSessionState must be used within a SessionStateProvider"
    );
  }
  return context;
}
