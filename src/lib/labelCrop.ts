export type CropBox = { x: number; y: number; width: number; height: number }
export type CropHandle = 'move' | 'tl' | 'tr' | 'bl' | 'br'
export const FULL_IMAGE: CropBox = { x: 0, y: 0, width: 1, height: 1 }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

// Shared by touch/pointer and keyboard so every operation stays within the image.
export function adjustCrop(start: CropBox, mode: CropHandle, dx: number, dy: number): CropBox {
  if (mode === 'move') return { ...start, x: clamp(start.x + dx, 0, 1-start.width), y: clamp(start.y + dy, 0, 1-start.height) }
  const min = 0.12
  let left = start.x, top = start.y, right = left + start.width, bottom = top + start.height
  if (mode.endsWith('l')) left = clamp(left + dx, 0, right - min)
  else right = clamp(right + dx, left + min, 1)
  if (mode.startsWith('t')) top = clamp(top + dy, 0, bottom - min)
  else bottom = clamp(bottom + dy, top + min, 1)
  return { x: left, y: top, width: right-left, height: bottom-top }
}

// Conservative, local-only paper-label proposal. No OCR, uploads or additional AI calls.
// Reject border-connected backgrounds and ambiguous images instead of cutting out text.
export function suggestLabelCrop(data: ArrayLike<number>, width: number, height: number): CropBox | null {
  if (width < 16 || height < 16 || data.length !== width*height*4) return null
  const size = width*height
  let best: CropBox | null = null, bestScore = 0
  for (const threshold of [150, 190, 220]) {
    const mask = new Uint8Array(size), seen = new Uint8Array(size)
    for (let i=0; i<size; i++) {
      const r=data[i*4], g=data[i*4+1], b=data[i*4+2]
      mask[i] = data[i*4+3] > 200 && 0.2126*r+0.7152*g+0.0722*b >= threshold && Math.max(r,g,b)-Math.min(r,g,b) < 100 ? 1 : 0
    }
    const queue = new Int32Array(size)
    for (let seed=0; seed<size; seed++) {
      if (!mask[seed] || seen[seed]) continue
      let head=0, tail=1, count=0, left=width, right=0, top=height, bottom=0
      queue[0]=seed; seen[seed]=1
      while (head<tail) {
        const i=queue[head++], x=i%width, y=Math.floor(i/width)
        count++; left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y)
        for (const next of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1]) {
          if (next>=0 && mask[next] && !seen[next]) { seen[next]=1; queue[tail++]=next }
        }
      }
      const w=right-left+1, h=bottom-top+1, area=w*h/size, ratio=w/h, fill=count/(w*h)
      // A bright object beside a centred bottle is often glassware/background.
      // This paper heuristic cannot identify dark labels; keep the whole image
      // unless the candidate spans the central aiming area.
      if (right < width*0.45 || left > width*0.55) continue
      if (left<2 || top<2 || right>width-3 || bottom>height-3 || area<0.025 || area>0.7 || w/width<0.12 || h/height<0.12 || ratio<0.35 || ratio>3 || fill<0.55) continue
      // A plain bright reflection is not a label: require darker print inside the rectangle.
      let ink=0, darkSurrounding=0, samples=0
      for (let y=top+2;y<bottom-1;y++) for (let x=left+2;x<right-1;x++) {
        const i=(y*width+x)*4
        if (0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2]<threshold-45) ink++
      }
      const inkRatio=ink/(w*h)
      if (inkRatio<0.008 || inkRatio>0.4) continue
      const pad=Math.max(2, Math.round(Math.min(w,h)*0.2))
      for (let y=Math.max(0,top-pad);y<=Math.min(height-1,bottom+pad);y++) for (let x=Math.max(0,left-pad);x<=Math.min(width-1,right+pad);x++) {
        if (x>=left && x<=right && y>=top && y<=bottom) continue
        const i=(y*width+x)*4
        if (0.2126*data[i]+0.7152*data[i+1]+0.0722*data[i+2]<threshold-30) darkSurrounding++; samples++
      }
      if (!samples || darkSurrounding/samples<0.35) continue
      const distance=Math.hypot((left+w/2)/width-0.5,(top+h/2)/height-0.55)
      const score=area*fill*(1-Math.min(distance,0.8))
      if (score<=bestScore) continue
      bestScore=score
      // Keep generous margins for text and rotated labels; user reviews before submitting.
      const px=Math.max(3,w*0.1), py=Math.max(3,h*0.1)
      const x=clamp((left-px)/width,0,1), y=clamp((top-py)/height,0,1)
      best={ x,y,width:Math.min(1,(right+1+px)/width)-x,height:Math.min(1,(bottom+1+py)/height)-y }
    }
  }
  return best
}

export function detectLabelCrop(image: HTMLImageElement): CropBox | null {
  const scale=Math.min(1,256/Math.max(image.naturalWidth,image.naturalHeight))
  const canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
  const ctx=canvas.getContext('2d',{willReadFrequently:true})
  if (!ctx) return null
  ctx.drawImage(image,0,0,canvas.width,canvas.height)
  return suggestLabelCrop(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height)
}
