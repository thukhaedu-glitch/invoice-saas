import{useTranslation}from'react-i18next'
import{Globe}from'lucide-react'

export default function LanguageSwitcher(){
const{i18n}=useTranslation()
const change=(lng)=>{
i18n.changeLanguage(lng)
try{localStorage.setItem('lang',lng)}catch(e){}
}
const cur=i18n.language
return(
<div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#f1f5f9',borderRadius:20,padding:'4px 6px'}}>
<Globe size={14} color="var(--text-3)" style={{marginLeft:4}}/>
{[['en','EN'],['my','MY']].map(([code,label])=>(
<button key={code} onClick={()=>change(code)} style={{
border:'none',cursor:'pointer',fontSize:12,fontWeight:600,padding:'4px 12px',borderRadius:16,
background:cur===code?'var(--primary)':'transparent',color:cur===code?'white':'var(--text-2)',
}}>{label}</button>
))}
</div>
)
}
