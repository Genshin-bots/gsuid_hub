import { Loader2, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const WAVEFORM_BAR_COUNT = 44;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createFallbackPeaks(count: number): number[] {
  return Array.from({ length: count }, (_, idx) => {
    const t = idx / Math.max(1, count - 1);
    const envelope = Math.sin(t * Math.PI);
    const ripple = 0.55 + 0.45 * Math.sin(idx * 1.45 + 0.6) * Math.cos(idx * 0.55);
    return Math.max(0.16, Math.min(0.95, 0.2 + envelope * ripple * 0.72));
  });
}

function extractWaveformPeaks(buffer: AudioBuffer, barCount: number): number[] {
  const channelData = buffer.getChannelData(0);
  const totalSamples = channelData.length;
  if (totalSamples === 0) return createFallbackPeaks(barCount);

  const blockSize = Math.max(1, Math.floor(totalSamples / barCount));
  const rawPeaks: number[] = [];
  let maxPeak = 0;

  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    const end = i === barCount - 1 ? totalSamples : Math.min(totalSamples, start + blockSize);
    let peak = 0;
    const step = Math.max(1, Math.floor((end - start) / 256));
    for (let j = start; j < end; j += step) {
      const amp = Math.abs(channelData[j]);
      if (amp > peak) peak = amp;
    }
    rawPeaks.push(peak);
    if (peak > maxPeak) maxPeak = peak;
  }

  if (maxPeak <= 0) return createFallbackPeaks(barCount);

  return rawPeaks.map((peak) => {
    const normalized = (peak / maxPeak) ** 0.75;
    return Math.max(0.14, Math.min(1, normalized));
  });
}

export interface PersonaAudioPlayerProps {
  src: string;
  playLabel: string;
  pauseLabel: string;
  playingLabel: string;
  loadFailedMessage: string;
  formatHint?: string;
}

export function PersonaAudioPlayer({
  src,
  playLabel,
  pauseLabel,
  playingLabel,
  loadFailedMessage,
  formatHint,
}: PersonaAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const isDraggingWaveformRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [peaks, setPeaks] = useState<number[]>(() => createFallbackPeaks(WAVEFORM_BAR_COUNT));
  const [isDecodingWaveform, setIsDecodingWaveform] = useState(true);

  const barKeys = useMemo(
    () => Array.from({ length: WAVEFORM_BAR_COUNT }, (_, idx) => `wf-${idx}`),
    [],
  );

  // 切换音频源或卸载时重置播放态
  useEffect(() => {
    const audio = audioRef.current;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.load();
    }
    return () => {
      audio?.pause();
    };
  }, [src]);

  // 解码真实音频波形峰值，解码失败时降级到柔和占位波形
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setIsDecodingWaveform(true);

    const decode = async () => {
      const AudioCtx = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioCtx) {
        if (!cancelled) {
          setPeaks(createFallbackPeaks(WAVEFORM_BAR_COUNT));
          setIsDecodingWaveform(false);
        }
        return;
      }

      let audioCtx: AudioContext | null = null;
      try {
        const res = await fetch(src, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        audioCtx = new AudioCtx();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        setPeaks(extractWaveformPeaks(decoded, WAVEFORM_BAR_COUNT));
        if (Number.isFinite(decoded.duration) && decoded.duration > 0) {
          setDuration((prev) => (prev > 0 ? prev : decoded.duration));
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPeaks(createFallbackPeaks(WAVEFORM_BAR_COUNT));
      } finally {
        if (audioCtx) {
          void audioCtx.close().catch(() => {});
        }
        if (!cancelled) {
          setIsDecodingWaveform(false);
        }
      }
    };

    void decode();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [src]);

  // 播放期间用 rAF 同步进度，让波形填充和滑块 60fps 丝滑前进
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;

    const tick = () => {
      const audio = audioRef.current;
      if (audio && !isDraggingWaveformRef.current) {
        setCurrentTime(audio.currentTime);
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const seekToRatio = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      const total =
        audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      if (!audio || total <= 0) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      const nextTime = clamped * total;
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [duration],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = waveformRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      seekToRatio((clientX - rect.left) / rect.width);
    },
    [seekToRatio],
  );

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (duration > 0 && audio.currentTime >= duration - 0.05) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        toast.error(loadFailedMessage);
        setIsPlaying(false);
      });
  }, [duration, isPlaying, loadFailedMessage]);

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const activeBarIndex = Math.min(
    WAVEFORM_BAR_COUNT - 1,
    Math.floor(progress * WAVEFORM_BAR_COUNT),
  );

  return (
    <div className="flex h-full w-full flex-col justify-between gap-3">
      {/* biome-ignore lint/a11y/useMediaCaption: 人格参考音色音频无字幕轨道 */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          if (!isDraggingWaveformRef.current) {
            setCurrentTime(e.currentTarget.currentTime);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
        }}
        onError={() => {
          setIsPlaying(false);
          toast.error(loadFailedMessage);
        }}
      />

      {/* 音频波形（点击或拖拽直接跳转） */}
      <div
        ref={waveformRef}
        role="slider"
        tabIndex={0}
        aria-label={playLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        onPointerDown={(e) => {
          isDraggingWaveformRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!isDraggingWaveformRef.current) return;
          seekFromClientX(e.clientX);
        }}
        onPointerUp={(e) => {
          if (!isDraggingWaveformRef.current) return;
          isDraggingWaveformRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          isDraggingWaveformRef.current = false;
        }}
        onKeyDown={(e) => {
          if (duration <= 0) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            seekToRatio((currentTime + 2) / duration);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            seekToRatio((currentTime - 2) / duration);
          } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            togglePlayback();
          }
        }}
        className="group relative flex min-h-[84px] flex-1 cursor-pointer touch-none select-none items-center gap-[3px] rounded-md px-1.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {peaks.map((peak, index) => {
          const barRatio = (index + 0.5) / WAVEFORM_BAR_COUNT;
          const isPlayed = progress > 0 && barRatio <= progress;
          const isHead = isPlaying && index === activeBarIndex;
          const heightPct = Math.round(peak * 100);
          return (
            <span
              key={barKeys[index]}
              style={{ height: `${heightPct}%` }}
              className={cn(
                'flex-1 rounded-full transition-[background-color,transform] duration-100',
                isPlayed ? 'bg-primary' : 'bg-foreground/20 group-hover:bg-foreground/30',
                isHead && 'scale-y-110 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]',
                isDecodingWaveform && 'animate-pulse',
              )}
            />
          );
        })}
        {isDecodingWaveform && (
          <span className="pointer-events-none absolute right-2 top-1.5 inline-flex items-center text-muted-foreground/70">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        )}
      </div>

      {/* 进度条 + 时间 */}
      <div className="space-y-1.5">
        <Slider
          value={[Math.min(currentTime, duration || 0)]}
          min={0}
          max={duration > 0 ? duration : 1}
          step={0.05}
          disabled={duration <= 0}
          onValueChange={([nextVal]) => {
            if (typeof nextVal !== 'number' || duration <= 0) return;
            seekToRatio(nextVal / duration);
          }}
          className="cursor-pointer [&>span:first-child]:h-1.5 [&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
        />
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-muted-foreground">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>

      {/* 播放控制 + 格式说明 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={togglePlayback}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                {pauseLabel}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                {playLabel}
              </>
            )}
          </Button>
          {isPlaying && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              {playingLabel}
            </span>
          )}
        </div>
        {formatHint && (
          <span className="truncate text-[11px] text-muted-foreground/80" title={formatHint}>
            {formatHint}
          </span>
        )}
      </div>
    </div>
  );
}
