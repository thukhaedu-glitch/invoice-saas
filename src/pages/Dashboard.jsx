import{useState,useEffect}from'react'
import{auth,db}from'../firebase'
import{signOut}from'firebase/auth'
import{collection,onSnapshot,query,where,getDocs}from'firebase/firestore'

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
const u=onSnapshot(collection(db,'companies',companyId,name),snap=>setter(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))))
unsubs.push(u)
})
return()=>unsubs.forEach(u=>u())
},[companyId])

const data={invoice:invoices,quotation:quotations,customer:customers}
const tabs=[{id:'invoice',label:'Invoices',count:invoices.length},{id:'quotation',label:'Quotations',count:quotations.length},{id:'customer',label:'Customers',count:customers.length}]
const statusColor=s=>({paid:'#16a34a',partial:'#2563eb',refunded:'#dc2626',pending:'#d97706'}[s]||'#d97706')

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<div style={{minHeight:'100vh',background:'#f8fafc'}}>
<div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'12px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:10}}>
<div>
<div style={{fontWeight:700,fontSize:15}}>{companyName}</div>
<div style={{fontSize:12,color:'#94a3b8'}}>{auth.currentUser?.email}</div>
</div>
<button onClick={()=>signOut(auth)} style={{color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontSize:14,fontWeight:500}}>Logout</button>
</div>

<div style={{maxWidth:1100,margin:'0 auto',padding:24}}>
<div style={{display:'flex',gap:4,marginBottom:24,background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:4,width:'fit-content'}}>
{tabs.map(t=>(
<button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:500,background:activeTab===t.id?'#2563eb':'transparent',color:activeTab===t.id?'white':'#64748b',display:'flex',alignItems:'center',gap:6}}>
{t.label}
<span style={{background:activeTab===t.id?'#1d4ed8':'#f1f5f9',color:activeTab===t.id?'white':'#64748b',borderRadius:99,padding:'1px 7px',fontSize:11}}>{t.count}</span>
</button>
))}
</div>

<div style={{background:'white',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
{data[activeTab].length===0?(
<div style={{padding:64,textAlign:'center',color:'#94a3b8'}}>
<div style={{fontSize:32,marginBottom:8}}>📭</div>
<div>No {activeTab}s found</div>
</div>
):(
<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
<thead>
<tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
{activeTab==='customer'?<>
<th style={{padding:'10px 16px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>ID</th>
<th style={{padding:'10px 16px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Name</th>
<th style={{padding:'10px 16px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Phone</th>
<th style={{padding:'10px 16px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Email</th>
</>:<>
<th style={{padding:'10px 16px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Number</th>
<th style={{padding:'10px 16px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Client</th>
<th style={{padding:'10px 16px',textAlign:'right',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Amount</th>
<th style={{padding:'10px 16px',textAlign:'center',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Status</th>
<th style={{padding:'10px 16px',textAlign:'left',color:'#64748b',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Date</th>
</>}
</tr>
</thead>
<tbody>
{data[activeTab].map(item=>(
<tr key={item.id} style={{borderBottom:'1px solid #f1f5f9'}}>
{activeTab==='customer'?<>
<td style={{padding:'12px 16px',color:'#94a3b8',fontFamily:'monospace',fontSize:11}}>{item.customerId||'-'}</td>
<td style={{padding:'12px 16px',fontWeight:500}}>{item.name}</td>
<td style={{padding:'12px 16px',color:'#64748b'}}>{item.phone||'-'}</td>
<td style={{padding:'12px 16px',color:'#64748b'}}>{item.email||'-'}</td>
</>:<>
<td style={{padding:'12px 16px',color:'#2563eb',fontFamily:'monospace',fontWeight:500,fontSize:12}}>{item.invoiceNumber||item.quotationNumber}</td>
<td style={{padding:'12px 16px',fontWeight:500}}>{item.clientName}</td>
<td style={{padding:'12px 16px',textAlign:'right',fontWeight:500}}>{Number(item.totalAmount||0).toLocaleString()} Ks</td>
<td style={{padding:'12px 16px',textAlign:'center'}}><span style={{background:statusColor(item.status)+'20',color:statusColor(item.status),padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600}}>{item.status||'pending'}</span></td>
<td style={{padding:'12px 16px',color:'#94a3b8',fontSize:12}}>{item.createdAt?.seconds?new Date(item.createdAt.seconds*1000).toLocaleDateString():'-'}</td>
</>}
</tr>
))}
</tbody>
</table>
)}
</div>
</div>
</div>
)
}