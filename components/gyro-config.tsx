"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { SwervedriveConfig } from "@/lib/types"

interface GyroConfigProps {
  config: SwervedriveConfig
  onChange: (config: SwervedriveConfig) => void
}

const GYRO_TYPES = ["navx_mxp", "navx2_usb1", "navx2_usb2", "navx3_can", "pigeon2", "canandgyro", "systemcore"]

const GYRO_AXES = ["yaw", "pitch", "roll"]

export function GyroConfig({ config, onChange }: GyroConfigProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Gyroscope Configuration</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gyro-type">Gyro Type</Label>
            <Select
              value={config.gyro.type}
              onValueChange={(value) =>
                onChange({
                  ...config,
                  gyro: { ...config.gyro, type: value as any },
                })
              }
            >
              <SelectTrigger id="gyro-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GYRO_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gyro-id">CAN ID</Label>
            <Input
              id="gyro-id"
              type="number"
              value={config.gyro.id}
              onChange={(e) =>
                onChange({
                  ...config,
                  gyro: { ...config.gyro, id: Number(e.target.value) },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gyro-canbus">CAN Bus Name</Label>
            <Input
              id="gyro-canbus"
              value={config.gyro.canbus}
              placeholder="Leave empty for default"
              onChange={(e) =>
                onChange({
                  ...config,
                  gyro: { ...config.gyro, canbus: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gyro-axis">Gyro Axis</Label>
            <Select value={config.gyroAxis} onValueChange={(value) => onChange({ ...config, gyroAxis: value as any })}>
              <SelectTrigger id="gyro-axis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GYRO_AXES.map((axis) => (
                  <SelectItem key={axis} value={axis}>
                    {axis}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 pt-8">
            <Checkbox
              id="gyro-invert"
              checked={config.gyroInvert}
              onCheckedChange={(checked) => onChange({ ...config, gyroInvert: checked as boolean })}
            />
            <Label htmlFor="gyro-invert" className="cursor-pointer">
              Invert Gyroscope
            </Label>
          </div>
        </div>
      </div>
    </div>
  )
}
