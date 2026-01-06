"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { PhysicalPropertiesConfig } from "@/lib/types"

interface PhysicalPropertiesProps {
  config: PhysicalPropertiesConfig
  onChange: (config: PhysicalPropertiesConfig) => void
}

export function PhysicalProperties({ config, onChange }: PhysicalPropertiesProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Physical Properties</h3>

      {/* Drive Gearing */}
      <div>
        <h4 className="text-sm font-medium mb-3 text-muted-foreground">Drive Gearing</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Gear Ratio (X:1)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.gearing.drive.gearRatio}
              onChange={(e) =>
                onChange({
                  ...config,
                  gearing: {
                    ...config.gearing,
                    drive: {
                      ...config.gearing.drive,
                      gearRatio: Number(e.target.value),
                    },
                  },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Wheel Diameter (inches)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.gearing.drive.diameter}
              onChange={(e) =>
                onChange({
                  ...config,
                  gearing: {
                    ...config.gearing,
                    drive: {
                      ...config.gearing.drive,
                      diameter: Number(e.target.value),
                    },
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Angle Gearing */}
      <div>
        <h4 className="text-sm font-medium mb-3 text-muted-foreground">Angle Gearing</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Gear Ratio (X:1)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.gearing.angle.gearRatio}
              onChange={(e) =>
                onChange({
                  ...config,
                  gearing: {
                    ...config.gearing,
                    angle: {
                      ...config.gearing.angle,
                      gearRatio: Number(e.target.value),
                    },
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Stator Current Limits */}
      <div>
        <h4 className="text-sm font-medium mb-3 text-muted-foreground">Stator Current Limits (Optional)</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Drive Motor (A)</Label>
            <Input
              type="number"
              placeholder="40 (default)"
              value={config.statorCurrentLimit?.drive ?? ""}
              onChange={(e) =>
                onChange({
                  ...config,
                  statorCurrentLimit: {
                    ...config.statorCurrentLimit,
                    drive: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Angle Motor (A)</Label>
            <Input
              type="number"
              placeholder="20 (default)"
              value={config.statorCurrentLimit?.angle ?? ""}
              onChange={(e) =>
                onChange({
                  ...config,
                  statorCurrentLimit: {
                    ...config.statorCurrentLimit,
                    angle: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
