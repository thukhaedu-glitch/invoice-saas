import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import Layout from'../components/Layout'
import{Download,FileText,TrendingUp,TrendingDown,BookOpen}from'lucide-react'

const TABS=[
{id:'pnl',label:'Profit & Loss'},
{id:'journal',label:'Journal'},
{id:'ledger',label:'Ledger'},
]

export default function Reports(){
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[expenses,setExpenses]=useState([])
const[loading,setLoading]=useState(true)
const[activeTab,setActiveTab]=useState('pnl')
const[filterYear,setFilterYear]=useState(new Date().getFullYear().toString())
const[filterMonth,setFilterMonth]=useState('')

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[invSnap,expSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'expenses')),
])
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})))
setExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})))
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

const paidInvoices=filteredInvoices.filter(i=>i.status==='paid'||i.status==='partial')
const totalRevenue=paidInvoices.reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const totalExpenses=filteredExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
const netProfit=totalRevenue-totalExpenses

const months=['01','02','03','04','05','06','07','08','09','10','11','12']
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December']

const years=[...new Set([
...invoices.map(i=>getInvDate(i)?.slice(0,4)),
...expenses.map(e=>e.date?.slice(0,4))
].filter(Boolean))].sort().reverse()

// Journal entries — combine invoices + expenses sorted by date
const journalEntries=[
...filteredInvoices.map(i=>({
date:getInvDate(i)||'-',
type:'Invoice',
ref:i.invoiceNumber||'-',
description:`Invoice to ${i.clientName}`,
debit:Number(i.totalAmount||0),
credit:0,
status:i.status,
})),
...filteredExpenses.map(e=>({
date:e.date||'-',
type:'Expense',
ref:e.category||'-',
description:e.title,
debit:0,
credit:Number(e.amount||0),
status:'paid',
})),
].sort((a,b)=>a.date.localeCompare(b.date))

// Ledger by client
const ledgerByClient=[...new Set(filteredInvoices.map(i=>i.clientName))].map(name=>{
const clientInv=filteredInvoices.filter(i=>i.clientName===name)
const totalBilled=clientInv.reduce((s,i)=>s+Number(i.totalAmount||0),0)
const totalPaid=clientInv.reduce((s,i)=>s+Number(i.paidAmount||0),0)
const balance=totalBilled-totalPaid
return{name,invoices:clientInv.length,totalBilled,totalPaid,balance}
}).sort((a,b)=>b.totalBilled-a.totalBilled)

// P&L by month
const pnlMonths=months.map((m,idx)=>{
const mInv=invoices.filter(i=>getInvDate(i)?.startsWith(`${filterYear}-${m}`))
const mExp=expenses.filter(e=>e.date?.startsWith(`${filterYear}-${m}`))
const revenue=mInv.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const expense=mExp.reduce((s,e)=>s+Number(e.amount||0),0)
return{month:monthNames[idx],revenue,expense,profit:revenue-expense}
}).filter(m=>m.revenue>0||m.expense>0)

const exportCSV=(data,filename)=>{
const headers=Object.keys(data[0]||{}).join(',')
const rows=data.map(r=>Object.values(r).map(v=>`"${v}"`).join(',')).join('\n')
const blob=new Blob([headers+'\n'+rows],{type:'text/csv'})
const url=URL.createObjectURL(blob)
const a=document.createElement('a')
a.href=url;a.download=filename;a.click()
URL.revokeObjectURL(url)
}

const exportPnL=()=>exportCSV(pnlMonths.map(m=>({Month:m.month,Revenue:m.revenue,Expenses:m.expense,'Net Profit':m.profit})),`PnL_${filterYear}.csv`)
const exportJournal=()=>exportCSV(journalEntries.map(e=>({Date:e.date,Type:e.type,Reference:e.ref,Description:e.description,Debit:e.debit,Credit:e.credit})),`Journal_${filterYear}.csv`)
const exportLedger=()=>exportCSV(ledgerByClient.map(c=>({Client:c.name,Invoices:c.invoices,'Total Billed':c.totalBilled,'Total Paid':c.totalPaid,'Balance Due':c.balance})),`Ledger_${filterYear}.csv`)

const th={padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}
const td={padding:'10px 14px',fontSize:13,borderBottom:'0.5px solid #f1f5f9',color:'var(--text-1)'}
const tdR={...td,textAlign:'right'}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Reports">

{/* Filters */}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
<div style={{display:'flex',gap:8}}>
<select className="form-input" style={{width:'auto'}} value={filterYear} onChange={e=>{setFilterYear(e.target.value);setFilterMonth('')}}>
{(years.length?years:[new Date().getFullYear().toString()]).map(y=><option key={y} value={y}>{y}</option>)}
</select>
<select className="form-input" style={{width:'auto'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map((m,i)=><option key={m} value={m}>{monthNames[i]}</option>)}
</select>
</div>

{/* Tabs */}
<div style={{display:'flex',gap:4,background:'rgba(255,255,255,0.7)',border:'0.5px solid var(--border)',borderRadius:12,padding:4}}>
{TABS.map(t=>(
<button type="button" key={t.id} onClick={()=>setActiveTab(t.id)} className="btn" style={{
padding:'7px 16px',borderRadius:8,fontSize:13,
background:activeTab===t.id?'var(--primary)':'transparent',
color:activeTab===t.id?'#fff':'var(--text-2)',
}}>
{t.label}
</button>
))}
</div>
</div>

{/* Summary Cards */}
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
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><FileText size={15}/>Profit & Loss — {filterYear}{filterMonth?` / ${monthNames[months.indexOf(filterMonth)]}`:''}</div>
<button type="button" onClick={exportPnL} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={14}/>Export CSV
</button>
</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead>
<tr>
<th style={th}>Month</th>
<th style={{...th,textAlign:'right'}}>Revenue (Ks)</th>
<th style={{...th,textAlign:'right'}}>Expenses (Ks)</th>
<th style={{...th,textAlign:'right'}}>Net Profit (Ks)</th>
</tr>
</thead>
<tbody>
{pnlMonths.length===0?(
<tr><td colSpan={4} style={{...td,textAlign:'center',color:'var(--text-3)',padding:40}}>No data for selected period</td></tr>
):pnlMonths.map(m=>(
<tr key={m.month} style={{background:'white'}}>
<td style={{...td,fontWeight:500}}>{m.month}</td>
<td style={{...tdR,color:'#4F6EF7'}}>{m.revenue.toLocaleString()}</td>
<td style={{...tdR,color:'#dc2626'}}>{m.expense.toLocaleString()}</td>
<td style={{...tdR,fontWeight:600,color:m.profit>=0?'#16a34a':'#dc2626'}}>{m.profit.toLocaleString()}</td>
</tr>
))}
</tbody>
{pnlMonths.length>0&&(
<tfoot>
<tr style={{background:'#f8fafc'}}>
<td style={{...td,fontWeight:700}}>Total</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{pnlMonths.reduce((s,m)=>s+m.revenue,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{pnlMonths.reduce((s,m)=>s+m.expense,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:netProfit>=0?'#16a34a':'#dc2626'}}>{netProfit.toLocaleString()}</td>
</tr>
</tfoot>
)}
</table>
</div>
)}

{/* Journal Tab */}
{activeTab==='journal'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><BookOpen size={15}/>Journal Report</div>
<button type="button" onClick={exportJournal} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={14}/>Export CSV
</button>
</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead>
<tr>
<th style={th}>Date</th>
<th style={th}>Type</th>
<th style={th}>Reference</th>
<th style={th}>Description</th>
<th style={{...th,textAlign:'right'}}>Debit (Ks)</th>
<th style={{...th,textAlign:'right'}}>Credit (Ks)</th>
<th style={{...th,textAlign:'center'}}>Status</th>
</tr>
</thead>
<tbody>
{journalEntries.length===0?(
<tr><td colSpan={7} style={{...td,textAlign:'center',color:'var(--text-3)',padding:40}}>No entries</td></tr>
):journalEntries.map((e,i)=>(
<tr key={i}>
<td style={{...td,color:'var(--text-3)',whiteSpace:'nowrap'}}>{e.date}</td>
<td style={td}>
<span style={{background:e.type==='Invoice'?'rgba(79,110,247,0.1)':'rgba(220,38,38,0.1)',color:e.type==='Invoice'?'#4F6EF7':'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{e.type}</span>
</td>
<td style={{...td,fontFamily:'monospace',fontSize:12}}>{e.ref}</td>
<td style={td}>{e.description}</td>
<td style={{...tdR,color:'#4F6EF7',fontWeight:500}}>{e.debit>0?e.debit.toLocaleString():'-'}</td>
<td style={{...tdR,color:'#dc2626',fontWeight:500}}>{e.credit>0?e.credit.toLocaleString():'-'}</td>
<td style={{...td,textAlign:'center'}}>
<span style={{
background:e.status==='paid'?'#eaf3de':e.status==='pending'?'#faeeda':'#f1f5f9',
color:e.status==='paid'?'#16a34a':e.status==='pending'?'#d97706':'#64748b',
padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,textTransform:'capitalize'
}}>{e.status}</span>
</td>
</tr>
))}
</tbody>
{journalEntries.length>0&&(
<tfoot>
<tr style={{background:'#f8fafc'}}>
<td colSpan={4} style={{...td,fontWeight:700}}>Total</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{journalEntries.reduce((s,e)=>s+e.debit,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{journalEntries.reduce((s,e)=>s+e.credit,0).toLocaleString()}</td>
<td/>
</tr>
</tfoot>
)}
</table>
</div>
)}

{/* Ledger Tab */}
{activeTab==='ledger'&&(
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><TrendingUp size={15}/>Account Ledger — By Client</div>
<button type="button" onClick={exportLedger} className="btn btn-ghost" style={{fontSize:12}}>
<Download size={14}/>Export CSV
</button>
</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead>
<tr>
<th style={th}>Client</th>
<th style={{...th,textAlign:'center'}}>Invoices</th>
<th style={{...th,textAlign:'right'}}>Total Billed (Ks)</th>
<th style={{...th,textAlign:'right'}}>Total Paid (Ks)</th>
<th style={{...th,textAlign:'right'}}>Balance Due (Ks)</th>
</tr>
</thead>
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
<tfoot>
<tr style={{background:'#f8fafc'}}>
<td style={{...td,fontWeight:700}}>Total</td>
<td style={{...td,textAlign:'center',fontWeight:700}}>{ledgerByClient.reduce((s,c)=>s+c.invoices,0)}</td>
<td style={{...tdR,fontWeight:700,color:'#4F6EF7'}}>{ledgerByClient.reduce((s,c)=>s+c.totalBilled,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#16a34a'}}>{ledgerByClient.reduce((s,c)=>s+c.totalPaid,0).toLocaleString()}</td>
<td style={{...tdR,fontWeight:700,color:'#dc2626'}}>{ledgerByClient.reduce((s,c)=>s+c.balance,0).toLocaleString()}</td>
</tr>
</tfoot>
)}
</table>
</div>
)}

</Layout>
)
}
