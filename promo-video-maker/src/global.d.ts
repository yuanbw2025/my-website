export interface SelectedImage {
  id: string
  path: string
  name: string
  url: string
}

export interface VoiceoverResult {
  audioPath: string
  duration: number | null
}

export interface ExportScenePayload {
  id: string
  imagePath: string
  script: string
  duration: number
  audioPath?: string
}

declare global {
  interface Window {
    promoVideo: {
      selectImages: () => Promise<SelectedImage[]>
      selectOutput: () => Promise<string | null>
      generateVoiceover: (payload: { sceneId: string; text: string; voice?: string }) => Promise<VoiceoverResult>
      exportVideo: (payload: {
        scenes: ExportScenePayload[]
        outputPath: string
        aspectRatio: '16:9' | '9:16'
        includeSubtitles: boolean
      }) => Promise<{ outputPath: string }>
    }
  }
}

