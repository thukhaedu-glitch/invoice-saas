import{useState,useEffect,useRef}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,query,where,getDocs,updateDoc,doc,addDoc,serverTimestamp,orderBy,limit}from'firebase/firestore'
import{Bell,X,CheckCheck,AlertCircle,Clock,FileText,ScrollText}from'lucide-react'

export default function Notifications({companyId}){
const[open,setOpen]=useState(false)
const[notifications,setNotifications]=useState([])
const ref=useRef()

useEffect(()=>{
if(!companyId)return
const q=query(
collection(db,'companies',companyId,'notifications'),
orderBy('createdAt','desc'),
limit(20)
)
const unsub=onSnapshot(q,snap=>{
setNotifications(snap.docs.map(d=>({id:d.id,...d.data()})))
})
return()=>unsub()
},[companyId])

useEffect(()=>{
const handleClick=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
document.addEventListener('mousedown',handleClick)
return()=>document.removeEventListener('mousedown',handleClick)
},[])

const unread=notifications.filter(n=>!n.read).length

const markAllRead=async()=>{
const unreadNots=notifications.filter(n=>!n.read)
await Promise.all(unreadNots.map(n=>updateDoc(doc(db,'companies',companyId,'notifications',n.id),{read:true})))
}

const markRead=async(id)=>{
await updateDoc(doc(db,'companies',companyId,'notifications',id),{read:true})
}

const getIcon=(type)=>{
if(type==='overdue')return<AlertCircle size={14} color="#dc2626"/>
if(type==='expiring')return<Clock size={14} color="#d97706"/>
if(type==='pending')return<FileText size={14} color="#4F6EF7"/>
if(type==='contract')return<ScrollText size={14} color="#8b5cf6"/>
return<Bell size={14} color="#64748b"/>
}

const timeAgo=(seconds)=>{
if(!seconds)return''
const diff=Math.floor(Date.now()/1000-seconds)
if(diff<60)return'just now'
if(diff<3600)return`${Math.floor(diff/60)}m ago`
if(diff<86400)return`${Math.floor(diff/3600)}h ago`
return`${Math.floor(diff/86400)}d ago`
}

return(
<div ref={ref} style={{position:'relative'}}>
<button type="button" onClick={()=>setOpen(v=>!v)} style={{
position:'relative',background:'none',border:'none',cursor:'pointer',
padding:6,borderRadius:8,color:'var(--text-2)',
display:'flex',alignItems:'center',
}}>
<Bell size={18}/>
{unread>0&&(
<span style={{
position:'absolute',top:2,right:2,
width:16,height:16,borderRadius:'50%',
background:'#dc2626',color:'white',
fontSize:9,fontWeight:700,
display:'flex',alignItems:'center',justifyContent:'center',
}}>
{unread>9?'9+':unread}
</span>
)}
</button>

{open&&(
<div style={{
position:'absolute',top:'calc(100% + 8px)',right:0,
width:320,maxHeight:440,
background:'white',
borderRadius:14,
boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
border:'0.5px solid var(--border)',
zIndex:200,overflow:'hidden',
display:'flex',flexDirection:'column',
}}>
<div style={{padding:'14px 16px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,color:'var(--text-1)'}}>
Notifications {unread>0&&<span style={{background:'#dc2626',color:'white',borderRadius:20,padding:'1px 7px',fontSize:11,marginLeft:6}}>{unread}</span>}
</div>
{unread>0&&(
<button type="button" onClick={markAllRead} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--primary)',display:'flex',alignItems:'center',gap:4}}>
<CheckCheck size={13}/>Mark all read
</button>
)}
</div>

<div style={{overflowY:'auto',flex:1}}>
{notifications.length===0?(
<div style={{padding:32,textAlign:'center',color:'var(--text-3)',fontSize:13}}>
<Bell size={32} style={{margin:'0 auto 8px',opacity:0.3,display:'block'}}/>
No notifications
</div>
):notifications.map(n=>(
<div key={n.id} onClick={()=>markRead(n.id)} style={{
padding:'12px 16px',
borderBottom:'0.5px solid #f8fafc',
cursor:'pointer',
background:n.read?'white':'rgba(79,110,247,0.04)',
display:'flex',gap:10,alignItems:'flex-start',
}}>
<div style={{width:28,height:28,borderRadius:8,background:n.read?'#f8fafc':'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
{getIcon(n.type)}
</div>
<div style={{flex:1,minWidth:0}}>
<div style={{fontSize:13,fontWeight:n.read?400:500,color:'var(--text-1)',lineHeight:1.4}}>{n.title}</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:3}}>{n.message}</div>
<div style={{fontSize:10,color:'var(--text-3)',marginTop:4}}>{timeAgo(n.createdAt?.seconds)}</div>
</div>
{!n.read&&<div style={{width:6,height:6,borderRadius:'50%',background:'var(--primary)',flexShrink:0,marginTop:6}}/>}
</div>
))}
</div>
</div>
)}
</div>
)
}
