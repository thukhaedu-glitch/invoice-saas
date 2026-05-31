import{useState,useEffect,useMemo}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,updateDoc,addDoc,serverTimestamp,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{FileText,FileCheck,Users,Plus,TrendingUp,CheckCircle,Clock,AlertCircle,Edit,Trash2,RefreshCcw,Link,Printer,CheckSquare,CopyPlus,DollarSign,X,Search,Briefcase,Wallet,Mail}from'lucide-react'
import{useNavigate,useSearchParams}from'react-router-dom'
import{sendInvoiceReminder}from'../utils/emailService'
import{useRole}from'../hooks/useRole'
import ConfirmPassword from'../components/ConfirmPassword'

const BAR_H=100
const months=['01','02','03','04','05','06','07','08','09','10','11','12']
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Dashboard(){
const[searchParams]=useSearchParams()
const[activeTab,setActiveTab]=useState(searchParams.get('tab')||'invoice')
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[quotations,setQuotations]=useState([])
const[customers,setCustomers]=useState([])
const[expenses,setExpenses]=useState([])
const[projects,setProjects]=useState([])
const[loading,setLoading]=useState(true)
const[paymentModal,setPaymentModal]=useState(null)
const[paymentForm,setPaymentForm]=useState({amount:'',date:new Date().toISOString().split('T')[0],method:'',note:''})
const[savingPayment,setSavingPayment]=useState(false)
const[paymentMethodOptions,setPaymentMethodOptions]=useState(['Cash','KBZ Pay','AYA Pay','Wave Pay','CB Pay','Bank Transfer','Other'])
const[filterMonth,setFilterMonth]=useState('')
const[filterYear,setFilterYear]=useState('')
const[filterCustomer,setFilterCustomer]=useState('')
const[filterStatus,setFilterStatus]=useState('')
const[search,setSearch]=useState('')
const[showChart,setShowChart]=useState(true)
const[companyInfo,setCompanyInfo]=useState({})
const[sendingReminder,setSendingReminder]=useState(null)
const[confirmAction,setConfirmAction]=useState(null)
const navigate=useNavigate()
const{role,canEdit,canDelete}=useRole()

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
const loadSettings=async()=>{
try{
const sSnap=await getDoc(doc(db,'companies',companyId,'_config','invoiceSettings'))
if(sSnap.exists()){
const sd=sSnap.data()
if(sd.paymentMethods?.length){
const methods=sd.paymentMethods.map(m=>m.bankName||m).filter(Boolean)
if(methods.length){
setPaymentMethodOptions(methods)
setPaymentForm(f=>({...f,method:methods[0]}))
}
}
setCompanyInfo({
name:sd.companyName||'',
email:sd.companyEmail||'',
phone:sd.companyPhone||'',
paymentMethods:sd.paymentMethods?.map(m=>`${m.bankName}: ${m.accountNo} (${m.accountName})`).join('\n')||''
})
}
}catch(e){console.error(e)}
}
loadSettings()
const unsubs=[]
;[
{name:'invoices',setter:setInvoices},
{name:'quotations',setter:setQuotations},
{name:'customers',setter:setCustomers},
{name:'expenses',setter:setExpenses},
{name:'projects',setter:setProjects},
].forEach(({name,setter})=>{
const u=onSnapshot(collection(db,'companies',companyId,name),snap=>
setter(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))))
unsubs.push(u)
})
return()=>unsubs.forEach(u=>u())
},[companyId])

const getInvDate=inv=>inv.date||(inv.createdAt?.seconds?new Date(inv.createdAt.seconds*1000).toISOString().split('T')[0]:null)

const filteredInvoices=useMemo(()=>invoices.filter(inv=>{
const d=getInvDate(inv)||''
if(filterYear&&!d.startsWith(filterYear))return false
if(filterMonth&&filterYear&&!d.startsWith(`${filterYear}-${filterMonth}`))return false
if(filterCustomer&&inv.clientName!==filterCustomer)return false
if(filterStatus&&inv.status!==filterStatus)return false
if(search&&!inv.clientName?.toLowerCase().includes(search.toLowerCase())&&!inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()))return false
return true
}),[invoices,filterYear,filterMonth,filterCustomer,filterStatus,search])

const currentYear=new Date().getFullYear().toString()
const chartYear=filterYear||currentYear
const chartData=months.map((m,idx)=>{
const mInvs=invoices.filter(i=>getInvDate(i)?.startsWith(`${chartYear}-${m}`))
const revenue=mInvs.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const pending=mInvs.filter(i=>i.status==='pending').reduce((s,i)=>s+Number(i.totalAmount||0),0)
return{month:monthNames[idx],revenue,pending}
})
const chartMax=Math.max(...chartData.map(m=>Math.max(m.revenue,m.pending)),1)

const uniqueYears=[...new Set(invoices.map(i=>getInvDate(i)?.slice(0,4)).filter(Boolean))].sort().reverse()
const uniqueCustomers=[...new Set(invoices.map(i=>i.clientName).filter(Boolean))].sort()

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

const upcomingDue=useMemo(()=>{
const now=new Date()
return invoices.filter(i=>(i.status==='pending'||i.status==='partial')&&i.createdAt?.seconds).map(i=>{
const days=Math.floor((now-new Date(i.createdAt.seconds*1000))/(1000*60*60*24))
return{...i,daysOld:days}
}).sort((a,b)=>b.daysOld-a.daysOld).slice(0,5)
},[invoices])

const expenseByCategory=useMemo(()=>{
const map={}
expenses.forEach(e=>{
if(!map[e.category])map[e.category]=0
map[e.category]+=Number(e.amount||0)
})
const total=Object.values(map).reduce((s,v)=>s+v,0)
return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,amount])=>({cat,amount,pct:total>0?Math.round(amount/total*100):0}))
},[expenses])

const projectStats=useMemo(()=>{
const statusCount={planning:0,active:0,'on-hold':0,completed:0,cancelled:0}
projects.forEach(p=>statusCount[p.status]=(statusCount[p.status]||0)+1)
return statusCount
},[projects])

const tabs=[
{id:'invoice',label:'Invoices',icon:FileText,data:filteredInvoices},
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
await deleteDoc(doc(db,'companies',companyId,collName,id))
}

const handleDeleteWithAuth=(id)=>{
if(loading){return} // loading ဆဲဆဲ မလုပ်ရ
if(!canDelete){
alert('You do not have permission to delete this item.')
return
}
setConfirmAction({action:()=>handleDelete(id),label:'delete this item'})
}

const handleEditNav=(item)=>{
if(!canEdit){alert('You do not have permission to edit');return}
setConfirmAction({
action:()=>navigate(activeTab==='quotation'?`/edit-quotation/${item.id}`:`/edit/${item.id}`),
label:'edit this item'
})
}

const handleStatus=async(id,status)=>{
await updateDoc(doc(db,'companies',companyId,collName,id),{status})
}

const handleShareLink=(item)=>{
const url=`${window.location.origin}/verify/${companyId}/${item.securityCode||item.id}`
navigator.clipboard.writeText(url)
alert('Link copied!')
}

const handleDuplicate=async(item)=>{
if(!confirm('Duplicate this?'))return
try{
const{id:_,...data}=item
await addDoc(collection(db,'companies',companyId,collName),{
...data,
invoiceNumber:(item.invoiceNumber||item.quotationNumber||'INV')+'-COPY',
quotationNumber:(item.quotationNumber||'QUO')+'-COPY',
status:'pending',
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
alert('Duplicated!')
}catch(e){alert(e.message)}
}

const handleConvertToInvoice=async(item)=>{
if(!confirm('Convert this quotation to invoice?'))return
try{
const{id:_,quotationNumber,...data}=item
await addDoc(collection(db,'companies',companyId,'invoices'),{
...data,
invoiceNumber:'INV-'+Date.now().toString().slice(-6),
status:'pending',
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
convertedFrom:item.id,
convertedFromNumber:quotationNumber,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
alert('Converted to Invoice!')
navigate('/?tab=invoice')
}catch(e){alert(e.message)}
}

const openPaymentModal=(item)=>{
setPaymentModal(item)
setPaymentForm({amount:'',date:new Date().toISOString().split('T')[0],method:paymentMethodOptions[0]||'Cash',note:''})
}

const handleSavePayment=async()=>{
if(!paymentForm.amount||Number(paymentForm.amount)<=0){alert('Enter valid amount');return}
setSavingPayment(true)
try{
const item=paymentModal
const payments=[...(item.payments||[]),{
amount:Number(paymentForm.amount),
date:paymentForm.date,
method:paymentForm.method,
note:paymentForm.note,
createdAt:new Date().toISOString(),
}]
const totalPaid=payments.reduce((s,p)=>s+p.amount,0)
const remaining=Number(item.totalAmount||0)-totalPaid
const newStatus=remaining<=0?'paid':totalPaid>0?'partial':'pending'
await updateDoc(doc(db,'companies',companyId,'invoices',item.id),{
payments,paidAmount:totalPaid,
remainingAmount:remaining<0?0:remaining,
status:newStatus,lastPaymentDate:paymentForm.date,
})
setPaymentModal(null)
}catch(e){alert(e.message)}
setSavingPayment(false)
}

const handleSendReminder=async(item)=>{
if(!item.clientEmail){alert('This client has no email address.');return}
if(!confirm(`Send reminder to ${item.clientName} (${item.clientEmail})?`))return
setSendingReminder(item.id)
try{
const result=await sendInvoiceReminder({
clientName:item.clientName,
clientEmail:item.clientEmail,
invoiceNumber:item.invoiceNumber,
amount:item.remainingAmount||item.totalAmount||0,
status:item.status,
companyName:companyInfo.name,
companyEmail:companyInfo.email,
companyPhone:companyInfo.phone,
paymentMethods:companyInfo.paymentMethods,
})
if(result.success)alert(`Reminder sent to ${item.clientEmail} ✓`)
else alert('Failed: '+result.error)
}catch(e){alert(e.message)}
setSendingReminder(null)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Dashboard">

{/* Confirm Password Modal */}
{confirmAction&&(
<ConfirmPassword
action={confirmAction.label}
onConfirm={()=>{confirmAction.action();setConfirmAction(null)}}
onCancel={()=>setConfirmAction(null)}
/>
)}

{/* Payment Modal */}
{paymentModal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontWeight:600,fontSize:15}}>Record Payment</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>
{paymentModal.invoiceNumber} — Total: {Number(paymentModal.totalAmount||0).toLocaleString()} Ks
{paymentModal.paidAmount>0&&<span style={{color:'#16a34a'}}> | Paid: {Number(paymentModal.paidAmount).toLocaleString()} Ks</span>}
{paymentModal.remainingAmount>0&&<span style={{color:'#d97706'}}> | Due: {Number(paymentModal.remainingAmount).toLocaleString()} Ks</span>}
</div>
</div>
<button type="button" onClick={()=>setPaymentModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Amount (Ks) *</label>
<div style={{display:'flex',gap:8,marginBottom:6}}>
<button type="button" onClick={()=>setPaymentForm(f=>({...f,amount:String(paymentModal.remainingAmount||paymentModal.totalAmount||0)}))} className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}}>Full Amount</button>
{paymentModal.remainingAmount>0&&<button type="button" onClick={()=>setPaymentForm(f=>({...f,amount:String(paymentModal.remainingAmount)}))} className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}}>Remaining</button>}
</div>
<input className="form-input" type="number" value={paymentForm.amount} onChange={e=>setPaymentForm(f=>({...f,amount:e.target.value}))} placeholder="Enter amount..."/>
</div>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Payment Date *</label>
<input className="form-input" type="date" value={paymentForm.date} onChange={e=>setPaymentForm(f=>({...f,date:e.target.value}))}/>
</div>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Payment Method</label>
<select className="form-input" value={paymentForm.method} onChange={e=>setPaymentForm(f=>({...f,method:e.target.value}))}>
{paymentMethodOptions.map(m=><option key={m} value={m}>{m}</option>)}
</select>
</div>
<div style={{marginBottom:16}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Note</label>
<input className="form-input" value={paymentForm.note} onChange={e=>setPaymentForm(f=>({...f,note:e.target.value}))} placeholder="Optional note..."/>
</div>
{paymentModal.payments?.length>0&&(
<div style={{marginBottom:16,padding:12,background:'#f8fafc',borderRadius:8}}>
<div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',marginBottom:8,textTransform:'uppercase'}}>Payment History</div>
{paymentModal.payments.map((p,i)=>(
<div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:'0.5px solid #e2e8f0'}}>
<span style={{color:'var(--text-2)'}}>{p.date} — {p.method}</span>
<span style={{fontWeight:500,color:'#16a34a'}}>{Number(p.amount).toLocaleString()} Ks</span>
</div>
))}
</div>
)}
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setPaymentModal(null)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSavePayment} disabled={savingPayment} className="btn btn-primary">
<CheckSquare size={14}/>{savingPayment?'Saving...':'Save Payment'}
</button>
</div>
</div>
</div>
</div>
)}

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

{/* Revenue Chart */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
<div style={{fontWeight:600,fontSize:14,color:'var(--text-1)'}}>Revenue Chart — {chartYear}</div>
<div style={{display:'flex',gap:8,alignItems:'center'}}>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'5px 8px'}} value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
<option value="">All Years</option>
{uniqueYears.map(y=><option key={y} value={y}>{y}</option>)}
</select>
<button type="button" onClick={()=>setShowChart(v=>!v)} className="btn btn-ghost" style={{fontSize:12,padding:'5px 10px'}}>
{showChart?'Hide':'Show'}
</button>
</div>
</div>
{showChart&&(
<>
<div style={{display:'flex',alignItems:'flex-end',gap:6,height:BAR_H+24,overflowX:'auto',paddingBottom:4}}>
{chartData.map((m,i)=>(
<div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:40,flex:1}}>
<div style={{display:'flex',alignItems:'flex-end',gap:2,height:BAR_H}}>
<div title={`Revenue: ${m.revenue.toLocaleString()} Ks`} style={{width:14,borderRadius:'3px 3px 0 0',background:'#4F6EF7',height:`${Math.round(m.revenue/chartMax*BAR_H)}px`,minHeight:m.revenue>0?3:0,transition:'height 0.3s'}}/>
<div title={`Pending: ${m.pending.toLocaleString()} Ks`} style={{width:14,borderRadius:'3px 3px 0 0',background:'rgba(217,119,6,0.6)',height:`${Math.round(m.pending/chartMax*BAR_H)}px`,minHeight:m.pending>0?3:0,transition:'height 0.3s'}}/>
</div>
<div style={{fontSize:9,color:'var(--text-3)',textAlign:'center'}}>{m.month}</div>
</div>
))}
</div>
<div style={{display:'flex',gap:16,marginTop:8,justifyContent:'center'}}>
<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text-2)'}}>
<div style={{width:10,height:10,borderRadius:2,background:'#4F6EF7'}}/>Revenue (Paid)
</div>
<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text-2)'}}>
<div style={{width:10,height:10,borderRadius:2,background:'rgba(217,119,6,0.6)'}}/>Pending
</div>
</div>
</>
)}
</div>

{/* Widgets Row 1 */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
<div className="card" style={{padding:20}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,marginBottom:16,color:'var(--text-1)'}}>
<Users size={15} color="var(--primary)"/>Top 5 Clients
</div>
{top5Clients.length===0?(
<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:20}}>No data yet</div>
):top5Clients.map((c,i)=>{
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
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,marginBottom:16,color:'var(--text-1)'}}>
<CheckCircle size={15} color="#16a34a"/>Recent Payments
</div>
{recentPayments.length===0?(
<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:20}}>No payments yet</div>
):recentPayments.map((p,i)=>(
<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<div>
<div style={{fontSize:13,fontWeight:500,color:'var(--text-1)'}}>{p.clientName}</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:1}}>{p.invoiceNumber} · {p.date} · {p.method}</div>
</div>
<span style={{fontWeight:600,color:'#16a34a',fontSize:13}}>{Number(p.amount).toLocaleString()} Ks</span>
</div>
))}
</div>
</div>

{/* Widgets Row 2 */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
<div className="card" style={{padding:20}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,marginBottom:16,color:'var(--text-1)'}}>
<AlertCircle size={15} color="#dc2626"/>Outstanding Invoices
</div>
{upcomingDue.length===0?(
<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:20}}>All invoices paid 🎉</div>
):upcomingDue.map(inv=>(
<div key={inv.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid #f1f5f9',cursor:'pointer'}} onClick={()=>navigate(`/invoice/${inv.id}`)}>
<div>
<div style={{fontSize:13,fontWeight:500,color:'var(--text-1)'}}>{inv.clientName}</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:1}}>{inv.invoiceNumber}</div>
</div>
<div style={{textAlign:'right'}}>
<div style={{fontWeight:600,color:'#dc2626',fontSize:13}}>{Number(inv.remainingAmount||inv.totalAmount||0).toLocaleString()} Ks</div>
<span style={{fontSize:10,background:inv.daysOld>30?'#fcebeb':'#faeeda',color:inv.daysOld>30?'#dc2626':'#d97706',padding:'1px 6px',borderRadius:20,fontWeight:500}}>{inv.daysOld}d old</span>
</div>
</div>
))}
</div>
<div className="card" style={{padding:20}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,marginBottom:16,color:'var(--text-1)'}}>
<Wallet size={15} color="#dc2626"/>Expense Breakdown
</div>
{expenseByCategory.length===0?(
<div style={{textAlign:'center',color:'var(--text-3)',fontSize:12,padding:20}}>No expenses yet</div>
):expenseByCategory.map(({cat,amount,pct})=>(
<div key={cat} style={{marginBottom:10}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
<span style={{color:'var(--text-2)',fontWeight:500}}>{cat}</span>
<div style={{display:'flex',gap:8,alignItems:'center'}}>
<span style={{color:'#dc2626',fontWeight:600}}>{amount.toLocaleString()} Ks</span>
<span style={{fontSize:10,color:'var(--text-3)'}}>{pct}%</span>
</div>
</div>
<div style={{height:4,background:'#f1f5f9',borderRadius:2}}>
<div style={{height:4,borderRadius:2,background:'#ef4444',width:`${pct}%`,transition:'width 0.3s'}}/>
</div>
</div>
))}
</div>
</div>

{/* Project Status */}
{projects.length>0&&(
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,fontWeight:600,fontSize:13,marginBottom:16,color:'var(--text-1)'}}>
<Briefcase size={15} color="#8b5cf6"/>Project Status
</div>
<div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
{[
{key:'planning',label:'Planning',color:'#8b5cf6',bg:'rgba(139,92,246,0.1)'},
{key:'active',label:'Active',color:'#16a34a',bg:'rgba(22,163,74,0.1)'},
{key:'on-hold',label:'On Hold',color:'#d97706',bg:'rgba(217,119,6,0.1)'},
{key:'completed',label:'Completed',color:'#4F6EF7',bg:'rgba(79,110,247,0.1)'},
{key:'cancelled',label:'Cancelled',color:'#dc2626',bg:'rgba(220,38,38,0.1)'},
].map(({key,label,color,bg})=>(
<div key={key} style={{flex:1,minWidth:80,padding:'12px 16px',background:bg,borderRadius:12,textAlign:'center',cursor:'pointer'}} onClick={()=>navigate('/projects')}>
<div style={{fontSize:22,fontWeight:700,color}}>{projectStats[key]||0}</div>
<div style={{fontSize:11,color,marginTop:2,fontWeight:500}}>{label}</div>
</div>
))}
</div>
</div>
)}

{/* Role Badge */}
{role&&(
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
<span style={{fontSize:11,color:'var(--text-3)'}}>Your role:</span>
<span style={{
background:role==='owner'?'rgba(79,110,247,0.1)':role==='admin'?'rgba(22,163,74,0.1)':'rgba(217,119,6,0.1)',
color:role==='owner'?'#4F6EF7':role==='admin'?'#16a34a':'#d97706',
padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'
}}>{role}</span>
{!canEdit&&<span style={{fontSize:11,color:'var(--text-3)'}}>— View only mode</span>}
</div>
)}

{/* Tabs + Filters */}
<div style={{marginBottom:12}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:12,padding:4}}>
{tabs.map(({id,label,icon:Icon,data})=>(
<button type="button" key={id} onClick={()=>{setActiveTab(id);navigate(`/?tab=${id}`)}} className="btn" style={{
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
<button type="button" className="btn btn-primary" onClick={()=>navigate(activeTab==='quotation'?'/create-quotation':'/create-invoice')}>
<Plus size={15}/>New
</button>
</div>

{activeTab==='invoice'&&(
<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
<div style={{position:'relative'}}>
<Search size={12} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{paddingLeft:26,fontSize:12,padding:'6px 8px 6px 26px',width:140}}/>
</div>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterYear} onChange={e=>{setFilterYear(e.target.value);setFilterMonth('')}}>
<option value="">All Years</option>
{uniqueYears.map(y=><option key={y} value={y}>{y}</option>)}
</select>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map((m,i)=><option key={m} value={m}>{monthNames[i]}</option>)}
</select>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterCustomer} onChange={e=>setFilterCustomer(e.target.value)}>
<option value="">All Customers</option>
{uniqueCustomers.map(c=><option key={c} value={c}>{c}</option>)}
</select>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
<option value="">All Status</option>
{['paid','pending','partial','overdue','refunded'].map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
</select>
{(filterYear||filterMonth||filterCustomer||filterStatus||search)&&(
<button type="button" onClick={()=>{setFilterYear('');setFilterMonth('');setFilterCustomer('');setFilterStatus('');setSearch('')}} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',color:'#dc2626'}}>
<X size={12}/>Clear
</button>
)}
</div>
)}
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
<th>Number</th><th>Client</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>Paid</th><th style={{textAlign:'center'}}>Status</th><th>Date</th><th style={{textAlign:'center'}}>Actions</th>
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
<td style={{textAlign:'right',fontSize:12}}>
{item.paidAmount>0?<span style={{color:'#16a34a',fontWeight:500}}>{Number(item.paidAmount).toLocaleString()} Ks</span>:<span style={{color:'var(--text-3)'}}>-</span>}
</td>
<td style={{textAlign:'center'}}>{statusBadge(item.status)}</td>
<td style={{color:'var(--text-3)',fontSize:12}}>
<div>{item.createdAt?.seconds?new Date(item.createdAt.seconds*1000).toLocaleDateString():'-'}</div>
{item.lastPaymentDate&&<div style={{color:'#16a34a',fontSize:11}}>Paid: {item.lastPaymentDate}</div>}
</td>
</>}
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center',alignItems:'center'}}>
<button type="button" onClick={()=>navigate(activeTab==='quotation'?`/quotation/${item.id}`:`/invoice/${item.id}`)} title="View/Print" style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Printer size={14}/></button>
<button type="button" onClick={()=>handleEditNav(item)} title="Edit" style={{background:'none',border:'none',cursor:canEdit?'pointer':'not-allowed',color:canEdit?'var(--text-2)':'var(--text-3)',padding:4,borderRadius:6,opacity:canEdit?1:0.4}}><Edit size={14}/></button>
{activeTab!=='customer'&&<>
<button type="button" onClick={()=>handleDuplicate(item)} title="Duplicate" style={{background:'none',border:'none',cursor:'pointer',color:'#8b5cf6',padding:4,borderRadius:6}}><CopyPlus size={14}/></button>
<button type="button" onClick={()=>handleShareLink(item)} title="Share link" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Link size={14}/></button>
{activeTab==='invoice'&&<>
<button type="button" onClick={()=>openPaymentModal(item)} title="Record payment" style={{background:'none',border:'none',cursor:'pointer',color:'#16a34a',padding:4,borderRadius:6}}><DollarSign size={14}/></button>
<button type="button" onClick={()=>handleSendReminder(item)} title="Send reminder" disabled={sendingReminder===item.id} style={{background:'none',border:'none',cursor:'pointer',color:'#4F6EF7',padding:4,borderRadius:6,opacity:sendingReminder===item.id?0.5:1}}>
{sendingReminder===item.id?<Clock size={14}/>:<Mail size={14}/>}
</button>
</>}
{activeTab==='quotation'&&<button type="button" onClick={()=>handleConvertToInvoice(item)} title="Convert to Invoice" style={{background:'none',border:'none',cursor:'pointer',color:'#4F6EF7',padding:4,borderRadius:6}}><FileText size={14}/></button>}
<button type="button" onClick={()=>handleStatus(item.id,'refunded')} title="Refund" style={{background:'none',border:'none',cursor:'pointer',color:'#d97706',padding:4,borderRadius:6}}><RefreshCcw size={14}/></button>
</>}
<button type="button" onClick={()=>handleDeleteWithAuth(item.id)} title="Delete" style={{background:'none',border:'none',cursor:canDelete?'pointer':'not-allowed',color:canDelete?'var(--danger)':'var(--text-3)',padding:4,borderRadius:6,opacity:canDelete?1:0.4}}><Trash2 size={14}/></button>
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
