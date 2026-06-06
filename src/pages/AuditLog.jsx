import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,orderBy,limit,startAfter}from'firebase/firestore'
import Layout from'../components/Layout'
import{Shield,Search,Download,Filter,User,FileText,DollarSign,Trash2,Edit,Plus,LogIn,CreditCard,BookOpen,Receipt}from'lucide-react'

const ACTION_COLORS={
create:{color:'#16a34a',bg:'rgba(22,163,74,0.1)',label:'Created'},
update:{color:'#4F6EF7',bg:'rgba(79,110,247,0.1)',label:'Updated'},
delete:{color:'#dc2626',bg:'rgba(220,38,38,0.1)',label:'Deleted'},
payment:{color:'#8b5cf6',bg:'rgba(139,92,246,0.1)',label:'Payment'},
login:{color:'#06b6d4',bg:'rgba(6,182,212,0.1)',label:'Login'},
logout:{color:'#64748b',bg:'rgba(100,116,139,0.1)',label:'Logout'},
approve:{color:'#d97706',bg:'rgba(217,119,6,0.1)',label:'Approved'},
reject:{color:'#dc2626',bg:'rgba(220,38,38,0.1)',label:'Rejected'},
send:{color:'#4F6EF7',bg:'rgba(79,110,247,0.1)',label:'Sent'},
export:{color:'#10b981',bg:'rgba(16,185,129,0.1)',label:'Exported'},
}

const MODULE_ICONS={
invoices:FileText,
expenses:DollarSign,
bills:Receipt,
customers:User,
journals:BookOpen,
auth:LogIn,
payments:CreditCard,
reports:FileText,
}

const MODULES=['invoices','expenses','bills','customers','journals','auth','payments','reports']
const ACTIONS=['create','update','delete','payment','login','logout','approve','reject','send','export']

const PAGE_SIZE=50

export default function AuditLog(){
const[companyId,setCompanyId]=useState(null)
const[logs,setLogs]=useState([])
const[loading,setLoading]=useState(true)
const[loadingMore,setLoadingMore]=useState(false)
const[lastDoc,setLastDoc]=useState(null)
const[hasMore,setHasMore]=useState(true)
const[search,setSearch]=useState('')
const[filterModule,setFilterModule]=useState('')
const[filterAction,setFilterAction]=useState('')
const[filterUser,setFilterUser]=useState('')
const[filterDateFrom,setFilterDateFrom]=useState('')
const[filterDateTo,setFilterDateTo]=useState('')
const[users,setUsers]=useState({}) // uid -> email map
const[viewMode,setViewMode]=useState('table') // table | timeline

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
await loadLogs(cid,true)
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

const loadLogs=async(cid,reset=false)=>{
try{
const coll=collection(db,`companies/${cid}/auditLogs`)
const q=query(coll,orderBy('timestamp','desc'),limit(PAGE_SIZE))
const snap=await getDocs(q)
const newLogs=snap.docs.map(d=>({id:d.id,...d.data(),ts:d.data().timestamp?.seconds?new Date(d.data().timestamp.seconds*1000):new Date()}))
setLogs(reset?newLogs:prev=>[...prev,...newLogs])
setLastDoc(snap.docs[snap.docs.length-1])
setHasMore(snap.docs.length===PAGE_SIZE)
// Build user map
const userMap={}
newLogs.forEach(l=>{if(l.userId&&l.userEmail)userMap[l.userId]=l.userEmail})
setUsers(prev=>({...prev,...userMap}))
}catch(e){console.error(e)}
}

const loadMore=async()=>{
if(!lastDoc||!hasMore||loadingMore)return
setLoadingMore(true)
try{
const coll=collection(db,`companies/${companyId}/auditLogs`)
const q=query(coll,orderBy('timestamp','desc'),limit(PAGE_SIZE),startAfter(lastDoc))
const snap=await getDocs(q)
const newLogs=snap.docs.map(d=>({id:d.id,...d.data(),ts:d.data().timestamp?.seconds?new Date(d.data().timestamp.seconds*1000):new Date()}))
setLogs(prev=>[...prev,...newLogs])
setLastDoc(snap.docs[snap.docs.length-1])
setHasMore(snap.docs.length===PAGE_SIZE)
const userMap={}
newLogs.forEach(l=>{if(l.userId&&l.userEmail)userMap[l.userId]=l.userEmail})
setUsers(prev=>({...prev,...userMap}))
}catch(e){console.error(e)}
setLoadingMore(false)
}

const filteredLogs=logs.filter(l=>{
if(filterModule&&l.module!==filterModule)return false
if(filterAction&&l.action!==filterAction)return false
if(filterUser&&l.userEmail!==filterUser)return false
if(filterDateFrom&&l.ts<new Date(filterDateFrom))return false
if(filterDateTo&&l.ts>new Date(filterDateTo+'T23:59:59'))return false
if(search){
const q=search.toLowerCase()
if(!l.description?.toLowerCase().includes(q)&&!l.userEmail?.toLowerCase().includes(q)&&!l.module?.toLowerCase().includes(q))return false
}
return true
})

const exportCSV=()=>{
const headers='Timestamp,Action,Module,Description,User'
const rows=filteredLogs.map(l=>`"${l.ts.toLocaleString()}","${l.action}","${l.module}","${l.description}","${l.userEmail}"`)
const blob=new Blob([headers+'\n'+rows.join('\n')],{type:'text/csv'})
const url=URL.createObjectURL(blob)
const a=document.createElement('a')
a.href=url;a.download=`AuditLog_${new Date().toISOString().split('T')[0]}.csv`;a.click()
URL.revokeObjectURL(url)
}

const uniqueUsers=[...new Set(logs.map(l=>l.userEmail).filter(Boolean))]

const formatTime=(ts)=>{
const now=new Date()
const diff=Math.floor((now-ts)/1000)
if(diff<60)return`${diff}s ago`
if(diff<3600)return`${Math.floor(diff/60)}m ago`
if(diff<86400)return`${Math.floor(diff/3600)}h ago`
return ts.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
}

const actionInfo=(action)=>ACTION_COLORS[action]||{color:'#64748b',bg:'#f1f5f9',label:action}
const ModuleIcon=({module})=>{
const Icon=MODULE_ICONS[module]||FileText
return<Icon size={14}/>
}

const th={padding:'9px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'0.5px solid var(--border)',background:'#fafbff',whiteSpace:'nowrap'}
const td={padding:'9px 14px',fontSize:12,borderBottom:'0.5px solid #f1f5f9',color:'var(--text-1)'}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

// Stats
const actionStats={}
logs.forEach(l=>{actionStats[l.action]=(actionStats[l.action]||0)+1})
const moduleStats={}
logs.forEach(l=>{moduleStats[l.module]=(moduleStats[l.module]||0)+1})

return(
<Layout title="Audit Log">

{/* Header */}
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<div style={{width:36,height:36,borderRadius:10,background:'rgba(79,110,247,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
<Shield size={18} color="var(--primary)"/>
</div>
<div>
<h2 style={{fontSize:16,fontWeight:700}}>Audit Log</h2>
<div style={{fontSize:11,color:'var(--text-3)'}}>{logs.length} total activities</div>
</div>
</div>
<div style={{display:'flex',gap:8}}>
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:10,padding:3}}>
{['table','timeline'].map(m=>(
<button key={m} type="button" onClick={()=>setViewMode(m)} style={{
padding:'5px 12px',borderRadius:7,fontSize:12,border:'none',cursor:'pointer',
background:viewMode===m?'var(--primary)':'transparent',
color:viewMode===m?'white':'var(--text-2)',
textTransform:'capitalize',
}}>
{m}
</button>
))}
</div>
<button type="button" onClick={exportCSV} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={13}/>Export CSV
</button>
</div>
</div>

{/* Stats Cards */}
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:16}}>
{Object.entries(actionStats).slice(0,6).map(([action,count])=>{
const info=actionInfo(action)
return(
<div key={action} className="card" style={{padding:12}}>
<div style={{fontSize:10,fontWeight:600,color:info.color,textTransform:'uppercase',marginBottom:4}}>{info.label}</div>
<div style={{fontSize:20,fontWeight:700,color:'var(--text-1)'}}>{count}</div>
</div>
)
})}
</div>

{/* Filters */}
<div className="card" style={{padding:16,marginBottom:16}}>
<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
<div style={{position:'relative',flex:1,minWidth:160}}>
<Search size={12} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{paddingLeft:26,fontSize:12}}/>
</div>
<select className="form-input" style={{width:'auto',fontSize:12}} value={filterModule} onChange={e=>setFilterModule(e.target.value)}>
<option value="">All Modules</option>
{MODULES.map(m=><option key={m} value={m}>{m}</option>)}
</select>
<select className="form-input" style={{width:'auto',fontSize:12}} value={filterAction} onChange={e=>setFilterAction(e.target.value)}>
<option value="">All Actions</option>
{ACTIONS.map(a=><option key={a} value={a}>{ACTION_COLORS[a]?.label||a}</option>)}
</select>
<select className="form-input" style={{width:'auto',fontSize:12}} value={filterUser} onChange={e=>setFilterUser(e.target.value)}>
<option value="">All Users</option>
{uniqueUsers.map(u=><option key={u} value={u}>{u}</option>)}
</select>
<input className="form-input" type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} style={{width:'auto',fontSize:12}}/>
<input className="form-input" type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} style={{width:'auto',fontSize:12}}/>
{(search||filterModule||filterAction||filterUser||filterDateFrom||filterDateTo)&&(
<button type="button" onClick={()=>{setSearch('');setFilterModule('');setFilterAction('');setFilterUser('');setFilterDateFrom('');setFilterDateTo('')}} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:11,display:'flex',alignItems:'center',gap:4}}>
<Filter size={11}/>Clear
</button>
)}
<span style={{fontSize:11,color:'var(--text-3)',marginLeft:'auto'}}>{filteredLogs.length} results</span>
</div>
</div>

{/* Table View */}
{viewMode==='table'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{overflowX:'auto'}}>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead>
<tr>
<th style={th}>Time</th>
<th style={th}>Action</th>
<th style={th}>Module</th>
<th style={th}>Description</th>
<th style={th}>User</th>
</tr>
</thead>
<tbody>
{filteredLogs.length===0?(
<tr><td colSpan={5} style={{...td,textAlign:'center',color:'var(--text-3)',padding:48}}>
<Shield size={32} style={{margin:'0 auto 12px',opacity:0.2,display:'block'}}/>
No audit logs yet
</td></tr>
):filteredLogs.map(log=>{
const info=actionInfo(log.action)
return(
<tr key={log.id} style={{background:'white'}}>
<td style={{...td,color:'var(--text-3)',whiteSpace:'nowrap',fontSize:11}}>
<div>{formatTime(log.ts)}</div>
<div style={{fontSize:10,color:'var(--text-3)',marginTop:1}}>{log.ts.toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
</td>
<td style={td}>
<span style={{background:info.bg,color:info.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
{info.label}
</span>
</td>
<td style={td}>
<div style={{display:'flex',alignItems:'center',gap:6,color:'var(--text-2)',fontSize:12}}>
<ModuleIcon module={log.module}/>
<span style={{textTransform:'capitalize'}}>{log.module}</span>
</div>
</td>
<td style={{...td,maxWidth:320}}>
<div style={{fontSize:12,color:'var(--text-1)'}}>{log.description}</div>
{log.metadata&&Object.keys(log.metadata).length>0&&(
<div style={{fontSize:10,color:'var(--text-3)',marginTop:2}}>
{Object.entries(log.metadata).slice(0,3).map(([k,v])=>`${k}: ${v}`).join(' • ')}
</div>
)}
</td>
<td style={td}>
<div style={{display:'flex',alignItems:'center',gap:6}}>
<div style={{width:24,height:24,borderRadius:'50%',background:'rgba(79,110,247,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
<User size={12} color="var(--primary)"/>
</div>
<div style={{fontSize:11,color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:140}}>
{log.userEmail||'-'}
</div>
</div>
</td>
</tr>
)
})}
</tbody>
</table>
</div>
{hasMore&&(
<div style={{padding:16,textAlign:'center',borderTop:'0.5px solid var(--border)'}}>
<button type="button" onClick={loadMore} disabled={loadingMore} className="btn btn-ghost" style={{fontSize:12}}>
{loadingMore?'Loading...':'Load More'}
</button>
</div>
)}
</div>
)}

{/* Timeline View */}
{viewMode==='timeline'&&(
<div style={{maxWidth:700,margin:'0 auto'}}>
{filteredLogs.length===0?(
<div className="card" style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<Shield size={32} style={{margin:'0 auto 12px',opacity:0.2}}/>
No audit logs yet
</div>
):(
<div style={{position:'relative',paddingLeft:32}}>
<div style={{position:'absolute',left:10,top:0,bottom:0,width:2,background:'linear-gradient(to bottom,var(--primary),transparent)',borderRadius:2}}/>
{filteredLogs.map((log,i)=>{
const info=actionInfo(log.action)
return(
<div key={log.id} style={{position:'relative',marginBottom:16}}>
<div style={{
position:'absolute',left:-28,top:12,
width:16,height:16,borderRadius:'50%',
background:info.color,border:'2px solid white',
boxShadow:'0 0 0 2px '+info.color+'40',
}}/>
<div className="card" style={{padding:14}}>
<div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
<div style={{flex:1}}>
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
<span style={{background:info.bg,color:info.color,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600}}>{info.label}</span>
<span style={{fontSize:11,color:'var(--text-3)',textTransform:'capitalize',display:'flex',alignItems:'center',gap:4}}>
<ModuleIcon module={log.module}/>{log.module}
</span>
</div>
<div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',marginBottom:4}}>{log.description}</div>
{log.metadata&&Object.keys(log.metadata).length>0&&(
<div style={{fontSize:11,color:'var(--text-3)'}}>
{Object.entries(log.metadata).slice(0,3).map(([k,v])=>`${k}: ${v}`).join(' • ')}
</div>
)}
<div style={{display:'flex',alignItems:'center',gap:6,marginTop:6}}>
<User size={11} color="var(--text-3)"/>
<span style={{fontSize:11,color:'var(--text-3)'}}>{log.userEmail}</span>
</div>
</div>
<div style={{fontSize:11,color:'var(--text-3)',whiteSpace:'nowrap',textAlign:'right'}}>
<div>{formatTime(log.ts)}</div>
</div>
</div>
</div>
</div>
)
})}
{hasMore&&(
<div style={{textAlign:'center',marginTop:8}}>
<button type="button" onClick={loadMore} disabled={loadingMore} className="btn btn-ghost" style={{fontSize:12}}>
{loadingMore?'Loading...':'Load More'}
</button>
</div>
)}
</div>
)}
</div>
)}

</Layout>
)
}
