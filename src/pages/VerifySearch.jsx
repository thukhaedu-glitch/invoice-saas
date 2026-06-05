import{useState,useRef,useEffect}from'react'
import{useNavigate}from'react-router-dom'
import{db}from'../firebase'
import{collection,getDocs,query,where,collectionGroup}from'firebase/firestore'
import{Search,QrCode,CheckCircle,XCircle,Clock,FileText,Loader}from'lucide-react'

export default function VerifySearch(){
const[searchQuery,setSearchQuery]=useState('')
const[searching,setSearching]=useState(false)
const[result,setResult]=useState(null)
const[notFound,setNotFound]=useState(false)
const[scanMode,setScanMode]=useState(false)
const[cameraError,setCameraError]=useState('')
const videoRef=useRef(null)
const navigate=useNavigate()

const handleSearch=async()=>{
if(!searchQuery.trim())return
setSearching(true)
setResult(null)
setNotFound(false)
try{
const q=searchQuery.trim().toUpperCase()
// Search across all companies
const companiesSnap=await getDocs(collection(db,'companies'))
for(const compDoc of companiesSnap.docs){
const cid=compDoc.id
// Search invoices by invoiceNumber or securityCode
const[invByNum,invBySec,quoByNum,quoBySec,conByNum,conBySec]=await Promise.all([
getDocs(query(collection(db,'companies',cid,'invoices'),where('invoiceNumber','==',q))),
getDocs(query(collection(db,'companies',cid,'invoices'),where('securityCode','==',q))),
getDocs(query(collection(db,'companies',cid,'quotations'),where('quotationNumber','==',q))),
getDocs(query(collection(db,'companies',cid,'quotations'),where('securityCode','==',q))),
getDocs(query(collection(db,'companies',cid,'contracts'),where('contractNumber','==',q))),
getDocs(query(collection(db,'companies',cid,'contracts'),where('securityCode','==',q))),
])
if(!invByNum.empty){
const d=invByNum.docs[0]
navigate(`/verify/${cid}/${d.data().securityCode||d.id}`)
return
}
if(!invBySec.empty){
navigate(`/verify/${cid}/${q}`)
return
}
if(!quoByNum.empty){
const d=quoByNum.docs[0]
navigate(`/verify/${cid}/${d.data().securityCode||d.id}`)
return
}
if(!quoBySec.empty){
navigate(`/verify/${cid}/${q}`)
return
}
if(!conByNum.empty){
const d=conByNum.docs[0]
navigate(`/verify/${cid}/${d.data().securityCode||d.id}`)
return
}
if(!conBySec.empty){
navigate(`/verify/${cid}/${q}`)
return
}
}
setNotFound(true)
}catch(e){console.error(e);setNotFound(true)}
setSearching(false)
}

const startCamera=async()=>{
setScanMode(true)
setCameraError('')
try{
const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
if(videoRef.current){
videoRef.current.srcObject=stream
videoRef.current.play()
}
}catch(e){
setCameraError('Camera access denied. Please allow camera permission.')
setScanMode(false)
}
}

const stopCamera=()=>{
if(videoRef.current?.srcObject){
videoRef.current.srcObject.getTracks().forEach(t=>t.stop())
}
setScanMode(false)
}

return(
<div style={{
minHeight:'100vh',
background:'linear-gradient(135deg,#e8f0fe 0%,#f0f4ff 50%,#e8f8f0 100%)',
display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
padding:20,
}}>
<div style={{width:'100%',maxWidth:480}}>

{/* Title */}
<div style={{textAlign:'center',marginBottom:32}}>
<div style={{
width:56,height:56,background:'#4F6EF7',borderRadius:16,
display:'flex',alignItems:'center',justifyContent:'center',
margin:'0 auto 16px',boxShadow:'0 4px 16px rgba(79,110,247,0.3)',
}}>
<FileText size={26} color="white"/>
</div>
<div style={{fontSize:13,color:'#9aa0b4',letterSpacing:2,textTransform:'uppercase',marginBottom:8}}>Invoice SaaS</div>
<div style={{fontSize:26,fontWeight:700,color:'#1a1d2e'}}>Verify Payment</div>
</div>

{/* Method 1 — Search */}
<div style={{background:'white',borderRadius:16,padding:24,marginBottom:16,boxShadow:'0 4px 16px rgba(0,0,0,0.06)'}}>
<div style={{fontSize:13,fontWeight:600,color:'#9aa0b4',marginBottom:16}}>Method 1 — Enter Number</div>
<div style={{display:'flex',gap:8}}>
<input
className="form-input"
value={searchQuery}
onChange={e=>setSearchQuery(e.target.value)}
onKeyDown={e=>e.key==='Enter'&&handleSearch()}
placeholder="INV-xxx / QTN-xxx / SEC-xxx"
style={{flex:1,fontSize:14}}
/>
<button
type="button"
onClick={handleSearch}
disabled={searching}
style={{
background:'#4F6EF7',color:'white',border:'none',
borderRadius:10,padding:'0 20px',fontSize:14,fontWeight:600,
cursor:'pointer',display:'flex',alignItems:'center',gap:6,
whiteSpace:'nowrap',
}}>
{searching?<Loader size={14} style={{animation:'spin 1s linear infinite'}}/>:<Search size={14}/>}
{searching?'Searching...':'Check'}
</button>
</div>
{notFound&&(
<div style={{marginTop:12,padding:'10px 14px',background:'#fcebeb',borderRadius:8,display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#dc2626'}}>
<XCircle size={15}/>Document not found. Please check the number and try again.
</div>
)}
</div>

{/* Divider */}
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
<div style={{flex:1,height:'0.5px',background:'#e2e8f0'}}/>
<span style={{fontSize:13,color:'#9aa0b4',fontWeight:500}}>OR</span>
<div style={{flex:1,height:'0.5px',background:'#e2e8f0'}}/>
</div>

{/* Method 2 — QR Scan */}
<div
onClick={scanMode?stopCamera:startCamera}
style={{
background:'#1a1d2e',borderRadius:16,padding:24,
display:'flex',alignItems:'center',gap:16,cursor:'pointer',
boxShadow:'0 4px 16px rgba(0,0,0,0.12)',
transition:'opacity 0.2s',
}}>
<div style={{
width:48,height:48,background:'rgba(79,110,247,0.2)',borderRadius:12,
display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
}}>
<QrCode size={24} color="#4F6EF7"/>
</div>
<div>
<div style={{fontSize:15,fontWeight:600,color:'white'}}>Method 2 — Scan QR Code</div>
<div style={{fontSize:12,color:'#9aa0b4',marginTop:2}}>{scanMode?'Tap to stop camera':'Use Camera to Scan'}</div>
</div>
</div>

{/* Camera View */}
{scanMode&&(
<div style={{marginTop:12,borderRadius:16,overflow:'hidden',background:'#1a1d2e',position:'relative'}}>
<video ref={videoRef} style={{width:'100%',display:'block'}} playsInline muted/>
<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
<div style={{width:200,height:200,border:'2px solid #4F6EF7',borderRadius:12,boxShadow:'0 0 0 9999px rgba(0,0,0,0.4)'}}/>
</div>
<div style={{padding:'12px 16px',textAlign:'center',fontSize:12,color:'#9aa0b4'}}>
Point camera at QR code
</div>
</div>
)}

{cameraError&&(
<div style={{marginTop:12,padding:'10px 14px',background:'#fcebeb',borderRadius:8,fontSize:13,color:'#dc2626'}}>
{cameraError}
</div>
)}

{/* Footer links */}
<div style={{textAlign:'center',marginTop:24,fontSize:13,color:'#9aa0b4'}}>
<a href="/login" style={{color:'#4F6EF7',textDecoration:'none',marginRight:16}}>Admin Click Here</a>
<a href="/signup" style={{color:'#4F6EF7',textDecoration:'none'}}>Register</a>
</div>

</div>
</div>
)
}
