import type { ReactNode } from 'react'
import { Logo } from '@/components/layout/Logo'

/** Pantalla dividida para acceso: imagen de marca + formulario. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-cocoa-800 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(216,191,138,0.22),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(184,149,90,0.18),transparent_50%)]" />
        <svg className="absolute -right-24 -bottom-24 size-[38rem] opacity-[0.07]" viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="98" fill="none" stroke="#e9d9b5" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#e9d9b5" />
          <path d="M2 100h196M100 2v196" stroke="#e9d9b5" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-14">
          <Logo light />
          <div className="max-w-md">
            <p className="eyebrow mb-5 text-champagne-300">Marketing supervisado</p>
            <h1 className="font-display text-[3.2rem] leading-[1.02] text-cream-50">
              Cada historia de viaje, <em className="text-champagne-300">curada</em> antes de salir al mundo.
            </h1>
            <div className="gold-rule my-8 w-40" />
            <p className="text-sm leading-relaxed text-cream-200/70">
              Panel privado de AVORA TRAVEL para planificar, crear y aprobar el contenido de Instagram.
            </p>
          </div>
          <p className="text-xs text-cream-200/40">Acceso exclusivo del equipo</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  )
}
