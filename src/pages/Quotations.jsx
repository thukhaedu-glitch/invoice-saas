import{useState,useEffect,useMemo}from'react'
import{db,auth}from'../firebase'
import{collection,onSnapshot,getDocs,query,where,doc,deleteDoc,addDoc,serverTimestamp}from'firebase/firestore'
import Layout from'../components/Layout'
import{FileCheck,Plus,Edit,Trash2,CopyPlus,Link,Printer,FileText,Search,X}from'lucide-react'
import{useNavigate}from'react-router-dom'
import{useRole}from'../hooks/useRole'
import ConfirmPassword from'../components/ConfirmPassword'
import{syncPublicVerifications}from'../utils/publicVerification'

const months=['01','02','03','04','05','06','07','08','09','10','11','12']
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Quotations(){
const[companyId,setCompanyId]=useState(null)
const[quotations,setQuotations]=useState([])
const[loading,setLoading]=useState(true)
const[search,setSearch]=useState('')
const[filterYear,setFilterYear]=useState('')
const[filterMonth,setFilterMonth]=useState('')
const[filterCustomer,setFilterCustomer]=useState('')
const[confirmAction,setConfirmAction]=useState(null)
const navigate=useNavigate()
const{canEdit,canDelete,loading:roleLoading}=useRole()

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const companyName=snap.docs[0].data().name||''
setCompanyId(cid)
const u=onSnapshot(collection(db,'companies',cid,'quotations'),snap=>{
const docs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
setQuotations(docs)
syncPublicVerifications(cid,companyName,docs,'quotation').catch(console.error)
setLoading(false)
})
return u
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

const getDate=q=>q.date||(q.createdAt?.seconds?new Date(q.createdAt.seconds*1000).toISOString().split('T')[0]:null)

const filtered=useMemo(()=>quotations.filter(q=>{
const d=getDate(q)||''
if(filterYear&&!d.startsWith(filterYear))return false
if(filterMonth&&filterYear&&!d.startsWith(`${filterYear}-${filterMonth}`))return false
if(filterCustomer&&q.clientName!==filterCustomer)return false
if(search&&!q.clientName?.toLowerCase().includes(search.toLowerCase())&&!q.quotationNumber?.toLowerCase().includes(search.toLowerCase()))return false
return true
}),[quotations,filterYear,filterMonth,filterCustomer,search])

const uniqueYears=[...new Set(quotations.map(q=>getDate(q)?.slice(0,4)).filter(Boolean))].sort().reverse()
const uniqueCustomers=[...new Set(quotations.map(q=>q.clientName).filter(Boolean))].sort()

const totalAmt=filtered.reduce((s,q)=>s+Number(q.totalAmount||0),0)

const handleDelete=async(id)=>{
await deleteDoc(doc(db,'companies',companyId,'quotations',id))
}

const handleDeleteWithAuth=(id)=>{
if(!canDelete){alert('No permission to delete');return}
setConfirmAction({action:()=>handleDelete(id),label:'delete this quotation'})
}

const handleShareLink=(item)=>{
const url=`${window.location.origin}/verify/${companyId}/${item.securityCode||item.id}`
navigator.clipboard.writeText(url)
alert('Link copied!')
}

const handleDuplicate=async(item)=>{
if(!confirm('Duplicate this quotation?'))return
try{
const{id:_,...data}=item
await addDoc(collection(db,'companies',companyId,'quotations'),{
...data,
quotationNumber:(item.quotationNumber||'QTN')+'-COPY',
status:'pending',
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
}catch(e){alert(e.message)}
}

const handleConvertToInvoice=async(item)=>{
if(!confirm('Convert this quotation to invoice?'))return
try{
const{id:_,quotationNumber,...data}=item
await addDoc(collection(db,'companies',companyId,'invoices'),{
...data,
invoiceNumber:'INV-'+Date.now().toString().slice(-6),
status:'pending',
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
convertedFrom:item.id,
convertedFromNumber:quotationNumber,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
alert('Converted to Invoice!')
navigate('/invoices')
}catch(e){alert(e.message)}
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>

return(
<Layout title="Quotations">
{confirmAction&&<ConfirmPassword action={confirmAction.label} onConfirm={()=>{confirmAction.action();setConfirmAction(null)}} onCancel={()=>setConfirmAction(null)}/>}

{/* Stats */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
<div className="card" style={{padding:16}}>
<div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:8}}>Total Quotations</div>
<div style={{fontSize:24,fontWeight:700,color:'var(--text-1)'}}>{quotations.length}</div>
</div>
<div className="card" style={{padding:16}}>
<div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:8}}>Filtered</div>
<div style={{fontSize:24,fontWeight:700,color:'var(--primary)'}}>{filtered.length}</div>
</div>
<div className="card" style={{padding:16}}>
<div style={{fontSize:12,fontWeight:500,color:'var(--text-2)',marginBottom:8}}>Total Value</div>
<div style={{fontSize:20,fontWeight:700,color:'#16a34a'}}>{totalAmt.toLocaleString()} Ks</div>
</div>
</div>

{/* Filters */}
<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16,justifyContent:'space-between'}}>
<div style={{display:'flex',gap:8,flexWrap:'wrap',flex:1}}>
<div style={{position:'relative'}}>
<Search size={12} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
<input className="form-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{paddingLeft:26,fontSize:12,padding:'6px 8px 6px 26px',width:140}}/>
</div>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterYear} onChange={e=>{setFilterYear(e.target.value);setFilterMonth('')}}>
<option value="">All Years</option>
{uniqueYears.map(y=><option key={y} value={y}>{y}</option>)}
</select>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
<option value="">All Months</option>
{months.map((m,i)=><option key={m} value={m}>{monthNames[i]}</option>)}
</select>
<select className="form-input" style={{width:'auto',fontSize:12,padding:'6px 8px'}} value={filterCustomer} onChange={e=>setFilterCustomer(e.target.value)}>
<option value="">All Customers</option>
{uniqueCustomers.map(c=><option key={c} value={c}>{c}</option>)}
</select>
{(filterYear||filterMonth||filterCustomer||search)&&(
<button type="button" onClick={()=>{setFilterYear('');setFilterMonth('');setFilterCustomer('');setSearch('')}} className="btn btn-ghost" style={{fontSize:11,padding:'5px 10px',color:'#dc2626'}}>
<X size={12}/>Clear
</button>
)}
</div>
<button type="button" className="btn btn-primary" onClick={()=>navigate('/create-quotation')}>
<Plus size={15}/>New Quotation
</button>
</div>

{/* Table */}
<div className="card" style={{overflow:'hidden'}}>
{filtered.length===0?(
<div style={{padding:64,textAlign:'center',color:'var(--text-3)'}}>
<FileCheck size={40} style={{margin:'0 auto 12px',opacity:0.3}}/>
<div>No quotations found</div>
</div>
):(
<div style={{overflowX:'auto'}}>
<table style={{width:'100%'}}>
<thead>
<tr>
<th>Number</th><th>Client</th><th style={{textAlign:'right'}}>Amount</th><th>Date</th><th style={{textAlign:'center'}}>Actions</th>
</tr>
</thead>
<tbody>
{filtered.map(item=>(
<tr key={item.id}>
<td style={{color:'var(--primary)',fontFamily:'monospace',fontWeight:500,fontSize:12}}>{item.quotationNumber}</td>
<td style={{fontWeight:500}}>{item.clientName}</td>
<td style={{textAlign:'right',fontWeight:500}}>{Number(item.totalAmount||0).toLocaleString()} Ks</td>
<td style={{color:'var(--text-3)',fontSize:12}}>{getDate(item)||'-'}</td>
<td style={{textAlign:'center'}}>
<div style={{display:'flex',gap:4,justifyContent:'center',alignItems:'center'}}>
<button type="button" onClick={()=>navigate(`/quotation/${item.id}`)} title="View" style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:4,borderRadius:6}}><Printer size={14}/></button>
<button type="button" onClick={()=>{if(!canEdit){alert('No permission');return}navigate(`/edit-quotation/${item.id}`)}} title="Edit" style={{background:'none',border:'none',cursor:canEdit?'pointer':'not-allowed',color:canEdit?'var(--text-2)':'var(--text-3)',padding:4,borderRadius:6,opacity:canEdit?1:0.4}}><Edit size={14}/></button>
<button type="button" onClick={()=>handleDuplicate(item)} title="Duplicate" style={{background:'none',border:'none',cursor:'pointer',color:'#8b5cf6',padding:4,borderRadius:6}}><CopyPlus size={14}/></button>
<button type="button" onClick={()=>handleShareLink(item)} title="Share link" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',padding:4,borderRadius:6}}><Link size={14}/></button>
<button type="button" onClick={()=>handleConvertToInvoice(item)} title="Convert to Invoice" style={{background:'none',border:'none',cursor:'pointer',color:'#4F6EF7',padding:4,borderRadius:6}}><FileText size={14}/></button>
<button type="button" onClick={()=>handleDeleteWithAuth(item.id)} title="Delete" style={{background:'none',border:'none',cursor:canDelete?'pointer':'not-allowed',color:canDelete?'var(--danger)':'var(--text-3)',padding:4,borderRadius:6,opacity:canDelete?1:0.4}}><Trash2 size={14}/></button>
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
</Layout>
)
}
