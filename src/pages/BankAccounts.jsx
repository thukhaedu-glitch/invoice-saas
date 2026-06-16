import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,addDoc,updateDoc,deleteDoc,serverTimestamp,onSnapshot,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Edit,Trash2,Landmark,ArrowUpRight,ArrowDownLeft,Eye,ArrowLeft,GitCompare}from'lucide-react'
import{useNavigate}from'react-router-dom'

const DEFAULT_CURRENCIES=['MMK','USD','THB']
const ACCOUNT_TYPES=['Cash','Bank','Mobile Banking','Other']

export default function BankAccounts(){
const navigate=useNavigate()
const[companyId,setCompanyId]=useState(null)
const[accounts,setAccounts]=useState([])
const[transactions,setTransactions]=useState([])
const[loading,setLoading]=useState(true)
const[view,setView]=useState('list')
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[currencies,setCurrencies]=useState(DEFAULT_CURRENCIES)
const[form,setForm]=useState({
name:'',type:'Bank',currency:'MMK',
openingBalance:0,accountNumber:'',
bankName:'',description:'',isActive:true,
})
const[txForm,setTxForm]=useState({
date:new Date().toISOString().split('T')[0],
type:'in',amount:0,description:'',reference:''
})
const[showTxForm,setShowTxForm]=useState(false)
const[savingTx,setSavingTx]=useState(false)

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const sSnap=await getDoc(doc(db,'companies',cid,'_config','invoiceSettings'))
if(sSnap.exists()&&sSnap.data().currencies){
const currList=sSnap.data().currencies.filter(c=>c.code).map(c=>c.code)
if(currList.length>0)setCurrencies(currList)
}
onSnapshot(collection(db,'companies',cid,'bankAccounts'),snap=>{
setAccounts(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setLoading(false)
})
}
}
load()
},[])

const loadTransactions=async(accountId)=>{
const snap=await getDocs(collection(db,'companies',companyId,'bankAccounts',accountId,'transactions'))
setTransactions(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.date)-new Date(a.date)))
}

const openNew=()=>{
setForm({name:'',type:'Bank',currency:currencies[0]||'MMK',openingBalance:0,accountNumber:'',bankName:'',description:'',isActive:true})
setSelected(null)
setView('form')
}

const openEdit=(a)=>{
setForm({
name:a.name,type:a.type,currency:a.currency||currencies[0]||'MMK',
openingBalance:a.openingBalance||0,accountNumber:a.accountNumber||'',
bankName:a.bankName||'',description:a.description||'',isActive:a.isActive!==false,
})
setSelected(a)
setView('form')
}

const openDetail=async(a)=>{
setSelected(a)
await loadTransactions(a.id)
setShowTxForm(false)
setTxForm({date:new Date().toISOString().split('T')[0],type:'in',amount:0,description:'',reference:''})
setView('detail')
}

const handleSave=async()=>{
if(!form.name){alert('Account name required');return}
setSaving(true)
try{
if(!selected){
// bank account ဆောက်
const bankRef=await addDoc(collection(db,'companies',companyId,'bankAccounts'),{
...form,
openingBalance:Number(form.openingBalance),
currentBalance:Number(form.openingBalance),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
alert('STEP 1: Bank ဆောက်ပြီး။ companyId='+companyId+' — အခု Chart ထဲ ထည့်မယ်')
// Chart of Accounts (accounts) ထဲ Cash & Bank entry auto-create + link
try{
// နောက်ဆုံး bank account code ရှာ (where query မသုံး — index မလို)
const acctSnap=await getDocs(collection(db,'companies',companyId,'accounts'))
let maxCode=1001
acctSnap.docs.forEach(d=>{
const data=d.data()
if(data.subType==='Cash & Bank'){
const c=parseInt(data.code)
if(!isNaN(c)&&c>maxCode)maxCode=c
}
})
await addDoc(collection(db,'companies',companyId,'accounts'),{
name:form.name,
type:'Assets',
subType:'Cash & Bank',
code:String(maxCode+1),
openingBalance:Number(form.openingBalance),
currentBalance:Number(form.openingBalance),
description:`Bank account: ${form.name}`,
bankAccountId:bankRef.id,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
alert('✓ Chart of Accounts ထဲ "'+form.name+'" (code '+String(maxCode+1)+') ထည့်ပြီး! Chart of Accounts page ကို refresh လုပ်ပါ။')
}catch(e){console.error('chart link error:',e);alert('Bank account ဆောက်ပြီး — ဒါပေမယ် Chart of Accounts ထဲ ထည့်ရာမှာ error: '+e.message)}
}else{
alert('STEP E: EDIT branch ထဲ ရောက်နေတယ် (selected ရှိနေ — New Account မဟုတ်)')
await updateDoc(doc(db,'companies',companyId,'bankAccounts',selected.id),{
...form,
openingBalance:Number(form.openingBalance),
updatedAt:serverTimestamp(),
})
// Chart မှာ ဒီ bank account ရှိ/မရှိ စစ် — မရှိရင် ထည့် (ဟောင်း account အတွက်)
try{
const acctSnap=await getDocs(collection(db,'companies',companyId,'accounts'))
let maxCode=1001
let exists=false
acctSnap.docs.forEach(d=>{
const data=d.data()
if(data.bankAccountId===selected.id)exists=true
if(data.subType==='Cash & Bank'){
const c=parseInt(data.code)
if(!isNaN(c)&&c>maxCode)maxCode=c
}
})
if(!exists){
await addDoc(collection(db,'companies',companyId,'accounts'),{
name:form.name,
type:'Assets',
subType:'Cash & Bank',
code:String(maxCode+1),
openingBalance:Number(form.openingBalance),
currentBalance:Number(form.openingBalance),
description:`Bank account: ${form.name}`,
bankAccountId:selected.id,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}
}catch(e){console.error('chart link error:',e);alert('Chart of Accounts ထဲ ထည့်ရာမှာ error: '+e.message)}
}
setView('list')
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this account?'))return
await deleteDoc(doc(db,'companies',companyId,'bankAccounts',id))
}

const handleAddTransaction=async()=>{
if(!txForm.amount||!txForm.description){alert('Amount and description required');return}
setSavingTx(true)
try{
const amount=Number(txForm.amount)
const balanceChange=txForm.type==='in'?amount:-amount
await addDoc(collection(db,'companies',companyId,'bankAccounts',selected.id,'transactions'),{
...txForm,amount,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
const newBalance=(selected.currentBalance||0)+balanceChange
await updateDoc(doc(db,'companies',companyId,'bankAccounts',selected.id),{
currentBalance:newBalance,
updatedAt:serverTimestamp(),
})
setSelected(s=>({...s,currentBalance:newBalance}))
setAccounts(a=>a.map(x=>x.id===selected.id?{...x,currentBalance:newBalance}:x))
await loadTransactions(selected.id)
setTxForm({date:new Date().toISOString().split('T')[0],type:'in',amount:0,description:'',reference:''})
setShowTxForm(false)
}catch(e){alert(e.message)}
setSavingTx(false)
}

// Currency group ဖြင့် balance calculate
const balanceByCurrency={}
accounts.filter(a=>a.isActive!==false).forEach(a=>{
const cur=a.currency||'MMK'
if(!balanceByCurrency[cur])balanceByCurrency[cur]=0
balanceByCurrency[cur]+=Number(a.currentBalance||a.openingBalance||0)
})

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

if(view==='form')return(
<Layout title={selected?'Edit Account':'New Bank Account'}>
<div style={{maxWidth:560,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>setView('list')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<h2 style={{fontSize:18,fontWeight:600,flex:1}}>{selected?'Edit Account':'New Bank Account'}</h2>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
{saving?'Saving...':'Save Account'}
</button>
</div>
<div className="card" style={{padding:24}}>
<div style={{display:'grid',gap:16}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Account Name *</label>
<input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. KBZ Main Account"/>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Account Type</label>
<select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
{ACCOUNT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
</select>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Currency</label>
<select className="form-input" value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
{currencies.map(c=><option key={c} value={c}>{c}</option>)}
</select>
</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Bank Name</label>
<input className="form-input" value={form.bankName} onChange={e=>setForm(f=>({...f,bankName:e.target.value}))} placeholder="e.g. KBZ Bank"/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Account Number</label>
<input className="form-input" value={form.accountNumber} onChange={e=>setForm(f=>({...f,accountNumber:e.target.value}))} placeholder="09xxxxxxxxx"/>
</div>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Opening Balance</label>
<input className="form-input" type="number" value={form.openingBalance} onChange={e=>setForm(f=>({...f,openingBalance:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Description</label>
<input className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Optional..."/>
</div>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<input type="checkbox" id="isActive" checked={form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))}/>
<label htmlFor="isActive" style={{fontSize:13,color:'var(--text-2)'}}>Active Account</label>
</div>
</div>
</div>
</div>
</Layout>
)

if(view==='detail'&&selected)return(
<Layout title={selected.name}>
<div style={{maxWidth:800,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>setView('list')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<h2 style={{fontSize:18,fontWeight:600,flex:1}}>{selected.name}</h2>
<button type="button" onClick={()=>openEdit(selected)} className="btn btn-ghost" style={{fontSize:13}}><Edit size={14}/>Edit</button>
<button type="button" onClick={()=>setShowTxForm(v=>!v)} className="btn btn-primary"><Plus size={15}/>Add Transaction</button>
</div>

<div className="card" style={{padding:24,marginBottom:16,background:'linear-gradient(135deg,#4F6EF7,#7C3AED)',color:'white'}}>
<div style={{fontSize:12,opacity:0.8,marginBottom:8}}>Current Balance</div>
<div style={{fontSize:32,fontWeight:700}}>{Number(selected.currentBalance||selected.openingBalance||0).toLocaleString()} {selected.currency||'MMK'}</div>
<div style={{display:'flex',gap:24,marginTop:16,fontSize:12,opacity:0.8}}>
{selected.bankName&&<span>🏦 {selected.bankName}</span>}
{selected.accountNumber&&<span>#{selected.accountNumber}</span>}
<span style={{textTransform:'capitalize'}}>{selected.type}</span>
</div>
</div>

{showTxForm&&(
<div className="card" style={{padding:20,marginBottom:16}}>
<div style={{fontSize:13,fontWeight:600,marginBottom:12}}>New Transaction</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Type</label>
<select className="form-input" value={txForm.type} onChange={e=>setTxForm(f=>({...f,type:e.target.value}))}>
<option value="in">💚 Money In</option>
<option value="out">🔴 Money Out</option>
</select>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Amount</label>
<input className="form-input" type="number" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Date</label>
<input className="form-input" type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))}/>
</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Description *</label>
<input className="form-input" value={txForm.description} onChange={e=>setTxForm(f=>({...f,description:e.target.value}))} placeholder="What is this transaction for?"/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Reference</label>
<input className="form-input" value={txForm.reference} onChange={e=>setTxForm(f=>({...f,reference:e.target.value}))} placeholder="INV-xxx or receipt no."/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setShowTxForm(false)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleAddTransaction} disabled={savingTx} className="btn btn-primary">
{savingTx?'Saving...':'Save Transaction'}
</button>
</div>
</div>
)}

<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid var(--border)',fontWeight:600,fontSize:14}}>
Transaction History
</div>
{transactions.length===0?(
<div style={{padding:48,textAlign:'center',color:'var(--text-3)'}}>
<Landmark size={32} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No transactions yet</div>
</div>
):(
<table>
<thead>
<tr>
<th>Date</th>
<th>Description</th>
<th>Reference</th>
<th style={{textAlign:'center'}}>Type</th>
<th style={{textAlign:'right'}}>Amount</th>
</tr>
</thead>
<tbody>
{transactions.map(t=>(
<tr key={t.id}>
<td style={{fontSize:12,color:'var(--text-3)'}}>{t.date}</td>
<td style={{fontWeight:500}}>{t.description}</td>
<td style={{fontSize:12,color:'var(--text-3)',fontFamily:'monospace'}}>{t.reference||'-'}</td>
<td style={{textAlign:'center'}}>
{t.type==='in'
?<span style={{color:'#16a34a',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><ArrowDownLeft size={13}/>In</span>
:<span style={{color:'#dc2626',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><ArrowUpRight size={13}/>Out</span>
}
</td>
<td style={{textAlign:'right',fontWeight:600,color:t.type==='in'?'#16a34a':'#dc2626'}}>
{t.type==='in'?'+':'-'}{Number(t.amount).toLocaleString()} {selected.currency||'MMK'}
</td>
</tr>
))}
</tbody>
</table>
)}
</div>
</div>
</Layout>
)

return(
<Layout title="Bank Accounts">

{/* Total Balance — currency ခွဲပြ */}
<div className="card" style={{padding:24,marginBottom:20,background:'linear-gradient(135deg,#1a1d2e,#2d3260)',color:'white'}}>
<div style={{fontSize:12,opacity:0.7,marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>Total Balance — All Accounts</div>
{Object.entries(balanceByCurrency).length===0?(
<div style={{fontSize:32,fontWeight:700}}>0 MMK</div>
):(
<div style={{display:'flex',gap:32,flexWrap:'wrap'}}>
{Object.entries(balanceByCurrency).map(([cur,bal])=>(
<div key={cur}>
<div style={{fontSize:11,opacity:0.6,marginBottom:4}}>{cur}</div>
<div style={{fontSize:28,fontWeight:700}}>{bal.toLocaleString()} <span style={{fontSize:14,opacity:0.7}}>{cur}</span></div>
</div>
))}
</div>
)}
<div style={{fontSize:12,opacity:0.6,marginTop:12}}>{accounts.filter(a=>a.isActive!==false).length} active accounts</div>
</div>

<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
<h3 style={{fontSize:15,fontWeight:600}}>All Accounts</h3>
<button type="button" onClick={openNew} className="btn btn-primary"><Plus size={15}/>New Account</button>
</div>

{accounts.length===0?(
<div className="card" style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<Landmark size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div style={{fontSize:15,fontWeight:500,marginBottom:8}}>No bank accounts yet</div>
<div style={{fontSize:13,marginBottom:20}}>Add your bank accounts to track balances</div>
<button type="button" onClick={openNew} className="btn btn-primary"><Plus size={15}/>Add First Account</button>
</div>
):(
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
{accounts.map(a=>(
<div key={a.id} className="card" style={{padding:20,cursor:'pointer',opacity:a.isActive===false?0.6:1}} onClick={()=>openDetail(a)}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
<div>
<div style={{fontWeight:600,fontSize:15}}>{a.name}</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{a.bankName||a.type}</div>
</div>
<div style={{width:36,height:36,background:'var(--primary-light)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
<Landmark size={18} style={{color:'var(--primary)'}}/>
</div>
</div>
{a.accountNumber&&<div style={{fontSize:11,color:'var(--text-3)',fontFamily:'monospace',marginBottom:12}}>#{a.accountNumber}</div>}
<div style={{fontSize:24,fontWeight:700,color:'var(--text-1)',marginBottom:4}}>
{Number(a.currentBalance||a.openingBalance||0).toLocaleString()} <span style={{fontSize:13,color:'var(--text-3)'}}>{a.currency||'MMK'}</span>
</div>
<div style={{fontSize:11,color:'var(--text-3)'}}>Opening: {Number(a.openingBalance||0).toLocaleString()} {a.currency||'MMK'}</div>
<div style={{display:'flex',gap:8,marginTop:16}} onClick={e=>e.stopPropagation()}>
<button type="button" onClick={()=>navigate(`/reconcile/${a.id}`)} className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}}>
<GitCompare size={12}/>Reconcile
</button>
<button type="button" onClick={()=>openDetail(a)} style={{flex:1,padding:'6px 0',borderRadius:8,border:'0.5px solid var(--border)',background:'none',cursor:'pointer',fontSize:12,color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
<Eye size={12}/>View
</button>
<button type="button" onClick={()=>openEdit(a)} style={{padding:'6px 10px',borderRadius:8,border:'0.5px solid var(--border)',background:'none',cursor:'pointer',fontSize:12,color:'var(--text-2)'}}>
<Edit size={12}/>
</button>
<button type="button" onClick={()=>handleDelete(a.id)} style={{padding:'6px 10px',borderRadius:8,border:'0.5px solid var(--border)',background:'none',cursor:'pointer',fontSize:12,color:'var(--danger)'}}>
<Trash2 size={12}/>
</button>
</div>
</div>
))}
</div>
)}
</Layout>
)
}
