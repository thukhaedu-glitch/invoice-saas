import{useState,useEffect}from'react'
import{db,auth,storage}from'../firebase'
import{collection,getDocs,query,where,addDoc,serverTimestamp,getDoc,doc}from'firebase/firestore'
import{ref,uploadBytes,getDownloadURL}from'firebase/storage'
import{useNavigate}from'react-router-dom'
import Layout from'../components/Layout'
import{Check,Upload,ArrowLeft,Crown,X}from'lucide-react'
import{PLAN_LIMITS,PAID_PLANS,normalizePlan,formatMMK}from'../config/planLimits'

// ⚠️ ကိုယ်ပိုင် ငွေလွှဲ account ပြင်ပါ
const PAYMENT_INFO={
kpay:{name:'KBZPay',number:'09-XXX-XXX-XXX',accountName:'Your Name'},
bank:{name:'KBZ Bank',number:'XXXX-XXXX-XXXX-XXXX',accountName:'Your Company'},
}

const PLAN_FEATURES={
starter:['Core CRM modules','Draft invoices & quotes','Basic dashboards','100 documents/mo','Standard support'],
growth:['Full finance module','Bank auto-reconciliation','Journal entries logging','500 documents/mo','24/7 priority support'],
business:['Everything in Growth','Custom report builder','Granular role permissions','Multi-office audit logs','Dedicated account lead'],
}

export default function Upgrade(){
const navigate=useNavigate()
const[companyId,setCompanyId]=useState(null)
const[currentPlan,setCurrentPlan]=useState('free')
const[selectedPlan,setSelectedPlan]=useState(null)
const[txnNote,setTxnNote]=useState('')
const[screenshot,setScreenshot]=useState(null)
const[screenshotUrl,setScreenshotUrl]=useState('')
const[uploading,setUploading]=useState(false)
const[submitting,setSubmitting]=useState(false)
const[done,setDone]=useState(false)
const[hasPending,setHasPending]=useState(false)

useEffect(()=>{
const load=async()=>{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
setCompanyId(cid)
setCurrentPlan(snap.docs[0].data().plan||'free')
// pending request ရှိ/မရှိ စစ်
const reqSnap=await getDocs(query(collection(db,'upgradeRequests'),where('companyId','==',cid),where('status','==','pending')))
if(!reqSnap.empty)setHasPending(true)
}
}
load()
},[])

const handleUpload=async(file)=>{
if(!file)return
setUploading(true)
try{
const path=`upgradeProofs/${companyId}_${Date.now()}_${file.name}`
const r=ref(storage,path)
await uploadBytes(r,file)
const url=await getDownloadURL(r)
setScreenshotUrl(url)
setScreenshot(file)
}catch(e){alert('Upload failed: '+e.message)}
setUploading(false)
}

const handleSubmit=async()=>{
if(!selectedPlan){alert('Plan ရွေးပါ');return}
if(!screenshotUrl){alert('ငွေလွှဲ screenshot upload ပါ');return}
if(!txnNote.trim()){alert('Transaction note (ref number) ထည့်ပါ');return}
setSubmitting(true)
try{
await addDoc(collection(db,'upgradeRequests'),{
companyId,
requestedBy:auth.currentUser.uid,
requestedByEmail:auth.currentUser.email,
currentPlan,
requestedPlan:selectedPlan,
amount:PLAN_LIMITS[selectedPlan].price,
txnNote:txnNote.trim(),
proofUrl:screenshotUrl,
status:'pending',
createdAt:serverTimestamp(),
})
setDone(true)
}catch(e){alert(e.message)}
setSubmitting(false)
}

if(done)return(
<Layout title="Upgrade">
<div style={{maxWidth:480,margin:'60px auto',textAlign:'center',padding:32,background:'white',borderRadius:16,border:'0.5px solid var(--border)'}}>
<div style={{width:60,height:60,borderRadius:'50%',background:'rgba(22,163,74,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
<Check size={30} color="#16a34a"/>
</div>
<h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Request Submitted!</h2>
<p style={{color:'var(--text-3)',fontSize:14,marginBottom:24}}>သင့်ရဲ့ upgrade request ကို လက်ခံရရှိပါပြီ။ ငွေလွှဲ စစ်ဆေးပြီးတာနဲ့ plan upgrade ဖြစ်ပါမယ်။</p>
<button onClick={()=>navigate('/')} className="btn btn-primary" style={{width:'100%'}}>Back to Dashboard</button>
</div>
</Layout>
)

return(
<Layout title="Upgrade Plan">
<div style={{maxWidth:1000,margin:'0 auto'}}>
<button onClick={()=>navigate(-1)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex',alignItems:'center',gap:6,marginBottom:16,fontSize:13}}>
<ArrowLeft size={16}/>Back
</button>

<div style={{textAlign:'center',marginBottom:8}}>
<h1 style={{fontSize:26,fontWeight:700,marginBottom:6}}>Simple pricing, no hidden fees</h1>
<p style={{color:'var(--text-3)',fontSize:14}}>Per workspace, per month. Start free, upgrade anytime.</p>
<div style={{fontSize:12,color:'var(--primary)',marginTop:6}}>Current plan: <strong>{PLAN_LIMITS[normalizePlan(currentPlan)]?.label||'Free Trial'}</strong></div>
</div>

{hasPending&&(
<div style={{background:'#faeeda',border:'0.5px solid #f59e0b',color:'#d97706',padding:'12px 16px',borderRadius:10,fontSize:13,margin:'16px 0',textAlign:'center'}}>
⏳ သင့်မှာ pending upgrade request တစ်ခု ရှိနေပါတယ်။ Admin approve လုပ်တာ စောင့်ပါ။
</div>
)}

{/* Plan cards */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,margin:'24px 0'}}>
{PAID_PLANS.map(planKey=>{
const p=PLAN_LIMITS[planKey]
const isSelected=selectedPlan===planKey
const isCurrent=normalizePlan(currentPlan)===planKey
const isPopular=planKey==='growth'
return(
<div key={planKey} onClick={()=>!isCurrent&&setSelectedPlan(planKey)} style={{
position:'relative',background:'white',borderRadius:16,padding:24,cursor:isCurrent?'default':'pointer',
border:isSelected?'2px solid var(--primary)':'0.5px solid var(--border)',
opacity:isCurrent?0.6:1,transition:'all 0.15s',
}}>
{isPopular&&<div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:'var(--primary)',color:'white',fontSize:10,fontWeight:700,padding:'4px 14px',borderRadius:20}}>MOST POPULAR</div>}
{isCurrent&&<div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:'#16a34a',color:'white',fontSize:10,fontWeight:700,padding:'4px 14px',borderRadius:20}}>CURRENT</div>}
<div style={{fontSize:18,fontWeight:700,color:'var(--primary)',marginBottom:8}}>{p.label}</div>
<div style={{fontSize:26,fontWeight:800,marginBottom:2}}>{formatMMK(p.price)}</div>
<div style={{fontSize:12,color:'var(--text-3)',marginBottom:16}}>per workspace / month</div>
<div style={{borderTop:'0.5px solid var(--border)',paddingTop:14}}>
{PLAN_FEATURES[planKey].map((f,i)=>(
<div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:13}}>
<div style={{width:18,height:18,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
<Check size={11} color="var(--primary)"/>
</div>
{f}
</div>
))}
</div>
{isSelected&&<div style={{marginTop:14,textAlign:'center',fontSize:12,fontWeight:600,color:'var(--primary)'}}>✓ Selected</div>}
</div>
)
})}
</div>

{/* Payment section */}
{selectedPlan&&!hasPending&&(
<div style={{background:'white',borderRadius:16,padding:24,border:'0.5px solid var(--border)',marginTop:8}}>
<h3 style={{fontSize:16,fontWeight:700,marginBottom:4}}>Payment — {PLAN_LIMITS[selectedPlan].label}</h3>
<p style={{fontSize:13,color:'var(--text-3)',marginBottom:16}}>အောက်က account ကို <strong>{formatMMK(PLAN_LIMITS[selectedPlan].price)}</strong> လွှဲပြီး screenshot upload ပါ။</p>

{/* Bank info */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
{Object.values(PAYMENT_INFO).map((acc,i)=>(
<div key={i} style={{background:'#f8fafc',borderRadius:10,padding:14}}>
<div style={{fontSize:12,fontWeight:700,color:'var(--primary)',marginBottom:6}}>{acc.name}</div>
<div style={{fontSize:14,fontWeight:600,fontFamily:'monospace'}}>{acc.number}</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{acc.accountName}</div>
</div>
))}
</div>

{/* Transaction note */}
<div style={{marginBottom:16}}>
<label style={{fontSize:13,fontWeight:500,display:'block',marginBottom:6}}>Transaction Reference / Note *</label>
<input className="form-input" value={txnNote} onChange={e=>setTxnNote(e.target.value)} placeholder="ဥပမာ — KPay txn ID, လွှဲတဲ့ အချိန်..."/>
</div>

{/* Screenshot upload */}
<div style={{marginBottom:20}}>
<label style={{fontSize:13,fontWeight:500,display:'block',marginBottom:6}}>Payment Screenshot *</label>
{screenshotUrl?(
<div style={{position:'relative',display:'inline-block'}}>
<img src={screenshotUrl} alt="proof" style={{maxWidth:200,borderRadius:10,border:'0.5px solid var(--border)'}}/>
<button onClick={()=>{setScreenshot(null);setScreenshotUrl('')}} style={{position:'absolute',top:-8,right:-8,background:'#dc2626',color:'white',border:'none',borderRadius:'50%',width:24,height:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={14}/></button>
</div>
):(
<label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:32,border:'2px dashed var(--border)',borderRadius:10,cursor:'pointer',color:'var(--text-3)'}}>
<Upload size={24}/>
<span style={{fontSize:13}}>{uploading?'Uploading...':'Click to upload screenshot'}</span>
<input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleUpload(e.target.files[0])}/>
</label>
)}
</div>

<button onClick={handleSubmit} disabled={submitting||uploading} className="btn btn-primary" style={{width:'100%',padding:'12px'}}>
<Crown size={16}/>{submitting?'Submitting...':'Submit Upgrade Request'}
</button>
</div>
)}
</div>
</Layout>
)
}
