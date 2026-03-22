import { useState, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type TimeValue = string | [number, number];

interface TimePickerProps {
  value: TimeValue;
  onChange: (value: [number, number]) => void;
  disabled?: boolean;
  className?: string;
}

// Parse time value to hours and minutes
const parseTime = (timeValue: TimeValue): { hours: number; minutes: number } => {
  if (!timeValue) return { hours: 0, minutes: 0 };
  
  // Handle tuple [hours, minutes]
  if (Array.isArray(timeValue)) {
    return {
      hours: typeof timeValue[0] === 'number' ? timeValue[0] : 0,
      minutes: typeof timeValue[1] === 'number' ? timeValue[1] : 0,
    };
  }
  
  // Handle string "H:mm" or "HH:mm" format
  const parts = timeValue.split(':');
  return {
    hours: parseInt(parts[0] || '0', 10),
    minutes: parseInt(parts[1] || '0', 10),
  };
};

// Format hours and minutes to tuple [hours, minutes]
const formatTime = (hours: number, minutes: number): [number, number] => {
  return [hours, minutes];
};

// Format hours and minutes to display "H:mm" format without leading zero for hours
const formatDisplayTime = (hours: number, minutes: number): string => {
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

export function TimePicker({ value, onChange, disabled, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const parsed = parseTime(value);
    setHours(parsed.hours);
    setMinutes(parsed.minutes);
  }, [value]);

  const handleHourChange = (delta: number) => {
    const newHours = (hours + delta + 24) % 24;
    setHours(newHours);
    onChange(formatTime(newHours, minutes));
  };

  const handleMinuteChange = (delta: number) => {
    const newMinutes = (minutes + delta + 60) % 60;
    setMinutes(newMinutes);
    onChange(formatTime(hours, newMinutes));
  };

  const handleHourInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 23) {
      setHours(val);
      onChange(formatTime(val, minutes));
    }
  };

  const handleMinuteInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 59) {
      setMinutes(val);
      onChange(formatTime(hours, val));
    }
  };

  const displayValue = formatDisplayTime(hours, minutes);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left bg-background h-10 pl-3 pr-3 gap-2 font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <Clock className="h-4 w-4 text-foreground/60 dark:text-foreground/80" />
          <span className="flex-1">{displayValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-4 glass-card dark:dark-glass-card" 
        align="start" 
        sideOffset={4}
      >
        <div className="flex flex-col gap-4">
          {/* Time display and controls */}
          <div className="flex items-center justify-center gap-2">
            {/* Hours */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent"
                onClick={() => handleHourChange(1)}
                disabled={disabled}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <input
                type="text"
                inputMode="numeric"
                value={hours}
                onChange={handleHourInput}
                className="w-14 h-14 text-center text-2xl font-semibold bg-background/50 dark:bg-background/30 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={disabled}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent"
                onClick={() => handleHourChange(-1)}
                disabled={disabled}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">时</span>
            </div>

            <span className="text-2xl font-bold text-muted-foreground mt-8">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent"
                onClick={() => handleMinuteChange(1)}
                disabled={disabled}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <input
                type="text"
                inputMode="numeric"
                value={minutes.toString().padStart(2, '0')}
                onChange={handleMinuteInput}
                className="w-14 h-14 text-center text-2xl font-semibold bg-background/50 dark:bg-background/30 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={disabled}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent"
                onClick={() => handleMinuteChange(-1)}
                disabled={disabled}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">分</span>
            </div>
          </div>

          {/* Quick select buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              [0, 0],
              [3, 40],
              [4, 10],
              [4, 40],
              [6, 0],
              [12, 0],
              [18, 0],
              [23, 59],
            ].map((time) => (
              <Button
                key={`${time[0]}:${time[1]}`}
                variant="secondary"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setHours(time[0]);
                  setMinutes(time[1]);
                  onChange(time as [number, number]);
                }}
                disabled={disabled}
              >
                {`${time[0]}:${time[1].toString().padStart(2, '0')}`}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
