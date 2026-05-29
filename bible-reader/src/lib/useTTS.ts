"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTTSReturn {
  supported: boolean;
  playing: boolean;
  currentVerse: number | null;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export function useTTS(verses: { number: number; text: string }[]): UseTTSReturn {
  const [supported] = useState(() =>
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [playing, setPlaying] = useState(false);
  const [currentVerse, setCurrentVerse] = useState<number | null>(null);
  const verseIndexRef = useRef(0);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize speech synthesis ref
  useEffect(() => {
    if (supported) {
      synthRef.current = window.speechSynthesis;
    }
  }, [supported]);

  const speakVerse = useCallback(
    (index: number) => {
      if (!synthRef.current || index >= verses.length) {
        setPlaying(false);
        setCurrentVerse(null);
        verseIndexRef.current = 0;
        return;
      }

      const verse = verses[index];
      if (!verse) {
        setPlaying(false);
        setCurrentVerse(null);
        return;
      }

      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(verse.text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Try to find a good English voice
      const voices = synthRef.current.getVoices();
      const englishVoice =
        voices.find((v) => v.lang === "en-US" && v.name.includes("Samantha")) ??
        voices.find((v) => v.lang === "en-US") ??
        voices.find((v) => v.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;

      setCurrentVerse(verse.number);

      utterance.onend = () => {
        verseIndexRef.current = index + 1;
        speakVerse(index + 1);
      };

      utterance.onerror = () => {
        // Skip on error and try next verse
        verseIndexRef.current = index + 1;
        speakVerse(index + 1);
      };

      synthRef.current.speak(utterance);
    },
    [verses]
  );

  // Ensure voices are loaded (Chrome loads them async)
  useEffect(() => {
    if (supported && synthRef.current) {
      const loadVoices = () => {
        synthRef.current?.getVoices();
      };
      loadVoices();
      synthRef.current.onvoiceschanged = loadVoices;
      return () => {
        if (synthRef.current) {
          synthRef.current.onvoiceschanged = null;
        }
      };
    }
  }, [supported]);

  const play = useCallback(() => {
    if (!synthRef.current) return;
    setPlaying(true);
    speakVerse(verseIndexRef.current);
  }, [speakVerse]);

  const pause = useCallback(() => {
    synthRef.current?.cancel();
    setPlaying(false);
    setCurrentVerse(null);
  }, []);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
    setPlaying(false);
    setCurrentVerse(null);
    verseIndexRef.current = 0;
  }, []);

  return { supported, playing, currentVerse, play, pause, stop };
}
