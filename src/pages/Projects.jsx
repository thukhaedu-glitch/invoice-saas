import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,X,Save,Briefcase,Search,Eye,Clock,CheckCircle,AlertCircle,DollarSign}from'lucide-react'

const STATUS=['planning','active','on-hold','completed','cancelled']
const statusColor={planning:'#8b5cf6',active:'#16a34a','on-hold':'#d97706',completed:'#4F6EF7',cancelled:'#dc2626'}
const statusBg={planning:'rgba(139,92,246,0.1)',active:'rgba(22,163,74,0.1)','on-hold':'rgba(217,119,6,0.1)',completed:'rgba(79,110,247,0.1)',cancelled:'rgba(220,38,38,0.1)'}

const Section=({title,icon:Icon,children})=>(
<div className="card" style={{padding:24,marginBottom:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.05em'}}>
<Icon size={15}/>{title}
</div>
{children}
</div>
)

export default function Projects(){
const[companyId,setCompanyId]=useState(null)
const[projects,setProjects]=useState([])
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[filterStatus,setFilterStatus]=useState('')
const[modal,setModal]=useState(null)
const[viewModal,setViewModal]=useState(null)
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[form,setForm]=useState({
name:'',clientName:'',description:'',
startDate:'',endDate:'',
budget:0,spent:0,
status:'planning',
tags:'',
})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const cusSnap=await getDocs(collection(db,'companies',cid,'customers'))
setCustomers(cusSnap.docs.map(d=>({id:d.id,...d.data()})))
onSnapshot(collection(db,'companies',cid,'projects'),snap=>{
setProjects(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setLoading(false)
})
}
}
load()
},[])

const openAdd=()=>{
setForm({name:'',clientName:'',description:'',startDate:new Date().toISOString().split('T')[0],endDate:'',budget:0,spent:0,status:'planning',tags:''})
setSelected(null)
setModal('add')
}

const openEdit=(p)=>{
setForm({name:p.name||'',clientName:p.clientName||'',description:p.description||'',startDate:p.startDate||'',endDate:p.endDate||'',budget:p.budget||0,spent:p.spent||0,status:p.status||'planning',tags:p.tags||''})
setSelected(p)
setModal('edit')
}

const handleSave=async()=>{
if(!form.name){alert('Project name required');return}
setSaving(true)
try{
if(modal==='add'){
await addDoc(collection(db,'companies',companyId,'projects'),{
...form,budget:Number(form.budget),spent:Number(form.spent),
projectNumber:'PRJ-'+Date.now().toString().slice(-6),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'projects',selected.id),{
...form,budget:Number(form.budget),spent:Number(form.spent),updatedAt:serverTimestamp()
})
}
setModal(null)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this project?'))return
await deleteDoc(doc(db,'companies',companyId,'projects',id))
}

const filtered=projects.filter(p=>{
const matchSearch=p.name?.toLowerCase().includes(search.toLowerCase())||p.clientName?.toLowerCase().includes(search.toLowerCase())
const matchStatus=filterStatus?p.status===filterStatus:true
return matchSearch&&matchStatus
})

const totalBudget=projects.reduce((s,p)=>s+Number(p.budget||0),0)
const totalSpent=projects.reduce((s,p)=>s+Number(p.spent||0),0)

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Projects">

{/* Modal */}
{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:560,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1}}>
<div style={{fontWeight:600,fontSize:15}}>{modal==='add'?'New Project':'Edit Project'}</div>
<button type="button" onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Project Name *</label>
<input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Project name..."/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Client</label>
<input className="form-input" list="client-list" value={form.clientName} onChange={e=>setForm(f=>({...f,clientName:e.target.value}))} placeholder="Client name..."/>
<datalist id="client-list">{customers.map(c=><option key={c.id} value={c.name}/>)}</datalist>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Start Date</label>
<input className="form-input" type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>End Date</label>
<input className="form-input" type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Budget (Ks)</label>
<input className="form-input" type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Spent (Ks)</label>
<input className="form-input" type="number" value={form.spent} onChange={e=>setForm(f=>({...f,spent:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Status</label>
<select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
{STATUS.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
</select>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Tags</label>
<input className="form-input" value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="design, web, mobile..."/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Description</label>
<textarea className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Project description..." rows={3} style={{resize:'vertical'}}/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
<Save size={14}/>{saving?'Saving...':modal==='add'?'Create Project':'Update'}
</button>
</div>
</div>
</div>
</div>
)}

{/* View Modal */}
{viewModal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:500,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white'}}>
<div style={{fontWeight:600,fontSize:15}}>{viewModal.projectNumber}</div>
<button type="button" onClick={()=>setViewModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
<div style={{fontWeight:700,fontSize:18}}>{viewModal.name}</div>
<span style={{background:statusBg[viewModal.status],color:statusColor[viewModal.status],padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{viewModal.status}</span>
</div>
{[
{label:'Client',value:viewModal.clientName||'-'},
{label:'Start Date',value:viewModal.startDate||'-'},
{label:'End Date',value:viewModal.endDate||'-'},
{label:'Budget',value:`${Number(viewModal.budget||0).toLocaleString()} Ks`},
{label:'Spent',value:`${Number(viewModal.spent||0).toLocaleString()} Ks`},
{label:'Remaining',value:`${(Number(viewModal.budget||0)-Number(viewModal.spent||0)).toLocaleString()} Ks`},
].map(({label,value})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>{label}</span>
<span style={{fontSize:13,fontWeight:500}}>{value}</span>
</div>
))}
{viewModal.tags&&(
<div style={{marginTop:12}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Tags</div>
<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
{viewModal.tags.split(',').map(t=>(
<span key={t} style={{background:'var(--primary-light)',color:'var(--primary)',padding:'2px 8px',borderRadius:20,fontSize:11}}>{t.trim()}</span>
))}
</div>
</div>
)}
{viewModal.description&&(
<div style={{marginTop:16}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>Description</div>
<div style={{fontSize:13,color:'var(--text-1)',lineHeight:1.6}}>{viewModal.description}</div>
</div>
)}
{/* Budget Progress */}
{viewModal.budget>0&&(
<div style={{marginTop:16}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
<span style={{color:'var(--text-2)'}}>Budget Usage</span>
<span style={{fontWeight:500}}>{Math.min(Math.round(Number(viewModal.spent||0)/Number(viewModal.budget)*100),100)}%</span>
</div>
<div style={{height:6,background:'#f1f5f9',borderRadius:4}}>
<div style={{
height:6,borderRadius:4,
background:Number(viewModal.spent)>Number(viewModal.budget)?'#dc2626':'#4F6EF7',
width:`${Math.min(Number(viewModal.spent||0)/Number(viewModal.budget)*100,100)}%`
}}/>
</div>
</div>
)}
</div>
</div>
</div>
)}

{/* Header */}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12,flexWrap:'wrap'}}>
<div style={{display:'flex',gap:8,flex:1,flexWrap:'wrap'}}>
<div style={{position:'relative',minWidth:200}}>
<Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects..." style={{paddingLeft:32}}/>
</div>
<select className="form-input" style={{width:'auto'}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
<option value="">All Status</option>
{STATUS.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
</select>
</div>
<button type="button" onClick={openAdd} className="btn btn-primary">
<Plus size={15}/>New Project
</button>
</div>

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:16}}>
{STATUS.map(s=>(
<div key={s} className="card" style={{padding:16}}>
<div style={{fontSize:11,fontWeight:500,color:'var(--text-2)',marginBottom:6,textTransform:'capitalize'}}>{s}</div>
<div style={{fontSize:22,fontWeight:700,color:statusColor[s]}}>{projects.filter(p=>p.status===s).length}</div>
</div>
))}
</div>

{/* Budget Summary */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
<div className="card" style={{padding:16}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>Total Budget</div>
<div style={{fontSize:20,fontWeight:700,color:'#4F6EF7'}}>{totalBudget.toLocaleString()} Ks</div>
</div>
<div className="card" style={{padding:16}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>Total Spent</div>
<div style={{fontSize:20,fontWeight:700,color:'#dc2626'}}>{totalSpent.toLocaleString()} Ks</div>
</div>
<div className="card" style={{padding:16}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>Remaining</div>
<div style={{fontSize:20,fontWeight:700,color:'#16a34a'}}>{(totalBudget-totalSpent).toLocaleString()} Ks</div>
</div>
</div>

{/* Table */}
<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<Briefcase size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search||filterStatus?'No results':'No projects yet'}</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Name</th><th>Client</th><th style={{textAlign:'right'}}>Budget</th><th style={{textAlign:'right'}}>Spent</th><th>Timeline</th><th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(p=>(
<tr key={p.id}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{p.projectNumber}</td>
<td style={{fontWeight:500}}>
<div>{p.name}</div>
{p.tags&&<div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
{p.tags.split(',').slice(0,2).map(t=>(
<span key={t} style={{background:'var(--primary-light)',color:'var(--primary)',padding:'1px 6px',borderRadius:20,fontSize:10}}>{t.trim()}</span>
))}
</div>}
</td>
<td style={{color:'var(--text-2)'}}>{p.clientName||'-'}</td>
<td style={{textAlign:'right',fontWeight:500}}>{Number(p.budget||0).toLocaleString()} Ks</td>
<td style={{textAlign:'right',color:Number(p.spent)>Number(p.budget)?'#dc2626':'var(--text-1)',fontWeight:500}}>{Number(p.spent||0).toLocaleString()} Ks</td>
<td style={{fontSize:12,color:'var(--text-3)'}}>
<div>{p.startDate||'-'}</div>
<div>{p.endDate?`→ ${p.endDate}`:''}</div>
</td>
<td style={{textAlign:'center'}}>
<span style={{background:statusBg[p.status],color:statusColor[p.status],padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{p.status}</span>
</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button type="button" onClick={()=>setViewModal(p)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Eye size={14}/></button>
<button type="button" onClick={()=>openEdit(p)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button type="button" onClick={()=>handleDelete(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
</div>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>
</Layout>
)
}
