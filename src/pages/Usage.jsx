import{useState,useEffect}from'react'
import{db,auth}from'../firebase'
import{collection,getDocs,query,where}from'firebase/firestore'
import Layout from'../components/Layout'
import{useNavigate}from'react-router-dom'
import{FileText,Users,UserPlus,Crown,TrendingUp}from'lucide-react'
import{usePlans}from'../hooks/usePlans'

export default function Usage(){
const navigate=useNavigate()
const{getLimit,planLabel,loading:plansLoading}=usePlans()
const[plan,setPlan]=useState('free')
const[docCount,setDocCount]=useState(0)
const[customerCount,setCustomerCount]=useState(0)
const[memberCount,setMemberCount]=useState(0)
const[loading,setLoading]=useState(true)

useEffect(()=>{
const load=async()=>{
try{
const snap=await getDocs(query(collection(db,'companies'),where(`members.${auth.currentUser.uid}`,'!=',null)))
if(!snap.empty){
const cid=snap.docs[0].id
const cdata=snap.docs[0].data()
setPlan(cdata.plan||'free')
setMemberCount(Object.keys(cdata.members||{}).length)
// customers
const custSnap=await getDocs(collection(db,'companies',cid,'customers'))
setCustomerCount(custSnap.size)
// documents this month (invoices + quotations)
const ym=new Date().toISOString().slice(0,7)
const[invSnap,quoSnap]=await Promise.all([
getDocs(collection(db,'companies',cid,'invoices')),
getDocs(collection(db,'companies',cid,'quotations')),
])
const countThisMonth=(docs)=>docs.filter(d=>{
const data=d.data()
let mon=''
if(data.createdAt?.seconds)mon=new Date(data.createdAt.seconds*1000).toISOString().slice(0,7)
else if(data.date)mon=String(data.date).slice(0,7)
return mon===ym
}).length
setDocCount(countThisMonth(invSnap.docs)+countThisMonth(quoSnap.docs))
}
}catch(e){console.error(e)}
setLoading(false)
}
load()
},[])

if(loading||plansLoading)return<Layout title="Usage"><div style={{padding:40,textAlign:'center'}}>Loading...</div></Layout>

const items=[
{label:'Documents (this month)',sub:'Invoices + Quotations',icon:FileText,count:docCount,limit:getLimit(plan,'documents'),color:'#4f6ef7'},
{label:'Customers',sub:'Total customers',icon:Users,count:customerCount,limit:getLimit(plan,'customers'),color:'#16a34a'},
{label:'Team Members',sub:'People in workspace',icon:UserPlus,count:memberCount,limit:getLimit(plan,'members'),color:'#d97706'},
]

return(
<Layout title="Usage">
<div style={{maxWidth:720,margin:'0 auto'}}>

{/* Plan header */}
<div style={{background:'linear-gradient(135deg,#4f6ef7,#8b5cf6)',borderRadius:16,padding:24,color:'white',marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div>
<div style={{fontSize:13,opacity:0.85,marginBottom:4}}>Current Plan</div>
<div style={{fontSize:24,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Crown size={22}/>{planLabel(plan)}</div>
</div>
<button onClick={()=>navigate('/upgrade')} style={{background:'white',color:'#4f6ef7',border:'none',borderRadius:10,padding:'10px 20px',fontWeight:600,fontSize:13,cursor:'pointer'}}>Upgrade</button>
</div>

{/* Usage bars */}
<div style={{display:'flex',flexDirection:'column',gap:14}}>
{items.map(({label,sub,icon:Icon,count,limit,color})=>{
const unlimited=limit===-1
const pct=unlimited?0:Math.min(100,Math.round((count/limit)*100))
const near=!unlimited&&pct>=80
const full=!unlimited&&count>=limit
return(
<div key={label} className="card" style={{padding:20}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
<div style={{display:'flex',gap:12,alignItems:'center'}}>
<div style={{width:40,height:40,borderRadius:10,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
<Icon size={20} color={color}/>
</div>
<div>
<div style={{fontWeight:600,fontSize:14}}>{label}</div>
<div style={{fontSize:12,color:'var(--text-3)'}}>{sub}</div>
</div>
</div>
<div style={{textAlign:'right'}}>
<div style={{fontSize:20,fontWeight:700,color:full?'#dc2626':'var(--text-1)'}}>{count}{unlimited?'':<span style={{fontSize:14,color:'var(--text-3)',fontWeight:400}}>/{limit}</span>}</div>
{unlimited&&<div style={{fontSize:11,color:'#16a34a',fontWeight:600}}>Unlimited</div>}
</div>
</div>
{!unlimited&&(
<div style={{height:8,background:'#f1f5f9',borderRadius:10,overflow:'hidden'}}>
<div style={{height:'100%',width:pct+'%',background:full?'#dc2626':near?'#d97706':color,borderRadius:10,transition:'width 0.3s'}}/>
</div>
)}
{full&&<div style={{fontSize:12,color:'#dc2626',marginTop:8}}>Limit ပြည့်ပါပြီ — <span onClick={()=>navigate('/upgrade')} style={{color:'var(--primary)',fontWeight:600,cursor:'pointer'}}>Upgrade</span> လုပ်ပါ</div>}
{near&&!full&&<div style={{fontSize:12,color:'#d97706',marginTop:8}}>Limit နီးပါပြီ ({pct}%)</div>}
</div>
)
})}
</div>

</div>
</Layout>
)
}
