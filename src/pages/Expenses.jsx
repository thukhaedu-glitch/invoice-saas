import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,X,Save,Wallet,TrendingDown,Calendar,Search}from'lucide-react'

const CATEGORIES=['Office','Transport','Food','Utilities','Marketing','Salary','Equipment','Software','Other']

export default function Expenses(){
const[companyId,setCompanyId]=useState(null)
const[expenses,setExpenses]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[filterMonth,setFilterMonth]=useState('')
const[modal,setModal]=useState(null)
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[form,setForm]=useState({
title:'',amount:0,category:'Office',
date:new Date().toISOString().split('T')[0],
note:''
})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
onSnapshot(collection(db,'companies',cid,'expenses'),snap=>{
setExpenses(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.date?.localeCompare(a.date)))
setLoading(false)
})
}
}
load()
},[])

const openAdd=()=>{
setForm({title:'',amount:0,category:'Office',date:new Date().toISOString().split('T')[0],note:''})
setSelected(null)
setModal('add')
}

const openEdit=(e)=>{
setForm({title:e.title||'',amount:e.amount||0,category:e.category||'Office',date:e.date||'',note:e.note||''})
setSelected(e)
setModal('edit')
}

const handleSave=async()=>{
if(!form.title||!form.amount){alert('Title and amount required');return}
setSaving(true)
try{
if(modal==='add'){
await addDoc(collection(db,'companies',companyId,'expenses'),{
...form,amount:Number(form.amount),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'expenses',selected.id),{
...form,amount:Number(form.amount),updatedAt:serverTimestamp()
})
}
setModal(null)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this expense?'))return
await deleteDoc(doc(db,'companies',companyId,'expenses',id))
}

const filtered=expenses.filter(e=>{
const matchSearch=e.title?.toLowerCase().includes(search.toLowerCase())||e.category?.toLowerCase().includes(search.toLowerCase())
const matchMonth=filterMonth?e.date?.startsWith(filterMonth):true
return matchSearch&&matchMonth
})

const totalAmt=filtered.reduce((s,e)=>s+Number(e.amount||0),0)
const byCategory=CATEGORIES.map(c=>({
category:c,
total:filtered.filter(e=>e.category===c).reduce((s,e)=>s+Number(e.amount||0),0)
})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total)

const months=[...new Set(expenses.map(e=>e.date?.slice(0,7)))].filter(Boolean).sort().reverse()

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Expenses">

{/* Modal */}
{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:15}}>{modal==='add'?'Add Expense':'Edit Expense'}</div>
<button onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Title *</label>
<input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Expense title..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Amount (Ks) *</label>
<input className="form-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Category</label>
<select className="form-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
{CATEGORIES.map(c=><option key={c}>{c}</option>)}
</select>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Date</label>
<input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Note</label>
<input className="form-input" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Optional..."/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
<button onClick={handleSave} disabled={saving} className="btn btn-primary">
<Save size={14}/>{saving?'Saving...':modal==='add'?'Add Expense':'Update'}
</button>
</div>
</div>
</div>
</div>
)}

{/* Header */}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12,flexWrap:'wrap'}}>
<div style={{display:'flex',gap:8,flex:1,flexWrap:'wrap'}}>
<div style={{position:'relative',minWidth:200}}>
<Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search expenses..." style={{paddingLeft:32}}/>
</div>
<select className="form-input" style={{width:'auto'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map(m=><option key={m} value={m}>{m}</option>)}
</select>
</div>
<button onClick={openAdd} className="btn btn-primary">
<Plus size={15}/>Add Expense
</button>
</div>

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
<div className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
<span style={{fontSize:12,fontWeight:500,color:'var(--text-2)'}}>Total Expenses</span>
<div style={{width:32,height:32,borderRadius:8,background:'rgba(220,38,38,0.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
<TrendingDown size={16} color="#dc2626"/>
</div>
</div>
<div style={{fontSize:24,fontWeight:700,color:'#dc2626'}}>{totalAmt.toLocaleString()} Ks</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{filtered.length} records</div>
</div>
<div className="card" style={{padding:16}}>
<div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:10}}>By Category</div>
{byCategory.slice(0,4).map(({category,total})=>(
<div key={category} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0'}}>
<span style={{color:'var(--text-2)'}}>{category}</span>
<span style={{fontWeight:500,color:'#dc2626'}}>{total.toLocaleString()} Ks</span>
</div>
))}
</div>
</div>

{/* Table */}
<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<Wallet size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search||filterMonth?'No results found':'No expenses yet'}</div>
</div>
):(
<table>
<thead>
<tr>
<th>Date</th>
<th>Title</th>
<th>Category</th>
<th style={{textAlign:'right'}}>Amount</th>
<th>Note</th>
<th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(e=>(
<tr key={e.id}>
<td style={{color:'var(--text-3)',fontSize:12,whiteSpace:'nowrap'}}>{e.date||'-'}</td>
<td style={{fontWeight:500}}>{e.title}</td>
<td>
<span style={{background:'var(--primary-light)',color:'var(--primary)',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{e.category}</span>
</td>
<td style={{textAlign:'right',fontWeight:500,color:'#dc2626'}}>{Number(e.amount||0).toLocaleString()} Ks</td>
<td style={{color:'var(--text-2)',fontSize:12}}>{e.note||'-'}</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button onClick={()=>openEdit(e)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button onClick={()=>handleDelete(e.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
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
