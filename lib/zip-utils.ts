import JSZip from "jszip"
import FileSaver from "file-saver"
import type { ConfigData, ModuleConfigData } from "./types"

export const SCHEMA_BASE_URL = "https://example.com/schemas"

function cleanModuleForExport(module: ModuleConfigData): any {
  const isAttached = module.absoluteEncoder.type.endsWith("_attached")
  const usesChannel = module.absoluteEncoder.type.endsWith("_dio") || module.absoluteEncoder.type.endsWith("_analog")

  // Remove useCosineCompensator from export
  const { useCosineCompensator, ...moduleWithoutCosine } = module

  if (isAttached) {
    // For attached encoders, set all encoder fields to defaults
    return {
      ...moduleWithoutCosine,
      absoluteEncoder: {
        ...module.absoluteEncoder,
        id: 0,
        channel: 0,
        canbus: "",
      },
    }
  } else if (usesChannel) {
    // For DIO/Analog encoders, set CAN ID to 0 and CAN Bus to empty string
    return {
      ...moduleWithoutCosine,
      absoluteEncoder: {
        ...module.absoluteEncoder,
        id: 0,
        canbus: "",
      },
    }
  }

  return moduleWithoutCosine
}

export async function generateZip(config: ConfigData) {
  const zip = new JSZip()

  const swervedriveWithSchema = {
    $schema: `${SCHEMA_BASE_URL}/swervedrive.json`,
    ...config.swervedrive,
  }
  zip.file("swervedrive.json", JSON.stringify(swervedriveWithSchema, null, 2))

  // Add modules folder
  const modulesFolder = zip.folder("modules")
  if (!modulesFolder) throw new Error("Failed to create modules folder")

  const frontleftWithSchema = {
    $schema: `${SCHEMA_BASE_URL}/module.json`,
    ...cleanModuleForExport(config.modules.frontleft),
  }
  const frontrightWithSchema = {
    $schema: `${SCHEMA_BASE_URL}/module.json`,
    ...cleanModuleForExport(config.modules.frontright),
  }
  const backleftWithSchema = {
    $schema: `${SCHEMA_BASE_URL}/module.json`,
    ...cleanModuleForExport(config.modules.backleft),
  }
  const backrightWithSchema = {
    $schema: `${SCHEMA_BASE_URL}/module.json`,
    ...cleanModuleForExport(config.modules.backright),
  }

  modulesFolder.file("frontleft.json", JSON.stringify(frontleftWithSchema, null, 2))
  modulesFolder.file("frontright.json", JSON.stringify(frontrightWithSchema, null, 2))
  modulesFolder.file("backleft.json", JSON.stringify(backleftWithSchema, null, 2))
  modulesFolder.file("backright.json", JSON.stringify(backrightWithSchema, null, 2))

  const physicalpropertiesWithSchema = {
    $schema: `${SCHEMA_BASE_URL}/physicalproperties.json`,
    ...config.physicalproperties,
  }
  const pidfpropertiesWithSchema = {
    $schema: `${SCHEMA_BASE_URL}/pidfproperties.json`,
    ...config.pidfproperties,
  }

  modulesFolder.file("physicalproperties.json", JSON.stringify(physicalpropertiesWithSchema, null, 2))
  modulesFolder.file("pidfproperties.json", JSON.stringify(pidfpropertiesWithSchema, null, 2))

  // Generate and download zip
  const blob = await zip.generateAsync({ type: "blob" })
  FileSaver.saveAs(blob, "swerve-config.zip")
}

export async function uploadZip(file: File): Promise<ConfigData> {
  try {
    const zip = await JSZip.loadAsync(file)

    // Validate required files exist
    const requiredFiles = [
      "swervedrive.json",
      "modules/frontleft.json",
      "modules/frontright.json",
      "modules/backleft.json",
      "modules/backright.json",
      "modules/physicalproperties.json",
      "modules/pidfproperties.json",
    ]

    for (const filePath of requiredFiles) {
      if (!zip.file(filePath)) {
        throw new Error(`Missing required file: ${filePath}`)
      }
    }

    // Read and parse files
    const swervedriveFile = zip.file("swervedrive.json")
    const frontleftFile = zip.file("modules/frontleft.json")
    const frontrightFile = zip.file("modules/frontright.json")
    const backleftFile = zip.file("modules/backleft.json")
    const backrightFile = zip.file("modules/backright.json")
    const physicalpropertiesFile = zip.file("modules/physicalproperties.json")
    const pidfpropertiesFile = zip.file("modules/pidfproperties.json")

    if (
      !swervedriveFile ||
      !frontleftFile ||
      !frontrightFile ||
      !backleftFile ||
      !backrightFile ||
      !physicalpropertiesFile ||
      !pidfpropertiesFile
    ) {
      throw new Error("One or more required files are missing")
    }

    const [
      swervedriveText,
      frontleftText,
      frontrightText,
      backleftText,
      backrightText,
      physicalpropertiesText,
      pidfpropertiesText,
    ] = await Promise.all([
      swervedriveFile.async("text"),
      frontleftFile.async("text"),
      frontrightFile.async("text"),
      backleftFile.async("text"),
      backrightFile.async("text"),
      physicalpropertiesFile.async("text"),
      pidfpropertiesFile.async("text"),
    ])

    // Parse JSON
    const swervedrive = JSON.parse(swervedriveText)
    const frontleft = JSON.parse(frontleftText)
    const frontright = JSON.parse(frontrightText)
    const backleft = JSON.parse(backleftText)
    const backright = JSON.parse(backrightText)
    const physicalproperties = JSON.parse(physicalpropertiesText)
    const pidfproperties = JSON.parse(pidfpropertiesText)

    // Validate structure
    validateConfig(swervedrive, frontleft, frontright, backleft, backright, physicalproperties, pidfproperties)

    return {
      swervedrive,
      modules: {
        frontleft,
        frontright,
        backleft,
        backright,
      },
      physicalproperties,
      pidfproperties,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid configuration file: ${error.message}`)
    }
    throw new Error("Invalid configuration file")
  }
}

function validateConfig(
  swervedrive: any,
  frontleft: any,
  frontright: any,
  backleft: any,
  backright: any,
  physicalproperties: any,
  pidfproperties: any,
) {
  // Validate swervedrive
  if (!swervedrive.gyro || !swervedrive.gyro.type || typeof swervedrive.gyro.id !== "number") {
    throw new Error("Invalid swervedrive.json: Missing or invalid gyro configuration")
  }

  if (!Array.isArray(swervedrive.modules) || swervedrive.modules.length < 3) {
    throw new Error("Invalid swervedrive.json: modules array must have at least 3 items")
  }

  // Validate modules
  const validateModule = (module: any, name: string) => {
    if (!module.drive || !module.angle || !module.absoluteEncoder || !module.location || !module.inverted) {
      throw new Error(`Invalid ${name}: Missing required properties`)
    }
    if (typeof module.absoluteEncoderOffset !== "number") {
      throw new Error(`Invalid ${name}: absoluteEncoderOffset must be a number`)
    }
  }

  validateModule(frontleft, "frontleft.json")
  validateModule(frontright, "frontright.json")
  validateModule(backleft, "backleft.json")
  validateModule(backright, "backright.json")

  // Validate physical properties
  if (!physicalproperties.gearing || !physicalproperties.gearing.drive || !physicalproperties.gearing.angle) {
    throw new Error("Invalid physicalproperties.json: Missing gearing configuration")
  }

  // Validate PID properties
  if (!pidfproperties.drive || !pidfproperties.angle) {
    throw new Error("Invalid pidfproperties.json: Missing drive or angle configuration")
  }

  if (
    typeof pidfproperties.drive.p !== "number" ||
    typeof pidfproperties.drive.i !== "number" ||
    typeof pidfproperties.drive.d !== "number"
  ) {
    throw new Error("Invalid pidfproperties.json: PID values must be numbers")
  }
}
