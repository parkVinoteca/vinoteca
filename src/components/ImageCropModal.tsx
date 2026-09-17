'use client'
import { useState, useRef, useEffect } from 'react'
import { cropAndResizeImage } from '@/lib/imageProcessing'
import { adjustCrop, detectLabelCrop, FULL_IMAGE, type CropBox, type CropHandle } from '@/lib/labelCrop'
import { Language } from '@/i18n'

interface Props {
  file: File
  lang: Language
  onConfirm: (result: { base64: string; mediaType: string }) => void
  onCancel: () => void
}
const copy = {
  ja: { title:'ラベルを確認', hint:'このまま使うか、枠・四隅をドラッグして微調整', automatic:'ラベル候補を自動で選びました', fallback:'自動で特定できないため写真全体を選択しています', full:'写真全体', restore:'自動選択に戻す', cancel:'キャンセル', confirm:'この範囲を使う', move:'選択範囲を移動', corners:['左上を調整','右上を調整','左下を調整','右下を調整'], keyboard:'矢印キーで調整。Shiftで大きく動かせます。', unreadable:'画像を読み込めません。JPEG/PNGでお試しください。', failed:'画像を処理できませんでした。' },
  ko: { title:'라벨 확인', hint:'그대로 사용하거나, 영역·모서리를 드래그해 조정하세요', automatic:'라벨로 보이는 영역을 자동 선택했습니다', fallback:'라벨을 찾기 어려워 사진 전체를 선택했습니다', full:'사진 전체', restore:'자동 선택으로', cancel:'취소', confirm:'이 영역 사용', move:'선택 영역 이동', corners:['왼쪽 위 조정','오른쪽 위 조정','왼쪽 아래 조정','오른쪽 아래 조정'], keyboard:'방향키로 조정합니다. Shift를 누르면 크게 이동합니다.', unreadable:'이미지를 읽지 못했습니다. JPEG/PNG로 시도해주세요.', failed:'이미지를 처리하지 못했습니다.' },
}
export default function ImageCropModal({ file, lang, onConfirm, onCancel }: Props) {
  const t=copy[lang]
  const dialogRef=useRef<HTMLDivElement>(null), stageRef=useRef<HTMLDivElement>(null), frameRef=useRef<HTMLDivElement>(null), imgRef=useRef<HTMLImageElement>(null)
  const drag=useRef<{id:number;mode:CropHandle;x:number;y:number;box:CropBox;width:number;height:number}|null>(null)
  const [source,setSource]=useState(''), [loaded,setLoaded]=useState(false), [error,setError]=useState('')
  const [box,setBox]=useState<CropBox>(FULL_IMAGE), [proposal,setProposal]=useState<CropBox|null>(null)
  const [size,setSize]=useState({width:0,height:0})
  const [busy,setBusy]=useState(false)
  const lock=useRef(false)
  useEffect(()=>{ const url=URL.createObjectURL(file); setSource(url); setLoaded(false); setError(''); setBox(FULL_IMAGE); return ()=>URL.revokeObjectURL(url) },[file])
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null, overflow=document.body.style.overflow
    dialogRef.current?.focus(); document.body.style.overflow='hidden'
    return ()=>{document.body.style.overflow=overflow;previous?.focus()}
  },[])
  useEffect(()=>{
    if (!loaded || !stageRef.current || !imgRef.current) return
    const measure=()=>{
      const stage=stageRef.current!, image=imgRef.current!
      const scale=Math.min(stage.clientWidth/image.naturalWidth,stage.clientHeight/image.naturalHeight)
      setSize({width:image.naturalWidth*scale,height:image.naturalHeight*scale})
    }
    measure(); const observer=new ResizeObserver(measure); observer.observe(stageRef.current)
    return ()=>observer.disconnect()
  },[loaded])
  const onLoad=()=>{
    setLoaded(true)
    try { const suggested=detectLabelCrop(imgRef.current!); setProposal(suggested); setBox(suggested||FULL_IMAGE) }
    catch { setProposal(null); setBox(FULL_IMAGE) }
  }
  const begin=(mode:CropHandle,e:React.PointerEvent<HTMLButtonElement>)=>{
    if (!e.isPrimary || e.button!==0 || !frameRef.current) return
    e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId)
    const rect=frameRef.current.getBoundingClientRect()
    drag.current={id:e.pointerId,mode,x:e.clientX,y:e.clientY,box:{...box},width:rect.width,height:rect.height}
  }
  const move=(e:React.PointerEvent<HTMLButtonElement>)=>{
    const start=drag.current
    if (!start || e.pointerId!==start.id) return
    e.preventDefault(); setBox(adjustCrop(start.box,start.mode,(e.clientX-start.x)/start.width,(e.clientY-start.y)/start.height))
  }
  const keyboard=(mode:CropHandle,e:React.KeyboardEvent)=>{
    const steps:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}
    if (!steps[e.key]) return
    e.preventDefault();e.stopPropagation();const [x,y]=steps[e.key],step=e.shiftKey?0.05:0.01
    setBox(current=>adjustCrop(current,mode,x*step,y*step))
  }
  const interactions=(mode:CropHandle)=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>begin(mode,e),onPointerMove:move,onPointerUp:()=>{drag.current=null},onPointerCancel:()=>{drag.current=null},onLostPointerCapture:()=>{drag.current=null},onKeyDown:(e:React.KeyboardEvent)=>keyboard(mode,e)})
  const confirm=()=>{
    if (!loaded || lock.current || !imgRef.current) return
    lock.current=true;setBusy(true)
    try {
      const image=imgRef.current, x=Math.round(box.x*image.naturalWidth),y=Math.round(box.y*image.naturalHeight)
      onConfirm(cropAndResizeImage(image,{x,y,width:Math.max(1,Math.min(image.naturalWidth-x,Math.round(box.width*image.naturalWidth))),height:Math.max(1,Math.min(image.naturalHeight-y,Math.round(box.height*image.naturalHeight)))},1024,0.85))
    } catch {setError(t.failed);lock.current=false;setBusy(false)}
  }
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="crop-title" tabIndex={-1} className="fixed inset-0 z-[100] bg-cave-900 flex flex-col overflow-hidden" style={{height:'100dvh'}} onKeyDown={e=>{
    if(e.key==='Escape'&&!busy){e.preventDefault();onCancel()}
    if(e.key==='Tab'){
      const elements=dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)')
      if(!elements?.length)return
      const first=elements[0],last=elements[elements.length-1]
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialogRef.current)){e.preventDefault();first.focus()}
    }
  }}>
    <header className="shrink-0 px-4 pt-5 pb-3 text-center">
      <h2 id="crop-title" className="text-gold-200 text-lg">{t.title}</h2>
      <p className="text-cave-100 text-xs mt-2">{t.hint}</p>
      <p className="sr-only" id="crop-keyboard">{t.keyboard}</p>
    </header>
    <div className="flex-1 min-h-0 p-6">
      <div ref={stageRef} className="w-full h-full flex items-center justify-center">
        <div ref={frameRef} className="relative shrink-0" style={loaded?size:{width:'100%',height:'100%'}}>
          <img ref={imgRef} src={source||undefined} alt="" onLoad={onLoad} onError={()=>setError(t.unreadable)} draggable={false} className="w-full h-full object-contain select-none" />
          {loaded&&size.width>0&&<>
            <svg aria-hidden="true" viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none"><path fill="rgba(0,0,0,0.65)" fillRule="evenodd" d={`M0 0H1V1H0Z M${box.x} ${box.y}h${box.width}v${box.height}h-${box.width}Z`}/></svg>
            <div className="absolute border-2 border-gold-300" style={{left:`${box.x*100}%`,top:`${box.y*100}%`,width:`${box.width*100}%`,height:`${box.height*100}%`}}>
              <button type="button" aria-label={t.move} aria-describedby="crop-keyboard" {...interactions('move')} className="absolute inset-0 w-full h-full cursor-move touch-none bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" />
              {(['tl','tr','bl','br'] as const).map((mode,i)=><button key={mode} type="button" aria-label={t.corners[i]} style={{cursor:mode==='tl'||mode==='br'?'nwse-resize':'nesw-resize'}} aria-describedby="crop-keyboard" {...interactions(mode)} className={`absolute w-11 h-11 flex items-center justify-center touch-none ${i<2?'-top-[22px]':'-bottom-[22px]'} ${i%2===0?'-left-[22px]':'-right-[22px]'} rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}><span className="w-5 h-5 rounded-full bg-gold-300 border-2 border-cave-900 shadow-md pointer-events-none"/></button>)}
            </div>
          </>}
        </div>
      </div>
    </div>
    <footer className="shrink-0 px-4 pt-2 pb-4 border-t border-gold-900/30" style={{paddingBottom:'max(1rem, env(safe-area-inset-bottom))'}}>
      <p role="status" className="text-xs text-center text-cave-100 mb-3">{loaded?(proposal?t.automatic:t.fallback):'…'}</p>
      <div className="flex justify-center gap-3 mb-3">
        <button type="button" disabled={!loaded||busy} onClick={()=>setBox(FULL_IMAGE)} className="btn-secondary min-h-11 px-4 text-xs">{t.full}</button>
        {proposal&&<button type="button" disabled={busy} onClick={()=>setBox(proposal)} className="btn-secondary min-h-11 px-4 text-xs">{t.restore}</button>}
      </div>
      {error&&<p role="alert" className="text-sm text-red-300 mb-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={onCancel} className="btn-secondary min-h-12">{t.cancel}</button>
        <button type="button" disabled={!loaded||busy||!!error} onClick={confirm} className="btn-primary min-h-12">{busy?'…':t.confirm}</button>
      </div>
    </footer>
  </div>
}
