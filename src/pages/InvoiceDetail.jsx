import{useEffect,useState,useRef}from'react'
import{useParams,useNavigate}from'react-router-dom'
import{db,auth}from'../firebase'
import{doc,getDoc,getDocs,collection,query,where}from'firebase/firestore'
import{ArrowLeft,Printer,Download}from'lucide-react'
import{QRCodeSVG}from'qrcode.react'
import jsPDF from'jspdf'
import html2canvas from'html2canvas'

export default function InvoiceDetail(){
const{id}=useParams()
const navigate=useNavigate()
const printRef=useRef()
const[invoice,setInvoice]=useState(null)
const[company,setCompany]=useState(null)
const[settings,setSettings]=useState({
template:'classic',primaryColor:'#4F6EF7',
logoUrl:'',logoPosition:'left',titlePosition:'left',
footerText:'Thank you for your business!',showQR:true,
companyPhone:'',companyEmail:'',companyAddress:'',companyWebsite:'',
trnNumber:'',paymentTerms:'Due on receipt',paymentMethods:'',
})
const[loading,setLoading]=useState(true)
const[downloading,setDownloading]=useState(false)

useEffect(()=>{
const load=async()=>{
try{
const compSnap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!compSnap.empty){
const cid=compSnap.docs[0].id
const compData=compSnap.docs[0].data()
setCompany({id:cid,...compData})
const[invSnap,sSnap]=await Promise.all([
getDoc(doc(db,'companies',cid,'invoices',id)),
getDoc(doc(db,'companies',cid,'_config','invoiceSettings'))
])
if(invSnap.exists())setInvoice({id:invSnap.id,...invSnap.data()})
if(sSnap.exists())setSettings(s=>({...s,...sSnap.data()}))
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[id])

const handlePrint=()=>window.print()

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
pdf.save(`${invoice.invoiceNumber||'invoice'}.pdf`)
}catch(e){console.error(e)}
setDownloading(false)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>
if(!invoice)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Invoice not found</div>

const items=invoice.items||[]
const subtotal=items.reduce((s,i)=>s+(i.qty||1)*(i.price||0),0)
const s=invoice.status||'pending'
const pc=settings.primaryColor
const verifyUrl=`${window.location.origin}/verify/${company?.id}/${invoice.securityCode}`

const statusColor={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',refunded:'#6366f1'}
const statusBg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',refunded:'#ede9fe'}

const getHeaderStyle=()=>{
if(settings.template==='modern')return{background:'#1a1d2e',color:'white'}
if(settings.template==='minimal')return{background:'white',color:'#1a1d2e',borderBottom:`3px solid ${pc}`}
if(settings.template==='elegant')return{background:`linear-gradient(135deg,${pc},${pc}cc)`,color:'white'}
return{background:pc,color:'white'}
}

const alignStyle=pos=>({textAlign:pos,display:'flex',justifyContent:pos==='left'?'flex-start':pos==='right'?'flex-end':'center'})
const headerTextColor=settings.template==='minimal'?'#1a1d2e':'white'

return(
<>
<style>{`
@media print{
.no-print{display:none!important}
body{background:white!important;margin:0}
.print-area{box-shadow:none!important;border-radius:0!important;max-width:100%!important;margin:0!important}
@page{size:A4;margin:0}
}
`}</style>

{/* Topbar */}
<div className="no-print" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',borderBottom:'0.5px solid #e2e8f0',padding:'12px 24px',display:'flex',alignItems:'center',gap:12}}>
<button onClick={()=>navigate('/')} className="btn btn-ghost" style={{padding:'8px 12px'}}>
<ArrowLeft size={16}/>
</button>
<span style={{flex:1,fontWeight:500,fontSize:15}}>Invoice #{invoice.invoiceNumber}</span>
<button onClick={handlePrint} className="btn btn-ghost no-print">
<Printer size={15}/>Print
</button>
<button onClick={handleDownloadPDF} disabled={downloading} className="btn btn-primary no-print">
<Download size={15}/>{downloading?'Generating...':'Download PDF'}
</button>
</div>

{/* Invoice */}
<div style={{minHeight:'100vh',background:'#f1f5f9',padding:'80px 24px 40px',display:'flex',justifyContent:'center'}}>
<div ref={printRef} className="print-area" style={{width:'210mm',background:'white',boxShadow:'0 4px 32px rgba(0,0,0,0.08)',overflow:'hidden'}}>

{/* Header */}
<div style={{...getHeaderStyle(),padding:'32px 40px'}}>
{settings.logoUrl&&(
<div style={{...alignStyle(settings.logoPosition),marginBottom:16}}>
<img src={settings.logoUrl} style={{height:60,objectFit:'contain'}}/>
</div>
)}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div style={{...alignStyle(settings.titlePosition),flex:1}}>
<div>
<div style={{fontWeight:700,fontSize:22,color:headerTextColor}}>{company?.name||'Company'}</div>
{settings.companyAddress&&<div style={{fontSize:11,opacity:0.8,marginTop:2,color:headerTextColor}}>{settings.companyAddress}</div>}
{settings.companyPhone&&<div style={{fontSize:11,opacity:0.8,color:headerTextColor}}>{settings.companyPhone}</div>}
{settings.companyEmail&&<div style={{fontSize:11,opacity:0.8,color:headerTextColor}}>{settings.companyEmail}</div>}
{settings.companyWebsite&&<div style={{fontSize:11,opacity:0.8,color:headerTextColor}}>{settings.companyWebsite}</div>}
{settings.trnNumber&&<div style={{fontSize:11,opacity:0.8,color:headerTextColor}}>TRN: {settings.trnNumber}</div>}
</div>
</div>
<div style={{textAlign:'right',flexShrink:0}}>
<div style={{fontSize:24,fontWeight:800,letterSpacing:1,color:headerTextColor}}>INVOICE</div>
<div style={{fontSize:13,opacity:0.9,color:headerTextColor}}>#{invoice.invoiceNumber}</div>
<div style={{marginTop:8}}>
<span style={{background:statusBg[s],color:statusColor[s],padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{s}</span>
</div>
</div>
</div>

{/* Bill To + Date */}
<div style={{marginTop:24,paddingTop:20,borderTop:`0.5px solid ${settings.template==='minimal'?'#e2e8f0':'rgba(255,255,255,0.2)'}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
<div style={{fontSize:10,opacity:0.7,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em',color:headerTextColor}}>Bill To</div>
<div style={{fontWeight:600,fontSize:15,color:headerTextColor}}>{invoice.clientName}</div>
{invoice.clientEmail&&<div style={{fontSize:12,opacity:0.8,color:headerTextColor}}>{invoice.clientEmail}</div>}
{invoice.clientPhone&&<div style={{fontSize:12,opacity:0.8,color:headerTextColor}}>{invoice.clientPhone}</div>}
{invoice.clientAddress&&<div style={{fontSize:12,opacity:0.8,color:headerTextColor}}>{invoice.clientAddress}</div>}
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:10,opacity:0.7,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em',color:headerTextColor}}>Date</div>
<div style={{fontSize:13,color:headerTextColor}}>{invoice.date||(invoice.createdAt?.seconds?new Date(invoice.createdAt.seconds*1000).toLocaleDateString():'-')}</div>
{settings.paymentTerms&&<div style={{fontSize:11,opacity:0.7,marginTop:4,color:headerTextColor}}>{settings.paymentTerms}</div>}
</div>
</div>
</div>

{/* Items */}
<div style={{padding:'28px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
<thead>
<tr style={{borderBottom:`2px solid ${pc}`}}>
<th style={{textAlign:'left',padding:'8px 0',color:pc,fontWeight:600,fontSize:11,textTransform:'uppercase'}}>Description</th>
<th style={{textAlign:'center',padding:'8px',color:pc,fontWeight:600,fontSize:11,textTransform:'uppercase',width:60}}>Qty</th>
<th style={{textAlign:'right',padding:'8px',color:pc,fontWeight:600,fontSize:11,textTransform:'uppercase',width:110}}>Rate</th>
<th style={{textAlign:'right',padding:'8px 0',color:pc,fontWeight:600,fontSize:11,textTransform:'uppercase',width:110}}>Total</th>
</tr>
</thead>
<tbody>
{items.map((item,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc',background:i%2===0?'white':'#fafbff'}}>
<td style={{padding:'10px 0',color:'#1a1d2e'}}>{item.desc||'-'}</td>
<td style={{padding:'10px 8px',textAlign:'center',color:'#64748b'}}>{item.qty||1}</td>
<td style={{padding:'10px 8px',textAlign:'right',color:'#64748b'}}>{Number(item.price||0).toLocaleString()} Ks</td>
<td style={{padding:'10px 0',textAlign:'right',fontWeight:500,color:'#1a1d2e'}}>{Number((item.qty||1)*(item.price||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>

{/* Totals + QR */}
<div style={{padding:'24px 40px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:20}}>
{settings.showQR&&(
<div style={{textAlign:'center',flexShrink:0}}>
<QRCodeSVG value={verifyUrl} size={80} fgColor={pc}/>
<div style={{fontSize:10,color:'#9aa0b4',marginTop:4}}>Scan to verify</div>
</div>
)}
<div style={{minWidth:220,flex:1,maxWidth:260,marginLeft:'auto'}}>
{[
{label:'Subtotal',value:`${subtotal.toLocaleString()} Ks`},
...(Number(invoice.discount||0)>0?[{label:'Discount',value:`-${Number(invoice.discount).toLocaleString()} Ks`,color:'#dc2626'}]:[]),
...(Number(invoice.taxRate||0)>0?[{label:`Tax (${invoice.taxRate}%)`,value:`+${Math.round(subtotal*invoice.taxRate/100).toLocaleString()} Ks`}]:[]),
].map(({label,value,color})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13}}>
<span style={{color:'#9aa0b4'}}>{label}</span>
<span style={{color:color||'#1a1d2e'}}>{value}</span>
</div>
))}
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 4px',fontSize:16,fontWeight:700,borderTop:`2px solid ${pc}`,marginTop:6}}>
<span style={{color:'#1a1d2e'}}>Total</span>
<span style={{color:pc}}>{Number(invoice.totalAmount||0).toLocaleString()} Ks</span>
</div>
</div>
</div>

{/* Payment Methods */}
{settings.paymentMethods&&(
<div style={{padding:'16px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:4}}>Payment Methods</div>
<div style={{fontSize:13,color:'#64748b'}}>{settings.paymentMethods}</div>
</div>
)}

{/* Note */}
{invoice.note&&(
<div style={{padding:'16px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:4}}>Note</div>
<div style={{fontSize:13,color:'#64748b'}}>{invoice.note}</div>
</div>
)}

{/* Footer */}
<div style={{padding:'16px 40px',background:'#f8fafc',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{fontSize:12,color:'#9aa0b4'}}>{settings.footerText}</div>
<div style={{fontSize:11,color:'#9aa0b4',textAlign:'right'}}>
<div>SEC: {invoice.securityCode}</div>
<div style={{marginTop:2,opacity:0.7}}>System By: Ankora-X</div>
</div>
</div>

</div>
</div>
</>
)
}
