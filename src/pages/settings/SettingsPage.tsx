import { NavLink, Navigate, useParams } from 'react-router-dom'
import { Palette, CalendarRange, SlidersHorizontal, Cpu, Camera, Plane, Workflow, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/components/ui/cn'
import { BrandSection } from './BrandSection'
import { FrequencySection } from './FrequencySection'
import { PreferencesSection } from './PreferencesSection'
import { AiIntegrationsSection, InstagramSection, ProvidersSection } from './IntegrationSections'
import { AutomationsSection } from './AutomationsSection'
import { TeamSection } from './TeamSection'

const SECTIONS = [
  { id: 'identidad', label: 'Identidad de marca', icon: Palette, el: BrandSection },
  { id: 'frecuencia', label: 'Frecuencia de publicación', icon: CalendarRange, el: FrequencySection },
  { id: 'preferencias', label: 'Preferencias de contenido', icon: SlidersHorizontal, el: PreferencesSection },
  { id: 'integraciones-ia', label: 'Integraciones de IA', icon: Cpu, el: AiIntegrationsSection },
  { id: 'instagram', label: 'Instagram', icon: Camera, el: InstagramSection },
  { id: 'proveedores', label: 'Proveedores turísticos', icon: Plane, el: ProvidersSection },
  { id: 'automatizaciones', label: 'Automatizaciones', icon: Workflow, el: AutomationsSection },
  { id: 'equipo', label: 'Equipo', icon: Users, el: TeamSection },
]

export default function SettingsPage() {
  const { section } = useParams()
  const { isAdmin } = useAuth()
  if (!section) return <Navigate to="/configuracion/identidad" replace />
  const current = SECTIONS.find((s) => s.id === section)
  if (!current) return <Navigate to="/configuracion/identidad" replace />
  const Section = current.el

  return (
    <>
      <PageHeader
        eyebrow="Configuración"
        title={current.label}
        description={!isAdmin ? 'Solo los administradores pueden modificar la configuración. Estás viendo en modo lectura.' : undefined}
      />
      <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
        <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              to={`/configuracion/${s.id}`}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[0.85rem] transition',
                  isActive ? 'bg-cream-50 text-cocoa-900 shadow-soft ring-1 ring-cream-300' : 'text-cocoa-500 hover:bg-cream-200/60 hover:text-cocoa-800',
                )
              }
            >
              <s.icon className="size-4 text-gold-500" strokeWidth={1.5} />
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Section />
        </div>
      </div>
    </>
  )
}
