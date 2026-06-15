import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,orderBy,doc,getDoc,updateDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{useNavigate}from'react-router-dom'
import{Crown,Calendar,CheckCircle,Clock,XCircle,Download,CreditCard,FileText,Users,UserPlus}from'lucide-react'
import{usePlans,formatMMK}from'../hooks/usePlans'
import jsPDF from'jspdf'
import{QRCodeCanvas}from'qrcode.react'
import{createRoot}from'react-dom/client'

const fmtDate=(d)=>{if(!d)return'-';try{return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}catch{return d}}
const fmtTS=(ts)=>{if(!ts)return'-';try{const d=ts.seconds?new Date(ts.seconds*1000):new Date(ts);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}catch{return'-'}}

export default function Billing(){
const navigate=useNavigate()
const{getLimit,planLabel,planPrice,loading:plansLoading}=usePlans()
const[company,setCompany]=useState(null)
const[history,setHistory]=useState([])
const[counts,setCounts]=useState({docs:0,customers:0,members:0})
const[receiptCfg,setReceiptCfg]=useState(null)
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const cdata={id:cid,...snap.docs[0].data()}
setCompany(cdata)
// payment history
try{
const hSnap=await getDocs(query(collection(db,'upgradeRequests'),where('companyId','==',cid),orderBy('createdAt','desc')))
setHistory(hSnap.docs.map(d=>({id:d.id,...d.data()})))
}catch(e){
const hSnap=await getDocs(query(collection(db,'upgradeRequests'),where('companyId','==',cid)))
setHistory(hSnap.docs.map(d=>({id:d.id,...d.data()})))
}
// usage counts
const ym=new Date().toISOString().slice(0,7)
const[custSnap,invSnap,quoSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'customers')),
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'quotations')),
])
const cm=(docs)=>docs.filter(d=>{const dt=d.data();let m='';if(dt.createdAt?.seconds)m=new Date(dt.createdAt.seconds*1000).toISOString().slice(0,7);else if(dt.date)m=String(dt.date).slice(0,7);return m===ym}).length
setCounts({docs:cm(invSnap.docs)+cm(quoSnap.docs),customers:custSnap.size,members:Object.keys(cdata.members||{}).length})
}
// receipt config
try{
const rSnap=await getDoc(doc(db,'config','receipt'))
if(rSnap.exists())setReceiptCfg(rSnap.data())
}catch(e){}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

// qrcode.react ကို hidden render ပြီး base64 ထုတ် (package အသစ် မလို)
const genQR=(text)=>new Promise((resolve)=>{
const div=document.createElement('div')
div.style.position='fixed';div.style.left='-9999px'
document.body.appendChild(div)
const root=createRoot(div)
root.render(<QRCodeCanvas value={text} size={200} level="M"/>)
setTimeout(()=>{
try{
const canvas=div.querySelector('canvas')
const data=canvas?canvas.toDataURL('image/png'):null
resolve(data)
}catch(e){resolve(null)}
finally{root.unmount();document.body.removeChild(div)}
},100)
})

// image URL → base64 (PDF embed အတွက်)
const loadImg=(url)=>new Promise((resolve)=>{
const img=new Image()
// external URL (Firebase storage) ဆိုမှ crossOrigin လို၊ local public file ဆို မလို
if(/^https?:\/\//.test(url)&&!url.startsWith(window.location.origin)){
img.crossOrigin='anonymous'
}
img.onload=()=>{
try{
const c=document.createElement('canvas')
c.width=img.naturalWidth;c.height=img.naturalHeight
c.getContext('2d').drawImage(img,0,0)
resolve({data:c.toDataURL('image/png'),w:img.naturalWidth,h:img.naturalHeight})
}catch(e){console.error('logo canvas:',e);resolve(null)}
}
img.onerror=(e)=>{console.error('logo load fail:',url,e);resolve(null)}
img.src=url
})

const downloadReceipt=async(req)=>{
const cfg=receiptCfg||{}
const primary=cfg.primaryColor||'#4f6ef7'
const bizName=cfg.businessName||'Ankorax'
const logoUrl=cfg.logoUrl||'/ankora_x_logo_2.png'
// hex → rgb
const hex2rgb=(h)=>{const x=h.replace('#','');return[parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)]}
const[pr,pg,pb]=hex2rgb(primary)

const pdf=new jsPDF('p','mm','a4')
const W=210
let y=20

// logo
const logo=await loadImg(logoUrl)
if(logo){
const lw=24,lh=logo.h/logo.w*lw
pdf.addImage(logo.data,'PNG',20,y,lw,lh)
}
// business name (right)
pdf.setFontSize(22);pdf.setTextColor(pr,pg,pb);pdf.setFont(undefined,'bold')
pdf.text(bizName,W-20,y+8,{align:'right'})
pdf.setFontSize(10);pdf.setTextColor(150,150,150);pdf.setFont(undefined,'normal')
pdf.text('Payment Receipt',W-20,y+15,{align:'right'})

y+=32
// divider
pdf.setDrawColor(pr,pg,pb);pdf.setLineWidth(0.8);pdf.line(20,y,W-20,y)
y+=12

// business info block
pdf.setFontSize(9);pdf.setTextColor(120,120,120)
const bizLines=[cfg.addressLine,cfg.phone?'Tel: '+cfg.phone:'',cfg.email,cfg.website].filter(Boolean)
bizLines.forEach(line=>{pdf.text(line,20,y);y+=5})
y+=8

// receipt detail rows
const months=req.months||1
// expiry = approve date + months×30
const baseDate=req.approvedAt?.seconds?new Date(req.approvedAt.seconds*1000):new Date()
const expiry=new Date(baseDate);expiry.setDate(expiry.getDate()+30*months)
const rows=[
['Receipt ID',req.id],
['Date',fmtTS(req.approvedAt||req.createdAt)],
['Plan',planLabel(req.requestedPlan)],
['Duration',months+(months===1?' month':' months')],
['Valid Until',expiry.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})],
['Billing Email',req.requestedByEmail||'-'],
]
if(req.couponCode)rows.push(['Coupon',req.couponCode])
rows.push(['Status','Paid'])

pdf.setFontSize(11)
rows.forEach(([k,v])=>{
pdf.setTextColor(120,120,120);pdf.setFont(undefined,'normal')
pdf.text(k,20,y)
pdf.setTextColor(30,41,59);pdf.setFont(undefined,'bold')
pdf.text(String(v),W-20,y,{align:'right'})
pdf.setDrawColor(235,235,235);pdf.setLineWidth(0.2);pdf.line(20,y+2,W-20,y+2)
y+=9
})

// total box
y+=6
pdf.setFillColor(pr,pg,pb)
pdf.roundedRect(20,y,W-40,16,2,2,'F')
pdf.setTextColor(255,255,255);pdf.setFontSize(13);pdf.setFont(undefined,'bold')
pdf.text('Total Paid',26,y+10)
pdf.text(formatMMK(req.amount),W-26,y+10,{align:'right'})
y+=16

// QR — CRM verify URL
try{
const verifyUrl=`https://ankorax-sales-crm.vercel.app/verify-receipt/${req.id}`
const qrUrl=await genQR(verifyUrl)
if(qrUrl){
y+=12
pdf.addImage(qrUrl,'PNG',20,y,28,28)
pdf.setFontSize(9);pdf.setTextColor(120,120,120);pdf.setFont(undefined,'normal')
pdf.text('Scan to verify',52,y+10)
pdf.setFontSize(8);pdf.setTextColor(160,160,160)
pdf.text('Scan this QR code to verify receipt authenticity.',52,y+16)
}
}catch(e){console.error('qr:',e)}

// footer
pdf.setFontSize(9);pdf.setTextColor(160,160,160);pdf.setFont(undefined,'normal')
pdf.text(cfg.footerNote||'Thank you for your business',W/2,280,{align:'center'})

pdf.save(`receipt-${req.id.slice(0,8)}.pdf`)
}

if(loading||plansLoading)return<Layout title="Billing"><div style={{padding:40,textAlign:'center'}}>Loading...</div></Layout>
if(!company)return<Layout title="Billing"><div style={{padding:40,textAlign:'center'}}>No company found</div></Layout>

const plan=company.plan||'free'
const isPaid=plan!=='free'
const isCancelled=company.subscriptionCancelled===true
// expiring — end date နီးနေလား (7 ရက်အတွင်း)
const daysToExpiry=company.subscriptionEnd?Math.ceil((new Date(company.subscriptionEnd+'T23:59:59')-new Date())/(1000*60*60*24)):null
const isExpiring=isPaid&&daysToExpiry!==null&&daysToExpiry<=7&&daysToExpiry>=0

const handleCancel=async()=>{
if(!confirm('Subscription ကို cancel မလား?\n\n⚠️ ဝယ်ထားတဲ့ '+fmtDate(company.subscriptionEnd)+' အထိတော့ ဆက်သုံးနိုင်ပါတယ်။ အဲ့ဒီနောက် free plan ပြန်ဖြစ်ပါမယ်။'))return
try{
await updateDoc(doc(db,'companies',company.id),{subscriptionCancelled:true,cancelledAt:new Date().toISOString()})
setCompany({...company,subscriptionCancelled:true})
}catch(e){alert(e.message)}
}
const handleResubscribe=async()=>{
try{
await updateDoc(doc(db,'companies',company.id),{subscriptionCancelled:false})
setCompany({...company,subscriptionCancelled:false})
}catch(e){alert(e.message)}
}

const statusIcon=(s)=>s==='approved'?<CheckCircle size={14} color="#16a34a"/>:s==='pending'?<Clock size={14} color="#d97706"/>:s==='refunded'?<XCircle size={14} color="#dc2626"/>:<XCircle size={14} color="#dc2626"/>
const statusText=(s)=>({approved:'Paid',pending:'Pending',rejected:'Rejected',refunded:'Refunded'}[s]||s)

const usageItems=[
{label:'Documents',icon:FileText,count:counts.docs,limit:getLimit(plan,'documents')},
{label:'Customers',icon:Users,count:counts.customers,limit:getLimit(plan,'customers')},
{label:'Members',icon:UserPlus,count:counts.members,limit:getLimit(plan,'members')},
]

return(
<Layout title="Billing">
<div style={{maxWidth:820,margin:'0 auto'}}>

{/* Expiring warning */}
{isExpiring&&(
<div style={{background:isCancelled?'#fcebeb':'#faeeda',border:`0.5px solid ${isCancelled?'#dc2626':'#f59e0b'}`,borderRadius:12,padding:'14px 18px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
<div>
<div style={{fontSize:14,fontWeight:700,color:isCancelled?'#dc2626':'#d97706'}}>
{daysToExpiry===0?'⏰ ဒီနေ့ ကုန်ဆုံးမယ်!':`⏰ ${daysToExpiry} ရက် အတွင်း ကုန်ဆုံးမယ်`}
</div>
<div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>
{isCancelled?'Subscription cancel လုပ်ထားတယ်။ ဆက်သုံးချင်ရင် resubscribe လုပ်ပါ။':'Plan ဆက်သုံးဖို့ renew လုပ်ပါ။'} (Valid until {fmtDate(company.subscriptionEnd)})
</div>
</div>
<button onClick={()=>navigate('/upgrade')} style={{background:isCancelled?'#dc2626':'#d97706',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>Resubscribe</button>
</div>
)}

{/* Current plan card */}
<div style={{background:'linear-gradient(135deg,#4f6ef7,#8b5cf6)',borderRadius:16,padding:24,color:'white',marginBottom:20}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
<div style={{fontSize:13,opacity:0.85,marginBottom:4}}>Current Plan</div>
<div style={{fontSize:26,fontWeight:700,display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Crown size={24}/>{planLabel(plan)}{isCancelled&&<span style={{fontSize:11,background:'rgba(255,255,255,0.25)',padding:'2px 8px',borderRadius:10,fontWeight:600}}>Cancelled</span>}</div>
{isPaid&&<div style={{fontSize:14,opacity:0.9}}>{formatMMK(planPrice(plan))} / month</div>}
</div>
<button onClick={()=>navigate('/upgrade')} style={{background:'white',color:'#4f6ef7',border:'none',borderRadius:10,padding:'10px 20px',fontWeight:600,fontSize:13,cursor:'pointer'}}>{isPaid?'Change Plan':'Upgrade'}</button>
</div>
{isPaid&&company.subscriptionEnd&&(
<div style={{marginTop:16,paddingTop:16,borderTop:'0.5px solid rgba(255,255,255,0.2)',display:'flex',gap:24,fontSize:13,alignItems:'center',flexWrap:'wrap'}}>
<div><span style={{opacity:0.8}}>Started: </span>{fmtDate(company.subscriptionStart)}</div>
<div><span style={{opacity:0.8}}>{isCancelled?'Active until: ':'Renews/Ends: '}</span><strong>{fmtDate(company.subscriptionEnd)}</strong></div>
<div style={{flex:1}}/>
{isCancelled?(
<button onClick={handleResubscribe} style={{background:'rgba(255,255,255,0.2)',color:'white',border:'0.5px solid rgba(255,255,255,0.4)',borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Resubscribe</button>
):(
<button onClick={handleCancel} style={{background:'rgba(255,255,255,0.15)',color:'white',border:'0.5px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:500,cursor:'pointer'}}>Cancel Subscription</button>
)}
</div>
)}
</div>

{/* Usage summary */}
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
{usageItems.map(({label,icon:Icon,count,limit})=>(
<div key={label} className="card" style={{padding:16}}>
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,color:'var(--text-3)'}}><Icon size={15}/><span style={{fontSize:12}}>{label}</span></div>
<div style={{fontSize:18,fontWeight:700}}>{count}{limit===-1?'':<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/{limit}</span>}</div>
</div>
))}
</div>

{/* Payment history */}
<div className="card" style={{overflow:'hidden'}}>
<div style={{padding:'16px 20px',borderBottom:'0.5px solid #f1f5f9',fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}><CreditCard size={16} color="var(--primary)"/>Payment History</div>
{history.length===0?(
<div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>
<CreditCard size={32} style={{margin:'0 auto 10px',opacity:0.2}}/>
<div>No payment history yet</div>
</div>
):(
<div style={{overflowX:'auto'}}>
<table style={{width:'100%'}}>
<thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'center'}}>Receipt</th></tr></thead>
<tbody>
{history.map(req=>(
<tr key={req.id}>
<td style={{fontSize:12,color:'var(--text-3)'}}>{fmtTS(req.approvedAt||req.createdAt)}</td>
<td><span style={{fontSize:13,fontWeight:600,color:'var(--primary)'}}>{planLabel(req.requestedPlan)}</span>{req.couponCode&&<span style={{fontSize:10,color:'#16a34a',marginLeft:6}}>🎟{req.couponCode}</span>}</td>
<td style={{fontSize:13,fontWeight:600}}>{formatMMK(req.amount)}</td>
<td style={{textAlign:'center'}}><span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:12}}>{statusIcon(req.status)}{statusText(req.status)}</span></td>
<td style={{textAlign:'center'}}>
{req.status==='approved'?(
<button onClick={()=>downloadReceipt(req)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',display:'inline-flex',alignItems:'center',gap:4,fontSize:12}}><Download size={13}/>Receipt</button>
):req.status==='refunded'?(
<span style={{fontSize:11,color:'#dc2626',fontWeight:600}}>Refunded</span>
):<span style={{fontSize:12,color:'var(--text-3)'}}>-</span>}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>

</div>
</Layout>
)
}
