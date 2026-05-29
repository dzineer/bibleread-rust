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
  const [supported] = useState(() => {
    if (typeof window === "undefined") return false;
    const ok = "speechSynthesis" in window;
    if (ok) {
      const voices = window.speechSynthesis.getVoices();
      console.log(`TTS: supported, ${voices.length} voices available`);
    } else {
      console.log("TTS: not supported in this browser");
    }
    return ok;
  });
  const [playing, setPlaying] = useState(false);
  const [currentVerse, setCurrentVerse] = useState<number | null>(null);
  const verseIndexRef = useRef(0);
  const stoppedRef = useRef(false);

  const speakVerse = useCallback(
    (index: number) => {
      const synth = window.speechSynthesis;

      if (stoppedRef.current) {
        setPlaying(false);
        setCurrentVerse(null);
        return;
      }

      if (index >= verses.length) {
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
      utterance.volume = 1;

      setCurrentVerse(verse.number);

      utterance.onstart = () => {
        console.log(`TTS: speaking verse ${verse.number}`);
      };

      utterance.onend = () => {
        if (!stoppedRef.current) {
          verseIndexRef.current = index + 1;
          speakVerse(index + 1);
        }
      };

      utterance.onerror = (e) => {
        console.warn(`TTS: verse ${verse.number} error — ${e.error}`);
        if (e.error === "canceled" || e.error === "interrupted") {
          // User stopped — don't continue
          setPlaying(false);
          setCurrentVerse(null);
          return;
        }
        if (!stoppedRef.current) {
          verseIndexRef.current = index + 1;
          speakVerse(index + 1);
        }
      };

      // Chrome bug workaround: pause/resume cycle unblocks the synth
      synth.resume();
      synth.speak(utterance);

      // Chrome safety: if utterance doesn't start within 2s, retry
      const safety = setTimeout(() => {
        if (synth.speaking || synth.pending) return;
        console.warn(`TTS: verse ${verse.number} didn't start — retrying`);
        synth.cancel();
        synth.resume();
        const retry = new SpeechSynthesisUtterance(verse.text);
        retry.rate = 0.9;
        retry.onend = utterance.onend;
        retry.onerror = utterance.onerror;
        synth.speak(retry);
      }, 2000);

      utterance.onstart = () => {
        clearTimeout(safety);
        console.log(`TTS: speaking verse ${verse.number}`);
      };
    },
    [verses]
  );

  const play = useCallback(() => {
    stoppedRef.current = false;
    verseIndexRef.current = 0;
    setPlaying(true);

    const synth = window.speechSynthesis;
    synth.cancel();

    // Chrome workaround: wait for cancel to flush, then speak
    setTimeout(() => {
      speakVerse(0);
    }, 150);
  }, [speakVerse]);

  const pause = useCallback(() => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrentVerse(null);
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrentVerse(null);
    verseIndexRef.current = 0;
  }, []);

  return { supported, playing, currentVerse, play, pause, stop };
}
