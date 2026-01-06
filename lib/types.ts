export interface GyroConfig {
  type: string
  id: number
  canbus: string
}

export interface SwervedriveConfig {
  gyro: GyroConfig
  gyroAxis: "yaw" | "pitch" | "roll"
  gyroInvert: boolean
  modules: string[]
}

export interface MotorConfig {
  type: string
  id: number
  canbus: string
}

export interface AbsoluteEncoderConfig {
  type: string
  id: number
  channel: number
  canbus: string
}

export interface ModuleConfigData {
  drive: MotorConfig
  angle: MotorConfig
  inverted: {
    drive: boolean
    angle: boolean
  }
  absoluteEncoder: AbsoluteEncoderConfig
  absoluteEncoderOffset: number
  absoluteEncoderInverted: boolean
  location: {
    front: number
    left: number
  }
  useCosineCompensator?: boolean
  gearing?: {
    drive: {
      gearRatio: number
      diameter: number
    }
    angle: {
      gearRatio: number
    }
  }
}

export interface PhysicalPropertiesConfig {
  gearing: {
    drive: {
      gearRatio: number
      diameter: number
    }
    angle: {
      gearRatio: number
    }
  }
  statorCurrentLimit?: {
    drive?: number
    angle?: number
  }
}

export interface PIDFPropertiesConfig {
  drive: {
    p: number
    i: number
    d: number
  }
  angle: {
    p: number
    i: number
    d: number
  }
}

export interface ConfigData {
  swervedrive: SwervedriveConfig
  modules: {
    frontleft: ModuleConfigData
    frontright: ModuleConfigData
    backleft: ModuleConfigData
    backright: ModuleConfigData
  }
  physicalproperties: PhysicalPropertiesConfig
  pidfproperties: PIDFPropertiesConfig
}
