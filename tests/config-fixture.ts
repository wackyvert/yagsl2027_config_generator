import type { ConfigData } from "../lib/types"
export const fixture: ConfigData = {
  swervedrive: {
    gyro: {
      type: "pigeon2_can",
      id: 0,
      canbus: "",
    },
    gyroAxis: "yaw",
    gyroInvert: false,
    modules: [
      "frontleft.json",
      "frontright.json",
      "backleft.json",
      "backright.json",
    ],
  },
  modules: {
    frontleft: {
      drive: { type: "sparkmax_neo", id: 1, canbus: "" },
      angle: { type: "sparkmax_neo", id: 2, canbus: "" },
      inverted: { drive: false, angle: false },
      absoluteEncoder: { type: "cancoder_can", id: 3, channel: 0, canbus: "" },
      absoluteEncoderOffset: 0,
      absoluteEncoderInverted: false,
      location: { front: 10, left: 10 },
    },
    frontright: {
      drive: { type: "sparkmax_neo", id: 4, canbus: "" },
      angle: { type: "sparkmax_neo", id: 5, canbus: "" },
      inverted: { drive: false, angle: false },
      absoluteEncoder: { type: "cancoder_can", id: 6, channel: 0, canbus: "" },
      absoluteEncoderOffset: 0,
      absoluteEncoderInverted: false,
      location: { front: 10, left: -10 },
    },
    backleft: {
      drive: { type: "sparkmax_neo", id: 7, canbus: "" },
      angle: { type: "sparkmax_neo", id: 8, canbus: "" },
      inverted: { drive: false, angle: false },
      absoluteEncoder: { type: "cancoder_can", id: 9, channel: 0, canbus: "" },
      absoluteEncoderOffset: 0,
      absoluteEncoderInverted: false,
      location: { front: -10, left: 10 },
    },
    backright: {
      drive: { type: "sparkmax_neo", id: 10, canbus: "" },
      angle: { type: "sparkmax_neo", id: 11, canbus: "" },
      inverted: { drive: false, angle: false },
      absoluteEncoder: { type: "cancoder_can", id: 12, channel: 0, canbus: "" },
      absoluteEncoderOffset: 0,
      absoluteEncoderInverted: false,
      location: { front: -10, left: -10 },
    },
  },
  physicalproperties: {
    gearing: {
      drive: { gearRatio: 6.75, diameter: 4 },
      angle: { gearRatio: 12.8 },
    },
  },
  pidfproperties: {
    drive: { p: 0.1, i: 0, d: 0 },
    angle: { p: 0.01, i: 0, d: 0 },
  },
}
