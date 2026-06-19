import React,{useState,useEffect,useRef}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import Layout from'../components/Layout'
import{Download,FileText,TrendingUp,TrendingDown,BookOpen,Briefcase,Receipt,FileSpreadsheet}from'lucide-react'
import*as XLSX from'xlsx'
import{jsPDF}from'jspdf'
import html2canvas from'html2canvas'

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

function BSRow({label,amount,pct,bold,color,indent,bg,big}){
return(
<div style={{display:'flex',alignItems:'center',padding:big?'12px 16px':'7px 16px',background:bg||'transparent',borderBottom:bg?'none':'1px solid #f1f5f9'}}>
<span style={{flex:1,fontSize:big?14:13,fontWeight:bold?700:400,color:color||'var(--text-1)',paddingLeft:indent?14:0}}>{label}</span>
<span style={{width:100,textAlign:'right',fontSize:big?14:13,fontWeight:bold?700:500,color:color||(amount<0?'#dc2626':'#1e293b')}}>{Math.round(amount).toLocaleString()}</span>
<span style={{width:66,textAlign:'right',fontSize:big?12:11,fontWeight:bold?700:400,color:color||'var(--text-3)'}}>{pct}</span>
</div>
)
}
function BSSubHead({label,color,bg}){
return<div style={{padding:'9px 16px 4px',fontSize:11,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'0.03em',background:bg||'#f8fafc'}}>{label}</div>
}

export default function Reports(){
const[companyId,setCompanyId]=useState(null)
const[invoices,setInvoices]=useState([])
const[expenses,setExpenses]=useState([])
const[projects,setProjects]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[bills,setBills]=useState([])
const[coaAccounts,setCoaAccounts]=useState([])
const[loading,setLoading]=useState(true)
const[activeTab,setActiveTab]=useState('pnl')
const[filterYear,setFilterYear]=useState(new Date().getFullYear().toString())
const[filterMonth,setFilterMonth]=useState('')
const[expandedMonth,setExpandedMonth]=useState(null)
const[expandedTaxMonth,setExpandedTaxMonth]=useState(null)
const[compareMode,setCompareMode]=useState(false)
const[compareYear,setCompareYear]=useState('')
const[companyName,setCompanyName]=useState('')
const pnlRef=useRef(null)
const bsRef=useRef(null)

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
setCompanyName(snap.docs[0].data().companyName||snap.docs[0].data().name||snap.docs[0].data().businessName||'')
const[invSnap,expSnap,prjSnap,baSnap,billSnap,acSnap,jeSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'expenses')),
getDocs(collection(db,'companies',cid,'projects')),
getDocs(collection(db,'companies',cid,'bankAccounts')),
getDocs(collection(db,'companies',cid,'bills')),
getDocs(collection(db,'companies',cid,'accounts')),
getDocs(collection(db,'companies',cid,'journalEntries')),
])
setInvoices(invSnap.docs.map(d=>({id:d.id,...d.data()})))
setExpenses(expSnap.docs.map(d=>({id:d.id,...d.data()})))
setProjects(prjSnap.docs.map(d=>({id:d.id,...d.data()})))
const banks=baSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.isActive!==false)
setBankAccounts(banks)
setBills(billSnap.docs.map(d=>({id:d.id,...d.data()})))
// COA accounts — journal entries နဲ့ balance တွက် + bank accounts merge
const rawAccs=acSnap.docs.map(d=>({id:d.id,...d.data()}))
const jes=jeSnap.docs.map(d=>({id:d.id,...d.data()}))
// bank accounts ကို COA ထဲ merge (accounts ထဲ မရှိသေးတာ)
const existingBankIds=new Set(rawAccs.filter(a=>a.bankAccountId).map(a=>a.bankAccountId))
let maxCode=1003
rawAccs.forEach(a=>{if(a.subType==='Cash & Bank'){const c=parseInt(a.code);if(!isNaN(c)&&c>maxCode)maxCode=c}})
const mergedAccs=[...rawAccs]
banks.forEach(b=>{
if(!existingBankIds.has(b.id)){
maxCode++
mergedAccs.push({
id:'bank_'+b.id,name:b.name,type:'Assets',subType:'Cash & Bank',code:String(maxCode),
openingBalance:Number(b.openingBalance||0),currentBalance:Number(b.currentBalance||b.openingBalance||0),
bankAccountId:b.id,isBankAccount:true,
})
}
})
// journal entries နဲ့ balance recalculate (bank account မဟုတ်တာ)
const NORMAL_DEBIT=['Assets','Expenses']
const withBalance=mergedAccs.map(a=>{
if(a.isBankAccount)return a
let bal=Number(a.openingBalance||0)
jes.forEach(je=>{(je.entries||[]).forEach(line=>{
const matched=line.account?.toLowerCase()===a.name?.toLowerCase()||line.accountName?.toLowerCase()===a.name?.toLowerCase()||line.account===a.code||line.accountId===a.id||(line.account==='Revenue'&&a.name==='Sales Revenue')
if(!matched)return
const amt=Number(line.amount||0)
if(NORMAL_DEBIT.includes(a.type))bal+=line.type==='debit'?amt:-amt
else bal+=line.type==='credit'?amt:-amt
})})
return{...a,currentBalance:bal}
})
setCoaAccounts(withBalance)
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

// ===== Income Statement (P&L) =====
const buildStmt=(yr,mo)=>{
const inP=d=>!!d&&d.startsWith(mo?`${yr}-${mo}`:`${yr}`)
const rev=invoices.filter(i=>inP(getInvDate(i))&&(i.status==='paid'||i.status==='partial')).reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)
const buckets={}
expenses.filter(e=>inP(e.date)).forEach(e=>{const c=(e.category||'Other').trim();buckets[c]=(buckets[c]||0)+Number(e.amount||0)})
bills.filter(b=>inP(b.billDate)&&(b.status==='paid'||b.status==='partial')).forEach(b=>{const c=(b.category||'Other').trim();buckets[c]=(buckets[c]||0)+Number(b.paidAmount||b.amount||0)})
const isCogs=c=>/cogs|cost of goods|goods sold/i.test(c)
const cogs=Object.entries(buckets).filter(([c])=>isCogs(c)).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount)
const opex=Object.entries(buckets).filter(([c])=>!isCogs(c)).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount)
const totalCogs=cogs.reduce((s,x)=>s+x.amount,0)
const totalOpex=opex.reduce((s,x)=>s+x.amount,0)
const gross=rev-totalCogs
const net=gross-totalOpex
return{rev,cogs,opex,totalCogs,totalOpex,gross,net}
}
const stmt=buildStmt(filterYear,filterMonth||null)
const cmp=(compareMode&&compareYear)?buildStmt(compareYear,filterMonth||null):null
const cmpAmt=(group,name)=>{if(!cmp)return null;const f=cmp[group].find(x=>x.name===name);return f?f.amount:0}
const pnlPeriodLabel=filterMonth?`${monthNamesFull[parseInt(filterMonth)-1]} ${filterYear}`:`For the Year ${filterYear}`
const curColLabel=filterMonth?`${monthNames[parseInt(filterMonth)-1]} ${filterYear}`:filterYear
const cmpColLabel=filterMonth?`${monthNames[parseInt(filterMonth)-1]} ${compareYear}`:compareYear
const fileTag=filterMonth?`${filterYear}-${filterMonth}`:filterYear

// statement rows (shared by display + export)
const stmtRows=()=>{
const r=[]
r.push({type:'section',label:'REVENUE'})
r.push({type:'line',label:'Sales Revenue',amt:stmt.rev,camt:cmp?cmp.rev:null})
r.push({type:'total',label:'Total Revenue',amt:stmt.rev,camt:cmp?cmp.rev:null,pos:true})
if(stmt.cogs.length){
r.push({type:'section',label:'COST OF GOODS SOLD'})
stmt.cogs.forEach(c=>r.push({type:'line',label:c.name,amt:c.amount,camt:cmpAmt('cogs',c.name),neg:true}))
r.push({type:'total',label:'Gross Profit',amt:stmt.gross,camt:cmp?cmp.gross:null,pos:true})
}
r.push({type:'section',label:'OPERATING EXPENSES'})
if(!stmt.opex.length)r.push({type:'line',label:'(no expenses)',amt:0,camt:cmp?0:null})
stmt.opex.forEach(c=>r.push({type:'line',label:c.name,amt:c.amount,camt:cmpAmt('opex',c.name),neg:true}))
r.push({type:'total',label:'Total Operating Expenses',amt:stmt.totalOpex,camt:cmp?cmp.totalOpex:null,neg:true})
r.push({type:'net',label:'NET INCOME',amt:stmt.net,camt:cmp?cmp.net:null})
return r
}
const pnlPct=v=>stmt.rev>0?`${(v/stmt.rev*100).toFixed(2)}%`:'-'

const exportPnLExcel=()=>{
const aoa=[]
aoa.push(['Profit & Loss (Income Statement)'])
aoa.push([pnlPeriodLabel])
aoa.push([])
const head=['Particulars',`${curColLabel} (Ks)`]
if(cmp)head.push(`${cmpColLabel} (Ks)`)
head.push('% of Revenue')
aoa.push(head)
stmtRows().forEach(row=>{
if(row.type==='section'){aoa.push([row.label]);return}
const line=[row.label,Math.round(row.amt)]
if(cmp)line.push(row.camt==null?'':Math.round(row.camt))
line.push(stmt.rev>0?`${(row.amt/stmt.rev*100).toFixed(2)}%`:'')
aoa.push(line)
})
aoa.push([])
aoa.push(['All amounts are in Myanmar Kyat (Ks)'])
const ws=XLSX.utils.aoa_to_sheet(aoa)
ws['!cols']=[{wch:32},{wch:18},...(cmp?[{wch:18}]:[]),{wch:14}]
const wb=XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb,ws,'P&L')
XLSX.writeFile(wb,`ProfitLoss_${fileTag}.xlsx`)
}
const exportPnLPDF=async()=>{
if(!pnlRef.current)return
try{
const canvas=await html2canvas(pnlRef.current,{scale:2,backgroundColor:'#ffffff',useCORS:true})
const img=canvas.toDataURL('image/png')
const pdf=new jsPDF('p','mm','a4')
const pw=pdf.internal.pageSize.getWidth()-20
const ph=canvas.height*pw/canvas.width
pdf.addImage(img,'PNG',10,10,pw,ph)
pdf.save(`ProfitLoss_${fileTag}.pdf`)
}catch(e){alert('PDF export failed: '+e.message)}
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
<div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:14}}>
<div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
<label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-2)',cursor:'pointer'}}>
<input type="checkbox" checked={compareMode} onChange={e=>{const on=e.target.checked;setCompareMode(on);if(on&&!compareYear){const py=String(Number(filterYear)-1);setCompareYear(years.includes(py)?py:(years.find(y=>y!==filterYear)||py))}}}/>
Compare with
</label>
{compareMode&&(
<select className="form-input" style={{width:'auto',fontSize:12,padding:'4px 8px'}} value={compareYear} onChange={e=>setCompareYear(e.target.value)}>
{years.filter(y=>y!==filterYear).map(y=><option key={y} value={y}>{y}</option>)}
</select>
)}
<span style={{fontSize:12,color:'var(--text-3)'}}>{filterMonth?'(Monthly)':'(Yearly)'}</span>
</div>
<div style={{display:'flex',gap:8}}>
<button type="button" onClick={exportPnLExcel} className="btn btn-ghost" style={{fontSize:12}}><FileSpreadsheet size={14}/>Excel</button>
<button type="button" onClick={exportPnLPDF} className="btn btn-ghost" style={{fontSize:12}}><Download size={14}/>PDF</button>
</div>
</div>

<div ref={pnlRef} className="card" style={{overflow:'hidden',padding:0}}>
<div style={{padding:'16px 20px 12px'}}>
<div style={{fontSize:16,fontWeight:700,color:'#0f172a'}}>Profit & Loss (Income Statement)</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{pnlPeriodLabel}</div>
</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead>
<tr style={{background:'#0f1f3d'}}>
<th style={{padding:'11px 20px',textAlign:'left',fontSize:12,fontWeight:700,color:'#fff'}}>Particulars</th>
<th style={{padding:'11px 20px',textAlign:'right',fontSize:11,fontWeight:700,color:'#fff',whiteSpace:'nowrap'}}>{curColLabel} (Ks)</th>
{cmp&&<th style={{padding:'11px 20px',textAlign:'right',fontSize:11,fontWeight:700,color:'#cbd5e1',whiteSpace:'nowrap'}}>{cmpColLabel} (Ks)</th>}
<th style={{padding:'11px 20px',textAlign:'right',fontSize:11,fontWeight:700,color:'#fff',whiteSpace:'nowrap'}}>% of Revenue</th>
</tr>
</thead>
<tbody>
{stmtRows().map((row,idx)=>{
const cols=cmp?4:3
if(row.type==='section')return(
<tr key={idx}><td colSpan={cols} style={{padding:'13px 20px 4px',fontSize:12,fontWeight:700,color:'#1d4ed8',textTransform:'uppercase',letterSpacing:'0.03em'}}>{row.label}</td></tr>
)
if(row.type==='net')return(
<tr key={idx} style={{background:'#15803d'}}>
<td style={{padding:'14px 20px',fontSize:14,fontWeight:700,color:'#fff'}}>{row.label}</td>
<td style={{padding:'14px 20px',textAlign:'right',fontSize:14,fontWeight:700,color:'#fff'}}>{Math.round(row.amt).toLocaleString()} Ks</td>
{cmp&&<td style={{padding:'14px 20px',textAlign:'right',fontSize:14,fontWeight:700,color:'#dcfce7'}}>{Math.round(row.camt).toLocaleString()} Ks</td>}
<td style={{padding:'14px 20px',textAlign:'right',fontSize:13,fontWeight:700,color:'#fff'}}>{pnlPct(row.amt)}</td>
</tr>
)
const isTotal=row.type==='total'
const color=isTotal?(row.pos?'#16a34a':'#dc2626'):(row.neg?'#dc2626':'#1e293b')
const bg=isTotal?(row.pos?'rgba(22,163,74,0.07)':'rgba(220,38,38,0.06)'):'transparent'
return(
<tr key={idx} style={{background:bg,borderTop:isTotal?'1px solid #e9eef5':'none'}}>
<td style={{padding:isTotal?'10px 20px':'8px 20px 8px 34px',fontSize:13,fontWeight:isTotal?700:400,color:isTotal?color:'var(--text-1)'}}>{row.label}</td>
<td style={{padding:isTotal?'10px 20px':'8px 20px',textAlign:'right',fontSize:13,fontWeight:isTotal?700:500,color}}>{Math.round(row.amt).toLocaleString()}</td>
{cmp&&<td style={{padding:isTotal?'10px 20px':'8px 20px',textAlign:'right',fontSize:13,fontWeight:isTotal?700:400,color:'var(--text-3)'}}>{row.camt==null?'-':Math.round(row.camt).toLocaleString()}</td>}
<td style={{padding:isTotal?'10px 20px':'8px 20px',textAlign:'right',fontSize:12,color:'var(--text-3)'}}>{pnlPct(row.amt)}</td>
</tr>
)
})}
</tbody>
</table>
<div style={{padding:'10px 20px',fontSize:11,color:'var(--text-3)',fontStyle:'italic'}}>All amounts are in Myanmar Kyat (Ks)</div>
</div>
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
const hasCOA=coaAccounts.length>0
const num=a=>Number(a.currentBalance||a.openingBalance||0)
const totalBankBalance=bankAccounts.reduce((s,a)=>s+num(a),0)
const totalReceivable=invoices.filter(i=>i.status==='pending'||i.status==='partial').reduce((s,i)=>s+Number(i.remainingAmount||i.totalAmount||0),0)
const totalPayable=bills.filter(b=>b.status==='unpaid'||b.status==='partial').reduce((s,b)=>s+Number(b.remainingAmount||b.amount||0),0)
const coaNonBankAssets=coaAccounts.filter(a=>a.type==='Assets'&&!a.bankAccountId).reduce((s,a)=>s+num(a),0)
const totalAssets=hasCOA?coaNonBankAssets+totalBankBalance+totalReceivable:totalBankBalance+totalReceivable
const coaLiabilities=coaAccounts.filter(a=>a.type==='Liabilities').reduce((s,a)=>s+num(a),0)
const totalLiabilities=hasCOA?coaLiabilities+totalPayable:totalPayable
const totalEquity=coaAccounts.filter(a=>a.type==='Equity').reduce((s,a)=>s+num(a),0)
const bsNetProfit=invoices.filter(i=>i.status==='paid'||i.status==='partial').reduce((s,i)=>s+Number(i.paidAmount||i.totalAmount||0),0)-expenses.reduce((s,e)=>s+Number(e.amount||0),0)-bills.filter(b=>b.status==='paid'||b.status==='partial').reduce((s,b)=>s+Number(b.paidAmount||b.amount||0),0)
const totalEquityAndProfit=totalEquity+bsNetProfit
const totalLE=totalLiabilities+totalEquityAndProfit
const isBalanced=Math.abs(totalAssets-totalLE)<1
const byCode=(a,b)=>(a.code||'').localeCompare(b.code||'')
const ncA=(n,s)=>/equipment|vehicle|machinery|building|property|fixed|deprecia|long.?term|non.?current/i.test(`${n} ${s||''}`)
const ncL=(n,s)=>/long.?term|non.?current|mortgage/i.test(`${n} ${s||''}`)
const assetItems=[...coaAccounts.filter(a=>a.type==='Assets'&&!a.bankAccountId&&!/receivable/i.test(a.name||'')).sort(byCode).map(a=>({name:a.name,amount:num(a),sub:a.subType})),...bankAccounts.map(a=>({name:a.name+(a.bankName?` (${a.bankName})`:''),amount:num(a),sub:'Cash & Bank'})),...(totalReceivable>0?[{name:'Accounts Receivable',amount:totalReceivable,sub:'Accounts Receivable'}]:[])]
const liabItems=[...coaAccounts.filter(a=>a.type==='Liabilities').sort(byCode).map(a=>({name:a.name,amount:num(a),sub:a.subType})),...(totalPayable>0?[{name:'Accounts Payable (Unpaid Bills)',amount:totalPayable,sub:'Accounts Payable'}]:[])]
const equityItems=[...coaAccounts.filter(a=>a.type==='Equity').sort(byCode).map(a=>({name:a.name,amount:num(a),sub:a.subType})),{name:'Retained Earnings (Net Profit)',amount:bsNetProfit,sub:'Equity'}]
const curA=assetItems.filter(x=>!ncA(x.name,x.sub)),ncAItems=assetItems.filter(x=>ncA(x.name,x.sub))
const curL=liabItems.filter(x=>!ncL(x.name,x.sub)),ncLItems=liabItems.filter(x=>ncL(x.name,x.sub))
const sum=arr=>arr.reduce((s,x)=>s+x.amount,0)
const pctA=v=>totalAssets?`${(v/totalAssets*100).toFixed(2)}%`:'-'
const asAt=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
const exportBSExcel=()=>{
const aoa=[['Balance Sheet (Statement of Financial Position)'],['As at '+asAt],[],['ASSETS','Amount (Ks)','% of Total Assets']]
const grp=(items,head,subTot)=>{if(!items.length)return;aoa.push([head]);items.forEach(x=>aoa.push(['  '+x.name,Math.round(x.amount),pctA(x.amount)]));aoa.push([subTot,Math.round(sum(items)),pctA(sum(items))])}
grp(curA,'CURRENT ASSETS','Total Current Assets')
grp(ncAItems,'NON-CURRENT ASSETS','Total Non-Current Assets')
aoa.push(['TOTAL ASSETS',Math.round(totalAssets),'100.00%'],[])
aoa.push(['LIABILITIES & EQUITY','Amount (Ks)','% of Total Assets'])
grp(curL,'CURRENT LIABILITIES','Total Current Liabilities')
grp(ncLItems,'NON-CURRENT LIABILITIES','Total Non-Current Liabilities')
aoa.push(['TOTAL LIABILITIES',Math.round(totalLiabilities),pctA(totalLiabilities)],['EQUITY'])
equityItems.forEach(x=>aoa.push(['  '+x.name,Math.round(x.amount),pctA(x.amount)]))
aoa.push(['TOTAL EQUITY',Math.round(totalEquityAndProfit),pctA(totalEquityAndProfit)])
aoa.push(['TOTAL LIABILITIES & EQUITY',Math.round(totalLE),pctA(totalLE)])
const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=[{wch:36},{wch:16},{wch:16}]
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Balance Sheet');XLSX.writeFile(wb,`BalanceSheet_${filterYear}.xlsx`)
}
const exportBSPDF=async()=>{if(!bsRef.current)return;try{const c=await html2canvas(bsRef.current,{scale:2,backgroundColor:'#ffffff',useCORS:true});const img=c.toDataURL('image/png');const pdf=new jsPDF('l','mm','a4');const pw=pdf.internal.pageSize.getWidth()-20;const ph=c.height*pw/c.width;pdf.addImage(img,'PNG',10,10,pw,ph);pdf.save(`BalanceSheet_${filterYear}.pdf`)}catch(e){alert('PDF failed: '+e.message)}}
return(
<div>
<div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:14}}>
<button type="button" onClick={exportBSExcel} className="btn btn-ghost" style={{fontSize:12}}><FileSpreadsheet size={14}/>Excel</button>
<button type="button" onClick={exportBSPDF} className="btn btn-ghost" style={{fontSize:12}}><Download size={14}/>PDF</button>
</div>
<div ref={bsRef} className="card" style={{padding:'22px 22px 16px'}}>
<div style={{textAlign:'center',marginBottom:18}}>
{companyName&&<div style={{fontSize:17,fontWeight:700,color:'#0f172a'}}>{companyName}</div>}
<div style={{fontSize:13,color:'var(--text-2)'}}>Balance Sheet (Statement of Financial Position)</div>
<div style={{fontSize:12,fontWeight:600,color:'#2563eb',marginTop:2}}>As at {asAt}</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}} className="form-grid-2">
<div style={{border:'1px solid #e9eef5',borderRadius:8,overflow:'hidden'}}>
<div style={{display:'flex',alignItems:'center',gap:8,background:'#eff4ff',borderTop:'3px solid #2563eb',padding:'11px 16px'}}>
<Briefcase size={16} style={{color:'#2563eb'}}/>
<span style={{fontWeight:700,fontSize:14,color:'#1e3a8a',flex:1}}>ASSETS</span>
<span style={{width:100,textAlign:'right',fontSize:10,fontWeight:700,color:'#2563eb'}}>Amount (Ks)</span>
<span style={{width:66,textAlign:'right',fontSize:10,fontWeight:700,color:'#2563eb'}}>% of Total</span>
</div>
{curA.length>0&&<><BSSubHead label="Current Assets" color="#2563eb"/>{curA.map((x,i)=><BSRow key={'ca'+i} label={x.name} amount={x.amount} pct={pctA(x.amount)} indent/>)}<BSRow label="Total Current Assets" amount={sum(curA)} pct={pctA(sum(curA))} bold color="#2563eb" bg="#eff4ff"/></>}
{ncAItems.length>0&&<><BSSubHead label="Non-Current Assets" color="#2563eb"/>{ncAItems.map((x,i)=><BSRow key={'nca'+i} label={x.name} amount={x.amount} pct={pctA(x.amount)} indent/>)}<BSRow label="Total Non-Current Assets" amount={sum(ncAItems)} pct={pctA(sum(ncAItems))} bold color="#2563eb" bg="#eff4ff"/></>}
<div style={{display:'flex',alignItems:'center',padding:'13px 16px',background:'#1e40af'}}>
<span style={{flex:1,fontSize:14,fontWeight:700,color:'#fff'}}>TOTAL ASSETS</span>
<span style={{width:100,textAlign:'right',fontSize:14,fontWeight:700,color:'#fff'}}>{Math.round(totalAssets).toLocaleString()}</span>
<span style={{width:66,textAlign:'right',fontSize:12,fontWeight:700,color:'#fff'}}>100.00%</span>
</div>
</div>
<div style={{border:'1px solid #e9eef5',borderRadius:8,overflow:'hidden'}}>
<div style={{display:'flex',alignItems:'center',gap:8,background:'#fef2f2',borderTop:'3px solid #dc2626',padding:'11px 16px'}}>
<Receipt size={16} style={{color:'#dc2626'}}/>
<span style={{fontWeight:700,fontSize:14,color:'#991b1b',flex:1}}>LIABILITIES & EQUITY</span>
<span style={{width:100,textAlign:'right',fontSize:10,fontWeight:700,color:'#dc2626'}}>Amount (Ks)</span>
<span style={{width:66,textAlign:'right',fontSize:10,fontWeight:700,color:'#dc2626'}}>% of Total</span>
</div>
{curL.length>0&&<><BSSubHead label="Current Liabilities" color="#dc2626" bg="#fef2f2"/>{curL.map((x,i)=><BSRow key={'cl'+i} label={x.name} amount={x.amount} pct={pctA(x.amount)} indent/>)}<BSRow label="Total Current Liabilities" amount={sum(curL)} pct={pctA(sum(curL))} bold color="#dc2626" bg="#fef2f2"/></>}
{ncLItems.length>0&&<><BSSubHead label="Non-Current Liabilities" color="#dc2626" bg="#fef2f2"/>{ncLItems.map((x,i)=><BSRow key={'ncl'+i} label={x.name} amount={x.amount} pct={pctA(x.amount)} indent/>)}<BSRow label="Total Non-Current Liabilities" amount={sum(ncLItems)} pct={pctA(sum(ncLItems))} bold color="#dc2626" bg="#fef2f2"/></>}
<BSRow label="TOTAL LIABILITIES" amount={totalLiabilities} pct={pctA(totalLiabilities)} bold color="#dc2626" bg="#fde8e8"/>
<BSSubHead label="Equity" color="#16a34a" bg="#f0fdf4"/>
{equityItems.map((x,i)=><BSRow key={'eq'+i} label={x.name} amount={x.amount} pct={pctA(x.amount)} indent/>)}
<BSRow label="Total Equity" amount={totalEquityAndProfit} pct={pctA(totalEquityAndProfit)} bold color="#16a34a" bg="#f0fdf4"/>
<div style={{display:'flex',alignItems:'center',padding:'13px 16px',background:'#1e40af'}}>
<span style={{flex:1,fontSize:14,fontWeight:700,color:'#fff'}}>TOTAL LIABILITIES & EQUITY</span>
<span style={{width:100,textAlign:'right',fontSize:14,fontWeight:700,color:'#fff'}}>{Math.round(totalLE).toLocaleString()}</span>
<span style={{width:66,textAlign:'right',fontSize:12,fontWeight:700,color:'#fff'}}>{pctA(totalLE)}</span>
</div>
</div>
</div>
<div style={{marginTop:16,padding:'14px 16px',borderRadius:8,background:isBalanced?'#f0fdf4':'#fef2f2',border:`1px solid ${isBalanced?'#bbf7d0':'#fecaca'}`,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<span style={{width:26,height:26,borderRadius:'50%',background:isBalanced?'#16a34a':'#dc2626',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{isBalanced?'✓':'✗'}</span>
<div><div style={{fontSize:12,fontWeight:700,color:'#0f172a'}}>Balance Verification</div><div style={{fontSize:11,color:'var(--text-3)'}}>Total Assets = Total Liabilities + Total Equity</div></div>
</div>
<div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
<div style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--text-3)'}}>TOTAL ASSETS</div><div style={{fontSize:13,fontWeight:700,color:'#2563eb'}}>{Math.round(totalAssets).toLocaleString()} Ks</div></div>
<span style={{fontWeight:700,color:'var(--text-3)'}}>=</span>
<div style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--text-3)'}}>TOTAL LIABILITIES</div><div style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>{Math.round(totalLiabilities).toLocaleString()} Ks</div></div>
<span style={{fontWeight:700,color:'var(--text-3)'}}>+</span>
<div style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--text-3)'}}>TOTAL EQUITY</div><div style={{fontSize:13,fontWeight:700,color:'#16a34a'}}>{Math.round(totalEquityAndProfit).toLocaleString()} Ks</div></div>
</div>
</div>
{!isBalanced&&<div style={{marginTop:8,fontSize:11,color:'#b45309',fontStyle:'italic'}}>Difference: {Math.round(totalAssets-totalLE).toLocaleString()} Ks — books not fully balanced (asset-side entries may be missing).</div>}
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
<td style={{...td,textAlign:'center'}}><span style={{background:e.status==='paid'?'#eaf3de':e.status==='pending'||e.status==='unpaid'?'#faeeda':'#f1f5f9',color:e.status==='paid'?'#16a34a':e.status==='pending'||e.status==='unpaid'?'#d97706':'#64748b',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,textTransform:'capitalize'}}>{e.status}</span></td>
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
