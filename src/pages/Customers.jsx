import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,X,Save,Users,Phone,Mail,MapPin,Search}from'lucide-react'

export default function Customers(){
const[companyId,setCompanyId]=useState(null)
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[modal,setModal]=useState(null) // null | 'add' | 'edit'
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[form,setForm]=useState({name:'',phone:'',email:'',address:'',note:''})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
onSnapshot(collection(db,'companies',cid,'customers'),snap=>{
setCustomers(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name?.localeCompare(b.name)))
setLoading(false)
})
}
}
load()
},[])

const openAdd=()=>{
setForm({name:'',phone:'',email:'',address:'',note:''})
setSelected(null)
setModal('add')
}

const openEdit=(c)=>{
setForm({name:c.name||'',phone:c.phone||'',email:c.email||'',address:c.address||'',note:c.note||''})
setSelected(c)
setModal('edit')
}

const handleSave=async()=>{
if(!form.name){alert('Name required');return}
setSaving(true)
try{
if(modal==='add'){
await addDoc(collection(db,'companies',companyId,'customers'),{
...form,
customerId:'CUS-'+Date.now().toString().slice(-6),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'customers',selected.id),{...form,updatedAt:serverTimestamp()})
}
setModal(null)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this customer?'))return
await deleteDoc(doc(db,'companies',companyId,'customers',id))
}

const filtered=customers.filter(c=>
c.name?.toLowerCase().includes(search.toLowerCase())||
c.phone?.includes(search)||
c.email?.toLowerCase().includes(search.toLowerCase())
)

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Customers">

{/* Modal */}
{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:15}}>{modal==='add'?'Add Customer':'Edit Customer'}</div>
<button onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Name *</label>
<input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Customer name..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Phone</label>
<input className="form-input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="09..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Email</label>
<input className="form-input" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com"/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Address</label>
<input className="form-input" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Address..."/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Note</label>
<input className="form-input" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Optional note..."/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
<button onClick={handleSave} disabled={saving} className="btn btn-primary">
<Save size={14}/>{saving?'Saving...':modal==='add'?'Add Customer':'Update'}
</button>
</div>
</div>
</div>
</div>
)}

{/* Header */}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12}}>
<div style={{position:'relative',flex:1,maxWidth:320}}>
<Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers..." style={{paddingLeft:32}}/>
</div>
<button onClick={openAdd} className="btn btn-primary">
<Plus size={15}/>Add Customer
</button>
</div>

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
{[
{label:'Total Customers',value:customers.length,icon:Users,color:'#4F6EF7',bg:'rgba(79,110,247,0.10)'},
{label:'With Phone',value:customers.filter(c=>c.phone).length,icon:Phone,color:'#16a34a',bg:'rgba(22,163,74,0.10)'},
{label:'With Email',value:customers.filter(c=>c.email).length,icon:Mail,color:'#d97706',bg:'rgba(217,119,6,0.10)'},
].map(({label,value,icon:Icon,color,bg})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
<span style={{fontSize:12,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
<div style={{width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
<Icon size={16} color={color}/>
</div>
</div>
<div style={{fontSize:24,fontWeight:700,color:'var(--text-1)'}}>{value}</div>
</div>
))}
</div>

{/* Table */}
<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<Users size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search?'No results found':'No customers yet'}</div>
</div>
):(
<table>
<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>Phone</th>
<th>Email</th>
<th>Address</th>
<th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(c=>(
<tr key={c.id}>
<td style={{color:'var(--text-3)',fontFamily:'monospace',fontSize:11}}>{c.customerId||'-'}</td>
<td style={{fontWeight:500}}>{c.name}</td>
<td style={{color:'var(--text-2)'}}>{c.phone||'-'}</td>
<td style={{color:'var(--text-2)'}}>{c.email||'-'}</td>
<td style={{color:'var(--text-2)',fontSize:12}}>{c.address||'-'}</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
  // table row မှာ
<button type="button" onClick={()=>navigate(`/customer/${c.id}`)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Eye size={14}/></button>
<button onClick={()=>openEdit(c)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button onClick={()=>handleDelete(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
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
