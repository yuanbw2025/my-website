/**
 * WorldMapCanvas — Canvas 渲染 + 交互包装组件
 * 负责：挂载 <canvas>、调用 renderer、绑定交互事件
 */

import { useRef, useEffect, useCallback } from 'react'
import type { WorldMapData, MapMarker } from '../../lib/types/world-map'
import { renderWorldMap, type RenderOptions } from '../../lib/world-map/renderer'
import {
  bindCanvasInteraction,
  createInteractionState,
} from '../../lib/world-map/interaction'

interface Props {
  data: WorldMapData
  selectedMarkerId: string | null
  onSelectMarker: (marker: MapMarker | null) => void
  onMarkerDragEnd: (markerId: string, x: number, y: number) => void
  onDoubleClickEmpty: (x: number, y: number) => void
}

export default function WorldMapCanvas({
  data,
  selectedMarkerId,
  onSelectMarker,
  onMarkerDragEnd,
  onDoubleClickEmpty,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(createInteractionState())
  const dataRef = useRef(data)

  // 保持 dataRef 最新
  useEffect(() => {
    dataRef.current = data
  }, [data])

  // 同步选中状态 + 触发重绘以刷新选中高亮
  useEffect(() => {
    stateRef.current.selectedMarkerId = selectedMarkerId
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const opts: RenderOptions = {
      selectedMarkerId: stateRef.current.selectedMarkerId,
      hoveredMarkerId: stateRef.current.hoveredMarkerId,
    }
    renderWorldMap(ctx, dataRef.current, opts)
  }, [selectedMarkerId])


  // 渲染函数
  const doRender = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const opts: RenderOptions = {
      selectedMarkerId: stateRef.current.selectedMarkerId,
      hoveredMarkerId: stateRef.current.hoveredMarkerId,
    }
    renderWorldMap(ctx, dataRef.current, opts)
  }, [])

  // 初次渲染 + data 变化时重新渲染
  useEffect(() => {
    doRender()
  }, [data, doRender])

  // 绑定交互事件
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const unbind = bindCanvasInteraction(
      canvas,
      () => dataRef.current,
      stateRef.current,
      {
        onSelect: (marker) => {
          onSelectMarker(marker)
        },
        onHover: () => {
          // hover 状态已经由 interaction 内部管理，只需触发重绘
        },
        onDragEnd: (markerId, newX, newY) => {
          onMarkerDragEnd(markerId, newX, newY)
        },
        onDoubleClick: (x, y) => {
          onDoubleClickEmpty(x, y)
        },
        onRequestRender: doRender,
      },
    )

    return unbind
  }, [doRender, onSelectMarker, onMarkerDragEnd, onDoubleClickEmpty])

  return (
    <div className="relative w-full overflow-auto rounded-lg border border-border bg-bg-base">
      <canvas
        ref={canvasRef}
        width={data.width}
        height={data.height}
        className="block max-w-full h-auto"
        style={{ imageRendering: 'auto' }}
      />
      {/* 底部提示 */}
      <div className="absolute bottom-2 right-2 flex gap-2 text-[10px] text-text-muted bg-bg-base/80 rounded px-2 py-1">
        <span>🖱️ 点击选中</span>
        <span>✋ 拖拽移动</span>
        <span>👆 双击空白添加</span>
      </div>
    </div>
  )
}
