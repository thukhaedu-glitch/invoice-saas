import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,getDoc,addDoc,updateDoc,serverTimestamp}from'firebase/firestore'
import Layout from'../components/Layout'
import{ArrowLeft,CheckCircle,XCircle,AlertCircle,GitCompare,Save}from'lucide-react'
import{useNavigate,useParams}from'react-router-dom'

export default function Reconcile(){
const{accountId}=useParams()
const navigate=useNavigate()
const[companyId,setCompanyId]=useState(null)
const[account,setAccount]=useState(null)
const[transactions,setTransactions]=useState([])
const[checkedIds,setCheckedIds]=useState(new Set())
const[statementBalance,setStatementBalance]=useState('')
const[statementDate,setStatementDate]=useState(new Date().toISOString().split('T')[0])
const[loading,setLoading]=useState(true)
const[saving,setSaving]=useState(false)
const[pastReconciliations,setPastReconciliations]=useState([])
const[showHistory,setShowHistory]=useState(false)

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[acSnap,txSnap,recSnap]=await Promise.all([
getDoc(doc(db,'companies',cid,'bankAccounts',accountId)),
getDocs(collection(db,'companies',cid,'bankAccounts',accountId,'transactions')),
getDocs(collection(db,'companies',cid,'bankAccounts',accountId,'reconciliations')),
])
if(acSnap.exists())setAccount({id:acSnap.id,...acSnap.data()})
setTransactions(txSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')))
setPastReconciliations(recSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')))
}
setLoading(false)
}
load()
},[accountId])

const toggle=(id)=>{
setCheckedIds(prev=>{
const next=new Set(prev)
next.has(id)?next.delete(id):next.add(id)
return next
})
}

const toggleAll=()=>{
if(checkedIds.size===transactions.length)setCheckedIds(new Set())
else setCheckedIds(new Set(transactions.map(t=>t.id)))
}

const clearedBalance=transactions
.filter(t=>checkedIds.has(t.id))
.reduce((s,t)=>t.type==='in'?s+Number(t.amount||0):s-Number(t.amount||0),0)

const systemBalance=Number(account?.currentBalance||account?.openingBalance||0)
const stmtBal=Number(statementBalance||0)
const difference=stmtBal-systemBalance

const isReconciled=Math.abs(difference)<1

const handleSave=async()=>{
if(!statementBalance){alert('Enter statement balance');return}
setSaving(true)
try{
await addDoc(collection(db,'companies',companyId,'bankAccounts',accountId,'reconciliations'),{
date:statementDate,
statementBalance:stmtBal,
systemBalance,
difference,
clearedTransactions:[...checkedIds],
clearedCount:checkedIds.size,
isReconciled,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
// Mark transactions as reconciled
for(const id of checkedIds){
await updateDoc(doc(db,'companies',companyId,'bankAccounts',accountId,'transactions',id),{
reconciled:true,
reconciledDate:statementDate,
})
}
alert(isReconciled?'Reconciled successfully ✓':'Saved with difference — check unmatched items')
const recSnap=await getDocs(collection(db,'companies',companyId,'bankAccounts',accountId,'reconciliations'))
setPastReconciliations(recSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')))
}catch(e){alert(e.message)}
setSaving(false)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>
if(!account)return<div style={{padding:40,textAlign:'center'}}>Account not found</div>

return(
<Layout title="Bank Reconciliation">
<div style={{maxWidth:900,margin:'0 auto'}}>

<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>navigate('/bank-accounts')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<div style={{flex:1}}>
<h2 style={{fontSize:18,fontWeight:600,marginBottom:2}}>{account.name} — Reconciliation</h2>
<div style={{fontSize:12,color:'var(--text-3)'}}>{account.bankName||''} · Current Balance: {Number(account.currentBalance||account.openingBalance||0).toLocaleString()} {account.currency||'MMK'}</div>
</div>
<button type="button" onClick={()=>setShowHistory(v=>!v)} className="btn btn-ghost" style={{fontSize:12}}>
{showHistory?'Hide':'Show'} History ({pastReconciliations.length})
</button>
</div>

{/* History */}
{showHistory&&pastReconciliations.length>0&&(
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Past Reconciliations</div>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={{padding:'8px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)'}}>Date</th>
<th style={{padding:'8px',textAlign:'right',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)'}}>Statement</th>
<th style={{padding:'8px',textAlign:'right',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)'}}>System</th>
<th style={{padding:'8px',textAlign:'right',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)'}}>Difference</th>
<th style={{padding:'8px',textAlign:'center',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)'}}>Status</th>
</tr></thead>
<tbody>
{pastReconciliations.map(r=>(
<tr key={r.id}>
<td style={{padding:'8px',fontSize:13}}>{r.date}</td>
<td style={{padding:'8px',textAlign:'right',fontSize:13}}>{Number(r.statementBalance||0).toLocaleString()} Ks</td>
<td style={{padding:'8px',textAlign:'right',fontSize:13}}>{Number(r.systemBalance||0).toLocaleString()} Ks</td>
<td style={{padding:'8px',textAlign:'right',fontSize:13,color:Math.abs(r.difference||0)<1?'#16a34a':'#dc2626',fontWeight:500}}>{Number(r.difference||0).toLocaleString()} Ks</td>
<td style={{padding:'8px',textAlign:'center'}}>
{r.isReconciled
?<span style={{background:'#eaf3de',color:'#16a34a',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>✓ Matched</span>
:<span style={{background:'#fcebeb',color:'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>Difference</span>}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}

{/* Statement Input */}
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontWeight:600,fontSize:14,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
<GitCompare size={15} color="var(--primary)"/>New Reconciliation
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Statement Date</label>
<input className="form-input" type="date" value={statementDate} onChange={e=>setStatementDate(e.target.value)}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Bank Statement Ending Balance (Ks) *</label>
<input className="form-input" type="number" value={statementBalance} onChange={e=>setStatementBalance(e.target.value)} placeholder="Enter from your bank statement..."/>
</div>
</div>
</div>

{/* Summary */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
{[
{label:'System Balance',value:systemBalance,color:'#4F6EF7'},
{label:'Statement Balance',value:stmtBal,color:'#d97706'},
{label:'Difference',value:difference,color:isReconciled?'#16a34a':'#dc2626'},
].map(({label,value,color})=>(
<div key={label} className="card" style={{padding:16,border:label==='Difference'?`1px solid ${isReconciled?'rgba(22,163,74,0.3)':'rgba(220,38,38,0.3)'}`:undefined}}>
<div style={{fontSize:12,color:'var(--text-2)',marginBottom:6}}>{label}</div>
<div style={{fontSize:18,fontWeight:700,color}}>{value.toLocaleString()} Ks</div>
{label==='Difference'&&(
<div style={{fontSize:11,marginTop:4,color}}>
{isReconciled?'✓ Balanced!':difference>0?'Statement higher than system':'System higher than statement'}
</div>
)}
</div>
))}
</div>

{/* Status Banner */}
{statementBalance&&(
<div style={{
background:isReconciled?'rgba(22,163,74,0.08)':'rgba(220,38,38,0.08)',
border:`0.5px solid ${isReconciled?'rgba(22,163,74,0.2)':'rgba(220,38,38,0.2)'}`,
borderRadius:12,padding:'12px 16px',marginBottom:16,
display:'flex',alignItems:'center',gap:8
}}>
{isReconciled
?<><CheckCircle size={16} color="#16a34a"/><span style={{fontSize:13,fontWeight:500,color:'#16a34a'}}>Accounts are balanced — ready to reconcile!</span></>
:<><AlertCircle size={16} color="#dc2626"/><span style={{fontSize:13,fontWeight:500,color:'#dc2626'}}>Difference of {Math.abs(difference).toLocaleString()} Ks — check transactions below</span></>}
</div>
)}

{/* Transactions */}
<div className="card" style={{overflow:'hidden',marginBottom:16}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:14}}>Transactions ({transactions.length})</div>
<div style={{display:'flex',gap:8,alignItems:'center'}}>
<span style={{fontSize:12,color:'var(--text-3)'}}>{checkedIds.size} cleared</span>
<button type="button" onClick={toggleAll} className="btn btn-ghost" style={{fontSize:12,padding:'5px 10px'}}>
{checkedIds.size===transactions.length?'Uncheck All':'Check All'}
</button>
</div>
</div>
{transactions.length===0?(
<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>No transactions yet</div>
):(
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead><tr>
<th style={{padding:'10px 16px',textAlign:'center',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff',width:40}}>✓</th>
<th style={{padding:'10px 14px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Date</th>
<th style={{padding:'10px 14px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Description</th>
<th style={{padding:'10px 14px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Reference</th>
<th style={{padding:'10px 14px',textAlign:'right',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Amount</th>
<th style={{padding:'10px 14px',textAlign:'center',fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',borderBottom:'0.5px solid var(--border)',background:'#fafbff'}}>Status</th>
</tr></thead>
<tbody>
{transactions.map(t=>{
const checked=checkedIds.has(t.id)
return(
<tr key={t.id} style={{background:checked?'rgba(79,110,247,0.03)':t.reconciled?'rgba(22,163,74,0.02)':'white',cursor:'pointer'}} onClick={()=>toggle(t.id)}>
<td style={{padding:'10px 16px',textAlign:'center'}}>
<div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?'var(--primary)':'#d1d5db'}`,background:checked?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto',transition:'all 0.15s'}}>
{checked&&<span style={{color:'white',fontSize:12,fontWeight:700}}>✓</span>}
</div>
</td>
<td style={{padding:'10px 14px',fontSize:12,color:'var(--text-3)',whiteSpace:'nowrap'}}>{t.date||'-'}</td>
<td style={{padding:'10px 14px',fontSize:13,fontWeight:500}}>{t.description||'-'}</td>
<td style={{padding:'10px 14px',fontSize:12,color:'var(--text-2)',fontFamily:'monospace'}}>{t.reference||'-'}</td>
<td style={{padding:'10px 14px',textAlign:'right',fontWeight:600,color:t.type==='in'?'#16a34a':'#dc2626',fontSize:13}}>
{t.type==='in'?'+':'-'}{Number(t.amount||0).toLocaleString()} Ks
</td>
<td style={{padding:'10px 14px',textAlign:'center'}}>
{t.reconciled
?<span style={{background:'#eaf3de',color:'#16a34a',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600}}>Reconciled</span>
:<span style={{background:'#f1f5f9',color:'#64748b',padding:'2px 8px',borderRadius:20,fontSize:10}}>Pending</span>}
</td>
</tr>
)
})}
</tbody>
<tfoot>
<tr style={{background:'#f8fafc'}}>
<td colSpan={4} style={{padding:'10px 14px',fontWeight:700,fontSize:13}}>Cleared Total ({checkedIds.size} items)</td>
<td style={{padding:'10px 14px',textAlign:'right',fontWeight:700,fontSize:13,color:'var(--primary)'}}>{clearedBalance.toLocaleString()} Ks</td>
<td/>
</tr>
</tfoot>
</table>
)}
</div>

{/* Save */}
<div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
<button type="button" onClick={()=>navigate('/bank-accounts')} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSave} disabled={saving||!statementBalance} className="btn btn-primary">
<Save size={14}/>{saving?'Saving...':isReconciled?'Save & Reconcile':'Save with Difference'}
</button>
</div>

</div>
</Layout>
)
}
