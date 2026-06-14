import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,orderBy}from'firebase/firestore'
import Layout from'../components/Layout'
import{useNavigate}from'react-router-dom'
import{Crown,Calendar,CheckCircle,Clock,XCircle,Download,CreditCard,FileText,Users,UserPlus}from'lucide-react'
import{usePlans,formatMMK}from'../hooks/usePlans'

const fmtDate=(d)=>{if(!d)return'-';try{return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}catch{return d}}
const fmtTS=(ts)=>{if(!ts)return'-';try{const d=ts.seconds?new Date(ts.seconds*1000):new Date(ts);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}catch{return'-'}}

export default function Billing(){
const navigate=useNavigate()
const{getLimit,planLabel,planPrice,loading:plansLoading}=usePlans()
const[company,setCompany]=useState(null)
const[history,setHistory]=useState([])
const[counts,setCounts]=useState({docs:0,customers:0,members:0})
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const cdata={id:cid,...snap.docs[0].data()}
setCompany(cdata)
// payment history
try{
const hSnap=await getDocs(query(collection(db,'upgradeRequests'),where('companyId','==',cid),orderBy('createdAt','desc')))
setHistory(hSnap.docs.map(d=>({id:d.id,...d.data()})))
}catch(e){
const hSnap=await getDocs(query(collection(db,'upgradeRequests'),where('companyId','==',cid)))
setHistory(hSnap.docs.map(d=>({id:d.id,...d.data()})))
}
// usage counts
const ym=new Date().toISOString().slice(0,7)
const[custSnap,invSnap,quoSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'customers')),
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'quotations')),
])
const cm=(docs)=>docs.filter(d=>{const dt=d.data();let m='';if(dt.createdAt?.seconds)m=new Date(dt.createdAt.seconds*1000).toISOString().slice(0,7);else if(dt.date)m=String(dt.date).slice(0,7);return m===ym}).length
setCounts({docs:cm(invSnap.docs)+cm(quoSnap.docs),customers:custSnap.size,members:Object.keys(cdata.members||{}).length})
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

const downloadReceipt=(req)=>{
const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${req.id}</title>
<style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#1e293b}
.head{border-bottom:2px solid #4f6ef7;padding-bottom:16px;margin-bottom:24px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #e2e8f0}
.total{font-size:20px;font-weight:700;color:#4f6ef7;margin-top:16px}
.badge{display:inline-block;background:#eaf3de;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}</style></head>
<body>
<div class="head"><h1 style="margin:0;color:#4f6ef7">Payment Receipt</h1><div style="color:#94a3b8;font-size:13px;margin-top:4px">Ankorax Invoice</div></div>
<div class="row"><span>Receipt ID</span><strong>${req.id}</strong></div>
<div class="row"><span>Date</span><strong>${fmtTS(req.approvedAt||req.createdAt)}</strong></div>
<div class="row"><span>Plan</span><strong style="text-transform:capitalize">${req.requestedPlan}</strong></div>
<div class="row"><span>Billing Email</span><strong>${req.requestedByEmail||'-'}</strong></div>
${req.couponCode?`<div class="row"><span>Coupon</span><strong>${req.couponCode}</strong></div>`:''}
<div class="row"><span>Status</span><span class="badge">Paid</span></div>
<div class="row total"><span>Total Paid</span><span>${formatMMK(req.amount)}</span></div>
<p style="color:#94a3b8;font-size:12px;margin-top:32px;text-align:center">Thank you for your business — Ankorax</p>
</body></html>`
const blob=new Blob([html],{type:'text/html'})
const url=URL.createObjectURL(blob)
const a=document.createElement('a')
a.href=url;a.download=`receipt-${req.id.slice(0,8)}.html`;a.click()
URL.revokeObjectURL(url)
}

if(loading||plansLoading)return<Layout title="Billing"><div style={{padding:40,textAlign:'center'}}>Loading...</div></Layout>
if(!company)return<Layout title="Billing"><div style={{padding:40,textAlign:'center'}}>No company found</div></Layout>

const plan=company.plan||'free'
const isPaid=plan!=='free'
const statusIcon=(s)=>s==='approved'?<CheckCircle size={14} color="#16a34a"/>:s==='pending'?<Clock size={14} color="#d97706"/>:s==='refunded'?<XCircle size={14} color="#dc2626"/>:<XCircle size={14} color="#dc2626"/>
const statusText=(s)=>({approved:'Paid',pending:'Pending',rejected:'Rejected',refunded:'Refunded'}[s]||s)

const usageItems=[
{label:'Documents',icon:FileText,count:counts.docs,limit:getLimit(plan,'documents')},
{label:'Customers',icon:Users,count:counts.customers,limit:getLimit(plan,'customers')},
{label:'Members',icon:UserPlus,count:counts.members,limit:getLimit(plan,'members')},
]

return(
<Layout title="Billing">
<div style={{maxWidth:820,margin:'0 auto'}}>

{/* Current plan card */}
<div style={{background:'linear-gradient(135deg,#4f6ef7,#8b5cf6)',borderRadius:16,padding:24,color:'white',marginBottom:20}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
<div style={{fontSize:13,opacity:0.85,marginBottom:4}}>Current Plan</div>
<div style={{fontSize:26,fontWeight:700,display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Crown size={24}/>{planLabel(plan)}</div>
{isPaid&&<div style={{fontSize:14,opacity:0.9}}>{formatMMK(planPrice(plan))} / month</div>}
</div>
<button onClick={()=>navigate('/upgrade')} style={{background:'white',color:'#4f6ef7',border:'none',borderRadius:10,padding:'10px 20px',fontWeight:600,fontSize:13,cursor:'pointer'}}>{isPaid?'Change Plan':'Upgrade'}</button>
</div>
{isPaid&&company.subscriptionEnd&&(
<div style={{marginTop:16,paddingTop:16,borderTop:'0.5px solid rgba(255,255,255,0.2)',display:'flex',gap:24,fontSize:13}}>
<div><span style={{opacity:0.8}}>Started: </span>{fmtDate(company.subscriptionStart)}</div>
<div><span style={{opacity:0.8}}>Renews/Ends: </span><strong>{fmtDate(company.subscriptionEnd)}</strong></div>
</div>
)}
</div>

{/* Usage summary */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
{usageItems.map(({label,icon:Icon,count,limit})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,color:'var(--text-3)'}}><Icon size={15}/><span style={{fontSize:12}}>{label}</span></div>
<div style={{fontSize:18,fontWeight:700}}>{count}{limit===-1?'':<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/{limit}</span>}</div>
</div>
))}
</div>

{/* Payment history */}
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid #f1f5f9',fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><CreditCard size={16} color="var(--primary)"/>Payment History</div>
{history.length===0?(
<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>
<CreditCard size={32} style={{margin:'0 auto 10px',opacity:0.2}}/>
<div>No payment history yet</div>
</div>
):(
<div style={{overflowX:'auto'}}>
<table style={{width:'100%'}}>
<thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'center'}}>Receipt</th></tr></thead>
<tbody>
{history.map(req=>(
<tr key={req.id}>
<td style={{fontSize:12,color:'var(--text-3)'}}>{fmtTS(req.approvedAt||req.createdAt)}</td>
<td><span style={{fontSize:13,fontWeight:600,textTransform:'capitalize',color:'var(--primary)'}}>{req.requestedPlan}</span>{req.couponCode&&<span style={{fontSize:10,color:'#16a34a',marginLeft:6}}>🎟{req.couponCode}</span>}</td>
<td style={{fontSize:13,fontWeight:600}}>{formatMMK(req.amount)}</td>
<td style={{textAlign:'center'}}><span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:12}}>{statusIcon(req.status)}{statusText(req.status)}</span></td>
<td style={{textAlign:'center'}}>
{req.status==='approved'?(
<button onClick={()=>downloadReceipt(req)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',display:'inline-flex',alignItems:'center',gap:4,fontSize:12}}><Download size={13}/>Receipt</button>
):<span style={{fontSize:12,color:'var(--text-3)'}}>-</span>}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>

</div>
</Layout>
)
}
