import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import Layout from'../components/Layout'
import{TrendingUp,TrendingDown,DollarSign,FileText,Users,BarChart2}from'lucide-react'

export default function Reports(){
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[expenses,setExpenses]=useState([])
const[customers,setCustomers]=useState([])
const[loading,setLoading]=useState(true)
const[filterYear,setFilterYear]=useState(new Date().getFullYear().toString())
const[filterMonth,setFilterMonth]=useState('')

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[invSnap,expSnap,cusSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'expenses')),
getDocs(collection(db,'companies',cid,'customers')),
])
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})))
setExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})))
setCustomers(cusSnap.docs.map(d=>({id:d.id,...d.data()})))
}
setLoading(false)
}
load()
},[])

const getInvDate=inv=>inv.date||(inv.createdAt?.seconds?new Date(inv.createdAt.seconds*1000).toISOString().split('T')[0]:null)

const filteredInvoices=invoices.filter(inv=>{
const d=getInvDate(inv)
if(!d)return false
if(filterYear&&!d.startsWith(filterYear))return false
if(filterMonth&&!d.startsWith(`${filterYear}-${filterMonth}`))return false
return true
})

const filteredExpenses=expenses.filter(e=>{
const d=e.date
if(!d)return false
if(filterYear&&!d.startsWith(filterYear))return false
if(filterMonth&&!d.startsWith(`${filterYear}-${filterMonth}`))return false
return true
})

const totalRevenue=filteredInvoices.reduce((s,i)=>s+Number(i.totalAmount||0),0)
const totalPaid=filteredInvoices.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.totalAmount||0),0)
const totalPending=filteredInvoices.filter(i=>i.status==='pending').reduce((s,i)=>s+Number(i.totalAmount||0),0)
const totalExpenses=filteredExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
const netProfit=totalPaid-totalExpenses

const months=['01','02','03','04','05','06','07','08','09','10','11','12']
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const monthlyData=months.map((m,idx)=>{
const mInv=invoices.filter(i=>{const d=getInvDate(i);return d?.startsWith(`${filterYear}-${m}`)})
const mExp=expenses.filter(e=>e.date?.startsWith(`${filterYear}-${m}`))
const revenue=mInv.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.totalAmount||0),0)
const expense=mExp.reduce((s,e)=>s+Number(e.amount||0),0)
return{month:monthNames[idx],revenue,expense,profit:revenue-expense}
})

const maxVal=Math.max(...monthlyData.map(d=>Math.max(d.revenue,d.expense)),1)

const byClient=[...new Set(filteredInvoices.map(i=>i.clientName))].map(name=>({
name,
total:filteredInvoices.filter(i=>i.clientName===name).reduce((s,i)=>s+Number(i.totalAmount||0),0),
count:filteredInvoices.filter(i=>i.clientName===name).length,
})).sort((a,b)=>b.total-a.total).slice(0,5)

const byExpCat=[...new Set(filteredExpenses.map(e=>e.category))].map(cat=>({
cat,
total:filteredExpenses.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount||0),0),
})).sort((a,b)=>b.total-a.total)

const years=[...new Set([...invoices.map(i=>getInvDate(i)?.slice(0,4)),...expenses.map(e=>e.date?.slice(0,4))].filter(Boolean))].sort().reverse()

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Reports">

{/* Filters */}
<div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
<select className="form-input" style={{width:'auto'}} value={filterYear} onChange={e=>{setFilterYear(e.target.value);setFilterMonth('')}}>
{years.map(y=><option key={y} value={y}>{y}</option>)}
{!years.includes(new Date().getFullYear().toString())&&<option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>}
</select>
<select className="form-input" style={{width:'auto'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map((m,i)=><option key={m} value={m}>{monthNames[i]}</option>)}
</select>
</div>

{/* Summary Cards */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
{[
{label:'Total Revenue',value:totalRevenue,icon:TrendingUp,color:'#4F6EF7',bg:'rgba(79,110,247,0.10)',sub:`${filteredInvoices.length} invoices`},
{label:'Total Paid',value:totalPaid,icon:DollarSign,color:'#16a34a',bg:'rgba(22,163,74,0.10)',sub:`${filteredInvoices.filter(i=>i.status==='paid').length} paid`},
{label:'Pending',value:totalPending,icon:FileText,color:'#d97706',bg:'rgba(217,119,6,0.10)',sub:`${filteredInvoices.filter(i=>i.status==='pending').length} pending`},
{label:'Total Expenses',value:totalExpenses,icon:TrendingDown,color:'#dc2626',bg:'rgba(220,38,38,0.10)',sub:`${filteredExpenses.length} records`},
{label:'Net Profit',value:netProfit,icon:BarChart2,color:netProfit>=0?'#16a34a':'#dc2626',bg:netProfit>=0?'rgba(22,163,74,0.10)':'rgba(220,38,38,0.10)',sub:'Paid - Expenses'},
{label:'Customers',value:customers.length,icon:Users,color:'#8b5cf6',bg:'rgba(139,92,246,0.10)',sub:'total'},
].map(({label,value,icon:Icon,color,bg,sub})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
<span style={{fontSize:12,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
<div style={{width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
<Icon size={16} color={color}/>
</div>
</div>
<div style={{fontSize:20,fontWeight:700,color:typeof value==='number'&&label!=='Customers'?color:'var(--text-1)'}}>{typeof value==='number'&&label!=='Customers'?`${value.toLocaleString()} Ks`:value}</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{sub}</div>
</div>
))}
</div>

{/* Monthly Bar Chart */}
{!filterMonth&&(
<div className="card" style={{padding:24,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.05em'}}>Monthly Overview — {filterYear}</div>
<div style={{display:'flex',alignItems:'flex-end',gap:8,height:160,overflowX:'auto',paddingBottom:8}}>
{monthlyData.map(({month,revenue,expense})=>(
<div key={month} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:40,flex:1}}>
<div style={{display:'flex',gap:2,alignItems:'flex-end',height:120}}>
<div style={{width:12,background:'#4F6EF7',borderRadius:'3px 3px 0 0',height:`${(revenue/maxVal)*100}%`,minHeight:revenue>0?4:0,transition:'height 0.3s'}} title={`Revenue: ${revenue.toLocaleString()} Ks`}/>
<div style={{width:12,background:'#dc2626',borderRadius:'3px 3px 0 0',height:`${(expense/maxVal)*100}%`,minHeight:expense>0?4:0,transition:'height 0.3s'}} title={`Expense: ${expense.toLocaleString()} Ks`}/>
</div>
<div style={{fontSize:10,color:'var(--text-3)',textAlign:'center'}}>{month}</div>
</div>
))}
</div>
<div style={{display:'flex',gap:16,marginTop:8}}>
<div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-2)'}}>
<div style={{width:12,height:12,borderRadius:2,background:'#4F6EF7'}}/> Revenue
</div>
<div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-2)'}}>
<div style={{width:12,height:12,borderRadius:2,background:'#dc2626'}}/> Expenses
</div>
</div>
</div>
)}

{/* Top Clients & Expense breakdown */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
<div className="card" style={{padding:20}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Top Clients</div>
{byClient.length===0?<div style={{color:'var(--text-3)',fontSize:13}}>No data</div>:byClient.map(({name,total,count})=>(
<div key={name} style={{marginBottom:10}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
<span style={{fontWeight:500,color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:120}}>{name}</span>
<span style={{color:'#4F6EF7',fontWeight:500,flexShrink:0}}>{total.toLocaleString()} Ks</span>
</div>
<div style={{height:4,background:'#f1f5f9',borderRadius:4}}>
<div style={{height:4,background:'#4F6EF7',borderRadius:4,width:`${(total/(byClient[0]?.total||1))*100}%`}}/>
</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{count} invoice{count!==1?'s':''}</div>
</div>
))}
</div>

<div className="card" style={{padding:20}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Expense Breakdown</div>
{byExpCat.length===0?<div style={{color:'var(--text-3)',fontSize:13}}>No data</div>:byExpCat.map(({cat,total})=>(
<div key={cat} style={{marginBottom:10}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
<span style={{fontWeight:500,color:'var(--text-1)'}}>{cat}</span>
<span style={{color:'#dc2626',fontWeight:500}}>{total.toLocaleString()} Ks</span>
</div>
<div style={{height:4,background:'#f1f5f9',borderRadius:4}}>
<div style={{height:4,background:'#dc2626',borderRadius:4,width:`${(total/(byExpCat[0]?.total||1))*100}%`}}/>
</div>
</div>
))}
</div>
</div>

{/* Invoice Status Breakdown */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Invoice Status Breakdown</div>
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
{[
{label:'Paid',status:'paid',color:'#16a34a',bg:'#eaf3de'},
{label:'Pending',status:'pending',color:'#d97706',bg:'#faeeda'},
{label:'Partial',status:'partial',color:'#2563eb',bg:'#e6f1fb'},
{label:'Overdue',status:'overdue',color:'#dc2626',bg:'#fcebeb'},
].map(({label,status,color,bg})=>{
const count=filteredInvoices.filter(i=>i.status===status).length
const amt=filteredInvoices.filter(i=>i.status===status).reduce((s,i)=>s+Number(i.totalAmount||0),0)
return(
<div key={status} style={{background:bg,borderRadius:10,padding:12,textAlign:'center'}}>
<div style={{fontSize:20,fontWeight:700,color}}>{count}</div>
<div style={{fontSize:11,color,fontWeight:500,marginBottom:4}}>{label}</div>
<div style={{fontSize:11,color,opacity:0.8}}>{amt.toLocaleString()} Ks</div>
</div>
)
})}
</div>
</div>

</Layout>
)
}
