import{useEffect,useState,useRef}from'react'
import{useParams}from'react-router-dom'
import{db}from'../firebase'
import{collection,getDocs,query,where,doc,getDoc}from'firebase/firestore'
import{CheckCircle,XCircle,Clock,FileText,Building2,Download}from'lucide-react'
import html2canvas from'html2canvas'
import jsPDF from'jspdf'

export default function Verify(){
const{companyId,code}=useParams()
const[invoice,setInvoice]=useState(null)
const[docType,setDocType]=useState('invoice')
const[company,setCompany]=useState(null)
const[settings,setSettings]=useState({})
const[loading,setLoading]=useState(true)
const[notFound,setNotFound]=useState(false)
const[downloading,setDownloading]=useState(false)
const printRef=useRef()

useEffect(()=>{
const load=async()=>{
try{
const[compSnap,sSnap]=await Promise.all([
getDoc(doc(db,'companies',companyId)),
getDoc(doc(db,'companies',companyId,'_config','invoiceSettings'))
])
if(compSnap.exists())setCompany(compSnap.data())
if(sSnap.exists())setSettings(sSnap.data())

const invSnap=await getDocs(query(collection(db,'companies',companyId,'invoices'),where('securityCode','==',code)))
if(!invSnap.empty){
setInvoice({id:invSnap.docs[0].id,...invSnap.docs[0].data()})
setDocType('invoice')
setLoading(false)
return
}

const quoSnap=await getDocs(query(collection(db,'companies',companyId,'quotations'),where('securityCode','==',code)))
if(!quoSnap.empty){
setInvoice({id:quoSnap.docs[0].id,...quoSnap.docs[0].data()})
setDocType('quotation')
setLoading(false)
return
}

const conSnap=await getDocs(query(collection(db,'companies',companyId,'contracts'),where('securityCode','==',code)))
if(!conSnap.empty){
setInvoice({id:conSnap.docs[0].id,...conSnap.docs[0].data()})
setDocType('contract')
setLoading(false)
return
}

setNotFound(true)
}catch(e){console.error(e);setNotFound(true)}
setLoading(false)
}
load()
},[companyId,code])

const handleDownloadPDF=async()=>{
setDownloading(true)
try{
const el=printRef.current
const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff'})
const imgData=canvas.toDataURL('image/png')
const pdf=new jsPDF('p','mm','a4')
const pdfWidth=pdf.internal.pageSize.getWidth()
const pdfHeight=(canvas.height*pdfWidth)/canvas.width
pdf.addImage(imgData,'PNG',0,0,pdfWidth,pdfHeight)
pdf.save(`${invoice?.contractNumber||invoice?.invoiceNumber||invoice?.quotationNumber||'document'}.pdf`)
}catch(e){console.error(e)}
setDownloading(false)
}

const statusColor={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',refunded:'#6366f1',draft:'#64748b',active:'#16a34a',expired:'#d97706',cancelled:'#dc2626'}
const statusBg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',refunded:'#ede9fe',draft:'#f1f5f9',active:'#eaf3de',expired:'#faeeda',cancelled:'#fcebeb'}
const docTypeLabel={invoice:'Invoice',quotation:'Quotation',contract:'Contract'}
const docNumber=invoice?.invoiceNumber||invoice?.quotationNumber||invoice?.contractNumber||'-'

if(loading)return(
<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#e8f0fe,#f0f4ff,#e8f8f0)'}}>
<div style={{textAlign:'center',color:'#9aa0b4'}}>Verifying...</div>
</div>
)

if(notFound)return(
<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#e8f0fe,#f0f4ff,#e8f8f0)'}}>
<div style={{textAlign:'center',padding:40,background:'white',borderRadius:20,boxShadow:'0 8px 32px rgba(0,0,0,0.08)'}}>
<XCircle size={48} color="#dc2626" style={{marginBottom:16}}/>
<div style={{fontSize:20,fontWeight:700,color:'#1a1d2e',marginBottom:8}}>Document Not Found</div>
<div style={{color:'#9aa0b4',fontSize:14}}>This link is invalid or has been removed.</div>
</div>
</div>
)

const s=invoice.status||'pending'
const items=invoice.items||[]
const subtotal=items.reduce((s,i)=>s+(i.qty||1)*(i.price||i.rate||0),0)

return(
<div style={{minHeight:'100vh',width:'100%',background:'linear-gradient(135deg,#e8f0fe,#f0f4ff,#e8f8f0)',padding:20}}>

{/* Download button */}
<div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
<button type="button" onClick={handleDownloadPDF} disabled={downloading} style={{
background:'white',color:'#4F6EF7',border:'none',borderRadius:10,
padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer',
display:'flex',alignItems:'center',gap:8,
boxShadow:'0 4px 16px rgba(79,110,247,0.3)',
}}>
<Download size={15}/>{downloading?'Generating PDF...':'Download PDF'}
</button>
</div>

<div ref={printRef} style={{maxWidth:600,margin:'0 auto',background:'white',borderRadius:20,boxShadow:'0 8px 32px rgba(79,110,247,0.12)',overflow:'hidden'}}>

{/* Header */}
<div style={{background:'#4F6EF7',padding:'28px 32px',color:'white'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
<div style={{width:48,height:48,background:'rgba(255,255,255,0.2)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
{settings.logoUrl?<img src={settings.logoUrl} style={{width:40,height:40,objectFit:'contain'}}/>:<FileText size={20} color="white"/>}
</div>
<div>
<div style={{fontWeight:700,fontSize:18}}>{docTypeLabel[docType]} Verification</div>
<div style={{fontSize:12,opacity:0.8,display:'flex',alignItems:'center',gap:4}}>
<Building2 size={11}/>{company?.name||''}
</div>
</div>
</div>
<div style={{fontSize:13,opacity:0.9}}>{docTypeLabel[docType]} #{docNumber}</div>
</div>

{/* Status */}
<div style={{padding:'20px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{display:'flex',alignItems:'center',gap:12}}>
{s==='paid'||s==='active'?<CheckCircle size={32} color="#16a34a"/>:s==='pending'||s==='draft'?<Clock size={32} color="#d97706"/>:<XCircle size={32} color="#dc2626"/>}
<div>
<div style={{fontSize:13,color:'#9aa0b4',marginBottom:4}}>Status</div>
<span style={{background:statusBg[s]||'#f1f5f9',color:statusColor[s]||'#64748b',padding:'4px 14px',borderRadius:20,fontSize:14,fontWeight:600,textTransform:'capitalize'}}>{s}</span>
</div>
</div>
</div>

{/* Info */}
<div style={{padding:'20px 32px',borderBottom:'1px solid #f1f5f9'}}>
{[
{label:'Company',value:company?.name||'-'},
{label:'Client',value:invoice.clientName||'-'},
{label:'Date',value:invoice.date||invoice.startDate||(invoice.createdAt?.seconds?new Date(invoice.createdAt.seconds*1000).toLocaleDateString():'-')},
{label:'Security Code',value:invoice.securityCode||'-'},
].map(({label,value})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid #f8fafc'}}>
<span style={{fontSize:13,color:'#9aa0b4'}}>{label}</span>
<span style={{fontSize:13,fontWeight:500,color:'#1a1d2e'}}>{value}</span>
</div>
))}
</div>

{/* Contract Content */}
{docType==='contract'&&invoice.content&&(
<div style={{padding:'20px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{fontSize:12,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12}}>Contract Details</div>
{invoice.startDate&&<div style={{fontSize:13,marginBottom:6}}><span style={{color:'#9aa0b4'}}>Start Date: </span><strong>{invoice.startDate}</strong></div>}
{invoice.endDate&&<div style={{fontSize:13,marginBottom:6}}><span style={{color:'#9aa0b4'}}>End Date: </span><strong>{invoice.endDate}</strong></div>}
<div style={{marginTop:16,padding:16,background:'#f8fafc',borderRadius:10,fontSize:13,lineHeight:1.8,color:'#1a1d2e'}} dangerouslySetInnerHTML={{__html:invoice.content}}/>
</div>
)}

{/* Items — invoice/quotation */}
{items.length>0&&docType!=='contract'&&(
<div style={{padding:'20px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{fontSize:12,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12}}>Items</div>
<div style={{overflowX:'auto'}}>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:380}}>
<thead>
<tr style={{borderBottom:'0.5px solid #e2e8f0'}}>
<th style={{textAlign:'left',padding:'6px 8px 6px 0',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Description</th>
<th style={{textAlign:'center',padding:'6px 8px',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase',width:50}}>Qty</th>
<th style={{textAlign:'right',padding:'6px 8px',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase',width:100}}>Rate</th>
<th style={{textAlign:'right',padding:'6px 0 6px 8px',color:'#9aa0b4',fontWeight:600,fontSize:11,textTransform:'uppercase',width:100}}>Total</th>
</tr>
</thead>
<tbody>
{items.map((item,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc'}}>
<td style={{padding:'8px 8px 8px 0',color:'#1a1d2e'}}>{item.desc||item.description||'-'}</td>
<td style={{padding:'8px',textAlign:'center',color:'#64748b'}}>{item.qty||1}</td>
<td style={{padding:'8px',textAlign:'right',color:'#64748b',whiteSpace:'nowrap'}}>{Number(item.price||item.rate||0).toLocaleString()} Ks</td>
<td style={{padding:'8px 0 8px 8px',textAlign:'right',fontWeight:500,color:'#1a1d2e',whiteSpace:'nowrap'}}>{Number((item.qty||1)*(item.price||item.rate||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)}

{/* Totals — invoice/quotation */}
{docType!=='contract'&&(
<div style={{padding:'16px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13}}>
<span style={{color:'#9aa0b4'}}>Subtotal</span>
<span style={{whiteSpace:'nowrap'}}>{subtotal.toLocaleString()} Ks</span>
</div>
{Number(invoice.discount||0)>0&&(
<div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13}}>
<span style={{color:'#9aa0b4'}}>Discount</span>
<span style={{color:'#dc2626',whiteSpace:'nowrap'}}>-{Number(invoice.discount).toLocaleString()} Ks</span>
</div>
)}
{Number(invoice.taxRate||0)>0&&(
<div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13}}>
<span style={{color:'#9aa0b4'}}>Tax ({invoice.taxRate}%)</span>
<span style={{whiteSpace:'nowrap'}}>+{Math.round(subtotal*invoice.taxRate/100).toLocaleString()} Ks</span>
</div>
)}
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 4px',fontSize:15,fontWeight:700,borderTop:'0.5px solid #e2e8f0',marginTop:6}}>
<span style={{color:'#1a1d2e'}}>Total</span>
<span style={{color:'#4F6EF7',whiteSpace:'nowrap'}}>{Number(invoice.totalAmount||0).toLocaleString()} Ks</span>
</div>
</div>
)}

{/* Contract value */}
{docType==='contract'&&invoice.value>0&&(
<div style={{padding:'16px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:15,fontWeight:700}}>
<span style={{color:'#1a1d2e'}}>Contract Value</span>
<span style={{color:'#4F6EF7',whiteSpace:'nowrap'}}>{Number(invoice.value).toLocaleString()} Ks</span>
</div>
</div>
)}

<div style={{padding:'16px 32px',background:'#f8fafc',textAlign:'center',fontSize:12,color:'#9aa0b4'}}>
This document was verified by Ankora-X
</div>
</div>
</div>
)
}
