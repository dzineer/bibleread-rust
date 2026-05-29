"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
}

interface UseTTSReturn {
  supported: boolean;
  playing: boolean;
  currentVerse: number | null;
  voices: VoiceOption[];
  selectedVoice: string;
  setSelectedVoice: (uri: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // Prefer British Daniel (macOS) — natural, warm
  let v = voices.find((v) => v.name === "Daniel" && v.lang === "en-GB");
  if (v) return v;
  // Then any en-GB
  v = voices.find((v) => v.lang === "en-GB");
  if (v) return v;
  // Then US Samantha
  v = voices.find((v) => v.name.includes("Samantha"));
  if (v) return v;
  // Any English
  return voices.find((v) => v.lang.startsWith("en")) ?? null;
}

export function useTTS(verses: { number: number; text: string }[]): UseTTSReturn {
  const [supported] = useState(() =>
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [playing, setPlaying] = useState(false);
  const [currentVerse, setCurrentVerse] = useState<number | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState<string>("");
  const verseIndexRef = useRef(0);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const voiceRef = useRef<string>("");

  // Load voices
  useEffect(() => {
    if (!supported) return;
    synthRef.current = window.speechSynthesis;

    const load = () => {
      const all = synthRef.current?.getVoices() ?? [];
      const englishVoices = all
        .filter((v) => v.lang.startsWith("en"))
        .map((v) => ({
          name: v.name,
          lang: v.lang,
          voiceURI: v.voiceURI,
        }));
      setVoices(englishVoices);

      // Set default if not already chosen
      if (!voiceRef.current) {
        const stored = localStorage.getItem("bible-tts-voice");
        if (stored && englishVoices.find((v) => v.voiceURI === stored)) {
          voiceRef.current = stored;
          setSelectedVoiceState(stored);
        } else {
          const best = pickBestVoice(all);
          const uri = best?.voiceURI ?? englishVoices[0]?.voiceURI ?? "";
          voiceRef.current = uri;
          setSelectedVoiceState(uri);
        }
      }
    };

    load();
    synthRef.current.onvoiceschanged = load;
    return () => {
      if (synthRef.current) synthRef.current.onvoiceschanged = null;
    };
  }, [supported]);

  const setSelectedVoice = useCallback((uri: string) => {
    voiceRef.current = uri;
    setSelectedVoiceState(uri);
    localStorage.setItem("bible-tts-voice", uri);
  }, []);

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
      utterance.rate = 0.88;
      utterance.pitch = 1;
      utterance.volume = 1;

      const allVoices = synthRef.current.getVoices();
      const chosen = allVoices.find((v) => v.voiceURI === voiceRef.current);
      if (chosen) utterance.voice = chosen;

      setCurrentVerse(verse.number);

      utterance.onend = () => {
        verseIndexRef.current = index + 1;
        speakVerse(index + 1);
      };

      utterance.onerror = () => {
        verseIndexRef.current = index + 1;
        speakVerse(index + 1);
      };

      synthRef.current.speak(utterance);
    },
    [verses]
  );

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

  return {
    supported,
    playing,
    currentVerse,
    voices,
    selectedVoice,
    setSelectedVoice,
    play,
    pause,
    stop,
  };
}
