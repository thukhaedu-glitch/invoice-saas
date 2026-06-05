import{useState,useEffect,useMemo}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{FileText,CheckCircle,Clock,AlertCircle,TrendingUp,TrendingDown,Wallet,Users,Briefcase,ArrowRight}from'lucide-react'
import{useNavigate}from'react-router-dom'
import{useRole}from'../hooks/useRole'

const months=['01','02','03','04','05','06','07','08','09','10','11','12']
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const BAR_H=100

export default function Dashboard(){
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[expenses,setExpenses]=useState([])
const[customers,setCustomers]=useState([])
const[projects,setProjects]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[loading,setLoading]=useState(true)
const[filterYear,setFilterYear]=useState(new Date().getFullYear().toString())
const navigate=useNavigate()
const{role}=useRole()

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const unsubs=[]
;[
{name:'invoices',setter:setInvoices},
{name:'expenses',setter:setExpenses},
{name:'customers',setter:setCustomers},
{name:'projects',setter:setProjects},
].forEach(({name,setter})=>{
const u=onSnapshot(collection(db,'companies',cid,name),snap=>
setter(snap.docs.map(d=>({id:d.id,...d.data()}))))
unsubs.push(u)
})
const baSnap=await getDocs(collection(db,'companies',cid,'bankAccounts'))
setBankAccounts(baSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.isActive!==false))
setLoading(false)
return()=>unsubs.forEach(u=>u())
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

const getInvDate=inv=>inv.date||(inv.createdAt?.seconds?new Date(inv.createdAt.seconds*1000).toISOString().split('T')[0]:null)

const yearInvoices=useMemo(()=>invoices.filter(i=>getInvDate(i)?.startsWith(filterYear)),[invoices,filterYear])
const yearExpenses=useMemo(()=>expenses.filter(e=>e.date?.startsWith(filterYear)),[expenses,filterYear])

const totalRevenue=yearInvoices.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const totalExpenses=yearExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
const netProfit=totalRevenue-totalExpenses
const totalReceivable=invoices.filter(i=>i.status==='pending'||i.status==='partial').reduce((s,i)=>s+Number(i.remainingAmount||i.totalAmount||0),0)
const totalBankBalance=bankAccounts.reduce((s,a)=>s+Number(a.currentBalance||a.openingBalance||0),0)

const pendingApproval=invoices.filter(i=>i.status==='pending_approval')
const adminApproved=invoices.filter(i=>i.status==='admin_approved')

const chartData=months.map((m,idx)=>{
const mInvs=invoices.filter(i=>getInvDate(i)?.startsWith(`${filterYear}-${m}`))
const revenue=mInvs.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const expense=expenses.filter(e=>e.date?.startsWith(`${filterYear}-${m}`)).reduce((s,e)=>s+Number(e.amount||0),0)
return{month:monthNames[idx],revenue,expense}
})
const chartMax=Math.max(...chartData.map(m=>Math.max(m.revenue,m.expense)),1)

const top5Clients=useMemo(()=>{
const map={}
invoices.filter(i=>i.status==='paid'||i.status==='partial').forEach(i=>{
if(!map[i.clientName])map[i.clientName]=0
map[i.clientName]+=Number(i.paidAmount||i.totalAmount||0)
})
return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,amount])=>({name,amount}))
},[invoices])

const recentPayments=useMemo(()=>{
const payments=[]
invoices.forEach(inv=>{
(inv.payments||[]).forEach(p=>{
payments.push({...p,invoiceNumber:inv.invoiceNumber,clientName:inv.clientName})
})
})
return payments.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5)
},[invoices])

const uniqueYears=[...new Set(invoices.map(i=>getInvDate(i)?.slice(0,4)).filter(Boolean))].sort().reverse()
if(!uniqueYears.includes(new Date().getFullYear().toString()))uniqueYears.unshift(new Date().getFullYear().toString())

const projectStats=useMemo(()=>{
const s={planning:0,active:0,'on-hold':0,completed:0,cancelled:0}
projects.forEach(p=>s[p.status]=(s[p.status]||0)+1)
return s
},[projects])

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Dashboard">

{/* Approval banners */}
{role==='admin'&&pendingApproval.length>0&&(
<div style={{background:'rgba(22,163,74,0.08)',border:'0.5px solid rgba(22,163,74,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<AlertCircle size={16} color="#16a34a"/>
<span style={{fontSize:13,fontWeight:500,color:'#16a34a'}}>{pendingApproval.length} invoice{pendingApproval.length>1?'s':''} waiting for your approval</span>
</div>
<button type="button" onClick={()=>navigate('/invoices')} className="btn btn-primary" style={{fontSize:12,padding:'5px 12px',background:'#16a34a',boxShadow:'none'}}>Review Now</button>
</div>
)}
{role==='owner'&&adminApproved.length>0&&(
<div style={{background:'rgba(79,110,247,0.08)',border:'0.5px solid rgba(79,110,247,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<AlertCircle size={16} color="var(--primary)"/>
<span style={{fontSize:13,fontWeight:500,color:'var(--primary)'}}>{adminApproved.length} invoice{adminApproved.length>1?'s':''} waiting for final approval</span>
</div>
<button type="button" onClick={()=>navigate('/invoices')} className="btn btn-primary" style={{fontSize:12,padding:'5px 12px'}}>Review Now</button>
</div>
)}

{/* Year filter */}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
<h3 style={{fontSize:15,fontWeight:600,color:'var(--text-1)'}}>Overview — {filterYear}</h3>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'5px 8px'}} value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
{uniqueYears.map(y=><option key={y} value={y}>{y}</option>)}
</select>
</div>

{/* KPI Cards */}
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
{[
{label:'Total Revenue',value:totalRevenue,icon:TrendingUp,color:'#4F6EF7',bg:'rgba(79,110,247,0.10)',suffix:' Ks'},
{label:'Total Expenses',value:totalExpenses,icon:TrendingDown,color:'#dc2626',bg:'rgba(220,38,38,0.10)',suffix:' Ks'},
{label:'Net Profit',value:netProfit,icon:CheckCircle,color:netProfit>=0?'#16a34a':'#dc2626',bg:netProfit>=0?'rgba(22,163,74,0.10)':'rgba(220,38,38,0.10)',suffix:' Ks'},
{label:'Receivable',value:totalReceivable,icon:Clock,color:'#d97706',bg:'rgba(217,119,6,0.10)',suffix:' Ks'},
].map(({label,value,icon:Icon,color,bg,suffix})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
<span style={{fontSize:12,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
<div style={{width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
<Icon size={16} color={color}/>
</div>
</div>
<div style={{fontSize:20,fontWeight:700,color,marginBottom:2}}>{value.toLocaleString()}{suffix}</div>
</div>
))}
</div>

{/* Bank Balances */}
{bankAccounts.length>0&&(
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:16}}>
{bankAccounts.map(a=>(
<div key={a.id} className="card" style={{padding:16,cursor:'pointer'}} onClick={()=>navigate('/bank-accounts')}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>{a.bankName||a.type}</div>
<div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{a.name}</div>
<div style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{Number(a.currentBalance||a.openingBalance||0).toLocaleString()} <span style={{fontSize:11,color:'var(--text-3)'}}>{a.currency||'MMK'}</span></div>
</div>
))}
<div className="card" style={{padding:16,background:'linear-gradient(135deg,#1a1d2e,#2d3260)',color:'white'}}>
<div style={{fontSize:11,opacity:0.7,marginBottom:4}}>Total Balance</div>
<div style={{fontSize:18,fontWeight:700}}>{totalBankBalance.toLocaleString()} MMK</div>
</div>
</div>
)}

{/* Chart */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:14,marginBottom:16,color:'var(--text-1)'}}>Revenue vs Expenses — {filterYear}</div>
<div style={{display:'flex',alignItems:'flex-end',gap:6,height:BAR_H+24,overflowX:'auto',paddingBottom:4}}>
{chartData.map((m,i)=>(
<div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:40,flex:1}}>
<div style={{display:'flex',alignItems:'flex-end',gap:2,height:BAR_H}}>
<div title={`Revenue: ${m.revenue.toLocaleString()} Ks`} style={{width:14,borderRadius:'3px 3px 0 0',background:'#4F6EF7',height:`${Math.round(m.revenue/chartMax*BAR_H)}px`,minHeight:m.revenue>0?3:0,transition:'height 0.3s'}}/>
<div title={`Expense: ${m.expense.toLocaleString()} Ks`} style={{width:14,borderRadius:'3px 3px 0 0',background:'#ef4444',height:`${Math.round(m.expense/chartMax*BAR_H)}px`,minHeight:m.expense>0?3:0,transition:'height 0.3s'}}/>
</div>
<div style={{fontSize:9,color:'var(--text-3)',textAlign:'center'}}>{m.month}</div>
</div>
))}
</div>
<div style={{display:'flex',gap:16,marginTop:8,justifyContent:'center'}}>
<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text-2)'}}>
<div style={{width:10,height:10,borderRadius:2,background:'#4F6EF7'}}/>Revenue
</div>
<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text-2)'}}>
<div style={{width:10,height:10,borderRadius:2,background:'#ef4444'}}/>Expenses
</div>
</div>
</div>

{/* Top Clients + Recent Payments */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
<div className="card" style={{padding:20}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-1)',display:'flex',alignItems:'center',gap:8}}>
<Users size={15} color="var(--primary)"/>Top 5 Clients
</div>
<button type="button" onClick={()=>navigate('/customers')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:11,display:'flex',alignItems:'center',gap:4}}>
View all<ArrowRight size={11}/>
</button>
</div>
{top5Clients.length===0?<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:20}}>No data yet</div>
:top5Clients.map((c,i)=>{
const maxAmt=top5Clients[0]?.amount||1
return(
<div key={c.name} style={{marginBottom:12}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
<div style={{display:'flex',alignItems:'center',gap:6}}>
<span style={{width:18,height:18,borderRadius:'50%',background:'var(--primary-light)',color:'var(--primary)',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{i+1}</span>
<span style={{fontWeight:500}}>{c.name}</span>
</div>
<span style={{fontWeight:600,color:'#16a34a',fontSize:12}}>{c.amount.toLocaleString()} Ks</span>
</div>
<div style={{height:4,background:'#f1f5f9',borderRadius:2}}>
<div style={{height:4,borderRadius:2,background:'var(--primary)',width:`${Math.round(c.amount/maxAmt*100)}%`,transition:'width 0.3s'}}/>
</div>
</div>
)
})}
</div>

<div className="card" style={{padding:20}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-1)',display:'flex',alignItems:'center',gap:8}}>
<CheckCircle size={15} color="#16a34a"/>Recent Payments
</div>
<button type="button" onClick={()=>navigate('/invoices')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:11,display:'flex',alignItems:'center',gap:4}}>
View all<ArrowRight size={11}/>
</button>
</div>
{recentPayments.length===0?<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:20}}>No payments yet</div>
:recentPayments.map((p,i)=>(
<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<div>
<div style={{fontSize:13,fontWeight:500,color:'var(--text-1)'}}>{p.clientName}</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:1}}>{p.invoiceNumber} · {p.date}</div>
</div>
<span style={{fontWeight:600,color:'#16a34a',fontSize:13}}>{Number(p.amount).toLocaleString()} Ks</span>
</div>
))}
</div>
</div>

{/* Quick Links */}
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
{[
{label:'Invoices',count:invoices.length,icon:FileText,color:'#4F6EF7',path:'/invoices'},
{label:'Customers',count:customers.length,icon:Users,color:'#16a34a',path:'/customers'},
{label:'Expenses',count:expenses.length,icon:Wallet,color:'#dc2626',path:'/expenses'},
{label:'Projects',count:projects.length,icon:Briefcase,color:'#8b5cf6',path:'/projects'},
].map(({label,count,icon:Icon,color,path})=>(
<div key={label} className="card" style={{padding:16,cursor:'pointer',display:'flex',alignItems:'center',gap:12}} onClick={()=>navigate(path)}>
<div style={{width:40,height:40,borderRadius:10,background:`${color}15`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
<Icon size={20} color={color}/>
</div>
<div>
<div style={{fontSize:20,fontWeight:700,color:'var(--text-1)'}}>{count}</div>
<div style={{fontSize:12,color:'var(--text-2)'}}>{label}</div>
</div>
</div>
))}
</div>

</Layout>
)
}
