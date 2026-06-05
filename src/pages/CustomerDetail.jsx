import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{ArrowLeft,FileText,FileCheck,ScrollText,Phone,Mail,MapPin,User,TrendingUp,Clock,CheckCircle}from'lucide-react'
import{useNavigate,useParams}from'react-router-dom'

export default function CustomerDetail(){
const{id}=useParams()
const navigate=useNavigate()
const[companyId,setCompanyId]=useState(null)
const[customer,setCustomer]=useState(null)
const[invoices,setInvoices]=useState([])
const[quotations,setQuotations]=useState([])
const[contracts,setContracts]=useState([])
const[loading,setLoading]=useState(true)
const[activeTab,setActiveTab]=useState('invoices')

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[custSnap,invSnap,quoSnap,conSnap]=await Promise.all([
getDoc(doc(db,'companies',cid,'customers',id)),
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'quotations')),
getDocs(collection(db,'companies',cid,'contracts')),
])
if(custSnap.exists())setCustomer({id:custSnap.id,...custSnap.data()})
const custData=custSnap.data()
const name=custData?.name||''
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})).filter(i=>i.clientName===name).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setQuotations(quoSnap.docs.map(d=>({id:d.id,...d.data()})).filter(q=>q.clientName===name).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setContracts(conSnap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.clientName===name).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[id])

const statusBadge=(s)=>{
const color={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',partial:'#4F6EF7',draft:'#64748b',active:'#16a34a',expired:'#d97706',cancelled:'#dc2626'}
const bg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',partial:'rgba(79,110,247,0.1)',draft:'#f1f5f9',active:'#eaf3de',expired:'#faeeda',cancelled:'#fcebeb'}
return<span style={{background:bg[s]||'#f1f5f9',color:color[s]||'#64748b',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{s||'-'}</span>
}

const totalRevenue=invoices.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const totalPending=invoices.filter(i=>i.status==='pending'||i.status==='partial').reduce((s,i)=>s+Number(i.remainingAmount||i.totalAmount||0),0)
const totalContracts=contracts.reduce((s,c)=>s+Number(c.value||0),0)

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>
if(!customer)return<div style={{padding:40,textAlign:'center'}}>Customer not found</div>

return(
<Layout title={customer.name}>
<div style={{maxWidth:900,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>navigate('/customers')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<h2 style={{fontSize:18,fontWeight:600,flex:1}}>{customer.name}</h2>
</div>

{/* Customer Info Card */}
<div className="card" style={{padding:24,marginBottom:16}}>
<div style={{display:'flex',alignItems:'flex-start',gap:20}}>
<div style={{width:56,height:56,borderRadius:16,background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
<User size={24} color="var(--primary)"/>
</div>
<div style={{flex:1}}>
<div style={{fontSize:20,fontWeight:700,color:'var(--text-1)',marginBottom:4}}>{customer.name}</div>
{customer.customerId&&<div style={{fontSize:12,color:'var(--text-3)',fontFamily:'monospace',marginBottom:8}}>ID: {customer.customerId}</div>}
<div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
{customer.phone&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)'}}><Phone size={13} color="var(--primary)"/>{customer.phone}</div>}
{customer.email&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)'}}><Mail size={13} color="var(--primary)"/>{customer.email}</div>}
{customer.address&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--text-2)'}}><MapPin size={13} color="var(--primary)"/>{customer.address}</div>}
</div>
</div>
</div>
</div>

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
{[
{label:'Total Invoices',value:invoices.length,icon:FileText,color:'#4F6EF7'},
{label:'Revenue',value:`${totalRevenue.toLocaleString()} Ks`,icon:CheckCircle,color:'#16a34a'},
{label:'Pending',value:`${totalPending.toLocaleString()} Ks`,icon:Clock,color:'#d97706'},
{label:'Contracts Value',value:`${totalContracts.toLocaleString()} Ks`,icon:TrendingUp,color:'#8b5cf6'},
].map(({label,value,icon:Icon,color})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
<Icon size={15} color={color}/>
<span style={{fontSize:11,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
</div>
<div style={{fontSize:16,fontWeight:700,color}}>{value}</div>
</div>
))}
</div>

{/* Tabs */}
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:12,padding:4,marginBottom:16,width:'fit-content'}}>
{[
{id:'invoices',label:'Invoices',icon:FileText,count:invoices.length},
{id:'quotations',label:'Quotations',icon:FileCheck,count:quotations.length},
{id:'contracts',label:'Contracts',icon:ScrollText,count:contracts.length},
].map(({id,label,icon:Icon,count})=>(
<button type="button" key={id} onClick={()=>setActiveTab(id)} className="btn" style={{
padding:'7px 14px',borderRadius:8,fontSize:13,
background:activeTab===id?'var(--primary)':'transparent',
color:activeTab===id?'#fff':'var(--text-2)',
display:'flex',alignItems:'center',gap:6,
}}>
<Icon size={14}/>{label}
<span style={{
background:activeTab===id?'rgba(255,255,255,0.25)':'var(--primary-light)',
color:activeTab===id?'#fff':'var(--primary)',
borderRadius:99,padding:'1px 7px',fontSize:11,fontWeight:600,
}}>{count}</span>
</button>
))}
</div>

{/* Invoices Tab */}
{activeTab==='invoices'&&(
<div className="card" style={{overflow:'hidden'}}>
{invoices.length===0?(
<div style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<FileText size={32} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No invoices yet</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Amount</th><th>Paid</th><th style={{textAlign:'center'}}>Status</th><th>Date</th><th style={{textAlign:'center'}}>Action</th>
</tr>
</thead>
<tbody>
{invoices.map(i=>(
<tr key={i.id} style={{cursor:'pointer'}} onClick={()=>navigate(`/invoice/${i.id}`)}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{i.invoiceNumber}</td>
<td style={{fontWeight:500}}>{Number(i.totalAmount||0).toLocaleString()} Ks</td>
<td style={{color:'#16a34a',fontSize:12}}>{i.paidAmount>0?`${Number(i.paidAmount).toLocaleString()} Ks`:'-'}</td>
<td style={{textAlign:'center'}}>{statusBadge(i.status)}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{i.date||'-'}</td>
<td style={{textAlign:'center'}}><button type="button" onClick={e=>{e.stopPropagation();navigate(`/invoice/${i.id}`)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:12}}>View</button></td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}

{/* Quotations Tab */}
{activeTab==='quotations'&&(
<div className="card" style={{overflow:'hidden'}}>
{quotations.length===0?(
<div style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<FileCheck size={32} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No quotations yet</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Amount</th><th>Date</th><th style={{textAlign:'center'}}>Action</th>
</tr>
</thead>
<tbody>
{quotations.map(q=>(
<tr key={q.id} style={{cursor:'pointer'}} onClick={()=>navigate(`/quotation/${q.id}`)}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{q.quotationNumber}</td>
<td style={{fontWeight:500}}>{Number(q.totalAmount||0).toLocaleString()} Ks</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{q.date||'-'}</td>
<td style={{textAlign:'center'}}><button type="button" onClick={e=>{e.stopPropagation();navigate(`/quotation/${q.id}`)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:12}}>View</button></td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}

{/* Contracts Tab */}
{activeTab==='contracts'&&(
<div className="card" style={{overflow:'hidden'}}>
{contracts.length===0?(
<div style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<ScrollText size={32} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No contracts yet</div>
</div>
):(
<table>
<thead>
<tr>
<th>Number</th><th>Title</th><th>Value</th><th style={{textAlign:'center'}}>Status</th><th>Date</th><th style={{textAlign:'center'}}>Action</th>
</tr>
</thead>
<tbody>
{contracts.map(c=>(
<tr key={c.id}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{c.contractNumber}</td>
<td style={{fontWeight:500}}>{c.title}</td>
<td style={{fontWeight:500}}>{Number(c.value||0).toLocaleString()} Ks</td>
<td style={{textAlign:'center'}}>{statusBadge(c.status)}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{c.startDate||'-'}</td>
<td style={{textAlign:'center'}}><button type="button" onClick={()=>navigate('/contracts')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:12}}>View</button></td>
</tr>
))}
</tbody>
</table>
)}
</div>
)}

</div>
</Layout>
)
}
