const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { spawn } = require('child_process')
const ffmpegPath = require('ffmpeg-static')

const isDev = !!process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' || process.defaultApp

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 720,
    title: 'Promo Video Maker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`))
    })
  })
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function escapeSrt(text) {
  return String(text || '').replace(/\r/g, '').trim()
}

function srtTime(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const ms = totalMs % 1000
  const totalSec = Math.floor(totalMs / 1000)
  const sec = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const min = totalMin % 60
  const hour = Math.floor(totalMin / 60)
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function buildSrt(scenes) {
  let cursor = 0
  return scenes.map((scene, index) => {
    const start = cursor
    const end = cursor + scene.duration
    cursor = end
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${escapeSrt(scene.script)}\n`
  }).join('\n')
}

function ffmpegFilterForAspect(aspectRatio, includeSubtitles, srtPath) {
  const size = aspectRatio === '9:16'
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 }
  const scalePad = `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1`
  if (!includeSubtitles) return scalePad
  const escaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')
  return `${scalePad},subtitles='${escaped}':force_style='FontName=Arial,FontSize=28,PrimaryColour=&H111111&,OutlineColour=&HFFFFFF&,BorderStyle=3,Outline=1,Shadow=0,MarginV=48'`
}

async function probeDuration(filePath) {
  try {
    const { stderr } = await run(ffmpegPath, ['-i', filePath])
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    if (!match) return null
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  } catch (err) {
    const text = String(err.message || '')
    const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    if (!match) return null
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  }
}

ipcMain.handle('images:select', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择项目截图',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
    ],
  })
  if (result.canceled) return []
  return result.filePaths.map((filePath) => ({
    id: crypto.randomUUID(),
    path: filePath,
    name: path.basename(filePath),
    url: `file://${filePath}`,
  }))
})

ipcMain.handle('output:select', async () => {
  const result = await dialog.showSaveDialog({
    title: '导出视频',
    defaultPath: path.join(os.homedir(), 'Desktop', 'promo-video.mp4'),
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  })
  if (result.canceled) return null
  return result.filePath
})

ipcMain.handle('voice:generate', async (_event, payload) => {
  if (process.platform !== 'darwin') {
    throw new Error('当前 MVP 使用 macOS say 生成配音。跨平台 TTS 会在后续接入。')
  }
  const { sceneId, text, voice = 'Tingting' } = payload
  if (!text || !String(text).trim()) throw new Error('文稿为空，无法生成配音。')
  const outDir = path.join(app.getPath('userData'), 'voiceovers')
  ensureDir(outDir)
  const audioPath = path.join(outDir, `${sceneId}.aiff`)
  await run('say', ['-v', voice, '-o', audioPath, String(text)])
  const duration = await probeDuration(audioPath)
  return { audioPath, duration }
})

ipcMain.handle('video:export', async (_event, payload) => {
  const { scenes, outputPath, aspectRatio = '16:9', includeSubtitles = true } = payload
  if (!ffmpegPath) throw new Error('未找到 ffmpeg-static 二进制。')
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('没有可导出的场景。')
  if (!outputPath) throw new Error('缺少导出路径。')

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-video-'))
  const segmentPaths = []
  const normalizedScenes = scenes.map((scene) => ({
    ...scene,
    duration: Math.max(1, Number(scene.duration) || 3),
  }))

  const srtPath = path.join(workDir, 'subtitles.srt')
  fs.writeFileSync(srtPath, buildSrt(normalizedScenes), 'utf8')

  for (let i = 0; i < normalizedScenes.length; i++) {
    const scene = normalizedScenes[i]
    const segmentPath = path.join(workDir, `segment-${String(i).padStart(3, '0')}.mp4`)
    const filter = ffmpegFilterForAspect(aspectRatio, includeSubtitles, srtPath)
    const args = ['-y', '-loop', '1', '-t', String(scene.duration), '-i', scene.imagePath]
    if (scene.audioPath) args.push('-i', scene.audioPath)
    args.push(
      '-vf', filter,
      '-r', '30',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
    )
    if (scene.audioPath) {
      args.push('-c:a', 'aac', '-b:a', '192k', '-shortest')
    } else {
      args.push('-an')
    }
    args.push(segmentPath)
    await run(ffmpegPath, args)
    segmentPaths.push(segmentPath)
  }

  const concatPath = path.join(workDir, 'concat.txt')
  fs.writeFileSync(concatPath, segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8')
  await run(ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', outputPath])
  return { outputPath }
})
