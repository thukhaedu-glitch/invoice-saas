import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,updateDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{FileText,FileCheck,Users,Plus,TrendingUp,CheckCircle,Clock,AlertCircle,Copy,Edit,Trash2,RefreshCcw,Link,Printer,CheckSquare}from'lucide-react'
import{useNavigate}from'react-router-dom'

export default function Dashboard(){
const[activeTab,setActiveTab]=useState('invoice')
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[quotations,setQuotations]=useState([])
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)
const[menuOpen,setMenuOpen]=useState(null)
const navigate=useNavigate()

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty)setCompanyId(snap.docs[0].id)
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

useEffect(()=>{
if(!companyId)return
const unsubs=[]
;[{name:'invoices',setter:setInvoices},{name:'quotations',setter:setQuotations},{name:'customers',setter:setCustomers}]
.forEach(({name,setter})=>{
const u=onSnapshot(collection(db,'companies',companyId,name),snap=>
setter(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))))
unsubs.push(u)
})
return()=>unsubs.forEach(u=>u())
},[companyId])

const tabs=[
{id:'invoice',label:'Invoices',icon:FileText,data:invoices},
{id:'quotation',label:'Quotations',icon:FileCheck,data:quotations},
{id:'customer',label:'Customers',icon:Users,data:customers},
]
const activeData=tabs.find(t=>t.id===activeTab)?.data||[]

const paid=invoices.filter(i=>i.status==='paid')
const pending=invoices.filter(i=>i.status==='pending')
const overdue=invoices.filter(i=>i.status==='overdue')
const totalAmt=invoices.reduce((s,i)=>s+Number(i.totalAmount||0),0)
const paidAmt=paid.reduce((s,i)=>s+Number(i.totalAmount||0),0)
const pendingAmt=pending.reduce((s,i)=>s+Number(i.totalAmount||0),0)

const statsCards=[
{label:'Total Invoices',value:invoices.length,amount:totalAmt,icon:TrendingUp,color:'#4F6EF7',bg:'rgba(79,110,247,0.10)'},
{label:'Paid',value:paid.length,amount:paidAmt,icon:CheckCircle,color:'#16a34a',bg:'rgba(22,163,74,0.10)'},
{label:'Pending',value:pending.length,amount:pendingAmt,icon:Clock,color:'#d97706',bg:'rgba(217,119,6,0.10)'},
{label:'Overdue',value:overdue.length,amount:overdue.reduce((s,i)=>s+Number(i.totalAmount||0),0),icon:AlertCircle,color:'#dc2626',bg:'rgba(220,38,38,0.10)'},
]

const statusBadge=s=>{
const map={paid:'badge-success',partial:'badge-info',refunded:'badge-danger',pending:'badge-warning',overdue:'badge-danger'}
return<span className={`badge ${map[s]||'badge-warning'}`}>{s||'pending'}</span>
}

const collName=activeTab==='invoice'?'invoices':activeTab==='quotation'?'quotations':'customers'

const handleDelete=async(id)=>{
if(!confirm('Delete this item?'))return
await deleteDoc(doc(db,'companies',companyId,collName,id))
}

const handleStatus=async(id,status)=>{
await updateDoc(doc(db,'companies',companyId,collName,id),{status})
setMenuOpen(null)
}

const handleCopy=(item)=>{
navigator.clipboard.writeText(item.invoiceNumber||item.quotationNumber||item.name||'')
setMenuOpen(null)
}

const handleShareLink=(item)=>{
const url=`${window.location.origin}/verify/${item.id}`
navigator.clipboard.writeText(url)
alert('Link copied!')
setMenuOpen(null)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Dashboard">
{menuOpen&&<div onClick={()=>setMenuOpen(null)} style={{position:'fixed',inset:0,zIndex:49}}/>}

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
{statsCards.map(({label,value,amount,icon:Icon,color,bg})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
<span style={{fontSize:12,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
<div style={{width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
<Icon size={16} color={color}/>
</div>
</div>
<div style={{fontSize:24,fontWeight:700,color:'var(--text-1)',marginBottom:2}}>{value}</div>
<div style={{fontSize:12,color:'var(--text-3)'}}>{amount.toLocaleString()} Ks</div>
</div>
))}
</div>

{/* Tabs */}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:12,padding:4}}>
{tabs.map(({id,label,icon:Icon,data})=>(
<button key={id} onClick={()=>setActiveTab(id)} className="btn" style={{
padding:'7px 14px',borderRadius:8,fontSize:13,
background:activeTab===id?'var(--primary)':'transparent',
color:activeTab===id?'#fff':'var(--text-2)',
display:'flex',alignItems:'center',gap:6
}}>
<Icon size={14}/>{label}
<span style={{
background:activeTab===id?'rgba(255,255,255,0.25)':'var(--primary-light)',
color:activeTab===id?'#fff':'var(--primary)',
borderRadius:99,padding:'1px 7px',fontSize:11,fontWeight:600
}}>{data.length}</span>
</button>
))}
</div>
<button className="btn btn-primary" onClick={()=>navigate('/create-invoice')}>
<Plus size={15}/>New
</button>
</div>

{/* Table */}
<div className="card" style={{overflow:'visible'}}>
{activeData.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<FileText size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No {activeTab}s found</div>
</div>
):(
<div style={{overflowX:'auto'}}>
<table style={{width:'100%'}}>
<thead>
<tr>
{activeTab==='customer'?<>
<th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th style={{textAlign:'center'}}>Actions</th>
</>:<>
<th>Number</th><th>Client</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'center'}}>Status</th><th>Date</th><th style={{textAlign:'center'}}>Actions</th>
</>}
</tr>
</thead>
<tbody>
{activeData.map(item=>(
<tr key={item.id}>
{activeTab==='customer'?<>
<td style={{color:'var(--text-3)',fontFamily:'monospace',fontSize:11}}>{item.customerId||'-'}</td>
<td style={{fontWeight:500}}>{item.name}</td>
<td style={{color:'var(--text-2)'}}>{item.phone||'-'}</td>
<td style={{color:'var(--text-2)'}}>{item.email||'-'}</td>
</>:<>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontWeight:500,fontSize:12}}>{item.invoiceNumber||item.quotationNumber}</td>
<td style={{fontWeight:500}}>{item.clientName}</td>
<td style={{textAlign:'right',fontWeight:500}}>{Number(item.totalAmount||0).toLocaleString()} Ks</td>
<td style={{textAlign:'center'}}>{statusBadge(item.status)}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{item.createdAt?.seconds?new Date(item.createdAt.seconds*1000).toLocaleDateString():'-'}</td>
</>}
<td style={{textAlign:'center',position:'relative'}}>
<div style={{display:'flex',gap:4,justifyContent:'center',alignItems:'center'}}>
<button onClick={()=>navigate(`/invoice/${item.id}`)} title="View" style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Printer size={14}/></button>
<button onClick={()=>handleCopy(item)} title="Copy number" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Copy size={14}/></button>
<button onClick={()=>navigate(`/edit/${item.id}`)} title="Edit" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
{activeTab!=='customer'&&<>
<button onClick={()=>handleShareLink(item)} title="Share link" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Link size={14}/></button>
<button onClick={()=>handleStatus(item.id,'paid')} title="Mark paid" style={{background:'none',border:'none',cursor:'pointer',color:'#16a34a',padding:4,borderRadius:6}}><CheckSquare size={14}/></button>
<button onClick={()=>handleStatus(item.id,'refunded')} title="Refund" style={{background:'none',border:'none',cursor:'pointer',color:'#d97706',padding:4,borderRadius:6}}><RefreshCcw size={14}/></button>
</>}
<button onClick={()=>handleDelete(item.id)} title="Delete" style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
</Layout>
)
}
