import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  safelist: [
    'bg-secondary/30',
    'bg-secondary/50',
    'bg-secondary/80',
    'backdrop-blur-sm',
    'backdrop-blur-md',
    'backdrop-blur-lg',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
		// 全部圆角 token 挂到 CSS 变量 --radius，由主题杂项「圆角强度」统一驱动。
		// 默认 --radius=24px 时：lg/3xl 等同当前观感；sm/md 略小一档。
		// rounded-full 仍为胶囊/圆形，不受此控制。
		borderRadius: {
			sm: 'max(0px, calc(var(--radius) - 4px))',
			DEFAULT: 'max(0px, calc(var(--radius) - 2px))',
			md: 'max(0px, calc(var(--radius) - 2px))',
			lg: 'var(--radius)',
			xl: 'var(--radius)',
			'2xl': 'var(--radius)',
			'3xl': 'var(--radius)',
		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			// 侧边栏图标 hover 微动画：播放一次后回到原位（末帧 = 恒等变换）
  			'sidebar-icon-pop': {
  				'0%': { transform: 'scale(1)' },
  				'35%': { transform: 'scale(1.22)' },
  				'60%': { transform: 'scale(0.9)' },
  				'100%': { transform: 'scale(1)' },
  			},
  			'sidebar-icon-bounce': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'30%': { transform: 'translateY(-3px)' },
  				'55%': { transform: 'translateY(1px)' },
  				'75%': { transform: 'translateY(-1px)' },
  			},
  			'sidebar-icon-wiggle': {
  				'0%, 100%': { transform: 'rotate(0deg)' },
  				'20%': { transform: 'rotate(-12deg)' },
  				'40%': { transform: 'rotate(10deg)' },
  				'60%': { transform: 'rotate(-6deg)' },
  				'80%': { transform: 'rotate(4deg)' },
  			},
  			'sidebar-icon-spin': {
  				'0%': { transform: 'rotate(0deg)' },
  				'55%': { transform: 'rotate(200deg)' },
  				'100%': { transform: 'rotate(360deg)' },
  			},
  			'sidebar-icon-pulse': {
  				'0%, 100%': { transform: 'scale(1)', opacity: '1' },
  				'40%': { transform: 'scale(1.18)', opacity: '0.85' },
  				'70%': { transform: 'scale(0.96)', opacity: '1' },
  			},
  			'sidebar-icon-tilt': {
  				'0%, 100%': { transform: 'rotate(0deg) translateX(0)' },
  				'30%': { transform: 'rotate(-8deg) translateX(-1px)' },
  				'60%': { transform: 'rotate(6deg) translateX(1px)' },
  			},
  			'sidebar-icon-nudge': {
  				'0%, 100%': { transform: 'translateX(0)' },
  				'40%': { transform: 'translateX(3px)' },
  				'70%': { transform: 'translateX(-1px)' },
  			},
			'sheet-slide-in-right': {
				from: { transform: 'translateX(100%)' },
				to: { transform: 'translateX(0)' },
			},
			'sheet-slide-out-right': {
				from: { transform: 'translateX(0)' },
				to: { transform: 'translateX(100%)' },
			},
			'sheet-overlay-in': {
				from: { opacity: '0' },
				to: { opacity: '1' },
			},
			'sheet-overlay-out': {
				from: { opacity: '1' },
				to: { opacity: '0' },
			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			// 侧边栏图标：只播一次，结束停在末帧（末帧已是静止态）
  			'sidebar-icon-pop': 'sidebar-icon-pop 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both',
  			'sidebar-icon-bounce': 'sidebar-icon-bounce 0.5s ease-out both',
  			'sidebar-icon-wiggle': 'sidebar-icon-wiggle 0.5s ease-in-out both',
  			// spin 转满一圈回到视觉 0°；离开 hover 时 class 移除也会自然还原
  			'sidebar-icon-spin': 'sidebar-icon-spin 0.55s cubic-bezier(0.34, 1.2, 0.64, 1) both',
  			'sidebar-icon-pulse': 'sidebar-icon-pulse 0.45s ease-out both',
  			'sidebar-icon-tilt': 'sidebar-icon-tilt 0.45s ease-out both',
  			'sidebar-icon-nudge': 'sidebar-icon-nudge 0.4s ease-out both',
			'sheet-slide-in-right': 'sheet-slide-in-right 0.48s cubic-bezier(0.32, 0.72, 0, 1) both',
			'sheet-slide-out-right': 'sheet-slide-out-right 0.38s cubic-bezier(0.4, 0, 0.6, 1) both',
			'sheet-overlay-in': 'sheet-overlay-in 0.4s cubic-bezier(0.32, 0.72, 0, 1) both',
			'sheet-overlay-out': 'sheet-overlay-out 0.32s cubic-bezier(0.4, 0, 0.6, 1) both',
  		},
  		boxShadow: {
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)'
  		},
  		fontFamily: {
  			sans: [
  				'Poppins',
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'Noto Sans',
  				'sans-serif'
  			],
  			serif: [
  				'Merriweather',
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			mono: [
  				'JetBrains Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			]
  		},
  		// 自定义 transition-timing-function。
  		// 之前直接在 className 中写 `ease-[cubic-bezier(0.4,0,0.2,1)]` 会被
  		// Tailwind v3.4 的内容扫描器判定为 "ambiguous class"，刷出警告：
  		//   warn - The class `ease-[cubic-bezier(0.4,0,0.2,1)]` is ambiguous
  		// 这里提供一个语义化的命名 ease `ease-out-soft` 替代之。
  		transitionTimingFunction: {
  			'out-soft': 'cubic-bezier(0.4, 0, 0.2, 1)',
  			'in-out-soft': 'cubic-bezier(0.45, 0, 0.55, 1)',
  		},
  	}
  },
  plugins: [
    // tailwind 配置文件常用 require 加载 CJS 插件
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("tailwindcss-animate"),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@tailwindcss/typography"),
  ],
} satisfies Config;
