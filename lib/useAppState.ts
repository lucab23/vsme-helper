"use client";

import { useEffect, useState } from "react";
import {
  AppState,
  DatapointAnswer,
  Onboarding,
  initialAppState,
} from "./types";

const STORAGE_KEY = "vsme-helper-state-v1";

const emptyAnswer: DatapointAnswer = {
  value: "",
  notApplicable: false,
  note: "",
};

export function useAppState() {
  const [state, setState] = useState<AppState>(initialAppState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as AppState);
    } catch (err) {
      console.error("Failed to read saved state, resetting", err);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const setOnboarding = (patch: Partial<Onboarding>) => {
    setState((s) => ({
      ...s,
      onboarding: { ...s.onboarding, ...patch },
      lastUpdated: new Date().toISOString(),
    }));
  };

  const setAnswer = (id: string, patch: Partial<DatapointAnswer>) => {
    setState((s) => ({
      ...s,
      answers: {
        ...s.answers,
        [id]: { ...emptyAnswer, ...s.answers[id], ...patch },
      },
      lastUpdated: new Date().toISOString(),
    }));
  };

  const getAnswer = (id: string): DatapointAnswer => {
    return state.answers[id] ?? emptyAnswer;
  };

  const resetAll = () => {
    setState(initialAppState);
    // Clean storage immediately so a refresh truly starts fresh
    localStorage.removeItem(STORAGE_KEY);
  };

  const exportState = (): string => JSON.stringify(state, null, 2);

  const importState = (json: string) => {
    const parsed = JSON.parse(json) as AppState;
    // Defensive: ensure required top-level keys exist before accepting
    if (!parsed.onboarding || !parsed.answers) {
      throw new Error("File does not look like a VSME Helper save.");
    }
    setState(parsed);
  };

  return {
    state,
    loaded,
    setOnboarding,
    setAnswer,
    getAnswer,
    resetAll,
    exportState,
    importState,
  };
}