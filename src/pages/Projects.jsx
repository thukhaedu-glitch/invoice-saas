import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,updateDoc,serverTimestamp,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,X,Save,Briefcase,Search,Eye,ArrowLeft,CheckSquare,Square,Clock,AlertCircle,DollarSign,FileText,List,Calendar,TrendingUp}from'lucide-react'

const STATUS=['planning','active','on-hold','completed','cancelled']
const statusColor={planning:'#8b5cf6',active:'#16a34a','on-hold':'#d97706',completed:'#4F6EF7',cancelled:'#dc2626'}
const statusBg={planning:'rgba(139,92,246,0.1)',active:'rgba(22,163,74,0.1)','on-hold':'rgba(217,119,6,0.1)',completed:'rgba(79,110,247,0.1)',cancelled:'rgba(220,38,38,0.1)'}
const TASK_STATUS=['todo','in-progress','done']
const taskColor={todo:'#64748b','in-progress':'#d97706',done:'#16a34a'}

export default function Projects(){
const[companyId,setCompanyId]=useState(null)
const[projects,setProjects]=useState([])
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[filterStatus,setFilterStatus]=useState('')
const[modal,setModal]=useState(null)
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[view,setView]=useState('list')
const[activeProject,setActiveProject]=useState(null)
const[activeTab,setActiveTab]=useState('overview')
const[tasks,setTasks]=useState([])
const[milestones,setMilestones]=useState([])
const[linkedExpenses,setLinkedExpenses]=useState([])
const[linkedInvoices,setLinkedInvoices]=useState([])
const[newTask,setNewTask]=useState('')
const[newMilestone,setNewMilestone]=useState({title:'',date:'',done:false})
const[form,setForm]=useState({
name:'',clientName:'',description:'',
startDate:'',endDate:'',
budget:0,spent:0,status:'planning',tags:'',
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

const openProject=async(p)=>{
setActiveProject(p)
setActiveTab('overview')
setView('detail')
if(!companyId)return
onSnapshot(collection(db,'companies',companyId,'projects',p.id,'tasks'),snap=>{
setTasks(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)))
})
onSnapshot(collection(db,'companies',companyId,'projects',p.id,'milestones'),snap=>{
setMilestones(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.date||'').localeCompare(b.date||'')))
})
const[expSnap,invSnap]=await Promise.all([
getDocs(query(collection(db,'companies',companyId,'expenses'),where('projectId','==',p.id))),
getDocs(query(collection(db,'companies',companyId,'invoices'),where('projectId','==',p.id))),
])
setLinkedExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})))
setLinkedInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})))
}

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
createdAt:serverTimestamp(),createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'projects',selected.id),{
...form,budget:Number(form.budget),spent:Number(form.spent),updatedAt:serverTimestamp()
})
if(activeProject?.id===selected.id)setActiveProject(p=>({...p,...form}))
}
setModal(null)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this project?'))return
await deleteDoc(doc(db,'companies',companyId,'projects',id))
}

const addTask=async()=>{
if(!newTask.trim())return
await addDoc(collection(db,'companies',companyId,'projects',activeProject.id,'tasks'),{
title:newTask.trim(),status:'todo',
createdAt:serverTimestamp(),createdBy:auth.currentUser.uid,
})
setNewTask('')
}

const updateTaskStatus=async(taskId,status)=>{
await updateDoc(doc(db,'companies',companyId,'projects',activeProject.id,'tasks',taskId),{status})
}

const deleteTask=async(taskId)=>{
await deleteDoc(doc(db,'companies',companyId,'projects',activeProject.id,'tasks',taskId))
}

const addMilestone=async()=>{
if(!newMilestone.title.trim())return
await addDoc(collection(db,'companies',companyId,'projects',activeProject.id,'milestones'),{
...newMilestone,createdAt:serverTimestamp(),
})
setNewMilestone({title:'',date:'',done:false})
}

const toggleMilestone=async(mId,done)=>{
await updateDoc(doc(db,'companies',companyId,'projects',activeProject.id,'milestones',mId),{done:!done})
}

const deleteMilestone=async(mId)=>{
await deleteDoc(doc(db,'companies',companyId,'projects',activeProject.id,'milestones',mId))
}

const filtered=projects.filter(p=>{
const matchSearch=p.name?.toLowerCase().includes(search.toLowerCase())||p.clientName?.toLowerCase().includes(search.toLowerCase())
const matchStatus=filterStatus?p.status===filterStatus:true
return matchSearch&&matchStatus
})

const totalBudget=projects.reduce((s,p)=>s+Number(p.budget||0),0)
const totalSpent=projects.reduce((s,p)=>s+Number(p.spent||0),0)

// Project profit calc
const projectRevenue=linkedInvoices.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const projectExpenses=linkedExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
const projectProfit=projectRevenue-projectExpenses

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

// Detail View
if(view==='detail'&&activeProject)return(
<Layout title={activeProject.name}>

{/* Modal */}
{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:560,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1}}>
<div style={{fontWeight:600,fontSize:15}}>Edit Project</div>
<button type="button" onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Project Name *</label>
<input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Client</label>
<input className="form-input" value={form.clientName} onChange={e=>setForm(f=>({...f,clientName:e.target.value}))}/>
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
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Status</label>
<select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
{STATUS.map(s=><option key={s} value={s}>{s}</option>)}
</select>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Description</label>
<textarea className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} style={{resize:'vertical'}}/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary"><Save size={14}/>{saving?'Saving...':'Update'}</button>
</div>
</div>
</div>
</div>
)}

<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>setView('list')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<div style={{flex:1}}>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<h2 style={{fontSize:18,fontWeight:700,color:'var(--text-1)'}}>{activeProject.name}</h2>
<span style={{background:statusBg[activeProject.status],color:statusColor[activeProject.status],padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{activeProject.status}</span>
</div>
{activeProject.clientName&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>{activeProject.clientName}</div>}
</div>
<button type="button" onClick={()=>openEdit(activeProject)} className="btn btn-ghost"><Edit size={14}/>Edit</button>
</div>

{/* Tabs */}
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:12,padding:4,marginBottom:20,width:'fit-content'}}>
{[
{id:'overview',label:'Overview',icon:TrendingUp},
{id:'tasks',label:'Tasks',icon:List},
{id:'timeline',label:'Timeline',icon:Calendar},
{id:'expenses',label:'Expenses',icon:DollarSign},
{id:'invoices',label:'Invoices',icon:FileText},
].map(({id,label,icon:Icon})=>(
<button type="button" key={id} onClick={()=>setActiveTab(id)} className="btn" style={{
padding:'7px 14px',borderRadius:8,fontSize:13,
background:activeTab===id?'var(--primary)':'transparent',
color:activeTab===id?'#fff':'var(--text-2)',
display:'flex',alignItems:'center',gap:6,
}}>
<Icon size={13}/>{label}
</button>
))}
</div>

{/* Overview Tab */}
{activeTab==='overview'&&(
<div>
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
{[
{label:'Budget',value:Number(activeProject.budget||0).toLocaleString()+' Ks',color:'#4F6EF7'},
{label:'Revenue (Paid Inv)',value:projectRevenue.toLocaleString()+' Ks',color:'#16a34a'},
{label:'Expenses',value:projectExpenses.toLocaleString()+' Ks',color:'#dc2626'},
{label:'Net Profit',value:projectProfit.toLocaleString()+' Ks',color:projectProfit>=0?'#16a34a':'#dc2626'},
{label:'Tasks',value:`${tasks.filter(t=>t.status==='done').length}/${tasks.length} done`,color:'#8b5cf6'},
{label:'Milestones',value:`${milestones.filter(m=>m.done).length}/${milestones.length} done`,color:'#d97706'},
].map(({label,value,color})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>{label}</div>
<div style={{fontSize:18,fontWeight:700,color}}>{value}</div>
</div>
))}
</div>
{activeProject.budget>0&&(
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontSize:13,fontWeight:500,color:'var(--text-2)',marginBottom:12}}>Budget Usage</div>
<div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
<span style={{color:'var(--text-3)'}}>Spent: {Number(activeProject.spent||0).toLocaleString()} Ks</span>
<span style={{fontWeight:500}}>{Math.min(Math.round(Number(activeProject.spent||0)/Number(activeProject.budget)*100),100)}%</span>
</div>
<div style={{height:8,background:'#f1f5f9',borderRadius:4}}>
<div style={{height:8,borderRadius:4,background:Number(activeProject.spent)>Number(activeProject.budget)?'#dc2626':'#4F6EF7',width:`${Math.min(Number(activeProject.spent||0)/Number(activeProject.budget)*100,100)}%`,transition:'width 0.3s'}}/>
</div>
</div>
)}
{activeProject.description&&(
<div className="card" style={{padding:20}}>
<div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',marginBottom:8}}>Description</div>
<div style={{fontSize:13,color:'var(--text-1)',lineHeight:1.7}}>{activeProject.description}</div>
</div>
)}
</div>
)}

{/* Tasks Tab */}
{activeTab==='tasks'&&(
<div>
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{display:'flex',gap:8,marginBottom:16}}>
<input className="form-input" value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add new task..." onKeyDown={e=>e.key==='Enter'&&addTask()} style={{flex:1}}/>
<button type="button" onClick={addTask} className="btn btn-primary"><Plus size={15}/>Add</button>
</div>
<div style={{display:'flex',gap:8,marginBottom:12}}>
{TASK_STATUS.map(s=>(
<span key={s} style={{background:s==='todo'?'#f1f5f9':s==='in-progress'?'#faeeda':'#eaf3de',color:taskColor[s],padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:500}}>
{tasks.filter(t=>t.status===s).length} {s}
</span>
))}
</div>
{tasks.length===0?(
<div style={{textAlign:'center',color:'var(--text-3)',padding:32,fontSize:13}}>No tasks yet — add one above</div>
):tasks.map(task=>(
<div key={task.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'0.5px solid #f8fafc'}}>
<button type="button" onClick={()=>updateTaskStatus(task.id,task.status==='done'?'todo':'done')} style={{background:'none',border:'none',cursor:'pointer',color:task.status==='done'?'#16a34a':'var(--text-3)',flexShrink:0}}>
{task.status==='done'?<CheckSquare size={18}/>:<Square size={18}/>}
</button>
<span style={{flex:1,fontSize:13,color:task.status==='done'?'var(--text-3)':'var(--text-1)',textDecoration:task.status==='done'?'line-through':'none'}}>{task.title}</span>
<select value={task.status} onChange={e=>updateTaskStatus(task.id,e.target.value)} className="form-input" style={{width:'auto',fontSize:11,padding:'3px 6px',color:taskColor[task.status]}}>
{TASK_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
</select>
<button type="button" onClick={()=>deleteTask(task.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:2}}><Trash2 size={13}/></button>
</div>
))}
</div>
</div>
)}

{/* Timeline Tab */}
{activeTab==='timeline'&&(
<div>
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Add Milestone</div>
<div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8}}>
<input className="form-input" value={newMilestone.title} onChange={e=>setNewMilestone(m=>({...m,title:e.target.value}))} placeholder="Milestone title..."/>
<input className="form-input" type="date" value={newMilestone.date} onChange={e=>setNewMilestone(m=>({...m,date:e.target.value}))}/>
<button type="button" onClick={addMilestone} className="btn btn-primary"><Plus size={15}/>Add</button>
</div>
</div>
<div className="card" style={{padding:20}}>
{milestones.length===0?(
<div style={{textAlign:'center',color:'var(--text-3)',padding:32,fontSize:13}}>No milestones yet</div>
):(
<div style={{position:'relative'}}>
<div style={{position:'absolute',left:14,top:0,bottom:0,width:2,background:'#e2e8f0'}}/>
{milestones.map((m,i)=>(
<div key={m.id} style={{display:'flex',gap:16,marginBottom:20,position:'relative'}}>
<div style={{
width:28,height:28,borderRadius:'50%',
background:m.done?'#16a34a':'white',
border:`2px solid ${m.done?'#16a34a':'#e2e8f0'}`,
display:'flex',alignItems:'center',justifyContent:'center',
flexShrink:0,zIndex:1,cursor:'pointer',
}} onClick={()=>toggleMilestone(m.id,m.done)}>
{m.done&&<CheckSquare size={14} color="white"/>}
</div>
<div style={{flex:1,paddingTop:4}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div style={{fontSize:13,fontWeight:500,color:m.done?'var(--text-3)':'var(--text-1)',textDecoration:m.done?'line-through':'none'}}>{m.title}</div>
<button type="button" onClick={()=>deleteMilestone(m.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:2}}><Trash2 size={13}/></button>
</div>
{m.date&&<div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{m.date}</div>}
</div>
</div>
))}
</div>
)}
</div>
</div>
)}

{/* Expenses Tab */}
{activeTab==='expenses'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14}}>Linked Expenses</div>
<div style={{fontSize:13,color:'#dc2626',fontWeight:500}}>Total: {projectExpenses.toLocaleString()} Ks</div>
</div>
{linkedExpenses.length===0?(
<div style={{padding:40,textAlign:'center',color:'var(--text-3)',fontSize:13}}>
No expenses linked to this project yet.<br/>
<span style={{fontSize:12}}>Add expenses from the Expenses page and select this project.</span>
</div>
):(
<table>
<thead><tr><th>Date</th><th>Title</th><th>Category</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
<tbody>
{linkedExpenses.map(e=>(
<tr key={e.id}>
<td style={{color:'var(--text-3)',fontSize:12}}>{e.date||'-'}</td>
<td style={{fontWeight:500}}>{e.title}</td>
<td><span style={{background:'var(--primary-light)',color:'var(--primary)',padding:'2px 8px',borderRadius:20,fontSize:11}}>{e.category}</span></td>
<td style={{textAlign:'right',fontWeight:500,color:'#dc2626'}}>{Number(e.amount||0).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}

{/* Invoices Tab */}
{activeTab==='invoices'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14}}>Linked Invoices</div>
<div style={{fontSize:13,color:'#16a34a',fontWeight:500}}>Revenue: {projectRevenue.toLocaleString()} Ks</div>
</div>
{linkedInvoices.length===0?(
<div style={{padding:40,textAlign:'center',color:'var(--text-3)',fontSize:13}}>
No invoices linked to this project yet.<br/>
<span style={{fontSize:12}}>Create invoices and select this project.</span>
</div>
):(
<table>
<thead><tr><th>Number</th><th>Client</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'center'}}>Status</th></tr></thead>
<tbody>
{linkedInvoices.map(i=>(
<tr key={i.id}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12}}>{i.invoiceNumber}</td>
<td style={{fontWeight:500}}>{i.clientName}</td>
<td style={{textAlign:'right',fontWeight:500}}>{Number(i.totalAmount||0).toLocaleString()} Ks</td>
<td style={{textAlign:'center'}}><span style={{background:i.status==='paid'?'#eaf3de':'#faeeda',color:i.status==='paid'?'#16a34a':'#d97706',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{i.status}</span></td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}
</Layout>
)

// List View
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
<button type="button" onClick={openAdd} className="btn btn-primary"><Plus size={15}/>New Project</button>
</div>

<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:16}}>
{STATUS.map(s=>(
<div key={s} className="card" style={{padding:16}}>
<div style={{fontSize:11,fontWeight:500,color:'var(--text-2)',marginBottom:6,textTransform:'capitalize'}}>{s}</div>
<div style={{fontSize:22,fontWeight:700,color:statusColor[s]}}>{projects.filter(p=>p.status===s).length}</div>
</div>
))}
</div>

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

<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<Briefcase size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search||filterStatus?'No results':'No projects yet'}</div>
</div>
):(
<table>
<thead>
<tr><th>Number</th><th>Name</th><th>Client</th><th style={{textAlign:'right'}}>Budget</th><th>Timeline</th><th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'center'}}>Actions</th></tr>
</thead>
<tbody>
{filtered.map(p=>(
<tr key={p.id} style={{cursor:'pointer'}} onClick={()=>openProject(p)}>
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
<td style={{fontSize:12,color:'var(--text-3)'}}>
<div>{p.startDate||'-'}</div>
<div>{p.endDate?`→ ${p.endDate}`:''}</div>
</td>
<td style={{textAlign:'center'}}>
<span style={{background:statusBg[p.status],color:statusColor[p.status],padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{p.status}</span>
</td>
<td style={{textAlign:'center'}} onClick={e=>e.stopPropagation()}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button type="button" onClick={()=>openProject(p)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Eye size={14}/></button>
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
