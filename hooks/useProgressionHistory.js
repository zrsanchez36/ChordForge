"use client";

import { useCallback, useEffect, useState } from "react";
import { HISTORY_LIMIT, readHistory, writeHistory } from "@/lib/chord-forge";

export function useProgressionHistory({ onStopPlayback, onLoadSession }) {
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  useEffect(() => {
    setHistory(readHistory());
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    if (!historyLoaded) {
      return;
    }

    writeHistory(history.slice(0, HISTORY_LIMIT));
  }, [history, historyLoaded]);

  const addToHistory = useCallback((entry) => {
    setHistory((previous) => [entry, ...previous].slice(0, HISTORY_LIMIT));
    setActiveHistoryId(entry.id);
  }, []);

  const handleLoadHistory = useCallback(
    (session) => {
      onStopPlayback();
      onLoadSession(session);
      setActiveHistoryId(session.id);
    },
    [onStopPlayback, onLoadSession],
  );

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    setActiveHistoryId(null);
  }, []);

  return {
    history,
    historyLoaded,
    activeHistoryId,
    addToHistory,
    handleLoadHistory,
    handleClearHistory,
  };
}
