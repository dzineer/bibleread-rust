"use client";

import { useState, useCallback, useRef } from "react";

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

  const speakVerse = useCallback(
    (index: number) => {
      const synth = window.speechSynthesis;
      if (!synth || index >= verses.length) {
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

      const utterance = new SpeechSynthesisUtterance(verse.text);
      utterance.rate = 0.9;

      setCurrentVerse(verse.number);

      utterance.onend = () => {
        verseIndexRef.current = index + 1;
        speakVerse(index + 1);
      };

      utterance.onerror = () => {
        verseIndexRef.current = index + 1;
        speakVerse(index + 1);
      };

      synth.speak(utterance);
    },
    [verses]
  );

  const play = useCallback(() => {
    setPlaying(true);
    verseIndexRef.current = 0;
    window.speechSynthesis.cancel();
    // Chrome needs a tick after cancel
    setTimeout(() => speakVerse(0), 100);
  }, [speakVerse]);

  const pause = useCallback(() => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrentVerse(null);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrentVerse(null);
    verseIndexRef.current = 0;
  }, []);

  return { supported, playing, currentVerse, play, pause, stop };
}
