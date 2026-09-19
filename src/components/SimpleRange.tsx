'use client'
import { useId } from 'react'

// Declared at module scope: rerenders must not replace the DOM input during a drag.
export default function SimpleRange({label,hint,display,stored,value,onChange,unselected}: {
 label:string;hint?:string;display:string[];stored:string[];value:string;onChange:(v:string)=>void;unselected:string
}) {
 const id=useId()
 const index=stored.indexOf(value), current=index<0?Math.floor(stored.length/2):index
 return <div className="mb-6">
  <div className="flex justify-between gap-3 mb-1"><label htmlFor={id} className="text-sm font-medium text-ink">{label}</label><span className="text-sm font-medium text-gold-700">{index>=0 ? display[current] : value || unselected}</span></div>
  {hint && <p className="text-xs text-cave-100 mb-2">{hint}</p>}
  <div className="relative h-11 flex items-center">
   <div className="pointer-events-none absolute inset-x-[11px] flex justify-between" aria-hidden="true">
    {stored.map((_,i)=><span key={i} className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${i===index?'bg-gold-700':'bg-cave-300'}`} />)}
   </div>
   <input id={id} type="range" min="0" max={stored.length-1} step="1" value={current} onChange={e=>onChange(stored[Number(e.currentTarget.value)])} className="stepped-range relative z-10 w-full" aria-valuetext={index>=0?`${display[current]} (${index+1}/${stored.length})`:value || unselected}/>
  </div>
  <div className="grid gap-1" style={{gridTemplateColumns:`repeat(${stored.length},minmax(0,1fr))`}}>
   {display.map((text,i)=><button key={text} className={`min-h-11 rounded-lg px-1 py-2 text-[11px] leading-tight ${index===i?'bg-gold-50 text-gold-700 font-semibold':'text-cave-100'}`} aria-pressed={index===i} onClick={()=>onChange(index===i?'':stored[i])}><span className="block text-[10px] mb-1">{i+1}</span>{text}</button>)}
  </div>
 </div>
}
