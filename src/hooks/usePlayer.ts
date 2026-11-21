import { useEffect, useState, useRef, useCallback } from 'react';

type PlayerState = {
  trackId: string | null;
  title: string;
  artist: string;
  coverUrl: string | null;
  previewUrl: string | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
};

const initialState: PlayerState = {
  trackId: null,
  title: '',
  artist: '',
  coverUrl: null,
  previewUrl: null,
  isPlaying: false,
  progress: 0,
  duration: 30,
};

let globalPlayer: PlayerState = initialState;
const listeners = new Set<() => void>();

// Audio element compartido
let audioEl: HTMLAudioElement | null = null;

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.addEventListener('timeupdate', () => {
      if (audioEl && globalPlayer.isPlaying) {
        globalPlayer = {
          ...globalPlayer,
          progress: audioEl.currentTime,
          duration: audioEl.duration || 30,
        };
        emit();
      }
    });
    audioEl.addEventListener('ended', () => {
      globalPlayer = { ...globalPlayer, isPlaying: false, progress: 0 };
      emit();
    });
    audioEl.addEventListener('play', () => {
      globalPlayer = { ...globalPlayer, isPlaying: true };
      emit();
    });
    audioEl.addEventListener('pause', () => {
      globalPlayer = { ...globalPlayer, isPlaying: false };
      emit();
    });
  }
  return audioEl;
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function play(
  trackId: string,
  title: string,
  artist: string,
  coverUrl: string | null,
  previewUrl: string | null,
) {
  const el = getAudioEl();
  if (globalPlayer.trackId === trackId && globalPlayer.isPlaying) {
    el.pause();
    return;
  }
  if (globalPlayer.trackId === trackId) {
    void el.play();
    return;
  }
  if (!previewUrl) return;
  el.src = previewUrl;
  el.currentTime = 0;
  globalPlayer = {
    trackId,
    title,
    artist,
    coverUrl,
    previewUrl,
    isPlaying: false,
    progress: 0,
    duration: 30,
  };
  emit();
  void el.play().catch(() => {
    globalPlayer = { ...globalPlayer, isPlaying: false };
    emit();
  });

  // Media Session API para controles del lock screen
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: '',
      artwork: coverUrl ? [{ src: coverUrl, sizes: '300x300' }] : [],
    });
  }
}

export function togglePlay() {
  const el = getAudioEl();
  if (globalPlayer.isPlaying) {
    el.pause();
  } else {
    void el.play();
  }
}

export function stopPlayer() {
  const el = getAudioEl();
  el.pause();
  el.src = '';
  globalPlayer = initialState;
  emit();
}

export function seekPlayer(time: number) {
  const el = getAudioEl();
  el.currentTime = time;
  globalPlayer = { ...globalPlayer, progress: time };
  emit();
}

export function usePlayer() {
  const [, setTick] = useState(0);
  const [, forceUpdate] = useState({});

  const ref = useRef<() => void>(() => {});
  ref.current = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  return {
    ...globalPlayer,
    play,
    togglePlay,
    stop: stopPlayer,
    seek: seekPlayer,
    forceUpdate: () => forceUpdate({}),
  };
}
