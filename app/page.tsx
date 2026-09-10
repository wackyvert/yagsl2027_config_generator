"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Upload, Download, ChevronLeft, ChevronRight, BookOpen, MessageCircle } from "lucide-react"
import { SwerveVisualizer } from "@/components/swerve-visualizer"
import { analyzeSwerve } from "@/lib/swerve-analysis"
import { GyroConfig } from "@/components/gyro-config"
import { ModuleConfig } from "@/components/module-config"
import { PhysicalProperties } from "@/components/physical-properties"
import { PIDFProperties } from "@/components/pidf-properties"
import { generateZip, uploadZip } from "@/lib/zip-utils"
import { useToast } from "@/hooks/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"
import { PrintButton } from "@/components/print-button"
import { ConfigPrintView } from "@/components/config-print-view"
import { withBasePath } from "@/lib/base-path"
import type { ConfigData } from "@/lib/types"

export default function Home() {
  const { toast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("gyro")

  const [config, setConfig] = useState<ConfigData>({
    swervedrive: {
      gyro: {
        type: "pigeon2_can",
        id: 0,
        canbus: "",
      },
      gyroAxis: "yaw",
      gyroInvert: false,
      modules: ["frontleft.json", "frontright.json", "backleft.json", "backright.json"],
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
  })

  const tabs = ["gyro", "frontleft", "frontright", "backleft", "backright", "properties", "visualizer"]
  const currentTabIndex = tabs.indexOf(activeTab)
  const isFirstTab = currentTabIndex === 0
  const isLastTab = currentTabIndex === tabs.length - 1

  const handleNext = () => {
    if (!isLastTab) {
      setActiveTab(tabs[currentTabIndex + 1])
    }
  }

  const handleBack = () => {
    if (!isFirstTab) {
      setActiveTab(tabs[currentTabIndex - 1])
    }
  }

  const handleDownload = async () => {
    const errors = analyzeSwerve(config).findings.filter(f => f.severity === "error")
    if (errors.length) {
      setActiveTab("visualizer")
      toast({
        title: "Correct configuration errors before export",
        description: errors[0].message,
        variant: "destructive",
      })
      return
    }
    try {
      await generateZip(config)
      router.push("/guide")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate zip",
        variant: "destructive",
      })
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const loadedConfig = await uploadZip(file)
      setConfig(loadedConfig)
      toast({
        title: "Success",
        description: "Configuration loaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load configuration",
        variant: "destructive",
      })
    }
    event.target.value = ""
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Image
                src={withBasePath("/logo.png")}
                alt="Swerve Drive Config Generator mascot"
                width={40}
                height={40}
                className="h-8 w-8 md:h-10 md:w-10"
                style={{ imageRendering: "pixelated" }}
              />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Swerve Drive Config Generator</h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Configure your robot's swerve drive system (YAGSL)
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center no-print">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:min-w-0">
                <Button variant="outline" className="w-full sm:w-auto bg-transparent" asChild>
                  <a href="https://discord.gg/yass" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Need Help?
                  </a>
                </Button>
                <Button variant="outline" className="w-full sm:w-auto bg-transparent" asChild>
                  <Link href="/guide">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Quick Start Guide
                  </Link>
                </Button>
                <Button variant="outline" className="w-full sm:w-auto bg-transparent" asChild>
                  <label className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Config
                    <input type="file" accept=".zip" onChange={handleUpload} className="hidden" />
                  </label>
                </Button>
                <PrintButton className="w-full sm:w-auto bg-transparent" />
                <Button onClick={handleDownload} className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Download Config
                </Button>
              </div>
              <div className="flex justify-end sm:justify-start">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 md:py-8 print:max-w-none print:p-0">
        <Card className="p-4 md:p-6 no-print">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="mb-6 -mx-4 px-4 overflow-x-auto">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="gyro" className="whitespace-nowrap">
                  Gyro
                </TabsTrigger>
                <TabsTrigger value="frontleft" className="whitespace-nowrap">
                  Front Left
                </TabsTrigger>
                <TabsTrigger value="frontright" className="whitespace-nowrap">
                  Front Right
                </TabsTrigger>
                <TabsTrigger value="backleft" className="whitespace-nowrap">
                  Back Left
                </TabsTrigger>
                <TabsTrigger value="backright" className="whitespace-nowrap">
                  Back Right
                </TabsTrigger>
                <TabsTrigger value="properties" className="whitespace-nowrap">
                  Properties
                </TabsTrigger>
                <TabsTrigger value="visualizer" className="whitespace-nowrap">
                  3D & Checks
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="gyro">
              <GyroConfig
                config={config.swervedrive}
                onChange={(updated) => setConfig({ ...config, swervedrive: updated })}
              />
            </TabsContent>

            <TabsContent value="frontleft">
              <ModuleConfig
                moduleName="Front Left"
                config={config.modules.frontleft}
                onChange={(updated) =>
                  setConfig({
                    ...config,
                    modules: { ...config.modules, frontleft: updated },
                  })
                }
              />
            </TabsContent>

            <TabsContent value="frontright">
              <ModuleConfig
                moduleName="Front Right"
                config={config.modules.frontright}
                onChange={(updated) =>
                  setConfig({
                    ...config,
                    modules: { ...config.modules, frontright: updated },
                  })
                }
              />
            </TabsContent>

            <TabsContent value="backleft">
              <ModuleConfig
                moduleName="Back Left"
                config={config.modules.backleft}
                onChange={(updated) =>
                  setConfig({
                    ...config,
                    modules: { ...config.modules, backleft: updated },
                  })
                }
              />
            </TabsContent>

            <TabsContent value="backright">
              <ModuleConfig
                moduleName="Back Right"
                config={config.modules.backright}
                onChange={(updated) =>
                  setConfig({
                    ...config,
                    modules: { ...config.modules, backright: updated },
                  })
                }
              />
            </TabsContent>

            <TabsContent value="properties">
              <div className="space-y-6">
                <PhysicalProperties
                  config={config.physicalproperties}
                  onChange={(updated) => setConfig({ ...config, physicalproperties: updated })}
                />
                <PIDFProperties
                  config={config.pidfproperties}
                  onChange={(updated) => setConfig({ ...config, pidfproperties: updated })}
                />
              </div>
            </TabsContent>

            <TabsContent value="visualizer">
              <SwerveVisualizer config={config} onEdit={setActiveTab} />
            </TabsContent>

            <div className="flex justify-between items-center gap-4 mt-6 pt-6 border-t border-border no-print">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isFirstTab}
                className="flex-1 md:flex-none bg-transparent"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button onClick={handleNext} disabled={isLastTab} className="flex-1 md:flex-none">
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Tabs>
        </Card>

        <div className="hidden print:block">
          <ConfigPrintView config={config} />
        </div>
      </main>
    </div>
  )
}
