"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  premium: boolean;
}

interface UseTTSReturn {
  supported: boolean;
  voicesReady: boolean;
  playing: boolean;
  currentVerse: number | null;
  voices: VoiceOption[];
  selectedVoice: string;
  setSelectedVoice: (uri: string) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

// Premium macOS voices (need to be downloaded in System Settings → Accessibility → Spoken Content → Manage Voices)
const PREMIUM_VOICES = new Set([
  "Daniel",     // en-GB — warm British male ★ best for Bible
  "Oliver",     // en-GB — British male
  "Serena",     // en-GB — British female
  "Kate",       // en-GB — British female
  "Stephanie",  // en-GB — British female
  "Fiona",      // en-GB — Scottish female
  "Moira",      // en-GB — Irish female
  "Samantha",   // en-US — smooth American female
  "Alex",       // en-US — American male
  "Tom",        // en-US — American male
  "Ava",        // en-US — American female
  "Allison",    // en-US — American female
  "Susan",      // en-US — American female
  "Zoe",        // en-US — American female
  "Karen",      // en-AU — Australian female
  "Lee",        // en-AU — Australian male
  "Veena",      // en-IN — Indian female
  "Rishi",      // en-IN — Indian male
]);

function isPremium(name: string): boolean {
  return PREMIUM_VOICES.has(name);
}

function voiceScore(v: SpeechSynthesisVoice): number {
  let score = 0;
  if (v.name === "Daniel" && v.lang === "en-GB") score += 1000; // best
  if (isPremium(v.name)) score += 500;
  if (v.lang === "en-GB") score += 300;
  if (v.lang.startsWith("en")) score += 200;
  if (v.localService) score += 100;
  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const sorted = [...voices].sort((a, b) => voiceScore(b) - voiceScore(a));
  return sorted[0] ?? null;
}

export function useTTS(verses: { number: number; text: string }[]): UseTTSReturn {
  const [supported] = useState(() =>
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [playing, setPlaying] = useState(false);
  const [currentVerse, setCurrentVerse] = useState<number | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesReady, setVoicesReady] = useState(false);
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
      // Show all voices, ranked by quality score, deduplicated by voiceURI
      const seen = new Set<string>();
      const ranked = all
        .map((v) => ({
          name: v.name,
          lang: v.lang,
          voiceURI: v.voiceURI,
          premium: isPremium(v.name),
        }))
        .filter((v) => {
          if (seen.has(v.voiceURI)) return false;
          seen.add(v.voiceURI);
          return true;
        })
        .map((v) => ({
          ...v,
          _score: voiceScore(all.find((a) => a.voiceURI === v.voiceURI)!),
        }))
        .sort((a, b) => b._score - a._score)
        .map(({ _score, ...v }) => v);
      setVoices(ranked);
      // Only mark ready if we actually have voices
      if (ranked.length > 0) {
        setVoicesReady(true);
      }

      // Set default if not already chosen
      if (!voiceRef.current) {
        const stored = localStorage.getItem("bible-tts-voice");
        if (stored && ranked.find((v) => v.voiceURI === stored)) {
          voiceRef.current = stored;
          setSelectedVoiceState(stored);
        } else {
          const best = pickBestVoice(all);
          const uri = best?.voiceURI ?? ranked[0]?.voiceURI ?? "";
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

      // Don't cancel between verses — it races with Chrome's speech queue.
      // Only cancel on explicit Stop.

      const utterance = new SpeechSynthesisUtterance(verse.text);
      utterance.rate = 0.88;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Pick voice: use selected, fall back to any available
      const allVoices = synthRef.current.getVoices();
      let chosen: SpeechSynthesisVoice | undefined =
        allVoices.find((v) => v.voiceURI === voiceRef.current);
      if (!chosen) {
        chosen = pickBestVoice(allVoices) ?? undefined;
      }
      if (!chosen && allVoices.length > 0) {
        chosen = allVoices[0];
      }
      if (chosen) {
        utterance.voice = chosen;
      }

      setCurrentVerse(verse.number);

      let started = false;
      utterance.onstart = () => {
        started = true;
      };

      utterance.onend = () => {
        verseIndexRef.current = index + 1;
        speakVerse(index + 1);
      };

      utterance.onerror = (e) => {
        if (!started) {
          console.warn(
            `TTS: failed to start verse ${verse.number} — "${e.error}". Retrying without voice preference...`
          );
          // Retry without a specific voice — some voices fail to load
          const fallback = new SpeechSynthesisUtterance(verse.text);
          fallback.rate = 0.88;
          fallback.onend = utterance.onend;
          fallback.onerror = () => {
            verseIndexRef.current = index + 1;
            speakVerse(index + 1);
          };
          setTimeout(() => synthRef.current?.speak(fallback), 100);
        } else {
          verseIndexRef.current = index + 1;
          speakVerse(index + 1);
        }
      };

      synthRef.current.speak(utterance);
    },
    [verses]
  );

  const play = useCallback(() => {
    if (!synthRef.current) return;
    synthRef.current.getVoices(); // prime voice list
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
    voicesReady,
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
