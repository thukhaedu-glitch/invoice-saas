import{useEffect,useState,useRef}from'react'
import{useParams}from'react-router-dom'
import{db}from'../firebase'
import{collection,getDocs,query,where,doc,getDoc}from'firebase/firestore'
import{CheckCircle,XCircle,Clock,FileText,Building2,Download}from'lucide-react'
import{QRCodeSVG}from'qrcode.react'
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
if(!invSnap.empty){setInvoice({id:invSnap.docs[0].id,...invSnap.docs[0].data()});setDocType('invoice');setLoading(false);return}

const quoSnap=await getDocs(query(collection(db,'companies',companyId,'quotations'),where('securityCode','==',code)))
if(!quoSnap.empty){setInvoice({id:quoSnap.docs[0].id,...quoSnap.docs[0].data()});setDocType('quotation');setLoading(false);return}

const conSnap=await getDocs(query(collection(db,'companies',companyId,'contracts'),where('securityCode','==',code)))
if(!conSnap.empty){setInvoice({id:conSnap.docs[0].id,...conSnap.docs[0].data()});setDocType('contract');setLoading(false);return}

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
pdf.save(`${invoice?.invoiceNumber||invoice?.quotationNumber||invoice?.contractNumber||'document'}.pdf`)
}catch(e){console.error(e)}
setDownloading(false)
}

const statusColor={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',refunded:'#6366f1',draft:'#64748b',active:'#16a34a',expired:'#d97706',cancelled:'#dc2626',pending_approval:'#4F6EF7',rejected:'#dc2626'}
const statusBg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',refunded:'#ede9fe',draft:'#f1f5f9',active:'#eaf3de',expired:'#faeeda',cancelled:'#fcebeb',pending_approval:'rgba(79,110,247,0.1)',rejected:'#fcebeb'}
const docTypeLabel={invoice:'Invoice',quotation:'Quotation',contract:'Contract'}
const docNumber=invoice?.invoiceNumber||invoice?.quotationNumber||invoice?.contractNumber||'-'
const primaryColor=settings.primaryColor||'#4F6EF7'
const verifyUrl=`${window.location.origin}/verify/${companyId}/${code}`

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

// Verify Card
const VerifyCard=()=>(
<div style={{width:'100%',maxWidth:600,background:'white',borderRadius:20,boxShadow:'0 8px 32px rgba(79,110,247,0.12)',overflow:'hidden',marginBottom:16}}>
<div style={{background:'#4F6EF7',padding:'28px 32px',color:'white'}}>
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
<div style={{width:48,height:48,background:'rgba(255,255,255,0.2)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
{settings.logoUrl?<img src={settings.logoUrl} style={{width:40,height:40,objectFit:'contain',background:'white',borderRadius:6,padding:2}}/>:<FileText size={20} color="white"/>}
</div>
<div>
<div style={{fontWeight:700,fontSize:18}}>{docTypeLabel[docType]} Verification</div>
<div style={{fontSize:12,opacity:0.8,display:'flex',alignItems:'center',gap:4}}><Building2 size={11}/>{company?.name||''}</div>
</div>
</div>
<div style={{fontSize:13,opacity:0.9}}>{docTypeLabel[docType]} #{docNumber}</div>
</div>
<div style={{padding:'20px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{display:'flex',alignItems:'center',gap:12}}>
{s==='paid'||s==='active'?<CheckCircle size={32} color="#16a34a"/>:s==='pending'||s==='draft'?<Clock size={32} color="#d97706"/>:<XCircle size={32} color="#dc2626"/>}
<div>
<div style={{fontSize:13,color:'#9aa0b4',marginBottom:4}}>Status</div>
<span style={{background:statusBg[s]||'#f1f5f9',color:statusColor[s]||'#64748b',padding:'4px 14px',borderRadius:20,fontSize:14,fontWeight:600,textTransform:'capitalize'}}>{s}</span>
</div>
</div>
</div>
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
{items.length>0&&docType!=='contract'&&(
<div style={{padding:'16px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{fontSize:12,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:8}}>Items</div>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
<tbody>
{items.map((item,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc'}}>
<td style={{padding:'6px 0',color:'#1a1d2e'}}>{item.desc||item.description||'-'}</td>
<td style={{padding:'6px 8px',textAlign:'center',color:'#64748b'}}>{item.qty||1}</td>
<td style={{padding:'6px 0',textAlign:'right',fontWeight:500,color:'#1a1d2e',whiteSpace:'nowrap'}}>{Number((item.qty||1)*(item.price||item.rate||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 0',fontSize:15,fontWeight:700,borderTop:'0.5px solid #e2e8f0',marginTop:8}}>
<span>Total</span>
<span style={{color:'#4F6EF7'}}>{Number(invoice.totalAmount||0).toLocaleString()} Ks</span>
</div>
</div>
)}
{docType==='contract'&&invoice.value>0&&(
<div style={{padding:'16px 32px',borderBottom:'1px solid #f1f5f9'}}>
<div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:700}}>
<span>Contract Value</span>
<span style={{color:'#4F6EF7'}}>{Number(invoice.value).toLocaleString()} Ks</span>
</div>
</div>
)}
<div style={{padding:'20px 32px',background:'#f8fafc',textAlign:'center'}}>
<button type="button" onClick={handleDownloadPDF} disabled={downloading} style={{
background:'#4F6EF7',color:'white',border:'none',borderRadius:10,
padding:'10px 24px',fontSize:13,fontWeight:600,cursor:'pointer',
display:'inline-flex',alignItems:'center',gap:8,
boxShadow:'0 4px 16px rgba(79,110,247,0.3)',marginBottom:12,
}}>
<Download size={15}/>{downloading?'Generating PDF...':'Download PDF'}
</button>
<div style={{fontSize:12,color:'#9aa0b4'}}>This document was verified by Ankora-X</div>
</div>
</div>
)

return(
<div style={{minHeight:'100vh',width:'100%',background:'linear-gradient(135deg,#e8f0fe,#f0f4ff,#e8f8f0)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20}}>

<VerifyCard/>

{/* Hidden PDF area */}
<div style={{position:'absolute',left:'-9999px',top:0}}>
<div ref={printRef} style={{width:'210mm',background:'white',overflow:'hidden',fontFamily:'Georgia,serif'}}>

{/* Invoice format */}
{docType==='invoice'&&(
<>
<div style={{background:primaryColor,padding:'32px 40px',color:'white'}}>
{settings.logoUrl&&<div style={{marginBottom:12}}><img src={settings.logoUrl} style={{height:56,objectFit:'contain'}}/></div>}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
<div style={{fontWeight:700,fontSize:20}}>{company?.name}</div>
{settings.companyAddress&&<div style={{fontSize:11,opacity:0.8,marginTop:2}}>{settings.companyAddress}</div>}
{settings.companyPhone&&<div style={{fontSize:11,opacity:0.8}}>{settings.companyPhone}</div>}
{settings.companyEmail&&<div style={{fontSize:11,opacity:0.8}}>{settings.companyEmail}</div>}
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:24,fontWeight:800,letterSpacing:1}}>INVOICE</div>
<div style={{fontSize:13,opacity:0.9}}>#{invoice.invoiceNumber}</div>
<div style={{marginTop:8}}>
<span style={{background:statusBg[s]||'#faeeda',color:statusColor[s]||'#d97706',padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{s}</span>
</div>
</div>
</div>
<div style={{marginTop:20,paddingTop:16,borderTop:'0.5px solid rgba(255,255,255,0.2)',display:'flex',justifyContent:'space-between'}}>
<div>
<div style={{fontSize:10,opacity:0.7,marginBottom:4,textTransform:'uppercase'}}>Bill To</div>
<div style={{fontWeight:600,fontSize:14}}>{invoice.clientName}</div>
{invoice.clientEmail&&<div style={{fontSize:11,opacity:0.8}}>{invoice.clientEmail}</div>}
{invoice.clientPhone&&<div style={{fontSize:11,opacity:0.8}}>{invoice.clientPhone}</div>}
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:10,opacity:0.7,marginBottom:4,textTransform:'uppercase'}}>Date</div>
<div style={{fontSize:13}}>{invoice.date||'-'}</div>
</div>
</div>
</div>

<div style={{padding:'24px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
<thead>
<tr style={{borderBottom:`2px solid ${primaryColor}`}}>
<th style={{textAlign:'left',padding:'8px 0',color:primaryColor,fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Description</th>
<th style={{textAlign:'center',padding:'8px',color:primaryColor,fontWeight:600,fontSize:11,textTransform:'uppercase',width:60}}>Qty</th>
<th style={{textAlign:'right',padding:'8px',color:primaryColor,fontWeight:600,fontSize:11,textTransform:'uppercase',width:110}}>Rate</th>
<th style={{textAlign:'right',padding:'8px 0',color:primaryColor,fontWeight:600,fontSize:11,textTransform:'uppercase',width:110}}>Total</th>
</tr>
</thead>
<tbody>
{items.map((item,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc'}}>
<td style={{padding:'10px 0',color:'#1a1d2e'}}>{item.desc||'-'}</td>
<td style={{padding:'10px 8px',textAlign:'center',color:'#64748b'}}>{item.qty||1}</td>
<td style={{padding:'10px 8px',textAlign:'right',color:'#64748b'}}>{Number(item.price||0).toLocaleString()} Ks</td>
<td style={{padding:'10px 0',textAlign:'right',fontWeight:500,color:'#1a1d2e'}}>{Number((item.qty||1)*(item.price||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>

<div style={{padding:'20px 40px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'flex-end'}}>
<div style={{minWidth:220}}>
<div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13}}>
<span style={{color:'#9aa0b4'}}>Subtotal</span>
<span>{subtotal.toLocaleString()} Ks</span>
</div>
{Number(invoice.discount||0)>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13}}><span style={{color:'#9aa0b4'}}>Discount</span><span style={{color:'#dc2626'}}>-{Number(invoice.discount).toLocaleString()} Ks</span></div>}
{Number(invoice.taxRate||0)>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13}}><span style={{color:'#9aa0b4'}}>Tax ({invoice.taxRate}%)</span><span>+{Math.round(subtotal*invoice.taxRate/100).toLocaleString()} Ks</span></div>}
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:16,fontWeight:700,borderTop:`2px solid ${primaryColor}`,marginTop:6}}>
<span>Total</span><span style={{color:primaryColor}}>{Number(invoice.totalAmount||0).toLocaleString()} Ks</span>
</div>
</div>
</div>

{settings.paymentMethods?.length>0&&(
<div style={{padding:'16px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:10}}>Payment Methods</div>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
<thead><tr style={{borderBottom:`1px solid ${primaryColor}30`}}>
<th style={{textAlign:'left',padding:'6px 0',color:primaryColor,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Bank Name</th>
<th style={{textAlign:'left',padding:'6px 8px',color:primaryColor,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Account No.</th>
<th style={{textAlign:'left',padding:'6px 0',color:primaryColor,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Account Name</th>
</tr></thead>
<tbody>
{settings.paymentMethods.map((m,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc'}}>
<td style={{padding:'7px 0',color:'#1a1d2e',fontWeight:500}}>{m.bankName}</td>
<td style={{padding:'7px 8px',color:'#64748b',fontFamily:'monospace'}}>{m.accountNo}</td>
<td style={{padding:'7px 0',color:'#64748b'}}>{m.accountName}</td>
</tr>
))}
</tbody>
</table>
</div>
)}

{settings.paymentTerms&&<div style={{padding:'12px 40px',borderBottom:'0.5px solid #f1f5f9'}}><span style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase'}}>Payment Terms: </span><span style={{fontSize:12,color:'#64748b'}}>{settings.paymentTerms}</span></div>}

{invoice.payments?.length>0&&(
<div style={{padding:'16px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:10}}>Payment History</div>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
<thead><tr style={{borderBottom:`1px solid ${primaryColor}30`}}>
<th style={{textAlign:'left',padding:'6px 0',color:primaryColor,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Date</th>
<th style={{textAlign:'left',padding:'6px 8px',color:primaryColor,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Method</th>
<th style={{textAlign:'right',padding:'6px 0',color:primaryColor,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Amount</th>
</tr></thead>
<tbody>
{invoice.payments.map((p,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc'}}>
<td style={{padding:'7px 0',color:'#1a1d2e'}}>{p.date||'-'}</td>
<td style={{padding:'7px 8px',color:'#64748b'}}>{p.method||'-'}</td>
<td style={{padding:'7px 0',textAlign:'right',fontWeight:600,color:'#16a34a'}}>{Number(p.amount||0).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
<div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',marginTop:6,borderTop:`1px solid ${primaryColor}30`,fontSize:13}}>
<span style={{color:'#9aa0b4'}}>Total Paid</span>
<span style={{fontWeight:700,color:'#16a34a'}}>{Number(invoice.paidAmount||0).toLocaleString()} Ks</span>
</div>
</div>
)}

<div style={{padding:'20px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:16}}>Authorized Signatures</div>
<div style={{display:'grid',gridTemplateColumns:`repeat(${invoice.ownerApprovedBy?3:invoice.approvedBy?2:1},1fr)`,gap:24}}>
<div>
<div style={{height:64,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',paddingBottom:4}}>
<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{invoice.staffName||'—'}</span>
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase'}}>Prepared by</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{invoice.staffName||'Staff'}</div>
</div>
</div>
</div>

<div style={{padding:'16px 40px',background:'#f8fafc',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
{settings.footerText&&<div style={{fontSize:12,color:'#9aa0b4',marginBottom:4}}>{settings.footerText}</div>}
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>This invoice is system-generated and does not require a physical seal.</div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>Verify authenticity by scanning the QR code.</div>
<div style={{fontSize:10,color:'#9aa0b4'}}>System developed by Ankora-X</div>
</div>
<div style={{textAlign:'center'}}>
<QRCodeSVG value={verifyUrl} size={64} fgColor={primaryColor}/>
<div style={{fontSize:9,color:'#9aa0b4',marginTop:4}}>Scan to verify</div>
</div>
</div>
</>
)}

{/* Quotation format */}
{docType==='quotation'&&(
<>
<div style={{padding:'32px 40px 20px',borderBottom:`3px solid ${primaryColor}`}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
{settings.logoUrl&&<img src={settings.logoUrl} style={{height:56,objectFit:'contain',marginBottom:8}}/>}
<div style={{fontSize:20,fontWeight:700,color:'#1a1d2e'}}>{company?.name}</div>
{settings.companyAddress&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>{settings.companyAddress}</div>}
{settings.companyPhone&&<div style={{fontSize:12,color:'#64748b'}}>{settings.companyPhone}</div>}
{settings.companyEmail&&<div style={{fontSize:12,color:'#64748b'}}>{settings.companyEmail}</div>}
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:28,fontWeight:700,color:primaryColor,letterSpacing:2}}>QUOTATION</div>
<div style={{fontSize:13,color:'#64748b',marginTop:4}}>{invoice.quotationNumber}</div>
<div style={{fontSize:12,color:'#64748b',marginTop:2}}>Date: {invoice.date||'-'}</div>
</div>
</div>
</div>

<div style={{padding:'20px 40px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',marginBottom:6}}>Bill To</div>
<div style={{fontWeight:600,fontSize:15,color:'#1a1d2e'}}>{invoice.clientName}</div>
{invoice.clientEmail&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>{invoice.clientEmail}</div>}
</div>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',marginBottom:6}}>Quotation Details</div>
<div style={{fontSize:12,color:'#64748b'}}>Number: <strong style={{color:'#1a1d2e'}}>{invoice.quotationNumber}</strong></div>
<div style={{fontSize:12,color:'#64748b',marginTop:2}}>Date: <strong style={{color:'#1a1d2e'}}>{invoice.date}</strong></div>
</div>
</div>

<div style={{padding:'0 40px 20px'}}>
<table style={{width:'100%',borderCollapse:'collapse'}}>
<thead>
<tr style={{background:primaryColor}}>
<th style={{padding:'10px 12px',textAlign:'left',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase'}}>#</th>
<th style={{padding:'10px 12px',textAlign:'left',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase'}}>Description</th>
<th style={{padding:'10px 12px',textAlign:'center',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase'}}>Qty</th>
<th style={{padding:'10px 12px',textAlign:'right',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase'}}>Price</th>
<th style={{padding:'10px 12px',textAlign:'right',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase'}}>Amount</th>
</tr>
</thead>
<tbody>
{items.map((item,i)=>(
<tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}>
<td style={{padding:'10px 12px',fontSize:12,color:'#64748b'}}>{i+1}</td>
<td style={{padding:'10px 12px',fontSize:13}}>{item.desc||'-'}</td>
<td style={{padding:'10px 12px',textAlign:'center',fontSize:13}}>{item.qty||1}</td>
<td style={{padding:'10px 12px',textAlign:'right',fontSize:13}}>{Number(item.price||0).toLocaleString()} Ks</td>
<td style={{padding:'10px 12px',textAlign:'right',fontSize:13,fontWeight:500}}>{Number((item.qty||1)*(item.price||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>

<div style={{padding:'0 40px 24px',display:'flex',justifyContent:'flex-end'}}>
<div style={{width:240}}>
<div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13,color:'#64748b'}}>
<span>Subtotal</span><span>{subtotal.toLocaleString()} Ks</span>
</div>
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 12px',background:primaryColor,borderRadius:8,marginTop:8,color:'white',fontWeight:700,fontSize:15}}>
<span>Total</span><span>{Number(invoice.totalAmount||0).toLocaleString()} Ks</span>
</div>
</div>
</div>

{settings.paymentMethods?.length>0&&(
<div style={{padding:'0 40px 20px'}}>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',marginBottom:8}}>Payment Information</div>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
{settings.paymentMethods.map((pm,i)=>(
<div key={i} style={{padding:'8px 12px',background:'#f8fafc',borderRadius:8,fontSize:12}}>
<div style={{fontWeight:600,color:'#1a1d2e'}}>{pm.bankName}</div>
{pm.accountNo&&<div style={{color:'#64748b',marginTop:2}}>{pm.accountNo}</div>}
{pm.accountName&&<div style={{color:'#64748b'}}>{pm.accountName}</div>}
</div>
))}
</div>
</div>
)}

<div style={{padding:'16px 40px',background:'#f8fafc',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
{settings.footerText&&<div style={{fontSize:11,color:'#9aa0b4',marginBottom:4}}>{settings.footerText}</div>}
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>This quotation is system-generated and does not require a physical seal.</div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>Verify authenticity by scanning the QR code.</div>
<div style={{fontSize:10,color:'#9aa0b4'}}>System developed by Ankora-X</div>
</div>
<div style={{textAlign:'center'}}>
<QRCodeSVG value={verifyUrl} size={64} fgColor={primaryColor}/>
<div style={{fontSize:9,color:'#9aa0b4',marginTop:4}}>Scan to verify</div>
</div>
</div>
</>
)}

{/* Contract format */}
{docType==='contract'&&(
<>
<div style={{padding:'40px 50px'}}>
<div style={{textAlign:'center',marginBottom:32,borderBottom:'2px solid #1a1d2e',paddingBottom:24}}>
{settings.logoUrl&&<img src={settings.logoUrl} style={{height:60,objectFit:'contain',marginBottom:12}}/>}
<div style={{fontSize:22,fontWeight:700,color:'#1a1d2e',letterSpacing:1}}>{invoice.title}</div>
<div style={{fontSize:13,color:'#64748b',marginTop:6}}>{invoice.contractNumber}</div>
</div>

<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32,marginBottom:28,padding:'16px 0',borderBottom:'0.5px solid #e2e8f0'}}>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',marginBottom:6}}>Party A (Service Provider)</div>
<div style={{fontWeight:600,fontSize:15}}>{company?.name}</div>
{settings.companyAddress&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>{settings.companyAddress}</div>}
{settings.companyEmail&&<div style={{fontSize:12,color:'#64748b'}}>{settings.companyEmail}</div>}
{settings.companyPhone&&<div style={{fontSize:12,color:'#64748b'}}>{settings.companyPhone}</div>}
</div>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',marginBottom:6}}>Party B (Client)</div>
<div style={{fontWeight:600,fontSize:15}}>{invoice.clientName}</div>
{invoice.clientEmail&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>{invoice.clientEmail}</div>}
{invoice.clientPhone&&<div style={{fontSize:12,color:'#64748b'}}>{invoice.clientPhone}</div>}
</div>
</div>

<div style={{display:'flex',gap:24,marginBottom:28,fontSize:13,flexWrap:'wrap'}}>
{invoice.startDate&&<div><span style={{color:'#9aa0b4'}}>Start Date: </span><strong>{invoice.startDate}</strong></div>}
{invoice.endDate&&<div><span style={{color:'#9aa0b4'}}>End Date: </span><strong>{invoice.endDate}</strong></div>}
{invoice.value>0&&<div><span style={{color:'#9aa0b4'}}>Contract Value: </span><strong>{Number(invoice.value).toLocaleString()} Ks</strong></div>}
<div><span style={{color:'#9aa0b4'}}>Status: </span><strong style={{textTransform:'capitalize'}}>{invoice.status}</strong></div>
</div>

<div style={{marginBottom:40,lineHeight:1.8,fontSize:13}} dangerouslySetInnerHTML={{__html:invoice.content}}/>

<div style={{marginTop:40,paddingTop:24,borderTop:'0.5px solid #e2e8f0'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:16}}>Authorized Signatures</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40,marginBottom:24}}>
<div>
<div style={{borderBottom:'1.5px solid #1a1d2e',paddingBottom:4,marginBottom:8,minHeight:48,display:'flex',alignItems:'flex-end'}}>
<span style={{fontSize:13,color:'#64748b',fontStyle:'italic'}}>{invoice.partyASign||''}</span>
</div>
<div style={{fontSize:11,color:'#9aa0b4'}}>Party A Signature</div>
<div style={{fontSize:12,fontWeight:500,marginTop:2}}>{company?.name}</div>
</div>
<div>
<div style={{borderBottom:'1.5px solid #1a1d2e',paddingBottom:4,marginBottom:8,minHeight:48,display:'flex',alignItems:'flex-end'}}>
<span style={{fontSize:13,color:'#64748b',fontStyle:'italic'}}>{invoice.partyBSign||''}</span>
</div>
<div style={{fontSize:11,color:'#9aa0b4'}}>Party B Signature</div>
<div style={{fontSize:12,fontWeight:500,marginTop:2}}>{invoice.clientName}</div>
</div>
</div>
</div>

<div style={{marginTop:32,paddingTop:16,borderTop:'0.5px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>This contract is system-generated and does not require a physical seal.</div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>Verify authenticity by scanning the QR code.</div>
<div style={{fontSize:10,color:'#9aa0b4'}}>System developed by Ankora-X</div>
</div>
<div style={{textAlign:'center'}}>
<QRCodeSVG value={verifyUrl} size={64} fgColor="#1a1d2e"/>
<div style={{fontSize:9,color:'#9aa0b4',marginTop:4}}>Scan to verify</div>
</div>
</div>
</div>
</>
)}

</div>
</div>

</div>
)
}
