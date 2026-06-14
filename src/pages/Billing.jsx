import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where,orderBy,doc,getDoc}from'firebase/firestore'
import Layout from'../components/Layout'
import{useNavigate}from'react-router-dom'
import{Crown,Calendar,CheckCircle,Clock,XCircle,Download,CreditCard,FileText,Users,UserPlus}from'lucide-react'
import{usePlans,formatMMK}from'../hooks/usePlans'
import jsPDF from'jspdf'

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

// image URL → base64 (PDF embed အတွက်)
const loadImg=(url)=>new Promise((resolve)=>{
const img=new Image()
img.crossOrigin='anonymous'
img.onload=()=>{
const c=document.createElement('canvas')
c.width=img.width;c.height=img.height
c.getContext('2d').drawImage(img,0,0)
try{resolve({data:c.toDataURL('image/png'),w:img.width,h:img.height})}catch(e){resolve(null)}
}
img.onerror=()=>resolve(null)
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
const lw=32,lh=logo.h/logo.w*lw
pdf.addImage(logo.data,'PNG',20,y,lw,Math.min(lh,20))
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
const rows=[
['Receipt ID',req.id],
['Date',fmtTS(req.approvedAt||req.createdAt)],
['Plan',(req.requestedPlan||'').charAt(0).toUpperCase()+(req.requestedPlan||'').slice(1)],
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

// footer
pdf.setFontSize(9);pdf.setTextColor(160,160,160);pdf.setFont(undefined,'normal')
pdf.text(cfg.footerNote||'Thank you for your business',W/2,280,{align:'center'})

pdf.save(`receipt-${req.id.slice(0,8)}.pdf`)
}

if(loading||plansLoading)return<Layout title="Billing"><div style={{padding:40,textAlign:'center'}}>Loading...</div></Layout>
if(!company)return<Layout title="Billing"><div style={{padding:40,textAlign:'center'}}>No company found</div></Layout>

const plan=company.plan||'free'
const isPaid=plan!=='free'
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

{/* Current plan card */}
<div style={{background:'linear-gradient(135deg,#4f6ef7,#8b5cf6)',borderRadius:16,padding:24,color:'white',marginBottom:20}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
<div>
<div style={{fontSize:13,opacity:0.85,marginBottom:4}}>Current Plan</div>
<div style={{fontSize:26,fontWeight:700,display:'flex',alignItems:'center',gap:8,marginBottom:8}}><Crown size={24}/>{planLabel(plan)}</div>
{isPaid&&<div style={{fontSize:14,opacity:0.9}}>{formatMMK(planPrice(plan))} / month</div>}
</div>
<button onClick={()=>navigate('/upgrade')} style={{background:'white',color:'#4f6ef7',border:'none',borderRadius:10,padding:'10px 20px',fontWeight:600,fontSize:13,cursor:'pointer'}}>{isPaid?'Change Plan':'Upgrade'}</button>
</div>
{isPaid&&company.subscriptionEnd&&(
<div style={{marginTop:16,paddingTop:16,borderTop:'0.5px solid rgba(255,255,255,0.2)',display:'flex',gap:24,fontSize:13}}>
<div><span style={{opacity:0.8}}>Started: </span>{fmtDate(company.subscriptionStart)}</div>
<div><span style={{opacity:0.8}}>Renews/Ends: </span><strong>{fmtDate(company.subscriptionEnd)}</strong></div>
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
<td><span style={{fontSize:13,fontWeight:600,textTransform:'capitalize',color:'var(--primary)'}}>{req.requestedPlan}</span>{req.couponCode&&<span style={{fontSize:10,color:'#16a34a',marginLeft:6}}>🎟{req.couponCode}</span>}</td>
<td style={{fontSize:13,fontWeight:600}}>{formatMMK(req.amount)}</td>
<td style={{textAlign:'center'}}><span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:12}}>{statusIcon(req.status)}{statusText(req.status)}</span></td>
<td style={{textAlign:'center'}}>
{req.status==='approved'?(
<button onClick={()=>downloadReceipt(req)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',display:'inline-flex',alignItems:'center',gap:4,fontSize:12}}><Download size={13}/>Receipt</button>
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
