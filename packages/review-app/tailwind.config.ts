/**
 * 模块职责：集中配置本模块的构建、测试或运行时装配规则。
 * 边界约束：配置变更必须与 workspace、TypeScript 和 Electron 的运行边界保持一致。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 基底色
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-overlay': 'var(--bg-overlay)',
        'bg-input': 'var(--bg-input)',

        // 文字色
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-disabled': 'var(--text-disabled)',
        'text-on-accent': 'var(--text-on-accent)',

        // 强调色
        'accent-cyan': 'var(--accent-cyan)',
        'accent-cyan-muted': 'var(--accent-cyan-muted)',
        'accent-cyan-subtle': 'var(--accent-cyan-subtle)',
        'accent-green': 'var(--accent-green)',
        'accent-red': 'var(--accent-red)',
        'accent-amber': 'var(--accent-amber)',
        'accent-purple': 'var(--accent-purple)',
        'accent-blue': 'var(--accent-blue)',

        // 边框色
        'border-default': 'var(--border-default)',
        'border-muted': 'var(--border-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-accent': 'var(--border-accent)',
      },
      fontFamily: {
        mono: ['var(--font-mono)'],
        sans: ['var(--font-sans)'],
      },
      boxShadow: {
        'glow-cyan': 'var(--shadow-glow-cyan)',
        'glow-red': 'var(--shadow-glow-red)',
        'inset-light': 'var(--shadow-inset)',
      },
      animation: {
        'pulse-border': 'high-risk-pulse 3s ease-in-out infinite',
        'glow': 'progress-glow 2s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        'high-risk-pulse': {
          '0%, 100%': { boxShadow: '-4px 0 12px rgba(248, 81, 73, 0.2)' },
          '50%': { boxShadow: '-4px 0 20px rgba(248, 81, 73, 0.35)' },
        },
        'progress-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(86, 212, 221, 0.3)' },
          '50%': { boxShadow: '0 0 16px rgba(86, 212, 221, 0.5)' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
