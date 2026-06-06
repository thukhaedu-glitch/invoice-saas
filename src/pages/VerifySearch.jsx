import{useState,useRef,useEffect,useCallback}from'react'
import{useNavigate}from'react-router-dom'
import{db}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import{Search,QrCode,XCircle,FileText,Loader,CameraOff}from'lucide-react'

export default function VerifySearch(){
const[searchQuery,setSearchQuery]=useState('')
const[searching,setSearching]=useState(false)
const[notFound,setNotFound]=useState(false)
const[scanMode,setScanMode]=useState(false)
const[cameraError,setCameraError]=useState('')
const[scanning,setScanning]=useState(false)
const[scanned,setScanned]=useState(false)
const videoRef=useRef(null)
const canvasRef=useRef(null)
const animRef=useRef(null)
const streamRef=useRef(null)
const navigate=useNavigate()

const handleSearch=async(q)=>{
const query_=( q||searchQuery).trim().toUpperCase()
if(!query_)return
setSearching(true)
setNotFound(false)
try{
const companiesSnap=await getDocs(collection(db,'companies'))
for(const compDoc of companiesSnap.docs){
const cid=compDoc.id
const[invByNum,invBySec,quoByNum,quoBySec,conByNum,conBySec]=await Promise.all([
getDocs(query(collection(db,'companies',cid,'invoices'),where('invoiceNumber','==',query_))),
getDocs(query(collection(db,'companies',cid,'invoices'),where('securityCode','==',query_))),
getDocs(query(collection(db,'companies',cid,'quotations'),where('quotationNumber','==',query_))),
getDocs(query(collection(db,'companies',cid,'quotations'),where('securityCode','==',query_))),
getDocs(query(collection(db,'companies',cid,'contracts'),where('contractNumber','==',query_))),
getDocs(query(collection(db,'companies',cid,'contracts'),where('securityCode','==',query_))),
])
if(!invByNum.empty){navigate(`/verify/${cid}/${invByNum.docs[0].data().securityCode||invByNum.docs[0].id}`);return}
if(!invBySec.empty){navigate(`/verify/${cid}/${query_}`);return}
if(!quoByNum.empty){navigate(`/verify/${cid}/${quoByNum.docs[0].data().securityCode||quoByNum.docs[0].id}`);return}
if(!quoBySec.empty){navigate(`/verify/${cid}/${query_}`);return}
if(!conByNum.empty){navigate(`/verify/${cid}/${conByNum.docs[0].data().securityCode||conByNum.docs[0].id}`);return}
if(!conBySec.empty){navigate(`/verify/${cid}/${query_}`);return}

// URL ပါလာရင် extract လုပ်
if(query_.includes('/VERIFY/')){
const parts=query_.split('/')
const code=parts[parts.length-1]
const cid2=parts[parts.length-2]
if(code&&cid2){navigate(`/verify/${cid2}/${code}`);return}
}
}
setNotFound(true)
}catch(e){console.error(e);setNotFound(true)}
setSearching(false)
}

const handleQRResult=useCallback(async(data)=>{
if(scanned)return
setScanned(true)
stopCamera()

// URL format: /verify/companyId/securityCode
try{
const url=new URL(data)
const parts=url.pathname.split('/').filter(Boolean)
if(parts.length>=3&&parts[0]==='verify'){
navigate(`/verify/${parts[1]}/${parts[2]}`)
return
}
}catch(_){}

// Plain securityCode
await handleSearch(data)
},[scanned,navigate])

const scanFrame=useCallback(()=>{
if(!videoRef.current||!canvasRef.current)return
const video=videoRef.current
const canvas=canvasRef.current
if(video.readyState!==video.HAVE_ENOUGH_DATA){
animRef.current=requestAnimationFrame(scanFrame)
return
}
canvas.width=video.videoWidth
canvas.height=video.videoHeight
const ctx=canvas.getContext('2d')
ctx.drawImage(video,0,0,canvas.width,canvas.height)
const imageData=ctx.getImageData(0,0,canvas.width,canvas.height)

// jsQR dynamic import
import('jsqr').then(({default:jsQR})=>{
const code=jsQR(imageData.data,imageData.width,imageData.height,{
inversionAttempts:'dontInvert',
})
if(code?.data){
handleQRResult(code.data)
}else{
animRef.current=requestAnimationFrame(scanFrame)
}
}).catch(()=>{
animRef.current=requestAnimationFrame(scanFrame)
})
},[handleQRResult])

const startCamera=async()=>{
setScanMode(true)
setScanned(false)
setCameraError('')
try{
const stream=await navigator.mediaDevices.getUserMedia({
video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}
})
streamRef.current=stream
if(videoRef.current){
videoRef.current.srcObject=stream
await videoRef.current.play()
setScanning(true)
animRef.current=requestAnimationFrame(scanFrame)
}
}catch(e){
setCameraError('Camera access denied.')
setScanMode(false)
}
}

const stopCamera=()=>{
if(animRef.current)cancelAnimationFrame(animRef.current)
if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop())
if(videoRef.current)videoRef.current.srcObject=null
setScanning(false)
setScanMode(false)
}

useEffect(()=>{
if(scanMode&&scanning&&!scanned){
animRef.current=requestAnimationFrame(scanFrame)
}
return()=>{
if(animRef.current)cancelAnimationFrame(animRef.current)
}
},[scanMode,scanning,scanned,scanFrame])

useEffect(()=>()=>stopCamera(),[])

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
<div style={{fontSize:13,color:'#9aa0b4',letterSpacing:2,textTransform:'uppercase',marginBottom:8}}>AnkoraX</div>
<div style={{fontSize:26,fontWeight:700,color:'#1a1d2e'}}>Verify Document</div>
</div>

{/* Search */}
<div style={{background:'white',borderRadius:16,padding:24,marginBottom:16,boxShadow:'0 4px 16px rgba(0,0,0,0.06)'}}>
<div style={{fontSize:13,fontWeight:600,color:'#9aa0b4',marginBottom:16,textTransform:'uppercase',letterSpacing:'0.05em'}}>Enter Number</div>
<div style={{display:'flex',gap:8}}>
<input
className="form-input"
value={searchQuery}
onChange={e=>setSearchQuery(e.target.value)}
onKeyDown={e=>e.key==='Enter'&&handleSearch()}
placeholder="INV-xxx / QTN-xxx / SEC-xxx"
style={{flex:1,fontSize:14}}
autoFocus
/>
<button
type="button"
onClick={()=>handleSearch()}
disabled={searching}
style={{
background:'#4F6EF7',color:'white',border:'none',
borderRadius:10,padding:'0 20px',fontSize:14,fontWeight:600,
cursor:'pointer',display:'flex',alignItems:'center',gap:6,
whiteSpace:'nowrap',opacity:searching?0.7:1,
}}>
{searching?<Loader size={14} style={{animation:'spin 1s linear infinite'}}/>:<Search size={14}/>}
{searching?'Searching...':'Check'}
</button>
</div>
{notFound&&(
<div style={{marginTop:12,padding:'10px 14px',background:'#fcebeb',borderRadius:8,display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#dc2626'}}>
<XCircle size={15}/>Document not found.
</div>
)}
</div>

{/* Divider */}
<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
<div style={{flex:1,height:'0.5px',background:'#e2e8f0'}}/>
<span style={{fontSize:13,color:'#9aa0b4',fontWeight:500}}>OR</span>
<div style={{flex:1,height:'0.5px',background:'#e2e8f0'}}/>
</div>

{/* QR Scan Button */}
{!scanMode?(
<div
onClick={startCamera}
style={{
background:'#1a1d2e',borderRadius:16,padding:24,
display:'flex',alignItems:'center',gap:16,cursor:'pointer',
boxShadow:'0 4px 16px rgba(0,0,0,0.12)',
}}>
<div style={{
width:48,height:48,background:'rgba(79,110,247,0.2)',borderRadius:12,
display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
}}>
<QrCode size={24} color="#4F6EF7"/>
</div>
<div>
<div style={{fontSize:15,fontWeight:600,color:'white'}}>Scan QR Code</div>
<div style={{fontSize:12,color:'#9aa0b4',marginTop:2}}>Use camera to scan invoice QR</div>
</div>
</div>
):(
<div style={{background:'#1a1d2e',borderRadius:16,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,0.12)'}}>
{/* Camera View */}
<div style={{position:'relative'}}>
<video
ref={videoRef}
style={{width:'100%',display:'block',maxHeight:300,objectFit:'cover'}}
playsInline
muted
/>
<canvas ref={canvasRef} style={{display:'none'}}/>

{/* Scan overlay */}
<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
<div style={{
width:200,height:200,
border:'2px solid #4F6EF7',
borderRadius:12,
boxShadow:'0 0 0 9999px rgba(0,0,0,0.5)',
position:'relative',
}}>
{/* Corner markers */}
{[
{top:0,left:0,borderTop:'3px solid #4F6EF7',borderLeft:'3px solid #4F6EF7'},
{top:0,right:0,borderTop:'3px solid #4F6EF7',borderRight:'3px solid #4F6EF7'},
{bottom:0,left:0,borderBottom:'3px solid #4F6EF7',borderLeft:'3px solid #4F6EF7'},
{bottom:0,right:0,borderBottom:'3px solid #4F6EF7',borderRight:'3px solid #4F6EF7'},
].map((s,i)=>(
<div key={i} style={{position:'absolute',width:20,height:20,...s,borderRadius:2}}/>
))}
{/* Scan line animation */}
<div style={{
position:'absolute',left:0,right:0,height:2,
background:'linear-gradient(90deg,transparent,#4F6EF7,transparent)',
animation:'scanLine 1.5s ease-in-out infinite',
top:'50%',
}}/>
</div>
</div>

{scanning&&(
<div style={{position:'absolute',bottom:0,left:0,right:0,padding:'10px 16px',textAlign:'center',background:'rgba(0,0,0,0.6)'}}>
<div style={{fontSize:12,color:'rgba(255,255,255,0.8)'}}>📷 Point camera at QR code</div>
</div>
)}
</div>

{/* Stop button */}
<div style={{padding:'12px 16px',display:'flex',justifyContent:'center'}}>
<button type="button" onClick={stopCamera} style={{
background:'rgba(220,38,38,0.15)',border:'0.5px solid rgba(220,38,38,0.3)',
color:'#f87171',borderRadius:8,padding:'8px 20px',fontSize:13,cursor:'pointer',
display:'flex',alignItems:'center',gap:6,fontWeight:500,
}}>
<CameraOff size={14}/>Stop Camera
</button>
</div>
</div>
)}

{cameraError&&(
<div style={{marginTop:12,padding:'10px 14px',background:'#fcebeb',borderRadius:8,fontSize:13,color:'#dc2626',display:'flex',alignItems:'center',gap:8}}>
<XCircle size={14}/>{cameraError}
</div>
)}

{/* Footer */}
<div style={{textAlign:'center',marginTop:24,fontSize:13,color:'#9aa0b4'}}>
<a href="/login" style={{color:'#4F6EF7',textDecoration:'none',marginRight:16}}>Admin Login</a>
<a href="/signup" style={{color:'#4F6EF7',textDecoration:'none'}}>Register</a>
</div>

</div>

{/* Scan line CSS */}
<style>{`
@keyframes scanLine{
0%{top:10%}
50%{top:85%}
100%{top:10%}
}
`}</style>
</div>
)
}
