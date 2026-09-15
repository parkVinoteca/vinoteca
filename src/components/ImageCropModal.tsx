'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cropAndResizeImage } from '@/lib/imageProcessing'
import { Language } from '@/i18n'

interface Props {
  file: File
  lang: Language
  onConfirm: (result: { base64: string; mediaType: string }) => void
  onCancel: () => void
}

export default function ImageCropModal({ file, lang, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [box, setBox] = useState({ x: 0.1, y: 0.25, width: 0.8, height: 0.5 }) // 비율 (0~1)
  const [dragMode, setDragMode] = useState<null | 'move' | 'tl' | 'tr' | 'bl' | 'br'>(null)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, box: { x: 0, y: 0, width: 0, height: 0 } })

  useEffect(() => {
    const objUrl = URL.createObjectURL(file)
    if (imgRef.current) imgRef.current.src = objUrl
    return () => URL.revokeObjectURL(objUrl)
  }, [file])

  const handleImgLoad = () => {
    if (!imgRef.current) return
    setDisplaySize({ width: imgRef.current.clientWidth, height: imgRef.current.clientHeight })
    setImgLoaded(true)
  }

  const startDrag = (mode: 'move' | 'tl' | 'tr' | 'bl' | 'br', e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const point = 'touches' in e ? e.touches[0] : e
    dragStart.current = { mouseX: point.clientX, mouseY: point.clientY, box: { ...box } }
    setDragMode(mode)
  }

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragMode || !containerRef.current) return
    const point = 'touches' in e ? e.touches[0] : e
    if (!point) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = (point.clientX - dragStart.current.mouseX) / rect.width
    const dy = (point.clientY - dragStart.current.mouseY) / rect.height
    const start = dragStart.current.box

    setBox(prev => {
      let { x, y, width, height } = start
      if (dragMode === 'move') {
        x = Math.min(Math.max(0, start.x + dx), 1 - width)
        y = Math.min(Math.max(0, start.y + dy), 1 - height)
      } else if (dragMode === 'tl') {
        x = Math.min(Math.max(0, start.x + dx), start.x + start.width - 0.1)
        y = Math.min(Math.max(0, start.y + dy), start.y + start.height - 0.1)
        width = start.x + start.width - x
        height = start.y + start.height - y
      } else if (dragMode === 'tr') {
        y = Math.min(Math.max(0, start.y + dy), start.y + start.height - 0.1)
        width = Math.min(Math.max(0.1, start.width + dx), 1 - start.x)
        height = start.y + start.height - y
      } else if (dragMode === 'bl') {
        x = Math.min(Math.max(0, start.x + dx), start.x + start.width - 0.1)
        width = start.x + start.width - x
        height = Math.min(Math.max(0.1, start.height + dy), 1 - start.y)
      } else if (dragMode === 'br') {
        width = Math.min(Math.max(0.1, start.width + dx), 1 - start.x)
        height = Math.min(Math.max(0.1, start.height + dy), 1 - start.y)
      }
      return { x, y, width, height }
    })
  }, [dragMode])

  const endDrag = useCallback(() => setDragMode(null), [])

  useEffect(() => {
    if (!dragMode) return
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', endDrag)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', endDrag)
    }
  }, [dragMode, onMove, endDrag])

  const handleConfirm = () => {
    if (!imgRef.current) return
    const natW = imgRef.current.naturalWidth
    const natH = imgRef.current.naturalHeight
    const cropPx = {
      x: Math.round(box.x * natW),
      y: Math.round(box.y * natH),
      width: Math.round(box.width * natW),
      height: Math.round(box.height * natH),
    }
    const result = cropAndResizeImage(imgRef.current, cropPx, 1024, 0.85)
    onConfirm(result)
  }

  const handle = (mode: 'tl' | 'tr' | 'bl' | 'br', posClass: string) => (
    <div
      onMouseDown={(e) => startDrag(mode, e)}
      onTouchStart={(e) => startDrag(mode, e)}
      className={`absolute w-6 h-6 bg-gold-500 border-2 border-cave-900 rounded-full ${posClass} cursor-pointer touch-none z-10`}
    />
  )

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col">
      <div className="flex-shrink-0 p-4 text-center">
        <div className="text-gold-200 text-sm font-medium">
          {lang === 'ja' ? 'ラベルの範囲を指定してください' : '라벨 영역을 지정해주세요'}
        </div>
        <div className="text-cave-200 text-[11px] mt-1">
          {lang === 'ja' ? '四隅をドラッグして調整できます' : '모서리를 드래그해서 조정할 수 있습니다'}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div ref={containerRef} className="relative inline-block max-w-full max-h-full">
          <img
            ref={imgRef}
            onLoad={handleImgLoad}
            className="max-w-full max-h-[60vh] block select-none"
            draggable={false}
            alt=""
          />
          {imgLoaded && (
            <>
              {/* 어두운 오버레이 (박스 바깥) */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `linear-gradient(to bottom, rgba(0,0,0,0.6) ${box.y * 100}%, transparent ${box.y * 100}%)`,
              }} />
              {/* 크롭 박스 */}
              <div
                onMouseDown={(e) => startDrag('move', e)}
                onTouchStart={(e) => startDrag('move', e)}
                className="absolute border-2 border-gold-400 cursor-move touch-none"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.width * 100}%`,
                  height: `${box.height * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                }}
              >
                {handle('tl', '-top-3 -left-3')}
                {handle('tr', '-top-3 -right-3')}
                {handle('bl', '-bottom-3 -left-3')}
                {handle('br', '-bottom-3 -right-3')}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 p-4 grid grid-cols-2 gap-3">
        <button onClick={onCancel} className="btn-secondary py-3">
          {lang === 'ja' ? 'キャンセル' : '취소'}
        </button>
        <button onClick={handleConfirm} className="btn-primary py-3">
          {lang === 'ja' ? 'この範囲で解析' : '이 영역으로 분석'}
        </button>
      </div>
    </div>
  )
}
