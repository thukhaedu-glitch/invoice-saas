import{useEffect,useState}from'react'
import{useParams,useNavigate}from'react-router-dom'
import{db,auth}from'../firebase'
import{doc,getDoc,getDocs,collection,query,where}from'firebase/firestore'
import{ArrowLeft,Printer,FileText,Building2}from'lucide-react'

export default function InvoiceDetail(){
const{id}=useParams()
const navigate=useNavigate()
const[invoice,setInvoice]=useState(null)
const[company,setCompany]=useState(null)
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const compSnap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!compSnap.empty){
const companyId=compSnap.docs[0].id
const companyData=compSnap.docs[0].data()
setCompany({id:companyId,...companyData})
const invSnap=await getDoc(doc(db,'companies',companyId,'invoices',id))
if(invSnap.exists())setInvoice({id:invSnap.id,...invSnap.data()})
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[id])

const handlePrint=()=>window.print()

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>
if(!invoice)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Invoice not found</div>

const items=invoice.items||[]
const subtotal=items.reduce((s,i)=>s+(i.qty||1)*(i.price||0),0)
const s=invoice.status||'pending'
const statusColor={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',refunded:'#6366f1'}
const statusBg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',refunded:'#ede9fe'}

return(
<>
<style>{`
@media print{
.no-print{display:none!important}
body{background:white!important}
.print-area{box-shadow:none!important;border-radius:0!important;max-width:100%!important}
}
`}</style>

{/* Topbar */}
<div className="no-print" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.9)',backdropFilter:'blur(12px)',borderBottom:'0.5px solid #e2e8f0',padding:'12px 24px',display:'flex',alignItems:'center',gap:12}}>
<button onClick={()=>navigate('/')} className="btn btn-ghost" style={{padding:'8px 12px'}}>
<ArrowLeft size={16}/>
</button>
<span style={{flex:1,fontWeight:500,fontSize:15}}>Invoice #{invoice.invoiceNumber}</span>
<button onClick={handlePrint} className="btn btn-primary">
<Printer size={15}/>Print / PDF
</button>
</div>

{/* Invoice */}
<div style={{minHeight:'100vh',background:'#f8fafc',padding:'80px 24px 40px',display:'flex',justifyContent:'center'}}>
<div className="print-area" style={{width:'100%',maxWidth:680,background:'white',borderRadius:16,boxShadow:'0 4px 32px rgba(0,0,0,0.08)',overflow:'hidden'}}>

{/* Header */}
<div style={{background:'#4F6EF7',padding:'32px 40px',color:'white'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
<div style={{display:'flex',alignItems:'center',gap:12}}>
<div style={{width:44,height:44,background:'rgba(255,255,255,0.2)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center'}}>
<FileText size={22} color="white"/>
</div>
<div>
<div style={{fontWeight:700,fontSize:20}}>{company?.name||'Company'}</div>
<div style={{fontSize:12,opacity:0.8,display:'flex',alignItems:'center',gap:4}}><Building2 size={11}/>Invoice SaaS</div>
</div>
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:22,fontWeight:800}}>INVOICE</div>
<div style={{fontSize:13,opacity:0.9}}>#{invoice.invoiceNumber}</div>
</div>
</div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontSize:11,opacity:0.7,marginBottom:2}}>Bill To</div>
<div style={{fontWeight:600,fontSize:15}}>{invoice.clientName}</div>
{invoice.clientEmail&&<div style={{fontSize:12,opacity:0.8}}>{invoice.clientEmail}</div>}
{invoice.clientPhone&&<div style={{fontSize:12,opacity:0.8}}>{invoice.clientPhone}</div>}
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:11,opacity:0.7,marginBottom:2}}>Date</div>
<div style={{fontSize:13}}>{invoice.date||(invoice.createdAt?.seconds?new Date(invoice.createdAt.seconds*1000).toLocaleDateString():'-')}</div>
<div style={{marginTop:8}}>
<span style={{background:statusBg[s],color:statusColor[s],padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{s}</span>
</div>
</div>
</div>
</div>

{/* Items */}
<div style={{padding:'32px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
<thead>
<tr style={{borderBottom:'0.5px solid #e2e8f0'}}>
<th style={{textAlign:'left',padding:'8px 0',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Description</th>
<th style={{textAlign:'center',padding:'8px',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase',width:60}}>Qty</th>
<th style={{textAlign:'right',padding:'8px',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase',width:110}}>Rate</th>
<th style={{textAlign:'right',padding:'8px 0',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase',width:110}}>Total</th>
</tr>
</thead>
<tbody>
{items.map((item,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc'}}>
<td style={{padding:'10px 0',color:'#1a1d2e'}}>{item.desc||item.description||'-'}</td>
<td style={{padding:'10px 8px',textAlign:'center',color:'#64748b'}}>{item.qty||1}</td>
<td style={{padding:'10px 8px',textAlign:'right',color:'#64748b'}}>{Number(item.price||0).toLocaleString()} Ks</td>
<td style={{padding:'10px 0',textAlign:'right',fontWeight:500}}>{Number((item.qty||1)*(item.price||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>

{/* Totals */}
<div style={{padding:'24px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{maxWidth:240,marginLeft:'auto'}}>
{[
{label:'Subtotal',value:`${subtotal.toLocaleString()} Ks`},
...(Number(invoice.discount||0)>0?[{label:'Discount',value:`-${Number(invoice.discount).toLocaleString()} Ks`,color:'#dc2626'}]:[]),
...(Number(invoice.taxRate||0)>0?[{label:`Tax (${invoice.taxRate}%)`,value:`+${Math.round(subtotal*invoice.taxRate/100).toLocaleString()} Ks`}]:[]),
].map(({label,value,color})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13}}>
<span style={{color:'#9aa0b4'}}>{label}</span>
<span style={{color:color||'#1a1d2e'}}>{value}</span>
</div>
))}
<div style={{display:'flex',justifyContent:'space-between',padding:'12px 0 4px',fontSize:16,fontWeight:700,borderTop:'0.5px solid #e2e8f0',marginTop:4}}>
<span>Total</span>
<span style={{color:'#4F6EF7'}}>{Number(invoice.totalAmount||0).toLocaleString()} Ks</span>
</div>
</div>
</div>

{/* Note */}
{invoice.note&&(
<div style={{padding:'20px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:6}}>Note</div>
<div style={{fontSize:13,color:'#64748b'}}>{invoice.note}</div>
</div>
)}

{/* Footer */}
<div style={{padding:'20px 40px',background:'#f8fafc',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontSize:12,color:'#9aa0b4'}}>Security: {invoice.securityCode}</div>
<div style={{fontSize:12,color:'#9aa0b4'}}>Generated by Invoice SaaS</div>
</div>
</div>
</div>
</>
)
}
