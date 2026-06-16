import{useState,useEffect,useRef}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,doc,addDoc,updateDoc,deleteDoc,serverTimestamp,onSnapshot}from'firebase/firestore'
import Layout from'../components/Layout'
import{Plus,Edit,Trash2,ChevronDown,ChevronRight,BookOpen,Building2,RefreshCcw}from'lucide-react'

const ACCOUNT_TYPES=[
{type:'Assets',code:'1',color:'#16a34a',bg:'#eaf3de',sub:['Cash & Bank','Accounts Receivable','Inventory','Other Assets']},
{type:'Liabilities',code:'2',color:'#dc2626',bg:'#fcebeb',sub:['Accounts Payable','Short-term Loans','Other Liabilities']},
{type:'Equity',code:'3',color:'#6366f1',bg:'#ede9fe',sub:['Owner Equity','Retained Earnings']},
{type:'Income',code:'4',color:'#4F6EF7',bg:'rgba(79,110,247,0.1)',sub:['Sales Revenue','Service Revenue','Other Income']},
{type:'Expenses',code:'5',color:'#d97706',bg:'#faeeda',sub:['Cost of Goods Sold','Salary','Rent','Utilities','Other Expenses']},
]

const DEFAULT_ACCOUNTS=[
{name:'Cash in Hand',type:'Assets',subType:'Cash & Bank',code:'1001',openingBalance:0,description:'Physical cash'},
{name:'KBZ Bank',type:'Assets',subType:'Cash & Bank',code:'1002',openingBalance:0,description:'KBZ bank account'},
{name:'AYA Bank',type:'Assets',subType:'Cash & Bank',code:'1003',openingBalance:0,description:'AYA bank account'},
{name:'Accounts Receivable',type:'Assets',subType:'Accounts Receivable',code:'1100',openingBalance:0,description:'Money owed by customers'},
{name:'Accounts Payable',type:'Liabilities',subType:'Accounts Payable',code:'2001',openingBalance:0,description:'Money owed to suppliers'},
{name:'Owner Equity',type:'Equity',subType:'Owner Equity',code:'3001',openingBalance:0,description:'Owner investment'},
{name:'Sales Revenue',type:'Income',subType:'Sales Revenue',code:'4001',openingBalance:0,description:'Revenue from sales'},
{name:'Service Revenue',type:'Income',subType:'Service Revenue',code:'4002',openingBalance:0,description:'Revenue from services'},
{name:'Salary Expense',type:'Expenses',subType:'Salary',code:'5001',openingBalance:0,description:'Employee salaries'},
{name:'Rent Expense',type:'Expenses',subType:'Rent',code:'5002',openingBalance:0,description:'Office/shop rent'},
{name:'Utilities Expense',type:'Expenses',subType:'Utilities',code:'5003',openingBalance:0,description:'Water, electricity, internet'},
]

const NORMAL_DEBIT=['Assets','Expenses']

function calcBalances(accs,jes){
return accs.map(a=>{
// Bank account — balance က bank transactions ကနေ (currentBalance တိုက်ရိုက် သုံး)
if(a.isBankAccount)return a
let balance=Number(a.openingBalance||0)
jes.forEach(je=>{
;(je.entries||[]).forEach(line=>{
const matched=
line.account?.toLowerCase()===a.name?.toLowerCase()||
line.accountName?.toLowerCase()===a.name?.toLowerCase()||
line.account===a.code||
line.accountId===a.id||
// 'Revenue' alias → Sales Revenue account နဲ့ match (ဟောင်း invoice journal entries)
(line.account==='Revenue'&&a.name==='Sales Revenue')
if(!matched)return
const amt=Number(line.amount||0)
if(NORMAL_DEBIT.includes(a.type)){
balance+=line.type==='debit'?amt:-amt
}else{
balance+=line.type==='credit'?amt:-amt
}
})
})
return{...a,currentBalance:balance}
})
}

export default function ChartOfAccounts(){
const[companyId,setCompanyId]=useState(null)
const[accounts,setAccounts]=useState([])
const[loading,setLoading]=useState(true)
const[recalculating,setRecalculating]=useState(false)
const[view,setView]=useState('list')
const[selected,setSelected]=useState(null)
const[saving,setSaving]=useState(false)
const[expanded,setExpanded]=useState({Assets:true,Liabilities:true,Equity:true,Income:true,Expenses:true})
const[form,setForm]=useState({name:'',type:'Assets',subType:'Cash & Bank',code:'',openingBalance:0,description:''})
const[initializing,setInitializing]=useState(false)


const jesRef=useRef([])
const companyIdRef=useRef(null)

const addLog=(msg)=>{
console.log('[CoA]',msg)
}

useEffect(()=>{
let unsubAccounts=null
let unsubBank=null
let latestAccs=[]
let latestBanks=[]
const rebuild=()=>{
const existingBankIds=new Set(latestAccs.filter(a=>a.bankAccountId).map(a=>a.bankAccountId))
let maxCode=1003
latestAccs.forEach(a=>{if(a.subType==='Cash & Bank'){const c=parseInt(a.code);if(!isNaN(c)&&c>maxCode)maxCode=c}})
const merged=[...latestAccs]
latestBanks.forEach(b=>{
if(!existingBankIds.has(b.id)){
maxCode++
merged.push({
id:'bank_'+b.id,
name:b.name,
type:'Assets',
subType:'Cash & Bank',
code:String(maxCode),
openingBalance:Number(b.openingBalance||0),
currentBalance:Number(b.currentBalance||b.openingBalance||0),
description:b.bankName?('Bank: '+b.bankName):'Bank account',
isBankAccount:true,
})
}
})
setAccounts(calcBalances(merged,jesRef.current))
setLoading(false)
}
const init=async()=>{
try{
addLog('init start, uid='+auth.currentUser?.uid)
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
addLog('companies found: '+snap.size)
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
companyIdRef.current=cid
addLog('companyId='+cid)

const jeSnap=await getDocs(collection(db,'companies',cid,'journalEntries'))
jesRef.current=jeSnap.docs.map(d=>({id:d.id,...d.data()}))
addLog('journalEntries loaded: '+jesRef.current.length)

addLog('setting up onSnapshot on accounts + bankAccounts...')
unsubAccounts=onSnapshot(collection(db,'companies',cid,'accounts'),(acSnap)=>{
addLog('accounts snapshot: '+acSnap.size)
latestAccs=acSnap.docs.map(d=>({id:d.id,...d.data()}))
rebuild()
},(err)=>{addLog('accounts ERROR: '+err.message);setLoading(false)})
unsubBank=onSnapshot(collection(db,'companies',cid,'bankAccounts'),(bSnap)=>{
addLog('bankAccounts snapshot: '+bSnap.size)
latestBanks=bSnap.docs.map(d=>({id:d.id,...d.data()}))
rebuild()
},(err)=>{addLog('bankAccounts ERROR: '+err.message)})
}else{
addLog('ERROR: no company found!')
setLoading(false)
}
}catch(e){
addLog('CATCH ERROR: '+e.message)
setLoading(false)
}
}
init()
return()=>{ if(unsubAccounts){addLog('cleanup unsub');unsubAccounts()} if(unsubBank){unsubBank()} }
},[])

const reloadJournals=async()=>{
if(!companyIdRef.current)return
const jeSnap=await getDocs(collection(db,'companies',companyIdRef.current,'journalEntries'))
jesRef.current=jeSnap.docs.map(d=>({id:d.id,...d.data()}))
}

const handleRecalculate=async()=>{
setRecalculating(true)
await reloadJournals()
const acSnap=await getDocs(collection(db,'companies',companyIdRef.current,'accounts'))
const accs=acSnap.docs.map(d=>({id:d.id,...d.data()}))
setAccounts(calcBalances(accs,jesRef.current))
setRecalculating(false)
}

const handleInitDefaults=async()=>{
if(!confirm('Create default chart of accounts?'))return
setInitializing(true)
try{
await Promise.all(DEFAULT_ACCOUNTS.map(a=>
addDoc(collection(db,'companies',companyId,'accounts'),{
...a,
openingBalance:Number(a.openingBalance),
currentBalance:Number(a.openingBalance),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
isDefault:true,
})
))
}catch(e){alert(e.message)}
setInitializing(false)
}

const handleSave=async()=>{
if(!form.name||!form.code){alert('Name and code required');return}
setSaving(true)
try{
if(!selected){
await addDoc(collection(db,'companies',companyId,'accounts'),{
...form,
openingBalance:Number(form.openingBalance),
currentBalance:Number(form.openingBalance),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}else{
await updateDoc(doc(db,'companies',companyId,'accounts',selected.id),{
...form,
openingBalance:Number(form.openingBalance),
updatedAt:serverTimestamp(),
})
}
setView('list')
}catch(e){alert(e.message)}
setSaving(false)
}

const handleDelete=async(id)=>{
if(!confirm('Delete this account?'))return
await deleteDoc(doc(db,'companies',companyId,'accounts',id))
}

const openNew=()=>{
setForm({name:'',type:'Assets',subType:'Cash & Bank',code:'',openingBalance:0,description:''})
setSelected(null)
setView('form')
}

const openEdit=(a)=>{
setForm({name:a.name,type:a.type,subType:a.subType,code:a.code,openingBalance:a.openingBalance||0,description:a.description||''})
setSelected(a)
setView('form')
}

const toggleExpand=(type)=>setExpanded(e=>({...e,[type]:!e[type]}))
const getSubTypes=()=>ACCOUNT_TYPES.find(t=>t.type===form.type)?.sub||[]
const totalByType=(type)=>accounts.filter(a=>a.type===type).reduce((s,a)=>s+Number(a.currentBalance||a.openingBalance||0),0)

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

if(view==='form')return(
<Layout title={selected?'Edit Account':'New Account'}>
<div style={{maxWidth:560,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
<button type="button" onClick={()=>setView('list')} className="btn btn-ghost" style={{padding:'8px 12px'}}>← Back</button>
<h2 style={{fontSize:18,fontWeight:600,flex:1}}>{selected?'Edit Account':'New Account'}</h2>
<button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
{saving?'Saving...':'Save Account'}
</button>
</div>
<div className="card" style={{padding:24}}>
<div style={{display:'grid',gap:16}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Account Name *</label>
<input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. KBZ Bank"/>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Account Type *</label>
<select className="form-input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,subType:ACCOUNT_TYPES.find(t=>t.type===e.target.value)?.sub[0]||''}))}>
{ACCOUNT_TYPES.map(t=><option key={t.type} value={t.type}>{t.type}</option>)}
</select>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Sub Type</label>
<select className="form-input" value={form.subType} onChange={e=>setForm(f=>({...f,subType:e.target.value}))}>
{getSubTypes().map(s=><option key={s} value={s}>{s}</option>)}
</select>
</div>
</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Account Code *</label>
<input className="form-input" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} placeholder="e.g. 1001"/>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Opening Balance (Ks)</label>
<input className="form-input" type="number" value={form.openingBalance} onChange={e=>setForm(f=>({...f,openingBalance:e.target.value}))} style={{textAlign:'right'}}/>
</div>
</div>
<div>
<label style={{fontSize:12,fontWeight:500,color:'var(--text-2)',display:'block',marginBottom:4}}>Description</label>
<input className="form-input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Optional description..."/>
</div>
</div>
</div>
</div>
</Layout>
)

return(
<Layout title="Chart of Accounts">

<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,gap:12}}>
<div style={{display:'flex',alignItems:'center',gap:8}}>
<BookOpen size={20} style={{color:'var(--primary)'}}/>
<h2 style={{fontSize:18,fontWeight:600}}>Chart of Accounts</h2>
</div>
<div style={{display:'flex',gap:8}}>
<button type="button" onClick={handleRecalculate} disabled={recalculating} className="btn btn-ghost" style={{fontSize:12}}>
<RefreshCcw size={13} style={{animation:recalculating?'spin 1s linear infinite':undefined}}/>{recalculating?'Recalculating...':'Recalculate'}
</button>
{accounts.length===0&&(
<button type="button" onClick={handleInitDefaults} disabled={initializing} className="btn btn-ghost" style={{fontSize:13}}>
<Building2 size={14}/>{initializing?'Creating...':'Initialize Defaults'}
</button>
)}
<button type="button" onClick={openNew} className="btn btn-primary">
<Plus size={15}/>New Account
</button>
</div>
</div>

<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:20}}>
{ACCOUNT_TYPES.map(t=>(
<div key={t.type} className="card" style={{padding:16,borderTop:`3px solid ${t.color}`}}>
<div style={{fontSize:11,fontWeight:600,color:t.color,textTransform:'uppercase',marginBottom:6}}>{t.type}</div>
<div style={{fontSize:20,fontWeight:700,color:'var(--text-1)',marginBottom:2}}>{accounts.filter(a=>a.type===t.type).length}</div>
<div style={{fontSize:12,fontWeight:600,color:t.color}}>{totalByType(t.type).toLocaleString()} Ks</div>
<div style={{fontSize:10,color:'var(--text-3)',marginTop:2}}>Current Balance</div>
</div>
))}
</div>

{accounts.length>0&&(()=>{
const assets=totalByType('Assets')
const liabilities=totalByType('Liabilities')
const equity=totalByType('Equity')
const income=totalByType('Income')
const expenses=totalByType('Expenses')
const netProfit=income-expenses
const balanced=Math.abs(assets-(liabilities+equity+netProfit))<1
return(
<div className="card" style={{padding:16,marginBottom:16,background:'rgba(79,110,247,0.04)',border:`0.5px solid ${balanced?'rgba(79,110,247,0.2)':'rgba(220,38,38,0.3)'}`}}>
<div style={{fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:10}}>Accounting Equation</div>
<div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
<div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-3)'}}>Assets</div><div style={{fontSize:16,fontWeight:700,color:'#16a34a'}}>{assets.toLocaleString()} Ks</div></div>
<div style={{fontSize:16,color:'var(--text-3)'}}>= </div>
<div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-3)'}}>Liabilities</div><div style={{fontSize:16,fontWeight:700,color:'#dc2626'}}>{liabilities.toLocaleString()} Ks</div></div>
<div style={{fontSize:16,color:'var(--text-3)'}}>+</div>
<div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-3)'}}>Equity</div><div style={{fontSize:16,fontWeight:700,color:'#6366f1'}}>{equity.toLocaleString()} Ks</div></div>
<div style={{fontSize:16,color:'var(--text-3)'}}>+</div>
<div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-3)'}}>Net Profit</div><div style={{fontSize:16,fontWeight:700,color:netProfit>=0?'#4F6EF7':'#dc2626'}}>{netProfit.toLocaleString()} Ks</div></div>
<div style={{marginLeft:'auto',fontSize:12,fontWeight:600,color:balanced?'#16a34a':'#dc2626'}}>{balanced?'✓ Balanced':'✗ Not Balanced'}</div>
</div>
</div>
)
})()}

{accounts.length===0?(
<div className="card" style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<BookOpen size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div style={{fontSize:16,fontWeight:500,marginBottom:8}}>No accounts yet</div>
<div style={{fontSize:13,marginBottom:20}}>Start with default accounts or create your own</div>
<button type="button" onClick={handleInitDefaults} disabled={initializing} className="btn btn-primary">
<Building2 size={15}/>{initializing?'Creating...':'Initialize Default Accounts'}
</button>
</div>
):(
<div style={{display:'flex',flexDirection:'column',gap:12}}>
{ACCOUNT_TYPES.map(t=>{
const typeAccounts=accounts.filter(a=>a.type===t.type)
if(typeAccounts.length===0)return null
const typeTotal=totalByType(t.type)
return(
<div key={t.type} className="card" style={{overflow:'hidden'}}>
<div onClick={()=>toggleExpand(t.type)} style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',background:t.bg,borderBottom:expanded[t.type]?`1px solid ${t.color}20`:'none'}}>
{expanded[t.type]?<ChevronDown size={16} style={{color:t.color}}/>:<ChevronRight size={16} style={{color:t.color}}/>}
<span style={{fontWeight:700,color:t.color,fontSize:14}}>{t.type}</span>
<span style={{fontSize:12,color:t.color,opacity:0.7}}>({typeAccounts.length} accounts)</span>
<span style={{marginLeft:'auto',fontWeight:700,color:t.color,fontSize:14}}>{typeTotal.toLocaleString()} Ks</span>
</div>
{expanded[t.type]&&(
<table>
<thead>
<tr>
<th style={{width:80}}>Code</th>
<th>Account Name</th>
<th>Sub Type</th>
<th>Description</th>
<th style={{textAlign:'right'}}>Opening Bal</th>
<th style={{textAlign:'right'}}>Current Bal</th>
<th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{typeAccounts.sort((a,b)=>(a.code||'').localeCompare(b.code||'')).map(a=>{
const diff=Number(a.currentBalance||a.openingBalance||0)-Number(a.openingBalance||0)
return(
<tr key={a.id}>
<td style={{fontFamily:'monospace',fontSize:12,color:'var(--text-3)'}}>{a.code}</td>
<td style={{fontWeight:500}}>
{a.name}
{a.isDefault&&<span style={{fontSize:10,background:'#f1f5f9',color:'var(--text-3)',padding:'1px 6px',borderRadius:10,marginLeft:6}}>default</span>}
{(a.bankAccountId||a.isBankAccount)&&<span style={{fontSize:10,background:'#dbeafe',color:'#1d4ed8',padding:'1px 6px',borderRadius:10,marginLeft:6}}>bank</span>}
</td>
<td style={{fontSize:12,color:'var(--text-2)'}}>{a.subType}</td>
<td style={{fontSize:12,color:'var(--text-3)'}}>{a.description||'-'}</td>
<td style={{textAlign:'right',fontSize:12,color:'var(--text-3)'}}>{Number(a.openingBalance||0).toLocaleString()} Ks</td>
<td style={{textAlign:'right',fontWeight:600,color:t.color}}>
{Number(a.currentBalance||a.openingBalance||0).toLocaleString()} Ks
{diff!==0&&<div style={{fontSize:10,color:diff>0?'#16a34a':'#dc2626'}}>{diff>0?'+':''}{diff.toLocaleString()}</div>}
</td>
<td style={{textAlign:'center'}}>
{a.isBankAccount?(
<span style={{fontSize:10,color:'var(--text-3)'}}>Bank Accounts ↗</span>
):(
<div style={{display:'flex',gap:4,justifyContent:'center'}}>
<button type="button" onClick={()=>openEdit(a)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Edit size={14}/></button>
<button type="button" onClick={()=>handleDelete(a.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:4,borderRadius:6}}><Trash2 size={14}/></button>
</div>
)}
</td>
</tr>
)
})}
</tbody>
</table>
)}
</div>
)
})}
</div>
)}
</Layout>
)
}
