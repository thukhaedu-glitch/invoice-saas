import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,addDoc,updateDoc,deleteDoc,serverTimestamp,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Trash2,Edit,X,Save,Receipt,Search,CheckCircle,Clock,AlertCircle,ArrowLeft}from'lucide-react'

const STATUS=['unpaid','partial','paid','cancelled']
const statusColor={unpaid:'#d97706',partial:'#4F6EF7',paid:'#16a34a',cancelled:'#64748b'}
const statusBg={unpaid:'#faeeda',partial:'rgba(79,110,247,0.1)',paid:'#eaf3de',cancelled:'#f1f5f9'}

export default function Bills(){
const[companyId,setCompanyId]=useState(null)
const[bills,setBills]=useState([])
const[bankAccounts,setBankAccounts]=useState([])
const[categories,setCategories]=useState(['Office','Transport','Food','Utilities','Marketing','Salary','Equipment','Software','Other'])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[filterStatus,setFilterStatus]=useState('')
const[modal,setModal]=useState(null)
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[payModal,setPayModal]=useState(null)
const[payForm,setPayForm]=useState({amount:'',date:new Date().toISOString().split('T')[0],bankAccountId:'',note:''})
const[savingPay,setSavingPay]=useState(false)
const[form,setForm]=useState({
title:'',vendor:'',amount:0,category:'',
dueDate:'',billDate:new Date().toISOString().split('T')[0],
note:'',status:'unpaid',
})

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
const[billSnap,baSnap,sSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'bills')),
getDocs(collection(db,'companies',cid,'bankAccounts')),
getDoc(doc(db,'companies',cid,'_config','invoiceSettings')),
])
setBills(billSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setBankAccounts(baSnap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.isActive!==false))
if(sSnap.exists()&&sSnap.data().expenseCategories?.length)setCategories(sSnap.data().expenseCategories)
}
setLoading(false)
}
load()
},[])

const openAdd=()=>{
setForm({title:'',vendor:'',amount:0,category:categories[0]||'',dueDate:'',billDate:new Date().toISOString().split('T')[0],note:'',status:'unpaid'})
setSelected(null)
setModal('add')
}

const openEdit=(b)=>{
setForm({title:b.title||'',vendor:b.vendor||'',amount:b.amount||0,category:b.category||'',dueDate:b.dueDate||'',billDate:b.billDate||'',note:b.note||'',status:b.status||'unpaid'})
setSelected(b)
setModal('edit')
}

const handleSave=async()=>{
if(!form.title||!form.amount){alert('Title and amount required');return}
setSaving(true)
try{
const data={...form,amount:Number(form.amount),updatedAt:serverTimestamp()}
if(!selected){
await addDoc(collection(db,'companies',companyId,'bills'),{
...data,
paidAmount:0,
billNumber:'BILL-'+Date.now().toString().slice(-6),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'bills',selected.id),data)
}
const billSnap=await getDocs(collection(db,'companies',companyId,'bills'))
setBills(billSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setModal(null)
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this bill?'))return
await deleteDoc(doc(db,'companies',companyId,'bills',id))
setBills(b=>b.filter(x=>x.id!==id))
}

const openPayModal=(b)=>{
setPayModal(b)
setPayForm({amount:String(b.amount-(b.paidAmount||0)),date:new Date().toISOString().split('T')[0],bankAccountId:bankAccounts[0]?.id||'',note:''})
}

const handlePay=async()=>{
if(!payForm.amount||Number(payForm.amount)<=0){alert('Enter valid amount');return}
if(!payForm.bankAccountId){alert('Select bank account');return}
setSavingPay(true)
try{
const bill=payModal
const amount=Number(payForm.amount)
const payments=[...(bill.payments||[]),{
amount,date:payForm.date,bankAccountId:payForm.bankAccountId,
bankName:bankAccounts.find(a=>a.id===payForm.bankAccountId)?.name||'',
note:payForm.note,createdAt:new Date().toISOString(),
}]
const totalPaid=payments.reduce((s,p)=>s+p.amount,0)
const remaining=Number(bill.amount||0)-totalPaid
const newStatus=remaining<=0?'paid':totalPaid>0?'partial':'unpaid'

await updateDoc(doc(db,'companies',companyId,'bills',bill.id),{
payments,paidAmount:totalPaid,
remainingAmount:remaining<0?0:remaining,
status:newStatus,
updatedAt:serverTimestamp(),
})

// Bank balance ကျ + journal entry
const acRef=doc(db,'companies',companyId,'bankAccounts',payForm.bankAccountId)
const acSnap=await getDoc(acRef)
if(acSnap.exists()){
const newBalance=(acSnap.data().currentBalance||0)-amount
await updateDoc(acRef,{currentBalance:newBalance,updatedAt:serverTimestamp()})
await addDoc(collection(db,'companies',companyId,'bankAccounts',payForm.bankAccountId,'transactions'),{
date:payForm.date,type:'out',amount,
description:`Bill payment: ${bill.title}`,
reference:bill.billNumber,
createdAt:serverTimestamp(),
})
await addDoc(collection(db,'companies',companyId,'journalEntries'),{
date:payForm.date,
description:`Bill payment: ${bill.title} — ${bill.vendor||''}`,
entries:[
{account:'Accounts Payable',type:'debit',amount},
{account:'Bank',accountId:payForm.bankAccountId,accountName:acSnap.data().name,type:'credit',amount},
],
ref:'BILL',
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}

const billSnap=await getDocs(collection(db,'companies',companyId,'bills'))
setBills(billSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))
setPayModal(null)
}catch(e){alert(e.message)}
setSavingPay(false)
}

const filtered=bills.filter(b=>{
const matchSearch=b.title?.toLowerCase().includes(search.toLowerCase())||b.vendor?.toLowerCase().includes(search.toLowerCase())||b.billNumber?.toLowerCase().includes(search.toLowerCase())
const matchStatus=filterStatus?b.status===filterStatus:true
return matchSearch&&matchStatus
})

const totalUnpaid=bills.filter(b=>b.status==='unpaid'||b.status==='partial').reduce((s,b)=>s+Number(b.remainingAmount||b.amount||0),0)
const totalPaid=bills.filter(b=>b.status==='paid').reduce((s,b)=>s+Number(b.amount||0),0)
const overdue=bills.filter(b=>(b.status==='unpaid'||b.status==='partial')&&b.dueDate&&new Date(b.dueDate)<new Date())

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Bills & Payable">

{/* Add/Edit Modal */}
{modal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:480,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',maxHeight:'90vh',overflowY:'auto'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontWeight:600,fontSize:15}}>{modal==='add'?'New Bill':'Edit Bill'}</div>
<button type="button" onClick={()=>setModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Bill Title *</label>
<input className="form-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Office Rent June"/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Vendor / Supplier</label>
<input className="form-input" value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="Vendor name..."/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Amount (Ks) *</label>
<input className="form-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{textAlign:'right'}}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Category</label>
<select className="form-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
{categories.map(c=><option key={c}>{c}</option>)}
</select>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Bill Date</label>
<input className="form-input" type="date" value={form.billDate} onChange={e=>setForm(f=>({...f,billDate:e.target.value}))}/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Due Date</label>
<input className="form-input" type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/>
</div>
<div style={{gridColumn:'1/-1'}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Note</label>
<input className="form-input" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Optional..."/>
</div>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
<button type="button" onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
<Save size={14}/>{saving?'Saving...':modal==='add'?'Create Bill':'Update'}
</button>
</div>
</div>
</div>
</div>
)}

{/* Pay Modal */}
{payModal&&(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontWeight:600,fontSize:15}}>Pay Bill</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>
{payModal.billNumber} — Total: {Number(payModal.amount||0).toLocaleString()} Ks
{payModal.paidAmount>0&&<span style={{color:'#16a34a'}}> | Paid: {Number(payModal.paidAmount).toLocaleString()} Ks</span>}
</div>
</div>
<button type="button" onClick={()=>setPayModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Amount (Ks) *</label>
<input className="form-input" type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))}/>
</div>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Payment Date</label>
<input className="form-input" type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))}/>
</div>
<div style={{marginBottom:12}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>
From Bank Account <span style={{color:'var(--primary)',fontSize:11}}>(Bank balance auto ကျမည်)</span>
</label>
<select className="form-input" value={payForm.bankAccountId} onChange={e=>setPayForm(f=>({...f,bankAccountId:e.target.value}))}>
<option value="">— Select Account —</option>
{bankAccounts.map(a=>(
<option key={a.id} value={a.id}>{a.name} {a.bankName?`(${a.bankName})`:''} — {Number(a.currentBalance||a.openingBalance||0).toLocaleString()} {a.currency||'MMK'}</option>
))}
</select>
</div>
<div style={{marginBottom:16}}>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Note</label>
<input className="form-input" value={payForm.note} onChange={e=>setPayForm(f=>({...f,note:e.target.value}))} placeholder="Optional..."/>
</div>

{payModal.payments?.length>0&&(
<div style={{marginBottom:16,padding:12,background:'#f8fafc',borderRadius:8}}>
<div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',marginBottom:8,textTransform:'uppercase'}}>Payment History</div>
{payModal.payments.map((p,i)=>(
<div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:'0.5px solid #e2e8f0'}}>
<span style={{color:'var(--text-2)'}}>{p.date} — {p.bankName||'-'}</span>
<span style={{fontWeight:500,color:'#16a34a'}}>{Number(p.amount).toLocaleString()} Ks</span>
</div>
))}
</div>
)}

<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={()=>setPayModal(null)} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handlePay} disabled={savingPay} className="btn btn-primary">
<CheckCircle size={14}/>{savingPay?'Processing...':'Pay Bill'}
</button>
</div>
</div>
</div>
</div>
)}

{/* Overdue Banner */}
{overdue.length>0&&(
<div style={{background:'rgba(220,38,38,0.08)',border:'0.5px solid rgba(220,38,38,0.2)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
<AlertCircle size={16} color="#dc2626"/>
<span style={{fontSize:13,fontWeight:500,color:'#dc2626'}}>{overdue.length} bill{overdue.length>1?'s':''} overdue — Total: {overdue.reduce((s,b)=>s+Number(b.remainingAmount||b.amount||0),0).toLocaleString()} Ks</span>
</div>
)}

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
{[
{label:'Total Bills',value:bills.length,color:'#4F6EF7',icon:Receipt},
{label:'Unpaid / Partial',value:bills.filter(b=>b.status==='unpaid'||b.status==='partial').length,color:'#d97706',icon:Clock},
{label:'Total Payable',value:`${totalUnpaid.toLocaleString()} Ks`,color:'#dc2626',icon:AlertCircle},
{label:'Total Paid',value:`${totalPaid.toLocaleString()} Ks`,color:'#16a34a',icon:CheckCircle},
].map(({label,value,color,icon:Icon})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
<Icon size={15} color={color}/>
<span style={{fontSize:11,fontWeight:500,color:'var(--text-2)'}}>{label}</span>
</div>
<div style={{fontSize:16,fontWeight:700,color}}>{value}</div>
</div>
))}
</div>

{/* Filters */}
<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16,justifyContent:'space-between'}}>
<div style={{display:'flex',gap:8,flex:1}}>
<div style={{position:'relative'}}>
<Search size={12} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search bills..." style={{paddingLeft:26,fontSize:12,padding:'6px 8px 6px 26px',width:160}}/>
</div>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
<option value="">All Status</option>
{STATUS.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
</select>
</div>
<button type="button" onClick={openAdd} className="btn btn-primary"><Plus size={15}/>New Bill</button>
</div>

{/* Table */}
<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<Receipt size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>{search||filterStatus?'No results':'No bills yet'}</div>
</div>
):(
<table>
<thead>
<tr>
<th>Bill #</th><th>Title</th><th>Vendor</th><th>Category</th>
<th>Bill Date</th><th>Due Date</th>
<th style={{textAlign:'right'}}>Amount</th>
<th style={{textAlign:'right'}}>Paid</th>
<th style={{textAlign:'center'}}>Status</th>
<th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(b=>{
const isOverdue=(b.status==='unpaid'||b.status==='partial')&&b.dueDate&&new Date(b.dueDate)<new Date()
return(
<tr key={b.id} style={{background:isOverdue?'rgba(220,38,38,0.02)':'white'}}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontSize:12,fontWeight:500}}>{b.billNumber}</td>
<td style={{fontWeight:500}}>{b.title}</td>
<td style={{color:'var(--text-2)',fontSize:12}}>{b.vendor||'-'}</td>
<td><span style={{background:'var(--primary-light)',color:'var(--primary)',padding:'2px 8px',borderRadius:20,fontSize:11}}>{b.category}</span></td>
<td style={{color:'var(--text-3)',fontSize:12}}>{b.billDate||'-'}</td>
<td style={{fontSize:12,color:isOverdue?'#dc2626':'var(--text-3)',fontWeight:isOverdue?600:400}}>
{b.dueDate||'-'}{isOverdue&&' ⚠️'}
</td>
<td style={{textAlign:'right',fontWeight:500}}>{Number(b.amount||0).toLocaleString()} Ks</td>
<td style={{textAlign:'right',fontSize:12,color:'#16a34a'}}>{b.paidAmount>0?`${Number(b.paidAmount).toLocaleString()} Ks`:'-'}</td>
<td style={{textAlign:'center'}}>
<span style={{background:statusBg[b.status],color:statusColor[b.status],padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,textTransform:'capitalize'}}>{b.status}</span>
</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
{(b.status==='unpaid'||b.status==='partial')&&(
<button type="button" onClick={()=>openPayModal(b)} title="Pay" style={{background:'none',border:'none',cursor:'pointer',color:'#16a34a',padding:4,borderRadius:6}}><CheckCircle size={14}/></button>
)}
<button type="button" onClick={()=>openEdit(b)} title="Edit" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button type="button" onClick={()=>handleDelete(b.id)} title="Delete" style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
</div>
</td>
</tr>
)})}
</tbody>
</table>
)}
</div>
</Layout>
)
}
