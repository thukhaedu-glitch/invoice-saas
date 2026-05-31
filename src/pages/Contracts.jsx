import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,X,Save,ScrollText,Search,Eye}from'lucide-react'

const STATUS=['draft','active','expired','cancelled']

export default function Contracts(){
const[companyId,setCompanyId]=useState(null)
const[contracts,setContracts]=useState([])
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[modal,setModal]=useState(null)
const[viewModal,setViewModal]=useState(null)
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[form,setForm]=useState({
title:'',clientName:'',startDate:'',endDate:'',
value:0,status:'draft',description:'',terms:''
})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const cusSnap=await getDocs(collection(db,'companies',cid,'customers'))
setCustomers(cusSnap.docs.map(d=>({id:d.id,...d.data()})))
onSnapshot(collection(db,'companies',cid,'contracts'),snap=>{
setContracts(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setLoading(false)
})
}
}
load()
},[])

const openAdd=()=>{
setForm({title:'',clientName:'',startDate:new Date().toISOString().split('T')[0],endDate:'',value:0,status:'draft',description:'',terms:''})
setSelected(null)
setModal('add')
}

const openEdit=(c)=>{
setForm({title:c.title||'',clientName:c.clientName||'',startDate:c.startDate||'',endDate:c.endDate||'',value:c.value||0,status:c.status||'draft',description:c.description||'',terms:c.terms||''})
setSelected(c)
setModal('edit')
}

const handleSave=async()=>{
if(!form.title||!form.clientName){alert('Title and client required');return}
setSaving(true)
try{
if(modal==='add'){
await addDoc(collection(db,'companies',companyId,'contracts'),{
...form,value:Number(form.value),
contractNumber:'CON-'+Date.now().toString().slice(-6),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'contracts',selected.id),{
...form,value:Number(form.value),updatedAt:serverTimestamp()
})
}
setModal(null)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this contract?'))return
await deleteDoc(doc(db,'companies',companyId,'contracts',id))
}

const statusColor={draft:'#64748b',active:'#16a34a',expired:'#d97706',cancelled:'#dc2626'}
const statusBg={draft:'#f1f5f9',active:'#eaf3de',expired:'#faeeda',cancelled:'#fcebeb'}

const filtered=contracts.filter(c=>
c.title?.toLowerCase().includes(search.toLowerCase())||
c.clientName?.toLowerCase().includes(search.toLowerCase())||
c.contractNumber?.toLowerCase().includes(search.toLowerCase())
)

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Contracts">

{/* Modal */}
{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:560,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1}}>
<div style={{fontWeight:600,fontSize:15}}>{modal==='add'?'New Contract':'Edit Contract'}</div>
<button type="button" onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Contract Title *</label>
<input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Contract title..."/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Client *</label>
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
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Contract Value (Ks)</label>
<input className="form-input" type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Status</label>
<select className="form-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
{STATUS.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
</select>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Description</label>
<textarea className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Contract description..." rows={3} style={{resize:'vertical'}}/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Terms & Conditions</label>
<textarea className="form-input" value={form.terms} onChange={e=>setForm(f=>({...f,terms:e.target.value}))} placeholder="Terms and conditions..." rows={4} style={{resize:'vertical'}}/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
<Save size={14}/>{saving?'Saving...':modal==='add'?'Create Contract':'Update'}
</button>
</div>
</div>
</div>
</div>
)}

{/* View Modal */}
{viewModal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:560,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white'}}>
<div style={{fontWeight:600,fontSize:15}}>{viewModal.contractNumber}</div>
<button type="button" onClick={()=>setViewModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
<div style={{fontWeight:700,fontSize:18,color:'var(--text-1)'}}>{viewModal.title}</div>
<span style={{background:statusBg[viewModal.status],color:statusColor[viewModal.status],padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{viewModal.status}</span>
</div>
{[
{label:'Client',value:viewModal.clientName},
{label:'Contract Value',value:`${Number(viewModal.value||0).toLocaleString()} Ks`},
{label:'Start Date',value:viewModal.startDate||'-'},
{label:'End Date',value:viewModal.endDate||'-'},
].map(({label,value})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>{label}</span>
<span style={{fontSize:13,fontWeight:500}}>{value}</span>
</div>
))}
{viewModal.description&&(
<div style={{marginTop:16}}>
<div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',marginBottom:6}}>Description</div>
<div style={{fontSize:13,color:'var(--text-1)',lineHeight:1.6}}>{viewModal.description}</div>
</div>
)}
{viewModal.terms&&(
<div style={{marginTop:16}}>
<div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',marginBottom:6}}>Terms & Conditions</div>
<div style={{fontSize:13,color:'var(--text-1)',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{viewModal.terms}</div>
</div>
)}
</div>
</div>
</div>
)}

{/* Header */}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12}}>
<div style={{position:'relative',flex:1,maxWidth:320}}>
<Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contracts..." style={{paddingLeft:32}}/>
</div>
<button type="button" onClick={openAdd} className="btn btn-primary">
<Plus size={15}/>New Contract
</button>
</div>

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
{STATUS.map(s=>(
<div key={s} className="card" style={{padding:16}}>
<div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:6,textTransform:'capitalize'}}>{s}</div>
<div style={{fontSize:24,fontWeight:700,color:statusColor[s]}}>{contracts.filter(c=>c.status===s).length}</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{contracts.filter(c=>c.status===s).reduce((sum,c)=>sum+Number(c.value||0),0).toLocaleString()} Ks</div>
</div>
))}
</div>

{/* Table */}
<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<ScrollText size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search?'No results found':'No contracts yet'}</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th>
<th>Title</th>
<th>Client</th>
<th style={{textAlign:'right'}}>Value</th>
<th>Start</th>
<th>End</th>
<th style={{textAlign:'center'}}>Status</th>
<th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(c=>(
<tr key={c.id}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{c.contractNumber}</td>
<td style={{fontWeight:500}}>{c.title}</td>
<td style={{color:'var(--text-2)'}}>{c.clientName}</td>
<td style={{textAlign:'right',fontWeight:500}}>{Number(c.value||0).toLocaleString()} Ks</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{c.startDate||'-'}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{c.endDate||'-'}</td>
<td style={{textAlign:'center'}}>
<span style={{background:statusBg[c.status],color:statusColor[c.status],padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{c.status}</span>
</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button type="button" onClick={()=>setViewModal(c)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Eye size={14}/></button>
<button type="button" onClick={()=>openEdit(c)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button type="button" onClick={()=>handleDelete(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
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
