/**
 * 世界地图交互逻辑
 * 处理拖拽、点击、悬停等 Canvas 交互事件
 */

import type { WorldMapData, MapMarker } from '../types/world-map'
import { hitTestMarker } from './renderer'

export interface InteractionState {
  selectedMarkerId: string | null
  hoveredMarkerId: string | null
  isDragging: boolean
  dragStartX: number
  dragStartY: number
}

export function createInteractionState(): InteractionState {
  return {
    selectedMarkerId: null,
    hoveredMarkerId: null,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  }
}

/** 获取 Canvas 内的鼠标坐标 */
export function getCanvasCoords(
  canvas: HTMLCanvasElement,
  e: MouseEvent | React.MouseEvent,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

export interface InteractionCallbacks {
  onSelect: (marker: MapMarker | null) => void
  onHover: (markerId: string | null) => void
  onDragEnd: (markerId: string, newX: number, newY: number) => void
  onDoubleClick: (x: number, y: number) => void
  onRequestRender: () => void
}

/**
 * 绑定 Canvas 交互事件，返回解绑函数
 */
export function bindCanvasInteraction(
  canvas: HTMLCanvasElement,
  getData: () => WorldMapData | null,
  state: InteractionState,
  callbacks: InteractionCallbacks,
): () => void {
  let draggedMarker: MapMarker | null = null

  const onMouseDown = (e: MouseEvent) => {
    const data = getData()
    if (!data) return
    const { x, y } = getCanvasCoords(canvas, e)
    const hit = hitTestMarker(data, x, y)

    if (hit) {
      state.selectedMarkerId = hit.id
      state.isDragging = true
      state.dragStartX = x
      state.dragStartY = y
      draggedMarker = hit
      canvas.style.cursor = 'grabbing'
      callbacks.onSelect(hit)
    } else {
      state.selectedMarkerId = null
      callbacks.onSelect(null)
    }
    callbacks.onRequestRender()
  }

  const onMouseMove = (e: MouseEvent) => {
    const data = getData()
    if (!data) return
    const { x, y } = getCanvasCoords(canvas, e)

    if (state.isDragging && draggedMarker) {
      // 实时更新标记位置
      const marker = data.markers.find(m => m.id === draggedMarker!.id)
      if (marker) {
        marker.x = Math.max(20, Math.min(data.width - 20, x))
        marker.y = Math.max(20, Math.min(data.height - 20, y))
        callbacks.onRequestRender()
      }
    } else {
      // 悬停检测
      const hit = hitTestMarker(data, x, y)
      const newHoverId = hit?.id || null
      if (newHoverId !== state.hoveredMarkerId) {
        state.hoveredMarkerId = newHoverId
        canvas.style.cursor = newHoverId ? 'pointer' : 'default'
        callbacks.onHover(newHoverId)
        callbacks.onRequestRender()
      }
    }
  }

  const onMouseUp = (e: MouseEvent) => {
    if (state.isDragging && draggedMarker) {
      const data = getData()
      if (data) {
        const { x, y } = getCanvasCoords(canvas, e)
        callbacks.onDragEnd(
          draggedMarker.id,
          Math.max(20, Math.min(data.width - 20, x)),
          Math.max(20, Math.min(data.height - 20, y)),
        )
      }
    }
    state.isDragging = false
    draggedMarker = null
    canvas.style.cursor = state.hoveredMarkerId ? 'pointer' : 'default'
  }

  const onDblClick = (e: MouseEvent) => {
    const data = getData()
    if (!data) return
    const { x, y } = getCanvasCoords(canvas, e)
    const hit = hitTestMarker(data, x, y)
    if (!hit) {
      callbacks.onDoubleClick(x, y)
    }
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('dblclick', onDblClick)
  canvas.addEventListener('contextmenu', onContextMenu)

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('dblclick', onDblClick)
    canvas.removeEventListener('contextmenu', onContextMenu)
  }
}
