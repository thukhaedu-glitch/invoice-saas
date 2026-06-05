import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import Layout from'../components/Layout'
import{Download,FileText,TrendingUp,TrendingDown,BookOpen,Briefcase,Receipt}from'lucide-react'

const TABS=[
{id:'pnl',label:'P&L'},
{id:'chart',label:'Chart'},
{id:'project',label:'Projects'},
{id:'tax',label:'Tax'},
{id:'balance',label:'Balance Sheet'},
{id:'ap',label:'AP/AR'},
{id:'journal',label:'Journal'},
{id:'ledger',label:'Ledger'},
]

const BAR_H=160
const monthNamesFull=['January','February','March','April','May','June','July','August','September','October','November','December']
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const months=['01','02','03','04','05','06','07','08','09','10','11','12']

export default function Reports(){
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[expenses,setExpenses]=useState([])
const[projects,setProjects]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[bills,setBills]=useState([])
const[loading,setLoading]=useState(true)
const[activeTab,setActiveTab]=useState('pnl')
const[filterYear,setFilterYear]=useState(new Date().getFullYear().toString())
const[filterMonth,setFilterMonth]=useState('')
const[expandedMonth,setExpandedMonth]=useState(null)
const[expandedTaxMonth,setExpandedTaxMonth]=useState(null)

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[invSnap,expSnap,prjSnap,baSnap,billSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'expenses')),
getDocs(collection(db,'companies',cid,'projects')),
getDocs(collection(db,'companies',cid,'bankAccounts')),
getDocs(collection(db,'companies',cid,'bills')),
])
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})))
setExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})))
setProjects(prjSnap.docs.map(d=>({id:d.id,...d.data()})))
setBankAccounts(baSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.isActive!==false))
setBills(billSnap.docs.map(d=>({id:d.id,...d.data()})))
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

const filteredBills=bills.filter(b=>{
const d=b.billDate
if(!d)return false
if(filterYear&&!d.startsWith(filterYear))return false
if(filterMonth&&!d.startsWith(`${filterYear}-${filterMonth}`))return false
return true
})

const paidInvoices=filteredInvoices.filter(i=>i.status==='paid'||i.status==='partial')
const totalRevenue=paidInvoices.reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const totalCashExpenses=filteredExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
const totalBillsPaid=filteredBills.filter(b=>b.status==='paid'||b.status==='partial').reduce((s,b)=>s+Number(b.paidAmount||b.amount||0),0)
const totalExpenses=totalCashExpenses+totalBillsPaid
const netProfit=totalRevenue-totalExpenses

const years=[...new Set([
...invoices.map(i=>getInvDate(i)?.slice(0,4)),
...expenses.map(e=>e.date?.slice(0,4)),
...bills.map(b=>b.billDate?.slice(0,4)),
].filter(Boolean))].sort().reverse()

const pnlMonths=months.map((m,idx)=>{
const mInv=invoices.filter(i=>getInvDate(i)?.startsWith(`${filterYear}-${m}`))
const mExp=expenses.filter(e=>e.date?.startsWith(`${filterYear}-${m}`))
const mBills=bills.filter(b=>b.billDate?.startsWith(`${filterYear}-${m}`)&&(b.status==='paid'||b.status==='partial'))
const revenue=mInv.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const expenseCash=mExp.reduce((s,e)=>s+Number(e.amount||0),0)
const expenseBills=mBills.reduce((s,b)=>s+Number(b.paidAmount||b.amount||0),0)
const expense=expenseCash+expenseBills
return{month:monthNamesFull[idx],shortMonth:monthNames[idx],mNum:m,revenue,expense,expenseCash,expenseBills,profit:revenue-expense}
}).filter(m=>m.revenue>0||m.expense>0)

const totalTax=filteredInvoices.reduce((s,i)=>Number(i.taxRate||0)>0?s+(Number(i.totalAmount||0)*(Number(i.taxRate||0)/100)):s,0)
const taxByMonth=months.map((m,idx)=>{
const mInv=invoices.filter(i=>getInvDate(i)?.startsWith(`${filterYear}-${m}`))
const tax=mInv.reduce((s,i)=>s+(Number(i.totalAmount||0)*(Number(i.taxRate||0)/100)),0)
const taxable=mInv.filter(i=>Number(i.taxRate||0)>0)
return{month:monthNamesFull[idx],tax,taxableInvoices:taxable.length,totalAmount:taxable.reduce((s,i)=>s+Number(i.totalAmount||0),0)}
}).filter(m=>m.tax>0)

const projectPnL=projects.map(p=>{
const pInv=invoices.filter(i=>i.projectId===p.id&&(i.status==='paid'||i.status==='partial'))
const pExp=expenses.filter(e=>e.projectId===p.id)
const revenue=pInv.reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const expense=pExp.reduce((s,e)=>s+Number(e.amount||0),0)
return{...p,revenue,expense,profit:revenue-expense,invoiceCount:pInv.length,expenseCount:pExp.length}
}).sort((a,b)=>b.profit-a.profit)

const journalEntries=[
...filteredInvoices.map(i=>({
date:getInvDate(i)||'-',type:'Invoice',ref:i.invoiceNumber||'-',
description:`Invoice to ${i.clientName}`,
debit:Number(i.totalAmount||0),credit:0,status:i.status,
})),
...filteredExpenses.map(e=>({
date:e.date||'-',type:'Expense',ref:e.category||'-',
description:e.title,debit:0,credit:Number(e.amount||0),status:'paid',
})),
...filteredBills.map(b=>({
date:b.billDate||'-',type:'Bill',ref:b.billNumber||'-',
description:`Bill: ${b.title}${b.vendor?' — '+b.vendor:''}`,
debit:0,credit:Number(b.amount||0),status:b.status,
})),
].sort((a,b)=>a.date.localeCompare(b.date))

const ledgerByClient=[...new Set(filteredInvoices.map(i=>i.clientName))].map(name=>{
const clientInv=filteredInvoices.filter(i=>i.clientName===name)
const totalBilled=clientInv.reduce((s,i)=>s+Number(i.totalAmount||0),0)
const totalPaid=clientInv.reduce((s,i)=>s+Number(i.paidAmount||0),0)
return{name,invoices:clientInv.length,totalBilled,totalPaid,balance:totalBilled-totalPaid}
}).sort((a,b)=>b.totalBilled-a.totalBilled)

const exportCSV=(data,filename)=>{
const headers=Object.keys(data[0]||{}).join(',')
const rows=data.map(r=>Object.values(r).map(v=>`"${v}"`).join(',')).join('\n')
const blob=new Blob([headers+'\n'+rows],{type:'text/csv'})
const url=URL.createObjectURL(blob)
const a=document.createElement('a')
a.href=url;a.download=filename;a.click()
URL.revokeObjectURL(url)
}

const th={padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}
const td={padding:'10px 14px',fontSize:13,borderBottom:'0.5px solid #f1f5f9',color:'var(--text-1)'}
const tdR={...td,textAlign:'right'}
const chartMax=Math.max(...pnlMonths.map(m=>Math.max(m.revenue,m.expense)),1)

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Reports">

<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
<select className="form-input" style={{width:'auto'}} value={filterYear} onChange={e=>{setFilterYear(e.target.value);setFilterMonth('');setExpandedMonth(null)}}>
{(years.length?years:[new Date().getFullYear().toString()]).map(y=><option key={y} value={y}>{y}</option>)}
</select>
<select className="form-input" style={{width:'auto'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map((m,i)=><option key={m} value={m}>{monthNamesFull[i]}</option>)}
</select>
</div>
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:12,padding:4,flexWrap:'wrap'}}>
{TABS.map(t=>(
<button type="button" key={t.id} onClick={()=>setActiveTab(t.id)} className="btn" style={{
padding:'7px 12px',borderRadius:8,fontSize:12,
background:activeTab===t.id?'var(--primary)':'transparent',
color:activeTab===t.id?'#fff':'var(--text-2)',
}}>
{t.label}
</button>
))}
</div>
</div>

<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
{[
{label:'Total Revenue',value:totalRevenue,icon:TrendingUp,color:'#4F6EF7',bg:'rgba(79,110,247,0.10)'},
{label:'Total Expenses',value:totalExpenses,icon:TrendingDown,color:'#dc2626',bg:'rgba(220,38,38,0.10)'},
{label:'Net Profit',value:netProfit,icon:BookOpen,color:netProfit>=0?'#16a34a':'#dc2626',bg:netProfit>=0?'rgba(22,163,74,0.10)':'rgba(220,38,38,0.10)'},
].map(({label,value,icon:Icon,color,bg})=>(
<div key={label} className="card" style={{padding:20}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
<span style={{fontSize:12,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
<div style={{width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
<Icon size={16} color={color}/>
</div>
</div>
<div style={{fontSize:22,fontWeight:700,color}}>{value.toLocaleString()} Ks</div>
</div>
))}
</div>

{/* P&L Tab */}
{activeTab==='pnl'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><FileText size={15}/>Profit & Loss — {filterYear}</div>
<button type="button" onClick={()=>exportCSV(pnlMonths.map(m=>({Month:m.month,Revenue:m.revenue,'Cash Expenses':m.expenseCash,'Bill Expenses':m.expenseBills,'Total Expenses':m.expense,'Net Profit':m.profit})),`PnL_${filterYear}.csv`)} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={14}/>Export CSV
</button>
</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={th}>Month</th>
<th style={{...th,textAlign:'right'}}>Revenue (Ks)</th>
<th style={{...th,textAlign:'right'}}>Cash Exp (Ks)</th>
<th style={{...th,textAlign:'right'}}>Bills Paid (Ks)</th>
<th style={{...th,textAlign:'right'}}>Total Exp (Ks)</th>
<th style={{...th,textAlign:'right'}}>Net Profit (Ks)</th>
<th style={{...th,textAlign:'right'}}>Margin</th>
</tr></thead>
<tbody>
{pnlMonths.length===0?(
<tr><td colSpan={7} style={{...td,textAlign:'center',color:'var(--text-3)',padding:40}}>No data</td></tr>
):pnlMonths.map(m=>{
const isExpanded=expandedMonth===m.month
const mInvs=invoices.filter(i=>getInvDate(i)?.startsWith(`${filterYear}-${m.mNum}`)&&(i.status==='paid'||i.status==='partial'))
const mExps=expenses.filter(e=>e.date?.startsWith(`${filterYear}-${m.mNum}`))
const mBills=bills.filter(b=>b.billDate?.startsWith(`${filterYear}-${m.mNum}`)&&(b.status==='paid'||b.status==='partial'))
return(
<>
<tr key={m.month} onClick={()=>setExpandedMonth(isExpanded?null:m.month)} style={{cursor:'pointer',background:isExpanded?'rgba(79,110,247,0.04)':'white'}}>
<td style={{...td,fontWeight:500}}>
<span style={{display:'inline-flex',alignItems:'center',gap:6}}>
<span style={{fontSize:10,color:'var(--primary)'}}>{isExpanded?'▼':'▶'}</span>
{m.month}
</span>
</td>
<td style={{...tdR,color:'#4F6EF7'}}>{m.revenue.toLocaleString()}</td>
<td style={{...tdR,color:'#dc2626'}}>{m.expenseCash.toLocaleString()}</td>
<td style={{...tdR,color:'#d97706'}}>{m.expenseBills.toLocaleString()}</td>
<td style={{...tdR,color:'#dc2626',fontWeight:600}}>{m.expense.toLocaleString()}</td>
<td style={{...tdR,fontWeight:600,color:m.profit>=0?'#16a34a':'#dc2626'}}>{m.profit.toLocaleString()}</td>
<td style={{...tdR,fontSize:12,color:m.profit>=0?'#16a34a':'#dc2626'}}>
{m.revenue>0?`${Math.round(m.profit/m.revenue*100)}%`:'-'}
</td>
</tr>
{isExpanded&&(
<tr key={m.month+'_detail'}>
<td colSpan={7} style={{padding:0,background:'#f8fafc'}}>
<div style={{padding:16}}>
{mInvs.length>0&&(
<div style={{marginBottom:12}}>
<div style={{fontSize:11,fontWeight:600,color:'#4F6EF7',textTransform:'uppercase',marginBottom:8}}>Invoices ({mInvs.length})</div>
<table style={{width:'100%',borderCollapse:'collapse',background:'white',borderRadius:8,overflow:'hidden'}}>
<thead><tr style={{background:'rgba(79,110,247,0.06)'}}>
<th style={{...th,padding:'7px 12px'}}>Number</th>
<th style={{...th,padding:'7px 12px'}}>Client</th>
<th style={{...th,padding:'7px 12px',textAlign:'right'}}>Amount</th>
<th style={{...th,padding:'7px 12px',textAlign:'right'}}>Paid</th>
<th style={{...th,padding:'7px 12px',textAlign:'center'}}>Status</th>
</tr></thead>
<tbody>
{mInvs.map(i=>(
<tr key={i.id}>
<td style={{...td,padding:'7px 12px',fontFamily:'monospace',fontSize:11,color:'var(--primary)'}}>{i.invoiceNumber}</td>
<td style={{...td,padding:'7px 12px',fontWeight:500}}>{i.clientName}</td>
<td style={{...td,padding:'7px 12px',textAlign:'right'}}>{Number(i.totalAmount||0).toLocaleString()} Ks</td>
<td style={{...td,padding:'7px 12px',textAlign:'right',color:'#16a34a',fontWeight:500}}>{Number(i.paidAmount||i.totalAmount||0).toLocaleString()} Ks</td>
<td style={{...td,padding:'7px 12px',textAlign:'center'}}><span style={{background:i.status==='paid'?'#eaf3de':'#e6f1fb',color:i.status==='paid'?'#16a34a':'#2563eb',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:500}}>{i.status}</span></td>
</tr>
))}
</tbody>
</table>
</div>
)}
{mExps.length>0&&(
<div style={{marginBottom:12}}>
<div style={{fontSize:11,fontWeight:600,color:'#dc2626',textTransform:'uppercase',marginBottom:8}}>Cash Expenses ({mExps.length})</div>
<table style={{width:'100%',borderCollapse:'collapse',background:'white',borderRadius:8,overflow:'hidden'}}>
<thead><tr style={{background:'rgba(220,38,38,0.04)'}}>
<th style={{...th,padding:'7px 12px'}}>Title</th>
<th style={{...th,padding:'7px 12px'}}>Category</th>
<th style={{...th,padding:'7px 12px'}}>Date</th>
<th style={{...th,padding:'7px 12px',textAlign:'right'}}>Amount</th>
</tr></thead>
<tbody>
{mExps.map(e=>(
<tr key={e.id}>
<td style={{...td,padding:'7px 12px',fontWeight:500}}>{e.title}</td>
<td style={{...td,padding:'7px 12px'}}><span style={{background:'var(--primary-light)',color:'var(--primary)',padding:'2px 8px',borderRadius:20,fontSize:10}}>{e.category}</span></td>
<td style={{...td,padding:'7px 12px',color:'var(--text-3)',fontSize:12}}>{e.date}</td>
<td style={{...td,padding:'7px 12px',textAlign:'right',color:'#dc2626',fontWeight:500}}>{Number(e.amount||0).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>
)}
{mBills.length>0&&(
<div>
<div style={{fontSize:11,fontWeight:600,color:'#d97706',textTransform:'uppercase',marginBottom:8}}>Bills Paid ({mBills.length})</div>
<table style={{width:'100%',borderCollapse:'collapse',background:'white',borderRadius:8,overflow:'hidden'}}>
<thead><tr style={{background:'rgba(217,119,6,0.04)'}}>
<th style={{...th,padding:'7px 12px'}}>Bill</th>
<th style={{...th,padding:'7px 12px'}}>Vendor</th>
<th style={{...th,padding:'7px 12px'}}>Category</th>
<th style={{...th,padding:'7px 12px',textAlign:'right'}}>Amount</th>
<th style={{...th,padding:'7px 12px',textAlign:'center'}}>Status</th>
</tr></thead>
<tbody>
{mBills.map(b=>(
<tr key={b.id}>
<td style={{...td,padding:'7px 12px',fontFamily:'monospace',fontSize:11,color:'#d97706'}}>{b.billNumber}</td>
<td style={{...td,padding:'7px 12px',fontWeight:500}}>{b.vendor||'-'}</td>
<td style={{...td,padding:'7px 12px'}}><span style={{background:'#faeeda',color:'#d97706',padding:'2px 8px',borderRadius:20,fontSize:10}}>{b.category}</span></td>
<td style={{...td,padding:'7px 12px',textAlign:'right',color:'#d97706',fontWeight:500}}>{Number(b.paidAmount||b.amount||0).toLocaleString()} Ks</td>
<td style={{...td,padding:'7px 12px',textAlign:'center'}}><span style={{background:'#eaf3de',color:'#16a34a',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:500}}>{b.status}</span></td>
</tr>
))}
</tbody>
</table>
</div>
)}
{mInvs.length===0&&mExps.length===0&&mBills.length===0&&<div style={{textAlign:'center',color:'var(--text-3)',fontSize:13,padding:20}}>No detailed records</div>}
</div>
</td>
</tr>
)}
</>
)
})}
</tbody>
{pnlMonths.length>0&&(
<tfoot><tr style={{background:'#f8fafc'}}>
<td style={{...td,fontWeight:700}}>Total</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{pnlMonths.reduce((s,m)=>s+m.revenue,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{pnlMonths.reduce((s,m)=>s+m.expenseCash,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#d97706'}}>{pnlMonths.reduce((s,m)=>s+m.expenseBills,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{pnlMonths.reduce((s,m)=>s+m.expense,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:netProfit>=0?'#16a34a':'#dc2626'}}>{netProfit.toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:netProfit>=0?'#16a34a':'#dc2626'}}>{totalRevenue>0?`${Math.round(netProfit/totalRevenue*100)}%`:'-'}</td>
</tr></tfoot>
)}
</table>
</div>
)}

{/* Chart Tab */}
{activeTab==='chart'&&(
<div className="card" style={{padding:24}}>
<div style={{fontWeight:600,fontSize:14,marginBottom:20}}>Income vs Expense — {filterYear}</div>
{pnlMonths.length===0?(
<div style={{textAlign:'center',color:'var(--text-3)',padding:40}}>No data for selected period</div>
):(
<>
<div style={{display:'flex',alignItems:'flex-end',gap:8,height:BAR_H+40,overflowX:'auto',paddingBottom:8}}>
{pnlMonths.map(m=>(
<div key={m.month} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,minWidth:48,flex:1}}>
<div style={{display:'flex',alignItems:'flex-end',gap:3,height:BAR_H}}>
<div title={`Revenue: ${m.revenue.toLocaleString()} Ks`} style={{width:18,borderRadius:'4px 4px 0 0',background:'#4F6EF7',height:`${Math.round(m.revenue/chartMax*BAR_H)}px`,minHeight:m.revenue>0?4:0,transition:'height 0.3s'}}/>
<div title={`Expense: ${m.expense.toLocaleString()} Ks`} style={{width:18,borderRadius:'4px 4px 0 0',background:'#ef4444',height:`${Math.round(m.expense/chartMax*BAR_H)}px`,minHeight:m.expense>0?4:0,transition:'height 0.3s'}}/>
</div>
<div style={{fontSize:10,color:'var(--text-3)',textAlign:'center'}}>{m.shortMonth}</div>
</div>
))}
</div>
<div style={{display:'flex',gap:20,marginTop:8,justifyContent:'center'}}>
<div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-2)'}}><div style={{width:12,height:12,borderRadius:3,background:'#4F6EF7'}}/>Revenue</div>
<div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-2)'}}><div style={{width:12,height:12,borderRadius:3,background:'#ef4444'}}/>Total Expenses</div>
</div>
<div style={{marginTop:24,padding:16,background:'#f8fafc',borderRadius:12}}>
<div style={{fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Monthly Profit</div>
<div style={{display:'flex',gap:8,overflowX:'auto'}}>
{pnlMonths.map(m=>(
<div key={m.month} style={{textAlign:'center',minWidth:48,flex:1}}>
<div style={{fontSize:11,fontWeight:600,color:m.profit>=0?'#16a34a':'#dc2626'}}>{m.profit>=0?'+':''}{(m.profit/1000).toFixed(0)}K</div>
<div style={{fontSize:10,color:'var(--text-3)',marginTop:2}}>{m.shortMonth}</div>
</div>
))}
</div>
</div>
</>
)}
</div>
)}

{/* Project Tab */}
{activeTab==='project'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><Briefcase size={15}/>Project P&L</div>
<button type="button" onClick={()=>exportCSV(projectPnL.map(p=>({Project:p.name,Client:p.clientName||'-',Revenue:p.revenue,Expenses:p.expense,'Net Profit':p.profit})),`ProjectPnL.csv`)} className="btn btn-ghost" style={{fontSize:12}}><Download size={14}/>Export CSV</button>
</div>
{projectPnL.length===0?(
<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>No projects with linked invoices or expenses</div>
):(
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={th}>Project</th><th style={th}>Client</th><th style={th}>Status</th>
<th style={{...th,textAlign:'center'}}>Inv</th>
<th style={{...th,textAlign:'right'}}>Revenue (Ks)</th>
<th style={{...th,textAlign:'right'}}>Expenses (Ks)</th>
<th style={{...th,textAlign:'right'}}>Net Profit (Ks)</th>
<th style={{...th,textAlign:'right'}}>Margin</th>
</tr></thead>
<tbody>
{projectPnL.map(p=>(
<tr key={p.id}>
<td style={{...td,fontWeight:500}}>{p.name}</td>
<td style={{...td,color:'var(--text-2)'}}>{p.clientName||'-'}</td>
<td style={td}><span style={{background:p.status==='active'?'rgba(22,163,74,0.1)':p.status==='completed'?'rgba(79,110,247,0.1)':'#f1f5f9',color:p.status==='active'?'#16a34a':p.status==='completed'?'#4F6EF7':'#64748b',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,textTransform:'capitalize'}}>{p.status}</span></td>
<td style={{...td,textAlign:'center',fontSize:12}}>{p.invoiceCount}</td>
<td style={{...tdR,color:'#4F6EF7',fontWeight:500}}>{p.revenue.toLocaleString()}</td>
<td style={{...tdR,color:'#dc2626',fontWeight:500}}>{p.expense.toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:p.profit>=0?'#16a34a':'#dc2626'}}>{p.profit.toLocaleString()}</td>
<td style={{...tdR,fontSize:12,color:p.profit>=0?'#16a34a':'#dc2626'}}>{p.revenue>0?`${Math.round(p.profit/p.revenue*100)}%`:'-'}</td>
</tr>
))}
</tbody>
<tfoot><tr style={{background:'#f8fafc'}}>
<td colSpan={4} style={{...td,fontWeight:700}}>Total</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{projectPnL.reduce((s,p)=>s+p.revenue,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{projectPnL.reduce((s,p)=>s+p.expense,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:projectPnL.reduce((s,p)=>s+p.profit,0)>=0?'#16a34a':'#dc2626'}}>{projectPnL.reduce((s,p)=>s+p.profit,0).toLocaleString()}</td>
<td/>
</tr></tfoot>
</table>
)}
</div>
)}

{/* Tax Tab */}
{activeTab==='tax'&&(
<div>
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
<div><div style={{fontSize:12,color:'var(--text-2)',marginBottom:4}}>Total Tax Collected</div><div style={{fontSize:22,fontWeight:700,color:'#8b5cf6'}}>{Math.round(totalTax).toLocaleString()} Ks</div></div>
<div><div style={{fontSize:12,color:'var(--text-2)',marginBottom:4}}>Taxable Invoices</div><div style={{fontSize:22,fontWeight:700,color:'#4F6EF7'}}>{filteredInvoices.filter(i=>Number(i.taxRate||0)>0).length}</div></div>
<div><div style={{fontSize:12,color:'var(--text-2)',marginBottom:4}}>Tax Rate Applied</div><div style={{fontSize:22,fontWeight:700,color:'#d97706'}}>{[...new Set(filteredInvoices.filter(i=>Number(i.taxRate||0)>0).map(i=>i.taxRate+'%'))].join(', ')||'-'}</div></div>
</div>
</div>
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><Receipt size={15}/>Tax Summary by Month</div>
<button type="button" onClick={()=>exportCSV(taxByMonth.map(t=>({Month:t.month,'Taxable Invoices':t.taxableInvoices,'Taxable Amount':t.totalAmount,'Tax Collected':Math.round(t.tax)})),`Tax_${filterYear}.csv`)} className="btn btn-ghost" style={{fontSize:12}}><Download size={14}/>Export CSV</button>
</div>
{taxByMonth.length===0?(
<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>No taxable invoices found</div>
):(
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={th}>Month</th>
<th style={{...th,textAlign:'center'}}>Taxable Invoices</th>
<th style={{...th,textAlign:'right'}}>Taxable Amount (Ks)</th>
<th style={{...th,textAlign:'right'}}>Tax Collected (Ks)</th>
</tr></thead>
<tbody>
{taxByMonth.map(t=>{
const isExpanded=expandedTaxMonth===t.month
const mNum=months[monthNamesFull.indexOf(t.month)]
const mInvs=invoices.filter(i=>getInvDate(i)?.startsWith(`${filterYear}-${mNum}`)&&Number(i.taxRate||0)>0)
return(
<>
<tr key={t.month} onClick={()=>setExpandedTaxMonth(isExpanded?null:t.month)} style={{cursor:'pointer',background:isExpanded?'rgba(139,92,246,0.04)':'white'}}>
<td style={{...td,fontWeight:500}}><span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{fontSize:10,color:'#8b5cf6'}}>{isExpanded?'▼':'▶'}</span>{t.month}</span></td>
<td style={{...td,textAlign:'center'}}>{t.taxableInvoices}</td>
<td style={{...tdR,color:'#4F6EF7'}}>{t.totalAmount.toLocaleString()}</td>
<td style={{...tdR,fontWeight:600,color:'#8b5cf6'}}>{Math.round(t.tax).toLocaleString()}</td>
</tr>
{isExpanded&&(
<tr key={t.month+'_detail'}>
<td colSpan={4} style={{padding:0,background:'#f8fafc'}}>
<div style={{padding:16}}>
<table style={{width:'100%',borderCollapse:'collapse',background:'white',borderRadius:8,overflow:'hidden'}}>
<thead><tr style={{background:'rgba(139,92,246,0.06)'}}>
<th style={{...th,padding:'7px 12px'}}>Invoice</th>
<th style={{...th,padding:'7px 12px'}}>Client</th>
<th style={{...th,padding:'7px 12px',textAlign:'right'}}>Amount</th>
<th style={{...th,padding:'7px 12px',textAlign:'center'}}>Tax Rate</th>
<th style={{...th,padding:'7px 12px',textAlign:'right'}}>Tax Amount</th>
<th style={{...th,padding:'7px 12px',textAlign:'center'}}>Status</th>
</tr></thead>
<tbody>
{mInvs.map(i=>(
<tr key={i.id}>
<td style={{...td,padding:'7px 12px',fontFamily:'monospace',fontSize:11,color:'var(--primary)'}}>{i.invoiceNumber}</td>
<td style={{...td,padding:'7px 12px',fontWeight:500}}>{i.clientName}</td>
<td style={{...td,padding:'7px 12px',textAlign:'right'}}>{Number(i.totalAmount||0).toLocaleString()} Ks</td>
<td style={{...td,padding:'7px 12px',textAlign:'center'}}><span style={{background:'rgba(139,92,246,0.1)',color:'#8b5cf6',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{i.taxRate}%</span></td>
<td style={{...td,padding:'7px 12px',textAlign:'right',fontWeight:600,color:'#8b5cf6'}}>{Math.round(Number(i.totalAmount||0)*(Number(i.taxRate||0)/100)).toLocaleString()} Ks</td>
<td style={{...td,padding:'7px 12px',textAlign:'center'}}><span style={{background:i.status==='paid'?'#eaf3de':'#faeeda',color:i.status==='paid'?'#16a34a':'#d97706',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:500,textTransform:'capitalize'}}>{i.status}</span></td>
</tr>
))}
</tbody>
</table>
</div>
</td>
</tr>
)}
</>
)
})}
</tbody>
<tfoot><tr style={{background:'#f8fafc'}}>
<td style={{...td,fontWeight:700}}>Total</td>
<td style={{...td,textAlign:'center',fontWeight:700}}>{taxByMonth.reduce((s,t)=>s+t.taxableInvoices,0)}</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{taxByMonth.reduce((s,t)=>s+t.totalAmount,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#8b5cf6'}}>{Math.round(taxByMonth.reduce((s,t)=>s+t.tax,0)).toLocaleString()}</td>
</tr></tfoot>
</table>
)}
</div>
</div>
)}

{/* Balance Sheet Tab */}
{activeTab==='balance'&&(()=>{
const totalBankBalance=bankAccounts.reduce((s,a)=>s+Number(a.currentBalance||a.openingBalance||0),0)
const totalReceivable=invoices.filter(i=>i.status==='pending'||i.status==='partial').reduce((s,i)=>s+Number(i.remainingAmount||i.totalAmount||0),0)
const totalPayable=bills.filter(b=>b.status==='unpaid'||b.status==='partial').reduce((s,b)=>s+Number(b.remainingAmount||b.amount||0),0)
const totalAssets=totalBankBalance+totalReceivable
const equity=totalAssets-totalPayable
return(
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',background:'rgba(79,110,247,0.04)'}}>
<div style={{fontWeight:700,fontSize:14,color:'#4F6EF7'}}>Assets</div>
</div>
<div style={{padding:20}}>
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Cash & Bank Accounts</span>
<span style={{fontSize:13,fontWeight:600,color:'#16a34a'}}>{totalBankBalance.toLocaleString()} Ks</span>
</div>
{bankAccounts.map(a=>(
<div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0 6px 16px',borderBottom:'0.5px solid #f8fafc'}}>
<span style={{fontSize:12,color:'var(--text-3)'}}>↳ {a.name}{a.bankName?` (${a.bankName})`:''}</span>
<span style={{fontSize:12,color:'#16a34a'}}>{Number(a.currentBalance||a.openingBalance||0).toLocaleString()} {a.currency||'MMK'}</span>
</div>
))}
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid #f1f5f9',marginTop:4}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Accounts Receivable (Pending Invoices)</span>
<span style={{fontSize:13,fontWeight:600,color:'#d97706'}}>{totalReceivable.toLocaleString()} Ks</span>
</div>
<div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',marginTop:4}}>
<span style={{fontSize:14,fontWeight:700}}>Total Assets</span>
<span style={{fontSize:14,fontWeight:700,color:'#4F6EF7'}}>{totalAssets.toLocaleString()} Ks</span>
</div>
</div>
</div>

<div style={{display:'flex',flexDirection:'column',gap:16}}>
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',background:'rgba(220,38,38,0.04)'}}>
<div style={{fontWeight:700,fontSize:14,color:'#dc2626'}}>Liabilities</div>
</div>
<div style={{padding:20}}>
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Accounts Payable (Unpaid Bills)</span>
<span style={{fontSize:13,fontWeight:600,color:'#dc2626'}}>{totalPayable.toLocaleString()} Ks</span>
</div>
{bills.filter(b=>b.status==='unpaid'||b.status==='partial').map(b=>(
<div key={b.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0 6px 16px',borderBottom:'0.5px solid #f8fafc'}}>
<span style={{fontSize:12,color:'var(--text-3)'}}>↳ {b.title}{b.vendor?` (${b.vendor})`:''}</span>
<span style={{fontSize:12,color:'#dc2626'}}>{Number(b.remainingAmount||b.amount||0).toLocaleString()} Ks</span>
</div>
))}
<div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',marginTop:4}}>
<span style={{fontSize:14,fontWeight:700}}>Total Liabilities</span>
<span style={{fontSize:14,fontWeight:700,color:'#dc2626'}}>{totalPayable.toLocaleString()} Ks</span>
</div>
</div>
</div>
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',background:'rgba(22,163,74,0.04)'}}>
<div style={{fontWeight:700,fontSize:14,color:'#16a34a'}}>Equity</div>
</div>
<div style={{padding:20}}>
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'var(--text-2)'}}>Net Equity (Assets - Liabilities)</span>
<span style={{fontSize:13,fontWeight:600,color:equity>=0?'#16a34a':'#dc2626'}}>{equity.toLocaleString()} Ks</span>
</div>
<div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',marginTop:4}}>
<span style={{fontSize:14,fontWeight:700}}>Total Equity</span>
<span style={{fontSize:14,fontWeight:700,color:equity>=0?'#16a34a':'#dc2626'}}>{equity.toLocaleString()} Ks</span>
</div>
</div>
</div>
</div>

<div className="card" style={{gridColumn:'1/-1',padding:20,background:'rgba(79,110,247,0.04)',border:'0.5px solid rgba(79,110,247,0.2)'}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,flexWrap:'wrap'}}>
<div style={{textAlign:'center'}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Total Assets</div>
<div style={{fontSize:20,fontWeight:700,color:'#4F6EF7'}}>{totalAssets.toLocaleString()} Ks</div>
</div>
<div style={{fontSize:20,color:'var(--text-3)'}}>=</div>
<div style={{textAlign:'center'}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Total Liabilities</div>
<div style={{fontSize:20,fontWeight:700,color:'#dc2626'}}>{totalPayable.toLocaleString()} Ks</div>
</div>
<div style={{fontSize:20,color:'var(--text-3)'}}>+</div>
<div style={{textAlign:'center'}}>
<div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Equity</div>
<div style={{fontSize:20,fontWeight:700,color:equity>=0?'#16a34a':'#dc2626'}}>{equity.toLocaleString()} Ks</div>
</div>
</div>
</div>
</div>
)
})()}

{/* AP/AR Tab */}
{activeTab==='ap'&&(()=>{
const receivables=invoices.filter(i=>i.status==='pending'||i.status==='partial'||i.status==='overdue').map(i=>({
client:i.clientName,invoiceNumber:i.invoiceNumber,
date:getInvDate(i)||'-',
total:Number(i.totalAmount||0),
paid:Number(i.paidAmount||0),
balance:Number(i.remainingAmount||i.totalAmount||0),
status:i.status,
daysOld:i.createdAt?.seconds?Math.floor((Date.now()-i.createdAt.seconds*1000)/(1000*60*60*24)):0,
})).sort((a,b)=>b.balance-a.balance)

const payables=bills.filter(b=>b.status==='unpaid'||b.status==='partial').map(b=>({
vendor:b.vendor||'-',billNumber:b.billNumber,title:b.title,
date:b.billDate||'-',dueDate:b.dueDate||'-',
total:Number(b.amount||0),
paid:Number(b.paidAmount||0),
balance:Number(b.remainingAmount||b.amount||0),
status:b.status,
isOverdue:b.dueDate&&new Date(b.dueDate)<new Date(),
})).sort((a,b)=>b.balance-a.balance)

const totalAR=receivables.reduce((s,r)=>s+r.balance,0)
const overdueAR=receivables.filter(r=>r.daysOld>30).reduce((s,r)=>s+r.balance,0)
const totalAP=payables.reduce((s,p)=>s+p.balance,0)
const overdueAP=payables.filter(p=>p.isOverdue).reduce((s,p)=>s+p.balance,0)

return(
<div>
{/* AR Section */}
<div style={{marginBottom:24}}>
<div style={{fontWeight:700,fontSize:15,color:'#4F6EF7',marginBottom:12}}>Accounts Receivable (AR)</div>
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
{[
{label:'Total Receivable',value:totalAR,color:'#4F6EF7'},
{label:'Overdue (>30 days)',value:overdueAR,color:'#dc2626'},
{label:'Current',value:totalAR-overdueAR,color:'#16a34a'},
].map(({label,value,color})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>{label}</div>
<div style={{fontSize:20,fontWeight:700,color}}>{value.toLocaleString()} Ks</div>
</div>
))}
</div>
<div className="card" style={{overflow:'hidden'}}>
{receivables.length===0?(
<div style={{padding:32,textAlign:'center',color:'var(--text-3)'}}>All invoices paid 🎉</div>
):(
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={th}>Invoice</th><th style={th}>Client</th><th style={th}>Date</th>
<th style={{...th,textAlign:'right'}}>Total</th>
<th style={{...th,textAlign:'right'}}>Paid</th>
<th style={{...th,textAlign:'right'}}>Balance</th>
<th style={{...th,textAlign:'center'}}>Days</th>
<th style={{...th,textAlign:'center'}}>Status</th>
</tr></thead>
<tbody>
{receivables.map((r,i)=>(
<tr key={i} style={{background:r.daysOld>30?'rgba(220,38,38,0.02)':'white'}}>
<td style={{...td,fontFamily:'monospace',fontSize:11,color:'var(--primary)'}}>{r.invoiceNumber}</td>
<td style={{...td,fontWeight:500}}>{r.client}</td>
<td style={{...td,color:'var(--text-3)',fontSize:12}}>{r.date}</td>
<td style={tdR}>{r.total.toLocaleString()} Ks</td>
<td style={{...tdR,color:'#16a34a'}}>{r.paid.toLocaleString()} Ks</td>
<td style={{...tdR,fontWeight:700,color:r.daysOld>30?'#dc2626':'#d97706'}}>{r.balance.toLocaleString()} Ks</td>
<td style={{...td,textAlign:'center'}}><span style={{background:r.daysOld>30?'rgba(220,38,38,0.1)':'rgba(217,119,6,0.1)',color:r.daysOld>30?'#dc2626':'#d97706',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{r.daysOld}d</span></td>
<td style={{...td,textAlign:'center'}}><span style={{background:r.status==='overdue'?'#fcebeb':r.status==='partial'?'#e6f1fb':'#faeeda',color:r.status==='overdue'?'#dc2626':r.status==='partial'?'#2563eb':'#d97706',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,textTransform:'capitalize'}}>{r.status}</span></td>
</tr>
))}
</tbody>
<tfoot><tr style={{background:'#f8fafc'}}>
<td colSpan={5} style={{...td,fontWeight:700}}>Total AR</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{totalAR.toLocaleString()} Ks</td>
<td colSpan={2}/>
</tr></tfoot>
</table>
)}
</div>
</div>

{/* AP Section */}
<div>
<div style={{fontWeight:700,fontSize:15,color:'#dc2626',marginBottom:12}}>Accounts Payable (AP)</div>
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
{[
{label:'Total Payable',value:totalAP,color:'#dc2626'},
{label:'Overdue Bills',value:overdueAP,color:'#7c2d12'},
{label:'Current',value:totalAP-overdueAP,color:'#d97706'},
].map(({label,value,color})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>{label}</div>
<div style={{fontSize:20,fontWeight:700,color}}>{value.toLocaleString()} Ks</div>
</div>
))}
</div>
<div className="card" style={{overflow:'hidden'}}>
{payables.length===0?(
<div style={{padding:32,textAlign:'center',color:'var(--text-3)'}}>No outstanding bills 🎉</div>
):(
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={th}>Bill #</th><th style={th}>Title</th><th style={th}>Vendor</th>
<th style={th}>Bill Date</th><th style={th}>Due Date</th>
<th style={{...th,textAlign:'right'}}>Total</th>
<th style={{...th,textAlign:'right'}}>Paid</th>
<th style={{...th,textAlign:'right'}}>Balance</th>
<th style={{...th,textAlign:'center'}}>Status</th>
</tr></thead>
<tbody>
{payables.map((p,i)=>(
<tr key={i} style={{background:p.isOverdue?'rgba(220,38,38,0.02)':'white'}}>
<td style={{...td,fontFamily:'monospace',fontSize:11,color:'#d97706'}}>{p.billNumber}</td>
<td style={{...td,fontWeight:500}}>{p.title}</td>
<td style={{...td,color:'var(--text-2)',fontSize:12}}>{p.vendor}</td>
<td style={{...td,color:'var(--text-3)',fontSize:12}}>{p.date}</td>
<td style={{...td,fontSize:12,color:p.isOverdue?'#dc2626':'var(--text-3)',fontWeight:p.isOverdue?600:400}}>{p.dueDate}{p.isOverdue&&' ⚠️'}</td>
<td style={tdR}>{p.total.toLocaleString()} Ks</td>
<td style={{...tdR,color:'#16a34a'}}>{p.paid.toLocaleString()} Ks</td>
<td style={{...tdR,fontWeight:700,color:p.isOverdue?'#dc2626':'#d97706'}}>{p.balance.toLocaleString()} Ks</td>
<td style={{...td,textAlign:'center'}}><span style={{background:p.status==='partial'?'#e6f1fb':'#faeeda',color:p.status==='partial'?'#2563eb':'#d97706',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,textTransform:'capitalize'}}>{p.status}</span></td>
</tr>
))}
</tbody>
<tfoot><tr style={{background:'#f8fafc'}}>
<td colSpan={7} style={{...td,fontWeight:700}}>Total AP</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{totalAP.toLocaleString()} Ks</td>
<td/>
</tr></tfoot>
</table>
)}
</div>
</div>
</div>
)
})()}

{/* Journal Tab */}
{activeTab==='journal'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><BookOpen size={15}/>Journal Report</div>
<button type="button" onClick={()=>exportCSV(journalEntries.map(e=>({Date:e.date,Type:e.type,Reference:e.ref,Description:e.description,Debit:e.debit,Credit:e.credit,Status:e.status})),`Journal_${filterYear}.csv`)} className="btn btn-ghost" style={{fontSize:12}}><Download size={14}/>Export CSV</button>
</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={th}>Date</th><th style={th}>Type</th><th style={th}>Reference</th>
<th style={th}>Description</th><th style={{...th,textAlign:'right'}}>Debit (Ks)</th>
<th style={{...th,textAlign:'right'}}>Credit (Ks)</th><th style={{...th,textAlign:'center'}}>Status</th>
</tr></thead>
<tbody>
{journalEntries.length===0?(
<tr><td colSpan={7} style={{...td,textAlign:'center',color:'var(--text-3)',padding:40}}>No entries</td></tr>
):journalEntries.map((e,i)=>(
<tr key={i}>
<td style={{...td,color:'var(--text-3)',whiteSpace:'nowrap'}}>{e.date}</td>
<td style={td}><span style={{background:e.type==='Invoice'?'rgba(79,110,247,0.1)':e.type==='Bill'?'rgba(217,119,6,0.1)':'rgba(220,38,38,0.1)',color:e.type==='Invoice'?'#4F6EF7':e.type==='Bill'?'#d97706':'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{e.type}</span></td>
<td style={{...td,fontFamily:'monospace',fontSize:12}}>{e.ref}</td>
<td style={td}>{e.description}</td>
<td style={{...tdR,color:'#4F6EF7',fontWeight:500}}>{e.debit>0?e.debit.toLocaleString():'-'}</td>
<td style={{...tdR,color:'#dc2626',fontWeight:500}}>{e.credit>0?e.credit.toLocaleString():'-'}</td>
<td style={{...td,textAlign:'center'}}><span style={{background:e.status==='paid'?'#eaf3de':e.status==='pending'?'#faeeda':e.status==='unpaid'?'#faeeda':'#f1f5f9',color:e.status==='paid'?'#16a34a':e.status==='pending'||e.status==='unpaid'?'#d97706':'#64748b',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,textTransform:'capitalize'}}>{e.status}</span></td>
</tr>
))}
</tbody>
{journalEntries.length>0&&(
<tfoot><tr style={{background:'#f8fafc'}}>
<td colSpan={4} style={{...td,fontWeight:700}}>Total</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{journalEntries.reduce((s,e)=>s+e.debit,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{journalEntries.reduce((s,e)=>s+e.credit,0).toLocaleString()}</td>
<td/>
</tr></tfoot>
)}
</table>
</div>
)}

{/* Ledger Tab */}
{activeTab==='ledger'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><TrendingUp size={15}/>Account Ledger</div>
<button type="button" onClick={()=>exportCSV(ledgerByClient.map(c=>({Client:c.name,Invoices:c.invoices,'Total Billed':c.totalBilled,'Total Paid':c.totalPaid,'Balance Due':c.balance})),`Ledger_${filterYear}.csv`)} className="btn btn-ghost" style={{fontSize:12}}><Download size={14}/>Export CSV</button>
</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={th}>Client</th><th style={{...th,textAlign:'center'}}>Invoices</th>
<th style={{...th,textAlign:'right'}}>Total Billed (Ks)</th>
<th style={{...th,textAlign:'right'}}>Total Paid (Ks)</th>
<th style={{...th,textAlign:'right'}}>Balance Due (Ks)</th>
</tr></thead>
<tbody>
{ledgerByClient.length===0?(
<tr><td colSpan={5} style={{...td,textAlign:'center',color:'var(--text-3)',padding:40}}>No data</td></tr>
):ledgerByClient.map(c=>(
<tr key={c.name}>
<td style={{...td,fontWeight:500}}>{c.name}</td>
<td style={{...td,textAlign:'center'}}>{c.invoices}</td>
<td style={{...tdR,color:'#4F6EF7',fontWeight:500}}>{c.totalBilled.toLocaleString()}</td>
<td style={{...tdR,color:'#16a34a',fontWeight:500}}>{c.totalPaid.toLocaleString()}</td>
<td style={{...tdR,fontWeight:600,color:c.balance>0?'#dc2626':'#16a34a'}}>{c.balance.toLocaleString()}</td>
</tr>
))}
</tbody>
{ledgerByClient.length>0&&(
<tfoot><tr style={{background:'#f8fafc'}}>
<td style={{...td,fontWeight:700}}>Total</td>
<td style={{...td,textAlign:'center',fontWeight:700}}>{ledgerByClient.reduce((s,c)=>s+c.invoices,0)}</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{ledgerByClient.reduce((s,c)=>s+c.totalBilled,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#16a34a'}}>{ledgerByClient.reduce((s,c)=>s+c.totalPaid,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{ledgerByClient.reduce((s,c)=>s+c.balance,0).toLocaleString()}</td>
</tr></tfoot>
)}
</table>
</div>
)}

</Layout>
)
}
