import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,addDoc,deleteDoc,doc,serverTimestamp,onSnapshot}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,X,Save,BookOpen,Search,ChevronDown,ChevronUp,AlertCircle,CheckCircle}from'lucide-react'

const ACCOUNT_TYPES=[
'Cash','Bank','Accounts Receivable','Accounts Payable',
'Revenue','Expense','Equity','Inventory','Fixed Assets','Other'
]

export default function JournalEntries(){
const[companyId,setCompanyId]=useState(null)
const[entries,setEntries]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[filterMonth,setFilterMonth]=useState('')
const[modal,setModal]=useState(false)
const[saving,setSaving]=useState(false)
const[expandedId,setExpandedId]=useState(null)
const[form,setForm]=useState({
date:new Date().toISOString().split('T')[0],
description:'',
ref:'',
lines:[
{account:'',type:'debit',amount:''},
{account:'',type:'credit',amount:''},
]
})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const baSnap=await getDocs(collection(db,'companies',cid,'bankAccounts'))
setBankAccounts(baSnap.docs.map(d=>({id:d.id,...d.data()})))
const u=onSnapshot(collection(db,'companies',cid,'journalEntries'),snap=>{
setEntries(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')))
setLoading(false)
})
return u
}
setLoading(false)
}
load()
},[])

const openAdd=()=>{
setForm({
date:new Date().toISOString().split('T')[0],
description:'',ref:'',
lines:[
{account:'',type:'debit',amount:''},
{account:'',type:'credit',amount:''},
]
})
setModal(true)
}

const addLine=()=>setForm(f=>({...f,lines:[...f.lines,{account:'',type:'debit',amount:''}]}))
const removeLine=(i)=>setForm(f=>({...f,lines:f.lines.filter((_,idx)=>idx!==i)}))
const updateLine=(i,field,value)=>setForm(f=>({
...f,lines:f.lines.map((l,idx)=>idx===i?{...l,[field]:value}:l)
}))

const totalDebit=form.lines.filter(l=>l.type==='debit').reduce((s,l)=>s+Number(l.amount||0),0)
const totalCredit=form.lines.filter(l=>l.type==='credit').reduce((s,l)=>s+Number(l.amount||0),0)
const isBalanced=Math.abs(totalDebit-totalCredit)<0.01&&totalDebit>0

const handleSave=async()=>{
if(!form.description){alert('Description required');return}
if(!isBalanced){alert(`Journal must balance — Debit: ${totalDebit.toLocaleString()}, Credit: ${totalCredit.toLocaleString()}`);return}
if(form.lines.some(l=>!l.account||!l.amount)){alert('All lines must have account and amount');return}
setSaving(true)
try{
await addDoc(collection(db,'companies',companyId,'journalEntries'),{
date:form.date,
description:form.description,
ref:form.ref||'JE-'+Date.now().toString().slice(-6),
entries:form.lines.map(l=>({
account:l.account,
type:l.type,
amount:Number(l.amount),
})),
totalAmount:totalDebit,
source:'manual',
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
setModal(false)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this journal entry?'))return
await deleteDoc(doc(db,'companies',companyId,'journalEntries',id))
}

const months=[...new Set(entries.map(e=>e.date?.slice(0,7)).filter(Boolean))].sort().reverse()

const filtered=entries.filter(e=>{
const matchSearch=e.description?.toLowerCase().includes(search.toLowerCase())||e.ref?.toLowerCase().includes(search.toLowerCase())
const matchMonth=filterMonth?e.date?.startsWith(filterMonth):true
return matchSearch&&matchMonth
})

const totalDebits=filtered.reduce((s,e)=>{
const d=e.entries||[]
return s+d.filter(l=>l.type==='debit').reduce((ss,l)=>ss+Number(l.amount||0),0)
},0)

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Journal Entries">

{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'white',zIndex:1}}>
<div style={{fontWeight:600,fontSize:15}}>New Journal Entry</div>
<button type="button" onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Date *</label>
<input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Reference</label>
<input className="form-input" value={form.ref} onChange={e=>setForm(f=>({...f,ref:e.target.value}))} placeholder="JE-001..."/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Description *</label>
<input className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Record depreciation expense..."/>
</div>
</div>

{/* Lines */}
<div style={{marginBottom:12}}>
<div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:8,marginBottom:8}}>
<div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Account</div>
<div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Type</div>
<div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',textAlign:'right'}}>Amount</div>
<div/>
</div>
{form.lines.map((line,i)=>(
<div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:8,marginBottom:8,alignItems:'center'}}>
<select className="form-input" value={line.account} onChange={e=>updateLine(i,'account',e.target.value)} style={{fontSize:12}}>
<option value="">— Select Account —</option>
<optgroup label="Bank Accounts">
{bankAccounts.map(a=><option key={a.id} value={a.name}>{a.name}{a.bankName?` (${a.bankName})`:''}</option>)}
</optgroup>
<optgroup label="Standard Accounts">
{ACCOUNT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
</optgroup>
</select>
<select className="form-input" value={line.type} onChange={e=>updateLine(i,'type',e.target.value)} style={{fontSize:12}}>
<option value="debit">Debit</option>
<option value="credit">Credit</option>
</select>
<input className="form-input" type="number" value={line.amount} onChange={e=>updateLine(i,'amount',e.target.value)} placeholder="0" style={{textAlign:'right',fontSize:12}}/>
<button type="button" onClick={()=>removeLine(i)} disabled={form.lines.length<=2} style={{background:'none',border:'none',cursor:form.lines.length<=2?'not-allowed':'pointer',color:'#dc2626',padding:4,borderRadius:4,opacity:form.lines.length<=2?0.3:1}}>
<X size={14}/>
</button>
</div>
))}
<button type="button" onClick={addLine} className="btn btn-ghost" style={{fontSize:12,marginTop:4}}>
<Plus size={13}/>Add Line
</button>
</div>

{/* Balance Check */}
<div style={{
padding:12,borderRadius:8,marginBottom:16,
background:isBalanced?'rgba(22,163,74,0.08)':'rgba(220,38,38,0.08)',
border:`0.5px solid ${isBalanced?'rgba(22,163,74,0.2)':'rgba(220,38,38,0.2)'}`
}}>
<div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
<span style={{fontSize:12,color:'var(--text-2)'}}>Total Debit</span>
<span style={{fontSize:12,fontWeight:600,color:'#4F6EF7'}}>{totalDebit.toLocaleString()} Ks</span>
</div>
<div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
<span style={{fontSize:12,color:'var(--text-2)'}}>Total Credit</span>
<span style={{fontSize:12,fontWeight:600,color:'#dc2626'}}>{totalCredit.toLocaleString()} Ks</span>
</div>
<div style={{display:'flex',alignItems:'center',gap:6}}>
{isBalanced
?<><CheckCircle size={14} color="#16a34a"/><span style={{fontSize:12,color:'#16a34a',fontWeight:500}}>Balanced ✓</span></>
:<><AlertCircle size={14} color="#dc2626"/><span style={{fontSize:12,color:'#dc2626',fontWeight:500}}>Not balanced — difference: {Math.abs(totalDebit-totalCredit).toLocaleString()} Ks</span></>}
</div>
</div>

<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setModal(false)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSave} disabled={saving||!isBalanced} className="btn btn-primary" style={{opacity:!isBalanced?0.5:1}}>
<Save size={14}/>{saving?'Saving...':'Post Entry'}
</button>
</div>
</div>
</div>
</div>
)}

{/* Header */}
<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16,justifyContent:'space-between'}}>
<div style={{display:'flex',gap:8,flex:1}}>
<div style={{position:'relative'}}>
<Search size={12} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{paddingLeft:26,fontSize:12,padding:'6px 8px 6px 26px',width:160}}/>
</div>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map(m=><option key={m} value={m}>{m}</option>)}
</select>
</div>
<button type="button" onClick={openAdd} className="btn btn-primary"><Plus size={15}/>New Entry</button>
</div>

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
{[
{label:'Total Entries',value:filtered.length,color:'#4F6EF7'},
{label:'Manual Entries',value:filtered.filter(e=>e.source==='manual').length,color:'#8b5cf6'},
{label:'Total Debits',value:`${totalDebits.toLocaleString()} Ks`,color:'#16a34a'},
].map(({label,value,color})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>{label}</div>
<div style={{fontSize:16,fontWeight:700,color}}>{value}</div>
</div>
))}
</div>

{/* Entries List */}
<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<BookOpen size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No journal entries yet</div>
</div>
):(
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Date</th>
<th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Reference</th>
<th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Description</th>
<th style={{padding:'10px 14px',textAlign:'center',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Source</th>
<th style={{padding:'10px 14px',textAlign:'right',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Amount</th>
<th style={{padding:'10px 14px',textAlign:'center',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Actions</th>
</tr></thead>
<tbody>
{filtered.map(e=>{
const isExpanded=expandedId===e.id
const lines=e.entries||[]
const totalDr=lines.filter(l=>l.type==='debit').reduce((s,l)=>s+Number(l.amount||0),0)
return(
<>
<tr key={e.id} style={{cursor:'pointer',background:isExpanded?'rgba(79,110,247,0.03)':'white'}} onClick={()=>setExpandedId(isExpanded?null:e.id)}>
<td style={{padding:'10px 14px',fontSize:12,color:'var(--text-3)',whiteSpace:'nowrap'}}>{e.date||'-'}</td>
<td style={{padding:'10px 14px',fontSize:12,fontFamily:'monospace',color:'var(--primary)'}}>{e.ref||'-'}</td>
<td style={{padding:'10px 14px',fontSize:13,fontWeight:500}}>{e.description}</td>
<td style={{padding:'10px 14px',textAlign:'center'}}>
<span style={{
background:e.source==='manual'?'rgba(139,92,246,0.1)':e.source==='INV'?'rgba(79,110,247,0.1)':e.source==='EXP'?'rgba(220,38,38,0.1)':'rgba(217,119,6,0.1)',
color:e.source==='manual'?'#8b5cf6':e.source==='INV'?'#4F6EF7':e.source==='EXP'?'#dc2626':'#d97706',
padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500
}}>{e.source==='manual'?'Manual':e.source||'Auto'}</span>
</td>
<td style={{padding:'10px 14px',textAlign:'right',fontWeight:500,fontSize:13}}>{totalDr.toLocaleString()} Ks</td>
<td style={{padding:'10px 14px',textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button type="button" onClick={e2=>{e2.stopPropagation();setExpandedId(isExpanded?null:e.id)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:4}}>
{isExpanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
</button>
{e.source==='manual'&&(
<button type="button" onClick={e2=>{e2.stopPropagation();handleDelete(e.id)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:4}}>
<Trash2 size={14}/>
</button>
)}
</div>
</td>
</tr>
{isExpanded&&(
<tr key={e.id+'_detail'}>
<td colSpan={6} style={{padding:0,background:'#f8fafc'}}>
<div style={{padding:16}}>
<table style={{width:'100%',borderCollapse:'collapse',background:'white',borderRadius:8,overflow:'hidden'}}>
<thead><tr style={{background:'rgba(79,110,247,0.06)'}}>
<th style={{padding:'7px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Account</th>
<th style={{padding:'7px 12px',textAlign:'center',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Type</th>
<th style={{padding:'7px 12px',textAlign:'right',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Debit</th>
<th style={{padding:'7px 12px',textAlign:'right',fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase'}}>Credit</th>
</tr></thead>
<tbody>
{lines.map((l,i)=>(
<tr key={i}>
<td style={{padding:'7px 12px',fontSize:13,fontWeight:500}}>{l.account||l.accountName||'-'}</td>
<td style={{padding:'7px 12px',textAlign:'center'}}>
<span style={{background:l.type==='debit'?'rgba(79,110,247,0.1)':'rgba(220,38,38,0.1)',color:l.type==='debit'?'#4F6EF7':'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500,textTransform:'capitalize'}}>{l.type}</span>
</td>
<td style={{padding:'7px 12px',textAlign:'right',color:'#4F6EF7',fontWeight:500,fontSize:13}}>{l.type==='debit'?Number(l.amount||0).toLocaleString()+' Ks':'-'}</td>
<td style={{padding:'7px 12px',textAlign:'right',color:'#dc2626',fontWeight:500,fontSize:13}}>{l.type==='credit'?Number(l.amount||0).toLocaleString()+' Ks':'-'}</td>
</tr>
))}
</tbody>
<tfoot><tr style={{background:'rgba(79,110,247,0.04)'}}>
<td colSpan={2} style={{padding:'7px 12px',fontWeight:700,fontSize:12}}>Total</td>
<td style={{padding:'7px 12px',textAlign:'right',fontWeight:700,color:'#4F6EF7',fontSize:12}}>{lines.filter(l=>l.type==='debit').reduce((s,l)=>s+Number(l.amount||0),0).toLocaleString()} Ks</td>
<td style={{padding:'7px 12px',textAlign:'right',fontWeight:700,color:'#dc2626',fontSize:12}}>{lines.filter(l=>l.type==='credit').reduce((s,l)=>s+Number(l.amount||0),0).toLocaleString()} Ks</td>
</tr></tfoot>
</table>
</div>
</td>
</tr>
)}
</>
)
})}
</tbody>
</table>
)}
</div>
</Layout>
)
}
