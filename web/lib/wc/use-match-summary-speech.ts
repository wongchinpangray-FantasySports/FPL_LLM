"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function speechLang(locale: string): string {
  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-GB";
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: string,
): SpeechSynthesisVoice | null {
  const lang = speechLang(locale);
  const langPrefix = lang.slice(0, 2);

  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    const name = v.name.toLowerCase();
    if (v.lang.replace("_", "-").startsWith(lang)) s += 40;
    else if (v.lang.startsWith(langPrefix)) s += 20;
    if (name.includes("google")) s += 15;
    if (name.includes("natural") || name.includes("neural")) s += 25;
    if (name.includes("microsoft")) s += 10;
    if (name.includes("premium")) s += 12;
    if (v.localService) s += 5;
    return s;
  };

  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function useMatchSummarySpeech(locale: string) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stopBrowserSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopBrowserSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    revokeObjectUrl();
    setSpeaking(false);
    setPaused(false);
    setAudioLoading(false);
  }, [revokeObjectUrl, stopBrowserSpeech]);

  useEffect(() => () => stop(), [stop]);

  const playBrowserFallback = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      stopBrowserSpeech();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLang(locale);
      utterance.rate = 0.92;
      utterance.pitch = 1;

      const voices = window.speechSynthesis.getVoices();
      const voice = pickVoice(voices, locale);
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        setSpeaking(false);
        setPaused(false);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setSpeaking(false);
        setPaused(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
      setPaused(false);
    },
    [locale, stopBrowserSpeech],
  );

  const play = useCallback(
    async (summary: string, matchId: number) => {
      stop();
      setAudioLoading(true);

      try {
        const res = await fetch(
          `/api/worldcup/match-summary/audio?matchId=${encodeURIComponent(String(matchId))}&locale=${encodeURIComponent(locale)}`,
        );

        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;

          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            setSpeaking(false);
            setPaused(false);
          };
          audio.onpause = () => {
            if (audio.currentTime > 0 && audio.currentTime < audio.duration) {
              setPaused(true);
            }
          };
          audio.onplay = () => {
            setSpeaking(true);
            setPaused(false);
          };
          await audio.play();
          return;
        }

        playBrowserFallback(summary);
      } catch {
        playBrowserFallback(summary);
      } finally {
        setAudioLoading(false);
      }
    },
    [locale, stop, playBrowserFallback],
  );

  const togglePause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && objectUrlRef.current) {
      if (paused) {
        void audio.play();
        setPaused(false);
      } else {
        audio.pause();
        setPaused(true);
      }
      return;
    }

    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [paused]);

  return {
    speaking,
    paused,
    audioLoading,
    play,
    stop,
    togglePause,
  };
}
