import{useEffect,useState}from'react'
import{useParams}from'react-router-dom'
import{db}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import{CheckCircle,XCircle,Clock,FileText}from'lucide-react'

export default function Verify(){
const{companyId,code}=useParams()
const[invoice,setInvoice]=useState(null)
const[loading,setLoading]=useState(true)
const[notFound,setNotFound]=useState(false)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies',companyId,'invoices'),where('securityCode','==',code)))
if(!snap.empty)setInvoice({id:snap.docs[0].id,...snap.docs[0].data()})
else setNotFound(true)
}catch(e){console.error(e);setNotFound(true)}
setLoading(false)
}
load()
},[companyId,code])

const statusColor={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',refunded:'#6366f1'}
const statusBg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',refunded:'#ede9fe'}

if(loading)return(
<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#e8f0fe,#f0f4ff,#e8f8f0)'}}>
<div style={{textAlign:'center',color:'#9aa0b4'}}>Verifying...</div>
</div>
)

if(notFound)return(
<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#e8f0fe,#f0f4ff,#e8f8f0)'}}>
<div style={{textAlign:'center',padding:40,background:'white',borderRadius:20,boxShadow:'0 8px 32px rgba(0,0,0,0.08)'}}>
<XCircle size={48} color="#dc2626" style={{marginBottom:16}}/>
<div style={{fontSize:20,fontWeight:700,color:'#1a1d2e',marginBottom:8}}>Invoice Not Found</div>
<div style={{color:'#9aa0b4',fontSize:14}}>This link is invalid or has been removed.</div>
</div>
</div>
)

const s=invoice.status||'pending'
return(
<div style={{minHeight:'100vh',background:'linear-gradient(135deg,#e8f0fe,#f0f4ff,#e8f8f0)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{width:'100%',maxWidth:560,background:'white',borderRadius:20,boxShadow:'0 8px 32px rgba(79,110,247,0.12)',overflow:'hidden'}}>
<div style={{background:'#4F6EF7',padding:'28px 32px',color:'white'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
<div style={{width:40,height:40,background:'rgba(255,255,255,0.2)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
<FileText size={20} color="white"/>
</div>
<div>
<div style={{fontWeight:700,fontSize:18}}>Invoice Verification</div>
<div style={{fontSize:12,opacity:0.8}}>Invoice SaaS</div>
</div>
</div>
<div style={{fontSize:13,opacity:0.9}}>Invoice #{invoice.invoiceNumber}</div>
</div>
<div style={{padding:'24px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{display:'flex',alignItems:'center',gap:12}}>
{s==='paid'?<CheckCircle size={32} color="#16a34a"/>:s==='pending'?<Clock size={32} color="#d97706"/>:<XCircle size={32} color="#dc2626"/>}
<div>
<div style={{fontSize:13,color:'#9aa0b4',marginBottom:4}}>Payment Status</div>
<span style={{background:statusBg[s]||'#f1f5f9',color:statusColor[s]||'#64748b',padding:'4px 14px',borderRadius:20,fontSize:14,fontWeight:600,textTransform:'capitalize'}}>{s}</span>
</div>
</div>
</div>
<div style={{padding:'24px 32px'}}>
{[
{label:'Client',value:invoice.clientName},
{label:'Amount',value:`${Number(invoice.totalAmount||0).toLocaleString()} Ks`},
{label:'Date',value:invoice.date||'-'},
{label:'Security Code',value:invoice.securityCode||'-'},
].map(({label,value})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'0.5px solid #f1f5f9'}}>
<span style={{fontSize:13,color:'#9aa0b4'}}>{label}</span>
<span style={{fontSize:13,fontWeight:500,color:'#1a1d2e'}}>{value}</span>
</div>
))}
</div>
<div style={{padding:'16px 32px',background:'#f8fafc',textAlign:'center',fontSize:12,color:'#9aa0b4'}}>
This invoice was verified by Invoice SaaS
</div>
</div>
</div>
)
}
