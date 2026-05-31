import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where}from'firebase/firestore'
import Layout from'../components/Layout'
import{FileText,FileCheck,Users,Plus}from'lucide-react'

export default function Dashboard(){
const[activeTab,setActiveTab]=useState('invoice')
const[companyId,setCompanyId]=useState(null)
const[companyName,setCompanyName]=useState('')
const[invoices,setInvoices]=useState([])
const[quotations,setQuotations]=useState([])
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){setCompanyId(snap.docs[0].id);setCompanyName(snap.docs[0].data().name||'')}
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

const statusBadge=s=>{
const map={paid:'badge-success',partial:'badge-info',refunded:'badge-danger',pending:'badge-warning'}
return<span className={`badge ${map[s]||'badge-warning'}`}>{s||'pending'}</span>
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

const tabTitles={invoice:'Invoices',quotation:'Quotations',customer:'Customers'}

return(
<Layout title={tabTitles[activeTab]}>
<div style={{marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
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
<button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}}>
<Plus size={15}/>New
</button>
</div>

<div className="card" style={{overflow:'hidden'}}>
{activeData.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<FileText size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No {activeTab}s found</div>
</div>
):(
<table>
<thead>
<tr>
{activeTab==='customer'?<>
<th>ID</th><th>Name</th><th>Phone</th><th>Email</th>
</>:<>
<th>Number</th><th>Client</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'center'}}>Status</th><th>Date</th>
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
</tr>
))}
</tbody>
</table>
)}
</div>
</Layout>
)
}
