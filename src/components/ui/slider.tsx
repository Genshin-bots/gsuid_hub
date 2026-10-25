import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  animate?: boolean;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, animate = false, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none select-none items-center',
      animate && [
        '[&>span:has([role=slider])]:transition-[left,right,top,bottom] [&>span:has([role=slider])]:duration-350 [&>span:has([role=slider])]:ease-spring',
        '[&>span[style*="absolute"]]:transition-[left,right,top,bottom] [&>span[style*="absolute"]]:duration-350 [&>span[style*="absolute"]]:ease-spring',
      ],
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range
        className={cn(
          'absolute h-full bg-primary',
          animate && 'transition-[left,right,top,bottom] duration-350 ease-spring',
        )}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        animate && 'transition-[left,right,top,bottom,colors] duration-350 ease-spring',
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
