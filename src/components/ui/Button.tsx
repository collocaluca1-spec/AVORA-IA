import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from './cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-normal tracking-wide transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed select-none whitespace-nowrap'
const variants: Record<Variant, string> = {
  primary: 'bg-cocoa-800 text-cream-50 hover:bg-cocoa-900 shadow-soft hover:shadow-lift',
  secondary: 'bg-cream-50 text-cocoa-800 ring-1 ring-cream-300 hover:ring-champagne-300 hover:bg-white',
  ghost: 'text-cocoa-700 hover:bg-cream-200/70',
  gold: 'bg-gradient-to-b from-champagne-300 to-gold-500 text-cocoa-900 hover:brightness-105 shadow-soft',
  danger: 'bg-cream-50 text-rose-600 ring-1 ring-rose-100 hover:bg-rose-100',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[0.8rem]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-[0.95rem]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  )
})

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
