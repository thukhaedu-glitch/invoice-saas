import{useEffect,useState,useRef}from'react'
import{useParams,useNavigate}from'react-router-dom'
import{db,auth}from'../firebase'
import{doc,getDoc,getDocs,collection,query,where}from'firebase/firestore'
import{ArrowLeft,Printer,Download}from'lucide-react'
import{QRCodeSVG}from'qrcode.react'
import jsPDF from'jspdf'

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
trnNumber:'',paymentTerms:'',paymentMethods:[],
})
const[staffName,setStaffName]=useState('')
const[adminName,setAdminName]=useState('')
const[ownerName,setOwnerName]=useState('')
const[staffSig,setStaffSig]=useState('')
const[adminSig,setAdminSig]=useState('')
const[ownerSig,setOwnerSig]=useState('')
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
if(invSnap.exists()){
const invData={id:invSnap.id,...invSnap.data()}
setInvoice(invData)
if(invData.createdBy){
const s=await getDoc(doc(db,'users',invData.createdBy))
if(s.exists()){
setStaffName(s.data().displayName||s.data().email||'Staff')
setStaffSig(s.data().signatureUrl||'')
}
}
if(invData.approvedBy){
const s=await getDoc(doc(db,'users',invData.approvedBy))
if(s.exists()){
setAdminName(s.data().displayName||s.data().email||'Admin')
setAdminSig(s.data().signatureUrl||'')
}
}
if(invData.ownerApprovedBy){
const s=await getDoc(doc(db,'users',invData.ownerApprovedBy))
if(s.exists()){
setOwnerName(s.data().displayName||s.data().email||'Owner')
setOwnerSig(s.data().signatureUrl||'')
}
}
}
if(sSnap.exists())setSettings(s=>({...s,...sSnap.data()}))
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[id])

const handlePrint=()=>window.print()

const qrToPng=async()=>{
const svg=document.querySelector('[data-invoice-qr] svg')
if(!svg)return null
const source=new XMLSerializer().serializeToString(svg)
const url=`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`
return new Promise((resolve,reject)=>{
const img=new Image()
img.onload=()=>{
const canvas=document.createElement('canvas')
canvas.width=600
canvas.height=600
const ctx=canvas.getContext('2d')
ctx.fillStyle='#ffffff'
ctx.fillRect(0,0,600,600)
ctx.drawImage(img,0,0,600,600)
resolve(canvas.toDataURL('image/png'))
}
img.onerror=reject
img.src=url
})
}

const imageUrlToDataUrl=async url=>{
if(!url)return null
return new Promise(resolve=>{
const img=new Image()
img.crossOrigin='anonymous'
img.onload=()=>{
try{
const maxSize=1200
const scale=Math.min(1,maxSize/Math.max(img.naturalWidth||1,img.naturalHeight||1))
const canvas=document.createElement('canvas')
canvas.width=Math.max(1,Math.round(img.naturalWidth*scale))
canvas.height=Math.max(1,Math.round(img.naturalHeight*scale))
const ctx=canvas.getContext('2d')
ctx.clearRect(0,0,canvas.width,canvas.height)
ctx.drawImage(img,0,0,canvas.width,canvas.height)
resolve(canvas.toDataURL('image/png'))
}catch(_){resolve(null)}
}
img.onerror=()=>resolve(null)
img.src=url
})
}

const handleDownloadPDF=async()=>{
setDownloading(true)
try{
const pdf=new jsPDF('p','mm','a4')
const pageWidth=210
const pageHeight=297
const margin=14
const contentWidth=pageWidth-margin*2
const primary=settings.primaryColor||'#4F6EF7'
let y=0

const setColor=hex=>pdf.setTextColor(hex)
const line=(x1,y1,x2,y2,color='#e2e8f0',width=0.2)=>{
pdf.setDrawColor(color)
pdf.setLineWidth(width)
pdf.line(x1,y1,x2,y2)
}
const ensureSpace=height=>{
if(y+height<=pageHeight-16)return
pdf.addPage()
y=16
}
const text=(value,x,yy,{size=9,style='normal',color='#1a1d2e',align='left',maxWidth}={})=>{
pdf.setFont('helvetica',style)
pdf.setFontSize(size)
setColor(color)
pdf.text(String(value??''),x,yy,{align,maxWidth})
}
const dateValue=invoice.date||(invoice.createdAt?.seconds?new Date(invoice.createdAt.seconds*1000).toLocaleDateString():'-')
const logoData=await imageUrlToDataUrl(settings.logoUrl)

// Header
pdf.setFillColor(settings.template==='minimal'?'#ffffff':primary)
pdf.rect(0,0,pageWidth,68,'F')
const headerColor=settings.template==='minimal'?'#1a1d2e':'#ffffff'
let companyX=margin
if(logoData){
pdf.setFillColor('#ffffff')
pdf.roundedRect(margin,7,18,18,2,2,'F')
pdf.addImage(logoData,'PNG',margin+1,8,16,16,undefined,'FAST')
companyX=margin+23
}
text(company?.name||'Company',companyX,15,{size:17,style:'bold',color:headerColor,maxWidth:105})
let companyY=21
;[settings.companyAddress,settings.companyPhone,settings.companyEmail,settings.companyWebsite,settings.trnNumber?`TRN: ${settings.trnNumber}`:''].filter(Boolean).forEach(v=>{
text(v,companyX,companyY,{size:7,color:headerColor,maxWidth:105})
companyY+=4
})
text('INVOICE',pageWidth-margin,15,{size:19,style:'bold',color:headerColor,align:'right'})
text(`#${invoice.invoiceNumber||'-'}`,pageWidth-margin,21,{size:8,color:headerColor,align:'right'})
text((s==='pending_approval'?'Needs Approval':s).toUpperCase(),pageWidth-margin,27,{size:7,style:'bold',color:headerColor,align:'right'})
line(margin,44,pageWidth-margin,44,settings.template==='minimal'?'#e2e8f0':'#ffffff',0.15)
text('BILL TO',margin,51,{size:6.5,style:'bold',color:headerColor})
text(invoice.clientName||'-',margin,57,{size:10,style:'bold',color:headerColor})
text([invoice.clientEmail,invoice.clientPhone,invoice.clientAddress].filter(Boolean).join(' | '),margin,63,{size:6.5,color:headerColor,maxWidth:120})
text('DATE',pageWidth-margin,51,{size:6.5,style:'bold',color:headerColor,align:'right'})
text(dateValue,pageWidth-margin,57,{size:8,color:headerColor,align:'right'})

// Items table
y=79
text('DESCRIPTION',margin,y,{size:7,style:'bold',color:primary})
text('QTY',142,y,{size:7,style:'bold',color:primary,align:'right'})
text('RATE',168,y,{size:7,style:'bold',color:primary,align:'right'})
text('TOTAL',pageWidth-margin,y,{size:7,style:'bold',color:primary,align:'right'})
y+=3
line(margin,y,pageWidth-margin,y,primary,0.6)
y+=6
items.forEach(item=>{
const description=String(item.desc||item.description||'-')
const descLines=pdf.splitTextToSize(description,105)
const rowHeight=Math.max(8,descLines.length*4.2+3)
ensureSpace(rowHeight+4)
text(descLines,margin,y,{size:8})
text(item.qty||1,142,y,{size:8,color:'#64748b',align:'right'})
text(`${Number(item.price||item.rate||0).toLocaleString()} Ks`,168,y,{size:8,color:'#64748b',align:'right'})
text(`${Number((item.qty||1)*(item.price||item.rate||0)).toLocaleString()} Ks`,pageWidth-margin,y,{size:8,style:'bold',align:'right'})
y+=rowHeight
line(margin,y-3,pageWidth-margin,y-3,'#edf0f4',0.15)
})

// Totals
ensureSpace(27)
y+=3
const totalsX=142
text('Subtotal',totalsX,y,{size:8,color:'#64748b'})
text(`${subtotal.toLocaleString()} Ks`,pageWidth-margin,y,{size:8,align:'right'})
y+=6
if(Number(invoice.discount||0)>0){
text('Discount',totalsX,y,{size:8,color:'#64748b'})
text(`-${Number(invoice.discount).toLocaleString()} Ks`,pageWidth-margin,y,{size:8,color:'#dc2626',align:'right'})
y+=6
}
if(Number(invoice.taxRate||0)>0){
text(`Tax (${invoice.taxRate}%)`,totalsX,y,{size:8,color:'#64748b'})
text(`+${Math.round(subtotal*invoice.taxRate/100).toLocaleString()} Ks`,pageWidth-margin,y,{size:8,align:'right'})
y+=6
}
line(totalsX,y-2,pageWidth-margin,y-2,primary,0.6)
text('Total',totalsX,y+4,{size:10,style:'bold'})
text(`${Number(invoice.totalAmount||0).toLocaleString()} Ks`,pageWidth-margin,y+4,{size:10,style:'bold',color:primary,align:'right'})
y+=13

// Payment methods
if(settings.paymentMethods?.length){
ensureSpace(14+settings.paymentMethods.length*7)
text('PAYMENT METHODS',margin,y,{size:7,style:'bold',color:'#64748b'})
y+=5
text('BANK NAME',margin,y,{size:6.5,style:'bold',color:primary})
text('ACCOUNT NO.',80,y,{size:6.5,style:'bold',color:primary})
text('ACCOUNT NAME',140,y,{size:6.5,style:'bold',color:primary})
y+=3
line(margin,y,pageWidth-margin,y,'#dfe5ee',0.2)
y+=5
settings.paymentMethods.forEach(m=>{
text(m.bankName||'-',margin,y,{size:7.5})
text(m.accountNo||'-',80,y,{size:7.5,color:'#64748b'})
text(m.accountName||'-',140,y,{size:7.5,color:'#64748b'})
y+=7
})
}

if(settings.paymentTerms){
ensureSpace(15)
line(margin,y-2,pageWidth-margin,y-2,'#edf0f4',0.15)
text('PAYMENT TERMS',margin,y+4,{size:6.5,style:'bold',color:'#64748b'})
const terms=pdf.splitTextToSize(settings.paymentTerms,145)
text(terms,45,y+4,{size:7,color:'#64748b'})
y+=Math.max(12,terms.length*4)
}

if(invoice.note){
const noteLines=pdf.splitTextToSize(invoice.note,contentWidth)
ensureSpace(10+noteLines.length*4)
text('NOTE',margin,y,{size:6.5,style:'bold',color:'#64748b'})
y+=5
text(noteLines,margin,y,{size:7.5,color:'#64748b'})
y+=noteLines.length*4+4
}

// Signature labels remain vector text; uploaded signatures stay image assets on screen/print.
ensureSpace(35)
text('AUTHORIZED SIGNATURES',margin,y,{size:7,style:'bold',color:'#64748b'})
y+=19
const[staffSigData,adminSigData,ownerSigData]=await Promise.all([
imageUrlToDataUrl(staffSig),
hasAdminApproval?imageUrlToDataUrl(adminSig):null,
hasOwnerApproval?imageUrlToDataUrl(ownerSig):null,
])
if(staffSigData)pdf.addImage(staffSigData,margin,y-15,28,13,undefined,'FAST')
line(margin,y,75,y,'#1a1d2e',0.35)
text('PREPARED BY',margin,y+5,{size:6.5,style:'bold',color:'#64748b'})
text(staffName||'Staff',margin,y+10,{size:7.5})
if(hasAdminApproval){
if(adminSigData)pdf.addImage(adminSigData,80,y-15,28,13,undefined,'FAST')
line(80,y,135,y,'#1a1d2e',0.35)
text('APPROVED BY',80,y+5,{size:6.5,style:'bold',color:'#64748b'})
text(adminName||'Admin',80,y+10,{size:7.5})
}
if(hasOwnerApproval){
if(ownerSigData)pdf.addImage(ownerSigData,140,y-15,28,13,undefined,'FAST')
line(140,y,pageWidth-margin,y,'#1a1d2e',0.35)
text('DIRECTOR APPROVED',140,y+5,{size:6.5,style:'bold',color:'#64748b'})
text(ownerName||'Director',140,y+10,{size:7.5})
}
y+=18

// Footer and QR are kept within the printable page area.
ensureSpace(31)
pdf.setFillColor('#f8fafc')
pdf.rect(0,y-4,pageWidth,35,'F')
text(settings.footerText||'Thank you for your business!',margin,y+3,{size:7.5,color:'#64748b'})
text('This invoice is system-generated and does not require a physical seal.',margin,y+8,{size:6.5,color:'#94a3b8'})
text('Verify authenticity by scanning the QR code.',margin,y+12,{size:6.5,color:'#94a3b8'})
text('System developed by Ankora-X',margin,y+16,{size:6.5,color:'#94a3b8'})
if(settings.showQR){
const qr=await qrToPng()
if(qr){
pdf.addImage(qr,'PNG',pageWidth-margin-22,y-1,22,22,undefined,'FAST')
text('Scan to verify',pageWidth-margin-11,y+24,{size:6,color:'#64748b',align:'center'})
}
}

pdf.setProperties({title:`Invoice ${invoice.invoiceNumber||''}`,subject:'Invoice',creator:'Ankora-X'})
pdf.save(`${invoice.invoiceNumber||'invoice'}.pdf`)
}catch(e){console.error(e);alert(`PDF generation failed: ${e.message}`)}
setDownloading(false)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>
if(!invoice)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Invoice not found</div>

const items=invoice.items||[]
const subtotal=items.reduce((s,i)=>s+(i.qty||1)*(i.price||0),0)
const s=invoice.status||'pending'
const pc=settings.primaryColor
const verifyUrl=`${window.location.origin}/verify/${company?.id}/${invoice.securityCode}`
const statusColor={paid:'#16a34a',pending:'#d97706',overdue:'#dc2626',refunded:'#6366f1',pending_approval:'#4F6EF7',rejected:'#dc2626'}
const statusBg={paid:'#eaf3de',pending:'#faeeda',overdue:'#fcebeb',refunded:'#ede9fe',pending_approval:'rgba(79,110,247,0.1)',rejected:'#fcebeb'}
const hasAdminApproval=!!invoice.approvedBy||!!invoice.adminApprovedBy
const hasOwnerApproval=!!invoice.ownerApprovedBy

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

<div className="no-print" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',borderBottom:'0.5px solid #e2e8f0',padding:'12px 24px',display:'flex',alignItems:'center',gap:12}}>
<button onClick={()=>navigate('/')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<span style={{flex:1,fontWeight:500,fontSize:15}}>Invoice #{invoice.invoiceNumber}</span>
<button onClick={handlePrint} className="btn btn-ghost no-print"><Printer size={15}/>Print</button>
<button onClick={handleDownloadPDF} disabled={downloading} className="btn btn-primary no-print"><Download size={15}/>{downloading?'Generating...':'Download PDF'}</button>
</div>

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
<span style={{background:statusBg[s]||'#faeeda',color:statusColor[s]||'#d97706',padding:'3px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>
{s==='pending_approval'?'Needs Approval':s}
</span>
</div>
</div>
</div>
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
<td style={{padding:'10px 0',color:'#1a1d2e'}}>
<div>{item.desc||'-'}</div>
{item.imageUrl&&<img src={item.imageUrl} style={{height:60,width:60,objectFit:'cover',borderRadius:6,marginTop:6,border:'0.5px solid #e2e8f0'}}/>}
</td>
<td style={{padding:'10px 8px',textAlign:'center',color:'#64748b',verticalAlign:'top'}}>{item.qty||1}</td>
<td style={{padding:'10px 8px',textAlign:'right',color:'#64748b',verticalAlign:'top'}}>{Number(item.price||0).toLocaleString()} Ks</td>
<td style={{padding:'10px 0',textAlign:'right',fontWeight:500,color:'#1a1d2e',verticalAlign:'top'}}>{Number((item.qty||1)*(item.price||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>

{/* Totals */}
<div style={{padding:'24px 40px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'flex-end'}}>
<div style={{minWidth:220,maxWidth:260}}>
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
{settings.paymentMethods?.length>0&&(
<div style={{padding:'16px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:10,letterSpacing:'0.05em'}}>Payment Methods</div>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
<thead>
<tr style={{borderBottom:`1px solid ${pc}30`}}>
<th style={{textAlign:'left',padding:'6px 0',color:pc,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Bank Name</th>
<th style={{textAlign:'left',padding:'6px 8px',color:pc,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Account No.</th>
<th style={{textAlign:'left',padding:'6px 0',color:pc,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Account Name</th>
</tr>
</thead>
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

{/* Payment Terms */}
{settings.paymentTerms&&(
<div style={{padding:'12px 40px',borderBottom:'0.5px solid #f1f5f9',display:'flex',gap:8,alignItems:'center'}}>
<span style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Payment Terms:</span>
<span style={{fontSize:12,color:'#64748b'}}>{settings.paymentTerms}</span>
</div>
)}

{/* Note */}
{invoice.note&&(
<div style={{padding:'16px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:4}}>Note</div>
<div style={{fontSize:13,color:'#64748b'}}>{invoice.note}</div>
</div>
)}

{/* Payment History */}
{invoice.payments?.length>0&&(
<div style={{padding:'16px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:10,letterSpacing:'0.05em'}}>Payment History</div>
<table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
<thead>
<tr style={{borderBottom:`1px solid ${pc}30`}}>
<th style={{textAlign:'left',padding:'6px 0',color:pc,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Date</th>
<th style={{textAlign:'left',padding:'6px 8px',color:pc,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Method</th>
<th style={{textAlign:'left',padding:'6px 8px',color:pc,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Note</th>
<th style={{textAlign:'right',padding:'6px 0',color:pc,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>Amount</th>
</tr>
</thead>
<tbody>
{invoice.payments.map((p,i)=>(
<tr key={i} style={{borderBottom:'0.5px solid #f8fafc'}}>
<td style={{padding:'7px 0',color:'#1a1d2e',fontWeight:500}}>{p.date||'-'}</td>
<td style={{padding:'7px 8px',color:'#64748b'}}>{p.method||'-'}</td>
<td style={{padding:'7px 8px',color:'#64748b'}}>{p.note||'-'}</td>
<td style={{padding:'7px 0',textAlign:'right',fontWeight:600,color:'#16a34a'}}>{Number(p.amount||0).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 0 4px',marginTop:8,borderTop:`1px solid ${pc}30`,fontSize:13}}>
<span style={{color:'#9aa0b4'}}>Total Paid</span>
<span style={{fontWeight:700,color:'#16a34a'}}>{Number(invoice.paidAmount||0).toLocaleString()} Ks</span>
</div>
{Number(invoice.remainingAmount||0)>0&&(
<div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13}}>
<span style={{color:'#9aa0b4'}}>Remaining</span>
<span style={{fontWeight:700,color:'#d97706'}}>{Number(invoice.remainingAmount||0).toLocaleString()} Ks</span>
</div>
)}
</div>
)}

{/* Signatures */}
<div style={{padding:'24px 40px',borderBottom:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:16,letterSpacing:'0.05em'}}>Authorized Signatures</div>
<div style={{display:'grid',gridTemplateColumns:`repeat(${hasOwnerApproval?3:hasAdminApproval?2:1},1fr)`,gap:24}}>

{/* Staff */}
<div>
<div style={{height:64,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',paddingBottom:4}}>
{staffSig?(
<img src={staffSig} style={{height:56,objectFit:'contain',maxWidth:'100%'}} alt="signature"/>
):(
<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{staffName||'—'}</span>
)}
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Prepared by</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{staffName||'Staff'}</div>
{invoice.createdAt?.seconds&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(invoice.createdAt.seconds*1000).toLocaleDateString()}</div>}
</div>

{/* Admin */}
{hasAdminApproval&&(
<div>
<div style={{height:64,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',paddingBottom:4}}>
{adminSig?(
<img src={adminSig} style={{height:56,objectFit:'contain',maxWidth:'100%'}} alt="signature"/>
):(
<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{adminName||'—'}</span>
)}
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Approved by</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{adminName||'Admin'}</div>
{invoice.approvedAt&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(invoice.approvedAt).toLocaleDateString()}</div>}
</div>
)}

{/* Owner */}
{hasOwnerApproval&&(
<div>
<div style={{height:64,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',paddingBottom:4}}>
{ownerSig?(
<img src={ownerSig} style={{height:56,objectFit:'contain',maxWidth:'100%'}} alt="signature"/>
):(
<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{ownerName||'—'}</span>
)}
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Director Approved</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{ownerName||'Director'}</div>
{invoice.ownerApprovedAt&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(invoice.ownerApprovedAt).toLocaleDateString()}</div>}
</div>
)}
</div>
</div>

{/* Footer + QR */}
<div style={{padding:'16px 40px',background:'#f8fafc',display:'flex',justifyContent:'space-between',alignItems:'center',gap:20}}>
<div>
<div style={{fontSize:12,color:'#9aa0b4',marginBottom:4}}>{settings.footerText}</div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>This invoice is system-generated and does not require a physical seal.</div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>Verify authenticity by scanning the QR code.</div>
<div style={{fontSize:10,color:'#9aa0b4'}}>System developed by Ankora-X</div>
</div>
{settings.showQR&&(
<div data-invoice-qr style={{textAlign:'center',flexShrink:0}}>
<QRCodeSVG value={verifyUrl} size={70} fgColor={pc}/>
<div style={{fontSize:10,color:'#9aa0b4',marginTop:4}}>Scan to verify</div>
</div>
)}
</div>

</div>
</div>
</>
)
}
