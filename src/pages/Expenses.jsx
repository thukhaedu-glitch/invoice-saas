import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,updateDoc,serverTimestamp,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,X,Save,Wallet,TrendingDown,Search}from'lucide-react'
import{logAction}from'../utils/auditLog'

export default function Expenses(){
const[companyId,setCompanyId]=useState(null)
const[expenses,setExpenses]=useState([])
const[projects,setProjects]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[categories,setCategories]=useState(['Office','Transport','Food','Utilities','Marketing','Salary','Equipment','Software','Other'])
const[paymentMethods,setPaymentMethods]=useState(['Cash','KBZ Pay','AYA Pay','Wave Pay','CB Pay','Bank Transfer','Other'])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[filterMonth,setFilterMonth]=useState('')
const[filterCategory,setFilterCategory]=useState('')
const[modal,setModal]=useState(null)
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[form,setForm]=useState({
title:'',amount:0,category:'',
date:new Date().toISOString().split('T')[0],
paymentMethod:'Cash',note:'',projectId:'',
fromAccountId:'',
})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[sSnap,pSnap,baSnap]=await Promise.all([
getDoc(doc(db,'companies',cid,'_config','invoiceSettings')),
getDocs(collection(db,'companies',cid,'projects')),
getDocs(collection(db,'companies',cid,'bankAccounts')),
])
if(sSnap.exists()){
const sd=sSnap.data()
if(sd.expenseCategories?.length)setCategories(sd.expenseCategories)
if(sd.paymentMethods?.length)setPaymentMethods(sd.paymentMethods.map(m=>m.bankName||m).filter(Boolean))
}
setProjects(pSnap.docs.map(d=>({id:d.id,...d.data()})))
setBankAccounts(baSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.isActive!==false))
onSnapshot(collection(db,'companies',cid,'expenses'),snap=>{
setExpenses(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')))
setLoading(false)
})
}
}
load()
},[])

const openAdd=()=>{
setForm({title:'',amount:0,category:categories[0]||'',date:new Date().toISOString().split('T')[0],paymentMethod:paymentMethods[0]||'Cash',note:'',projectId:'',fromAccountId:''})
setSelected(null)
setModal('add')
}

const openEdit=(e)=>{
setForm({title:e.title||'',amount:e.amount||0,category:e.category||categories[0]||'',date:e.date||'',paymentMethod:e.paymentMethod||paymentMethods[0]||'Cash',note:e.note||'',projectId:e.projectId||'',fromAccountId:e.fromAccountId||''})
setSelected(e)
setModal('edit')
}

const handleSave=async()=>{
if(!form.title||!form.amount){alert('Title and amount required');return}
setSaving(true)
try{
const amount=Number(form.amount)
if(modal==='add'){
await addDoc(collection(db,'companies',companyId,'expenses'),{
...form,amount,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
if(form.fromAccountId){
const acRef=doc(db,'companies',companyId,'bankAccounts',form.fromAccountId)
const acSnap=await getDoc(acRef)
if(acSnap.exists()){
const newBalance=(acSnap.data().currentBalance||0)-amount
await updateDoc(acRef,{currentBalance:newBalance,updatedAt:serverTimestamp()})
await addDoc(collection(db,'companies',companyId,'journalEntries'),{
date:form.date,
description:`Expense: ${form.title}`,
entries:[
{account:'Expense',accountId:form.category,type:'debit',amount},
{account:'Bank',accountId:form.fromAccountId,accountName:acSnap.data().name,type:'credit',amount},
],
ref:'EXP',
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
await addDoc(collection(db,'companies',companyId,'bankAccounts',form.fromAccountId,'transactions'),{
date:form.date,type:'out',amount,
description:`Expense: ${form.title}`,
reference:form.category,
createdAt:serverTimestamp(),
})
}
}
await logAction(companyId,{
action:'create',module:'expenses',
description:`Added expense: ${form.title} — ${amount.toLocaleString()} Ks (${form.category})`,
metadata:{amount,category:form.category,date:form.date},
})
}else{
if(selected.fromAccountId&&selected.fromAccountId!==form.fromAccountId){
const oldRef=doc(db,'companies',companyId,'bankAccounts',selected.fromAccountId)
const oldSnap=await getDoc(oldRef)
if(oldSnap.exists()){
await updateDoc(oldRef,{currentBalance:(oldSnap.data().currentBalance||0)+Number(selected.amount||0)})
}
}
if(form.fromAccountId){
const acRef=doc(db,'companies',companyId,'bankAccounts',form.fromAccountId)
const acSnap=await getDoc(acRef)
if(acSnap.exists()){
const oldAmt=selected.fromAccountId===form.fromAccountId?Number(selected.amount||0):0
const newBalance=(acSnap.data().currentBalance||0)+oldAmt-amount
await updateDoc(acRef,{currentBalance:newBalance,updatedAt:serverTimestamp()})
}
}
await updateDoc(doc(db,'companies',companyId,'expenses',selected.id),{
...form,amount,updatedAt:serverTimestamp()
})
await logAction(companyId,{
action:'update',module:'expenses',
description:`Updated expense: ${form.title} — ${amount.toLocaleString()} Ks`,
metadata:{expenseId:selected.id,amount,category:form.category},
})
}
setModal(null)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this expense?'))return
const exp=expenses.find(e=>e.id===id)
if(exp?.fromAccountId){
const acRef=doc(db,'companies',companyId,'bankAccounts',exp.fromAccountId)
const acSnap=await getDoc(acRef)
if(acSnap.exists()){
await updateDoc(acRef,{currentBalance:(acSnap.data().currentBalance||0)+Number(exp.amount||0)})
}
}
await deleteDoc(doc(db,'companies',companyId,'expenses',id))
await logAction(companyId,{
action:'delete',module:'expenses',
description:`Deleted expense: ${exp?.title||id} — ${Number(exp?.amount||0).toLocaleString()} Ks`,
metadata:{expenseId:id,amount:exp?.amount,category:exp?.category},
})
}

const filtered=expenses.filter(e=>{
const matchSearch=e.title?.toLowerCase().includes(search.toLowerCase())||e.category?.toLowerCase().includes(search.toLowerCase())
const matchMonth=filterMonth?e.date?.startsWith(filterMonth):true
const matchCategory=filterCategory?e.category===filterCategory:true
return matchSearch&&matchMonth&&matchCategory
})

const totalAmt=filtered.reduce((s,e)=>s+Number(e.amount||0),0)
const byCategory=categories.map(c=>({
category:c,
total:filtered.filter(e=>e.category===c).reduce((s,e)=>s+Number(e.amount||0),0)
})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total)

const months=[...new Set(expenses.map(e=>e.date?.slice(0,7)))].filter(Boolean).sort().reverse()

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Expenses">

{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:15}}>{modal==='add'?'Add Expense':'Edit Expense'}</div>
<button type="button" onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Title *</label>
<input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Expense title..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Amount (Ks) *</label>
<input className="form-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Date</label>
<input className="form-input" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Category</label>
<select className="form-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
{categories.map(c=><option key={c}>{c}</option>)}
</select>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Payment Method</label>
<select className="form-input" value={form.paymentMethod} onChange={e=>setForm(f=>({...f,paymentMethod:e.target.value}))}>
{paymentMethods.map(m=><option key={m}>{m}</option>)}
</select>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>
From Account <span style={{color:'var(--primary)',fontSize:11}}>(Bank balance auto ကျမည်)</span>
</label>
<select className="form-input" value={form.fromAccountId} onChange={e=>setForm(f=>({...f,fromAccountId:e.target.value}))}>
<option value="">— Cash / Not linked —</option>
{bankAccounts.map(a=>(
<option key={a.id} value={a.id}>{a.name} {a.bankName?`(${a.bankName})`:''} — {Number(a.currentBalance||a.openingBalance||0).toLocaleString()} {a.currency||'MMK'}</option>
))}
</select>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Link to Project (optional)</label>
<select className="form-input" value={form.projectId} onChange={e=>setForm(f=>({...f,projectId:e.target.value}))}>
<option value="">— No Project —</option>
{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
</select>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Note</label>
<input className="form-input" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Optional..."/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
<Save size={14}/>{saving?'Saving...':modal==='add'?'Add Expense':'Update'}
</button>
</div>
</div>
</div>
</div>
)}

<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12,flexWrap:'wrap'}}>
<div style={{display:'flex',gap:8,flex:1,flexWrap:'wrap'}}>
<div style={{position:'relative',minWidth:180}}>
<Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{paddingLeft:32}}/>
</div>
<select className="form-input" style={{width:'auto'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map(m=><option key={m} value={m}>{m}</option>)}
</select>
<select className="form-input" style={{width:'auto'}} value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
<option value="">All Categories</option>
{categories.map(c=><option key={c} value={c}>{c}</option>)}
</select>
</div>
<button type="button" onClick={openAdd} className="btn btn-primary">
<Plus size={15}/>Add Expense
</button>
</div>

<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
<div className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
<span style={{fontSize:12,fontWeight:500,color:'var(--text-2)'}}>Total Expenses</span>
<div style={{width:32,height:32,borderRadius:8,background:'rgba(220,38,38,0.10)',display:'flex',alignItems:'center',justifyContent:'center'}}>
<TrendingDown size={16} color="#dc2626"/>
</div>
</div>
<div style={{fontSize:24,fontWeight:700,color:'#dc2626'}}>{totalAmt.toLocaleString()} Ks</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{filtered.length} records</div>
</div>
<div className="card" style={{padding:16,overflowY:'auto',maxHeight:140}}>
<div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:10}}>By Category</div>
{byCategory.length===0?<div style={{fontSize:12,color:'var(--text-3)'}}>No data</div>:byCategory.map(({category,total})=>(
<div key={category} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0'}}>
<span style={{color:'var(--text-2)'}}>{category}</span>
<span style={{fontWeight:500,color:'#dc2626'}}>{total.toLocaleString()} Ks</span>
</div>
))}
</div>
</div>

<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<Wallet size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search||filterMonth||filterCategory?'No results found':'No expenses yet'}</div>
</div>
):(
<table>
<thead>
<tr>
<th>Date</th>
<th>Title</th>
<th>Category</th>
<th>From Account</th>
<th>Project</th>
<th>Method</th>
<th style={{textAlign:'right'}}>Amount</th>
<th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(e=>(
<tr key={e.id}>
<td style={{color:'var(--text-3)',fontSize:12,whiteSpace:'nowrap'}}>{e.date||'-'}</td>
<td style={{fontWeight:500}}>{e.title}</td>
<td><span style={{background:'var(--primary-light)',color:'var(--primary)',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:500}}>{e.category}</span></td>
<td style={{fontSize:12,color:'var(--text-2)'}}>{e.fromAccountId?bankAccounts.find(a=>a.id===e.fromAccountId)?.name||'-':'-'}</td>
<td style={{fontSize:12,color:'var(--text-2)'}}>{e.projectId?projects.find(p=>p.id===e.projectId)?.name||'-':'-'}</td>
<td style={{color:'var(--text-2)',fontSize:12}}>{e.paymentMethod||'-'}</td>
<td style={{textAlign:'right',fontWeight:500,color:'#dc2626'}}>{Number(e.amount||0).toLocaleString()} Ks</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button type="button" onClick={()=>openEdit(e)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button type="button" onClick={()=>handleDelete(e.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
</div>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>
</Layout>
)
}
