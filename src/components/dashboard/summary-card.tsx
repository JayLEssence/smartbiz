'use client'

import { Card, CardContent } from '@/components/ui/card'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SummaryCardProps {
  title: string
  value: string
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  className?: string
}

export function SummaryCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  className,
}: SummaryCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-base sm:text-xl lg:text-2xl font-bold break-words leading-tight">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs font-medium',
                  trendUp ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {trendUp ? '↑' : '↓'} {trend}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              className
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
