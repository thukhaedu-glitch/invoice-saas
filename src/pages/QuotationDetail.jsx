import{useState,useEffect,useRef}from'react'
import{db,auth}from'../firebase'
import{doc,getDoc,getDocs,collection,query,where,addDoc,serverTimestamp}from'firebase/firestore'
import{useParams,useNavigate}from'react-router-dom'
import{QRCodeSVG}from'qrcode.react'
import html2canvas from'html2canvas'
import jsPDF from'jspdf'
import{ArrowLeft,Printer,Download,FileText}from'lucide-react'

export default function QuotationDetail(){
const{id}=useParams()
const navigate=useNavigate()
const[quotation,setQuotation]=useState(null)
const[company,setCompany]=useState(null)
const[companyId,setCompanyId]=useState(null)
const[settings,setSettings]=useState({})
const[loading,setLoading]=useState(true)
const[downloading,setDownloading]=useState(false)
const[converting,setConverting]=useState(false)
const[staffName,setStaffName]=useState('')
const[adminName,setAdminName]=useState('')
const[ownerName,setOwnerName]=useState('')
const printRef=useRef()

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const cData=snap.docs[0].data()
setCompanyId(cid)
setCompany({id:cid,...cData})
const[qSnap,sSnap]=await Promise.all([
getDoc(doc(db,'companies',cid,'quotations',id)),
getDoc(doc(db,'companies',cid,'_config','invoiceSettings'))
])
if(qSnap.exists()){
const qData={id:qSnap.id,...qSnap.data()}
setQuotation(qData)
if(qData.createdBy){
const staffSnap=await getDoc(doc(db,'users',qData.createdBy))
if(staffSnap.exists())setStaffName(staffSnap.data().displayName||staffSnap.data().email||'Staff')
}
if(qData.approvedBy){
const adminSnap=await getDoc(doc(db,'users',qData.approvedBy))
if(adminSnap.exists())setAdminName(adminSnap.data().displayName||adminSnap.data().email||'Admin')
}
if(qData.ownerApprovedBy){
const ownerSnap=await getDoc(doc(db,'users',qData.ownerApprovedBy))
if(ownerSnap.exists())setOwnerName(ownerSnap.data().displayName||ownerSnap.data().email||'Owner')
}
}
if(sSnap.exists())setSettings(sSnap.data())
}
setLoading(false)
}
load()
},[id])

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
pdf.save(`${quotation?.quotationNumber||'quotation'}.pdf`)
}catch(e){console.error(e)}
setDownloading(false)
}

const handleConvertToInvoice=async()=>{
if(!confirm('Convert this quotation to invoice?'))return
setConverting(true)
try{
const{id:_,quotationNumber,...data}=quotation
await addDoc(collection(db,'companies',companyId,'invoices'),{
...data,
invoiceNumber:'INV-'+Date.now().toString().slice(-6),
status:'pending',
securityCode:'SEC-'+Math.random().toString(36).substring(2,8).toUpperCase(),
convertedFrom:quotation.id,
convertedFromNumber:quotationNumber,
createdAt:serverTimestamp(),
createdBy:auth.currentUser.uid,
})
alert('Converted to Invoice!')
navigate('/?tab=invoice')
}catch(e){alert(e.message)}
setConverting(false)
}

if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'}}>Loading...</div>
if(!quotation)return<div style={{padding:40,textAlign:'center'}}>Quotation not found</div>

const subtotal=quotation.items?.reduce((s,i)=>s+Number(i.qty||1)*Number(i.price||0),0)||0
const tax=subtotal*(Number(quotation.taxRate||0)/100)
const total=quotation.totalAmount||subtotal-Number(quotation.discount||0)+tax
const primaryColor=settings.primaryColor||'#4F6EF7'
const hasAdminApproval=!!quotation.approvedBy||!!quotation.adminApprovedBy
const hasOwnerApproval=!!quotation.ownerApprovedBy

return(
<>
<style>{`
@media print{
.no-print{display:none!important}
body{background:white!important;margin:0}
.print-area{box-shadow:none!important;border-radius:0!important;max-width:100%!important;margin:0!important}
@page{size:A4;margin:15mm}
}
`}</style>

{/* Topbar */}
<div className="no-print" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',borderBottom:'0.5px solid #e2e8f0',padding:'12px 24px',display:'flex',alignItems:'center',gap:12}}>
<button type="button" onClick={()=>navigate('/?tab=quotation')} className="btn btn-ghost" style={{padding:'8px 12px'}}><ArrowLeft size={16}/></button>
<span style={{flex:1,fontWeight:500,fontSize:15}}>{quotation.quotationNumber}</span>
<button type="button" onClick={handleConvertToInvoice} disabled={converting} className="btn btn-ghost" style={{color:'#16a34a',borderColor:'#16a34a'}}>
<FileText size={15}/>{converting?'Converting...':'Convert to Invoice'}
</button>
<button type="button" onClick={()=>window.print()} className="btn btn-ghost"><Printer size={15}/>Print</button>
<button type="button" onClick={handleDownloadPDF} disabled={downloading} className="btn btn-primary">
<Download size={15}/>{downloading?'Generating...':'Download PDF'}
</button>
</div>

{/* Print Area */}
<div style={{minHeight:'100vh',background:'#f1f5f9',padding:'80px 24px 40px',display:'flex',justifyContent:'center'}}>
<div ref={printRef} className="print-area" style={{width:'210mm',background:'white',boxShadow:'0 4px 32px rgba(0,0,0,0.08)',fontFamily:'Georgia,serif'}}>

{/* Header */}
{settings.template==='modern'?(
<div style={{background:primaryColor,padding:'32px 40px',color:'white'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
{settings.logoUrl&&<img src={settings.logoUrl} style={{height:48,objectFit:'contain',marginBottom:12,filter:'brightness(0) invert(1)'}}/>}
<div style={{fontSize:22,fontWeight:700,letterSpacing:1}}>{company?.name}</div>
{settings.companyAddress&&<div style={{fontSize:12,opacity:0.8,marginTop:4}}>{settings.companyAddress}</div>}
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:28,fontWeight:700,letterSpacing:2,opacity:0.9}}>QUOTATION</div>
<div style={{fontSize:14,marginTop:4}}>{quotation.quotationNumber}</div>
</div>
</div>
</div>
):(
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
<div style={{fontSize:13,color:'#64748b',marginTop:4}}>{quotation.quotationNumber}</div>
<div style={{fontSize:12,color:'#64748b',marginTop:2}}>Date: {quotation.date||'-'}</div>
{quotation.validUntil&&<div style={{fontSize:12,color:'#d97706',marginTop:2}}>Valid Until: {quotation.validUntil}</div>}
</div>
</div>
</div>
)}

{/* Bill To */}
<div style={{padding:'20px 40px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Bill To</div>
<div style={{fontWeight:600,fontSize:15,color:'#1a1d2e'}}>{quotation.clientName}</div>
{quotation.clientEmail&&<div style={{fontSize:12,color:'#64748b',marginTop:2}}>{quotation.clientEmail}</div>}
{quotation.clientPhone&&<div style={{fontSize:12,color:'#64748b'}}>{quotation.clientPhone}</div>}
{quotation.clientAddress&&<div style={{fontSize:12,color:'#64748b'}}>{quotation.clientAddress}</div>}
</div>
<div>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Quotation Details</div>
<div style={{fontSize:12,color:'#64748b'}}>Number: <strong style={{color:'#1a1d2e'}}>{quotation.quotationNumber}</strong></div>
<div style={{fontSize:12,color:'#64748b',marginTop:2}}>Date: <strong style={{color:'#1a1d2e'}}>{quotation.date}</strong></div>
{quotation.validUntil&&<div style={{fontSize:12,color:'#d97706',marginTop:2}}>Valid Until: <strong>{quotation.validUntil}</strong></div>}
{quotation.convertedFromNumber&&<div style={{fontSize:11,color:'#16a34a',marginTop:4}}>✓ Converted from {quotation.convertedFromNumber}</div>}
</div>
</div>

{/* Items Table */}
<div style={{padding:'0 40px 20px'}}>
<table style={{width:'100%',borderCollapse:'collapse',fontFamily:'inherit'}}>
<thead>
<tr style={{background:primaryColor}}>
<th style={{padding:'10px 12px',textAlign:'left',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>#</th>
<th style={{padding:'10px 12px',textAlign:'left',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Description</th>
<th style={{padding:'10px 12px',textAlign:'center',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Qty</th>
<th style={{padding:'10px 12px',textAlign:'right',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Price</th>
<th style={{padding:'10px 12px',textAlign:'right',color:'white',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Amount</th>
</tr>
</thead>
<tbody>
{quotation.items?.map((item,i)=>(
<tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}>
<td style={{padding:'10px 12px',fontSize:12,color:'#64748b',borderBottom:'0.5px solid #f1f5f9'}}>{i+1}</td>
<td style={{padding:'10px 12px',fontSize:13,borderBottom:'0.5px solid #f1f5f9'}}>
<div>{item.desc}</div>
{item.imageUrl&&<img src={item.imageUrl} style={{height:48,width:48,objectFit:'cover',borderRadius:4,marginTop:4}}/>}
</td>
<td style={{padding:'10px 12px',textAlign:'center',fontSize:13,borderBottom:'0.5px solid #f1f5f9'}}>{item.qty}</td>
<td style={{padding:'10px 12px',textAlign:'right',fontSize:13,borderBottom:'0.5px solid #f1f5f9'}}>{Number(item.price||0).toLocaleString()} Ks</td>
<td style={{padding:'10px 12px',textAlign:'right',fontSize:13,fontWeight:500,borderBottom:'0.5px solid #f1f5f9'}}>{(Number(item.qty||1)*Number(item.price||0)).toLocaleString()} Ks</td>
</tr>
))}
</tbody>
</table>
</div>

{/* Totals */}
<div style={{padding:'0 40px 24px',display:'flex',justifyContent:'flex-end'}}>
<div style={{width:240}}>
{[
{label:'Subtotal',value:`${subtotal.toLocaleString()} Ks`},
...(quotation.discount>0?[{label:'Discount',value:`-${Number(quotation.discount).toLocaleString()} Ks`,color:'#dc2626'}]:[]),
...(quotation.taxRate>0?[{label:`Tax (${quotation.taxRate}%)`,value:`+${Math.round(tax).toLocaleString()} Ks`}]:[]),
].map(({label,value,color})=>(
<div key={label} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13,color:color||'#64748b'}}>
<span>{label}</span><span>{value}</span>
</div>
))}
<div style={{display:'flex',justifyContent:'space-between',padding:'10px 12px',background:primaryColor,borderRadius:8,marginTop:8,color:'white',fontWeight:700,fontSize:15}}>
<span>Total</span><span>{Number(total).toLocaleString()} Ks</span>
</div>
</div>
</div>

{/* Note */}
{quotation.note&&(
<div style={{padding:'0 40px 20px'}}>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Note</div>
<div style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>{quotation.note}</div>
</div>
)}

{/* Payment Methods */}
{settings.paymentMethods?.length>0&&(
<div style={{padding:'0 40px 20px'}}>
<div style={{fontSize:10,fontWeight:700,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Payment Information</div>
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

{/* Signatures */}
<div style={{padding:'24px 40px',borderTop:'0.5px solid #f1f5f9'}}>
<div style={{fontSize:11,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',marginBottom:16,letterSpacing:'0.05em'}}>Authorized Signatures</div>
<div style={{display:'grid',gridTemplateColumns:`repeat(${hasOwnerApproval?3:hasAdminApproval?2:1},1fr)`,gap:24}}>

{/* Staff Signature */}
<div style={{textAlign:'center'}}>
<div style={{height:48,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4}}>
<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{staffName||'—'}</span>
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Prepared by</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{staffName||'Staff'}</div>
{quotation.createdAt?.seconds&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(quotation.createdAt.seconds*1000).toLocaleDateString()}</div>}
</div>

{/* Admin Signature */}
{hasAdminApproval&&(
<div style={{textAlign:'center'}}>
<div style={{height:48,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4}}>
<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{adminName||'—'}</span>
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Approved by</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{adminName||'Admin'}</div>
{quotation.approvedAt&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(quotation.approvedAt).toLocaleDateString()}</div>}
</div>
)}

{/* Owner Signature */}
{hasOwnerApproval&&(
<div style={{textAlign:'center'}}>
<div style={{height:48,borderBottom:'1.5px solid #1a1d2e',marginBottom:8,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4}}>
<span style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>{ownerName||'—'}</span>
</div>
<div style={{fontSize:10,fontWeight:600,color:'#9aa0b4',textTransform:'uppercase',letterSpacing:'0.05em'}}>Director Approved</div>
<div style={{fontSize:12,fontWeight:500,color:'#1a1d2e',marginTop:2}}>{ownerName||'Director'}</div>
{quotation.ownerApprovedAt&&<div style={{fontSize:10,color:'#9aa0b4',marginTop:2}}>{new Date(quotation.ownerApprovedAt).toLocaleDateString()}</div>}
</div>
)}
</div>
</div>

{/* Footer + QR */}
<div style={{padding:'16px 40px',background:'#f8fafc',display:'flex',justifyContent:'space-between',alignItems:'center',gap:20}}>
<div>
{settings.footerText&&<div style={{fontSize:11,color:'#9aa0b4',marginBottom:4}}>{settings.footerText}</div>}
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>This quotation is system-generated and does not require a physical seal.</div>
<div style={{fontSize:10,color:'#9aa0b4',marginBottom:2}}>Verify authenticity by scanning the QR code.</div>
<div style={{fontSize:10,color:'#9aa0b4'}}>System developed by Ankora-X</div>
</div>
{settings.showQr!==false&&quotation.securityCode&&(
<div style={{textAlign:'center'}}>
<QRCodeSVG value={`${window.location.origin}/verify/${companyId}/${quotation.securityCode}`} size={64} fgColor={primaryColor}/>
<div style={{fontSize:9,color:'#9aa0b4',marginTop:4}}>Scan to verify</div>
</div>
)}
<div style={{fontSize:11,color:'#9aa0b4',textAlign:'right',flexShrink:0}}>
<div>SEC: {quotation.securityCode}</div>
</div>
</div>

</div>
</div>
</>
)
}
