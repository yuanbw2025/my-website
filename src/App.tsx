import { useMemo, useState } from 'react'
import './App.css'

type AspectRatio = '16:9' | '9:16'
type Status = 'idle' | 'working' | 'done' | 'error'

interface Scene {
  id: string
  imagePath: string
  imageUrl: string
  imageName: string
  script: string
  duration: number
  audioPath?: string
  audioDuration?: number | null
}

const defaultScript = '这里填写这张截图对应的讲解文稿。'

function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}

function estimateDuration(text: string) {
  const chars = text.replace(/\s/g, '').length
  return Math.max(3, Math.ceil(chars / 5))
}

function App() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [includeSubtitles, setIncludeSubtitles] = useState(true)
  const [voice, setVoice] = useState('Tingting')
  const [status, setStatus] = useState<Status>('idle')
  const [statusText, setStatusText] = useState('准备就绪')

  const selectedScene = scenes.find((scene) => scene.id === selectedId) ?? scenes[0]
  const totalDuration = useMemo(
    () => scenes.reduce((sum, scene) => sum + scene.duration, 0),
    [scenes],
  )

  async function addImages() {
    const images = await window.promoVideo.selectImages()
    if (images.length === 0) return
    const nextScenes = images.map((image): Scene => ({
      id: image.id,
      imagePath: image.path,
      imageUrl: image.url,
      imageName: image.name,
      script: defaultScript,
      duration: 6,
    }))
    setScenes((prev) => [...prev, ...nextScenes])
    setSelectedId((current) => current ?? nextScenes[0]?.id ?? null)
  }

  function updateScene(id: string, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)))
  }

  function removeScene(id: string) {
    setScenes((prev) => {
      const next = prev.filter((scene) => scene.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  function moveScene(id: string, direction: -1 | 1) {
    setScenes((prev) => {
      const index = prev.findIndex((scene) => scene.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  async function generateVoiceover(scene: Scene) {
    setStatus('working')
    setStatusText(`正在生成配音：${scene.imageName}`)
    try {
      const result = await window.promoVideo.generateVoiceover({
        sceneId: scene.id,
        text: scene.script,
        voice,
      })
      updateScene(scene.id, {
        audioPath: result.audioPath,
        audioDuration: result.duration,
        duration: Math.max(scene.duration, Math.ceil(result.duration ?? scene.duration)),
      })
      setStatus('done')
      setStatusText('配音已生成')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : String(error))
    }
  }

  async function generateAllVoiceovers() {
    for (const scene of scenes) {
      await generateVoiceover(scene)
    }
  }

  async function exportVideo() {
    if (scenes.length === 0) return
    const outputPath = await window.promoVideo.selectOutput()
    if (!outputPath) return
    setStatus('working')
    setStatusText('正在导出 MP4，时间取决于图片数量和视频长度')
    try {
      const result = await window.promoVideo.exportVideo({
        outputPath,
        aspectRatio,
        includeSubtitles,
        scenes: scenes.map((scene) => ({
          id: scene.id,
          imagePath: scene.imagePath,
          script: scene.script,
          duration: scene.duration,
          audioPath: scene.audioPath,
        })),
      })
      setStatus('done')
      setStatusText(`导出完成：${result.outputPath}`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="brand">
          <div>
            <p className="eyebrow">Promo Video Maker</p>
            <h1>懒人项目推广视频生成器</h1>
          </div>
          <button className="primary" onClick={addImages}>添加截图</button>
        </header>

        <section className="settings">
          <label>
            视频比例
            <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}>
              <option value="16:9">B站横版 16:9</option>
              <option value="9:16">抖音竖版 9:16</option>
            </select>
          </label>
          <label>
            配音音色
            <select value={voice} onChange={(event) => setVoice(event.target.value)}>
              <option value="Tingting">Tingting 中文女声</option>
              <option value="Sinji">Sinji 中文男声</option>
              <option value="Meijia">Meijia 中文女声</option>
              <option value="Daniel">Daniel 英文男声</option>
              <option value="Samantha">Samantha 英文女声</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeSubtitles}
              onChange={(event) => setIncludeSubtitles(event.target.checked)}
            />
            导出字幕
          </label>
        </section>

        <section className="summary">
          <span>{scenes.length} 张截图</span>
          <span>总时长 {formatDuration(totalDuration)}</span>
        </section>

        <section className="scene-list">
          {scenes.length === 0 ? (
            <div className="empty">
              <strong>还没有截图</strong>
              <span>添加项目截图后，每张图会成为一个讲解镜头。</span>
            </div>
          ) : scenes.map((scene, index) => (
            <button
              key={scene.id}
              className={`scene-item ${selectedScene?.id === scene.id ? 'active' : ''}`}
              onClick={() => setSelectedId(scene.id)}
            >
              <img src={scene.imageUrl} alt="" />
              <div>
                <strong>{index + 1}. {scene.imageName}</strong>
                <span>{formatDuration(scene.duration)} · {scene.audioPath ? '已配音' : '未配音'}</span>
              </div>
            </button>
          ))}
        </section>

        <footer className={`status ${status}`}>
          <span>{statusText}</span>
        </footer>
      </aside>

      <section className="workspace">
        {selectedScene ? (
          <>
            <div className="preview-panel">
              <div className={`preview-frame ${aspectRatio === '9:16' ? 'portrait' : 'landscape'}`}>
                <img src={selectedScene.imageUrl} alt={selectedScene.imageName} />
                {includeSubtitles && selectedScene.script.trim() && (
                  <div className="subtitle-preview">{selectedScene.script}</div>
                )}
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-header">
                <div>
                  <p className="eyebrow">当前镜头</p>
                  <h2>{selectedScene.imageName}</h2>
                </div>
                <div className="row-actions">
                  <button onClick={() => moveScene(selectedScene.id, -1)}>上移</button>
                  <button onClick={() => moveScene(selectedScene.id, 1)}>下移</button>
                  <button className="danger" onClick={() => removeScene(selectedScene.id)}>删除</button>
                </div>
              </div>

              <label className="field">
                讲解文稿
                <textarea
                  value={selectedScene.script}
                  onChange={(event) => updateScene(selectedScene.id, { script: event.target.value })}
                  placeholder="写这张截图要讲的话。"
                />
              </label>

              <div className="grid-two">
                <label className="field">
                  展示时长（秒）
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={selectedScene.duration}
                    onChange={(event) => updateScene(selectedScene.id, { duration: Number(event.target.value) })}
                  />
                </label>
                <button
                  className="secondary fit"
                  onClick={() => updateScene(selectedScene.id, { duration: estimateDuration(selectedScene.script) })}
                >
                  按文稿估算时长
                </button>
              </div>

              <div className="audio-box">
                <div>
                  <strong>{selectedScene.audioPath ? '配音已生成' : '还没有配音'}</strong>
                  <span>
                    {selectedScene.audioDuration
                      ? `音频约 ${formatDuration(selectedScene.audioDuration)}`
                      : 'MVP 使用 macOS say，本地生成音频文件。'}
                  </span>
                </div>
                <button className="secondary" onClick={() => generateVoiceover(selectedScene)}>生成本镜头配音</button>
              </div>

              <div className="export-bar">
                <button className="secondary" disabled={scenes.length === 0} onClick={generateAllVoiceovers}>
                  生成全部配音
                </button>
                <button className="primary" disabled={scenes.length === 0 || status === 'working'} onClick={exportVideo}>
                  导出 MP4
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="welcome">
            <h2>从截图开始</h2>
            <p>添加产品截图，为每张图写一段讲解文稿，然后生成配音和视频。</p>
            <button className="primary" onClick={addImages}>添加截图</button>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
