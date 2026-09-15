// 이미지 리사이즈 유틸리티 — 브라우저 Canvas로 전송 전 압축
// Claude Vision 토큰 = (가로px × 세로px) / 750 이므로, 면적을 줄이면 토큰이 비례해서 줄어듦

export function resizeImage(file: File | Blob, maxLongEdge = 1024, quality = 0.85): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img
      const longEdge = Math.max(width, height)

      if (longEdge > maxLongEdge) {
        const scale = maxLongEdge / longEdge
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas context not available'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      URL.revokeObjectURL(url)
      resolve({
        base64: dataUrl.split(',')[1],
        mediaType: 'image/jpeg',
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }

    img.src = url
  })
}

// 크롭 박스(사용자가 지정한 영역)로 잘라낸 후 리사이즈까지 한 번에 처리
export function cropAndResizeImage(
  imgEl: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number }, // 원본 이미지 픽셀 기준 좌표
  maxLongEdge = 1024,
  quality = 0.85
): { base64: string; mediaType: string } {
  let outWidth = crop.width
  let outHeight = crop.height
  const longEdge = Math.max(outWidth, outHeight)

  if (longEdge > maxLongEdge) {
    const scale = maxLongEdge / longEdge
    outWidth = Math.round(outWidth * scale)
    outHeight = Math.round(outHeight * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    imgEl,
    crop.x, crop.y, crop.width, crop.height,  // 원본에서 잘라낼 영역
    0, 0, outWidth, outHeight                  // 출력 캔버스에 그릴 영역
  )

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return {
    base64: dataUrl.split(',')[1],
    mediaType: 'image/jpeg',
  }
}
